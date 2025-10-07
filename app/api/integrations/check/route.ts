import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { integrationService } from "@/lib/integration-service";

// POST - Check if user has specific integration
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
    const { provider_slug, required_action } = body;

    if (!provider_slug) {
      return NextResponse.json(
        { error: "provider_slug is required" },
        { status: 400 }
      );
    }

    let result;
    if (required_action) {
      result = await integrationService.validateIntegrationForAction(
        user.id,
        provider_slug,
        required_action
      );
    } else {
      const checkResult = await integrationService.checkIntegration(user.id, provider_slug);
      result = {
        valid: checkResult.exists,
        error: checkResult.error,
        toast: checkResult.exists ? undefined : integrationService.generateMissingIntegrationToast(
          provider_slug,
          checkResult.provider?.name || provider_slug
        )
      };
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("Error checking integration:", error);
    return NextResponse.json(
      { error: "Failed to check integration" },
      { status: 500 }
    );
  }
}

