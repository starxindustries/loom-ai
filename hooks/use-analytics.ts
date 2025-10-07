import { useState, useEffect } from 'react';

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

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/analytics');
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch analytics data');
      }
      
      setData(result.data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchAnalyticsData
  };
}
