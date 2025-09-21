'use client';

import { useState } from 'react';
import { SubscriptionPlan, UsageStats } from '@/types/subscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PlanComparisonProps {
  currentPlan: SubscriptionPlan;
  availablePlans: SubscriptionPlan[];
  usage: UsageStats;
  onPlanChange: (planId: string) => Promise<void>;
}

export function PlanComparison({ 
  currentPlan, 
  availablePlans, 
  usage, 
  onPlanChange 
}: PlanComparisonProps) {
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePlanChange = async (planId: string) => {
    if (planId === currentPlan.id) return;

    try {
      setChangingPlan(planId);
      setError(null);
      await onPlanChange(planId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change plan');
    } finally {
      setChangingPlan(null);
    }
  };

  const createCheckoutSession = async (planId: string) => {
    try {
      setChangingPlan(planId);
      setError(null);

      const response = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          planId,
          successUrl: `${window.location.origin}/protected/billing?success=true`,
          cancelUrl: `${window.location.origin}/protected/billing?cancelled=true`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { checkoutUrl } = await response.json();
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setChangingPlan(null);
    }
  };

  const isCurrentPlan = (planId: string) => planId === currentPlan.id;
  const isFreePlan = (plan: SubscriptionPlan) => plan.priceMonthly === 0;
  const isUpgrade = (plan: SubscriptionPlan) => plan.priceMonthly > currentPlan.priceMonthly;
  const isDowngrade = (plan: SubscriptionPlan) => plan.priceMonthly < currentPlan.priceMonthly;

  const wouldExceedLimits = (plan: SubscriptionPlan) => {
    if (plan.memoryLimit === -1 && plan.fileLimit === -1) return false;
    return (
      (plan.memoryLimit !== -1 && usage.memoryCount > plan.memoryLimit) ||
      (plan.fileLimit !== -1 && usage.fileCount > plan.fileLimit)
    );
  };

  const getButtonText = (plan: SubscriptionPlan) => {
    if (isCurrentPlan(plan.id)) return 'Current Plan';
    if (isFreePlan(currentPlan) && !isFreePlan(plan)) return 'Subscribe';
    if (isUpgrade(plan)) return 'Upgrade';
    if (isDowngrade(plan)) return 'Downgrade';
    return 'Switch Plan';
  };

  const getButtonVariant = (plan: SubscriptionPlan) => {
    if (isCurrentPlan(plan.id)) return 'outline';
    if (isUpgrade(plan)) return 'default';
    return 'outline';
  };

  const sortedPlans = [...availablePlans].sort((a, b) => a.priceMonthly - b.priceMonthly);

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {sortedPlans.map((plan) => (
          <Card 
            key={plan.id} 
            className={`relative ${isCurrentPlan(plan.id) ? 'ring-2 ring-primary' : ''}`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                {isCurrentPlan(plan.id) && (
                  <Badge variant="default">Current</Badge>
                )}
              </div>
              <div className="text-3xl font-bold">
                ${plan.priceMonthly}
                <span className="text-sm font-normal text-muted-foreground">
                  /month
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">
                    {plan.memoryLimit === -1 ? 'Unlimited' : plan.memoryLimit.toLocaleString()} memory records
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">
                    {plan.fileLimit === -1 ? 'Unlimited' : plan.fileLimit.toLocaleString()} file records
                  </span>
                </div>
              </div>

              {wouldExceedLimits(plan) && (
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                  Warning: Your current usage exceeds this plan's limits
                </div>
              )}

              <Button
                className="w-full"
                variant={getButtonVariant(plan)}
                disabled={isCurrentPlan(plan.id) || changingPlan !== null}
                onClick={() => {
                  if (isFreePlan(currentPlan) && !isFreePlan(plan)) {
                    createCheckoutSession(plan.id);
                  } else {
                    handlePlanChange(plan.id);
                  }
                }}
              >
                {changingPlan === plan.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  getButtonText(plan)
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>
          All plans include secure data storage, encryption, and 24/7 support.
        </p>
        <p className="mt-1">
          You can upgrade or downgrade your plan at any time.
        </p>
      </div>
    </div>
  );
}