'use client';

import { UsageStats } from '@/types/subscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Database, FileText } from 'lucide-react';

interface UsageStatsCardProps {
  usage: UsageStats;
}

export function UsageStatsCard({ usage }: UsageStatsCardProps) {
  const getUsagePercentage = (current: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((current / limit) * 100, 100);
  };

  const formatUsage = (current: number, limit: number) => {
    if (limit === -1) {
      return `${current.toLocaleString()} / Unlimited`;
    }
    return `${current.toLocaleString()} / ${limit.toLocaleString()}`;
  };

  const memoryPercentage = getUsagePercentage(usage.memoryCount, usage.memoryLimit);
  const filePercentage = getUsagePercentage(usage.fileCount, usage.fileLimit);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage Statistics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Memory Records</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {formatUsage(usage.memoryCount, usage.memoryLimit)}
            </span>
          </div>
          {usage.memoryLimit !== -1 && (
            <div className="space-y-1">
              <Progress value={memoryPercentage} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{memoryPercentage.toFixed(1)}% used</span>
                {memoryPercentage >= 90 && (
                  <span className="text-red-600 font-medium">
                    Approaching limit
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">File Records</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {formatUsage(usage.fileCount, usage.fileLimit)}
            </span>
          </div>
          {usage.fileLimit !== -1 && (
            <div className="space-y-1">
              <Progress value={filePercentage} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{filePercentage.toFixed(1)}% used</span>
                {filePercentage >= 90 && (
                  <span className="text-red-600 font-medium">
                    Approaching limit
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            Usage resets on: {new Intl.DateTimeFormat('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }).format(usage.lastResetAt)}
          </p>
        </div>

        {(memoryPercentage >= 90 || filePercentage >= 90) && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              You&apos;re approaching your usage limits. Consider upgrading your plan to avoid interruptions.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}