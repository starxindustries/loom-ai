import { createClient } from './supabase/server';
import { IntegrationProvider } from '../types/reminder';
import { MemoryEncryption } from './crypto';

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export class OAuthService {

  /**
   * Get OAuth configuration from environment variables
   */
  private getOAuthConfig(providerSlug: string): OAuthConfig {
    // Get base URL with fallback
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      console.warn('NEXT_PUBLIC_APP_URL not set, using fallback: http://localhost:3000');
    }

    const configs: Record<string, OAuthConfig> = {
      gmail: {
        clientId: process.env.GOOGLE_INTEGRATION_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_INTEGRATION_SECRET!,
        redirectUri: `${baseUrl}/api/auth/oauth/callback`
      },
      google_calendar: {
        clientId: process.env.GOOGLE_INTEGRATION_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_INTEGRATION_SECRET!,
        redirectUri: `${baseUrl}/api/auth/oauth/callback`
      },
      slack: {
        clientId: process.env.SLACK_CLIENT_ID!,
        clientSecret: process.env.SLACK_CLIENT_SECRET!,
        redirectUri: `${baseUrl}/api/auth/oauth/callback`
      },
      notion: {
        clientId: process.env.NOTION_CLIENT_ID!,
        clientSecret: process.env.NOTION_CLIENT_SECRET!,
        redirectUri: `${baseUrl}/api/auth/oauth/callback`
      }
    };

    const config = configs[providerSlug];
    if (!config) {
      throw new Error(`OAuth configuration not found for provider: ${providerSlug}`);
    }

    // Validate required environment variables
    if (!config.clientId) {
      throw new Error(`Missing client ID for ${providerSlug}. Please set the appropriate environment variable.`);
    }
    if (!config.clientSecret) {
      throw new Error(`Missing client secret for ${providerSlug}. Please set the appropriate environment variable.`);
    }

    return config;
  }

  /**
   * Generate OAuth 2.0 authorization URL with proper formatting
   */
  async generateAuthUrl(providerSlug: string, userId: string): Promise<string> {
    const supabase = await createClient();
    
    // Get provider details from database
    const { data: provider, error } = await supabase
      .from('integration_providers')
      .select('*')
      .eq('slug', providerSlug)
      .eq('is_active', true)
      .single();

    if (error || !provider) {
      throw new Error(`Provider not found: ${providerSlug}`);
    }

    if (!provider.oauth_authorize_url) {
      throw new Error(`Provider ${providerSlug} does not support OAuth`);
    }

    const config = this.getOAuthConfig(providerSlug);
    
    // Generate state parameter for security (includes userId and provider)
    const stateData = {
      token: this.generateSecureToken(),
      cid: this.generateConnectionId(),
      createdAt: Date.now(),
      userId,
      provider: providerSlug
    };
    
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    // Build OAuth 2.0 authorization URL with proper parameters
    const authUrl = new URL(provider.oauth_authorize_url);
    
    // Add OAuth 2.0 parameters
    const params: Record<string, string> = {
      access_type: 'offline',
      prompt: 'consent',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state: state,
      service: 'lso',
      o2v: '2',
      flowName: 'GeneralOAuthFlow'
    };

    // Add provider-specific scopes
    if (provider.oauth_scopes && provider.oauth_scopes.length > 0) {
      params.scope = provider.oauth_scopes.join(' ');
    }

    // Add parameters to URL
    Object.entries(params).forEach(([key, value]) => {
      authUrl.searchParams.append(key, value.toString());
    });

    // For Google OAuth, add the oauthchooseaccount path if not already present
    if (providerSlug === 'gmail' || providerSlug === 'google_calendar') {
      if (!authUrl.pathname.includes('oauthchooseaccount')) {
        authUrl.pathname = authUrl.pathname.replace('/auth', '/auth/oauthchooseaccount');
      }
    }

    return authUrl.toString();
  }

  /**
   * Generate a secure random token for OAuth state
   */
  private generateSecureToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate a connection ID for OAuth state
   */
  private generateConnectionId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string, 
    state: string
  ): Promise<{ provider: IntegrationProvider; tokens: OAuthTokenResponse; userId: string }> {
    // Decode and validate state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch (error) {
      throw new Error('Invalid state parameter');
    }

    const { userId, provider: providerSlug, createdAt } = stateData;

    // Check state timestamp (expire after 10 minutes)
    if (Date.now() - createdAt > 10 * 60 * 1000) {
      throw new Error('OAuth state expired');
    }

    const supabase = await createClient();

    // Get provider details
    const { data: provider, error } = await supabase
      .from('integration_providers')
      .select('*')
      .eq('slug', providerSlug)
      .single();

    if (error || !provider) {
      throw new Error(`Provider not found: ${providerSlug}`);
    }

    const config = this.getOAuthConfig(providerSlug);

    // Exchange code for tokens
    const tokenResponse = await fetch(provider.oauth_token_url!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      throw new Error('Failed to exchange authorization code for tokens');
    }

    const tokens: OAuthTokenResponse = await tokenResponse.json();

    return { provider, tokens, userId };
  }

  /**
   * Refresh OAuth tokens
   */
  async refreshTokens(
    providerSlug: string, 
    refreshToken: string
  ): Promise<OAuthTokenResponse> {
    const supabase = await createClient();

    // Get provider details
    const { data: provider, error } = await supabase
      .from('integration_providers')
      .select('oauth_token_url')
      .eq('slug', providerSlug)
      .single();

    if (error || !provider) {
      throw new Error(`Provider not found: ${providerSlug}`);
    }

    const config = this.getOAuthConfig(providerSlug);

    const tokenResponse = await fetch(provider.oauth_token_url!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to refresh tokens');
    }

    return await tokenResponse.json();
  }

  /**
   * Store OAuth tokens in database (encrypted)
   */
  async storeTokens(
    userId: string,
    providerId: string,
    tokens: OAuthTokenResponse,
    connectionName: string,
    userInfo?: any
  ): Promise<void> {
    const supabase = await createClient();

    // Calculate token expiration
    const expiresAt = tokens.expires_in 
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // Generate a secure passphrase for token encryption using userId and providerId
    const tokenPassphrase = `${userId}-${providerId}-oauth-tokens`;

    // Encrypt access token
    const encryptedAccessToken = await MemoryEncryption.encryptMemory(
      tokens.access_token,
      tokenPassphrase
    );

    // Encrypt refresh token if present
    let encryptedRefreshToken = null;
    if (tokens.refresh_token) {
      encryptedRefreshToken = await MemoryEncryption.encryptMemory(
        tokens.refresh_token,
        tokenPassphrase
      );
    }

    // Prepare additional config with user info
    const additionalConfig: Record<string, any> = {};
    if (userInfo) {
      additionalConfig.user_profile = {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        verified_email: userInfo.verified_email,
        // Store any other relevant user info
        ...userInfo
      };
    }

    const integrationData = {
      user_id: userId,
      provider_id: providerId,
      connection_name: connectionName,
      encrypted_access_token: encryptedAccessToken.ciphertext,
      encrypted_refresh_token: encryptedRefreshToken?.ciphertext || null,
      server_access_token: tokens.access_token, // Store unencrypted for server-side automation
      server_refresh_token: tokens.refresh_token || null, // Store unencrypted for server-side automation
      server_token_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      token_expires_at: expiresAt,
      scopes_granted: tokens.scope ? tokens.scope.split(' ') : [],
      additional_config: additionalConfig,
      // Encryption metadata from crypto service
      wrapped_dek: encryptedAccessToken.wrapped_dek,
      dek_salt: encryptedAccessToken.dek_salt,
      dek_iv: encryptedAccessToken.dek_iv,
      data_iv: encryptedAccessToken.data_iv,
      kdf_algorithm: encryptedAccessToken.kdf_algorithm,
      kdf_iterations: encryptedAccessToken.kdf_iterations,
      encryption_algorithm: encryptedAccessToken.encryption_algorithm,
      is_active: true
    };

    console.log('Attempting to store integration data:', {
      userId,
      providerId,
      connectionName,
      hasAccessToken: !!integrationData.encrypted_access_token,
      hasRefreshToken: !!integrationData.encrypted_refresh_token,
      scopesCount: integrationData.scopes_granted.length,
      hasUserInfo: !!userInfo
    });

    // Check if integration already exists for this user+provider
    const { data: existingIntegration } = await supabase
      .from('user_integrations')
      .select('id, connection_name')
      .eq('user_id', userId)
      .eq('provider_id', providerId)
      .single();

    let data, error;
    
    if (existingIntegration) {
      // Update existing integration
      console.log('Updating existing integration:', existingIntegration.id);
      const updateData = {
        ...integrationData,
        connection_name: connectionName, // Update connection name
        updated_at: new Date().toISOString()
      };
      
      const result = await supabase
        .from('user_integrations')
        .update(updateData)
        .eq('id', existingIntegration.id)
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    } else {
      // Create new integration
      console.log('Creating new integration');
      const result = await supabase
        .from('user_integrations')
        .insert(integrationData)
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Database error storing integration:', {
        error: error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to store tokens: ${error.message}`);
    }

    console.log('Successfully stored integration:', {
      integrationId: data?.id,
      connectionName: data?.connection_name,
      isActive: data?.is_active
    });
  }

  /**
   * Decrypt and retrieve OAuth tokens for a user integration
   */
  async getDecryptedTokens(
    userId: string,
    providerId: string
  ): Promise<{ access_token: string; refresh_token?: string }> {
    const supabase = await createClient();

    // Get encrypted tokens from database
    const { data: integration, error } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider_id', providerId)
      .eq('is_active', true)
      .single();

    if (error || !integration) {
      throw new Error(`Integration not found for user ${userId} and provider ${providerId}`);
    }

    // Generate the same passphrase used for encryption
    const tokenPassphrase = `${userId}-${providerId}-oauth-tokens`;

    // Decrypt access token
    const encryptedAccessTokenData = {
      ciphertext: integration.encrypted_access_token,
      wrapped_dek: integration.wrapped_dek,
      dek_salt: integration.dek_salt,
      dek_iv: integration.dek_iv,
      data_iv: integration.data_iv,
      kdf_algorithm: integration.kdf_algorithm,
      kdf_iterations: integration.kdf_iterations,
      encryption_algorithm: integration.encryption_algorithm,
    };

    const accessToken = await MemoryEncryption.decryptMemory(
      encryptedAccessTokenData,
      tokenPassphrase
    );

    // Decrypt refresh token if present
    let refreshToken;
    if (integration.encrypted_refresh_token) {
      const encryptedRefreshTokenData = {
        ...encryptedAccessTokenData,
        ciphertext: integration.encrypted_refresh_token,
      };
      refreshToken = await MemoryEncryption.decryptMemory(
        encryptedRefreshTokenData,
        tokenPassphrase
      );
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  /**
   * Get provider-specific user info (for connection verification)
   * Returns null if user info cannot be fetched (e.g., missing scopes)
   */
  async getProviderUserInfo(providerSlug: string, accessToken: string): Promise<any> {
    const userInfoEndpoints: Record<string, string> = {
      gmail: 'https://www.googleapis.com/oauth2/v2/userinfo',
      google_calendar: 'https://www.googleapis.com/oauth2/v2/userinfo',
      slack: 'https://slack.com/api/auth.test',
      notion: 'https://api.notion.com/v1/users/me'
    };

    const endpoint = userInfoEndpoints[providerSlug];
    if (!endpoint) {
      console.warn(`User info endpoint not configured for ${providerSlug}`);
      return null;
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`
    };

    // Notion requires specific version header
    if (providerSlug === 'notion') {
      headers['Notion-Version'] = '2022-06-28';
    }

    try {
      const response = await fetch(endpoint, { headers });

      if (!response.ok) {
        console.warn(`Failed to fetch user info from ${providerSlug}:`, {
          status: response.status,
          statusText: response.statusText,
          url: endpoint
        });
        
        // If it's a 403 (Forbidden), it's likely missing scopes
        if (response.status === 403) {
          console.warn(`Missing required scopes for ${providerSlug} user info. This is not critical for OAuth flow.`);
          return null;
        }
        
        // For other errors, still return null but log more details
        const errorText = await response.text();
        console.warn(`User info fetch error details:`, errorText);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.warn(`Exception while fetching user info from ${providerSlug}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const oauthService = new OAuthService();
