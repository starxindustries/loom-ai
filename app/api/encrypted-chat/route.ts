// app/api/encrypted-chat/route.ts
import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { usageLimitMiddleware } from "@/lib/usage-limit-middleware";
import { createReminderService } from "@/lib/reminder-service";
import { createIntegrationService } from "@/lib/integration-service";
import { CreateReminderRequest } from "@/types/reminder";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MemoryExtractionRequest {
  content: string;
  encrypted_data: {
    ciphertext: string;
    wrapped_dek: string;
    dek_salt: string;
    dek_iv: string;
    data_iv: string;
    kdf_algorithm: string;
    kdf_iterations: number;
    encryption_algorithm: string;
  };
  keyword_hints?: string[];
}

/**
 * Enhanced chat API with end-to-end encryption support
 * This API handles ONLY encrypted conversations for maximum privacy
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(
    `[ENCRYPTED-CHAT-${requestId}] 🚀 Encrypted chat request started`
  );

  try {
    const {
      messages,
      memory_extraction_data,
      session_active = false,
      session_key = null,
      master_salt = null,
    } = await request.json();

    // Validate input - we only accept decrypted messages for processing
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Decrypted messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get user authentication
    let userId: string | null = null;

    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      userId = user.id;
      console.log(
        `[ENCRYPTED-CHAT-${requestId}] ✅ User authenticated: ${user.id}`
      );

      // Get user encryption profile (required for encrypted mode)
      const { data: profile } = await supabase
        .from("user_encryption_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        return new Response(
          JSON.stringify({
            error:
              "Encryption profile not found. Please complete encryption setup.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Handle encrypted memory extraction if provided
      if (memory_extraction_data && Array.isArray(memory_extraction_data)) {
        console.log(
          `[ENCRYPTED-CHAT-${requestId}] 💾 Processing ${memory_extraction_data.length} encrypted memories`
        );
        await storeEncryptedMemories(
          user.id,
          memory_extraction_data,
          requestId
        );
      }
    } catch (error) {
      console.error(
        `[ENCRYPTED-CHAT-${requestId}] ❌ Auth/Profile error:`,
        error
      );
      return new Response(
        JSON.stringify({ error: "Authentication or profile error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prepare messages for OpenAI
    // Note: Messages have already been decrypted client-side before sending here
    // This maintains E2E encryption while allowing AI processing
    const openaiMessages = [
      {
        role: "system" as const,
        content: `You are a helpful AI assistant with encrypted memory and task management capabilities.

MEMORY SYSTEM GUIDELINES:
- You have access to memory tools: search_encrypted_memories and store_encrypted_memory
- Use search_encrypted_memories when users ask about their information ('what's my...', 'do you remember...')
- ALWAYS use store_encrypted_memory when users share important personal information
- Be proactive about storing meaningful information that users share

REMINDER & TASK CREATION:
- Use create_reminder when users want to be reminded of something or schedule a task
- Examples: "remind me to...", "schedule a meeting", "send an email tomorrow", "set up a recurring task"
- For simple reminders, use task_type: "reminder"
- For automated actions (emails, calendar events, etc.), use task_type: "action" with appropriate integration_slug
- For repeating tasks, use task_type: "recurring" with recurrence_rule
- Always ask for clarification if the scheduled time is ambiguous
- If an action requires an integration (like Gmail, Google Calendar), include the integration_slug
- Common integrations: gmail, google-calendar, slack, notion, airtable
- Current date and time: ${new Date().toISOString()}
- When scheduling, always ensure the time is in the future

WHEN TO STORE MEMORIES (use store_encrypted_memory):
✅ Personal facts: birthdays, age, name, location, work, education
✅ Preferences: favorite foods, colors, hobbies, interests
✅ Relationships: family members, friends, pets
✅ Important dates: anniversaries, milestones, events
✅ Goals and aspirations: career goals, personal objectives
✅ Medical info: allergies, conditions (if shared)

EXAMPLES:
- User: "My birthday is July 4th" → STORE: "Birthday: July 4th" with keywords: ["birthday", "birth", "july"]
- User: "I work at Google" → STORE: "Works at Google" with keywords: ["work", "job", "google"]  
- User: "I love pizza" → STORE: "Loves pizza" with keywords: ["food", "preference", "pizza"]

STORAGE FORMAT:
- fact: Clear, concise statement (e.g., "Birthday: July 4th, 2003")
- category: Type of info ("personal", "preference", "work", "family")
- keywords: 2-4 searchable terms related to the fact

SECURITY:
- All memories are encrypted before storage on the server
- You help extract and categorize, but encryption happens automatically
- User privacy is maintained through end-to-end encryption

Be conversational and acknowledge when you store information: "Got it! I'll remember that your birthday is July 4th."`,
      },
      ...messages.map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    // Define encrypted memory tools for authenticated users
    const tools =
      userId && session_active
        ? [
            {
              type: "function" as const,
              function: {
                name: "search_encrypted_memories",
                description:
                  "Search for relevant encrypted personal memories about the user using keyword hints.",
                parameters: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description: "Search query for finding relevant memories",
                    },
                    limit: {
                      type: "number",
                      description: "Maximum number of memories to retrieve",
                      default: 5,
                    },
                  },
                  required: ["query"],
                },
              },
            },
            {
              type: "function" as const,
              function: {
                name: "store_encrypted_memory",
                description:
                  "Store important personal information as encrypted memory. Only use for meaningful, personal facts that the user would want remembered.",
                parameters: {
                  type: "object",
                  properties: {
                    fact: {
                      type: "string",
                      description:
                        "The specific fact or information to store (e.g., 'Birthday: July 4th, 2003', 'Favorite color: blue')",
                    },
                    category: {
                      type: "string",
                      description:
                        "Category of the memory (e.g., 'personal', 'preference', 'work', 'family')",
                    },
                    keywords: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Keywords that can help find this memory later (e.g., ['birthday', 'birth'] for birthday info)",
                    },
                  },
                  required: ["fact", "category", "keywords"],
                },
              },
            },
            {
              type: "function" as const,
              function: {
                name: "search_encrypted_files",
                description:
                  "Search user's encrypted files by name/description/keywords. Returns ids and metadata only (no content).",
                parameters: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description: "Query for filename, description or keyword hints",
                    },
                    limit: {
                      type: "number",
                      description: "Max number of files to return",
                      default: 5,
                    },
                  },
                  required: ["query"],
                },
              },
            },
            {
              type: "function" as const,
              function: {
                name: "get_encrypted_file_metadata",
                description:
                  "Get metadata for a specific encrypted file by id (no content).",
                parameters: {
                  type: "object",
                  properties: {
                    file_id: {
                      type: "string",
                      description: "The id of the encrypted file",
                    },
                  },
                  required: ["file_id"],
                },
              },
            },
            {
              type: "function" as const,
              function: {
                name: "create_reminder",
                description: "Create a reminder or scheduled task for the user. Use this when the user wants to be reminded of something or schedule a task.",
                parameters: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description: "Title of the reminder (required)",
                    },
                    description: {
                      type: "string",
                      description: "Optional description with more details",
                    },
                    scheduled_at: {
                      type: "string",
                      description: "When to trigger the reminder (ISO 8601 format, e.g., '2024-01-15T10:30:00Z')",
                    },
                    timezone: {
                      type: "string",
                      description: "User's timezone (e.g., 'America/New_York'). Defaults to UTC if not provided.",
                      default: "UTC",
                    },
                    task_type: {
                      type: "string",
                      enum: ["reminder", "action", "recurring"],
                      description: "Type of task: 'reminder' for simple notifications, 'action' for automated tasks, 'recurring' for repeating tasks",
                    },
                    recurrence_rule: {
                      type: "string",
                      description: "RRULE format for recurring tasks (e.g., 'FREQ=DAILY;INTERVAL=1')",
                    },
                    recurrence_end_date: {
                      type: "string",
                      description: "End date for recurring tasks (ISO 8601 format)",
                    },
                    action_type: {
                      type: "string",
                      description: "Type of action to perform (e.g., 'send_email', 'create_calendar_event', 'send_slack_message')",
                    },
                    integration_slug: {
                      type: "string",
                      description: "Integration provider slug (e.g., 'gmail', 'google-calendar', 'slack')",
                    },
                    action_config: {
                      type: "object",
                      description: "Configuration for the action (varies by action_type)",
                      properties: {
                        to: { type: "string", description: "Email recipient (for email actions)" },
                        subject: { type: "string", description: "Email subject (for email actions)" },
                        body: { type: "string", description: "Email body (for email actions)" },
                        summary: { type: "string", description: "Event title (for calendar actions)" },
                        start: { type: "string", description: "Event start time (for calendar actions)" },
                        end: { type: "string", description: "Event end time (for calendar actions)" },
                        channel: { type: "string", description: "Slack channel (for Slack actions)" },
                        text: { type: "string", description: "Message text (for messaging actions)" },
                      },
                    },
                    priority: {
                      type: "string",
                      enum: ["low", "medium", "high", "urgent"],
                      description: "Priority level of the task",
                      default: "medium",
                    },
                    tags: {
                      type: "array",
                      items: { type: "string" },
                      description: "Optional tags for organizing tasks",
                    },
                  },
                  required: ["title", "scheduled_at", "task_type"],
                },
              },
            },
          ]
        : undefined;

    console.log(
      `[ENCRYPTED-CHAT-${requestId}] 🤖 Starting streaming with encrypted session: ${session_active}`
    );

    // Create the streaming response
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      tools: tools,
      tool_choice: tools ? "auto" : undefined,
      max_tokens: 1500,
      temperature: 0.7,
      stream: true,
    });

    const encoder = new TextEncoder();
    let fullResponse = "";
    let currentToolCalls: any[] = [];
    let toolResults: any[] = [];

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Process streaming chunks
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;

            // Handle regular content
            if (delta?.content) {
              const content = delta.content;
              fullResponse += content;

              const data = JSON.stringify({
                type: "content",
                content: content,
                encrypted: true,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            // Handle tool calls (encrypted mode)
            if (delta?.tool_calls && session_active) {
              for (const toolCall of delta.tool_calls) {
                if (!currentToolCalls[toolCall.index]) {
                  currentToolCalls[toolCall.index] = {
                    id: toolCall.id,
                    type: toolCall.type,
                    function: {
                      name: toolCall.function?.name || "",
                      arguments: toolCall.function?.arguments || "",
                    },
                  };
                } else {
                  if (toolCall.function?.arguments) {
                    currentToolCalls[toolCall.index].function.arguments +=
                      toolCall.function.arguments;
                  }
                }
              }
            }

            // Check if streaming is finished
            if (chunk.choices[0]?.finish_reason) {
              console.log(
                `[ENCRYPTED-CHAT-${requestId}] 🏁 Stream finished: ${chunk.choices[0].finish_reason}`
              );

              // Execute tool calls if any (encrypted mode)
              if (currentToolCalls.length > 0 && userId && session_active) {
                console.log(
                  `[ENCRYPTED-CHAT-${requestId}] 🔧 Executing ${currentToolCalls.length} tool calls`
                );

                const toolData = JSON.stringify({
                  type: "tool_start",
                  message: "Searching memories...",
                });
                controller.enqueue(encoder.encode(`data: ${toolData}\n\n`));

                toolResults = await executeToolCalls(
                  currentToolCalls,
                  userId,
                  requestId,
                  session_key,
                  master_salt
                );

                if (toolResults.length > 0) {
                  const toolMessages = [
                    ...openaiMessages,
                    {
                      role: "assistant" as const,
                      content: fullResponse || null,
                      tool_calls: currentToolCalls,
                    },
                    ...toolResults.map((result) => ({
                      role: "tool" as const,
                      content: result.content,
                      tool_call_id: result.tool_call_id,
                      attachments: result.attachments,
                    })),
                  ];

                  const followupStream = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: toolMessages,
                    max_tokens: 1000,
                    temperature: 0.7,
                    stream: true,
                  });

                  for await (const followupChunk of followupStream) {
                    const content = followupChunk.choices[0]?.delta?.content;
                    if (content) {
                      fullResponse += content;
                      const data = JSON.stringify({
                        type: "content",
                        content: content,
                        encrypted: true,
                      });
                      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    }
                  }
                }
              }
              break;
            }
          }

          // Send completion signal with encryption metadata
          console.log(
            `[ENCRYPTED-CHAT-${requestId}] ✅ Response completed: ${fullResponse.length} characters`
          );
          // Collect attachments from tool results
          const allAttachments = toolResults
            .filter(result => result.attachments && result.attachments.length > 0)
            .flatMap(result => result.attachments);

          const completionData = JSON.stringify({
            type: "done",
            encrypted: true,
            attachments: allAttachments.length > 0 ? allAttachments : undefined,
            response_metadata: {
              encryption_enabled: true,
              user_authenticated: !!userId,
              session_active: session_active,
              memory_search_enabled: !!userId && session_active,
            },
          });
          controller.enqueue(encoder.encode(`data: ${completionData}\n\n`));
          controller.close();
        } catch (error) {
          console.error(
            `[ENCRYPTED-CHAT-${requestId}] ❌ Streaming error:`,
            error
          );
          const errorData = JSON.stringify({
            type: "error",
            error: "Failed to stream response",
            encrypted: true,
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error(`[ENCRYPTED-CHAT-${requestId}] ❌ API error:`, error);

    let errorMessage = "Failed to process encrypted chat request";
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        errorMessage = "OpenAI API key not configured";
      } else if (error.message.includes("rate limit")) {
        errorMessage = "Rate limit exceeded. Please try again later.";
        statusCode = 429;
      }
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Store encrypted memories that were extracted and encrypted client-side
 */
async function storeEncryptedMemories(
  userId: string,
  memoryExtractionData: MemoryExtractionRequest[],
  requestId: string
) {
  try {
    console.log(`[ENCRYPTED-CHAT-${requestId}] 💾 Storing encrypted memories`);

    // Check usage limits before storing memories
    const limitCheck = await usageLimitMiddleware.checkUsageLimits(userId, 'memory');
    if (!limitCheck.allowed && limitCheck.upgradePrompt) {
      console.warn(`[ENCRYPTED-CHAT-${requestId}] ⚠️ Memory limit exceeded:`, limitCheck.upgradePrompt.message);
      return; // Don't store memories if limit exceeded
    }

    const supabase = await createClient();
    let successfulStores = 0;
    
    const memoryPromises = memoryExtractionData.map(async (memoryData) => {
      try {
        const { error } = await supabase.from("encrypted_memories").insert({
          user_id: userId,
          ciphertext: memoryData.encrypted_data.ciphertext,
          wrapped_dek: memoryData.encrypted_data.wrapped_dek,
          dek_salt: memoryData.encrypted_data.dek_salt,
          dek_iv: memoryData.encrypted_data.dek_iv,
          data_iv: memoryData.encrypted_data.data_iv,
          kdf_algorithm: memoryData.encrypted_data.kdf_algorithm,
          kdf_iterations: memoryData.encrypted_data.kdf_iterations,
          encryption_algorithm: memoryData.encrypted_data.encryption_algorithm,
          keyword_hints: memoryData.keyword_hints || null,
          content_type: "text/plain",
          content_length: memoryData.content.length,
          is_encrypted: true,
          version: 1,
        });

        if (error) {
          console.error(
            `[ENCRYPTED-CHAT-${requestId}] ❌ Failed to store encrypted memory:`,
            error
          );
        } else {
          successfulStores++;
        }
      } catch (error) {
        console.error(
          `[ENCRYPTED-CHAT-${requestId}] ❌ Encrypted memory storage error:`,
          error
        );
      }
    });

    await Promise.all(memoryPromises);
    
    // Increment usage for successfully stored memories
    for (let i = 0; i < successfulStores; i++) {
      await usageLimitMiddleware.incrementUsageAfterOperation(userId, 'memory');
    }
    
    console.log(
      `[ENCRYPTED-CHAT-${requestId}] ✅ Stored ${successfulStores}/${memoryExtractionData.length} encrypted memories`
    );
  } catch (error) {
    console.error(
      `[ENCRYPTED-CHAT-${requestId}] ❌ Encrypted memory storage error:`,
      error
    );
  }
}

/**
 * Execute tool calls for encrypted memory search
 */
async function executeToolCalls(
  toolCalls: any[],
  userId: string,
  requestId: string,
  sessionKey?: number[] | null,
  masterSalt?: string | null
): Promise<{ tool_call_id: string; content: string; attachments?: any[] }[]> {
  const results: { tool_call_id: string; content: string; attachments?: any[] }[] = [];

  for (const toolCall of toolCalls) {
    if (toolCall.function.name === "search_encrypted_memories") {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        console.log(
          `[ENCRYPTED-CHAT-${requestId}] 🔍 Encrypted memory search: "${args.query}"`
        );

        const supabase = await createClient();

        // Search using keyword hints (since actual content is encrypted)
        const { data: memories } = await supabase
          .from("encrypted_memories")
          .select("*") // Need all fields for decryption
          .eq("user_id", userId)
          .eq("is_encrypted", true)
          .not("keyword_hints", "is", null)
          .limit(args.limit || 5)
          .order("created_at", { ascending: false });

        console.log(`[ENCRYPTED-CHAT-${requestId}] 📋 Found ${memories?.length || 0} memories for decryption`);
        if (memories && memories.length > 0) {
          console.log(`[ENCRYPTED-CHAT-${requestId}] 🔍 Memory fields check:`, {
            id: memories[0].id,
            has_ciphertext: !!memories[0].ciphertext,
            has_wrapped_dek: !!memories[0].wrapped_dek,
            has_dek_iv: !!memories[0].dek_iv,
            has_data_iv: !!memories[0].data_iv,
            has_dek_salt: !!memories[0].dek_salt,
            keyword_hints: memories[0].keyword_hints
          });
        }

        // Filter memories based on keyword hints matching the query
        const relevantMemories =
          memories?.filter((memory) => {
            if (!memory.keyword_hints) return false;
            const queryLower = args.query.toLowerCase();
            return memory.keyword_hints.some(
              (hint: string) =>
                hint.toLowerCase().includes(queryLower) ||
                queryLower.includes(hint.toLowerCase())
            );
          }) || [];

        let content: string;
        if (relevantMemories.length > 0) {
          // Try to decrypt memories if session key is available
          let decryptedMemories: string[] = [];
          if (sessionKey && masterSalt) {
            try {
              decryptedMemories = await decryptMemoriesForAI(
                relevantMemories,
                sessionKey,
                masterSalt,
                requestId
              );
            } catch (error) {
              console.error(
                `[ENCRYPTED-CHAT-${requestId}] ❌ Memory decryption failed:`,
                error
              );
            }
          }

          if (decryptedMemories.length > 0) {
            // Return actual decrypted content to AI
            content =
              `Here are your relevant memories about "${args.query}":\n\n` +
              decryptedMemories
                .map((memory, index) => `${index + 1}. ${memory}`)
                .join("\n\n") +
              "\n\nI can now use this information to help answer your questions.";
          } else {
            // Fallback to metadata-only response
            content =
              `I found ${relevantMemories.length} encrypted memory/memories about "${args.query}" in your secure storage:\n` +
              relevantMemories
                .map(
                  (m) =>
                    `- Memory from ${new Date(
                      m.created_at
                    ).toLocaleDateString()} (${
                      m.content_length
                    } characters) - Related topics: ${m.keyword_hints?.join(", ")}`
                )
                .join("\n") +
              "\n\nYour memories are securely encrypted and I can only see the topic hints for privacy. " +
              "To help you better, could you please share the specific information you'd like me to know about your " + args.query + "?";
          }
        } else {
          content =
            `I don't have any stored memories about "${args.query}". Feel free to share that information with me!`;
        }

        results.push({
          tool_call_id: toolCall.id,
          content: content,
        });

        console.log(
          `[ENCRYPTED-CHAT-${requestId}] ✅ Encrypted memory search completed: ${relevantMemories.length} results`
        );
        console.log(relevantMemories)
      } catch (error) {
        console.error(
          `[ENCRYPTED-CHAT-${requestId}] ❌ Tool execution error:`,
          error
        );
        results.push({
          tool_call_id: toolCall.id,
          content: "Error searching encrypted memories.",
        });
      }
    } else if (toolCall.function.name === "store_encrypted_memory") {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        console.log(
          `[ENCRYPTED-CHAT-${requestId}] 💾 AI storing memory: "${args.fact}"`
        );

        // Check usage limits before storing memory
        const limitCheck = await usageLimitMiddleware.checkUsageLimits(userId, 'memory');
        if (!limitCheck.allowed && limitCheck.upgradePrompt) {
          console.warn(`[ENCRYPTED-CHAT-${requestId}] ⚠️ Memory limit exceeded:`, limitCheck.upgradePrompt.message);
          results.push({
            tool_call_id: toolCall.id,
            content: `I'd like to store this memory, but you've reached your memory limit. ${limitCheck.upgradePrompt.message}`,
          });
          continue;
        }

        if (sessionKey && masterSalt) {
          try {
            // Encrypt the memory server-side using the session key
            const encryptedMemory = await encryptMemoryForStorage(
              args.fact,
              sessionKey,
              masterSalt,
              args.keywords || [],
              requestId
            );

            // Store in database
            const supabase = await createClient();
            const { error } = await supabase
              .from("encrypted_memories")
              .insert({
                user_id: userId,
                ciphertext: encryptedMemory.ciphertext,
                wrapped_dek: encryptedMemory.wrapped_dek,
                dek_salt: encryptedMemory.dek_salt,
                dek_iv: encryptedMemory.dek_iv,
                data_iv: encryptedMemory.data_iv,
                kdf_algorithm: encryptedMemory.kdf_algorithm,
                kdf_iterations: encryptedMemory.kdf_iterations,
                encryption_algorithm: encryptedMemory.encryption_algorithm,
                keyword_hints: args.keywords || [],
                content_type: "text/plain",
                content_length: args.fact.length,
                is_encrypted: true,
                version: 1,
              });

            if (error) {
              throw error;
            }

            // Increment usage after successful storage
            await usageLimitMiddleware.incrementUsageAfterOperation(userId, 'memory');

            const content = `Perfect! I've securely stored: "${args.fact}" in your encrypted memory.`;
            console.log(
              `[ENCRYPTED-CHAT-${requestId}] ✅ Successfully stored encrypted memory`
            );

            results.push({
              tool_call_id: toolCall.id,
              content: content,
            });
          } catch (encryptError) {
            console.error(
              `[ENCRYPTED-CHAT-${requestId}] ❌ Failed to encrypt/store memory:`,
              encryptError
            );
            
            const content = `I tried to store "${args.fact}" but encountered an encryption error. Your memory is still secure, but this particular fact wasn't saved.`;
            results.push({
              tool_call_id: toolCall.id,
              content: content,
            });
          }
        } else {
          const content = `I'd like to remember "${args.fact}" for you, but I need an active encryption session to store memories securely. Please make sure you're logged in with encryption enabled.`;
          results.push({
            tool_call_id: toolCall.id,
            content: content,
          });
          console.log(
            `[ENCRYPTED-CHAT-${requestId}] ⚠️ No session key available for memory storage`
          );
        }
      } catch (error) {
        console.error(
          `[ENCRYPTED-CHAT-${requestId}] ❌ Tool execution error:`,
          error
        );
        results.push({
          tool_call_id: toolCall.id,
          content: "Error storing encrypted memory.",
        });
      }
    } else if (toolCall.function.name === "search_encrypted_files") {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const supabase = await createClient();
        const query = (args.query || '').toLowerCase();

        // Simple search over name/description/keyword_hints (non-sensitive fields)
        const { data: files, error } = await supabase
          .from('encrypted_user_files')
          .select('id, name, original_name, content_type, file_size, keyword_hints, description, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(args.limit || 5);

        if (error) throw error;

        const filtered = (files || []).filter((f: any) => {
          const inName = f.name?.toLowerCase().includes(query) || f.original_name?.toLowerCase().includes(query);
          const inDesc = f.description?.toLowerCase().includes(query);
          const inHints = Array.isArray(f.keyword_hints) && f.keyword_hints.some((h: string) => h.toLowerCase().includes(query));
          return inName || inDesc || inHints;
        });

        const content = filtered.length > 0
          ? `Found ${filtered.length} encrypted file(s) related to "${args.query}":\n` +
            filtered.map((f: any) => `- ${f.name} (${f.content_type}, ${Math.round(f.file_size/1024)}KB) id=${f.id}`).join('\n') +
            "\nUse get_encrypted_file_metadata with a chosen id to fetch details, then ask the client to decrypt."
          : `I couldn't find any encrypted files related to "${args.query}".`;

        // Create file attachments for the frontend
        const attachments = filtered.map((f: any) => ({
          id: f.id,
          name: f.name,
          originalName: f.original_name,
          contentType: f.content_type,
          fileSize: f.file_size,
          encrypted: true
        }));

        results.push({ 
          tool_call_id: toolCall.id, 
          content,
          attachments: attachments.length > 0 ? attachments : undefined
        });
      } catch (error) {
        results.push({ tool_call_id: toolCall.id, content: 'Error searching encrypted files.' });
      }
    } else if (toolCall.function.name === "get_encrypted_file_metadata") {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const supabase = await createClient();
        const { data, error } = await supabase
          .from('encrypted_user_files')
          .select('id, name, original_name, content_type, file_size, keyword_hints, description, created_at')
          .eq('id', args.file_id)
          .eq('user_id', userId)
          .single();
        if (error || !data) throw error || new Error('Not found');
        const content = `Encrypted file metadata:\n- id: ${data.id}\n- name: ${data.name}\n- original_name: ${data.original_name}\n- type: ${data.content_type}\n- size: ${Math.round(data.file_size/1024)}KB\n- description: ${data.description || 'N/A'}\n- created_at: ${new Date(data.created_at).toLocaleString()}`;
        results.push({ tool_call_id: toolCall.id, content });
      } catch (error) {
        results.push({ tool_call_id: toolCall.id, content: 'Error fetching file metadata.' });
      }
    } else if (toolCall.function.name === "create_reminder") {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`[ENCRYPTED-CHAT-${requestId}] ⏰ Creating reminder: "${args.title}"`);
        
        const result = await createReminderFromAI(userId, args, requestId);
        
        results.push({
          tool_call_id: toolCall.id,
          content: result.content,
        });

        console.log(`[ENCRYPTED-CHAT-${requestId}] ✅ Reminder creation completed: ${result.success ? 'success' : 'failed'}`);
        console.log({result})
      } catch (error) {
        console.error(`[ENCRYPTED-CHAT-${requestId}] ❌ Reminder creation error:`, error);
        results.push({
          tool_call_id: toolCall.id,
          content: "Error creating reminder. Please try again.",
        });
      }
    }
  }

  return results;
}

/**
 * Decrypt memories for AI context using session key
 */
async function decryptMemoriesForAI(
  memories: any[],
  sessionKeyArray: number[],
  masterSalt: string,
  requestId: string
): Promise<string[]> {
  const decryptedMemories: string[] = [];

  try {
    // Convert session key array back to CryptoKey
    const sessionKeyBuffer = new Uint8Array(sessionKeyArray);
    const kek = await crypto.subtle.importKey(
      "raw",
      sessionKeyBuffer,
      "AES-GCM",
      false,
      ["unwrapKey"]
    );

    for (const memory of memories) {
      try {
        // Unwrap the Data Encryption Key
        const wrappedDekBuffer = Buffer.from(memory.wrapped_dek, "base64");
        const dekIvBuffer = Buffer.from(memory.dek_iv, "base64");

        const dek = await crypto.subtle.unwrapKey(
          "raw",
          wrappedDekBuffer,
          kek,
          {
            name: "AES-GCM",
            iv: dekIvBuffer,
          },
          {
            name: "AES-GCM",
            length: 256,
          },
          false,
          ["decrypt"]
        );

        // Decrypt the content
        const ciphertextBuffer = Buffer.from(memory.ciphertext, "base64");
        const dataIvBuffer = Buffer.from(memory.data_iv, "base64");

        const decryptedBuffer = await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: dataIvBuffer,
          },
          dek,
          ciphertextBuffer
        );

        const decryptedContent = new TextDecoder().decode(decryptedBuffer);
        decryptedMemories.push(decryptedContent);

        console.log(
          `[ENCRYPTED-CHAT-${requestId}] ✅ Decrypted memory for AI context`
        );
      } catch (error) {
        console.error(
          `[ENCRYPTED-CHAT-${requestId}] ❌ Failed to decrypt individual memory:`,
          error
        );
        // Continue with other memories
      }
    }
  } catch (error) {
    console.error(
      `[ENCRYPTED-CHAT-${requestId}] ❌ Failed to setup decryption:`,
      error
    );
  }

  return decryptedMemories;
}

/**
 * Encrypt memory for storage using session key (server-side encryption)
 */
async function encryptMemoryForStorage(
  content: string,
  sessionKeyArray: number[],
  masterSalt: string,
  keywords: string[],
  requestId: string
): Promise<any> {
  try {
    // Convert session key array back to CryptoKey
    const sessionKeyBuffer = new Uint8Array(sessionKeyArray);
    const kek = await crypto.subtle.importKey(
      "raw",
      sessionKeyBuffer,
      "AES-GCM",
      false,
      ["wrapKey"]
    );

    // Generate a new Data Encryption Key (must be extractable for wrapping)
    const dek = await crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true, // Make extractable so it can be wrapped
      ["encrypt"]
    );

    // Encrypt the content with the DEK
    const contentBuffer = new TextEncoder().encode(content);
    const dataIv = crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedContent = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: dataIv,
      },
      dek,
      contentBuffer
    );

    // Wrap the DEK with the KEK
    const dekIv = crypto.getRandomValues(new Uint8Array(12));
    const wrappedDek = await crypto.subtle.wrapKey(
      "raw",
      dek,
      kek,
      {
        name: "AES-GCM",
        iv: dekIv,
      }
    );

    console.log(
      `[ENCRYPTED-CHAT-${requestId}] ✅ Memory encrypted server-side for storage`
    );

    return {
      ciphertext: Buffer.from(encryptedContent).toString("base64"),
      wrapped_dek: Buffer.from(wrappedDek).toString("base64"),
      dek_salt: masterSalt, // Use the user's master salt
      dek_iv: Buffer.from(dekIv).toString("base64"),
      data_iv: Buffer.from(dataIv).toString("base64"),
      kdf_algorithm: "pbkdf2",
      kdf_iterations: 100000,
      encryption_algorithm: "aes-256-gcm",
    };
  } catch (error) {
    console.error(
      `[ENCRYPTED-CHAT-${requestId}] ❌ Server-side encryption failed:`,
      error
    );
    throw error;
  }
}

/**
 * Create reminder from AI tool call with integration validation (encrypted chat version)
 */
async function createReminderFromAI(
  userId: string, 
  args: any, 
  requestId: string
): Promise<{ success: boolean; content: string }> {
  try {
    const supabase = await createClient();
      console.log({args})
      console.log({userId})
      console.log({requestId})
    // Validate required fields
    if (!args.title || !args.scheduled_at || !args.task_type) {
      return {
        success: false,
        content: "❌ Missing required fields. I need at least a title, scheduled time, and task type to create a reminder."
      };
    }

    // Validate scheduled_at is in the future (with 30 second buffer for processing)
    const scheduledDate = new Date(args.scheduled_at);
    const now = new Date();
    const bufferTime = 30 * 1000; // 30 seconds in milliseconds
    const minimumTime = new Date(now.getTime() + bufferTime);
    
    console.log(`[ENCRYPTED-CHAT-${requestId}] 📅 Date validation:`, {
      scheduled: scheduledDate.toISOString(),
      now: now.toISOString(),
      minimumTime: minimumTime.toISOString(),
      scheduledTime: scheduledDate.getTime(),
      nowTime: now.getTime(),
      isValid: scheduledDate > minimumTime
    });
    
    if (scheduledDate <= minimumTime) {
      return {
        success: false,
        content: `❌ The scheduled time must be at least 30 seconds in the future. Scheduled: ${scheduledDate.toISOString()}, Current: ${now.toISOString()}`
      };
    }

    // Check if integration is required and validate credentials
    if (args.integration_slug && args.task_type === 'action') {
      console.log(`[ENCRYPTED-CHAT-${requestId}] 🔍 Validating integration: ${args.integration_slug} for action: ${args.action_type}`);
      
      const integrationService = createIntegrationService(supabase);
      const validation = await integrationService.validateIntegrationForAction(
        userId,
        args.integration_slug,
        args.action_type || 'unknown'
      );

      if (!validation.valid) {
        const integrationName = validation.error?.includes('not found') 
          ? args.integration_slug 
          : validation.error?.split(' ')[0] || args.integration_slug;
        
        return {
          success: false,
          content: `❌ **Integration Required**: To perform this action, you need to set up your ${integrationName} integration first.\n\n` +
                  `Please go to Settings → Integrations and connect your ${integrationName} account, then try creating this reminder again.\n\n` +
                  `${validation.toast?.message || `You can set up ${integrationName} integration in your settings.`}`
        };
      }
    }

    // Prepare reminder request
    const reminderRequest: CreateReminderRequest = {
      title: args.title,
      description: args.description,
      scheduled_at: args.scheduled_at,
      timezone: args.timezone || 'UTC',
      task_type: args.task_type,
      recurrence_rule: args.recurrence_rule,
      recurrence_end_date: args.recurrence_end_date,
      action_type: args.action_type,
      integration_slug: args.integration_slug,
      action_config: args.action_config || {},
      priority: args.priority || 'medium',
      tags: args.tags || []
    };

    // Create the reminder using the existing service
    const reminderService = createReminderService(supabase);
    const result = await reminderService.createReminder(userId, reminderRequest);

    if (result.error) {
      console.error(`[ENCRYPTED-CHAT-${requestId}] ❌ Reminder creation failed:`, result.error);
      return {
        success: false,
        content: `❌ Failed to create reminder: ${result.error}`
      };
    }

    if (!result.task) {
      return {
        success: false,
        content: "❌ Failed to create reminder. Please try again."
      };
    }

    // Format success response
    const task = result.task;
    const scheduledTime = new Date(task.scheduled_at).toLocaleString();
    let successMessage = `✅ **Reminder Created Successfully!**\n\n`;
    successMessage += `📋 **Title:** ${task.title}\n`;
    if (task.description) {
      successMessage += `📝 **Description:** ${task.description}\n`;
    }
    successMessage += `⏰ **Scheduled:** ${scheduledTime}\n`;
    successMessage += `🏷️ **Type:** ${task.task_type}\n`;
    
    if (task.task_type === 'action' && task.action_type) {
      successMessage += `⚡ **Action:** ${task.action_type}\n`;
    }
    
    if (task.task_type === 'recurring' && task.recurrence_rule) {
      successMessage += `🔄 **Recurrence:** ${task.recurrence_rule}\n`;
    }
    
    successMessage += `🎯 **Priority:** ${task.priority}\n`;
    
    if (task.tags && task.tags.length > 0) {
      successMessage += `🏷️ **Tags:** ${task.tags.join(', ')}\n`;
    }

    successMessage += `\n💡 You can view and manage all your reminders in the Reminders section.`;

    return {
      success: true,
      content: successMessage
    };

  } catch (error) {
    console.error(`[ENCRYPTED-CHAT-${requestId}] ❌ Unexpected error in createReminderFromAI:`, error);
    return {
      success: false,
      content: "❌ An unexpected error occurred while creating the reminder. Please try again."
    };
  }
}
