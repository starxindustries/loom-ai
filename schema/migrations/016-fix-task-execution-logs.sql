-- ============================================================================
-- Fix Task Execution Logs Table
-- ============================================================================
-- Add missing columns for proper execution tracking

-- Add missing columns to task_execution_logs
ALTER TABLE public.task_execution_logs 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS result JSONB DEFAULT '{}';

-- Update existing records to have started_at = executed_at for consistency
UPDATE public.task_execution_logs 
SET started_at = executed_at 
WHERE started_at IS NULL;

-- Update the execute_scheduled_task function to use correct column names
CREATE OR REPLACE FUNCTION public.execute_scheduled_task(task_uuid UUID)
RETURNS void AS $$
DECLARE
  task_record RECORD;
  integration_record RECORD;
  execution_log_id UUID;
  execution_result JSONB;
  error_message TEXT;
BEGIN
  -- Get task details with integration info
  SELECT 
    st.*,
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
  
  -- Create execution log entry with correct column names
  INSERT INTO public.task_execution_logs (task_id, user_id, status, started_at, executed_at)
  VALUES (task_uuid, task_record.user_id, 'running', now(), now())
  RETURNING id INTO execution_log_id;
  
  BEGIN
    -- Execute the task based on action type
    CASE task_record.action_type
      WHEN 'send_email' THEN
        -- Call the email execution function
        SELECT public.execute_email_action(
          task_record.user_id,
          task_record.action_config,
          task_record.encrypted_access_token,
          task_record.provider_slug
        ) INTO execution_result;
        
      WHEN 'post_message' THEN
        -- Call the message posting function
        SELECT public.execute_message_action(
          task_record.user_id,
          task_record.action_config,
          task_record.encrypted_access_token,
          task_record.provider_slug
        ) INTO execution_result;
        
      WHEN 'post_request', 'webhook' THEN
        -- Call the webhook execution function
        SELECT public.execute_webhook_action(
          task_record.user_id,
          task_record.action_config
        ) INTO execution_result;
        
      ELSE
        -- Default notification (in-app notification)
        execution_result := jsonb_build_object(
          'success', true,
          'message', 'Reminder: ' || task_record.title,
          'type', 'notification'
        );
    END CASE;
    
    -- Update execution log with success
    UPDATE public.task_execution_logs
    SET status = 'success',
        completed_at = now(),
        result = execution_result,
        result_data = execution_result, -- Keep both for compatibility
        error_message = NULL
    WHERE id = execution_log_id;
    
    -- Update task execution metadata
    UPDATE public.scheduled_tasks
    SET last_executed_at = now(),
        execution_count = execution_count + 1,
        retry_count = 0, -- Reset retry count on success
        last_error = NULL,
        next_execution_at = CASE 
          WHEN recurrence_rule IS NOT NULL THEN 
            -- For recurring tasks, calculate next execution
            -- This is simplified - in production you'd use proper RRULE parsing
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
    
    RAISE NOTICE 'Task executed successfully: % (Log ID: %)', task_uuid, execution_log_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Handle execution errors
    error_message := SQLERRM;
    
    -- Update execution log with error
    UPDATE public.task_execution_logs
    SET status = 'failed',
        completed_at = now(),
        error_message = error_message
    WHERE id = execution_log_id;
    
    -- Update task with error info and retry logic
    UPDATE public.scheduled_tasks
    SET retry_count = retry_count + 1,
        last_error = error_message,
        failed_at = now(),
        status = CASE
          WHEN retry_count + 1 >= max_retries THEN 'failed'
          ELSE status -- Keep current status for retry
        END,
        next_execution_at = CASE
          WHEN retry_count + 1 < max_retries THEN now() + INTERVAL '5 minutes' -- Retry in 5 minutes
          ELSE NULL
        END
    WHERE id = task_uuid;
    
    RAISE NOTICE 'Task execution failed: % - %', task_uuid, error_message;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

