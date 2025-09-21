/**
 * Example of how to integrate usage limit middleware with existing API routes
 * This shows how to modify the memories API to include usage limit checking
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from './supabase/server';
import { usageLimitMiddleware, UsageLimitUtils } from './usage-limit-middleware';
import { usageTrackingService } from './usage-tracking-service';
import { addMemory, addMemoriesBatch } from './memory';

/**
 * Example: Modified POST handler for memories with usage limit checking
 */
export const POST_with_usage_limits = usageLimitMiddleware.withMemoryLimitCheck(
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

/**
 * Example: Modified PUT handler for batch memories with usage limit checking
 */
export const PUT_with_usage_limits = async (request: NextRequest): Promise<NextResponse> => {
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
};

/**
 * Example: Manual usage limit checking in component or service
 */
export async function createMemoryWithLimitCheck(userId: string, content: string): Promise<{
  success: boolean;
  memoryId?: string;
  error?: string;
  upgradePrompt?: any;
}> {
  try {
    // Check usage limit first
    const limitCheck = await usageLimitMiddleware.checkUsageLimits(userId, 'memory');
    
    if (!limitCheck.allowed && limitCheck.upgradePrompt) {
      return {
        success: false,
        error: 'Usage limit exceeded',
        upgradePrompt: limitCheck.upgradePrompt
      };
    }

    // Create the memory
    const result = await addMemory(userId, content, true);
    
    if (result.success) {
      // Increment usage after successful creation
      await usageLimitMiddleware.incrementUsageAfterOperation(userId, 'memory');
    }

    return result;
  } catch (error) {
    console.error('Error creating memory with limit check:', error);
    return {
      success: false,
      error: 'Failed to create memory'
    };
  }
}

/**
 * Example: Client-side usage limit checking before API call
 */
export async function clientSideMemoryCreation(content: string): Promise<boolean> {
  try {
    // Check limit on client side first (for immediate UI feedback)
    const limitCheck = await UsageLimitUtils.checkClientUsageLimit('memory');
    
    if (!limitCheck.allowed && limitCheck.upgradePrompt) {
      // Show upgrade prompt to user
      UsageLimitUtils.handleUpgradePrompt(limitCheck.upgradePrompt);
      return false;
    }

    // Proceed with API call
    const response = await fetch('/api/memories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    if (response.status === 429) {
      // Handle server-side limit exceeded (backup check)
      const errorData = await response.json();
      if (errorData.details) {
        UsageLimitUtils.handleUpgradePrompt({
          title: errorData.details.title || 'Usage Limit Exceeded',
          message: errorData.message,
          currentUsage: errorData.details.currentUsage,
          limit: errorData.details.limit,
          resourceType: errorData.details.resourceType,
          suggestedPlans: errorData.details.suggestedPlans
        });
      }
      return false;
    }

    return response.ok;
  } catch (error) {
    console.error('Error in client-side memory creation:', error);
    return false;
  }
}