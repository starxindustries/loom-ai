import { createClient } from './supabase/client';
import { createActionExecutorService, ActionExecutorService } from './action-executor';
import { ActionExecutionContext } from '../types/reminder';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Real Action Executor Service
 * 
 * This service implements actual action execution using external APIs
 * It extends the base ActionExecutorService with real implementations
 */
export class RealActionExecutorService extends ActionExecutorService {
  constructor(supabaseClient?: SupabaseClient) {
    super(supabaseClient);
  }

  /**
   * Execute Gmail send email action using Gmail API
   */
  async executeGmailSendEmail(context: ActionExecutionContext): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const config = context.action_config;
      const integration = context.integration;

      // Validate required fields
      if (!config.to || !config.subject) {
        return {
          success: false,
          error: 'Missing required fields: to, subject'
        };
      }

      // Create email message in RFC 2822 format
      const emailLines = [
        `To: ${config.to}`,
        config.cc ? `Cc: ${config.cc}` : '',
        config.bcc ? `Bcc: ${config.bcc}` : '',
        `Subject: ${config.subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'MIME-Version: 1.0',
        '',
        config.body || ''
      ].filter(line => line !== '');

      const email = emailLines.join('\r\n');
      const encodedEmail = Buffer.from(email).toString('base64url');

      // Call Gmail API
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.encrypted_access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: encodedEmail
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Handle OAuth token refresh if needed
        if (response.status === 401 && responseData.error?.message?.includes('invalid_grant')) {
          return {
            success: false,
            error: 'Gmail access token expired. Please reconnect your Gmail account in Settings → Integrations.'
          };
        }

        return {
          success: false,
          error: `Gmail API error: ${responseData.error?.message || response.statusText}`
        };
      }

      return {
        success: true,
        result: {
          messageId: responseData.id,
          threadId: responseData.threadId,
          to: config.to,
          subject: config.subject,
          provider: 'gmail'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Gmail API error'
      };
    }
  }

  /**
   * Execute webhook action with real HTTP request
   */
  async executeWebhookAction(context: ActionExecutionContext): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const config = context.action_config;

      if (!config.url) {
        return {
          success: false,
          error: 'Missing required field: url'
        };
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Loom-AI-Reminder-System/1.0'
      };

      // Add custom headers
      if (config.headers) {
        try {
          const customHeaders = typeof config.headers === 'string' 
            ? JSON.parse(config.headers) 
            : config.headers;
          Object.assign(headers, customHeaders);
        } catch {
          // Invalid JSON headers, ignore
        }
      }

      // Add auth header if provided
      if (config.auth_header) {
        headers['Authorization'] = config.auth_header;
      }

      const method = (config.method || 'POST').toUpperCase();
      let body: string | undefined;

      if (method !== 'GET' && config.body) {
        try {
          // Ensure body is valid JSON
          const bodyObj = typeof config.body === 'string' 
            ? JSON.parse(config.body) 
            : config.body;
          body = JSON.stringify(bodyObj);
        } catch {
          // If not valid JSON, send as string
          body = String(config.body);
        }
      }

      const response = await fetch(config.url, {
        method,
        headers,
        body,
        timeout: 30000 // 30 second timeout
      });

      let responseData;
      const responseText = await response.text();
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      return {
        success: response.ok,
        result: {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
          url: config.url,
          method
        },
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown webhook error'
      };
    }
  }

  /**
   * Execute Slack message action
   */
  async executeSlackMessage(context: ActionExecutionContext): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const config = context.action_config;
      const integration = context.integration;

      if (!config.channel || !config.text) {
        return {
          success: false,
          error: 'Missing required fields: channel, text'
        };
      }

      const payload = {
        channel: config.channel,
        text: config.text,
        username: config.username || 'Loom AI',
        icon_emoji: config.icon_emoji || ':robot_face:'
      };

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.encrypted_access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();

      if (!responseData.ok) {
        return {
          success: false,
          error: `Slack API error: ${responseData.error || 'Unknown error'}`
        };
      }

      return {
        success: true,
        result: {
          messageId: responseData.ts,
          channel: responseData.channel,
          text: config.text,
          provider: 'slack'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Slack API error'
      };
    }
  }

  /**
   * Override the base executeAction method to use real implementations
   */
  async executeAction(context: ActionExecutionContext): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    // Use real implementations for specific actions
    if (context.executor.provider_slug === 'gmail' && context.executor.action_type === 'send_email') {
      return this.executeGmailSendEmail(context);
    }

    if (context.executor.provider_slug === 'slack' && context.executor.action_type === 'post_message') {
      return this.executeSlackMessage(context);
    }

    if (context.executor.provider_slug === 'webhook') {
      return this.executeWebhookAction(context);
    }

    // Fall back to the base implementation for other actions
    return super.executeAction(context);
  }
}

// Export singleton instance for client-side usage
export const realActionExecutorService = new RealActionExecutorService();

// Factory function for server-side usage with authenticated client
export function createRealActionExecutorService(supabaseClient: SupabaseClient): RealActionExecutorService {
  return new RealActionExecutorService(supabaseClient);
}
