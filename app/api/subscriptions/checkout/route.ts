import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { subscriptionService } from "@/lib/subscription-service";
import { CheckoutSessionRequest } from "@/types/subscription";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, planSlug, successUrl, cancelUrl, customData } = body;

    if (!planId && !planSlug) {
      return new Response(
        JSON.stringify({ error: "Plan ID or Plan Slug is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

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

    // If planSlug is provided, find the plan by slug
    let finalPlanId = planId;
    if (planSlug && !planId) {
      const availablePlans = await subscriptionService.getAvailablePlans();
      const plan = availablePlans.find(p => p.slug === planSlug);
      if (!plan) {
        return new Response(
          JSON.stringify({ error: "Plan not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      finalPlanId = plan.id;
    }

    const checkoutRequest: CheckoutSessionRequest = {
      planId: finalPlanId,
      userId: user.id,
      successUrl,
      cancelUrl,
      customData
    };

    const checkoutSession = await subscriptionService.createCheckoutSession(checkoutRequest);

    return new Response(
      JSON.stringify({
        success: true,
        checkoutSession
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Checkout session creation error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to create checkout session",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}