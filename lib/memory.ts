// search memory
import { createClient } from "@/lib/supabase/server";
import { Memory, MemorySearchResult, MemoryListResult, DeleteMemoryResult } from "@/types/memory";
import OpenAI from "openai";

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Search for relevant memories using vector similarity or text search
 */
export async function searchMemories(
  userId: string,
  query: string,
  options: {
    threshold?: number;
    limit?: number;
    enableTextSearch?: boolean;
  } = {}
): Promise<MemorySearchResult> {
  const { threshold = 0.3, limit = 3, enableTextSearch = false } = options;
  const searchId = Math.random().toString(36).substring(7);
  
  console.log(`[MEMORY-${searchId}] 🔍 Starting memory search - User: ${userId}, Query: "${query}", Threshold: ${threshold}, Limit: ${limit}, TextSearch: ${enableTextSearch}`);

  try {
    const supabase = await createClient();

    // Generate embedding for the query first
    console.log(`[MEMORY-${searchId}] 🧮 Generating query embedding`);
    const queryEmbedding = await generateEmbedding(query);
    
    if (!queryEmbedding) {
      console.log(`[MEMORY-${searchId}] ❌ Failed to generate query embedding, cannot perform vector search`);
      return {
        memories: [],
        total: 0,
        search_method: "vector",
      };
    }

    console.log(`[MEMORY-${searchId}] ✅ Query embedding generated (${queryEmbedding.length} dimensions)`);

    // Try vector search with the embedding
    console.log(`[MEMORY-${searchId}] 🧮 Attempting vector search`);
    const { data: vectorMemories, error: vectorError } = await supabase.rpc(
      "match_memories",
      {
        user_id_param: userId,
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
      }
    );

    if (!vectorError && vectorMemories && vectorMemories.length > 0) {
      console.log(`[MEMORY-${searchId}] ✅ Vector search successful - Found ${vectorMemories.length} memories`);
      return {
        memories: vectorMemories.map((m) => ({
          id: m.id,
          content: m.content,
          created_at: m.created_at,
          similarity: m.similarity,
        })),
        total: vectorMemories.length,
        search_method: "vector",
      };
    } else {
      console.log(`[MEMORY-${searchId}] ⚠️ Vector search failed or no results - Error: ${vectorError?.message || 'No results'}`);
      
      // Only attempt text search if explicitly enabled
      if (enableTextSearch) {
        console.log(`[MEMORY-${searchId}] 📝 Attempting text search fallback (enabled)`);
        const { data: textMemories, error: textError } = await supabase.rpc(
          "match_memories_text",
          {
            user_id_param: userId,
            query_text: query,
            match_count: limit,
          }
        );

        if (!textError && textMemories && textMemories.length > 0) {
          console.log(`[MEMORY-${searchId}] ✅ Text search successful - Found ${textMemories.length} memories`);
          return {
            memories: textMemories.map((m) => ({
              id: m.id,
              content: m.content,
              created_at: m.created_at,
              rank: m.rank,
            })),
            total: textMemories.length,
            search_method: "text",
          };
        } else {
          console.log(`[MEMORY-${searchId}] ⚠️ Text search also failed - Error: ${textError?.message || 'No results'}`);
        }
      } else {
        console.log(`[MEMORY-${searchId}] ℹ️ Skipping text search fallback for better performance`);
      }
    }

    console.log(`[MEMORY-${searchId}] ❌ No memories found with vector search`);
    return {
      memories: [],
      total: 0,
      search_method: "vector",
    };
  } catch (error) {
    console.error(`[MEMORY-${searchId}] ❌ Memory search error:`, error);
    return {
      memories: [],
      total: 0,
      search_method: "vector",
    };
  }
}

/**
 * Format memories for AI context
 */
export function formatMemoriesForContext(memories: Memory[]): string {
  if (!memories || memories.length === 0) {
    return "";
  }

  return (
    "\n\nRelevant memories:\n" +
    memories.map((memory) => `- ${memory.content}`).join("\n")
  );
}

/**
 * Generate embedding for text using OpenAI
 */
export async function generateEmbedding(
  text: string
): Promise<number[] | null> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small", // Using the latest embedding model
      input: text.trim(),
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("Embedding generation error:", error);
    return null;
  }
}

/**
 * Add a new memory to the database with automatic embedding generation
 */
export async function addMemory(
  userId: string,
  content: string,
  shouldGenerateEmbedding: boolean = true
): Promise<{ success: boolean; error?: string; memoryId?: string }> {
  const memoryId = Math.random().toString(36).substring(7);
  console.log(`[STORE-${memoryId}] 💾 Starting memory storage - User: ${userId}, Content: "${content.substring(0, 50)}...", GenerateEmbedding: ${shouldGenerateEmbedding}`);
  
  try {
    const supabase = await createClient();

    let embedding: number[] | null = null;

    // Generate embedding if requested
    if (shouldGenerateEmbedding) {
      console.log(`[STORE-${memoryId}] 🧮 Generating embedding for content`);
      embedding = await generateEmbedding(content);
      if (embedding) {
        console.log(`[STORE-${memoryId}] ✅ Embedding generated successfully (${embedding.length} dimensions)`);
      } else {
        console.log(`[STORE-${memoryId}] ⚠️ Failed to generate embedding, storing without embedding`);
      }
    }

    // Use RPC function to store memory
    console.log(`[STORE-${memoryId}] 🗄️ Storing memory in database`);
    const { data, error } = await supabase.rpc("store_memory", {
      user_id_param: userId,
      content_param: content.trim(),
      embedding_param: embedding,
    });

    if (error) {
      console.error(`[STORE-${memoryId}] ❌ Database error:`, error.message);
      return { success: false, error: error.message };
    }

    const storedMemoryId = data?.[0]?.id;
    console.log(`[STORE-${memoryId}] ✅ Memory stored successfully with ID: ${storedMemoryId}`);
    return {
      success: true,
      memoryId: storedMemoryId,
    };
  } catch (error) {
    console.error(`[STORE-${memoryId}] ❌ Add memory error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Add multiple memories in batch with embeddings
 */
export async function addMemoriesBatch(
  userId: string,
  memories: string[],
  shouldGenerateEmbeddings: boolean = true
): Promise<{ success: boolean; error?: string; memoryIds?: string[] }> {
  try {
    const supabase = await createClient();

    let memoriesData: any[] = [];

    if (shouldGenerateEmbeddings) {
      // Generate embeddings for all memories
      const embeddingPromises = memories.map(async (content) => {
        const embedding = await generateEmbedding(content);
        return {
          content: content.trim(),
          embedding: embedding,
        };
      });

      memoriesData = await Promise.all(embeddingPromises);
    } else {
      memoriesData = memories.map((content) => ({
        content: content.trim(),
        embedding: null,
      }));
    }

    // Use RPC function to store memories in batch
    const { data, error } = await supabase.rpc("store_memories_batch", {
      user_id_param: userId,
      memories_data: JSON.stringify(memoriesData),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      memoryIds: data?.map((m: any) => m.id) || [],
    };
  } catch (error) {
    console.error("Add memories batch error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update embedding for an existing memory
 */
export async function updateMemoryEmbedding(
  memoryId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Generate embedding
    const embedding = await generateEmbedding(content);
    if (!embedding) {
      return { success: false, error: "Failed to generate embedding" };
    }

    // Update memory with embedding
    const { error } = await supabase.rpc("update_memory_embedding", {
      memory_id_param: memoryId,
      embedding_param: embedding,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Update memory embedding error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * List all memories for a user with pagination
 */
export async function listMemories(
  userId: string,
  options: {
    page?: number;
    limit?: number;
    sort_by?: 'created_at' | 'updated_at';
    sort_order?: 'asc' | 'desc';
  } = {}
): Promise<MemoryListResult> {
  const {
    page = 1,
    limit = 20,
    sort_by = 'created_at',
    sort_order = 'desc'
  } = options;

  const offset = (page - 1) * limit;

  try {
    const supabase = await createClient();

    // Get total count
    const { count } = await supabase
      .from('encrypted_memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get memories with pagination
    const { data: memories, error } = await supabase
      .from('encrypted_memories')
      .select('*')
      .eq('user_id', userId)
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("List memories error:", error);
      return {
        memories: [],
        total: 0,
        page,
        total_pages: 0,
        has_next: false,
        has_prev: false,
      };
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      memories: memories || [],
      total,
      page,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    };
  } catch (error) {
    console.error("List memories error:", error);
    return {
      memories: [],
      total: 0,
      page,
      total_pages: 0,
      has_next: false,
      has_prev: false,
    };
  }
}

/**
 * Delete a memory by ID
 */
export async function deleteMemory(
  userId: string,
  memoryId: string
): Promise<DeleteMemoryResult> {
  try {
    const supabase = await createClient();

    // First verify the memory belongs to the user
    const { data: memory, error: fetchError } = await supabase
      .from('encrypted_memories')
      .select('id')
      .eq('id', memoryId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !memory) {
      return {
        success: false,
        error: "Memory not found or access denied",
      };
    }

    // Delete the memory
    const { error: deleteError } = await supabase
      .from('encrypted_memories')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error("Delete memory error:", deleteError);
      return {
        success: false,
        error: deleteError.message,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Delete memory error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
