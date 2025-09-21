import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { subscriptionService } from "@/lib/subscription-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId } = body;

    if (!planId) {
      return new Response(
        JSON.stringify({ error: "Plan ID is required" }),
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

    await subscriptionService.changePlan(user.id, planId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Plan changed successfully"
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Change plan error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to change plan",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}