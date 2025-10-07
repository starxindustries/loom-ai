// chat API
import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  searchMemories,
  formatMemoriesForContext,
} from "@/lib/memory";
import { addMemoryWithLimits } from "@/lib/memory-with-usage-enforcement";
import { createReminderService } from "@/lib/reminder-service";
import { createIntegrationService } from "@/lib/integration-service";
import { CreateReminderRequest } from "@/types/reminder";

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

    // Define AI tools
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
    ];

    // Prepare messages for OpenAI
    const openaiMessages = [
      {
        role: "system" as const,
        content: `You are a helpful AI assistant with memory and task management capabilities. 
        
MEMORY USAGE:
- Use search_memories when users ask about themselves or their information
- When users share new info, it's automatically stored
- Use search_memories for questions like 'what did I tell you about...', 'what's my...', 'do you remember...'

REMINDER & TASK CREATION:
- Use create_reminder when users want to be reminded of something or schedule a task
- Examples: "remind me to...", "schedule a meeting", "send an email tomorrow", "set up a recurring task"
- For simple reminders, use task_type: "reminder"
- For automated actions (emails, calendar events, etc.), use task_type: "action" with appropriate integration_slug
- For repeating tasks, use task_type: "recurring" with recurrence_rule
- Always ask for clarification if the scheduled time is ambiguous
- If an action requires an integration (like Gmail, Google Calendar), include the integration_slug
- Common integrations: gmail, google-calendar, slack, notion, airtable
- Today's date is ${new Date().toISOString().split('T')[0]}
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
    } else if (toolCall.function.name === "create_reminder") {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`[${requestId}] ⏰ Creating reminder: "${args.title}"`);
        
        const result = await createReminderFromAI(userId, args, requestId);
        
        results.push({
          tool_call_id: toolCall.id,
          content: result.content,
        });

        console.log(`[${requestId}] ✅ Reminder creation completed: ${result.success ? 'success' : 'failed'}`);
        console.log({result})
      } catch (error) {
        console.error(`[${requestId}] ❌ Reminder creation error:`, error);
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
 * Create reminder from AI tool call with integration validation
 */
async function createReminderFromAI(
  userId: string, 
  args: any, 
  requestId: string
): Promise<{ success: boolean; content: string }> {
  try {
    const supabase = await createClient();
    
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
    
    console.log(`[${requestId}] 📅 Date validation:`, {
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
      console.log(`[${requestId}] 🔍 Validating integration: ${args.integration_slug} for action: ${args.action_type}`);
      
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
      console.error(`[${requestId}] ❌ Reminder creation failed:`, result.error);
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
    console.error(`[${requestId}] ❌ Unexpected error in createReminderFromAI:`, error);
    return {
      success: false,
      content: "❌ An unexpected error occurred while creating the reminder. Please try again."
    };
  }
}