/**
 * Memory operations with usage limit enforcement
 * This demonstrates how to integrate usage limits with existing memory operations
 */

import { addMemory, addMemoriesBatch } from './memory';
import { enforceUsageLimit, withUsageEnforcement } from './usage-limit-middleware';
import { UpgradePrompt } from '../types/subscription';

/**
 * Add a single memory with usage limit enforcement
 */
export const addMemoryWithLimits = withUsageEnforcement(
  'memory',
  async (userId: string, content: string, generateEmbedding: boolean = true) => {
    return await addMemory(userId, content, generateEmbedding);
  }
);

/**
 * Add multiple memories with usage limit enforcement
 */
export async function addMemoriesBatchWithLimits(
  userId: string, 
  memories: string[], 
  generateEmbeddings: boolean = true
): Promise<{ 
  success: boolean; 
  data?: any; 
  upgradePrompt?: UpgradePrompt; 
  error?: string 
}> {
  // For batch operations, we need custom logic to check if all memories can be added
  return enforceUsageLimit(userId, 'memory', async () => {
    // Check if adding all memories would exceed the limit
    const { usageTrackingService } = await import('./usage-tracking-service');
    const currentUsage = await usageTrackingService.getCurrentUsage(userId);
    
    if ((currentUsage.memoryCount + memories.length) > currentUsage.memoryLimit) {
      const upgradePrompt = await usageTrackingService.getUpgradePrompt(userId, 'memory');
      throw new Error(`Adding ${memories.length} memories would exceed your limit of ${currentUsage.memoryLimit}. Current usage: ${currentUsage.memoryCount}`);
    }

    // If within limits, proceed with batch operation
    const result = await addMemoriesBatch(userId, memories, generateEmbeddings);
    
    // Note: The enforceUsageLimit function will only increment by 1
    // For batch operations, we need to increment by the actual count
    const { usageLimitMiddleware } = await import('./usage-limit-middleware');
    
    // Increment usage for each additional memory (first one is handled by enforceUsageLimit)
    for (let i = 1; i < memories.length; i++) {
      await usageLimitMiddleware.incrementUsageAfterOperation(userId, 'memory');
    }
    
    return result;
  });
}

/**
 * Example of manual usage checking for complex operations
 */
export async function complexMemoryOperation(
  userId: string,
  operations: Array<{ type: 'add' | 'update', content: string, memoryId?: string }>
): Promise<{ 
  success: boolean; 
  results?: any[]; 
  upgradePrompt?: UpgradePrompt; 
  error?: string 
}> {
  try {
    const { usageLimitMiddleware } = await import('./usage-limit-middleware');
    const { usageTrackingService } = await import('./usage-tracking-service');
    
    // Count how many new memories will be created
    const newMemoryCount = operations.filter(op => op.type === 'add').length;
    
    if (newMemoryCount > 0) {
      // Check if user can add the new memories
      const currentUsage = await usageTrackingService.getCurrentUsage(userId);
      
      if ((currentUsage.memoryCount + newMemoryCount) > currentUsage.memoryLimit) {
        const upgradePrompt = await usageTrackingService.getUpgradePrompt(userId, 'memory');
        return {
          success: false,
          upgradePrompt
        };
      }
    }

    // Process operations
    const results = [];
    let addedCount = 0;

    for (const operation of operations) {
      if (operation.type === 'add') {
        const result = await addMemory(userId, operation.content, true);
        results.push(result);
        
        if (result.success) {
          addedCount++;
        }
      } else if (operation.type === 'update' && operation.memoryId) {
        // Handle update operations (not implemented in this example)
        results.push({ success: true, message: 'Update operation placeholder' });
      }
    }

    // Increment usage for all successfully added memories
    for (let i = 0; i < addedCount; i++) {
      await usageLimitMiddleware.incrementUsageAfterOperation(userId, 'memory');
    }

    return {
      success: true,
      results
    };
  } catch (error) {
    console.error('Error in complex memory operation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Client-side memory creation with usage checking
 */
export async function createMemoryClientSide(
  content: string,
  onUpgradeNeeded?: (prompt: UpgradePrompt) => void
): Promise<boolean> {
  const { ClientUsageEnforcement } = await import('./usage-limit-middleware');
  
  return ClientUsageEnforcement.checkBeforeOperation(
    'memory',
    async () => {
      // Make API call to create memory
      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error('Failed to create memory');
      }
    },
    onUpgradeNeeded
  );
}