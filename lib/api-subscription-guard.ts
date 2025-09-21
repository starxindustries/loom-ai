/**
 * API Subscription Guard
 * Higher-order function to protect API routes with subscription checks
 */

import { NextRequest, NextResponse } from 'next/server';
import { subscriptionMiddleware } from './subscription-middleware';

export interface APISubscriptionGuardOptions {
  requireActiveSubscription?: boolean;
  requiredPlanSlug?: string;
  allowGracePeriod?: boolean;
  customErrorMessage?: string;
}

/**
 * Higher-order function to wrap API route handlers with subscription checks
 */
export function withSubscriptionGuard(
  handler: (request: NextRequest, userId: string, subscription: any) => Promise<NextResponse>,
  options: APISubscriptionGuardOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    return subscriptionMiddleware.withSubscriptionCheck(
      request,
      handler,
      {
        requireActiveSubscription: options.requireActiveSubscription,
        requiredPlanSlug: options.requiredPlanSlug,
        allowGracePeriod: options.allowGracePeriod
      }
    );
  };
}

/**
 * Decorator for API routes that require active subscription
 */
export function requireActiveSubscription(
  handler: (request: NextRequest, userId: string, subscription: any) => Promise<NextResponse>
) {
  return withSubscriptionGuard(handler, { requireActiveSubscription: true });
}

/**
 * Decorator for API routes that require specific plan
 */
export function requirePlan(planSlug: string) {
  return function(
    handler: (request: NextRequest, userId: string, subscription: any) => Promise<NextResponse>
  ) {
    return withSubscriptionGuard(handler, { requiredPlanSlug: planSlug });
  };
}

/**
 * Decorator for API routes that allow grace period for cancelled subscriptions
 */
export function allowGracePeriod(
  handler: (request: NextRequest, userId: string, subscription: any) => Promise<NextResponse>
) {
  return withSubscriptionGuard(handler, { 
    requireActiveSubscription: true, 
    allowGracePeriod: true 
  });
}

/**
 * Utility function to create subscription error responses
 */
export function createSubscriptionErrorResponse(
  reason: string,
  message: string,
  redirectUrl?: string,
  status: number = 403
): NextResponse {
  return NextResponse.json(
    {
      error: "Subscription required",
      reason,
      message,
      redirectUrl
    },
    { status }
  );
}

/**
 * Utility function to check if a user has access to a feature
 */
export async function checkFeatureAccess(
  userId: string,
  feature: string
): Promise<{ canAccess: boolean; reason?: string; upgradeRequired?: boolean }> {
  return subscriptionMiddleware.canAccessFeature(userId, feature);
}

/**
 * Utility function to get subscription status
 */
export async function getSubscriptionStatus(userId: string) {
  return subscriptionMiddleware.getSubscriptionStatus(userId);
}
