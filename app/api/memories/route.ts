// memory API
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addMemory, addMemoriesBatch, searchMemories, listMemories, deleteMemory } from "@/lib/memory";

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

// POST - Add new memory
export async function POST(request: NextRequest) {
  try {
    const { content, generateEmbedding = true } = await request.json();

    if (!content || typeof content !== "string") {
      return new Response(
        JSON.stringify({ error: "Content is required" }),
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

    const result = await addMemory(user.id, content, generateEmbedding);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        memoryId: result.memoryId,
        message: "Memory stored successfully",
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Memory storage error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to store memory" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// PUT - Add multiple memories
export async function PUT(request: NextRequest) {
  try {
    const { memories, generateEmbeddings = true } = await request.json();

    if (!memories || !Array.isArray(memories)) {
      return new Response(
        JSON.stringify({ error: "Memories array is required" }),
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

    const result = await addMemoriesBatch(user.id, memories, generateEmbeddings);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        memoryIds: result.memoryIds,
        message: `${memories.length} memories stored successfully`,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Batch memory storage error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to store memories" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
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
