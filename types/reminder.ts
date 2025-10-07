export interface IntegrationProvider {
  id: string;
  name: string;
  slug: string;
  description?: string;
  auth_type: 'oauth2' | 'api_key' | 'basic_auth';
  oauth_authorize_url?: string;
  oauth_token_url?: string;
  oauth_scopes?: string[];
  requires_api_key: boolean;
  logo_url?: string;
  documentation_url?: string;
  is_active: boolean;
  supported_actions: string[];
  created_at: string;
  updated_at: string;
}

export interface UserIntegration {
  id: string;
  user_id: string;
  provider_id: string;
  connection_name?: string;
  encrypted_access_token?: string;
  encrypted_refresh_token?: string;
  encrypted_api_key?: string;
  token_expires_at?: string;
  wrapped_dek: string;
  dek_salt: string;
  dek_iv: string;
  data_iv: string;
  kdf_algorithm: string;
  kdf_iterations: number;
  encryption_algorithm: string;
  scopes_granted?: string[];
  additional_config: Record<string, any>;
  is_active: boolean;
  last_used_at?: string;
  last_sync_at?: string;
  error_count: number;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduledTask {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  task_type: 'reminder' | 'action' | 'recurring';
  scheduled_at: string;
  timezone: string;
  recurrence_rule?: string; // RRULE format
  recurrence_end_date?: string;
  action_type?: string;
  integration_id?: string;
  action_config: Record<string, any>;
  encrypted_payload?: string;
  wrapped_dek?: string;
  dek_salt?: string;
  dek_iv?: string;
  data_iv?: string;
  kdf_algorithm?: string;
  kdf_iterations?: number;
  encryption_algorithm?: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled' | 'paused';
  last_executed_at?: string;
  next_execution_at?: string;
  execution_count: number;
  max_executions?: number;
  cron_job_id?: number;
  cron_schedule?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  metadata: Record<string, any>;
  retry_count: number;
  max_retries: number;
  last_error?: string;
  failed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskExecutionLog {
  id: string;
  task_id: string;
  user_id: string;
  executed_at: string;
  status: 'success' | 'failed' | 'skipped' | 'partial';
  result_data: Record<string, any>;
  error_message?: string;
  error_code?: string;
  execution_duration_ms?: number;
  integration_response?: Record<string, any>;
  created_at: string;
}

export interface ReminderTemplate {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  category?: string;
  title_template: string;
  description_template?: string;
  default_action_type?: string;
  default_action_config: Record<string, any>;
  default_reminder_offset?: string; // interval
  is_system_template: boolean;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// Request/Response types
export interface CreateReminderRequest {
  title: string;
  description?: string;
  scheduled_at: string;
  timezone?: string;
  task_type: 'reminder' | 'action' | 'recurring';
  recurrence_rule?: string;
  recurrence_end_date?: string;
  action_type?: string;
  integration_slug?: string;
  action_config?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  encrypted_payload?: string;
}

export interface CreateTaskRequest extends CreateReminderRequest {
  integration_id?: string;
  max_executions?: number;
}

export interface IntegrationCheckResult {
  exists: boolean;
  provider: IntegrationProvider | null;
  integration: UserIntegration | null;
  missing_scopes?: string[];
  error?: string;
}

export interface ToastNotification {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  action?: {
    label: string;
    url: string;
  };
  duration?: number;
}

// Dynamic Action Configuration System
export interface ActionFieldDefinition {
  id: string;
  provider_slug: string;
  action_type: string;
  field_key: string;
  field_label: string;
  field_type: 'text' | 'email' | 'textarea' | 'select' | 'multiselect' | 'number' | 'boolean' | 'url' | 'json' | 'password';
  field_description?: string;
  is_required: boolean;
  default_value?: string;
  validation_rules: Record<string, any>;
  field_options: string[];
  field_order: number;
  is_sensitive: boolean;
  placeholder?: string;
  created_at: string;
  updated_at: string;
}

export interface ActionExecutor {
  id: string;
  provider_slug: string;
  action_type: string;
  executor_type: 'http_request' | 'email_smtp' | 'webhook' | 'api_call' | 'custom';
  executor_config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DynamicActionConfig {
  [field_key: string]: any;
}

export interface ActionExecutionContext {
  user_id: string;
  task_id: string;
  integration: UserIntegration;
  action_config: DynamicActionConfig;
  field_definitions: ActionFieldDefinition[];
  executor: ActionExecutor;
}

// Integration-specific action configs
export interface GmailActionConfig {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  body?: string;
  html?: boolean;
  attachments?: Array<{
    filename: string;
    content: string;
    encoding?: string;
  }>;
}

export interface GoogleCalendarActionConfig {
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  location?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

export interface AirtableActionConfig {
  base_id: string;
  table_name: string;
  fields: Record<string, any>;
}

export interface NotionActionConfig {
  database_id?: string;
  page_id?: string;
  properties: Record<string, any>;
  children?: any[];
}

export interface SlackActionConfig {
  channel: string;
  text: string;
  blocks?: any[];
  thread_ts?: string;
  username?: string;
  icon_emoji?: string;
  icon_url?: string;
}

export interface WebhookActionConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

// Template replacement context
export interface TemplateContext {
  name?: string;
  date?: string;
  time?: string;
  amount?: string;
  location?: string;
  description?: string;
  [key: string]: any;
}

