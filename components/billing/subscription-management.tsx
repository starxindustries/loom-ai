'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/date-utils';
import { UserSubscription, SubscriptionPlan } from '@/types/subscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { 
  CreditCard, 
  Calendar, 
  AlertTriangle, 
  Loader2, 
  ExternalLink,
  Settings,
  Trash2
} from 'lucide-react';

interface SubscriptionManagementProps {
  subscription: UserSubscription;
  currentPlan: SubscriptionPlan;
  onCancelSubscription: () => Promise<void>;
}

export function SubscriptionManagement({ 
  subscription, 
  currentPlan, 
  onCancelSubscription 
}: SubscriptionManagementProps) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isManagingPayment, setIsManagingPayment] = useState(false);

  const handleCancelSubscription = async () => {
    try {
      setIsCancelling(true);
      setError(null);
      await onCancelSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleManagePayment = async () => {
    try {
      setIsManagingPayment(true);
      setError(null);

      const response = await fetch('/api/subscriptions/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create customer portal session');
      }

      const { portalUrl } = await response.json();
      window.open(portalUrl, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open payment management');
    } finally {
      setIsManagingPayment(false);
    }
  };

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

  // Using formatDate from date utilities

  const canCancel = subscription.status === 'active' && !subscription.cancelAtPeriodEnd;
  const canManagePayment = subscription.status === 'active' && subscription.lemonsqueezySubscriptionId;

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Subscription Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Subscription Management</CardTitle>
            <Badge variant={getStatusColor(subscription.status)}>
              {getStatusText(subscription.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-1">Current Plan</h4>
              <p className="text-lg font-semibold">{currentPlan.name}</p>
              <p className="text-sm text-muted-foreground">
                ${currentPlan.priceMonthly}/month
              </p>
            </div>
            
            {subscription.currentPeriodEnd && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Billing Period</h4>
                <p className="text-sm">
                  {formatDate(subscription.currentPeriodStart || new Date())} - {formatDate(subscription.currentPeriodEnd)}
                </p>
              </div>
            )}
          </div>

          {subscription.cancelAtPeriodEnd && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your subscription will be cancelled at the end of the current billing period on{' '}
                {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'the next billing date'}.
                You will continue to have access to all features until then.
              </AlertDescription>
            </Alert>
          )}

          {subscription.status === 'past_due' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your payment failed. Please update your payment method to continue using the service.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="grid gap-4 md:grid-cols-2">
        {canManagePayment && (
          <Button
            variant="outline"
            onClick={handleManagePayment}
            disabled={isManagingPayment}
            className="w-full"
          >
            {isManagingPayment ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Opening...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Manage Payment Method
              </>
            )}
          </Button>
        )}

        {canCancel && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="h-4 w-4 mr-2" />
                Cancel Subscription
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to cancel your subscription? You will continue to have access 
                  to all features until the end of your current billing period on{' '}
                  {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'the next billing date'}.
                  <br /><br />
                  You can reactivate your subscription at any time before the end of the billing period.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancelSubscription}
                  disabled={isCancelling}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Cancelling...
                    </>
                  ) : (
                    'Yes, Cancel Subscription'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            If you need to make changes to your subscription or have questions about billing, 
            you can manage your account through our customer portal.
          </p>
          
          <div className="flex items-center gap-2 text-sm">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              For technical support or questions, please contact our support team.
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Billing cycles are monthly and automatically renew unless cancelled.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
