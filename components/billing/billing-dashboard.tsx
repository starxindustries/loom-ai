'use client';

import { useState } from 'react';
import { BillingDashboardData } from '@/types/subscription';
import { CurrentPlanCard } from './current-plan-card';
import { UsageStatsCard } from './usage-stats-card';
import { PlanComparison } from './plan-comparison';
import { SubscriptionManagement } from './subscription-management';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BillingDashboardProps {
  data: BillingDashboardData;
}

export function BillingDashboard({ data }: BillingDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const handlePlanChange = async (planId: string) => {
    try {
      const response = await fetch('/api/subscriptions/change-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        throw new Error('Failed to change plan');
      }

      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      console.error('Error changing plan:', error);
      // You might want to show a toast notification here
    }
  };

  const handleCancelSubscription = async () => {
    try {
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      // You might want to show a toast notification here
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="manage">Manage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <CurrentPlanCard 
              plan={data.currentPlan}
              subscription={data.subscription}
              paymentMethod={data.paymentMethod}
              nextBillingDate={data.nextBillingDate}
            />
            <UsageStatsCard usage={data.usage} />
          </div>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <PlanComparison
            currentPlan={data.currentPlan}
            availablePlans={data.availablePlans}
            usage={data.usage}
            onPlanChange={handlePlanChange}
          />
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          <SubscriptionManagement
            subscription={data.subscription}
            currentPlan={data.currentPlan}
            onCancelSubscription={handleCancelSubscription}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}