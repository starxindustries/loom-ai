import { updateSession } from "@/lib/supabase/middleware";
import { subscriptionMiddleware } from "@/lib/subscription-middleware";
import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // First, handle authentication
  const authResponse = await updateSession(request);
  
  // If auth failed, return the auth response
  if (authResponse.status !== 200) {
    return authResponse;
  }

  // Check for subscription requirements on protected routes
  const { pathname } = request.nextUrl;
  
  // Define routes that require active subscription
  const premiumRoutes = [
    '/protected',
    '/protected/memories',
    '/protected/example'
  ];

  // Define routes that require specific plans
  const planRequirements: Record<string, string> = {
    '/protected/advanced-ai': 'pro',
    '/protected/api-access': 'pro',
    '/protected/white-label': 'pro-plus'
  };

  // Check if current path requires subscription
  const requiresSubscription = premiumRoutes.some(route => pathname.startsWith(route));
  const requiredPlan = planRequirements[pathname];

  if (requiresSubscription || requiredPlan) {
    try {
      // Get user from the request (this is a simplified approach)
      // In a real implementation, you'd extract the user from the auth response
      const supabase = await createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        // Redirect to login if not authenticated
        const loginUrl = new URL('/auth/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Check subscription status
      const subscriptionResult = requiredPlan 
        ? await subscriptionMiddleware.checkPlanAccess(user.id, requiredPlan)
        : await subscriptionMiddleware.checkPremiumAccess(user.id);

      if (!subscriptionResult.hasAccess) {
        // Redirect to billing page with appropriate message
        const billingUrl = new URL('/protected/billing', request.url);
        billingUrl.searchParams.set('tab', 'plans');
        billingUrl.searchParams.set('reason', subscriptionResult.reason || 'subscription_required');
        billingUrl.searchParams.set('message', subscriptionResult.message || '');
        
        return NextResponse.redirect(billingUrl);
      }

      // Add subscription info to headers for the page to use
      const response = NextResponse.next();
      response.headers.set('x-subscription-status', subscriptionResult.subscription?.status || 'none');
      response.headers.set('x-plan-slug', subscriptionResult.plan?.slug || 'free');
      
      return response;
    } catch (error) {
      console.error('Subscription middleware error:', error);
      // On error, allow access but log the issue
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    // Exclude api/webhooks (e.g., LemonSqueezy) from middleware to prevent 307/redirects & body tampering
    "/((?!api/webhooks|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
