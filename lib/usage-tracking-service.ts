import { createClient } from './supabase/server';
import { subscriptionService } from './subscription-service';
import {
  UsageTrackingServiceInterface,
  ResourceType,
  UsageStats,
  UsageTracking,
  UsageTrackingRow,
  SubscriptionPlan,
  UpgradePrompt
} from '../types/subscription';

export class UsageTrackingService implements UsageTrackingServiceInterface {
  /**
   * Check if user has reached their usage limit for a specific resource type
   */
  async checkUsageLimit(userId: string, resourceType: ResourceType): Promise<boolean> {
    try {
      const usage = await this.getCurrentUsage(userId);
      
      switch (resourceType) {
        case 'memory':
          return usage.memoryCount < usage.memoryLimit;
        case 'file':
          return usage.fileCount < usage.fileLimit;
        default:
          throw new Error(`Unknown resource type: ${resourceType}`);
      }
    } catch (error) {
      console.error('Error checking usage limit:', error);
      throw new Error(`Failed to check usage limit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Increment usage count for a specific resource type
   */
  async incrementUsage(userId: string, resourceType: ResourceType): Promise<void> {
    try {
      const supabase = await createClient();
      
      // Ensure usage tracking record exists
      await this.ensureUsageTrackingExists(userId);
      
      const updateField = resourceType === 'memory' ? 'memory_count' : 'file_count';
      
      // First get current value, then increment
      const { data: currentData, error: selectError } = await supabase
        .from('usage_tracking')
        .select(updateField)
        .eq('user_id', userId)
        .single();

      if (selectError) {
        throw new Error(`Database error: ${selectError.message}`);
      }

      const currentValue = currentData[updateField] || 0;
      
      const { error } = await supabase
        .from('usage_tracking')
        .update({
          [updateField]: currentValue + 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error incrementing usage:', error);
      throw new Error(`Failed to increment usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current usage statistics for a user
   */
  async getCurrentUsage(userId: string): Promise<UsageStats> {
    try {
      const supabase = await createClient();
      
      // Ensure usage tracking record exists
      await this.ensureUsageTrackingExists(userId);
      
      // Get usage tracking data
      const { data: usageData, error: usageError } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (usageError) {
        throw new Error(`Database error: ${usageError.message}`);
      }

      // Get user's current subscription to determine limits
      const subscription = await subscriptionService.getCurrentSubscription(userId);
      let memoryLimit = 20; // Free plan default
      let fileLimit = 2; // Free plan default

      if (subscription) {
        // Get plan details from subscription plans
        const { data: planData, error: planError } = await supabase
          .from('subscription_plans')
          .select('memory_limit, file_limit')
          .eq('id', subscription.planId)
          .single();

        if (planError) {
          console.warn('Could not fetch plan limits, using free plan defaults:', planError.message);
        } else {
          memoryLimit = planData.memory_limit;
          fileLimit = planData.file_limit;
        }
      }

      return {
        memoryCount: usageData.memory_count,
        fileCount: usageData.file_count,
        memoryLimit,
        fileLimit,
        lastResetAt: new Date(usageData.last_reset_at)
      };
    } catch (error) {
      console.error('Error getting current usage:', error);
      throw new Error(`Failed to get current usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reset usage counters for a user (typically called monthly)
   */
  async resetUsage(userId: string): Promise<void> {
    try {
      const supabase = await createClient();
      
      const { error } = await supabase
        .from('usage_tracking')
        .update({
          memory_count: 0,
          file_count: 0,
          last_reset_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error resetting usage:', error);
      throw new Error(`Failed to reset usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get upgrade prompt when user exceeds limits
   */
  async getUpgradePrompt(userId: string, resourceType: ResourceType): Promise<UpgradePrompt> {
    try {
      const usage = await this.getCurrentUsage(userId);
      const availablePlans = await subscriptionService.getAvailablePlans();
      
      // Filter plans that have higher limits than current
      const currentLimit = resourceType === 'memory' ? usage.memoryLimit : usage.fileLimit;
      const suggestedPlans = availablePlans.filter(plan => {
        const planLimit = resourceType === 'memory' ? plan.memoryLimit : plan.fileLimit;
        return planLimit > currentLimit;
      });

      const currentUsage = resourceType === 'memory' ? usage.memoryCount : usage.fileCount;
      const resourceName = resourceType === 'memory' ? 'memory records' : 'file records';

      return {
        title: `${resourceType === 'memory' ? 'Memory' : 'File'} Limit Reached`,
        message: `You've reached your limit of ${currentLimit} ${resourceName}. Upgrade your plan to continue.`,
        currentUsage,
        limit: currentLimit,
        resourceType,
        suggestedPlans
      };
    } catch (error) {
      console.error('Error getting upgrade prompt:', error);
      throw new Error(`Failed to get upgrade prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensure usage tracking record exists for user
   */
  private async ensureUsageTrackingExists(userId: string): Promise<void> {
    try {
      const supabase = await createClient();
      
      // Check if record exists
      const { data: existingData, error: selectError } = await supabase
        .from('usage_tracking')
        .select('id')
        .eq('user_id', userId)
        .single();

      // If record doesn't exist, create it
      if (selectError && selectError.code === 'PGRST116') {
        const { error: insertError } = await supabase
          .from('usage_tracking')
          .insert({
            user_id: userId,
            memory_count: 0,
            file_count: 0,
            last_reset_at: new Date().toISOString()
          });

        if (insertError) {
          throw new Error(`Failed to create usage tracking record: ${insertError.message}`);
        }
      } else if (selectError) {
        throw new Error(`Database error: ${selectError.message}`);
      }
    } catch (error) {
      console.error('Error ensuring usage tracking exists:', error);
      throw error;
    }
  }

  /**
   * Map database row to UsageTracking interface
   */
  private mapRowToUsageTracking(row: UsageTrackingRow): UsageTracking {
    return {
      id: row.id,
      userId: row.user_id,
      memoryCount: row.memory_count,
      fileCount: row.file_count,
      lastResetAt: new Date(row.last_reset_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

// Export singleton instance
export const usageTrackingService = new UsageTrackingService();