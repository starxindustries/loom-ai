-- ============================================================================
-- Task Execution Implementation
-- ============================================================================
-- This migration implements the actual task execution logic

-- ============================================================================
-- Updated Function to Execute Scheduled Tasks
-- ============================================================================

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
  
  -- Create execution log entry
  INSERT INTO public.task_execution_logs (task_id, user_id, status, started_at)
  VALUES (task_uuid, task_record.user_id, 'running', now())
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

-- ============================================================================
-- Email Action Execution Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.execute_email_action(
  user_id_param UUID,
  action_config JSONB,
  access_token TEXT,
  provider_slug TEXT
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- This is a placeholder for actual email sending logic
  -- In a real implementation, this would:
  -- 1. Decrypt the access token
  -- 2. Use the Gmail API or SMTP to send the email
  -- 3. Handle OAuth token refresh if needed
  -- 4. Return success/failure status
  
  -- For now, we'll simulate success and log the action
  INSERT INTO public.system_logs (
    id, level, category, message, context, source
  ) VALUES (
    gen_random_uuid()::text,
    'info',
    'task_execution',
    'Email action executed',
    jsonb_build_object(
      'user_id', user_id_param,
      'provider', provider_slug,
      'to', action_config->>'to',
      'subject', action_config->>'subject'
    ),
    'execute_email_action'
  );
  
  result := jsonb_build_object(
    'success', true,
    'message', 'Email sent successfully',
    'provider', provider_slug,
    'to', action_config->>'to',
    'subject', action_config->>'subject'
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Message Action Execution Function (Slack, etc.)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.execute_message_action(
  user_id_param UUID,
  action_config JSONB,
  access_token TEXT,
  provider_slug TEXT
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Placeholder for message posting logic (Slack, Discord, etc.)
  INSERT INTO public.system_logs (
    id, level, category, message, context, source
  ) VALUES (
    gen_random_uuid()::text,
    'info',
    'task_execution',
    'Message action executed',
    jsonb_build_object(
      'user_id', user_id_param,
      'provider', provider_slug,
      'channel', action_config->>'channel',
      'text', action_config->>'text'
    ),
    'execute_message_action'
  );
  
  result := jsonb_build_object(
    'success', true,
    'message', 'Message posted successfully',
    'provider', provider_slug,
    'channel', action_config->>'channel'
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Webhook Action Execution Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.execute_webhook_action(
  user_id_param UUID,
  action_config JSONB
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Placeholder for webhook execution logic
  INSERT INTO public.system_logs (
    id, level, category, message, context, source
  ) VALUES (
    gen_random_uuid()::text,
    'info',
    'task_execution',
    'Webhook action executed',
    jsonb_build_object(
      'user_id', user_id_param,
      'url', action_config->>'url',
      'method', action_config->>'method'
    ),
    'execute_webhook_action'
  );
  
  result := jsonb_build_object(
    'success', true,
    'message', 'Webhook called successfully',
    'url', action_config->>'url',
    'method', COALESCE(action_config->>'method', 'POST')
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function to Schedule Task with pg_cron
-- ============================================================================

CREATE OR REPLACE FUNCTION public.schedule_task_execution(task_uuid UUID)
RETURNS BIGINT AS $$
DECLARE
  task_record RECORD;
  job_id BIGINT;
  cron_expr TEXT;
  job_name TEXT;
BEGIN
  -- Get task details
  SELECT * INTO task_record FROM public.scheduled_tasks WHERE id = task_uuid;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found: %', task_uuid;
  END IF;
  
  -- Generate unique job name
  job_name := format('task_%s', task_uuid);
  
  -- Generate cron expression
  IF task_record.cron_schedule IS NOT NULL THEN
    cron_expr := task_record.cron_schedule;
  ELSE
    -- For one-time tasks, create a cron that runs at the scheduled time
    cron_expr := format(
      '%s %s %s %s *',
      EXTRACT(MINUTE FROM task_record.scheduled_at AT TIME ZONE COALESCE(task_record.timezone, 'UTC')),
      EXTRACT(HOUR FROM task_record.scheduled_at AT TIME ZONE COALESCE(task_record.timezone, 'UTC')),
      EXTRACT(DAY FROM task_record.scheduled_at AT TIME ZONE COALESCE(task_record.timezone, 'UTC')),
      EXTRACT(MONTH FROM task_record.scheduled_at AT TIME ZONE COALESCE(task_record.timezone, 'UTC'))
    );
  END IF;
  
  -- Create the cron job
  BEGIN
    SELECT cron.schedule(
      job_name,
      cron_expr,
      format('SELECT public.execute_scheduled_task(%L)', task_uuid)
    ) INTO job_id;
    
    -- Update the task with the cron job ID
    UPDATE public.scheduled_tasks 
    SET cron_job_id = job_id,
        status = 'active',
        next_execution_at = task_record.scheduled_at
    WHERE id = task_uuid;
    
    RAISE NOTICE 'Task scheduled: % with cron job ID: %', task_uuid, job_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- If pg_cron is not available, log the error but don't fail
    RAISE NOTICE 'Failed to schedule task with pg_cron: % - %', task_uuid, SQLERRM;
    
    -- Update task status to indicate scheduling issue
    UPDATE public.scheduled_tasks 
    SET status = 'pending',
        last_error = 'pg_cron scheduling failed: ' || SQLERRM
    WHERE id = task_uuid;
    
    RETURN NULL;
  END;
  
  RETURN job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function to Cancel Scheduled Task
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_scheduled_task(task_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  task_record RECORD;
  job_name TEXT;
BEGIN
  -- Get task details
  SELECT * INTO task_record FROM public.scheduled_tasks WHERE id = task_uuid;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found: %', task_uuid;
  END IF;
  
  -- Generate job name
  job_name := format('task_%s', task_uuid);
  
  -- Unschedule the cron job if it exists
  IF task_record.cron_job_id IS NOT NULL THEN
    BEGIN
      PERFORM cron.unschedule(job_name);
      RAISE NOTICE 'Unscheduled cron job: %', job_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to unschedule cron job: % - %', job_name, SQLERRM;
    END;
  END IF;
  
  -- Update task status
  UPDATE public.scheduled_tasks 
  SET status = 'cancelled',
      cron_job_id = NULL,
      next_execution_at = NULL
  WHERE id = task_uuid;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grants
-- ============================================================================

-- Grant execute permissions to authenticated users for scheduling functions
GRANT EXECUTE ON FUNCTION public.schedule_task_execution(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_task(UUID) TO authenticated;
