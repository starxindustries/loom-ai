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

    // Get current subscription to find the LemonSqueezy subscription ID
    const currentSubscription = await subscriptionService.getCurrentSubscription(user.id);
    
    if (!currentSubscription || !currentSubscription.lemonsqueezySubscriptionId) {
      return new Response(
        JSON.stringify({ error: "No active subscription found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await subscriptionService.cancelSubscription(currentSubscription.lemonsqueezySubscriptionId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Subscription cancelled successfully"
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to cancel subscription",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}