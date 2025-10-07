import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reminderService, createReminderService } from "@/lib/reminder-service";
import { UsageLimitMiddleware } from "@/lib/usage-limit-middleware";
import { CreateReminderRequest } from "@/types/reminder";

// GET - Get user's reminders and tasks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.split(",") || undefined;
    const task_type = searchParams.get("task_type")?.split(",") || undefined;
    const upcoming = searchParams.get("upcoming") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

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

    // Create server-side reminder service with authenticated client
    const serverReminderService = createReminderService(supabase);

    let result;
    if (upcoming) {
      result = await serverReminderService.getUpcomingTasks(user.id);
    } else {
      result = await serverReminderService.getUserTasks(user.id, {
        status,
        task_type,
        limit,
        offset
      });
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("Error fetching reminders:", error);
    return NextResponse.json(
      { error: "Failed to fetch reminders" },
      { status: 500 }
    );
  }
}

// POST - Create a new reminder or task
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

    // Check usage limits for reminders/tasks
    const usageLimitMiddleware = new UsageLimitMiddleware();
    const usageCheck = await usageLimitMiddleware.enforceMemoryLimit(user.id); // Using memory limit for now
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { 
          error: "Usage limit exceeded",
          message: "You have reached your reminder limit",
          upgrade_required: true,
          upgradePrompt: usageCheck.upgradePrompt
        },
        { status: 429 }
      );
    }

    const body: CreateReminderRequest = await request.json();

    // Validate required fields
    if (!body.title || !body.scheduled_at || !body.task_type) {
      return NextResponse.json(
        { error: "Missing required fields: title, scheduled_at, task_type" },
        { status: 400 }
      );
    }

    // Validate scheduled_at is in the future
    const scheduledDate = new Date(body.scheduled_at);
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 }
      );
    }

    // Create server-side reminder service with authenticated client
    const serverReminderService = createReminderService(supabase);
    
    const result = await serverReminderService.createReminder(user.id, body);
    if (result.error) {
      return NextResponse.json(
        { 
          error: result.error,
          toast: result.toast
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.task,
      message: "Reminder created successfully"
    });

  } catch (error) {
    console.error("Error creating reminder:", error);
    return NextResponse.json(
      { error: "Failed to create reminder" },
      { status: 500 }
    );
  }
}

