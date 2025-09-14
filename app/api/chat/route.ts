import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  searchMemories,
  formatMemoriesForContext,
  addMemory,
} from "@/lib/memory";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Check if extracted facts contain confidential information
 */
function containsConfidentialInfo(facts: string[]): boolean {
  const confidentialKeywords = [
    "password",
    "pin",
    "pwd",
    "pass",
    "secret",
    "key",
    "token",
    "bank",
    "account",
    "card",
    "credit",
    "debit",
    "ssn",
    "social security",
    "medical",
    "health",
    "insurance",
    "salary",
    "wage",
    "income",
    "confidential",
    "private",
    "sensitive",
    "classified",
  ];

  return facts.some((fact) =>
    confidentialKeywords.some((keyword) => fact.toLowerCase().includes(keyword))
  );
}

/**
 * Extract new information from user messages that should be stored as memories
 */
async function extractNewInformation(userMessage: string): Promise<string[]> {
  const extractId = Math.random().toString(36).substring(7);
  console.log(
    `[EXTRACT-${extractId}] 🔍 Extracting new information from: "${userMessage.substring(
      0,
      100
    )}..."`
  );

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an AI that extracts new, memorable information from user messages. 
          Extract ALL facts that would be useful to remember about the user, including:
          - Personal preferences (favorite foods, colors, activities)
          - Important dates (birthdays, anniversaries, appointments)
          - Relationships (family members, friends, colleagues)
          - Goals and aspirations
          - Personal details (hobbies, interests, skills)
          - Important events or experiences
          - Sensitive information (passwords, PINs, account details, etc.)
          - Work information (company, position, salary, etc.)
          - Financial information (bank accounts, credit cards, etc.)
          - Medical information (conditions, medications, etc.)
          - Links, URLs, and web resources the user wants to remember
          - Gifts, presents, or items for specific people
          - Any other personal data the user shares
          
          IMPORTANT: Extract ALL information the user provides, regardless of sensitivity level.
          Do not filter out confidential or sensitive information.
          Include URLs, links, and any resources the user mentions.
          Include information about gifts or items for other people.
          
          Return ONLY the extracted facts as a JSON array of strings. 
          If no memorable information is found, return an empty array.
          Each fact should be concise but complete enough to be useful later.
          
          Example: ["My birthday is on March 15th", "My password is MySecret123", "I work at Google as a software engineer", "My bank account number is 123456789"]`,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.log(
        `[EXTRACT-${extractId}] ⚠️ No content returned from extraction AI`
      );
      return [];
    }

    console.log(
      `[EXTRACT-${extractId}] 📝 Raw extraction response: ${content.substring(
        0,
        200
      )}...`
    );

    try {
      const extractedFacts = JSON.parse(content);
      if (Array.isArray(extractedFacts)) {
        console.log(
          `[EXTRACT-${extractId}] ✅ Successfully extracted ${extractedFacts.length} facts:`,
          extractedFacts
        );
        return extractedFacts;
      } else {
        console.log(
          `[EXTRACT-${extractId}] ⚠️ Response is not an array, trying text parsing`
        );
        const lines = content.split("\n").filter((line) => line.trim());
        const facts = lines
          .map((line) => line.replace(/^[-•]\s*/, "").trim())
          .filter((line) => line.length > 0);
        console.log(
          `[EXTRACT-${extractId}] 📝 Parsed ${facts.length} facts from text:`,
          facts
        );
        return facts;
      }
    } catch (parseError) {
      console.log(
        `[EXTRACT-${extractId}] ⚠️ JSON parsing failed, trying text parsing:`,
        parseError
      );
      // If JSON parsing fails, try to extract facts from plain text
      const lines = content.split("\n").filter((line) => line.trim());
      const facts = lines
        .map((line) => line.replace(/^[-•]\s*/, "").trim())
        .filter((line) => line.length > 0);
      console.log(
        `[EXTRACT-${extractId}] 📝 Parsed ${facts.length} facts from text:`,
        facts
      );
      return facts;
    }
  } catch (error) {
    console.error(
      `[EXTRACT-${extractId}] ❌ Error extracting new information:`,
      error
    );
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
      console.log(`[${requestId}] ❌ Invalid messages format`);
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get user ID for memory operations
    let userId: string | null = null;
    try {
      console.log(`[${requestId}] 🔐 Getting user authentication`);
      const supabase = await createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!userError && user) {
        userId = user.id;
        console.log(`[${requestId}] ✅ User authenticated: ${user.id}`);

        // Extract and store new information from user messages
        const latestUserMessage = messages
          .filter((msg: any) => msg.role === "user")
          .pop();

        if (latestUserMessage) {
          console.log(
            `[${requestId}] 🔍 Extracting new information from: "${latestUserMessage.content.substring(
              0,
              50
            )}..."`
          );
          const newFacts = await extractNewInformation(
            latestUserMessage.content
          );
          if (newFacts.length > 0) {
            console.log(
              `[${requestId}] 💡 Extracted ${newFacts.length} new facts:`,
              newFacts
            );

            // Check if any facts contain confidential information
            const hasConfidentialInfo = containsConfidentialInfo(newFacts);
            if (hasConfidentialInfo) {
              console.log(
                `[${requestId}] ⚠️ Confidential information detected in extracted facts`
              );
            }

            // Store each new fact as a memory
            for (const fact of newFacts) {
              try {
                console.log(`[${requestId}] 💾 Storing memory: "${fact}"`);
                const result = await addMemory(user.id, fact, true);
                if (result.success) {
                  console.log(
                    `[${requestId}] ✅ Memory stored successfully: ${result.memoryId}`
                  );
                } else {
                  console.error(
                    `[${requestId}] ❌ Failed to store memory:`,
                    result.error
                  );
                }
              } catch (error) {
                console.error(
                  `[${requestId}] ❌ Error storing individual memory:`,
                  error
                );
              }
            }
          } else {
            console.log(
              `[${requestId}] ℹ️ No new facts extracted from user message`
            );
          }
        }
      } else {
        console.log(
          `[${requestId}] ⚠️ User not authenticated:`,
          userError?.message
        );
      }
    } catch (memoryError) {
      console.error(`[${requestId}] ❌ Memory processing error:`, memoryError);
    }

    // Define the memory search tool for OpenAI function calling
    const tools = [
      {
        type: "function" as const,
        function: {
          name: "search_memories",
          description:
            "Search for relevant personal memories about the user. Use this when you need personalized information, user preferences, important dates, relationships, or any other personal details that might be stored in the user's memory database.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "The search query to find relevant memories. Be specific about what you're looking for (e.g., 'birthday', 'favorite food', 'family members', 'work preferences').",
              },
              limit: {
                type: "number",
                description:
                  "Maximum number of memories to retrieve (default: 5)",
                default: 5,
              },
            },
            required: ["query"],
          },
        },
      },
    ];

    // Convert our message format to OpenAI format
    const openaiMessages = [
      {
        role: "system",
        content:
          "You are a personal memory assistant with two main functions:\n\n" +
          "1. FETCH: When users ask questions or want to know something about themselves, use the search_memories tool to retrieve relevant information from their personal memory database.\n\n" +
          "2. STORE: When users provide new information about themselves, automatically extract and store it as a memory.\n\n" +
          "INTENT IDENTIFICATION PRINCIPLES:\n" +
          "- FETCH: User is asking for information they want to know (questions, requests for details)\n" +
          "- STORE: User is providing information they want you to remember (statements, sharing details)\n\n" +
          "KEY BEHAVIORS:\n" +
          "- When retrieving information: ALWAYS provide the exact information you found in search results\n" +
          "- When storing information: Extract ALL facts the user shares, including URLs, passwords, personal details, and any data they want remembered\n" +
          "- For confidential information: Store it but warn the user about sharing sensitive data\n" +
          "- Use search_memories tool ONLY for FETCH operations, never for STORE operations\n\n" +
          "EXAMPLES (for guidance only):\n" +
          "- FETCH: 'whats my password?' → search_memories\n" +
          "- STORE: 'my password is abc123' → extract and store\n\n" +
          "Use your judgment to determine user intent based on context and natural language patterns.",
      },
      ...messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    // First, get the response with potential tool calls
    console.log(
      `[${requestId}] 🤖 Sending request to OpenAI with ${openaiMessages.length} messages`
    );
    const initialResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      tools: tools,
      tool_choice: "auto",
      max_tokens: 1000,
      temperature: 0.7,
    });

    let finalMessages = [...openaiMessages];
    let responseContent = "";

    // Check if the AI wants to call a tool
    if (initialResponse.choices[0]?.message?.tool_calls) {
      const toolCall = initialResponse.choices[0].message.tool_calls[0];
      console.log(
        `[${requestId}] 🔧 AI wants to call tool: ${
          toolCall.type === "function" ? toolCall.function.name : "unknown"
        }`
      );

      if (
        toolCall.type === "function" &&
        toolCall.function.name === "search_memories" &&
        userId
      ) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          console.log(
            `[${requestId}] 🔍 Memory search requested - Query: "${
              args.query
            }", Limit: ${args.limit || 5}`
          );

          const memoryResult = await searchMemories(userId, args.query, {
            threshold: 0.3,
            limit: args.limit || 5,
            enableTextSearch: false,
          });

          console.log(
            `[${requestId}] 📊 Memory search results: ${memoryResult.memories.length} memories found using ${memoryResult.search_method} search`
          );

          // Add the tool call and result to the conversation
          finalMessages.push({
            role: "assistant",
            content: null,
            tool_calls: [toolCall],
          } as any);

          const toolResponse =
            memoryResult.memories.length > 0
              ? formatMemoriesForContext(memoryResult.memories)
              : "No relevant memories found.";

          console.log(
            `[${requestId}] 📝 Tool response: ${toolResponse.substring(
              0,
              100
            )}...`
          );

          finalMessages.push({
            role: "tool",
            content: toolResponse,
            tool_call_id: toolCall.id,
          } as any);

          // Get the final response with memory context
          console.log(
            `[${requestId}] 🤖 Getting final response with memory context`
          );
          console.log(
            `[${requestId}] 📋 Final messages for AI:`,
            finalMessages.map((msg) => ({
              role: msg.role,
              content:
                msg.content?.substring(0, 100) +
                (msg.content?.length > 100 ? "..." : ""),
              tool_calls: (msg as any).tool_calls?.length || 0,
            }))
          );

          const finalResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: finalMessages,
            max_tokens: 1000,
            temperature: 0.7,
          });

          responseContent = finalResponse.choices[0]?.message?.content || "";
          console.log(`[${requestId}] 📝 Raw AI response: ${responseContent}`);

          // Add warning if confidential information was stored
          const latestUserMessage = messages
            .filter((msg: any) => msg.role === "user")
            .pop();

          if (latestUserMessage) {
            const newFacts = await extractNewInformation(
              latestUserMessage.content
            );
            if (newFacts.length > 0 && containsConfidentialInfo(newFacts)) {
              responseContent +=
                "\n\n⚠️ **Warning**: I've stored confidential information you shared. Please be cautious about sharing sensitive data in the future.";
              console.log(
                `[${requestId}] ⚠️ Added confidential information warning to response`
              );
            }
          }

          console.log(
            `[${requestId}] ✅ Final response generated: ${responseContent.substring(
              0,
              100
            )}...`
          );
        } catch (error) {
          console.error(
            `[${requestId}] ❌ Error processing memory tool call:`,
            error
          );
          responseContent =
            "I apologize, but I encountered an error while searching for your memories.";
        }
      } else if (!userId) {
        console.log(
          `[${requestId}] ⚠️ Tool call requested but user not authenticated`
        );
        responseContent = initialResponse.choices[0]?.message?.content || "";
      } else {
        console.log(
          `[${requestId}] ⚠️ Unknown tool call: ${
            toolCall.type === "function" ? toolCall.function.name : "unknown"
          }`
        );
        responseContent = initialResponse.choices[0]?.message?.content || "";
      }
    } else {
      console.log(`[${requestId}] ℹ️ No tool calls requested by AI`);
      responseContent = initialResponse.choices[0]?.message?.content || "";

      // Add warning if confidential information was stored
      const latestUserMessage = messages
        .filter((msg: any) => msg.role === "user")
        .pop();

      if (latestUserMessage) {
        const newFacts = await extractNewInformation(latestUserMessage.content);
        if (newFacts.length > 0 && containsConfidentialInfo(newFacts)) {
          responseContent +=
            "\n\n⚠️ **Warning**: I've stored confidential information you shared. Please be cautious about sharing sensitive data in the future.";
          console.log(
            `[${requestId}] ⚠️ Added confidential information warning to response`
          );
        }
      }
    }

    // Now create a streaming response with the final content
    console.log(`[${requestId}] 🌊 Starting streaming response`);
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        ...openaiMessages,
        { role: "assistant", content: responseContent },
      ],
      max_tokens: 1000,
      temperature: 0.7,
      stream: true,
    });

    // Create a readable stream
    const encoder = new TextEncoder();
    let fullResponse = responseContent;
    let chunkCount = 0;

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              chunkCount++;
              fullResponse += content;
              const data = JSON.stringify({
                type: "content",
                content: content,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          console.log(
            `[${requestId}] 📊 Streaming completed - ${chunkCount} chunks, ${fullResponse.length} total characters`
          );

          // Send completion signal
          const completionData = JSON.stringify({
            type: "done",
          });
          controller.enqueue(encoder.encode(`data: ${completionData}\n\n`));
          controller.close();

          // Only store new information from AI response if it's not a tool-based response
          // (Tool-based responses contain retrieved information, not new information)
          const isToolBasedResponse = finalMessages.some(
            (msg) => msg.role === "tool"
          );

          if (userId && fullResponse.trim() && !isToolBasedResponse) {
            try {
              console.log(
                `[${requestId}] 🔍 Extracting facts from AI response (non-tool response)`
              );
              const aiFacts = await extractNewInformation(fullResponse);
              if (aiFacts.length > 0) {
                console.log(
                  `[${requestId}] 💡 Extracted ${aiFacts.length} facts from AI response:`,
                  aiFacts
                );

                for (const fact of aiFacts) {
                  try {
                    console.log(
                      `[${requestId}] 💾 Storing AI memory: "${fact}"`
                    );
                    const result = await addMemory(userId, fact, true);
                    if (result.success) {
                      console.log(
                        `[${requestId}] ✅ AI memory stored successfully: ${result.memoryId}`
                      );
                    } else {
                      console.error(
                        `[${requestId}] ❌ Failed to store AI memory:`,
                        result.error
                      );
                    }
                  } catch (error) {
                    console.error(
                      `[${requestId}] ❌ Error storing AI memory:`,
                      error
                    );
                  }
                }
              } else {
                console.log(
                  `[${requestId}] ℹ️ No new facts extracted from AI response`
                );
              }
            } catch (error) {
              console.error(
                `[${requestId}] ❌ Error processing AI response for memories:`,
                error
              );
            }
          } else if (isToolBasedResponse) {
            console.log(
              `[${requestId}] ℹ️ Skipping memory extraction from tool-based response to avoid duplicates`
            );
          }
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
      },
    });
  } catch (error) {
    console.error(`[${requestId}] ❌ OpenAI API error:`, error);

    // Handle specific OpenAI errors
    let errorMessage = "Failed to process chat request";
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        errorMessage = "OpenAI API key not configured";
        console.error(`[${requestId}] 🔑 API key error`);
      } else if (error.message.includes("rate limit")) {
        errorMessage = "Rate limit exceeded. Please try again later.";
        statusCode = 429;
        console.error(`[${requestId}] ⏰ Rate limit exceeded`);
      } else {
        console.error(`[${requestId}] ❌ Unknown error:`, error.message);
      }
    }

    console.log(
      `[${requestId}] 🚨 Returning error response: ${statusCode} - ${errorMessage}`
    );
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    });
  }
}
