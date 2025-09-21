import { NextRequest, NextResponse } from "next/server";
import { subscriptionStatusChecker } from "@/lib/subscription-status-checker";

/**
 * POST - Run subscription status checks
 * This endpoint should be called by a cron job or scheduled task
 */
export async function POST(request: NextRequest) {
  try {
    // In production, you should add authentication/authorization here
    // For now, we'll just check for a simple API key
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.ADMIN_API_TOKEN;
    
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log('Starting subscription status checks...');
    
    await subscriptionStatusChecker.runAllChecks();
    
    // Optionally run cleanup tasks
    await subscriptionStatusChecker.cleanupOldNotifications();

    return NextResponse.json({
      success: true,
      message: "Subscription status checks completed successfully"
    });
  } catch (error) {
    console.error("Subscription status check error:", error);
    return NextResponse.json(
      { 
        error: "Failed to run subscription status checks",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get subscription status check results (for monitoring)
 */
export async function GET(request: NextRequest) {
  try {
    // In production, you should add authentication/authorization here
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.ADMIN_API_TOKEN;
    
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // This is a simple health check endpoint
    return NextResponse.json({
      success: true,
      message: "Subscription status checker is running",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Subscription status check health error:", error);
    return NextResponse.json(
      { 
        error: "Failed to check subscription status checker health",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
