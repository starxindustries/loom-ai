import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createActionExecutorService } from "@/lib/action-executor";

// GET - Get field definitions for a specific action
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    const action = searchParams.get("action");

    if (!provider || !action) {
      return NextResponse.json(
        { error: "Missing required parameters: provider, action" },
        { status: 400 }
      );
    }

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

    // Create server-side action executor service
    const actionExecutorService = createActionExecutorService(supabase);
    
    const fieldDefinitions = await actionExecutorService.getActionFieldDefinitions(
      provider,
      action
    );

    return NextResponse.json({
      success: true,
      data: fieldDefinitions
    });

  } catch (error) {
    console.error("Error fetching field definitions:", error);
    return NextResponse.json(
      { error: "Failed to fetch field definitions" },
      { status: 500 }
    );
  }
}
