-- ============================================================================
-- Fix Edge Function Authentication
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
  edge_function_url TEXT;
  service_role_key TEXT;
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
    -- Build Edge Function URL
    edge_function_url := 'https://thyqmgekkwwlqcwkgsmb.supabase.co/functions/v1/execute-task';
    
    -- Use service role key for authentication
    service_role_key := COALESCE(
      current_setting('app.supabase_service_role_key', true),
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoeXFtZ2Vra3d3bHFjd2tnc21iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNzE3MTg3MiwiZXhwIjoyMDQyNzQ3ODcyfQ.YOUR_SERVICE_ROLE_KEY_HERE'
    );
    
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
    
    -- Make HTTP request to Edge Function with service role key
    SELECT * INTO api_response FROM http((
      'POST',
      edge_function_url,
      ARRAY[
        http_header('Content-Type', 'application/json'),
        http_header('Authorization', 'Bearer ' || service_role_key),
        http_header('apikey', service_role_key)
      ],
      'application/json',
      api_payload::text
    )::http_request);
    
    -- Parse API response
    BEGIN
      execution_result := api_response.content::jsonb;
    EXCEPTION WHEN OTHERS THEN
      execution_result := jsonb_build_object(
        'success', false,
        'error', 'Failed to parse Edge Function response',
        'raw_response', api_response.content,
        'status_code', api_response.status
      );
    END;
    
    -- Check if Edge Function call was successful
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
      
      RAISE NOTICE 'Task executed successfully via Edge Function: % (Log ID: %)', task_uuid, execution_log_id;
      
    ELSE
      -- Edge Function call failed or returned error
      exec_error_message := COALESCE(
        execution_result->>'error',
        'Edge Function call failed with status ' || api_response.status || '. Response: ' || COALESCE(api_response.content, 'No content')
      );
      
      RAISE EXCEPTION 'Edge Function execution failed: %', exec_error_message;
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
