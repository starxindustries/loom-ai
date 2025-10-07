'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Zap, Clock, Target } from 'lucide-react';

interface AnalyticsSummaryProps {
  currentUsage: {
    memoryCount: number;
    fileCount: number;
    memoryLimit: number;
    fileLimit: number;
    lastResetAt: Date;
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

export function AnalyticsSummary({ currentUsage, periods }: AnalyticsSummaryProps) {
  // Calculate usage efficiency
  const memoryEfficiency = currentUsage.memoryLimit > 0 
    ? ((currentUsage.memoryCount / currentUsage.memoryLimit) * 100).toFixed(1)
    : '0';
  
  const fileEfficiency = currentUsage.fileLimit > 0 
    ? ((currentUsage.fileCount / currentUsage.fileLimit) * 100).toFixed(1)
    : '0';

  // Calculate activity score (combination of weekly and monthly activity)
  const activityScore = Math.min(
    (periods.weekly.memory + periods.weekly.files) * 2 + 
    (periods.monthly.memory + periods.monthly.files) * 0.5,
    100
  );

  // Determine usage status
  const getUsageStatus = () => {
    if (currentUsage.memoryLimit === -1 && currentUsage.fileLimit === -1) {
      return { status: 'unlimited', color: 'bg-green-100 text-green-800' };
    }
    
    const memoryPercent = parseFloat(memoryEfficiency);
    const filePercent = parseFloat(fileEfficiency);
    
    if (memoryPercent >= 90 || filePercent >= 90) {
      return { status: 'critical', color: 'bg-red-100 text-red-800' };
    } else if (memoryPercent >= 75 || filePercent >= 75) {
      return { status: 'warning', color: 'bg-yellow-100 text-yellow-800' };
    } else if (memoryPercent >= 50 || filePercent >= 50) {
      return { status: 'moderate', color: 'bg-blue-100 text-blue-800' };
    } else {
      return { status: 'low', color: 'bg-green-100 text-green-800' };
    }
  };

  const usageStatus = getUsageStatus();

  // Calculate next reset date
  const nextReset = new Date(currentUsage.lastResetAt);
  nextReset.setMonth(nextReset.getMonth() + 1);
  const daysUntilReset = Math.ceil((nextReset.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="grid gap-6 md:grid-cols-4">
      {/* Usage Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Usage Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge className={usageStatus.color}>
              {usageStatus.status.charAt(0).toUpperCase() + usageStatus.status.slice(1)}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Memory: {memoryEfficiency}% | Files: {fileEfficiency}%
          </div>
        </CardContent>
      </Card>

      {/* Activity Score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">{activityScore.toFixed(0)}</div>
          <div className="text-xs text-muted-foreground">Based on recent usage</div>
        </CardContent>
      </Card>

      {/* Weekly Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4" />
            This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            {periods.weekly.memory + periods.weekly.files}
          </div>
          <div className="text-xs text-muted-foreground">
            {periods.weekly.memory} memories, {periods.weekly.files} files
          </div>
        </CardContent>
      </Card>

      {/* Reset Countdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Reset In
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">{daysUntilReset}</div>
          <div className="text-xs text-muted-foreground">days</div>
        </CardContent>
      </Card>
    </div>
  );
}
