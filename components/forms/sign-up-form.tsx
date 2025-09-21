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
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  EyeIcon, 
  EyeOffIcon, 
  ShieldIcon, 
  AlertTriangleIcon
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoogleAuthButton } from "@/components/common/google-auth-button";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Password strength validation
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, feedback: [] };
    
    let score = 0;
    const feedback: string[] = [];

    if (pwd.length >= 8) score += 1;
    else feedback.push("At least 8 characters");

    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1;
    else feedback.push("Both uppercase and lowercase");

    if (/\d/.test(pwd)) score += 1;
    else feedback.push("At least one number");

    if (/[^a-zA-Z\d]/.test(pwd)) score += 1;
    else feedback.push("At least one special character");

    return { score, feedback };
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (password !== repeatPassword) {
      setError("Passwords do not match");
      return;
    }

    if (passwordStrength.score < 2) {
      setError("Password is too weak. " + passwordStrength.feedback.join(", "));
      return;
    }

    await createAccount();
  };

  const createAccount = async () => {
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      // Create the user account (encryption is always enabled)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/protected`,
          data: {
            encryption_enabled: true,
          }
        },
      });

      if (error) throw error;

      // Redirect based on whether email confirmation is required
      // Encryption setup will be handled automatically in the protected page
      if (data.user?.email_confirmed_at) {
        router.push("/protected");
      } else {
        router.push("/auth/sign-up-success?encryption=true");
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign up</CardTitle>
          <CardDescription>Create a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            <GoogleAuthButton mode="signup" />

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

            <form onSubmit={handleSignUp}>
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
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPasswords ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => setShowPasswords(!showPasswords)}
                    >
                      {showPasswords ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  {password && (
                    <div className="flex items-center gap-2">
                      <Progress value={(passwordStrength.score / 4) * 100} className="flex-1 h-2" />
                      <Badge variant={passwordStrength.score >= 2 ? "default" : "secondary"}>
                        {passwordStrength.score >= 3 ? "Strong" : passwordStrength.score >= 2 ? "Good" : "Weak"}
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="repeat-password">Repeat Password</Label>
                  <Input
                    id="repeat-password"
                    type={showPasswords ? "text" : "password"}
                    required
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                  />
                </div>

                {/* Encryption Info */}
                <Alert>
                  <ShieldIcon className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>🔐 End-to-End Encryption Enabled:</strong> All your data will be automatically encrypted with a secure key generated just for you. Your privacy is guaranteed!
                  </AlertDescription>
                </Alert>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangleIcon className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating Account..." : "Sign up"}
                </Button>
              </div>

              <div className="mt-4 text-center text-sm">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4"
                >
                  Login
                </Link>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}