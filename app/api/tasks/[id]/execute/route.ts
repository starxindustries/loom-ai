import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTaskSchedulerService } from "@/lib/task-scheduler";

// POST - Manually execute a task
export async function POST(
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
      .select('id, user_id, title, status')
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

    // Execute the task
    const result = await taskSchedulerService.executeTaskNow(taskId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to execute task" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Task executed successfully",
      task: {
        id: task.id,
        title: task.title
      }
    });

  } catch (error) {
    console.error("Error executing task:", error);
    return NextResponse.json(
      { error: "Failed to execute task" },
      { status: 500 }
    );
  }
}
