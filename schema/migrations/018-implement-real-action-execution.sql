-- ============================================================================
-- Implement Real Action Execution via API Calls
-- ============================================================================

-- Enable the http extension for making HTTP requests from PostgreSQL
CREATE EXTENSION IF NOT EXISTS http;

-- ============================================================================
-- Updated Execute Scheduled Task Function with Real API Calls
-- ============================================================================

CREATE OR REPLACE FUNCTION public.execute_scheduled_task(task_uuid UUID)
RETURNS void AS $$
DECLARE
  task_record RECORD;
  execution_log_id UUID;
  execution_result JSONB;
  exec_error_message TEXT;
  api_response http_response;
  api_payload JSONB;
  api_url TEXT;
  internal_api_key TEXT;
BEGIN
  -- Get task details with integration info
  SELECT 
    st.*,
    ui.id as integration_id,
    ui.encrypted_access_token,
    ui.encrypted_refresh_token,
    ui.encrypted_api_key,
    ui.additional_config as integration_config,
    ip.slug as provider_slug,
    ip.name as provider_name
  INTO task_record
  FROM public.scheduled_tasks st
  LEFT JOIN public.user_integrations ui ON st.integration_id = ui.id
  LEFT JOIN public.integration_providers ip ON ui.provider_id = ip.id
  WHERE st.id = task_uuid;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Task not found: %', task_uuid;
    RETURN;
  END IF;
  
  -- Check if task is ready for execution
  IF task_record.status NOT IN ('pending', 'active') THEN
    RAISE NOTICE 'Task % is not in executable state (status: %)', task_uuid, task_record.status;
    RETURN;
  END IF;
  
  -- Create execution log entry
  INSERT INTO public.task_execution_logs (task_id, user_id, status, started_at, executed_at)
  VALUES (task_uuid, task_record.user_id, 'running', now(), now())
  RETURNING id INTO execution_log_id;
  
  BEGIN
    -- Get API configuration
    api_url := COALESCE(
      current_setting('app.api_base_url', true), 
      'http://localhost:3000'
    ) || '/api/internal/execute-action';
    
    internal_api_key := current_setting('app.internal_api_key', true);
    
    -- Build API payload
    api_payload := jsonb_build_object(
      'task_id', task_uuid,
      'user_id', task_record.user_id,
      'provider_slug', task_record.provider_slug,
      'action_type', task_record.action_type,
      'action_config', task_record.action_config,
      'integration', jsonb_build_object(
        'id', task_record.integration_id,
        'encrypted_access_token', task_record.encrypted_access_token,
        'encrypted_refresh_token', task_record.encrypted_refresh_token,
        'encrypted_api_key', task_record.encrypted_api_key,
        'additional_config', task_record.integration_config
      )
    );
    
    -- Make HTTP request to internal API
    IF internal_api_key IS NOT NULL THEN
      SELECT * INTO api_response FROM http((
        'POST',
        api_url,
        ARRAY[
          http_header('Content-Type', 'application/json'),
          http_header('Authorization', 'Bearer ' || internal_api_key)
        ],
        'application/json',
        api_payload::text
      )::http_request);
    ELSE
      SELECT * INTO api_response FROM http((
        'POST',
        api_url,
        ARRAY[http_header('Content-Type', 'application/json')],
        'application/json',
        api_payload::text
      )::http_request);
    END IF;
    
    -- Parse API response
    BEGIN
      execution_result := api_response.content::jsonb;
    EXCEPTION WHEN OTHERS THEN
      execution_result := jsonb_build_object(
        'success', false,
        'error', 'Failed to parse API response',
        'raw_response', api_response.content,
        'status_code', api_response.status
      );
    END;
    
    -- Check if API call was successful
    IF api_response.status = 200 AND (execution_result->>'success')::boolean = true THEN
      -- Update execution log with success
      UPDATE public.task_execution_logs
      SET status = 'success',
          completed_at = now(),
          result = execution_result->'result',
          result_data = execution_result->'result',
          error_message = NULL
      WHERE id = execution_log_id;
      
      -- Update task execution metadata
      UPDATE public.scheduled_tasks
      SET last_executed_at = now(),
          execution_count = execution_count + 1,
          retry_count = 0,
          last_error = NULL,
          next_execution_at = CASE 
            WHEN recurrence_rule IS NOT NULL THEN 
              CASE 
                WHEN recurrence_rule LIKE '%DAILY%' THEN scheduled_at + INTERVAL '1 day'
                WHEN recurrence_rule LIKE '%WEEKLY%' THEN scheduled_at + INTERVAL '1 week'
                WHEN recurrence_rule LIKE '%MONTHLY%' THEN scheduled_at + INTERVAL '1 month'
                ELSE scheduled_at + INTERVAL '1 day'
              END
            ELSE NULL
          END,
          status = CASE
            WHEN recurrence_rule IS NULL THEN 'completed'
            WHEN max_executions IS NOT NULL AND execution_count + 1 >= max_executions THEN 'completed'
            ELSE 'active'
          END
      WHERE id = task_uuid;
      
      RAISE NOTICE 'Task executed successfully via API: % (Log ID: %)', task_uuid, execution_log_id;
      
    ELSE
      -- API call failed or returned error
      exec_error_message := COALESCE(
        execution_result->>'error',
        'API call failed with status ' || api_response.status
      );
      
      RAISE EXCEPTION 'API execution failed: %', exec_error_message;
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    -- Handle execution errors
    exec_error_message := SQLERRM;
    
    -- Update execution log with error
    UPDATE public.task_execution_logs
    SET status = 'failed',
        completed_at = now(),
        error_message = exec_error_message
    WHERE id = execution_log_id;
    
    -- Update task with error info and retry logic
    UPDATE public.scheduled_tasks
    SET retry_count = retry_count + 1,
        last_error = exec_error_message,
        failed_at = now(),
        status = CASE
          WHEN retry_count + 1 >= max_retries THEN 'failed'
          ELSE status
        END,
        next_execution_at = CASE
          WHEN retry_count + 1 < max_retries THEN now() + INTERVAL '5 minutes'
          ELSE NULL
        END
    WHERE id = task_uuid;
    
    RAISE NOTICE 'Task execution failed: % - %', task_uuid, exec_error_message;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Configuration Settings
-- ============================================================================

-- Set these in your environment:
-- ALTER DATABASE your_db SET app.api_base_url = 'https://your-domain.com';
-- ALTER DATABASE your_db SET app.internal_api_key = 'your-secret-key';

COMMENT ON FUNCTION public.execute_scheduled_task(UUID) IS 'Executes scheduled tasks by calling internal API endpoint for real action execution';

