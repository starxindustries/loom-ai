'use client';

import { SubscriptionPlan, UserSubscription } from '@/types/subscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, CreditCard } from 'lucide-react';

interface CurrentPlanCardProps {
  plan: SubscriptionPlan;
  subscription: UserSubscription;
  paymentMethod?: {
    brand: string;
    lastFour: string;
  };
  nextBillingDate?: Date;
}

export function CurrentPlanCard({ 
  plan, 
  subscription, 
  paymentMethod, 
  nextBillingDate 
}: CurrentPlanCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'cancelled':
        return 'destructive';
      case 'expired':
        return 'destructive';
      case 'past_due':
        return 'destructive';
      case 'trialing':
        return 'secondary';
      case 'paused':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'cancelled':
        return 'Cancelled';
      case 'expired':
        return 'Expired';
      case 'past_due':
        return 'Past Due';
      case 'trialing':
        return 'Trial';
      case 'paused':
        return 'Paused';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Current Plan</CardTitle>
          <Badge variant={getStatusColor(subscription.status)}>
            {getStatusText(subscription.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-2xl font-bold">{plan.name}</h3>
          <p className="text-muted-foreground">
            ${plan.priceMonthly}/month
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Memory Records</span>
            <span>{plan.memoryLimit === -1 ? 'Unlimited' : plan.memoryLimit.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">File Records</span>
            <span>{plan.fileLimit === -1 ? 'Unlimited' : plan.fileLimit.toLocaleString()}</span>
          </div>
        </div>

        {nextBillingDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Next billing: {formatDate(nextBillingDate)}</span>
          </div>
        )}

        {paymentMethod && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            <span>
              {paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)} 
              •••• {paymentMethod.lastFour}
            </span>
          </div>
        )}

        {subscription.cancelAtPeriodEnd && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              Your subscription will be cancelled at the end of the current billing period.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}