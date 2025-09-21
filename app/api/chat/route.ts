// chat API
import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  searchMemories,
  formatMemoriesForContext,
  addMemory,
} from "@/lib/memory";
import { addMemoryWithLimits } from "@/lib/memory-with-usage-enforcement";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Check if extracted facts contain confidential information
 */
function containsConfidentialInfo(facts: string[]): boolean {
  const confidentialKeywords = [
    "password", "pin", "pwd", "pass", "secret", "key", "token",
    "bank", "account", "card", "credit", "debit", "ssn", "social security",
    "medical", "health", "insurance", "salary", "wage", "income",
    "confidential", "private", "sensitive", "classified",
  ];

  return facts.some((fact) =>
    confidentialKeywords.some((keyword) => fact.toLowerCase().includes(keyword))
  );
}

/**
 * Extract new information from user messages (single AI call)
 */
async function extractNewInformation(userMessage: string): Promise<string[]> {
  const extractId = Math.random().toString(36).substring(7);
  console.log(
    `[EXTRACT-${extractId}] 🔍 Extracting new information from: "${userMessage.substring(0, 100)}..."`
  );

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Extract ALL memorable information from user messages as a JSON array of strings.
          Include: personal preferences, dates, relationships, goals, hobbies, work info, 
          sensitive data (passwords, accounts, etc.), URLs, gifts, and any personal details.
          
          Return ONLY a JSON array. If no information found, return [].
          Example: ["My birthday is March 15th", "My password is MySecret123"]`,
        },
        { role: "user", content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    try {
      const extractedFacts = JSON.parse(content);
      return Array.isArray(extractedFacts) ? extractedFacts : [];
    } catch {
      // Fallback: parse as text if JSON fails
      const lines = content.split("\n").filter((line) => line.trim());
      return lines
        .map((line) => line.replace(/^[-•]\s*/, "").trim())
        .filter((line) => line.length > 0);
    }
  } catch (error) {
    console.error(`[EXTRACT-${extractId}] ❌ Error:`, error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] 🚀 Chat request started`);

  try {
    const { messages } = await request.json();
    console.log(`[${requestId}] 📝 Received ${messages.length} messages`);

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get user authentication
    let userId: string | null = null;
    let hasConfidentialInfo = false;

    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        userId = user.id;
        console.log(`[${requestId}] ✅ User authenticated: ${user.id}`);

        // Extract and store new information from latest user message
        const latestUserMessage = messages
          .filter((msg: any) => msg.role === "user")
          .pop();

        if (latestUserMessage) {
          const newFacts = await extractNewInformation(latestUserMessage.content);
          if (newFacts.length > 0) {
            console.log(`[${requestId}] 💡 Extracted ${newFacts.length} new facts`);
            
            hasConfidentialInfo = containsConfidentialInfo(newFacts);
            
            // Store memories with usage limit enforcement
            const memoryPromises = newFacts.map(async (fact) => {
              try {
                const result = await addMemoryWithLimits(user.id, fact, true);
                if (!result.success) {
                  if (result.upgradePrompt) {
                    console.warn(`[${requestId}] ⚠️ Memory limit exceeded for user ${user.id}:`, result.upgradePrompt.message);
                    // Continue with chat but don't store the memory
                    return { success: false, upgradePrompt: result.upgradePrompt };
                  } else {
                    console.error(`[${requestId}] ❌ Failed to store memory:`, result.error);
                    return { success: false, error: result.error };
                  }
                }
                return { success: true, memoryId: result.data?.memoryId };
              } catch (error) {
                console.error(`[${requestId}] ❌ Memory storage error:`, error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
              }
            });
            
            const results = await Promise.all(memoryPromises);
            const successfulStores = results.filter(r => r.success).length;
            const upgradePrompts = results.filter(r => r.upgradePrompt).map(r => r.upgradePrompt);
            
            console.log(`[${requestId}] ✅ Stored ${successfulStores}/${newFacts.length} memories`);
            
            if (upgradePrompts.length > 0) {
              console.warn(`[${requestId}] ⚠️ ${upgradePrompts.length} memories could not be stored due to usage limits`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`[${requestId}] ❌ Auth/Memory error:`, error);
    }

    // Define memory search tool
    const tools = [
      {
        type: "function" as const,
        function: {
          name: "search_memories",
          description: "Search for relevant personal memories about the user.",
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
    ];

    // Prepare messages for OpenAI
    const openaiMessages = [
      {
        role: "system" as const,
        content: `You are a helpful AI assistant with memory capabilities. 
        
MEMORY USAGE:
- Use search_memories when users ask about themselves or their information
- When users share new info, it's automatically stored
- Use search_memories for questions like 'what did I tell you about...', 'what's my...', 'do you remember...'

Be conversational, helpful, and natural in your responses.`,
      },
      ...messages.map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    console.log(`[${requestId}] 🤖 Starting real-time streaming with tool support`);

    // Create the actual streaming response with tool support
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      tools: userId ? tools : undefined, // Only provide tools for authenticated users
      tool_choice: userId ? "auto" : undefined,
      max_tokens: 1500,
      temperature: 0.7,
      stream: true,
    });

    const encoder = new TextEncoder();
    let fullResponse = "";
    let currentToolCalls: any[] = [];
    let toolCallsCompleted = false;

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
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            // Handle tool calls
            if (delta?.tool_calls) {
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
                  // Append to existing tool call
                  if (toolCall.function?.arguments) {
                    currentToolCalls[toolCall.index].function.arguments += 
                      toolCall.function.arguments;
                  }
                }
              }
            }

            // Check if streaming is finished
            if (chunk.choices[0]?.finish_reason) {
              console.log(`[${requestId}] 🏁 Stream finished: ${chunk.choices[0].finish_reason}`);
              
              // Execute tool calls if any
              if (currentToolCalls.length > 0 && userId) {
                console.log(`[${requestId}] 🔧 Executing ${currentToolCalls.length} tool calls`);
                
                // Notify UI about tool execution
                const toolData = JSON.stringify({
                  type: "tool_start",
                  message: "Searching memories...",
                });
                controller.enqueue(encoder.encode(`data: ${toolData}\n\n`));

                // Execute tools and continue streaming
                const toolResults = await executeToolCalls(currentToolCalls, userId, requestId);
                
                if (toolResults.length > 0) {
                  // Create new messages with tool results
                  const toolMessages = [
                    ...openaiMessages,
                    {
                      role: "assistant" as const,
                      content: fullResponse || null,
                      tool_calls: currentToolCalls,
                    },
                    ...toolResults.map(result => ({
                      role: "tool" as const,
                      content: result.content,
                      tool_call_id: result.tool_call_id,
                    })),
                  ];

                  // Continue streaming with tool results
                  const followupStream = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: toolMessages,
                    max_tokens: 1000,
                    temperature: 0.7,
                    stream: true,
                  });

                  // Stream the follow-up response
                  for await (const followupChunk of followupStream) {
                    const content = followupChunk.choices[0]?.delta?.content;
                    if (content) {
                      fullResponse += content;
                      const data = JSON.stringify({
                        type: "content",
                        content: content,
                      });
                      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    }
                  }
                }
              }
              break;
            }
          }

          // Add confidential info warning if needed
          if (hasConfidentialInfo) {
            const warningContent = "\n\n⚠️ **Warning**: I've stored confidential information you shared. Please be cautious about sharing sensitive data.";
            fullResponse += warningContent;
            
            const warningData = JSON.stringify({
              type: "content",
              content: warningContent,
            });
            controller.enqueue(encoder.encode(`data: ${warningData}\n\n`));
          }

          // Send completion signal
          console.log(`[${requestId}] ✅ Response completed: ${fullResponse.length} characters`);
          const completionData = JSON.stringify({ type: "done" });
          controller.enqueue(encoder.encode(`data: ${completionData}\n\n`));
          controller.close();

        } catch (error) {
          console.error(`[${requestId}] ❌ Streaming error:`, error);
          const errorData = JSON.stringify({
            type: "error",
            error: "Failed to stream response",
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
    console.error(`[${requestId}] ❌ API error:`, error);
    
    let errorMessage = "Failed to process chat request";
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
 * Execute tool calls and return results
 */
async function executeToolCalls(
  toolCalls: any[], 
  userId: string, 
  requestId: string
): Promise<{ tool_call_id: string; content: string }[]> {
  const results: { tool_call_id: string; content: string }[] = [];

  for (const toolCall of toolCalls) {
    if (toolCall.function.name === "search_memories") {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`[${requestId}] 🔍 Memory search: "${args.query}"`);
        
        const memoryResult = await searchMemories(userId, args.query, {
          threshold: 0.3,
          limit: args.limit || 5,
          enableTextSearch: false,
        });

        const content = memoryResult.memories.length > 0
          ? formatMemoriesForContext(memoryResult.memories)
          : "No relevant memories found.";

        results.push({
          tool_call_id: toolCall.id,
          content: content,
        });

        console.log(`[${requestId}] ✅ Memory search completed: ${memoryResult.memories.length} results`);
      } catch (error) {
        console.error(`[${requestId}] ❌ Tool execution error:`, error);
        results.push({
          tool_call_id: toolCall.id,
          content: "Error searching memories.",
        });
      }
    }
  }

  return results;
}