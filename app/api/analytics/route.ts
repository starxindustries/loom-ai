import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { usageTrackingService } from '../../../lib/usage-tracking-service';
import { subscriptionService } from '../../../lib/subscription-service';

export async function GET(request: NextRequest) {
  try {
    // Get user from authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get current usage stats
    const usageStats = await usageTrackingService.getCurrentUsage(user.id);
    
    // Get subscription info for plan details
    const subscription = await subscriptionService.getCurrentSubscription(user.id);
    
    // Get historical usage data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: historicalData, error: historicalError } = await supabase
      .from('usage_tracking')
      .select('memory_count, file_count, created_at, updated_at')
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    if (historicalError) {
      console.warn('Could not fetch historical data:', historicalError.message);
    }

    // Get memory records count
    const { count: memoryCount, error: memoryError } = await supabase
      .from('encrypted_memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (memoryError) {
      console.warn('Could not fetch memory count:', memoryError.message);
    }

    // Get file records count
    const { count: fileCount, error: fileError } = await supabase
      .from('encrypted_user_files')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (fileError) {
      console.warn('Could not fetch file count:', fileError.message);
    }

    // Calculate usage trends
    const currentDate = new Date();
    const lastWeek = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get memory creation trends
    const { data: memoryTrends, error: memoryTrendsError } = await supabase
      .from('encrypted_memories')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', lastMonth.toISOString())
      .order('created_at', { ascending: true });

    // Get file upload trends
    const { data: fileTrends, error: fileTrendsError } = await supabase
      .from('encrypted_user_files')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', lastMonth.toISOString())
      .order('created_at', { ascending: true });

    // Process trends data
    const processTrends = (data: any[], days: number) => {
      const trends = Array.from({ length: days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - 1 - i));
        const dateStr = date.toISOString().split('T')[0];
        return {
          date: dateStr,
          count: 0
        };
      });

      data?.forEach(item => {
        const itemDate = new Date(item.created_at).toISOString().split('T')[0];
        const trend = trends.find(t => t.date === itemDate);
        if (trend) {
          trend.count++;
        }
      });

      return trends;
    };

    const memoryTrendsData = processTrends(memoryTrends || [], 30);
    const fileTrendsData = processTrends(fileTrends || [], 30);

    // Calculate weekly and monthly stats
    const weeklyMemoryCount = memoryTrends?.filter(m => 
      new Date(m.created_at) >= lastWeek
    ).length || 0;

    const weeklyFileCount = fileTrends?.filter(f => 
      new Date(f.created_at) >= lastWeek
    ).length || 0;

    const monthlyMemoryCount = memoryTrends?.length || 0;
    const monthlyFileCount = fileTrends?.length || 0;

    return NextResponse.json({
      success: true,
      data: {
        currentUsage: usageStats,
        subscription: subscription,
        totals: {
          memoryCount: memoryCount || 0,
          fileCount: fileCount || 0
        },
        trends: {
          memory: memoryTrendsData,
          files: fileTrendsData
        },
        periods: {
          weekly: {
            memory: weeklyMemoryCount,
            files: weeklyFileCount
          },
          monthly: {
            memory: monthlyMemoryCount,
            files: monthlyFileCount
          }
        },
        historicalData: historicalData || []
      }
    });
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: 'Failed to fetch analytics data' 
      },
      { status: 500 }
    );
  }
}
