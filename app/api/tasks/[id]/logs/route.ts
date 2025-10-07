import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTaskSchedulerService } from "@/lib/task-scheduler";

// GET - Get execution logs for a task
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const taskId = params.id;

    // Verify the task belongs to the user
    const { data: task, error: taskError } = await supabase
      .from('scheduled_tasks')
      .select('id, user_id, title')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single();

    if (taskError || !task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Create server-side task scheduler service
    const taskSchedulerService = createTaskSchedulerService(supabase);

    // Get execution logs
    const result = await taskSchedulerService.getTaskExecutionLogs(taskId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to fetch logs" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        task: {
          id: task.id,
          title: task.title
        },
        logs: result.logs || []
      }
    });

  } catch (error) {
    console.error("Error fetching task logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch task logs" },
      { status: 500 }
    );
  }
}
