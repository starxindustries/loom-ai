'use client';

import { UsageOverviewCard } from './usage-overview-card';
import { UsageTrendsChart } from './usage-trends-chart';
import { AnalyticsSummary } from './analytics-summary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart3, RefreshCw } from 'lucide-react';

interface AnalyticsData {
  currentUsage: {
    memoryCount: number;
    fileCount: number;
    memoryLimit: number;
    fileLimit: number;
    lastResetAt: string;
  };
  subscription: any;
  totals: {
    memoryCount: number;
    fileCount: number;
  };
  trends: {
    memory: Array<{ date: string; count: number }>;
    files: Array<{ date: string; count: number }>;
  };
  periods: {
    weekly: {
      memory: number;
      files: number;
    };
    monthly: {
      memory: number;
      files: number;
    };
  };
  historicalData: any[];
}

interface AnalyticsDashboardProps {
  data: AnalyticsData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  showTitle?: boolean;
  compact?: boolean;
}

export function AnalyticsDashboard({ 
  data, 
  loading, 
  error, 
  onRefresh, 
  showTitle = true,
  compact = false 
}: AnalyticsDashboardProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        {showTitle && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Analytics</h1>
              <p className="text-muted-foreground">Track your memory and file usage</p>
            </div>
          </div>
        )}
        
        <div className="grid gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          </div>
          
          {!compact && (
            <div className="grid gap-6 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-20 mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {showTitle && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Analytics</h1>
              <p className="text-muted-foreground">Track your memory and file usage</p>
            </div>
          </div>
        )}
        
        <Alert variant="destructive">
          <BarChart3 className="h-4 w-4" />
          <AlertDescription>
            {error}
            <button 
              onClick={onRefresh}
              className="ml-2 underline hover:no-underline"
            >
              Try again
            </button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        {showTitle && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Analytics</h1>
              <p className="text-muted-foreground">Track your memory and file usage</p>
            </div>
          </div>
        )}
        
        <Alert>
          <BarChart3 className="h-4 w-4" />
          <AlertDescription>
            No analytics data available. Start using the app to see your usage statistics.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showTitle && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">Track your memory and file usage</p>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {!compact && (
        <AnalyticsSummary 
          currentUsage={{
            ...data.currentUsage,
            lastResetAt: new Date(data.currentUsage.lastResetAt)
          }}
          periods={data.periods}
        />
      )}

      {/* Usage Overview */}
      <UsageOverviewCard 
        currentUsage={{
          ...data.currentUsage,
          lastResetAt: new Date(data.currentUsage.lastResetAt)
        }}
        totals={data.totals}
        periods={data.periods}
      />

      {/* Trends Charts */}
      {!compact && (
        <UsageTrendsChart 
          memoryTrends={data.trends.memory}
          fileTrends={data.trends.files}
        />
      )}

      {/* Additional Insights */}
      {!compact && (
        <Card>
          <CardHeader>
            <CardTitle>Usage Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Memory Usage</h4>
                <p className="text-sm text-muted-foreground">
                  You've created {data.totals.memoryCount} memory records total, with {data.periods.weekly.memory} this week.
                  {data.currentUsage.memoryLimit !== -1 && (
                    <> You're using {((data.currentUsage.memoryCount / data.currentUsage.memoryLimit) * 100).toFixed(1)}% of your limit.</>
                  )}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">File Usage</h4>
                <p className="text-sm text-muted-foreground">
                  You've uploaded {data.totals.fileCount} files total, with {data.periods.weekly.files} this week.
                  {data.currentUsage.fileLimit !== -1 && (
                    <> You're using {((data.currentUsage.fileCount / data.currentUsage.fileLimit) * 100).toFixed(1)}% of your limit.</>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
