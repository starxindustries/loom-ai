'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Calendar } from 'lucide-react';

interface TrendData {
  date: string;
  count: number;
}

interface UsageTrendsChartProps {
  memoryTrends: TrendData[];
  fileTrends: TrendData[];
}

export function UsageTrendsChart({ memoryTrends, fileTrends }: UsageTrendsChartProps) {
  // Calculate total activity for the period
  const totalMemoryActivity = memoryTrends.reduce((sum, day) => sum + day.count, 0);
  const totalFileActivity = fileTrends.reduce((sum, day) => sum + day.count, 0);
  
  // Find peak activity days
  const peakMemoryDay = memoryTrends.reduce((peak, day) => 
    day.count > peak.count ? day : peak, { date: '', count: 0 }
  );
  const peakFileDay = fileTrends.reduce((peak, day) => 
    day.count > peak.count ? day : peak, { date: '', count: 0 }
  );

  // Calculate average daily activity
  const avgMemoryPerDay = (totalMemoryActivity / memoryTrends.length).toFixed(1);
  const avgFilePerDay = (totalFileActivity / fileTrends.length).toFixed(1);

  // Get last 7 days for recent activity
  const recentMemoryTrends = memoryTrends.slice(-7);
  const recentFileTrends = fileTrends.slice(-7);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Memory Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Memory Activity Trends
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{totalMemoryActivity}</div>
              <div className="text-xs text-muted-foreground">Total Activity</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{avgMemoryPerDay}</div>
              <div className="text-xs text-muted-foreground">Avg/Day</div>
            </div>
          </div>

          {peakMemoryDay.count > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium">Peak Activity Day</div>
              <div className="text-xs text-muted-foreground">
                {new Date(peakMemoryDay.date).toLocaleDateString()} - {peakMemoryDay.count} memories
              </div>
            </div>
          )}

          {/* Simple bar chart representation */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Last 7 Days</div>
            <div className="flex items-end gap-1 h-20">
              {recentMemoryTrends.map((day, index) => {
                const maxCount = Math.max(...recentMemoryTrends.map(d => d.count));
                const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-primary rounded-t"
                      style={{ height: `${height}%` }}
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(day.date).getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            File Activity Trends
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{totalFileActivity}</div>
              <div className="text-xs text-muted-foreground">Total Activity</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{avgFilePerDay}</div>
              <div className="text-xs text-muted-foreground">Avg/Day</div>
            </div>
          </div>

          {peakFileDay.count > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium">Peak Activity Day</div>
              <div className="text-xs text-muted-foreground">
                {new Date(peakFileDay.date).toLocaleDateString()} - {peakFileDay.count} files
              </div>
            </div>
          )}

          {/* Simple bar chart representation */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Last 7 Days</div>
            <div className="flex items-end gap-1 h-20">
              {recentFileTrends.map((day, index) => {
                const maxCount = Math.max(...recentFileTrends.map(d => d.count));
                const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-primary rounded-t"
                      style={{ height: `${height}%` }}
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(day.date).getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
