// components/EncryptedMemoryManager.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LockIcon,
  UnlockIcon,
  EyeIcon,
  EyeOffIcon,
  SaveIcon,
  TrashIcon,
  KeyIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  memoryEncryption,
  secureSession,
  CryptoError,
  DecryptionError,
  MemoryEncryption,
} from "@/lib/crypto";
import { createClient } from "@/lib/supabase/client";

interface EncryptedMemory {
  id: string;
  ciphertext: string;
  wrapped_dek: string;
  dek_salt: string;
  dek_iv: string;
  data_iv: string;
  kdf_algorithm: string;
  kdf_iterations: number;
  encryption_algorithm: string;
  created_at: string;
  updated_at: string;
  decrypted_content?: string;
  is_decrypted?: boolean;
}

interface UserProfile {
  user_id: string;
  kdf_algorithm: string;
  kdf_iterations: number;
  master_salt: string;
  require_passphrase_verification: boolean;
  auto_logout_minutes: number;
  max_failed_attempts: number;
  recovery_hint?: string;
}

export const EncryptedMemoryManager: React.FC = () => {
  // State management
  const [memories, setMemories] = useState<EncryptedMemory[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [newMemoryText, setNewMemoryText] = useState("");
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [setupMode, setSetupMode] = useState(false);

  // Clear messages after timeout
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Load user profile and check session status
  useEffect(() => {
    const initializeProfile = async () => {
      try {
        const response = await fetch("/api/user-encryption-profile");
        if (response.ok) {
          const data = await response.json();
          setUserProfile(data.profile);
          setIsSessionActive(secureSession.isActive());
        } else if (response.status === 401) {
          setError("Please log in to access encrypted memories");
        } else {
          setSetupMode(true);
        }
      } catch (error) {
        console.error("Failed to load user profile:", error);
        setError("Failed to load encryption profile");
      }
    };

    initializeProfile();
  }, []);

  // Load encrypted memories
  const loadMemories = useCallback(async () => {
    if (!isSessionActive) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/encrypted-memory");
      if (response.ok) {
        const data = await response.json();
        setMemories(data.memories);
      } else {
        setError("Failed to load encrypted memories");
      }
    } catch (error) {
      console.error("Failed to load memories:", error);
      setError("Failed to load memories");
    } finally {
      setIsLoading(false);
    }
  }, [isSessionActive]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  // Initialize secure session
  const initializeSession = async () => {
    if (!passphrase || !userProfile) return;

    setIsLoading(true);
    setError(null);

    try {
      // Validate passphrase strength
      const validation =
        MemoryEncryption.validatePassphraseStrength(passphrase);
      if (!validation.isValid && setupMode) {
        setError(`Passphrase too weak: ${validation.feedback.join(", ")}`);
        return;
      }

      await secureSession.initializeSession(
        passphrase,
        userProfile.master_salt
      );
      setIsSessionActive(true);
      setPassphrase(""); // Clear passphrase from memory
      setSuccess("Secure session initialized");
      setFailedAttempts(0);
      await loadMemories();
    } catch (error) {
      console.error("Session initialization failed:", error);
      setFailedAttempts((prev) => prev + 1);

      if (failedAttempts + 1 >= userProfile.max_failed_attempts) {
        setError(`Too many failed attempts. Please wait before trying again.`);
        setTimeout(() => setFailedAttempts(0), 60000); // Reset after 1 minute
      } else {
        setError(
          `Invalid passphrase (${failedAttempts + 1}/${
            userProfile.max_failed_attempts
          } attempts)`
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Setup new encryption profile
  const setupEncryption = async () => {
    if (!passphrase) return;

    setIsLoading(true);
    setError(null);

    try {
      // Validate passphrase strength
      const validation =
        MemoryEncryption.validatePassphraseStrength(passphrase);
      if (!validation.isValid) {
        setError(`Passphrase requirements: ${validation.feedback.join(", ")}`);
        return;
      }

      const response = await fetch("/api/user-encryption-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kdf_algorithm: "pbkdf2",
          kdf_iterations: 100000,
          require_passphrase_verification: true,
          auto_logout_minutes: 30,
          max_failed_attempts: 5,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setUserProfile(data.profile);
        setSetupMode(false);
        await initializeSession();
        setSuccess("Encryption setup completed successfully");
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to setup encryption");
      }
    } catch (error) {
      console.error("Encryption setup failed:", error);
      setError("Failed to setup encryption");
    } finally {
      setIsLoading(false);
    }
  };

  // Save new encrypted memory
  const saveMemory = async () => {
    if (!newMemoryText.trim() || !isSessionActive) return;

    setIsLoading(true);
    setError(null);

    try {
      const encryptedData = await memoryEncryption.encryptMemory(
        newMemoryText.trim(),
        passphrase || "temp", // In production, get from secure session
        userProfile?.master_salt
      );

      const response = await fetch("/api/encrypted-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(encryptedData),
      });

      if (response.ok) {
        setNewMemoryText("");
        setSuccess("Memory saved and encrypted");
        await loadMemories();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to save memory");
      }
    } catch (error) {
      console.error("Failed to save encrypted memory:", error);
      setError("Failed to encrypt and save memory");
    } finally {
      setIsLoading(false);
    }
  };

  // Decrypt a specific memory
  const decryptMemory = async (memory: EncryptedMemory) => {
    if (!isSessionActive) return;

    try {
      const decryptedContent = await memoryEncryption.decryptMemory(
        {
          ciphertext: memory.ciphertext,
          wrapped_dek: memory.wrapped_dek,
          dek_salt: memory.dek_salt,
          dek_iv: memory.dek_iv,
          data_iv: memory.data_iv,
          kdf_algorithm: memory.kdf_algorithm,
          kdf_iterations: memory.kdf_iterations,
          encryption_algorithm: memory.encryption_algorithm,
        },
        passphrase || "temp" // In production, get from secure session
      );

      setMemories((prev) =>
        prev.map((m) =>
          m.id === memory.id
            ? { ...m, decrypted_content: decryptedContent, is_decrypted: true }
            : m
        )
      );
    } catch (error) {
      console.error("Failed to decrypt memory:", error);
      if (error instanceof DecryptionError) {
        setError(
          "Failed to decrypt memory - invalid passphrase or corrupted data"
        );
      } else {
        setError("Decryption failed");
      }
    }
  };

  // Delete encrypted memory
  const deleteMemory = async (memoryId: string) => {
    try {
      const response = await fetch(`/api/encrypted-memory?id=${memoryId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== memoryId));
        setSuccess("Memory deleted");
      } else {
        setError("Failed to delete memory");
      }
    } catch (error) {
      console.error("Failed to delete memory:", error);
      setError("Failed to delete memory");
    }
  };

  // Clear session
  const clearSession = () => {
    secureSession.clearSession();
    setIsSessionActive(false);
    setPassphrase("");
    setMemories([]);
    setSuccess("Session cleared securely");
  };

  // Calculate passphrase strength
  const getPassphraseStrength = () => {
    if (!passphrase) return { score: 0, feedback: [] };
    return MemoryEncryption.validatePassphraseStrength(passphrase);
  };

  const strengthInfo = getPassphraseStrength();

  if (setupMode) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5" />
              Setup End-to-End Encryption
            </CardTitle>
            <CardDescription>
              Create a secure passphrase to protect your memories. This
              passphrase will be used to encrypt all your data locally.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Your passphrase cannot be recovered
                if lost. Make sure to remember it or store it securely.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium">Create Passphrase</label>
              <div className="relative">
                <Input
                  type={showPassphrase ? "text" : "password"}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter a strong passphrase..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                >
                  {showPassphrase ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {passphrase && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">Strength:</span>
                    <Progress
                      value={(strengthInfo.score / 5) * 100}
                      className="flex-1 h-2"
                    />
                    <Badge
                      variant={strengthInfo.score >= 3 ? "default" : "outline"}
                    >
                      {strengthInfo.score}/5
                    </Badge>
                  </div>
                  {strengthInfo.feedback.length > 0 && (
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {strengthInfo.feedback.map((fb, i) => (
                        <li key={i}>• {fb}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <Button
              onClick={setupEncryption}
              disabled={isLoading || !passphrase || !strengthInfo.isValid || strengthInfo.score < 3}
              className="w-full"
            >
              {isLoading ? (
                <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheckIcon className="h-4 w-4 mr-2" />
              )}
              Setup Encryption
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertTriangleIcon className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isSessionActive) {
    return (
      <div className="max-w-md mx-auto p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyIcon className="h-5 w-5" />
              Enter Passphrase
            </CardTitle>
            <CardDescription>
              Enter your passphrase to access encrypted memories
              {userProfile?.recovery_hint && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Hint: {userProfile.recovery_hint}
                </div>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Input
                type={showPassphrase ? "text" : "password"}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter your passphrase..."
                className="pr-10"
                onKeyDown={(e) => e.key === "Enter" && initializeSession()}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setShowPassphrase(!showPassphrase)}
              >
                {showPassphrase ? (
                  <EyeOffIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </Button>
            </div>

            <Button
              onClick={initializeSession}
              disabled={isLoading || !passphrase || strengthInfo.score < 3}
              className="w-full"
            >
              {isLoading ? (
                <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UnlockIcon className="h-4 w-4 mr-2" />
              )}
              Unlock Memories
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertTriangleIcon className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LockIcon className="h-6 w-6" />
            Encrypted Memories
          </h1>
          <p className="text-muted-foreground">
            Your memories are protected with end-to-end encryption
          </p>
        </div>
        <Button onClick={clearSession} variant="outline">
          <LockIcon className="h-4 w-4 mr-2" />
          Lock Session
        </Button>
      </div>

      {/* Success/Error Messages */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Alert>
              <ShieldCheckIcon className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Alert variant="destructive">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Memory Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Encrypted Memory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={newMemoryText}
            onChange={(e) => setNewMemoryText(e.target.value)}
            placeholder="Write your memory here... It will be encrypted before saving."
            rows={4}
          />
          <Button
            onClick={saveMemory}
            disabled={isLoading || !newMemoryText.trim() || strengthInfo.score < 3}
          >
            {isLoading ? (
              <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <SaveIcon className="h-4 w-4 mr-2" />
            )}
            Save Encrypted Memory
          </Button>
        </CardContent>
      </Card>

      {/* Memory List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Your Encrypted Memories ({memories.length})
          </h2>
          <Button onClick={loadMemories} variant="outline" size="sm">
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {isLoading && (
          <div className="flex justify-center p-8">
            <RefreshCwIcon className="h-8 w-8 animate-spin" />
          </div>
        )}

        <AnimatePresence>
          {memories.map((memory) => (
            <motion.div
              key={memory.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              layout
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {memory.encryption_algorithm}
                        </Badge>
                        <Badge variant="outline">
                          {memory.kdf_algorithm.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(memory.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {memory.is_decrypted ? (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <UnlockIcon className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-600">
                              Decrypted
                            </span>
                          </div>
                          <p className="text-sm">{memory.decrypted_content}</p>
                        </div>
                      ) : (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <LockIcon className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-600">
                              Encrypted
                            </span>
                          </div>
                          <p className="text-sm font-mono text-muted-foreground truncate">
                            {memory.ciphertext.substring(0, 100)}...
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {!memory.is_decrypted ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decryptMemory(memory)}
                        >
                          <EyeIcon className="h-4 w-4 mr-2" />
                          Decrypt
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setMemories((prev) =>
                              prev.map((m) =>
                                m.id === memory.id
                                  ? {
                                      ...m,
                                      is_decrypted: false,
                                      decrypted_content: undefined,
                                    }
                                  : m
                              )
                            )
                          }
                        >
                          <EyeOffIcon className="h-4 w-4 mr-2" />
                          Hide
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteMemory(memory.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {memories.length === 0 && !isLoading && (
          <Card>
            <CardContent className="p-8 text-center">
              <LockIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">
                No Encrypted Memories
              </h3>
              <p className="text-muted-foreground">
                Create your first encrypted memory using the form above.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Encryption Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Encryption Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Algorithm:</span>
              <span className="ml-2">
                {userProfile?.kdf_algorithm.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="font-medium">Iterations:</span>
              <span className="ml-2">
                {userProfile?.kdf_iterations.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="font-medium">Auto-logout:</span>
              <span className="ml-2">
                {userProfile?.auto_logout_minutes} minutes
              </span>
            </div>
            <div>
              <span className="font-medium">Max attempts:</span>
              <span className="ml-2">{userProfile?.max_failed_attempts}</span>
            </div>
          </div>

          <Separator />

          <div className="text-xs text-muted-foreground space-y-1">
            <p>• All data is encrypted locally using AES-256-GCM</p>
            <p>• Your passphrase never leaves your device</p>
            <p>• Even administrators cannot access your data</p>
            <p>• Lost passphrases cannot be recovered</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
