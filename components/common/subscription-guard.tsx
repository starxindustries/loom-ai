'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CreditCard, Calendar, Zap } from 'lucide-react';
import { subscriptionMiddleware } from '@/lib/subscription-middleware';

interface SubscriptionGuardProps {
  children: ReactNode;
  requireActiveSubscription?: boolean;
  requiredPlanSlug?: string;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

interface SubscriptionStatus {
  status: string;
  planName: string;
  isActive: boolean;
  expiresAt?: string;
  daysRemaining?: number;
  needsAttention: boolean;
}

export function SubscriptionGuard({
  children,
  requireActiveSubscription = false,
  requiredPlanSlug,
  fallback,
  showUpgradePrompt = true
}: SubscriptionGuardProps) {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      setIsLoading(true);
      
      // Get user ID from session (simplified approach)
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        setHasAccess(false);
        return;
      }

      const { user } = await response.json();
      if (!user?.id) {
        setHasAccess(false);
        return;
      }

      // Check subscription access
      const result = requiredPlanSlug 
        ? await subscriptionMiddleware.checkPlanAccess(user.id, requiredPlanSlug)
        : await subscriptionMiddleware.checkPremiumAccess(user.id);

      setHasAccess(result.hasAccess);

      // Get detailed status for display
      const status = await subscriptionMiddleware.getSubscriptionStatus(user.id);
      setSubscriptionStatus(status);

    } catch (error) {
      console.error('Error checking subscription status:', error);
      setHasAccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = () => {
    router.push('/protected/billing?tab=plans');
  };

  const handleManagePayment = () => {
    router.push('/protected/billing?tab=payment');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Checking subscription status...</span>
      </div>
    );
  }

  // If subscription is not required, show children
  if (!requireActiveSubscription && !requiredPlanSlug) {
    return <>{children}</>;
  }

  // If user has access, show children
  if (hasAccess) {
    return <>{children}</>;
  }

  // Show fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Show upgrade prompt
  if (showUpgradePrompt) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <CardTitle>Subscription Required</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscriptionStatus && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Current Plan:</span>
                  <Badge variant={subscriptionStatus.isActive ? "default" : "destructive"}>
                    {subscriptionStatus.planName}
                  </Badge>
                </div>
                
                {subscriptionStatus.status === 'past_due' && (
                  <Alert variant="destructive">
                    <CreditCard className="h-4 w-4" />
                    <AlertDescription>
                      Your payment failed. Please update your payment method to restore access.
                    </AlertDescription>
                  </Alert>
                )}

                {subscriptionStatus.status === 'cancelled' && subscriptionStatus.daysRemaining && subscriptionStatus.daysRemaining > 0 && (
                  <Alert>
                    <Calendar className="h-4 w-4" />
                    <AlertDescription>
                      Your subscription is cancelled but you still have access for {subscriptionStatus.daysRemaining} more days.
                    </AlertDescription>
                  </Alert>
                )}

                {subscriptionStatus.status === 'expired' && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Your subscription has expired. Please resubscribe to access this feature.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {requiredPlanSlug 
                  ? `This feature requires a ${requiredPlanSlug} plan or higher.`
                  : 'This feature requires an active subscription.'
                }
              </p>

              <div className="flex gap-2">
                <Button onClick={handleUpgrade} className="flex-1">
                  <Zap className="h-4 w-4 mr-2" />
                  {subscriptionStatus?.status === 'past_due' ? 'Update Payment' : 'Upgrade Plan'}
                </Button>
                
                {subscriptionStatus?.status === 'past_due' && (
                  <Button variant="outline" onClick={handleManagePayment}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Manage Payment
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If no upgrade prompt should be shown, return null
  return null;
}

/**
 * Hook to check subscription access
 */
export function useSubscriptionAccess() {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        setHasAccess(false);
        return;
      }

      const { user } = await response.json();
      if (!user?.id) {
        setHasAccess(false);
        return;
      }

      const result = await subscriptionMiddleware.checkPremiumAccess(user.id);
      setHasAccess(result.hasAccess);

      const status = await subscriptionMiddleware.getSubscriptionStatus(user.id);
      setSubscriptionStatus(status);

    } catch (error) {
      console.error('Error checking subscription access:', error);
      setHasAccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  const canAccessFeature = async (feature: string) => {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) return false;

      const { user } = await response.json();
      if (!user?.id) return false;

      const result = await subscriptionMiddleware.canAccessFeature(user.id, feature);
      return result.canAccess;
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  };

  return {
    subscriptionStatus,
    isLoading,
    hasAccess,
    canAccessFeature,
    refresh: checkAccess
  };
}
