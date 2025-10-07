'use client';

import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { useAnalytics } from '@/hooks/use-analytics';

export default function AnalyticsPage() {
  const { data, loading, error, refetch } = useAnalytics();

  return (
    <div className="container mx-auto py-8 px-4">
      <AnalyticsDashboard
      data={data}
      loading={loading}
      error={error}
      onRefresh={refetch}
      showTitle={true}
      compact={false}
      />
      </div>
    );
  }