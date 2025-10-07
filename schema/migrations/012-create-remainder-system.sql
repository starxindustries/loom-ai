-- Migration: Add Reminder and Task Automation System
-- Description: Adds support for scheduled reminders, automated tasks, and third-party integrations

-- ============================================================================
-- Third-Party Integration Providers
-- ============================================================================
CREATE TABLE public.integration_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  auth_type VARCHAR(50) NOT NULL, -- 'oauth2', 'api_key', 'basic_auth'
  oauth_authorize_url TEXT,
  oauth_token_url TEXT,
  oauth_scopes TEXT[], -- Required OAuth scopes
  requires_api_key BOOLEAN DEFAULT false,
  logo_url TEXT,
  documentation_url TEXT,
  is_active BOOLEAN DEFAULT true,
  supported_actions TEXT[], -- e.g., ['send_email', 'create_row', 'send_message']
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- User's Connected Third-Party Integrations
-- ============================================================================
CREATE TABLE public.user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.integration_providers(id) ON DELETE CASCADE,
  connection_name VARCHAR(255), -- User-friendly name for this connection
  
  -- Encrypted credentials
  encrypted_access_token TEXT, -- For OAuth
  encrypted_refresh_token TEXT,
  encrypted_api_key TEXT, -- For API key auth
  token_expires_at TIMESTAMPTZ,
  
  -- Encryption metadata (similar to your encrypted_memories pattern)
  wrapped_dek TEXT NOT NULL,
  dek_salt TEXT NOT NULL,
  dek_iv TEXT NOT NULL,
  data_iv TEXT NOT NULL,
  kdf_algorithm TEXT NOT NULL DEFAULT 'pbkdf2',
  kdf_iterations INTEGER NOT NULL DEFAULT 100000,
  encryption_algorithm TEXT NOT NULL DEFAULT 'aes-256-gcm',
  
  -- Connection metadata
  scopes_granted TEXT[],
  additional_config JSONB DEFAULT '{}', -- Provider-specific config
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, provider_id, connection_name)
);

-- ============================================================================
-- Scheduled Tasks/Reminders
-- ============================================================================
CREATE TABLE public.scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Task details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  task_type VARCHAR(50) NOT NULL, -- 'reminder', 'action', 'recurring'
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(100) DEFAULT 'UTC',
  recurrence_rule TEXT, -- RRULE format for recurring tasks
  recurrence_end_date TIMESTAMPTZ,
  
  -- Action configuration
  action_type VARCHAR(100), -- 'notification', 'email', 'webhook', 'integration_action'
  integration_id UUID REFERENCES public.user_integrations(id) ON DELETE SET NULL,
  action_config JSONB DEFAULT '{}', -- Configuration for the specific action
  
  -- Encrypted sensitive data (e.g., message content, email body)
  encrypted_payload TEXT,
  wrapped_dek TEXT,
  dek_salt TEXT,
  dek_iv TEXT,
  data_iv TEXT,
  kdf_algorithm TEXT DEFAULT 'pbkdf2',
  kdf_iterations INTEGER DEFAULT 100000,
  encryption_algorithm TEXT DEFAULT 'aes-256-gcm',
  
  -- Execution tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'active', 'completed', 'failed', 'cancelled', 'paused'
  last_executed_at TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ,
  execution_count INTEGER DEFAULT 0,
  max_executions INTEGER, -- NULL for unlimited
  
  -- pg_cron integration
  cron_job_id BIGINT, -- References pg_cron.job.jobid
  cron_schedule TEXT, -- Cron expression
  
  -- Metadata
  priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  
  -- Error handling
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_error TEXT,
  failed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure next_execution_at is indexed for efficient querying
  CHECK (task_type IN ('reminder', 'action', 'recurring')),
  CHECK (status IN ('pending', 'active', 'completed', 'failed', 'cancelled', 'paused')),
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

-- ============================================================================
-- Task Execution History
-- ============================================================================
CREATE TABLE public.task_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.scheduled_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Execution details
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'skipped', 'partial'
  
  -- Results
  result_data JSONB DEFAULT '{}',
  error_message TEXT,
  error_code VARCHAR(100),
  
  -- Performance metrics
  execution_duration_ms INTEGER,
  
  -- Integration response (if applicable)
  integration_response JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Reminder Templates (optional, for common reminder patterns)
-- ============================================================================
CREATE TABLE public.reminder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for system templates
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- 'birthday', 'meeting', 'task', 'bill', 'medication', etc.
  
  -- Template content
  title_template TEXT NOT NULL,
  description_template TEXT,
  
  -- Default settings
  default_action_type VARCHAR(100),
  default_action_config JSONB DEFAULT '{}',
  default_reminder_offset INTERVAL, -- e.g., '1 day' before event
  
  is_system_template BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- User integrations
CREATE INDEX idx_user_integrations_user_id ON public.user_integrations(user_id);
CREATE INDEX idx_user_integrations_provider_id ON public.user_integrations(provider_id);
CREATE INDEX idx_user_integrations_active ON public.user_integrations(user_id, is_active);

-- Scheduled tasks
CREATE INDEX idx_scheduled_tasks_user_id ON public.scheduled_tasks(user_id);
CREATE INDEX idx_scheduled_tasks_next_execution ON public.scheduled_tasks(next_execution_at) 
  WHERE status IN ('pending', 'active');
CREATE INDEX idx_scheduled_tasks_status ON public.scheduled_tasks(status);
CREATE INDEX idx_scheduled_tasks_user_status ON public.scheduled_tasks(user_id, status);
CREATE INDEX idx_scheduled_tasks_integration ON public.scheduled_tasks(integration_id) 
  WHERE integration_id IS NOT NULL;
CREATE INDEX idx_scheduled_tasks_tags ON public.scheduled_tasks USING GIN(tags);
CREATE INDEX idx_scheduled_tasks_scheduled_at ON public.scheduled_tasks(scheduled_at);

-- Task execution logs
CREATE INDEX idx_task_execution_logs_task_id ON public.task_execution_logs(task_id);
CREATE INDEX idx_task_execution_logs_user_id ON public.task_execution_logs(user_id);
CREATE INDEX idx_task_execution_logs_executed_at ON public.task_execution_logs(executed_at DESC);
CREATE INDEX idx_task_execution_logs_status ON public.task_execution_logs(status);

-- Reminder templates
CREATE INDEX idx_reminder_templates_user_id ON public.reminder_templates(user_id);
CREATE INDEX idx_reminder_templates_category ON public.reminder_templates(category);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_templates ENABLE ROW LEVEL SECURITY;

-- Integration Providers: Public read access
CREATE POLICY "Integration providers are viewable by authenticated users"
  ON public.integration_providers
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- User Integrations: Users can only access their own integrations
CREATE POLICY "Users can view their own integrations"
  ON public.user_integrations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own integrations"
  ON public.user_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations"
  ON public.user_integrations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integrations"
  ON public.user_integrations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Scheduled Tasks: Users can only access their own tasks
CREATE POLICY "Users can view their own tasks"
  ON public.scheduled_tasks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tasks"
  ON public.scheduled_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.scheduled_tasks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
  ON public.scheduled_tasks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Task Execution Logs: Users can view their own logs
CREATE POLICY "Users can view their own execution logs"
  ON public.task_execution_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert execution logs"
  ON public.task_execution_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Reminder Templates: Users can view system templates and their own
CREATE POLICY "Users can view system and own templates"
  ON public.reminder_templates
  FOR SELECT
  TO authenticated
  USING (is_system_template = true OR auth.uid() = user_id);

CREATE POLICY "Users can create their own templates"
  ON public.reminder_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_system_template = false);

CREATE POLICY "Users can update their own templates"
  ON public.reminder_templates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_system_template = false)
  WITH CHECK (auth.uid() = user_id AND is_system_template = false);

CREATE POLICY "Users can delete their own templates"
  ON public.reminder_templates
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_system_template = false);

-- ============================================================================
-- Triggers for Updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_integration_providers_updated_at
  BEFORE UPDATE ON public.integration_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_integrations_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduled_tasks_updated_at
  BEFORE UPDATE ON public.scheduled_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reminder_templates_updated_at
  BEFORE UPDATE ON public.reminder_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Insert Default Integration Providers
-- ============================================================================

INSERT INTO public.integration_providers (name, slug, description, auth_type, oauth_authorize_url, oauth_token_url, supported_actions, oauth_scopes) VALUES
  ('Gmail', 'gmail', 'Send emails and manage Gmail account', 'oauth2', 
   'https://accounts.google.com/oauth2/auth',
   'https://oauth2.googleapis.com/token',
   ARRAY['send_email', 'read_email'], 
   ARRAY['https://www.googleapis.com/auth/gmail.send']),
  
  ('Google Calendar', 'google_calendar', 'Create and manage calendar events', 'oauth2', 
   'https://accounts.google.com/oauth2/auth',
   'https://oauth2.googleapis.com/token',
   ARRAY['create_event', 'update_event', 'delete_event'], 
   ARRAY['https://www.googleapis.com/auth/calendar']),
  
  ('Airtable', 'airtable', 'Create and manage Airtable records', 'api_key', 
   NULL,
   NULL,
   ARRAY['create_record', 'update_record', 'delete_record'], 
   NULL),
  
  ('Notion', 'notion', 'Create and manage Notion pages', 'oauth2', 
   'https://api.notion.com/v1/oauth/authorize',
   'https://api.notion.com/v1/oauth/token',
   ARRAY['create_page', 'update_page'], 
   ARRAY['pages:write']),
  
  ('Slack', 'slack', 'Send messages to Slack channels', 'oauth2', 
   'https://slack.com/oauth/v2/authorize',
   'https://slack.com/api/oauth.v2.access',
   ARRAY['send_message'], 
   ARRAY['chat:write']),
  
  ('Webhook', 'webhook', 'Send HTTP requests to custom URLs', 'api_key', 
   NULL,
   NULL,
   ARRAY['post_request', 'get_request'], 
   NULL);

-- ============================================================================
-- Insert Default Reminder Templates
-- ============================================================================

INSERT INTO public.reminder_templates (name, description, category, title_template, description_template, is_system_template, default_reminder_offset) VALUES
  ('Birthday Reminder', 'Remind about upcoming birthdays', 'birthday', 
   '🎂 {name}''s Birthday', 
   'Don''t forget! It''s {name}''s birthday on {date}', 
   true, INTERVAL '1 day'),
  
  ('Meeting Reminder', 'Remind about scheduled meetings', 'meeting', 
   '📅 Meeting: {title}', 
   'You have a meeting "{title}" at {time}', 
   true, INTERVAL '15 minutes'),
  
  ('Bill Payment', 'Remind about bill payments', 'bill', 
   '💳 Pay {bill_name}', 
   '{bill_name} is due on {date}. Amount: {amount}', 
   true, INTERVAL '3 days'),
  
  ('Medication Reminder', 'Remind to take medication', 'medication', 
   '💊 Take {medication_name}', 
   'Time to take {medication_name} - {dosage}', 
   true, NULL),
  
  ('Task Deadline', 'Remind about task deadlines', 'task', 
   '✅ Task Due: {task_name}', 
   'Task "{task_name}" is due on {date}', 
   true, INTERVAL '1 day');

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE public.integration_providers IS 'Available third-party integration providers (Gmail, Airtable, etc.)';
COMMENT ON TABLE public.user_integrations IS 'User''s connected third-party integrations with encrypted credentials';
COMMENT ON TABLE public.scheduled_tasks IS 'Scheduled reminders and automated tasks';
COMMENT ON TABLE public.task_execution_logs IS 'History of task executions and their results';
COMMENT ON TABLE public.reminder_templates IS 'Pre-defined templates for common reminder types';

COMMENT ON COLUMN public.scheduled_tasks.recurrence_rule IS 'RRULE format for recurring tasks (e.g., FREQ=DAILY;INTERVAL=1)';
COMMENT ON COLUMN public.scheduled_tasks.cron_job_id IS 'Reference to pg_cron job ID for scheduled execution';
COMMENT ON COLUMN public.scheduled_tasks.action_config IS 'JSON configuration for the specific action (e.g., email addresses, webhook URLs)';
COMMENT ON COLUMN public.user_integrations.additional_config IS 'Provider-specific configuration (e.g., Airtable base ID, Gmail label preferences)';

-- ============================================================================
-- Function to Create pg_cron Job for Task
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_cron_job_for_task(task_uuid UUID)
RETURNS BIGINT AS $$
DECLARE
  task_record RECORD;
  job_id BIGINT;
  cron_expr TEXT;
BEGIN
  -- Get task details
  SELECT * INTO task_record FROM public.scheduled_tasks WHERE id = task_uuid;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found: %', task_uuid;
  END IF;
  
  -- Generate cron expression or use existing
  IF task_record.cron_schedule IS NOT NULL THEN
    cron_expr := task_record.cron_schedule;
  ELSE
    -- For one-time tasks, create a cron that runs once
    cron_expr := format(
      '%s %s %s %s *',
      EXTRACT(MINUTE FROM task_record.scheduled_at),
      EXTRACT(HOUR FROM task_record.scheduled_at),
      EXTRACT(DAY FROM task_record.scheduled_at),
      EXTRACT(MONTH FROM task_record.scheduled_at)
    );
  END IF;
  
  -- Create the cron job (Note: This requires pg_cron to be properly set up)
  -- The actual execution logic would be in a separate function
  SELECT cron.schedule(
    format('task_%s', task_uuid),
    cron_expr,
    format('SELECT public.execute_scheduled_task(%L)', task_uuid)
  ) INTO job_id;
  
  -- Update the task with the cron job ID
  UPDATE public.scheduled_tasks 
  SET cron_job_id = job_id,
      status = 'active'
  WHERE id = task_uuid;
  
  RETURN job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function to Execute Scheduled Task (Stub - implement your logic)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.execute_scheduled_task(task_uuid UUID)
RETURNS void AS $$
DECLARE
  task_record RECORD;
  execution_log_id UUID;
BEGIN
  -- Get task details
  SELECT * INTO task_record FROM public.scheduled_tasks WHERE id = task_uuid;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Task not found: %', task_uuid;
    RETURN;
  END IF;
  
  -- Create execution log entry
  INSERT INTO public.task_execution_logs (task_id, user_id, status)
  VALUES (task_uuid, task_record.user_id, 'success')
  RETURNING id INTO execution_log_id;
  
  -- Update task execution metadata
  UPDATE public.scheduled_tasks
  SET last_executed_at = now(),
      execution_count = execution_count + 1,
      next_execution_at = CASE 
        WHEN recurrence_rule IS NOT NULL THEN 
          -- Calculate next execution based on recurrence rule
          -- This is simplified - you'd need proper RRULE parsing
          scheduled_at + INTERVAL '1 day'
        ELSE NULL
      END,
      status = CASE
        WHEN recurrence_rule IS NULL THEN 'completed'
        ELSE 'active'
      END
  WHERE id = task_uuid;
  
  -- TODO: Implement actual task execution logic here
  -- This could involve:
  -- 1. Decrypting the payload
  -- 2. Fetching integration credentials
  -- 3. Calling the appropriate API
  -- 4. Sending notifications
  -- 5. Updating execution logs with results
  
  RAISE NOTICE 'Task executed: % (Log ID: %)', task_uuid, execution_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Helper Function to Clean Up Completed One-Time Tasks
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_completed_tasks()
RETURNS void AS $$
BEGIN
  -- Remove cron jobs for completed one-time tasks
  UPDATE public.scheduled_tasks
  SET status = 'completed'
  WHERE status = 'active'
    AND recurrence_rule IS NULL
    AND next_execution_at IS NULL
    AND last_executed_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Grant Necessary Permissions
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT ON public.integration_providers TO authenticated;
GRANT ALL ON public.user_integrations TO authenticated;
GRANT ALL ON public.scheduled_tasks TO authenticated;
GRANT SELECT, INSERT ON public.task_execution_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_templates TO authenticated;

-- Grant sequence access
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;