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

    const plans = await subscriptionService.getAvailablePlans();

    return new Response(
      JSON.stringify({
        success: true,
        plans
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Get available plans error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to get available plans",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}