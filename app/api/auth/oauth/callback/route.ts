import { NextRequest, NextResponse } from "next/server";
import { oauthService } from "@/lib/oauth-service";
import { createClient } from "@/lib/supabase/server";

// GET - Handle OAuth 2.0 callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('OAuth 2.0 error:', error, errorDescription);
      const errorMessage = errorDescription || 'OAuth authorization failed';
      return NextResponse.redirect(
        new URL(`/protected/settings?error=${encodeURIComponent(errorMessage)}`, request.url)
      );
    }

    if (!code || !state) {
      console.error('Missing OAuth parameters:', { code: !!code, state: !!state });
      return NextResponse.redirect(
        new URL('/protected/settings?error=missing_oauth_parameters', request.url)
      );
    }

    // console.log('Processing OAuth 2.0 callback:', { 
    //   hasCode: !!code, 
    //   hasState: !!state,
    //   codeLength: code?.length,
    //   stateLength: state?.length 
    // });

    // Exchange code for tokens
    const { provider, tokens, userId } = await oauthService.exchangeCodeForTokens(code, state);

    // console.log('Token exchange successful:', {
    //   provider: provider.slug,
    //   hasAccessToken: !!tokens.access_token,
    //   hasRefreshToken: !!tokens.refresh_token,
    //   tokenType: tokens.token_type,
    //   expiresIn: tokens.expires_in
    // });

    // Get user info from provider to verify connection (optional)
    const userInfo = await oauthService.getProviderUserInfo(provider.slug, tokens.access_token);
    
    // console.log('Retrieved user info from provider:', {
    //   provider: provider.slug,
    //   userInfo: userInfo,
    //   hasUserInfo: !!userInfo,
    //   hasEmail: !!userInfo?.email,
    //   hasName: !!userInfo?.name
    // });

    // Generate connection name based on user info (fallback to generic name)
    let connectionName = `My ${provider.name}`;
    if (userInfo) {
      if (provider.slug === 'gmail' || provider.slug === 'google_calendar') {
        connectionName = userInfo.email ? `${provider.name} (${userInfo.email})` : connectionName;
      } else if (provider.slug === 'slack') {
        connectionName = userInfo.team ? `${provider.name} (${userInfo.team})` : connectionName;
      } else if (provider.slug === 'notion') {
        connectionName = userInfo.name ? `${provider.name} (${userInfo.name})` : connectionName;
      }
    } else {
      // If no user info available, create a unique connection name with timestamp
      const timestamp = new Date().toLocaleString();
      connectionName = `${provider.name} (Connected ${timestamp})`;
    }

    // console.log('Generated connection name:', connectionName);

    // Store tokens and user info in database
    await oauthService.storeTokens(userId, provider.id, tokens, connectionName, userInfo);

    // console.log('OAuth 2.0 integration completed successfully:', {
    //   provider: provider.slug,
    //   userId,
    //   connectionName,
    //   userInfo: userInfo
    // });

    // Verify the integration was stored
    try {
      const supabase = await createClient();
      const { data: storedIntegration, error: verifyError } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('provider_id', provider.id)
        .single();
      
      // console.log('Integration verification:', {
      //   stored: !!storedIntegration,
      //   error: verifyError,
      //   integrationId: storedIntegration?.id
      // });
    } catch (verifyError) {
      console.error('Failed to verify stored integration:', verifyError);
    }

    // Redirect back to settings with success message
    return NextResponse.redirect(
      new URL(`/protected/settings?success=${encodeURIComponent(`${provider.name} connected successfully`)}`, request.url)
    );

  } catch (error) {
    console.error('OAuth 2.0 callback error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to complete OAuth flow';
    if (error instanceof Error) {
      if (error.message.includes('state')) {
        errorMessage = 'Invalid or expired OAuth state';
      } else if (error.message.includes('token')) {
        errorMessage = 'Failed to exchange authorization code';
      } else if (error.message.includes('Provider not found')) {
        errorMessage = 'OAuth provider configuration error';
      }
    }
    
    return NextResponse.redirect(
      new URL(`/protected/settings?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
