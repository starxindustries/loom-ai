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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const subscription = await subscriptionService.getCurrentSubscription(
      user.id
    );
    if (!subscription) {
      return new Response(JSON.stringify({ error: "No subscription found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get available plans to find the current plan
    const availablePlans = await subscriptionService.getAvailablePlans();
    const currentPlan = availablePlans.find(
      (plan) => plan.id === subscription.planId
    );

    if (!currentPlan) {
      return new Response(JSON.stringify({ error: "Current plan not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription,
        plan: currentPlan,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Get current subscription error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to get current subscription",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
