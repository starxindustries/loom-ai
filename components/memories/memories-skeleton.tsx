'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export function MemoriesSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>

      {/* Memory Cards Skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border-l-4 border-l-primary/20">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Memory Formation Visualization Skeleton */}
                  <div className="relative mb-6">
                    {/* Brain Icon Skeleton */}
                    <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                      <Skeleton className="h-12 w-12 rounded-full" />
                    </div>

                    {/* Keywords arranged in a circle skeleton */}
                    <div className="relative h-32 flex items-center justify-center">
                      {/* Circular arrangement of keyword skeletons */}
                      <Skeleton className="absolute h-6 w-16 rounded-full" style={{ left: 'calc(50% + 30px)', top: 'calc(50% - 12px)' }} />
                      <Skeleton className="absolute h-6 w-20 rounded-full" style={{ left: 'calc(50% - 10px)', top: 'calc(50% - 30px)' }} />
                      <Skeleton className="absolute h-6 w-14 rounded-full" style={{ left: 'calc(50% - 50px)', top: 'calc(50% - 12px)' }} />
                      <Skeleton className="absolute h-6 w-18 rounded-full" style={{ left: 'calc(50% - 10px)', top: 'calc(50% + 20px)' }} />
                    </div>

                    {/* Memory Formation Indicator Skeleton */}
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>

                  {/* Secondary Info Skeleton */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>

                {/* Actions Skeleton */}
                <div className="flex items-center gap-2 ml-4">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination Skeleton */}
      <div className="flex items-center justify-center gap-2 pt-4">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-16" />
      </div>
    </div>
  );
}
