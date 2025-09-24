import { createClient } from "@/lib/supabase/server";
import { subscriptionService } from "@/lib/subscription-service";
import { usageTrackingService } from "@/lib/usage-tracking-service";
import { BillingDashboardData } from "@/types/subscription";

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

    // Get current subscription
    const subscription = await subscriptionService.getCurrentSubscription(user.id);
    
    if (!subscription) {
      return new Response(
        JSON.stringify({ error: "No subscription found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get current usage stats
    const usage = await usageTrackingService.getCurrentUsage(user.id);

    // Get available plans
    const availablePlans = await subscriptionService.getAvailablePlans();

    // Get subscription details from LemonSqueezy if available
    let paymentMethod;
    let nextBillingDate;
    
    if (subscription.lemonsqueezySubscriptionId) {
      try {
        const lemonSqueezySubscription = await subscriptionService.getSubscriptionFromLemonSqueezy(
          subscription.lemonsqueezySubscriptionId
        );
        
        // Extract payment method info
        if (lemonSqueezySubscription.data.attributes.card_brand && 
            lemonSqueezySubscription.data.attributes.card_last_four) {
          paymentMethod = {
            brand: lemonSqueezySubscription.data.attributes.card_brand,
            lastFour: lemonSqueezySubscription.data.attributes.card_last_four
          };
        }

        // Extract next billing date
        if (lemonSqueezySubscription.data.attributes.renews_at) {
          nextBillingDate = new Date(lemonSqueezySubscription.data.attributes.renews_at);
        }
      } catch (error) {
        console.warn("Could not fetch LemonSqueezy subscription details:", error);
        // Continue without payment method and billing date info
      }
    }

    // Find current plan details
    const currentPlan = availablePlans.find(plan => plan.id === subscription.planId);
    
    if (!currentPlan) {
      return new Response(
        JSON.stringify({ error: "Current plan not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const billingData: BillingDashboardData = {
      currentPlan,
      subscription,
      usage,
      availablePlans,
      paymentMethod,
      nextBillingDate
    };

    return new Response(
      JSON.stringify({
        success: true,
        billingData
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Get billing information error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to get billing information",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}