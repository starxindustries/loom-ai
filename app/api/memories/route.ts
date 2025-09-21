// memory API
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addMemory, addMemoriesBatch, searchMemories, listMemories, deleteMemory } from "@/lib/memory";
import { usageLimitMiddleware } from "@/lib/usage-limit-middleware";
import { usageTrackingService } from "@/lib/usage-tracking-service";

// GET - Search memories or list all memories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const sort_by = searchParams.get("sort_by") || "created_at";
    const sort_order = searchParams.get("sort_order") || "desc";

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // If query is provided, search memories
    if (query) {
      const threshold = parseFloat(searchParams.get("threshold") || "0.3");
      const result = await searchMemories(user.id, query, {
        threshold,
        limit,
        enableTextSearch: false, // Disabled for better performance
      });
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Otherwise, list all memories with pagination
    const result = await listMemories(user.id, {
      page,
      limit,
      sort_by: sort_by as 'created_at' | 'updated_at',
      sort_order: sort_order as 'asc' | 'desc',
    });

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Memory API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process memory request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// POST - Add new memory with usage limit enforcement
export const POST = usageLimitMiddleware.withMemoryLimitCheck(
  async (request: NextRequest, userId: string): Promise<NextResponse> => {
    try {
      const { content, generateEmbedding = true } = await request.json();

      if (!content || typeof content !== "string") {
        return NextResponse.json(
          { error: "Content is required" },
          { status: 400 }
        );
      }

      // The usage limit has already been checked by the middleware
      // If we reach here, the user is within their limits
      const result = await addMemory(userId, content, generateEmbedding);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        );
      }

      // The middleware will automatically increment usage after successful response
      return NextResponse.json({
        success: true,
        memoryId: result.memoryId,
        message: "Memory stored successfully",
      });
    } catch (error) {
      console.error("Memory storage error:", error);
      return NextResponse.json(
        { error: "Failed to store memory" },
        { status: 500 }
      );
    }
  }
);

// PUT - Add multiple memories with usage limit enforcement
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const { memories, generateEmbeddings = true } = await request.json();

    if (!memories || !Array.isArray(memories)) {
      return NextResponse.json(
        { error: "Memories array is required" },
        { status: 400 }
      );
    }

    // Get user ID
    const userId = await usageLimitMiddleware.getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User not authenticated' },
        { status: 401 }
      );
    }

    // For batch operations, we need to check if user can add all memories
    // Check current usage and see if adding all memories would exceed limit
    const currentUsage = await usageTrackingService.getCurrentUsage(userId);
    const wouldExceedLimit = (currentUsage.memoryCount + memories.length) > currentUsage.memoryLimit;

    if (wouldExceedLimit) {
      const upgradePrompt = await usageTrackingService.getUpgradePrompt(userId, 'memory');
      return usageLimitMiddleware.createUsageLimitResponse(upgradePrompt);
    }

    // Process the batch
    const result = await addMemoriesBatch(userId, memories, generateEmbeddings);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Increment usage by the number of memories added
    for (let i = 0; i < memories.length; i++) {
      await usageLimitMiddleware.incrementUsageAfterOperation(userId, 'memory');
    }

    return NextResponse.json({
      success: true,
      memoryIds: result.memoryIds,
      message: `${memories.length} memories stored successfully`,
    });
  } catch (error) {
    console.error("Batch memory storage error:", error);
    return NextResponse.json(
      { error: "Failed to store memories" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a memory
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const memoryId = searchParams.get("id");

    if (!memoryId) {
      return new Response(
        JSON.stringify({ error: "Memory ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const result = await deleteMemory(user.id, memoryId);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Memory deleted successfully",
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Delete memory error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete memory" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
