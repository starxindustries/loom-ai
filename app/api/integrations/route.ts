import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { integrationService } from "@/lib/integration-service";

// GET - Get available providers and user's integrations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'providers' or 'user'

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (type === 'providers') {
      // Fetch providers directly with server client to bypass RLS
      const { data: providers, error } = await supabase
        .from('integration_providers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching providers:', error);
        return NextResponse.json(
          { error: "Failed to fetch providers" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: providers || []
      });
    }

    // Default: get user's integrations using server client
    const { data: integrations, error: integrationsError } = await supabase
      .from('user_integrations')
      .select(`
        *,
        provider:integration_providers(*)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (integrationsError) {
      console.error('Error fetching user integrations:', integrationsError);
      return NextResponse.json(
        { error: "Failed to fetch user integrations" },
        { status: 500 }
      );
    }

    console.log('User integrations fetched:', {
      userId: user.id,
      count: integrations?.length || 0,
      integrations: integrations
    });

    return NextResponse.json({
      success: true,
      data: integrations || []
    });

  } catch (error) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

// POST - Create new integration (for API key based integrations)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { provider_slug, connection_name, api_key, additional_config } = body;

    if (!provider_slug || !connection_name) {
      return NextResponse.json(
        { error: "Missing required fields: provider_slug, connection_name" },
        { status: 400 }
      );
    }

    // Check if provider exists and requires API key
    const provider = await integrationService.getProviderBySlug(provider_slug);
    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    if (provider.auth_type === 'api_key' && !api_key) {
      return NextResponse.json(
        { error: "API key is required for this provider" },
        { status: 400 }
      );
    }

    if (provider.auth_type === 'oauth2') {
      return NextResponse.json(
        { error: "OAuth integrations must be created through the OAuth flow" },
        { status: 400 }
      );
    }

    const integration = await integrationService.createIntegration(
      user.id,
      provider_slug,
      connection_name,
      {
        apiKey: api_key,
        additionalConfig: additional_config
      }
    );

    return NextResponse.json({
      success: true,
      data: integration,
      message: "Integration created successfully"
    });

  } catch (error) {
    console.error("Error creating integration:", error);
    return NextResponse.json(
      { error: "Failed to create integration" },
      { status: 500 }
    );
  }
}
