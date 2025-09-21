/**
 * Error Statistics API Endpoint
 * Provides error monitoring and statistics for admin dashboard
 * Requirements: 5.4, 4.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { errorHandlingService } from '@/lib/error-handling-service';
import { loggingService } from '@/lib/logging-service';

/**
 * GET - Get error statistics and recent errors
 */
export async function GET(request: NextRequest) {
  try {
    // Check if user is admin (in production, you'd want proper admin authentication)
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has admin role from user metadata
    if (user.user_metadata?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const severity = searchParams.get('severity') as any;

    // Parse dates
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    // Get error statistics
    const errorStats = await errorHandlingService.getErrorStatistics(start, end, severity);

    // Get log statistics
    const logStats = await loggingService.getLogStatistics(start, end);

    // Get recent critical errors
    const recentErrors = await errorHandlingService.getErrorStatistics(
      new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      new Date(),
      'critical' as any
    );

    return NextResponse.json({
      success: true,
      data: {
        errors: errorStats,
        logs: logStats,
        recentCriticalErrors: recentErrors.recentErrors,
        summary: {
          totalErrors: errorStats.totalErrors,
          totalLogs: logStats.totalLogs,
          criticalErrors: errorStats.errorsBySeverity.critical || 0,
          highErrors: errorStats.errorsBySeverity.high || 0,
          recentErrors: recentErrors.recentErrors.length,
        },
      },
    });
  } catch (error) {
    console.error('Error statistics API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch error statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Resolve an error
 */
export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has admin role from user metadata
    if (user.user_metadata?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { errorId } = await request.json();

    if (!errorId) {
      return NextResponse.json(
        { error: 'Error ID is required' },
        { status: 400 }
      );
    }

    // Resolve the error
    await errorHandlingService.resolveError(errorId, user.id);

    return NextResponse.json({
      success: true,
      message: 'Error marked as resolved',
    });
  } catch (error) {
    console.error('Resolve error API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to resolve error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
