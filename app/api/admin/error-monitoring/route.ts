/**
 * Error Monitoring API Endpoint
 * Provides real-time error monitoring and health status
 * Requirements: 5.4, 4.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { errorMonitoringService } from '@/lib/error-monitoring-service';

/**
 * GET - Get error monitoring status and health checks
 */
export async function GET() {
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
    const { data: userData } = await supabase.auth.getUser();
    // console.log(userData);
    if (userData.user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get health status and active alerts
    const healthStatus = errorMonitoringService.getHealthStatus();
    const activeAlerts = errorMonitoringService.getActiveAlerts();

    // Calculate overall system health
    const overallHealth = healthStatus.every(check => check.status === 'healthy') 
      ? 'healthy' 
      : healthStatus.some(check => check.status === 'unhealthy')
      ? 'unhealthy'
      : 'degraded';

    return NextResponse.json({
      success: true,
      data: {
        overallHealth,
        healthStatus,
        activeAlerts,
        summary: {
          totalServices: healthStatus.length,
          healthyServices: healthStatus.filter(s => s.status === 'healthy').length,
          degradedServices: healthStatus.filter(s => s.status === 'degraded').length,
          unhealthyServices: healthStatus.filter(s => s.status === 'unhealthy').length,
          activeAlertsCount: activeAlerts.length,
        },
      },
    });
  } catch (error) {
    console.error('Error monitoring API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch monitoring data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Acknowledge or resolve alerts
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

    const { action, alertId } = await request.json();

    if (!action || !alertId) {
      return NextResponse.json(
        { error: 'Action and alert ID are required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'acknowledge':
        errorMonitoringService.acknowledgeAlert(alertId);
        break;
      case 'resolve':
        errorMonitoringService.resolveAlert(alertId);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "acknowledge" or "resolve"' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Alert ${action}d successfully`,
    });
  } catch (error) {
    console.error('Alert action API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to perform alert action',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
