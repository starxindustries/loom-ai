import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reminderService } from "@/lib/reminder-service";

// GET - Get reminder templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;

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

    const templates = await reminderService.getReminderTemplates(user.id, category);

    return NextResponse.json({
      success: true,
      data: templates
    });

  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST - Create reminder from template
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
    const { template_id, context, scheduled_at, timezone } = body;

    if (!template_id || !context || !scheduled_at) {
      return NextResponse.json(
        { error: "Missing required fields: template_id, context, scheduled_at" },
        { status: 400 }
      );
    }

    // Validate scheduled_at is in the future
    const scheduledDate = new Date(scheduled_at);
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 }
      );
    }

    const result = await reminderService.createReminderFromTemplate(
      user.id,
      template_id,
      context,
      scheduled_at,
      timezone
    );

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.task,
      message: "Reminder created from template successfully"
    });

  } catch (error) {
    console.error("Error creating reminder from template:", error);
    return NextResponse.json(
      { error: "Failed to create reminder from template" },
      { status: 500 }
    );
  }
}

