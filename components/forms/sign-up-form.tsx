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
import { Switch } from "@/components/ui/switch";
import { 
  EyeIcon, 
  EyeOffIcon, 
  ShieldIcon, 
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoogleAuthButton } from "@/components/common/google-auth-button";
import { MemoryEncryption } from "@/lib/crypto";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [encryptionPassphrase, setEncryptionPassphrase] = useState("");
  const [enableEncryption, setEnableEncryption] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [showEncryptionPassphrase, setShowEncryptionPassphrase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Account, 2: Encryption Setup
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

  // Encryption passphrase strength (more strict)
  const getEncryptionStrength = () => {
    if (!encryptionPassphrase || !enableEncryption) return { score: 0, feedback: [] };
    return MemoryEncryption.validatePassphraseStrength(encryptionPassphrase);
  };

  const passwordStrength = getPasswordStrength(password);
  const encryptionStrength = getEncryptionStrength();

  const handleAccountSetup = async (e: React.FormEvent) => {
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

    if (enableEncryption) {
      setStep(2);
    } else {
      await createAccount();
    }
  };

  const handleEncryptionSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!encryptionStrength.isValid) {
      setError("Encryption passphrase is too weak: " + encryptionStrength.feedback.join(", "));
      return;
    }

    await createAccount();
  };

  const createAccount = async () => {
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      // Create the user account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/protected`,
          data: {
            encryption_enabled: enableEncryption,
          }
        },
      });

      if (error) throw error;

      // If encryption is enabled and user is immediately available (no email confirmation)
      if (enableEncryption && data.user && !data.user.email_confirmed_at) {
        console.log("User created, setting up encryption profile...");
        
        // Wait a moment for the trigger to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
          // Setup encryption profile with the user's encryption passphrase
          const response = await fetch('/api/user-encryption-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kdf_algorithm: 'pbkdf2',
              kdf_iterations: 100000,
              auto_logout_minutes: 30,
              max_failed_attempts: 5,
            }),
          });

          if (!response.ok) {
            console.warn("Failed to setup encryption profile during signup");
          }
        } catch (encryptionError) {
          console.warn("Encryption setup failed:", encryptionError);
          // Don't fail the signup if encryption setup fails
        }
      }

      // Redirect based on whether email confirmation is required
      if (data.user?.email_confirmed_at) {
        router.push("/protected");
      } else {
        router.push("/auth/sign-up-success?encryption=" + (enableEncryption ? "true" : "false"));
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    // Note: Google OAuth users will need to set up encryption separately
    // since we can't capture their encryption passphrase during OAuth
    console.log("Google signup - encryption setup will be prompted after login");
  };

  if (step === 2) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <ShieldIcon className="h-6 w-6" />
              Setup Encryption
            </CardTitle>
            <CardDescription>
              Create a secure passphrase to protect your memories with end-to-end encryption
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEncryptionSetup}>
              <div className="flex flex-col gap-6">
                <Alert>
                  <AlertTriangleIcon className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Important:</strong> Your encryption passphrase cannot be recovered if lost. 
                    Make sure to store it securely and remember it.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-2">
                  <Label htmlFor="encryption-passphrase">Encryption Passphrase</Label>
                  <div className="relative">
                    <Input
                      id="encryption-passphrase"
                      type={showEncryptionPassphrase ? "text" : "password"}
                      placeholder="Enter a strong encryption passphrase..."
                      required
                      value={encryptionPassphrase}
                      onChange={(e) => setEncryptionPassphrase(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => setShowEncryptionPassphrase(!showEncryptionPassphrase)}
                    >
                      {showEncryptionPassphrase ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  {encryptionPassphrase && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">Strength:</span>
                        <Progress value={(encryptionStrength.score / 5) * 100} className="flex-1 h-2" />
                        <Badge variant={encryptionStrength.score >= 3 ? "default" : "secondary"}>
                          {encryptionStrength.score}/5
                        </Badge>
                      </div>
                      {encryptionStrength.feedback.length > 0 && (
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {encryptionStrength.feedback.map((fb, i) => (
                            <li key={i}>• {fb}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Your encryption passphrase is separate from your account password</p>
                  <p>• It's used to encrypt/decrypt your personal data locally</p>
                  <p>• Even administrators cannot access your encrypted data</p>
                  <p>• You can disable encryption later, but encrypted data will be lost</p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangleIcon className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1" 
                    disabled={isLoading || !encryptionStrength.isValid}
                  >
                    {isLoading ? "Creating Account..." : "Complete Setup"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign up</CardTitle>
          <CardDescription>Create a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            <div onClick={handleGoogleSignUp}>
              <GoogleAuthButton mode="signup" />
            </div>

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

            <form onSubmit={handleAccountSetup}>
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

                {/* Encryption Option */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldIcon className="h-4 w-4" />
                      <Label htmlFor="enable-encryption">Enable End-to-End Encryption</Label>
                    </div>
                    <Switch
                      id="enable-encryption"
                      checked={enableEncryption}
                      onCheckedChange={setEnableEncryption}
                    />
                  </div>
                  
                  {enableEncryption && (
                    <Alert>
                      <InfoIcon className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Your personal data will be encrypted locally before being stored. 
                        You'll create a separate encryption passphrase in the next step.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangleIcon className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating Account..." : enableEncryption ? "Continue to Encryption Setup" : "Sign up"}
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