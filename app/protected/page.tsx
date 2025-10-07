// pages/encrypted-chat.tsx
"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import {
  ShieldIcon,
  UnlockIcon,
  LockIcon,
  AlertTriangleIcon,
  EyeIcon,
  EyeOffIcon,
  RefreshCwIcon,
  Download,
  Upload,
  Loader2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useEncryptedChat } from "@/hooks/useEncryptedChat";
import { PassphraseManager } from "@/lib/crypto";
import { ChatSystem } from "@/components/common/chat-system";

function EncryptedChatContent() {
  const searchParams = useSearchParams();
  const encryptionParam = searchParams.get("encryption");
  const isNewUser = searchParams.get("new_user") === "true";

  // Debug logging
  console.log("Protected page URL params:", {
    encryptionParam,
    isNewUser,
    allParams: Object.fromEntries(searchParams.entries()),
  });

  const {
    messages,
    isLoading,
    error,
    isSessionActive,
    userProfile,
    encryptionSetupRequired,
    isInitializing,
    initializationStatus,
    sendMessage,
    clearMessages,
    stopGeneration,
    initializeSession,
    setupEncryption,
    downloadBackup,
    restoreFromBackup,
    passphrase,
    setPassphrase,
    hasStoredPassphrase,
  } = useEncryptedChat({
    enableEncryption: true, // Always use encryption
    autoSaveMemories: true,
    sessionTimeoutMinutes: 30,
  });

  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [generatedPassphrase, setGeneratedPassphrase] = useState<string | null>(
    null
  );
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [showRecoveryKeysPopup, setShowRecoveryKeysPopup] = useState(false);

  // Handle encryption setup with auto-generated passphrase
  const handleSetupEncryption = useCallback(async () => {
    const result = await setupEncryption();
    if (result.success && result.passphrase) {
      setGeneratedPassphrase(result.passphrase);
      setShowRecoveryKeysPopup(true);
    }
  }, [setupEncryption]);

  // Handle session initialization (usually automatic now)
  const handleUnlockSession = async () => {
    const success = await initializeSession(passphrase);
    if (success) {
      setPassphrase("");
    }
  };

  // Handle backup restore
  const handleRestoreFromBackup = async () => {
    if (restoreFile) {
      const success = await restoreFromBackup(restoreFile);
      if (success) {
        setRestoreFile(null);
      }
    }
  };

  // Reset setup state when encryption is no longer required
  useEffect(() => {
    if (!encryptionSetupRequired) {
      setGeneratedPassphrase(null);
    }
  }, [encryptionSetupRequired]);

  // Check if we need to show recovery keys popup for new users
  useEffect(() => {
    const checkRecoveryKeysPopup = () => {
      const hasStoredPassphraseValue = hasStoredPassphrase();

      // Show popup if:
      // 1. User has a stored passphrase (auto-generated)
      // 2. User is marked as new in database (hasn't downloaded recovery keys yet)
      // 3. Either session is active OR we're in setup mode (for new users)
      if (
        hasStoredPassphraseValue &&
        userProfile?.is_new &&
        (isSessionActive || encryptionSetupRequired)
      ) {
        const storedPassphrase = PassphraseManager.getStoredPassphrase();
        if (storedPassphrase) {
          setGeneratedPassphrase(storedPassphrase);
          setShowRecoveryKeysPopup(true);
        }
      }
    };

    // Check immediately if we have the required data
    if (!isInitializing && userProfile) {
      checkRecoveryKeysPopup();
    }
  }, [
    isSessionActive,
    isInitializing,
    hasStoredPassphrase,
    userProfile?.is_new,
    encryptionSetupRequired,
  ]);

  // Auto-trigger encryption setup for new users
  useEffect(() => {
    if (encryptionSetupRequired) {
      handleSetupEncryption();
    }
  }, [encryptionSetupRequired, handleSetupEncryption]);

  // Show loading screen during initialization
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="flex items-center justify-center">
            <Loader2Icon className="h-8 w-8 animate-spin text-primary mr-3" />
            <h2 className="text-2xl font-semibold">Loom AI Memory</h2>
          </div>
          <p className="text-muted-foreground">{initializationStatus}</p>
          <div className="w-64 mx-auto">
            <Progress
              value={
                initializationStatus.includes("profile")
                  ? 25
                  : initializationStatus.includes("session")
                    ? 50
                    : initializationStatus.includes("unlocking")
                      ? 75
                      : initializationStatus.includes("successfully")
                        ? 100
                        : 0
              }
              className="h-2"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-6xl mx-auto px-6 pt-2"
          >
            <Alert variant="destructive">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldIcon className="h-5 w-5" />
              Encryption Settings
            </DialogTitle>
            <DialogDescription>
              View your encryption configuration and manage recovery options
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Encryption Profile Info */}
            {userProfile ? (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Encryption Profile</h4>
                <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-3 rounded-lg">
                  <div>
                    <span className="font-medium">Algorithm:</span>
                    <span className="ml-2">
                      {userProfile.kdf_algorithm.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Iterations:</span>
                    <span className="ml-2">
                      {userProfile.kdf_iterations.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Auto-logout:</span>
                    <span className="ml-2">
                      {userProfile.auto_logout_minutes} minutes
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Session:</span>
                    <span className="ml-2">
                      {isSessionActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <Alert>
                <AlertTriangleIcon className="h-4 w-4" />
                <AlertDescription>
                  Encryption profile not configured
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            {/* Recovery Options */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Recovery Options</h4>
              <Button
                onClick={async () => {
                  await downloadBackup();
                  setShowSettings(false);
                }}
                variant="outline"
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Recovery Key Backup
              </Button>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Download your recovery key backup file</p>
                <p>• Keep it safe - needed to recover data on new devices</p>
                <p>• Your key is also stored securely on this device</p>
              </div>
            </div>

            <Separator />

            {/* Security Info */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Security Information</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Messages are encrypted using AES-256-GCM</p>
                <p>
                  • Your encryption key is auto-generated and stored locally
                </p>
                <p>• End-to-end encryption ensures complete privacy</p>
                <p>• Only you can decrypt your data</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Session Unlock Modal */}
      <AnimatePresence>
        {!isSessionActive && !encryptionSetupRequired && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="rounded-lg shadow-xl max-w-md w-full"
            >
              <Card className="border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UnlockIcon className="h-5 w-5" />
                    Unlock Session
                  </CardTitle>
                  <CardDescription>
                    Enter your passphrase to access encrypted chat
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
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleUnlockSession()
                      }
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
                    onClick={handleUnlockSession}
                    disabled={!passphrase || isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <UnlockIcon className="h-4 w-4 mr-2" />
                    )}
                    Unlock Session
                  </Button>

                  {/* Restore from backup option */}
                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-muted-foreground">
                      Or restore from backup file:
                    </label>
                    <div className="mt-2 flex gap-2">
                      <Input
                        type="file"
                        accept=".json"
                        onChange={(e) =>
                          setRestoreFile(e.target.files?.[0] || null)
                        }
                        className="flex-1"
                      />
                      <Button
                        onClick={handleRestoreFromBackup}
                        disabled={!restoreFile || isLoading}
                        variant="outline"
                        size="sm"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Interface */}
      <div className="flex-1 min-h-0">
        {isSessionActive ? (
          <div className="h-full">
            <ChatSystem
              messages={messages}
              onSendMessage={sendMessage}
              onStopGeneration={stopGeneration}
              onClearMessages={clearMessages}
              isLoading={isLoading}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-[60vh]">
            <Card className="max-w-md">
              <CardContent className="p-8 text-center">
                <LockIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">
                  Session Initializing
                </h3>
                <p className="text-muted-foreground mb-4">
                  Your encrypted session is being prepared...
                </p>
                <div className="text-xs text-muted-foreground">
                  <p>If this persists, you may need to restore from backup</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Recovery Keys Popup for Auto-Generated Passphrase */}
      <AnimatePresence>
        {showRecoveryKeysPopup && generatedPassphrase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto"
            >
              <div className="space-y-6">
                {/* Header */}
                <div className="text-center">
                  <ShieldIcon className="h-12 w-12 text-green-600 mx-auto mb-3" />
                  <h2 className="text-xl font-semibold">
                    🎉 Welcome to Secure Encryption!
                  </h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Your account is now protected with military-grade end-to-end
                    encryption.
                  </p>
                </div>

                {/* Two-column layout for better space usage */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left column - Info */}
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                        📱 Access Your Data Anywhere
                      </h3>
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        Your recovery key allows you to securely access your
                        encrypted data when logging in from a new device,
                        browser, or after clearing your browser data.
                      </p>
                    </div>

                    <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                      <AlertTriangleIcon className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800 dark:text-amber-200">
                        <strong>Please save your recovery key:</strong>{" "}
                        We&apos;ve generated a secure backup file for you. This
                        is the only way to recover your encrypted data if you
                        lose access to this device.
                      </AlertDescription>
                    </Alert>

                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        💡 <strong>Security Tips:</strong>
                      </p>
                      <p>
                        • Store your backup file in a secure location (cloud
                        storage, password manager)
                      </p>
                      <p>
                        • This key encrypts all your conversations and memories
                      </p>
                      <p>
                        • We cannot recover your data without this key -
                        it&apos;s that secure!
                      </p>
                      <p>• You can always download it later from Settings</p>
                    </div>
                  </div>

                  {/* Right column - Recovery Key */}
                  <div className="space-y-4">
                    <div className="bg-muted p-4 rounded-lg">
                      <label className="text-sm font-medium text-green-700 dark:text-green-400">
                        Your Recovery Key:
                      </label>
                      <div className="mt-2 font-mono text-sm p-3 rounded border break-all">
                        {showPassphrase
                          ? generatedPassphrase
                          : "••••••••••••••••••••••••••••••••••••••"}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => setShowPassphrase(!showPassphrase)}
                      >
                        {showPassphrase ? (
                          <>
                            <EyeOffIcon className="h-4 w-4 mr-2" />
                            Hide Key
                          </>
                        ) : (
                          <>
                            <EyeIcon className="h-4 w-4 mr-2" />
                            Show Key
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <Button
                        onClick={async () => {
                          // Download backup and update state immediately
                          await downloadBackup();
                          setShowRecoveryKeysPopup(false);
                          setGeneratedPassphrase(null);
                        }}
                        className="w-full"
                        variant="default"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download My Recovery Key
                      </Button>

                      {/* <Button
                        onClick={() => {
                          // Just close popup, don't update database
                          // User will see popup again on next login/reload until they download
                          setShowRecoveryKeysPopup(false);
                          setGeneratedPassphrase(null);
                        }}
                        className="w-full"
                        variant="outline"
                      >
                        I'll Download Later
                      </Button> */}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Bar - Always show since encryption is always enabled
      <div className="border-t bg-muted/30 fixed bottom-0 w-full">
        <div className="py-2 px-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <ShieldIcon className="h-3 w-3" />
                End-to-end encrypted
              </span>
              {isSessionActive && (
                <span className="flex items-center gap-1">
                  <UnlockIcon className="h-3 w-3" />
                  Session active
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {userProfile && (
                <>
                  <span>{userProfile.kdf_algorithm.toUpperCase()}</span>
                  <span>
                    {userProfile.kdf_iterations.toLocaleString()} iterations
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div> */}
    </div>
  );
}

export default function EncryptedChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4"
          >
            <div className="flex items-center justify-center">
              <Loader2Icon className="h-8 w-8 animate-spin text-primary mr-3" />
              <h2 className="text-2xl font-semibold">Loom AI Memory</h2>
            </div>
            <p className="text-muted-foreground">Loading encrypted chat...</p>
          </motion.div>
        </div>
      }
    >
      <EncryptedChatContent />
    </Suspense>
  );
}
