import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { subscriptionService } from "@/lib/subscription-service";

export async function POST(request: NextRequest) {
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
    
    if (!subscription || !subscription.lemonsqueezySubscriptionId) {
      return new Response(
        JSON.stringify({ error: "No active subscription found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get subscription details from LemonSqueezy to get customer portal URL
    const lemonSqueezySubscription = await subscriptionService.getSubscriptionFromLemonSqueezy(
      subscription.lemonsqueezySubscriptionId
    );

    const customerPortalUrl = lemonSqueezySubscription.data.attributes.urls.customer_portal;

    return new Response(
      JSON.stringify({
        success: true,
        portalUrl: customerPortalUrl
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Get customer portal URL error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to get customer portal URL",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}