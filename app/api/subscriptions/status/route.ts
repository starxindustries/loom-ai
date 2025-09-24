import { createClient } from "@/lib/supabase/server";
import { subscriptionService } from "@/lib/subscription-service";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const subscription = await subscriptionService.getCurrentSubscription(user.id);
    
    // Return basic status information
    const status = {
      hasActiveSubscription: !!subscription && subscription.status === 'active',
      subscriptionStatus: subscription?.status || 'none',
      planSlug: subscription ? 
        (await subscriptionService.getAvailablePlans())
          .find(plan => plan.id === subscription.planId)?.slug || 'unknown'
        : 'free',
      expiresAt: subscription?.currentPeriodEnd,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false
    };

    return new Response(
      JSON.stringify({
        success: true,
        status
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Get subscription status error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to get subscription status",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}