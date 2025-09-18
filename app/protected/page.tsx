// pages/encrypted-chat.tsx
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldIcon,
  KeyIcon,
  UnlockIcon,
  LockIcon,
  AlertTriangleIcon,
  EyeIcon,
  EyeOffIcon,
  SettingsIcon,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useEncryptedChat } from "@/hooks/useEncryptedChat";
import { MemoryEncryption } from "@/lib/crypto";
import { ChatSystem } from "@/components/common/chat-system";

export default function EncryptedChatPage() {
  const {
    messages,
    isLoading,
    error,
    isEncryptionEnabled,
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
    toggleEncryption,
    clearSession,
    downloadBackup,
    restoreFromBackup,
    clearEncryptionData,
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
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [generatedPassphrase, setGeneratedPassphrase] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  // Handle encryption setup with auto-generated passphrase
  const handleSetupEncryption = async () => {
    const result = await setupEncryption();
    if (result.success && result.passphrase) {
      setGeneratedPassphrase(result.passphrase);
      // Keep setup mode open to show the generated passphrase and download backup
    }
  };

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
        setIsSetupMode(false);
      }
    }
  };

  // Reset setup state when encryption is no longer required
  useEffect(() => {
    if (!encryptionSetupRequired) {
      setIsSetupMode(false);
      setGeneratedPassphrase(null);
    }
  }, [encryptionSetupRequired]);

  // Show encryption setup if required (encryption is always enabled)
  useEffect(() => {
    if (encryptionSetupRequired && !isSetupMode) {
      setIsSetupMode(true);
    }
  }, [encryptionSetupRequired, isSetupMode]);

  // Show loading screen during initialization
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
            <Progress value={
              initializationStatus.includes("profile") ? 25 :
              initializationStatus.includes("session") ? 50 :
              initializationStatus.includes("unlocking") ? 75 :
              initializationStatus.includes("successfully") ? 100 : 0
            } className="h-2" />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ShieldIcon className="h-6 w-6 text-green-600" />
                Encrypted Memory Chat
              </h1>

              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600">
                  End-to-End Encrypted
                </Badge>
                {isSessionActive && (
                  <Badge
                    variant="outline"
                    className="bg-green-100 text-green-800 border-green-300"
                  >
                    <UnlockIcon className="h-3 w-3 mr-1" />
                    Session Active
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Session Controls */}
              {isSessionActive ? (
                <Button onClick={clearSession} variant="outline" size="sm">
                  <LockIcon className="h-4 w-4 mr-2" />
                  Lock Session
                </Button>
              ) : (
                <Badge variant="outline" className="text-amber-600">
                  <KeyIcon className="h-3 w-3 mr-1" />
                  Session Locked
                </Badge>
              )}

              {/* Settings */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-6xl mx-auto px-6 pt-4"
          >
            <Alert variant="destructive">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b bg-muted/30"
          >
            <div className="max-w-6xl mx-auto px-6 py-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Encryption Settings</CardTitle>
                  <CardDescription>
                    Configure your end-to-end encryption preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {userProfile ? (
                    <div className="grid grid-cols-2 gap-4 text-sm">
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
                  ) : (
                    <p className="text-muted-foreground">
                      Encryption profile not configured
                    </p>
                  )}

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Messages are encrypted using AES-256-GCM</p>
                    <p>• Your encryption key is auto-generated and stored locally</p>
                    <p>• End-to-end encryption ensures complete privacy</p>
                    <p>• Backup file available for device recovery</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Encryption Setup Modal */}
      <AnimatePresence>
        {isSetupMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-lg shadow-xl max-w-md w-full"
            >
              <Card className="border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <KeyIcon className="h-5 w-5" />
                    Setup Secure Memory
                  </CardTitle>
                  <CardDescription>
                    We'll auto-generate a secure encryption key for your memories
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertTriangleIcon className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Important:</strong> Download the backup file after setup. 
                      It's the only way to recover your encrypted memories if you switch devices.
                    </AlertDescription>
                  </Alert>

                  {generatedPassphrase ? (
                    <div className="space-y-3">
                      <div className="bg-muted p-3 rounded-lg">
                        <label className="text-sm font-medium text-green-700 dark:text-green-400">
                          🎉 Your secure key has been generated!
                        </label>
                        <div className="mt-2 font-mono text-sm bg-background p-2 rounded border">
                          {showPassphrase ? generatedPassphrase : "••••••••••••••••••••••••••••••••••••••"}
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

                      <Button
                        onClick={downloadBackup}
                        className="w-full"
                        variant="outline"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Backup File
                      </Button>

                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>✅ Key stored securely on this device</p>
                        <p>📁 Backup file contains your recovery key</p>
                        <p>🔒 Keep backup file safe and private</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center py-4">
                        <p className="text-muted-foreground mb-4">
                          We'll create a secure 128-bit encryption key using cryptographically 
                          secure random generation. This key will be stored safely on your device.
                        </p>
                        
                        <div className="text-xs text-muted-foreground space-y-1 mb-4">
                          <p>🔐 Military-grade AES-256-GCM encryption</p>
                          <p>🛡️ Zero-knowledge architecture</p>
                          <p>📱 Key never leaves your device</p>
                        </div>
                      </div>

                      {/* Restore from backup option */}
                      <div className="border-t pt-4">
                        <label className="text-sm font-medium">
                          Or restore from backup file:
                        </label>
                        <div className="mt-2 flex gap-2">
                          <Input
                            type="file"
                            accept=".json"
                            onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
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
                    </div>
                  )}

                  <div className="flex gap-2">
                    {generatedPassphrase ? (
                      <Button
                        onClick={() => {
                          setIsSetupMode(false);
                          setGeneratedPassphrase(null);
                        }}
                        className="flex-1"
                      >
                        Start Using Secure Memory
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setIsSetupMode(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSetupEncryption}
                          disabled={isLoading}
                          className="flex-1"
                        >
                          {isLoading ? (
                            <>
                              <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                              Generating Key...
                            </>
                          ) : (
                            <>
                              <KeyIcon className="h-4 w-4 mr-2" />
                              Generate Secure Key
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session Unlock Modal */}
      <AnimatePresence>
        {!isSessionActive && !isSetupMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-lg shadow-xl max-w-md w-full"
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
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Interface */}
      <div className="flex-1">
        {isSessionActive ? (
          <ChatSystem
            messages={messages}
            onSendMessage={sendMessage}
            onStopGeneration={stopGeneration}
            onClearMessages={clearMessages}
            isLoading={isLoading}
          />
        ) : (
          <div className="flex items-center justify-center h-[60vh]">
            <Card className="max-w-md">
              <CardContent className="p-8 text-center">
                <LockIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Session Locked</h3>
                <p className="text-muted-foreground mb-4">
                  Enter your passphrase to start an encrypted conversation
                </p>
                <Button onClick={() => setShowSettings(true)} variant="outline">
                  <KeyIcon className="h-4 w-4 mr-2" />
                  Unlock Session
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Status Bar - Always show since encryption is always enabled */}
      <div className="border-t bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 py-2">
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
      </div>
    </div>
  );
}
