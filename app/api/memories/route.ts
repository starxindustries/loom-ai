import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addMemory, addMemoriesBatch, searchMemories } from "@/lib/memory";

// GET - Search memories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const limit = parseInt(searchParams.get("limit") || "10");
    const threshold = parseFloat(searchParams.get("threshold") || "0.3");

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query parameter is required" }),
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

    const result = await searchMemories(user.id, query, {
      threshold,
      limit,
      enableTextSearch: false, // Disabled for better performance
    });

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Memory search error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to search memories" }),
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
