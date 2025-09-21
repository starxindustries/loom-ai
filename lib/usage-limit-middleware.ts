import { NextRequest, NextResponse } from 'next/server';
import { createClient } from './supabase/server';
import { usageTrackingService } from './usage-tracking-service';
import { 
  ResourceType, 
  PlanRestrictionResult, 
  UpgradePrompt 
} from '../types/subscription';

export class UsageLimitMiddleware {
  /**
   * Check if user can perform memory operation
   */
  async enforceMemoryLimit(userId: string): Promise<PlanRestrictionResult> {
    try {
      const canProceed = await usageTrackingService.checkUsageLimit(userId, 'memory');
      
      if (!canProceed) {
        const upgradePrompt = await usageTrackingService.getUpgradePrompt(userId, 'memory');
        return {
          allowed: false,
          upgradePrompt
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error enforcing memory limit:', error);
      // In case of error, allow the operation but log the issue
      return { allowed: true };
    }
  }

  /**
   * Check if user can perform file operation
   */
  async enforceFileLimit(userId: string): Promise<PlanRestrictionResult> {
    try {
      const canProceed = await usageTrackingService.checkUsageLimit(userId, 'file');
      
      if (!canProceed) {
        const upgradePrompt = await usageTrackingService.getUpgradePrompt(userId, 'file');
        return {
          allowed: false,
          upgradePrompt
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error enforcing file limit:', error);
      // In case of error, allow the operation but log the issue
      return { allowed: true };
    }
  }

  /**
   * Middleware function to check usage limits before operations
   */
  async checkUsageLimits(
    userId: string, 
    resourceType: ResourceType
  ): Promise<PlanRestrictionResult> {
    switch (resourceType) {
      case 'memory':
        return this.enforceMemoryLimit(userId);
      case 'file':
        return this.enforceFileLimit(userId);
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
  }

  /**
   * Increment usage after successful operation
   */
  async incrementUsageAfterOperation(
    userId: string, 
    resourceType: ResourceType
  ): Promise<void> {
    try {
      await usageTrackingService.incrementUsage(userId, resourceType);
    } catch (error) {
      console.error('Error incrementing usage after operation:', error);
      // Don't throw error here as the main operation was successful
    }
  }

  /**
   * Create API response for usage limit exceeded
   */
  createUsageLimitResponse(upgradePrompt: UpgradePrompt): NextResponse {
    return NextResponse.json(
      {
        error: 'Usage limit exceeded',
        message: upgradePrompt.message,
        code: 'USAGE_LIMIT_EXCEEDED',
        details: {
          resourceType: upgradePrompt.resourceType,
          currentUsage: upgradePrompt.currentUsage,
          limit: upgradePrompt.limit,
          suggestedPlans: upgradePrompt.suggestedPlans.map(plan => ({
            id: plan.id,
            name: plan.name,
            priceMonthly: plan.priceMonthly,
            memoryLimit: plan.memoryLimit,
            fileLimit: plan.fileLimit
          }))
        }
      },
      { status: 429 } // Too Many Requests
    );
  }

  /**
   * Extract user ID from request (assumes authentication middleware has run)
   */
  async getUserIdFromRequest(request: NextRequest): Promise<string | null> {
    try {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        return null;
      }
      
      return user.id;
    } catch (error) {
      console.error('Error getting user from request:', error);
      return null;
    }
  }

  /**
   * Higher-order function to wrap API routes with usage limit checking
   */
  withUsageLimitCheck(
    resourceType: ResourceType,
    handler: (request: NextRequest, userId: string) => Promise<NextResponse>
  ) {
    return async (request: NextRequest): Promise<NextResponse> => {
      try {
        // Get user ID from request
        const userId = await this.getUserIdFromRequest(request);
        if (!userId) {
          return NextResponse.json(
            { error: 'Unauthorized', message: 'User not authenticated' },
            { status: 401 }
          );
        }

        // Check usage limits
        const limitCheck = await this.checkUsageLimits(userId, resourceType);
        if (!limitCheck.allowed && limitCheck.upgradePrompt) {
          return this.createUsageLimitResponse(limitCheck.upgradePrompt);
        }

        // Execute the handler
        const response = await handler(request, userId);

        // If the operation was successful (2xx status), increment usage
        if (response.status >= 200 && response.status < 300) {
          await this.incrementUsageAfterOperation(userId, resourceType);
        }

        return response;
      } catch (error) {
        console.error('Error in usage limit middleware:', error);
        return NextResponse.json(
          { 
            error: 'Internal server error', 
            message: 'An error occurred while checking usage limits' 
          },
          { status: 500 }
        );
      }
    };
  }

  /**
   * Middleware for memory operations
   */
  withMemoryLimitCheck(
    handler: (request: NextRequest, userId: string) => Promise<NextResponse>
  ) {
    return this.withUsageLimitCheck('memory', handler);
  }

  /**
   * Middleware for file operations
   */
  withFileLimitCheck(
    handler: (request: NextRequest, userId: string) => Promise<NextResponse>
  ) {
    return this.withUsageLimitCheck('file', handler);
  }
}

// Export singleton instance
export const usageLimitMiddleware = new UsageLimitMiddleware();

/**
 * Utility functions for client-side usage limit checking
 */
export class UsageLimitUtils {
  /**
   * Check usage limits on the client side (for UI feedback)
   */
  static async checkClientUsageLimit(resourceType: ResourceType): Promise<{
    allowed: boolean;
    upgradePrompt?: UpgradePrompt;
  }> {
    try {
      const response = await fetch(`/api/usage/check?type=${resourceType}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          const data = await response.json();
          return {
            allowed: false,
            upgradePrompt: {
              title: data.details?.title || 'Usage Limit Exceeded',
              message: data.message,
              currentUsage: data.details?.currentUsage || 0,
              limit: data.details?.limit || 0,
              resourceType: data.details?.resourceType || resourceType,
              suggestedPlans: data.details?.suggestedPlans || []
            }
          };
        }
        throw new Error('Failed to check usage limit');
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking client usage limit:', error);
      // In case of error, allow the operation
      return { allowed: true };
    }
  }

  /**
   * Get current usage stats for display in UI
   */
  static async getCurrentUsageStats(): Promise<{
    memoryCount: number;
    fileCount: number;
    memoryLimit: number;
    fileLimit: number;
    memoryPercentage: number;
    filePercentage: number;
  } | null> {
    try {
      const response = await fetch('/api/usage/current', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get usage stats');
      }

      const data = await response.json();
      return {
        ...data,
        memoryPercentage: Math.round((data.memoryCount / data.memoryLimit) * 100),
        filePercentage: Math.round((data.fileCount / data.fileLimit) * 100)
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return null;
    }
  }

  /**
   * Show upgrade prompt modal or redirect
   */
  static handleUpgradePrompt(upgradePrompt: UpgradePrompt): void {
    // This can be customized based on your UI framework
    // For now, we'll just log it and could integrate with a modal system
    console.log('Upgrade prompt:', upgradePrompt);
    
    // You could dispatch a custom event that components can listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('usage-limit-exceeded', {
        detail: upgradePrompt
      }));
    }
  }
}

/**
 * React hook for usage limit checking (if using React)
 */
export function useUsageLimitCheck() {
  const checkLimit = async (resourceType: ResourceType) => {
    const result = await UsageLimitUtils.checkClientUsageLimit(resourceType);
    
    if (!result.allowed && result.upgradePrompt) {
      UsageLimitUtils.handleUpgradePrompt(result.upgradePrompt);
      return false;
    }
    
    return true;
  };

  const getUsageStats = () => UsageLimitUtils.getCurrentUsageStats();

  return {
    checkLimit,
    getUsageStats
  };
}/**

 * Generic function to enforce usage limits for any operation
 */
export async function enforceUsageLimit<T>(
  userId: string,
  resourceType: ResourceType,
  operation: () => Promise<T>
): Promise<{ success: boolean; data?: T; upgradePrompt?: UpgradePrompt; error?: string }> {
  try {
    // Check usage limit first
    const limitCheck = await usageLimitMiddleware.checkUsageLimits(userId, resourceType);
    
    if (!limitCheck.allowed && limitCheck.upgradePrompt) {
      return {
        success: false,
        upgradePrompt: limitCheck.upgradePrompt
      };
    }

    // Execute the operation
    const result = await operation();
    
    // Increment usage after successful operation
    await usageLimitMiddleware.incrementUsageAfterOperation(userId, resourceType);
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Error in enforceUsageLimit:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Middleware for protecting server actions with usage limits
 */
export function withUsageEnforcement<T extends any[], R>(
  resourceType: ResourceType,
  action: (userId: string, ...args: T) => Promise<R>
) {
  return async (userId: string, ...args: T): Promise<{ 
    success: boolean; 
    data?: R; 
    upgradePrompt?: UpgradePrompt; 
    error?: string 
  }> => {
    return enforceUsageLimit(userId, resourceType, () => action(userId, ...args));
  };
}

/**
 * Middleware for client-side operations that need usage enforcement
 */
export class ClientUsageEnforcement {
  /**
   * Check usage limit before performing an operation on the client
   */
  static async checkBeforeOperation(
    resourceType: ResourceType,
    operation: () => Promise<void> | void,
    onUpgradeNeeded?: (prompt: UpgradePrompt) => void
  ): Promise<boolean> {
    try {
      const result = await UsageLimitUtils.checkClientUsageLimit(resourceType);
      
      if (!result.allowed && result.upgradePrompt) {
        if (onUpgradeNeeded) {
          onUpgradeNeeded(result.upgradePrompt);
        } else {
          UsageLimitUtils.handleUpgradePrompt(result.upgradePrompt);
        }
        return false;
      }

      // Execute the operation if allowed
      await operation();
      return true;
    } catch (error) {
      console.error('Error in client usage enforcement:', error);
      return false;
    }
  }

  /**
   * Wrap a function with usage limit checking
   */
  static withUsageCheck<T extends any[], R>(
    resourceType: ResourceType,
    fn: (...args: T) => Promise<R> | R,
    onUpgradeNeeded?: (prompt: UpgradePrompt) => void
  ) {
    return async (...args: T): Promise<R | null> => {
      const result = await UsageLimitUtils.checkClientUsageLimit(resourceType);
      
      if (!result.allowed && result.upgradePrompt) {
        if (onUpgradeNeeded) {
          onUpgradeNeeded(result.upgradePrompt);
        } else {
          UsageLimitUtils.handleUpgradePrompt(result.upgradePrompt);
        }
        return null;
      }

      return await fn(...args);
    };
  }
}