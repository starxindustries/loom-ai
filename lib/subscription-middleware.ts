/**
 * Subscription Middleware
 * Handles subscription status checking for protected routes and premium features
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from './supabase/server';
import { subscriptionService } from './subscription-service';
import { UserSubscription, SubscriptionPlan } from '@/types/subscription';

export interface SubscriptionCheckResult {
  hasAccess: boolean;
  subscription: UserSubscription | null;
  plan: SubscriptionPlan | null;
  reason?: 'no_subscription' | 'expired' | 'cancelled' | 'past_due' | 'paused' | 'trial_expired';
  redirectUrl?: string;
  message?: string;
}

export class SubscriptionMiddleware {
  /**
   * Check if user has access to premium features
   */
  async checkPremiumAccess(userId: string): Promise<SubscriptionCheckResult> {
    try {
      const subscription = await subscriptionService.getCurrentSubscription(userId);
      
      if (!subscription) {
        return {
          hasAccess: false,
          subscription: null,
          plan: null,
          reason: 'no_subscription',
          redirectUrl: '/protected/billing?tab=plans',
          message: 'Please subscribe to a plan to access premium features.'
        };
      }

      // Get the plan details
      const availablePlans = await subscriptionService.getAvailablePlans();
      const plan = availablePlans.find(p => p.id === subscription.planId);

      if (!plan) {
        return {
          hasAccess: false,
          subscription,
          plan: null,
          reason: 'no_subscription',
          redirectUrl: '/protected/billing?tab=plans',
          message: 'Your subscription plan could not be found. Please contact support.'
        };
      }

      // Check subscription status
      switch (subscription.status) {
        case 'active':
          return {
            hasAccess: true,
            subscription,
            plan
          };

        case 'trialing':
          // Check if trial has expired
          if (subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) < new Date()) {
            return {
              hasAccess: false,
              subscription,
              plan,
              reason: 'trial_expired',
              redirectUrl: '/protected/billing?tab=plans',
              message: 'Your trial has expired. Please subscribe to continue using premium features.'
            };
          }
          return {
            hasAccess: true,
            subscription,
            plan
          };

        case 'cancelled':
          // Check if still within grace period
          if (subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) > new Date()) {
            return {
              hasAccess: true,
              subscription,
              plan,
              message: 'Your subscription is cancelled but you still have access until the end of your billing period.'
            };
          }
          return {
            hasAccess: false,
            subscription,
            plan,
            reason: 'cancelled',
            redirectUrl: '/protected/billing?tab=plans',
            message: 'Your subscription has been cancelled. Please resubscribe to access premium features.'
          };

        case 'expired':
          return {
            hasAccess: false,
            subscription,
            plan,
            reason: 'expired',
            redirectUrl: '/protected/billing?tab=plans',
            message: 'Your subscription has expired. Please resubscribe to access premium features.'
          };

        case 'past_due':
          return {
            hasAccess: false,
            subscription,
            plan,
            reason: 'past_due',
            redirectUrl: '/protected/billing?tab=payment',
            message: 'Your payment failed. Please update your payment method to restore access.'
          };

        case 'paused':
          return {
            hasAccess: false,
            subscription,
            plan,
            reason: 'paused',
            redirectUrl: '/protected/billing?tab=plans',
            message: 'Your subscription is paused. Please reactivate to access premium features.'
          };

        default:
          return {
            hasAccess: false,
            subscription,
            plan,
            reason: 'no_subscription',
            redirectUrl: '/protected/billing?tab=plans',
            message: 'Your subscription status is invalid. Please contact support.'
          };
      }
    } catch (error) {
      console.error('Error checking premium access:', error);
      return {
        hasAccess: false,
        subscription: null,
        plan: null,
        reason: 'no_subscription',
        redirectUrl: '/protected/billing?tab=plans',
        message: 'Unable to verify subscription status. Please try again.'
      };
    }
  }

  /**
   * Check if user has access to specific plan features
   */
  async checkPlanAccess(userId: string, requiredPlanSlug: string): Promise<SubscriptionCheckResult> {
    const result = await this.checkPremiumAccess(userId);
    
    if (!result.hasAccess || !result.plan) {
      return result;
    }

    // Define plan hierarchy (higher index = more features)
    const planHierarchy = ['free', 'starter', 'pro', 'pro-plus'];
    const userPlanIndex = planHierarchy.indexOf(result.plan.slug);
    const requiredPlanIndex = planHierarchy.indexOf(requiredPlanSlug);

    if (userPlanIndex < requiredPlanIndex) {
      return {
        hasAccess: false,
        subscription: result.subscription,
        plan: result.plan,
        reason: 'no_subscription',
        redirectUrl: '/protected/billing?tab=plans',
        message: `This feature requires a ${requiredPlanSlug} plan or higher. Please upgrade your subscription.`
      };
    }

    return result;
  }

  /**
   * Middleware function for API routes
   */
  async withSubscriptionCheck(
    request: NextRequest,
    handler: (request: NextRequest, userId: string, subscription: SubscriptionCheckResult) => Promise<NextResponse>,
    options: {
      requireActiveSubscription?: boolean;
      requiredPlanSlug?: string;
      allowGracePeriod?: boolean;
    } = {}
  ): Promise<NextResponse> {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      const subscriptionResult = await this.checkPremiumAccess(user.id);

      // Check if subscription is required
      if (options.requireActiveSubscription && !subscriptionResult.hasAccess) {
        return NextResponse.json(
          {
            error: "Subscription required",
            message: subscriptionResult.message,
            redirectUrl: subscriptionResult.redirectUrl,
            reason: subscriptionResult.reason
          },
          { status: 403 }
        );
      }

      // Check specific plan requirements
      if (options.requiredPlanSlug) {
        const planResult = await this.checkPlanAccess(user.id, options.requiredPlanSlug);
        if (!planResult.hasAccess) {
          return NextResponse.json(
            {
              error: "Plan upgrade required",
              message: planResult.message,
              redirectUrl: planResult.redirectUrl,
              reason: planResult.reason
            },
            { status: 403 }
          );
        }
      }

      // Allow grace period for cancelled subscriptions
      if (options.allowGracePeriod && subscriptionResult.subscription?.status === 'cancelled') {
        if (subscriptionResult.subscription.currentPeriodEnd && 
            new Date(subscriptionResult.subscription.currentPeriodEnd) > new Date()) {
          // Still in grace period, allow access
          return handler(request, user.id, subscriptionResult);
        }
      }

      return handler(request, user.id, subscriptionResult);
    } catch (error) {
      console.error('Subscription middleware error:', error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }

  /**
   * Check if user can access a specific feature based on their plan
   */
  async canAccessFeature(userId: string, feature: string): Promise<{
    canAccess: boolean;
    reason?: string;
    upgradeRequired?: boolean;
  }> {
    const result = await this.checkPremiumAccess(userId);
    
    if (!result.hasAccess) {
      return {
        canAccess: false,
        reason: result.message,
        upgradeRequired: true
      };
    }

    if (!result.plan) {
      return {
        canAccess: false,
        reason: 'Plan not found',
        upgradeRequired: true
      };
    }

    // Define feature access based on plan
    const featureAccess = {
      'free': ['basic_chat', 'limited_memories', 'limited_files'],
      'starter': ['basic_chat', 'limited_memories', 'limited_files', 'priority_support'],
      'pro': ['basic_chat', 'unlimited_memories', 'unlimited_files', 'priority_support', 'advanced_ai', 'api_access'],
      'pro-plus': ['basic_chat', 'unlimited_memories', 'unlimited_files', 'priority_support', 'advanced_ai', 'api_access', 'white_label', 'custom_integrations']
    };

    const userFeatures = featureAccess[result.plan.slug as keyof typeof featureAccess] || [];
    
    if (userFeatures.includes(feature)) {
      return { canAccess: true };
    }

    return {
      canAccess: false,
      reason: `This feature is not available in your ${result.plan.name} plan`,
      upgradeRequired: true
    };
  }

  /**
   * Get subscription status for display purposes
   */
  async getSubscriptionStatus(userId: string): Promise<{
    status: string;
    planName: string;
    isActive: boolean;
    expiresAt?: string;
    daysRemaining?: number;
    needsAttention: boolean;
  }> {
    const result = await this.checkPremiumAccess(userId);
    
    if (!result.subscription || !result.plan) {
      return {
        status: 'No Subscription',
        planName: 'Free',
        isActive: false,
        needsAttention: true
      };
    }

    const now = new Date();
    const expiresAt = result.subscription.currentPeriodEnd;
    const daysRemaining = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : undefined;

    return {
      status: result.subscription.status,
      planName: result.plan.name,
      isActive: result.hasAccess,
      expiresAt: expiresAt.toISOString(),
      daysRemaining,
      needsAttention: ['past_due', 'expired', 'cancelled'].includes(result.subscription.status)
    };
  }
}

export const subscriptionMiddleware = new SubscriptionMiddleware();
