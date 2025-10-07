import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Debug user integrations
export async function GET(request: NextRequest) {
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

    // Get all integrations for this user (bypass RLS for debugging)
    const { data: integrations, error: integrationsError } = await supabase
      .from('user_integrations')
      .select(`
        *,
        provider:integration_providers(*)
      `)
      .eq('user_id', user.id);

    // Get all providers
    const { data: providers, error: providersError } = await supabase
      .from('integration_providers')
      .select('*')
      .eq('is_active', true);

    return NextResponse.json({
      success: true,
      debug: {
        userId: user.id,
        userEmail: user.email,
        integrations: {
          data: integrations,
          error: integrationsError,
          count: integrations?.length || 0
        },
        providers: {
          data: providers,
          error: providersError,
          count: providers?.length || 0
        }
      }
    });

  } catch (error) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to debug integrations", details: error },
      { status: 500 }
    );
  }
}
