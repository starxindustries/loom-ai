import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRealActionExecutorService } from "@/lib/real-action-executor";
import { ActionExecutionContext } from "@/types/reminder";

// POST - Internal API to execute actions (called from database functions)
export async function POST(request: NextRequest) {
  try {
    // Verify this is an internal call (you can add API key validation here)
    const authHeader = request.headers.get('authorization');
    const internalApiKey = process.env.INTERNAL_API_KEY;
    
    if (internalApiKey && authHeader !== `Bearer ${internalApiKey}`) {
      return NextResponse.json(
        { error: "Unauthorized internal API call" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      task_id, 
      user_id, 
      provider_slug, 
      action_type, 
      action_config, 
      integration 
    } = body;

    if (!task_id || !user_id || !provider_slug || !action_type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get the action executor and field definitions
    const actionExecutorService = createRealActionExecutorService(supabase);
    
    const [executor, fieldDefinitions] = await Promise.all([
      actionExecutorService.getActionExecutor(provider_slug, action_type),
      actionExecutorService.getActionFieldDefinitions(provider_slug, action_type)
    ]);

    if (!executor) {
      return NextResponse.json(
        { 
          success: false, 
          error: `No executor found for ${provider_slug}:${action_type}` 
        },
        { status: 404 }
      );
    }

    // Build execution context
    const executionContext: ActionExecutionContext = {
      user_id,
      task_id,
      integration: integration || {
        id: '',
        encrypted_access_token: '',
        encrypted_refresh_token: '',
        encrypted_api_key: '',
        additional_config: {}
      },
      action_config: action_config || {},
      field_definitions: fieldDefinitions,
      executor
    };

    // Execute the action
    const result = await actionExecutorService.executeAction(executionContext);

    // Log the execution result
    console.log(`Action execution result for task ${task_id}:`, result);

    // Update the task execution log in database
    if (result.success) {
      await supabase
        .from('task_execution_logs')
        .update({
          status: 'success',
          result_data: result.result,
          completed_at: new Date().toISOString()
        })
        .eq('task_id', task_id)
        .eq('status', 'running');
    } else {
      await supabase
        .from('task_execution_logs')
        .update({
          status: 'failed',
          error_message: result.error,
          completed_at: new Date().toISOString()
        })
        .eq('task_id', task_id)
        .eq('status', 'running');
    }

    return NextResponse.json({
      success: result.success,
      result: result.result,
      error: result.error
    });

  } catch (error) {
    console.error("Error in internal action execution:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown execution error" 
      },
      { status: 500 }
    );
  }
}
