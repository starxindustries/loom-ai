import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { subscriptionMiddleware } from "@/lib/subscription-middleware";

/**
 * POST - Check subscription access for a specific feature or plan
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { feature, requiredPlanSlug } = body;

    if (feature) {
      // Check feature access
      const result = await subscriptionMiddleware.canAccessFeature(user.id, feature);
      
      return NextResponse.json({
        success: true,
        canAccess: result.canAccess,
        reason: result.reason,
        upgradeRequired: result.upgradeRequired
      });
    }

    if (requiredPlanSlug) {
      // Check plan access
      const result = await subscriptionMiddleware.checkPlanAccess(user.id, requiredPlanSlug);
      
      return NextResponse.json({
        success: true,
        hasAccess: result.hasAccess,
        subscription: result.subscription,
        plan: result.plan,
        reason: result.reason,
        message: result.message,
        redirectUrl: result.redirectUrl
      });
    }

    // Check general premium access
    const result = await subscriptionMiddleware.checkPremiumAccess(user.id);
    
    return NextResponse.json({
      success: true,
      hasAccess: result.hasAccess,
      subscription: result.subscription,
      plan: result.plan,
      reason: result.reason,
      message: result.message,
      redirectUrl: result.redirectUrl
    });
  } catch (error) {
    console.error("Check subscription access error:", error);
    return NextResponse.json(
      { 
        error: "Failed to check subscription access",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get current subscription status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const status = await subscriptionMiddleware.getSubscriptionStatus(user.id);
    
    return NextResponse.json({
      success: true,
      status
    });
  } catch (error) {
    console.error("Get subscription status error:", error);
    return NextResponse.json(
      { 
        error: "Failed to get subscription status",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
