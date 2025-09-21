'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BillingDashboard } from '@/components/billing/billing-dashboard';
import { BillingDashboardData } from '@/types/subscription';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CreditCard, Calendar } from 'lucide-react';

export default function BillingPage() {
  const [billingData, setBillingData] = useState<BillingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const message = searchParams.get('message');

  useEffect(() => {
    const fetchBillingData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch current subscription
        const subscriptionResponse = await fetch('/api/subscriptions/current');
        if (!subscriptionResponse.ok) {
          throw new Error('Failed to fetch subscription data');
        }
        const subscriptionData = await subscriptionResponse.json();

        // Fetch current usage
        const usageResponse = await fetch('/api/usage/current');
        if (!usageResponse.ok) {
          throw new Error('Failed to fetch usage data');
        }
        const usageData = await usageResponse.json();

        // Fetch available plans
        const plansResponse = await fetch('/api/subscriptions/plans');
        if (!plansResponse.ok) {
          throw new Error('Failed to fetch plans data');
        }
        const plansData = await plansResponse.json();

        setBillingData({
          currentPlan: subscriptionData.plan,
          subscription: subscriptionData.subscription,
          usage: usageData,
          availablePlans: plansData.plans,
          paymentMethod: subscriptionData.paymentMethod,
          nextBillingDate: subscriptionData.nextBillingDate ? new Date(subscriptionData.nextBillingDate) : undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchBillingData();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid gap-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive">
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!billingData) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Alert>
            <AlertDescription>
              No billing data available.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const getStatusAlert = () => {
    if (!reason && !message) return null;

    const getAlertIcon = () => {
      switch (reason) {
        case 'past_due':
          return <CreditCard className="h-4 w-4" />;
        case 'expired':
        case 'cancelled':
          return <Calendar className="h-4 w-4" />;
        default:
          return <AlertTriangle className="h-4 w-4" />;
      }
    };

    const getAlertVariant = () => {
      switch (reason) {
        case 'past_due':
          return 'destructive';
        case 'expired':
        case 'cancelled':
          return 'default';
        default:
          return 'default';
      }
    };

    return (
      <Alert variant={getAlertVariant()} className="mb-6">
        {getAlertIcon()}
        <AlertDescription>
          {message || 'Please check your subscription status.'}
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Billing & Subscription</h1>
        {getStatusAlert()}
        <BillingDashboard data={billingData} />
      </div>
    </div>
  );
}