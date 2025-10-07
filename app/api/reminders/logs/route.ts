import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reminderService } from "@/lib/reminder-service";

// GET - Get task execution logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const task_id = searchParams.get("task_id") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50");

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

    const logs = await reminderService.getTaskLogs(user.id, task_id, limit);

    return NextResponse.json({
      success: true,
      data: logs
    });

  } catch (error) {
    console.error("Error fetching task logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch task logs" },
      { status: 500 }
    );
  }
}

