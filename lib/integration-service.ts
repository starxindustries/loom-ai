import { createClient } from './supabase/client';
import { 
  IntegrationProvider, 
  UserIntegration, 
  IntegrationCheckResult,
  ToastNotification 
} from '../types/reminder';
import { SupabaseClient } from '@supabase/supabase-js';

export class IntegrationService {
  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient();
  }

  /**
   * Get all available integration providers
   */
  async getProviders(): Promise<IntegrationProvider[]> {
    const { data, error } = await this.supabase
      .from('integration_providers')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch providers: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get provider by slug
   */
  async getProviderBySlug(slug: string): Promise<IntegrationProvider | null> {
    const { data, error } = await this.supabase
      .from('integration_providers')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch provider: ${error.message}`);
    }

    return data;
  }

  /**
   * Get user's integrations
   */
  async getUserIntegrations(userId: string): Promise<UserIntegration[]> {
    const { data, error } = await this.supabase
      .from('user_integrations')
      .select(`
        *,
        provider:integration_providers(*)
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch user integrations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Check if user has a specific integration
   */
  async checkIntegration(userId: string, providerSlug: string): Promise<IntegrationCheckResult> {
    try {
      // Get provider info
      const provider = await this.getProviderBySlug(providerSlug);
      if (!provider) {
        return {
          exists: false,
          provider: null,
          integration: null,
          error: `Provider '${providerSlug}' not found`
        };
      }

      // Check if user has this integration
      const { data: integration, error } = await this.supabase
        .from('user_integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('provider_id', provider.id)
        .eq('is_active', true)
        .single();
      if (error && error.code !== 'PGRST116') {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        exists: !!integration,
        provider,
        integration: integration || null,
        missing_scopes: integration ? [] : provider.oauth_scopes || []
      };
    } catch (error) {
      return {
        exists: false,
        provider: null,
        integration: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a user integration (for API key based integrations)
   */
  async createIntegration(
    userId: string,
    providerSlug: string,
    connectionName: string,
    credentials: {
      apiKey?: string;
      accessToken?: string;
      refreshToken?: string;
      additionalConfig?: Record<string, any>;
    }
  ): Promise<UserIntegration> {
    const provider = await this.getProviderBySlug(providerSlug);
    if (!provider) {
      throw new Error(`Provider '${providerSlug}' not found`);
    }

    // For now, we'll store credentials as encrypted fields
    // In a real implementation, you'd use your encryption service
    const integrationData = {
      user_id: userId,
      provider_id: provider.id,
      connection_name: connectionName,
      encrypted_api_key: credentials.apiKey,
      encrypted_access_token: credentials.accessToken,
      encrypted_refresh_token: credentials.refreshToken,
      additional_config: credentials.additionalConfig || {},
      // Encryption metadata - you'd generate these with your crypto service
      wrapped_dek: 'placeholder_wrapped_dek',
      dek_salt: 'placeholder_salt',
      dek_iv: 'placeholder_iv',
      data_iv: 'placeholder_data_iv',
      kdf_algorithm: 'pbkdf2',
      kdf_iterations: 100000,
      encryption_algorithm: 'aes-256-gcm',
      is_active: true
    };

    const { data, error } = await this.supabase
      .from('user_integrations')
      .insert(integrationData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create integration: ${error.message}`);
    }

    return data;
  }

  /**
   * Update integration status
   */
  async updateIntegrationStatus(
    integrationId: string,
    isActive: boolean,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      is_active: isActive,
      updated_at: new Date().toISOString()
    };

    if (errorMessage) {
      updateData.last_error = errorMessage;
      // We'll increment error_count by first fetching current value
      const { data: currentData } = await this.supabase
        .from('user_integrations')
        .select('error_count')
        .eq('id', integrationId)
        .single();
      
      updateData.error_count = (currentData?.error_count || 0) + 1;
    }

    const { error } = await this.supabase
      .from('user_integrations')
      .update(updateData)
      .eq('id', integrationId);

    if (error) {
      throw new Error(`Failed to update integration: ${error.message}`);
    }
  }

  /**
   * Delete user integration
   */
  async deleteIntegration(userId: string, integrationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_integrations')
      .delete()
      .eq('id', integrationId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete integration: ${error.message}`);
    }
  }

  /**
   * Generate toast notification for missing integration
   */
  generateMissingIntegrationToast(providerSlug: string, providerName: string): ToastNotification {
    const authTypeMessages: Record<string, string> = {
      oauth2: `Please connect your ${providerName} account in Settings → Integrations before I can perform actions with ${providerName}.`,
      api_key: `Please add your ${providerName} API key in Settings → Integrations before I can perform actions with ${providerName}.`,
      basic_auth: `Please configure your ${providerName} credentials in Settings → Integrations before I can perform actions with ${providerName}.`
    };

    return {
      type: 'warning',
      title: 'Integration Required',
      message: authTypeMessages.oauth2, // Default message, should be customized based on provider
      action: {
        label: 'Go to Settings',
        url: '/protected/settings?tab=integrations'
      },
      duration: 8000
    };
  }

  /**
   * Get integration by provider slug for a user
   */
  async getUserIntegrationByProvider(
    userId: string, 
    providerSlug: string
  ): Promise<UserIntegration | null> {
    console.log({userId})
    console.log({providerSlug})
    const { data, error } = await this.supabase
      .from('user_integrations')
      .select(`
        *,
        provider:integration_providers!inner(*)
      `)
      .eq('user_id', userId)
      .eq('provider.slug', providerSlug)
      .eq('is_active', true)
      .single();
    console.log({data})
    console.log({error})
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch integration: ${error.message}`);
    }

    return data;
  }

  /**
   * Validate integration for specific actions
   */
  async validateIntegrationForAction(
    userId: string,
    providerSlug: string,
    requiredAction: string
  ): Promise<{ valid: boolean; error?: string; toast?: ToastNotification }> {
    try {
      const checkResult = await this.checkIntegration(userId, providerSlug);
      
      if (!checkResult.exists || !checkResult.provider) {
        const toast = this.generateMissingIntegrationToast(
          providerSlug,
          checkResult.provider?.name || providerSlug
        );
        
        return {
          valid: false,
          error: `Missing ${providerSlug} integration`,
          toast
        };
      }
      // Check if provider supports the required action
      if (!checkResult.provider.supported_actions.includes(requiredAction)) {
        return {
          valid: false,
          error: `${checkResult.provider.name} doesn't support '${requiredAction}' action`
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }
}

// Export singleton instance for client-side usage
export const integrationService = new IntegrationService();

// Factory function for server-side usage with authenticated client
export function createIntegrationService(supabaseClient: SupabaseClient): IntegrationService {
  return new IntegrationService(supabaseClient);
}
