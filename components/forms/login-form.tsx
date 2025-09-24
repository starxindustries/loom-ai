"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  EyeIcon, 
  EyeOffIcon, 
  ShieldIcon, 
  AlertTriangleIcon,
  InfoIcon
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { GoogleAuthButton } from "@/components/common/google-auth-button";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasEncryptionProfile, setHasEncryptionProfile] = useState<boolean | null>(null);
  const router = useRouter();

  // Check if user has encryption profile after successful login
  const checkEncryptionProfile = async () => {
    try {
      const response = await fetch('/api/user-encryption-profile');
      if (response.ok) {
        const data = await response.json();
        setHasEncryptionProfile(!!data.profile);
        if (data.profile) {
          setInfo("This account has end-to-end encryption enabled.");
        }
      } else if (response.status === 404) {
        setHasEncryptionProfile(false);
        setInfo("You can enable end-to-end encryption after logging in.");
      }
    } catch (error) {
      console.error("Failed to check encryption profile:", error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);
    setInfo(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;

      // Check encryption profile after successful login
      if (data.user) {
        await checkEncryptionProfile();
        
        // Redirect with encryption info
        const encryptionParam = hasEncryptionProfile ? "?encryption=available" : "?encryption=setup";
        router.push("/protected" + encryptionParam);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes("Invalid login credentials")) {
          setError("Invalid email or password. Please check your credentials and try again.");
        } else if (error.message.includes("Email not confirmed")) {
          setError("Please check your email and click the confirmation link before logging in.");
        } else if (error.message.includes("Too many requests")) {
          setError("Too many login attempts. Please wait a few minutes before trying again.");
        } else {
          setError(error.message);
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };


  // Clear info message after a delay
  useEffect(() => {
    if (info) {
      const timer = setTimeout(() => setInfo(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [info]);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            <GoogleAuthButton mode="login" />
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <form onSubmit={handleLogin}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/auth/forgot-password"
                      className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Encryption Status */}
                {hasEncryptionProfile !== null && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <ShieldIcon className={`h-4 w-4 ${hasEncryptionProfile ? 'text-green-600' : 'text-muted-foreground'}`} />
                    <span className="text-sm">
                      {hasEncryptionProfile 
                        ? "This account has end-to-end encryption enabled" 
                        : "End-to-end encryption not set up"
                      }
                    </span>
                    <Badge variant={hasEncryptionProfile ? "default" : "secondary"} className="text-xs">
                      {hasEncryptionProfile ? "Encrypted" : "Standard"}
                    </Badge>
                  </div>
                )}

                {/* Info Message */}
                {info && (
                  <Alert>
                    <InfoIcon className="h-4 w-4" />
                    <AlertDescription>{info}</AlertDescription>
                  </Alert>
                )}

                {/* Error Message */}
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangleIcon className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
              </div>

              <div className="mt-4 text-center text-sm">
                Don&apos;t have an account?{" "}
                <Link
                  href="/auth/sign-up"
                  className="underline underline-offset-4"
                >
                  Sign up
                </Link>
              </div>
            </form>

            {/* Security Notice */}
            <div className="text-xs text-muted-foreground text-center space-y-1">
              <p>🔒 Your connection is secured with TLS encryption</p>
              {hasEncryptionProfile && (
                <p>🛡️ Your personal data is protected with end-to-end encryption</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}