import { createClient } from './supabase/client';
import { 
  ActionExecutor, 
  ActionFieldDefinition, 
  ActionExecutionContext,
  DynamicActionConfig,
  UserIntegration 
} from '../types/reminder';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Dynamic Action Executor System
 * 
 * This system provides a plugin-like architecture for executing actions
 * based on database-driven configurations. Similar to Zapier/Power Automate.
 */
export class ActionExecutorService {
  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient();
  }

  /**
   * Get field definitions for a specific action
   */
  async getActionFieldDefinitions(
    providerSlug: string, 
    actionType: string
  ): Promise<ActionFieldDefinition[]> {
    const { data, error } = await this.supabase
      .from('action_field_definitions')
      .select('*')
      .eq('provider_slug', providerSlug)
      .eq('action_type', actionType)
      .order('field_order');

    if (error) {
      throw new Error(`Failed to fetch field definitions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get executor configuration for a specific action
   */
  async getActionExecutor(
    providerSlug: string, 
    actionType: string
  ): Promise<ActionExecutor | null> {
    const { data, error } = await this.supabase
      .from('action_executors')
      .select('*')
      .eq('provider_slug', providerSlug)
      .eq('action_type', actionType)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch executor: ${error.message}`);
    }

    return data;
  }

  /**
   * Validate action configuration against field definitions
   */
  async validateActionConfig(
    providerSlug: string,
    actionType: string,
    config: DynamicActionConfig
  ): Promise<{ valid: boolean; errors: string[] }> {
    const fieldDefinitions = await this.getActionFieldDefinitions(providerSlug, actionType);
    const errors: string[] = [];

    for (const field of fieldDefinitions) {
      const value = config[field.field_key];

      // Check required fields
      if (field.is_required && (value === undefined || value === null || value === '')) {
        errors.push(`${field.field_label} is required`);
        continue;
      }

      // Skip validation if field is not provided and not required
      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Type-specific validation
      switch (field.field_type) {
        case 'email':
          if (!this.isValidEmail(value)) {
            errors.push(`${field.field_label} must be a valid email address`);
          }
          break;
        case 'url':
          if (!this.isValidUrl(value)) {
            errors.push(`${field.field_label} must be a valid URL`);
          }
          break;
        case 'number':
          if (isNaN(Number(value))) {
            errors.push(`${field.field_label} must be a valid number`);
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`${field.field_label} must be true or false`);
          }
          break;
        case 'json':
          try {
            if (typeof value === 'string') {
              JSON.parse(value);
            }
          } catch {
            errors.push(`${field.field_label} must be valid JSON`);
          }
          break;
        case 'select':
          if (field.field_options.length > 0 && !field.field_options.includes(value)) {
            errors.push(`${field.field_label} must be one of: ${field.field_options.join(', ')}`);
          }
          break;
        case 'multiselect':
          if (Array.isArray(value)) {
            const invalidOptions = value.filter(v => !field.field_options.includes(v));
            if (invalidOptions.length > 0) {
              errors.push(`${field.field_label} contains invalid options: ${invalidOptions.join(', ')}`);
            }
          } else {
            errors.push(`${field.field_label} must be an array`);
          }
          break;
      }

      // Custom validation rules
      if (field.validation_rules && Object.keys(field.validation_rules).length > 0) {
        const validationErrors = this.applyValidationRules(value, field.validation_rules, field.field_label);
        errors.push(...validationErrors);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Execute an action with the given configuration
   */
  async executeAction(context: ActionExecutionContext): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      // Validate configuration
      const validation = await this.validateActionConfig(
        context.executor.provider_slug,
        context.executor.action_type,
        context.action_config
      );

      if (!validation.valid) {
        return {
          success: false,
          error: `Configuration validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Execute based on executor type
      switch (context.executor.executor_type) {
        case 'http_request':
        case 'webhook':
          return await this.executeHttpRequest(context);
        case 'api_call':
          return await this.executeApiCall(context);
        case 'email_smtp':
          return await this.executeEmailSmtp(context);
        case 'custom':
          return await this.executeCustomAction(context);
        default:
          return {
            success: false,
            error: `Unsupported executor type: ${context.executor.executor_type}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error'
      };
    }
  }

  /**
   * Execute HTTP request/webhook
   */
  private async executeHttpRequest(context: ActionExecutionContext): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    const config = context.executor.executor_config;
    const actionConfig = context.action_config;

    // Replace template variables in the configuration
    const url = this.replaceTemplateVariables(config.url || actionConfig.url, actionConfig, context);
    const method = (config.method || actionConfig.method || 'POST').toUpperCase();
    const headers = this.buildHeaders(config, actionConfig, context);
    const body = this.buildRequestBody(config, actionConfig, context);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method !== 'GET' ? body : undefined,
      });

      const responseData = await response.text();
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseData);
      } catch {
        parsedResponse = responseData;
      }

      const successCodes = config.response_success_codes || [200, 201, 202, 204];
      const isSuccess = successCodes.includes(response.status);

      return {
        success: isSuccess,
        result: {
          status: response.status,
          statusText: response.statusText,
          data: parsedResponse
        },
        error: isSuccess ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'HTTP request failed'
      };
    }
  }

  /**
   * Execute API call (with OAuth token handling)
   */
  private async executeApiCall(context: ActionExecutionContext): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    const config = context.executor.executor_config;
    const actionConfig = context.action_config;

    // Build the request
    const url = this.replaceTemplateVariables(config.endpoint, actionConfig, context);
    const method = config.method || 'POST';
    const headers = this.buildApiHeaders(config, actionConfig, context);
    const body = this.buildApiRequestBody(config, actionConfig, context);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method !== 'GET' ? JSON.stringify(body) : undefined,
      });

      const responseData = await response.text();
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseData);
      } catch {
        parsedResponse = responseData;
      }

      // Check for API-specific success indicators
      const successCodes = config.response_success_codes || [200, 201, 202];
      let isSuccess = successCodes.includes(response.status);

      // Some APIs return 200 but have success/error fields
      if (isSuccess && config.success_field && parsedResponse) {
        const successValue = config.success_value !== undefined ? config.success_value : true;
        isSuccess = parsedResponse[config.success_field] === successValue;
      }

      return {
        success: isSuccess,
        result: parsedResponse,
        error: isSuccess ? undefined : this.extractApiError(parsedResponse, response)
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'API call failed'
      };
    }
  }

  /**
   * Execute email via SMTP (placeholder for future implementation)
   */
  private async executeEmailSmtp(context: ActionExecutionContext): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    // This would integrate with an SMTP service like SendGrid, AWS SES, etc.
    return {
      success: false,
      error: 'SMTP execution not yet implemented'
    };
  }

  /**
   * Execute custom action (placeholder for future extensions)
   */
  private async executeCustomAction(context: ActionExecutionContext): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    // This would allow for custom JavaScript execution or plugin loading
    return {
      success: false,
      error: 'Custom action execution not yet implemented'
    };
  }

  // Helper methods
  private replaceTemplateVariables(
    template: string, 
    actionConfig: DynamicActionConfig, 
    context: ActionExecutionContext
  ): string {
    let result = template;

    // Replace action config variables
    Object.keys(actionConfig).forEach(key => {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(actionConfig[key] || ''));
    });

    // Replace integration variables
    if (context.integration) {
      result = result.replace(/\{\{access_token\}\}/g, context.integration.encrypted_access_token || '');
      result = result.replace(/\{\{refresh_token\}\}/g, context.integration.encrypted_refresh_token || '');
    }

    return result;
  }

  private buildHeaders(
    config: any, 
    actionConfig: DynamicActionConfig, 
    context: ActionExecutionContext
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers
    };

    // Add auth header if provided
    if (actionConfig.auth_header) {
      headers['Authorization'] = actionConfig.auth_header;
    }

    // Parse and merge custom headers
    if (actionConfig.headers) {
      try {
        const customHeaders = typeof actionConfig.headers === 'string' 
          ? JSON.parse(actionConfig.headers) 
          : actionConfig.headers;
        Object.assign(headers, customHeaders);
      } catch {
        // Invalid JSON headers, ignore
      }
    }

    return headers;
  }

  private buildApiHeaders(
    config: any, 
    actionConfig: DynamicActionConfig, 
    context: ActionExecutionContext
  ): Record<string, string> {
    const headers: Record<string, string> = { ...config.headers };

    // Replace template variables in headers
    Object.keys(headers).forEach(key => {
      headers[key] = this.replaceTemplateVariables(headers[key], actionConfig, context);
    });

    return headers;
  }

  private buildRequestBody(
    config: any, 
    actionConfig: DynamicActionConfig, 
    context: ActionExecutionContext
  ): string | undefined {
    if (actionConfig.body) {
      try {
        // Try to parse as JSON and stringify for consistency
        const bodyObj = typeof actionConfig.body === 'string' 
          ? JSON.parse(actionConfig.body) 
          : actionConfig.body;
        return JSON.stringify(bodyObj);
      } catch {
        // Return as string if not valid JSON
        return String(actionConfig.body);
      }
    }
    return undefined;
  }

  private buildApiRequestBody(
    config: any, 
    actionConfig: DynamicActionConfig, 
    context: ActionExecutionContext
  ): any {
    const bodyTemplate = config.body_template || {};
    const result: any = {};

    // Apply field mappings
    if (config.field_mappings) {
      Object.keys(config.field_mappings).forEach(configKey => {
        const mapping = config.field_mappings[configKey];
        const value = actionConfig[configKey];
        
        if (value !== undefined) {
          this.setNestedProperty(result, mapping, value);
        }
      });
    }

    // Merge with body template
    return { ...bodyTemplate, ...result };
  }

  private setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  private extractApiError(response: any, httpResponse: Response): string {
    if (response && typeof response === 'object') {
      // Common error field names
      const errorFields = ['error', 'message', 'error_description', 'detail'];
      for (const field of errorFields) {
        if (response[field]) {
          return String(response[field]);
        }
      }
    }
    return `HTTP ${httpResponse.status}: ${httpResponse.statusText}`;
  }

  private applyValidationRules(
    value: any, 
    rules: Record<string, any>, 
    fieldLabel: string
  ): string[] {
    const errors: string[] = [];

    if (rules.minLength && String(value).length < rules.minLength) {
      errors.push(`${fieldLabel} must be at least ${rules.minLength} characters`);
    }

    if (rules.maxLength && String(value).length > rules.maxLength) {
      errors.push(`${fieldLabel} must be no more than ${rules.maxLength} characters`);
    }

    if (rules.pattern && !new RegExp(rules.pattern).test(String(value))) {
      errors.push(`${fieldLabel} format is invalid`);
    }

    if (rules.min && Number(value) < rules.min) {
      errors.push(`${fieldLabel} must be at least ${rules.min}`);
    }

    if (rules.max && Number(value) > rules.max) {
      errors.push(`${fieldLabel} must be no more than ${rules.max}`);
    }

    return errors;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance for client-side usage
export const actionExecutorService = new ActionExecutorService();

// Factory function for server-side usage with authenticated client
export function createActionExecutorService(supabaseClient: SupabaseClient): ActionExecutorService {
  return new ActionExecutorService(supabaseClient);
}
