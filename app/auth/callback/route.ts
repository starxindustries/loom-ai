import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const mode = searchParams.get("mode"); // "login" or "signup"
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get("next") ?? "/protected";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user) {
      // Check if this is a new user (first time signup)
      const isNewUser = data.user.created_at === data.user.updated_at;
      
      console.log("Auth callback debug:", {
        mode,
        isNewUser,
        createdAt: data.user.created_at,
        updatedAt: data.user.updated_at,
        userId: data.user.id
      });
      
      // Determine redirect URL based on mode and user status
      let redirectUrl = next;
      if (mode === "signup" || isNewUser) {
        // For new users or explicit signup, redirect to setup encryption
        // The database trigger will have already created the profile with is_new=true
        redirectUrl = "/protected?encryption=setup&new_user=true";
        console.log("Redirecting to setup:", redirectUrl);
      } else {
        // For existing users logging in, check encryption status
        redirectUrl = "/protected?encryption=check";
        console.log("Redirecting to check:", redirectUrl);
      }

      const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${redirectUrl}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${redirectUrl}`);
      } else {
        return NextResponse.redirect(`${origin}${redirectUrl}`);
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error`);
}
