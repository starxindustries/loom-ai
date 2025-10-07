import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { oauthService } from "@/lib/oauth-service";

// GET - Initiate OAuth 2.0 flow
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    
    // console.log(`Initiating OAuth 2.0 flow for provider: ${provider}`);
    
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return NextResponse.redirect(
        new URL('/auth/login?error=unauthorized', request.url)
      );
    }

    // console.log(`User authenticated for OAuth 2.0 flow:`, {
    //   userId: user.id,
    //   email: user.email,
    //   provider
    // });

    // Generate OAuth 2.0 authorization URL
    const authUrl = await oauthService.generateAuthUrl(provider, user.id);
    
    // console.log(`OAuth 2.0 URL generated for ${provider}:`, {
    //   url: authUrl,
    //   length: authUrl.length,
    //   hasState: authUrl.includes('state='),
    //   hasClientId: authUrl.includes('client_id=')
    // });

    // Redirect to OAuth provider
    return NextResponse.redirect(authUrl);

  } catch (error) {
    console.error('OAuth 2.0 initiation error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to initiate OAuth flow';
    if (error instanceof Error) {
      if (error.message.includes('Provider not found')) {
        errorMessage = `OAuth provider '${await (await params).provider}' not found or inactive`;
      } else if (error.message.includes('does not support OAuth')) {
        errorMessage = `Provider does not support OAuth authentication`;
      } else if (error.message.includes('client')) {
        errorMessage = 'OAuth client configuration error';
      }
    }
    
    return NextResponse.redirect(
      new URL(`/protected/settings?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
