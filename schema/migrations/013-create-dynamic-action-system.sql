-- ============================================================================
-- Dynamic Action Configuration System
-- ============================================================================
-- This migration creates a flexible system for defining action configurations
-- that can be modified without code changes, similar to Zapier/Power Automate

-- Action Field Definitions
-- Stores the schema for each action's configuration fields
CREATE TABLE public.action_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_slug VARCHAR(50) NOT NULL, -- e.g., 'gmail', 'slack', 'webhook'
  action_type VARCHAR(100) NOT NULL,  -- e.g., 'send_email', 'post_message'
  field_key VARCHAR(100) NOT NULL,    -- e.g., 'to', 'subject', 'body'
  field_label VARCHAR(255) NOT NULL,  -- Human-readable label
  field_type VARCHAR(50) NOT NULL,    -- 'text', 'email', 'textarea', 'select', 'multiselect', 'number', 'boolean', 'url', 'json'
  field_description TEXT,             -- Help text for the field
  is_required BOOLEAN DEFAULT false,
  default_value TEXT,                 -- JSON string for default value
  validation_rules JSONB DEFAULT '{}', -- JSON validation rules
  field_options JSONB DEFAULT '[]',   -- For select/multiselect fields
  field_order INTEGER DEFAULT 0,     -- Display order
  is_sensitive BOOLEAN DEFAULT false, -- Should be encrypted
  placeholder TEXT,                   -- Input placeholder
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure unique field per action
  UNIQUE(provider_slug, action_type, field_key),
  
  -- Validate field types
  CHECK (field_type IN ('text', 'email', 'textarea', 'select', 'multiselect', 'number', 'boolean', 'url', 'json', 'password'))
);

-- Action Executors
-- Defines how each action should be executed
CREATE TABLE public.action_executors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_slug VARCHAR(50) NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  executor_type VARCHAR(50) NOT NULL, -- 'http_request', 'email_smtp', 'webhook', 'api_call', 'custom'
  executor_config JSONB NOT NULL DEFAULT '{}', -- Configuration for the executor
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure unique executor per action
  UNIQUE(provider_slug, action_type),
  
  -- Validate executor types
  CHECK (executor_type IN ('http_request', 'email_smtp', 'webhook', 'api_call', 'custom'))
);

-- Indexes for performance
CREATE INDEX idx_action_field_definitions_provider_action ON public.action_field_definitions(provider_slug, action_type);
CREATE INDEX idx_action_field_definitions_order ON public.action_field_definitions(provider_slug, action_type, field_order);
CREATE INDEX idx_action_executors_provider_action ON public.action_executors(provider_slug, action_type);

-- RLS Policies
ALTER TABLE public.action_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_executors ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read field definitions and executors
CREATE POLICY "Action field definitions are viewable by authenticated users" 
  ON public.action_field_definitions FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Action executors are viewable by authenticated users" 
  ON public.action_executors FOR SELECT 
  TO authenticated 
  USING (true);

-- Only service role can modify these tables
CREATE POLICY "Only service role can modify action field definitions" 
  ON public.action_field_definitions FOR ALL 
  TO service_role 
  USING (true);

CREATE POLICY "Only service role can modify action executors" 
  ON public.action_executors FOR ALL 
  TO service_role 
  USING (true);

-- ============================================================================
-- Seed Data - Gmail Actions
-- ============================================================================

-- Gmail Send Email Action Fields
INSERT INTO public.action_field_definitions (provider_slug, action_type, field_key, field_label, field_type, field_description, is_required, placeholder, field_order, is_sensitive) VALUES
('gmail', 'send_email', 'to', 'To', 'email', 'Recipient email address(es). Separate multiple emails with commas.', true, 'recipient@example.com', 1, false),
('gmail', 'send_email', 'cc', 'CC', 'email', 'Carbon copy recipients (optional)', false, 'cc@example.com', 2, false),
('gmail', 'send_email', 'bcc', 'BCC', 'email', 'Blind carbon copy recipients (optional)', false, 'bcc@example.com', 3, false),
('gmail', 'send_email', 'subject', 'Subject', 'text', 'Email subject line', true, 'Enter email subject', 4, false),
('gmail', 'send_email', 'body', 'Message Body', 'textarea', 'Email content (supports HTML)', true, 'Enter your message here...', 5, false),
('gmail', 'send_email', 'html', 'HTML Format', 'boolean', 'Send as HTML email', false, null, 6, false);

-- Gmail Send Email Executor
INSERT INTO public.action_executors (provider_slug, action_type, executor_type, executor_config) VALUES
('gmail', 'send_email', 'api_call', '{
  "method": "POST",
  "endpoint": "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
  "headers": {
    "Authorization": "Bearer {{access_token}}",
    "Content-Type": "application/json"
  },
  "body_template": {
    "raw": "{{base64_encoded_email}}"
  },
  "response_success_codes": [200],
  "field_mappings": {
    "to": "raw.to",
    "cc": "raw.cc", 
    "bcc": "raw.bcc",
    "subject": "raw.subject",
    "body": "raw.body",
    "html": "raw.html"
  }
}');

-- ============================================================================
-- Seed Data - Webhook Actions
-- ============================================================================

-- Webhook Action Fields
INSERT INTO public.action_field_definitions (provider_slug, action_type, field_key, field_label, field_type, field_description, is_required, placeholder, field_order, is_sensitive) VALUES
('webhook', 'post_request', 'url', 'Webhook URL', 'url', 'The endpoint URL to send the request to', true, 'https://api.example.com/webhook', 1, false),
('webhook', 'post_request', 'method', 'HTTP Method', 'select', 'HTTP method for the request', true, null, 2, false),
('webhook', 'post_request', 'headers', 'Headers', 'json', 'HTTP headers as JSON object (optional)', false, '{"Content-Type": "application/json"}', 3, false),
('webhook', 'post_request', 'body', 'Request Body', 'textarea', 'Request payload (JSON format)', false, '{"message": "Hello from reminder!"}', 4, false),
('webhook', 'post_request', 'auth_header', 'Authorization Header', 'password', 'Authorization header value (optional)', false, 'Bearer your-token-here', 5, true);

-- Webhook method options
UPDATE public.action_field_definitions 
SET field_options = '["GET", "POST", "PUT", "PATCH", "DELETE"]'
WHERE provider_slug = 'webhook' AND action_type = 'post_request' AND field_key = 'method';

-- Webhook Executor
INSERT INTO public.action_executors (provider_slug, action_type, executor_type, executor_config) VALUES
('webhook', 'post_request', 'http_request', '{
  "method": "{{method}}",
  "url": "{{url}}",
  "headers": "{{headers}}",
  "body": "{{body}}",
  "auth_header": "{{auth_header}}",
  "timeout": 30000,
  "retry_attempts": 3,
  "response_success_codes": [200, 201, 202, 204]
}');

-- ============================================================================
-- Seed Data - Slack Actions
-- ============================================================================

-- Slack Post Message Action Fields
INSERT INTO public.action_field_definitions (provider_slug, action_type, field_key, field_label, field_type, field_description, is_required, placeholder, field_order, is_sensitive) VALUES
('slack', 'post_message', 'channel', 'Channel', 'text', 'Slack channel name or ID (e.g., #general or C1234567890)', true, '#general', 1, false),
('slack', 'post_message', 'text', 'Message Text', 'textarea', 'The message content to post', true, 'Hello from your reminder!', 2, false),
('slack', 'post_message', 'username', 'Bot Username', 'text', 'Custom username for the bot (optional)', false, 'Reminder Bot', 3, false),
('slack', 'post_message', 'icon_emoji', 'Icon Emoji', 'text', 'Emoji to use as bot icon (optional)', false, ':robot_face:', 4, false);

-- Slack Post Message Executor
INSERT INTO public.action_executors (provider_slug, action_type, executor_type, executor_config) VALUES
('slack', 'post_message', 'api_call', '{
  "method": "POST",
  "endpoint": "https://slack.com/api/chat.postMessage",
  "headers": {
    "Authorization": "Bearer {{access_token}}",
    "Content-Type": "application/json"
  },
  "body_template": {
    "channel": "{{channel}}",
    "text": "{{text}}",
    "username": "{{username}}",
    "icon_emoji": "{{icon_emoji}}"
  },
  "response_success_codes": [200],
  "success_field": "ok",
  "success_value": true
}');

-- ============================================================================
-- Update Triggers
-- ============================================================================

-- Add update triggers for timestamps
CREATE TRIGGER update_action_field_definitions_updated_at 
  BEFORE UPDATE ON public.action_field_definitions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_action_executors_updated_at 
  BEFORE UPDATE ON public.action_executors 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Grants
-- ============================================================================

-- Grant permissions
GRANT SELECT ON public.action_field_definitions TO authenticated;
GRANT SELECT ON public.action_executors TO authenticated;
GRANT ALL ON public.action_field_definitions TO service_role;
GRANT ALL ON public.action_executors TO service_role;
