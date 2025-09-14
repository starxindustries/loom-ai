"use client";
import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();

      const { data, error } = await supabase.auth.getClaims();
      if (data && data.claims) {
        toast.loading("You are already Logged-in. Redirecting...", {
          id: "redirect-toast",
        });

        // Simulate a brief delay before redirect
        setTimeout(() => {
          toast.success("Redirecting to Dashboard", {
            id: "redirect-toast",
          });
          redirect("/protected");
        }, 1500);
      }
    };
    checkUser();
  }, []);

  return <div>{children}</div>;
}
