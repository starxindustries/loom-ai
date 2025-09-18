// app/api/encrypted-memory/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface EncryptedMemoryData {
  ciphertext: string;
  wrapped_dek: string;
  dek_salt: string;
  dek_iv: string;
  data_iv: string;
  kdf_algorithm: string;
  kdf_iterations: number;
  encryption_algorithm: string;
  encrypted_keywords?: string[];
  keyword_hints?: string[];
  content_type?: string;
}

export interface EncryptedMemoryResponse {
  id: string;
  ciphertext: string;
  wrapped_dek: string;
  dek_salt: string;
  dek_iv: string;
  data_iv: string;
  kdf_algorithm: string;
  kdf_iterations: number;
  encryption_algorithm: string;
  encrypted_keywords?: string[];
  keyword_hints?: string[];
  content_type?: string;
  created_at: string;
  updated_at: string;
}

/**
 * GET - Retrieve encrypted memories
 */
export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[ENCRYPTED-MEMORY-${requestId}] 📥 GET request started`);

  try {
    const { searchParams } = new URL(request.url);
    const memoryId = searchParams.get("id");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Validate parameters
    if (limit > 100) {
      return new Response(
        JSON.stringify({ error: "Limit cannot exceed 100" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log(
        `[ENCRYPTED-MEMORY-${requestId}] ❌ Unauthorized access attempt`
      );
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(
      `[ENCRYPTED-MEMORY-${requestId}] ✅ User authenticated: ${user.id}`
    );

    let query = supabase
      .from("encrypted_memories")
      .select(
        `
        id,
        ciphertext,
        wrapped_dek,
        dek_salt,
        dek_iv,
        data_iv,
        kdf_algorithm,
        kdf_iterations,
        encryption_algorithm,
        encrypted_keywords,
        keyword_hints,
        content_type,
        content_length,
        created_at,
        updated_at
      `
      )
      .eq("user_id", user.id)
      .eq("is_encrypted", true)
      .order("created_at", { ascending: false });

    // Get specific memory or paginated list
    if (memoryId) {
      query = query.eq("id", memoryId).limit(1);
    } else {
      query = query.range(offset, offset + limit - 1);
    }

    const { data: memories, error } = await query;

    if (error) {
      console.error(
        `[ENCRYPTED-MEMORY-${requestId}] ❌ Database error:`,
        error
      );
      return new Response(
        JSON.stringify({ error: "Failed to retrieve memories" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `[ENCRYPTED-MEMORY-${requestId}] ✅ Retrieved ${
        memories?.length || 0
      } memories`
    );

    return new Response(
      JSON.stringify({
        success: true,
        memories: memories || [],
        total: memories?.length || 0,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(
      `[ENCRYPTED-MEMORY-${requestId}] ❌ Unexpected error:`,
      error
    );
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * POST - Save new encrypted memory
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[ENCRYPTED-MEMORY-${requestId}] 📥 POST request started`);

  try {
    const body = (await request.json()) as EncryptedMemoryData;

    // Validate required fields
    const requiredFields = [
      "ciphertext",
      "wrapped_dek",
      "dek_salt",
      "dek_iv",
      "data_iv",
      "kdf_algorithm",
      "kdf_iterations",
      "encryption_algorithm",
    ];

    for (const field of requiredFields) {
      if (!body[field as keyof EncryptedMemoryData]) {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Validate algorithm types
    if (!["pbkdf2", "argon2id"].includes(body.kdf_algorithm)) {
      return new Response(JSON.stringify({ error: "Invalid KDF algorithm" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!["aes-256-gcm"].includes(body.encryption_algorithm)) {
      return new Response(
        JSON.stringify({ error: "Invalid encryption algorithm" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate iterations
    if (body.kdf_iterations < 10000 || body.kdf_iterations > 1000000) {
      return new Response(
        JSON.stringify({
          error: "KDF iterations must be between 10,000 and 1,000,000",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log(
        `[ENCRYPTED-MEMORY-${requestId}] ❌ Unauthorized access attempt`
      );
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(
      `[ENCRYPTED-MEMORY-${requestId}] ✅ User authenticated: ${user.id}`
    );

    // Calculate approximate content length for metadata
    const estimatedContentLength = Math.ceil(body.ciphertext.length * 0.75); // Base64 overhead

    // Insert encrypted memory
    const { data, error } = await supabase
      .from("encrypted_memories")
      .insert({
        user_id: user.id,
        ciphertext: body.ciphertext,
        wrapped_dek: body.wrapped_dek,
        dek_salt: body.dek_salt,
        dek_iv: body.dek_iv,
        data_iv: body.data_iv,
        kdf_algorithm: body.kdf_algorithm,
        kdf_iterations: body.kdf_iterations,
        encryption_algorithm: body.encryption_algorithm,
        encrypted_keywords: body.encrypted_keywords || null,
        keyword_hints: body.keyword_hints || null,
        content_type: body.content_type || "text/plain",
        content_length: estimatedContentLength,
        is_encrypted: true,
        version: 1,
      })
      .select()
      .single();

    if (error) {
      console.error(
        `[ENCRYPTED-MEMORY-${requestId}] ❌ Database error:`,
        error
      );
      return new Response(
        JSON.stringify({ error: "Failed to save encrypted memory" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `[ENCRYPTED-MEMORY-${requestId}] ✅ Memory saved with ID: ${data.id}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        memoryId: data.id,
        message: "Encrypted memory saved successfully",
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(
      `[ENCRYPTED-MEMORY-${requestId}] ❌ Unexpected error:`,
      error
    );
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * PUT - Update existing encrypted memory
 */
export async function PUT(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[ENCRYPTED-MEMORY-${requestId}] 📥 PUT request started`);

  try {
    const body = await request.json();
    const { id, ...updateData } = body as EncryptedMemoryData & { id: string };

    if (!id) {
      return new Response(
        JSON.stringify({ error: "Memory ID is required for updates" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Update memory (RLS will ensure user can only update their own memories)
    const { data, error } = await supabase
      .from("encrypted_memories")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id) // Double-check ownership
      .select()
      .single();

    if (error) {
      console.error(
        `[ENCRYPTED-MEMORY-${requestId}] ❌ Database error:`,
        error
      );
      return new Response(
        JSON.stringify({ error: "Failed to update encrypted memory" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: "Memory not found or access denied" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[ENCRYPTED-MEMORY-${requestId}] ✅ Memory updated: ${id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Encrypted memory updated successfully",
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(
      `[ENCRYPTED-MEMORY-${requestId}] ❌ Unexpected error:`,
      error
    );
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * DELETE - Remove encrypted memory
 */
export async function DELETE(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[ENCRYPTED-MEMORY-${requestId}] 📥 DELETE request started`);

  try {
    const { searchParams } = new URL(request.url);
    const memoryId = searchParams.get("id");

    if (!memoryId) {
      return new Response(JSON.stringify({ error: "Memory ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Delete memory (RLS will ensure user can only delete their own memories)
    const { error } = await supabase
      .from("encrypted_memories")
      .delete()
      .eq("id", memoryId)
      .eq("user_id", user.id); // Double-check ownership

    if (error) {
      console.error(
        `[ENCRYPTED-MEMORY-${requestId}] ❌ Database error:`,
        error
      );
      return new Response(
        JSON.stringify({ error: "Failed to delete encrypted memory" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `[ENCRYPTED-MEMORY-${requestId}] ✅ Memory deleted: ${memoryId}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Encrypted memory deleted successfully",
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(
      `[ENCRYPTED-MEMORY-${requestId}] ❌ Unexpected error:`,
      error
    );
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
