"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, Variant, Variants } from "framer-motion";
import { LogOut, Mail, Calendar, Shield, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { ProfileButton } from "@/components/common/profile-button";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";

export default function ProfilePage() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  // Animation variants
  const containerVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 0.98,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.8,
        ease: "easeOut",
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 10,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
      },
    },
  };

  if (loading) {
    return (
      <div className="relative">
        {/* Fixed controls */}
        <div className="fixed top-4 left-4 z-50">
          <ProfileButton />
        </div>
        <div className="fixed top-4 right-4 z-50">
          <ThemeSwitcher />
        </div>

        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
          <div className="w-full max-w-2xl">
            <div className="h-8 w-32 bg-muted animate-pulse rounded mb-4 mx-auto" />
            <div className="h-64 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative">
        <div className="fixed top-4 left-4 z-50">
          <ProfileButton />
        </div>
        <div className="fixed top-4 right-4 z-50">
          <ThemeSwitcher />
        </div>

        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Not Authenticated</CardTitle>
              <CardDescription>
                Please log in to view your profile.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => router.push("/auth/login")}
                className="w-full"
              >
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const profileImageUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    "No name provided";
  const email = user.email || "No email provided";
  const createdAt = user.created_at
    ? new Date(user.created_at).toLocaleDateString()
    : "Unknown";
  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString()
    : "Unknown";
  const emailVerified = user.email_confirmed_at ? "Verified" : "Unverified";

  return (
    <div className="relative">
      {/* Fixed controls */}
      <div className="fixed top-4 left-4 z-50">
        <ProfileButton />
      </div>
      <div className="fixed top-4 right-4 z-50">
        <ThemeSwitcher />
      </div>

      <motion.div
        className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4"
        variants={containerVariants as Variants}
        initial="hidden"
        animate="visible"
      >
        <div className="w-full max-w-2xl space-y-6">
          {/* Profile Header */}
          <motion.div variants={itemVariants as Variants}>
            <Card>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  {profileImageUrl ? (
                    <img
                      src={profileImageUrl}
                      alt="Profile"
                      className="h-24 w-24 rounded-full object-cover border-4 border-background shadow-lg"
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-full bg-primary flex items-center justify-center border-4 border-background shadow-lg">
                      <User className="h-12 w-12 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <CardTitle className="text-2xl">{fullName}</CardTitle>
                <CardDescription className="text-lg">{email}</CardDescription>
                <div className="flex justify-center gap-2 mt-2">
                  <Badge
                    variant={
                      emailVerified === "Verified" ? "default" : "secondary"
                    }
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    {emailVerified}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Account Information */}
          <motion.div variants={itemVariants as Variants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Account Information
                </CardTitle>
                <CardDescription>
                  Your account details and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </div>
                    <p className="font-medium">{email}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Member Since
                    </div>
                    <p className="font-medium">{createdAt}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="h-4 w-4" />
                      Last Sign In
                    </div>
                    <p className="font-medium">{lastSignIn}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      Account Status
                    </div>
                    <Badge
                      variant={
                        user.email_confirmed_at ? "default" : "secondary"
                      }
                    >
                      {user.email_confirmed_at
                        ? "Active"
                        : "Pending Verification"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Actions */}
          <motion.div variants={itemVariants as Variants}>
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
                <CardDescription>Manage your account settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.push("/protected")}
                  >
                    Back to Dashboard
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
