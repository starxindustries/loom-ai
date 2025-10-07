'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Database, FileText, TrendingUp, Calendar } from 'lucide-react';

interface UsageOverviewCardProps {
  currentUsage: {
    memoryCount: number;
    fileCount: number;
    memoryLimit: number;
    fileLimit: number;
    lastResetAt: Date;
  };
  totals: {
    memoryCount: number;
    fileCount: number;
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
}

export function UsageOverviewCard({ currentUsage, totals, periods }: UsageOverviewCardProps) {
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

  const memoryPercentage = getUsagePercentage(currentUsage.memoryCount, currentUsage.memoryLimit);
  const filePercentage = getUsagePercentage(currentUsage.fileCount, currentUsage.fileLimit);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Memory Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Memory Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Usage</span>
              <span className="text-sm text-muted-foreground">
                {formatUsage(currentUsage.memoryCount, currentUsage.memoryLimit)}
              </span>
            </div>
            {currentUsage.memoryLimit !== -1 && (
              <Progress value={memoryPercentage} className="h-2" />
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{memoryPercentage.toFixed(1)}% used</span>
              {memoryPercentage >= 90 && (
                <span className="text-red-600 font-medium">Approaching limit</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{totals.memoryCount}</div>
              <div className="text-xs text-muted-foreground">Total Records</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{periods.weekly.memory}</div>
              <div className="text-xs text-muted-foreground">This Week</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            File Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Usage</span>
              <span className="text-sm text-muted-foreground">
                {formatUsage(currentUsage.fileCount, currentUsage.fileLimit)}
              </span>
            </div>
            {currentUsage.fileLimit !== -1 && (
              <Progress value={filePercentage} className="h-2" />
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{filePercentage.toFixed(1)}% used</span>
              {filePercentage >= 90 && (
                <span className="text-red-600 font-medium">Approaching limit</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{totals.fileCount}</div>
              <div className="text-xs text-muted-foreground">Total Files</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{periods.weekly.files}</div>
              <div className="text-xs text-muted-foreground">This Week</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
