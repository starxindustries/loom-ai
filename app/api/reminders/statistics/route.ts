import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reminderService } from "@/lib/reminder-service";

// GET - Get task statistics
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

    const statistics = await reminderService.getTaskStatistics(user.id);

    return NextResponse.json({
      success: true,
      data: statistics
    });

  } catch (error) {
    console.error("Error fetching task statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch task statistics" },
      { status: 500 }
    );
  }
}

