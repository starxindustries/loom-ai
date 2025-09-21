// hooks/useEncryptedChat.ts
import { useState, useCallback, useRef, useEffect } from "react";
import { 
  EncryptedMessage, 
  EncryptedChatOptions, 
  UserProfile 
} from "@/types";
import {
  memoryEncryption,
  secureSession,
  passphraseManager,
  MemoryEncryption,
  PassphraseManager,
  CryptoError,
  DecryptionError,
} from "@/lib/crypto";

export const useEncryptedChat = (options: EncryptedChatOptions = {}) => {
  const [messages, setMessages] = useState<EncryptedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEncryptionEnabled, setIsEncryptionEnabled] = useState(
    options.enableEncryption || false
  );
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [encryptionSetupRequired, setEncryptionSetupRequired] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationStatus, setInitializationStatus] = useState<string>("Loading...");

  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Load user profile and auto-initialize session
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setIsInitializing(true);
        setInitializationStatus("Loading user profile...");

        const response = await fetch("/api/user-encryption-profile");
        if (response.ok) {
          const data = await response.json();
          setUserProfile(data.profile);
          
          // Check if this is a new user who needs encryption setup
          if (data.profile.is_new) {
            setEncryptionSetupRequired(true);
            setInitializationStatus("Setting up encryption for new user...");
            setIsInitializing(false);
          } else {
            setInitializationStatus("Checking session...");
            
            // Check if session is already active
            if (secureSession.isActive()) {
              setIsSessionActive(true);
              setInitializationStatus("Session restored successfully!");
              setTimeout(() => setIsInitializing(false), 500);
            } else {
              // Try to auto-initialize with stored passphrase
              const storedPassphrase = passphraseManager.getStoredPassphrase();
              if (storedPassphrase) {
                setInitializationStatus("Auto-unlocking with stored key...");
                try {
                  await secureSession.initializeSession(storedPassphrase, data.profile.master_salt);
                  setIsSessionActive(true);
                  setInitializationStatus("Session unlocked successfully!");
                  console.log("Auto-initialized session with stored passphrase");
                  setTimeout(() => setIsInitializing(false), 800);
                } catch (error) {
                  console.error("Failed to auto-initialize session:", error);
                  // If stored passphrase is invalid, clear it
                  passphraseManager.clearStoredPassphrase();
                  setError("Stored encryption key is invalid. Please restore from backup.");
                  setIsInitializing(false);
                }
              } else {
                // No stored passphrase found
                setInitializationStatus("No stored key found");
                setIsInitializing(false);
              }
            }
          }
        } else if (response.status === 404) {
          setEncryptionSetupRequired(true);
          setInitializationStatus("Setup required");
          setIsInitializing(false);
        }
      } catch (error) {
        console.error("Failed to load user profile:", error);
        setError("Failed to load encryption profile");
        setIsInitializing(false);
      }
    };

    if (isEncryptionEnabled) {
      loadUserProfile();
    } else {
      setIsInitializing(false);
    }
  }, [isEncryptionEnabled]);

  // Session timeout management
  const resetSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }

    const timeoutMinutes =
      userProfile?.auto_logout_minutes || options.sessionTimeoutMinutes || 30;
    sessionTimeoutRef.current = setTimeout(() => {
      secureSession.clearSession();
      setIsSessionActive(false);
      setError(
        "Session expired for security. Please re-enter your passphrase."
      );
    }, timeoutMinutes * 60 * 1000);
  }, [userProfile, options.sessionTimeoutMinutes]);

  useEffect(() => {
    if (isSessionActive && isEncryptionEnabled) {
      resetSessionTimeout();
      return () => {
        if (sessionTimeoutRef.current) {
          clearTimeout(sessionTimeoutRef.current);
        }
      };
    }
  }, [isSessionActive, isEncryptionEnabled, resetSessionTimeout]);

  // Initialize secure session (now auto-managed)
  const initializeSession = useCallback(
    async (backupPassphrase?: string) => {
      if (!userProfile) {
        setError("User profile not loaded");
        return false;
      }

      try {
        // Use backup passphrase if provided, otherwise get from storage
        const passphraseToUse = backupPassphrase || passphraseManager.getStoredPassphrase();
        
        if (!passphraseToUse) {
          setError("No encryption key available. Please restore from backup or clear data to regenerate.");
          return false;
        }

        await secureSession.initializeSession(
          passphraseToUse,
          userProfile.master_salt
        );
        
        // Store the passphrase if it came from backup
        if (backupPassphrase) {
          passphraseManager.storePassphrase(backupPassphrase);
        }
        
        setIsSessionActive(true);
        setPassphrase(""); // Clear any temporary passphrase from component state
        setError(null);
        return true;
      } catch (error) {
        setError("Invalid encryption key. Please check your backup file.");
        return false;
      }
    },
    [userProfile]
  );

  // Setup encryption for new users with auto-generated passphrase
  const setupEncryption = useCallback(
    async (): Promise<{ success: boolean; passphrase?: string; isFirstTime?: boolean }> => {
      try {
        setInitializationStatus("Generating secure passphrase...");
        
        // Auto-generate a secure passphrase
        const autoPassphrase = PassphraseManager.generateSecurePassphrase();
        console.log("✅ Generated secure passphrase for new user:", autoPassphrase);
        console.log("🔍 Passphrase validation:", MemoryEncryption.validatePassphraseStrength(autoPassphrase));

        setInitializationStatus("Setting up encryption profile...");
        
        // Try to create user encryption profile
        const response = await fetch("/api/user-encryption-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kdf_algorithm: "pbkdf2",
            kdf_iterations: 100000,
            auto_logout_minutes: 30,
            max_failed_attempts: 5,
          }),
        });

        if (response.ok) {
          // Profile created successfully
          const data = await response.json();
          setUserProfile(data.profile);
          setEncryptionSetupRequired(false);

          setInitializationStatus("Storing passphrase securely...");
          
          // Store the auto-generated passphrase
          if (passphraseManager.storePassphrase(autoPassphrase)) {
            console.log("Stored auto-generated passphrase securely");
          } else {
            console.warn("Failed to store passphrase - user will need backup file");
          }

          setInitializationStatus("Initializing secure session...");
          
          // Initialize session with new profile
          await initializeSession(autoPassphrase);
          
          setInitializationStatus("Setup complete! Showing recovery keys...");
          
          return { success: true, passphrase: autoPassphrase, isFirstTime: true };
        } else if (response.status === 409) {
          // Profile already exists (created by database trigger)
          console.log("Profile already exists, fetching existing profile...");
          setInitializationStatus("Using existing encryption profile...");
          
          // Fetch the existing profile
          const getResponse = await fetch("/api/user-encryption-profile");
          if (getResponse.ok) {
            const data = await getResponse.json();
            setUserProfile(data.profile);
            setEncryptionSetupRequired(false);

            setInitializationStatus("Storing passphrase securely...");
            
            // Store the auto-generated passphrase
            if (passphraseManager.storePassphrase(autoPassphrase)) {
              console.log("Stored auto-generated passphrase securely");
            } else {
              console.warn("Failed to store passphrase - user will need backup file");
            }

            setInitializationStatus("Initializing secure session...");
            
            // Initialize session with existing profile
            await initializeSession(autoPassphrase);
            
            setInitializationStatus("Setup complete! Showing recovery keys...");
            
            return { success: true, passphrase: autoPassphrase, isFirstTime: true };
          } else {
            setError("Failed to fetch existing encryption profile");
            return { success: false };
          }
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to setup encryption");
          return { success: false };
        }
      } catch (error) {
        setError("Encryption setup failed");
        return { success: false };
      }
    },
    [initializeSession]
  );

  // Add message to chat
  const addMessage = useCallback(
    (message: Omit<EncryptedMessage, "id" | "timestamp">) => {
      const newMessage: EncryptedMessage = {
        ...message,
        id: generateId(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, newMessage]);
      return newMessage;
    },
    []
  );

  // Update message in chat
  const updateMessage = useCallback(
    (id: string, updates: Partial<EncryptedMessage>) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
      );
    },
    []
  );

  // Encrypt message content using secure session
  const encryptMessage = useCallback(
    async (content: string): Promise<any> => {
      if (!isEncryptionEnabled || !isSessionActive || !userProfile) {
        return null;
      }

      try {
        // Get passphrase from secure session (not component state)
        const storedPassphrase = passphraseManager.getStoredPassphrase();
        if (!storedPassphrase) {
          throw new CryptoError("No encryption key available", "NO_KEY");
        }

        const encryptedData = await memoryEncryption.encryptMemory(
          content,
          storedPassphrase, // Use stored passphrase from secure storage
          userProfile.master_salt
        );
        return encryptedData;
      } catch (error) {
        console.error("Message encryption failed:", error);
        throw new CryptoError("Failed to encrypt message", "ENCRYPTION_FAILED");
      }
    },
    [isEncryptionEnabled, isSessionActive, userProfile]
  );

  // Decrypt message content using secure session
  const decryptMessage = useCallback(
    async (encryptedData: any): Promise<string> => {
      if (!isEncryptionEnabled || !isSessionActive) {
        throw new CryptoError("Session not active", "SESSION_INACTIVE");
      }

      try {
        // Get passphrase from secure storage (not component state)
        const storedPassphrase = passphraseManager.getStoredPassphrase();
        if (!storedPassphrase) {
          throw new CryptoError("No encryption key available", "NO_KEY");
        }

        return await memoryEncryption.decryptMemory(encryptedData, storedPassphrase);
      } catch (error) {
        console.error("Message decryption failed:", error);
        throw new DecryptionError("Failed to decrypt message");
      }
    },
    [isEncryptionEnabled, isSessionActive]
  );

  // Extract memories from user messages and encrypt them
  const extractAndEncryptMemories = useCallback(
    async (content: string) => {
      if (!options.autoSaveMemories || !isSessionActive || !userProfile) {
        return [];
      }

      try {
        // Use OpenAI to extract memorable information (this should be done on a secure endpoint)
        // For now, we'll do a simple extraction client-side
        const facts = await extractMemorableInfo(content);
        
        if (facts.length === 0) {
          return [];
        }

        console.log(`Extracted ${facts.length} facts from user message`);

        // Encrypt each fact client-side
        const encryptedMemories = [];
        for (const fact of facts) {
          try {
            const encryptedData = await memoryEncryption.encryptMemory(
              fact,
              passphrase || "", // Get from secure session
              userProfile.master_salt
            );

            // Generate keyword hints for searchability (non-sensitive keywords)
            const keywordHints = generateKeywordHints(fact);

            encryptedMemories.push({
              content: fact,
              encrypted_data: {
                ...encryptedData,
                // Convert to lowercase to match database constraint
                kdf_algorithm: encryptedData.kdf_algorithm.toLowerCase(),
                encryption_algorithm: encryptedData.encryption_algorithm.toLowerCase(),
              },
              keyword_hints: keywordHints,
            });
          } catch (error) {
            console.error("Failed to encrypt memory:", error);
          }
        }

        return encryptedMemories;
      } catch (error) {
        console.error("Memory extraction failed:", error);
        return [];
      }
    },
    [options.autoSaveMemories, isSessionActive, userProfile, passphrase]
  );

  // Simple client-side fact extraction (in production, this should be more sophisticated)
  const extractMemorableInfo = async (content: string): Promise<string[]> => {
    const facts: string[] = [];
    
    // Simple patterns for common personal information
    const patterns = [
      { regex: /my birthday (?:is|came|was) (?:on |at )?(.+)/i, template: "Birthday: $1" },
      { regex: /i was born (?:on |in )?(.+)/i, template: "Birthday: $1" },
      { regex: /my name is (.+)/i, template: "Name: $1" },
      { regex: /i work at (.+)/i, template: "Works at: $1" },
      { regex: /i live in (.+)/i, template: "Lives in: $1" },
      { regex: /my favorite (.+) is (.+)/i, template: "Favorite $1: $2" },
      { regex: /i like (.+)/i, template: "Likes: $1" },
      { regex: /i love (.+)/i, template: "Loves: $1" },
      { regex: /my age is (\d+)/i, template: "Age: $1" },
      { regex: /i am (\d+) years old/i, template: "Age: $1" },
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern.regex);
      if (match) {
        const fact = pattern.template.replace(/\$(\d+)/g, (_, num) => match[parseInt(num)]);
        facts.push(fact);
      }
    }

    return facts;
  };

  // Generate non-sensitive keyword hints for search
  const generateKeywordHints = (content: string): string[] => {
    const keywords = [];
    
    if (content.toLowerCase().includes('birthday')) keywords.push('birthday', 'birth');
    if (content.toLowerCase().includes('name')) keywords.push('name', 'identity');
    if (content.toLowerCase().includes('work')) keywords.push('work', 'job', 'career');
    if (content.toLowerCase().includes('live')) keywords.push('location', 'address');
    if (content.toLowerCase().includes('favorite')) keywords.push('preference', 'favorite');
    if (content.toLowerCase().includes('like')) keywords.push('preference', 'interest');
    if (content.toLowerCase().includes('love')) keywords.push('preference', 'interest');
    
    return [...new Set(keywords)]; // Remove duplicates
  };

  // Send message with optional encryption
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Check if encryption is required but session is not active
      if (isEncryptionEnabled && !isSessionActive) {
        setError("Please unlock your session to send encrypted messages");
        return;
      }

      // Reset session timeout on activity
      if (isSessionActive && isEncryptionEnabled) {
        resetSessionTimeout();
      }

      let encryptedData = null;
      if (isEncryptionEnabled && isSessionActive) {
        try {
          encryptedData = await encryptMessage(content);
        } catch (error) {
          setError("Failed to encrypt message");
          return;
        }
      }

      // Add user message (always encrypted in this system)
      const userMessage = addMessage({
        content: content.trim(),
        role: "user",
        isEncrypted: true,
        encryptionMetadata: encryptedData,
      });

      // Add streaming assistant message placeholder
      const assistantMessage = addMessage({
        content: "",
        role: "assistant",
        isStreaming: true,
        isEncrypted: true, // Always encrypted in this system
      });

      setIsLoading(true);
      setError(null);

      try {
        // Prepare messages for API - AI will decide what to remember
        const apiMessages = [...messages, userMessage].map((msg) => ({
          role: msg.role,
          content: msg.content, // Content is already decrypted client-side
        }));

        // Get session KEK for server-side memory decryption
        let sessionKey = null;
        if (isSessionActive && secureSession.isActive()) {
          try {
            // Export the KEK for temporary server-side use
            const kek = secureSession.getKEK();
            if (kek) {
              sessionKey = await crypto.subtle.exportKey("raw", kek);
            }
          } catch (error) {
            console.warn("Could not export session key for memory decryption:", error);
          }
        }

        // Prepare request body for encrypted-only API
        const requestBody: any = {
          messages: apiMessages, // Decrypted messages for AI processing
          session_active: isSessionActive, // Current session status
          memory_extraction_data: [], // AI will handle memory storage via tools
          session_key: sessionKey ? Array.from(new Uint8Array(sessionKey)) : null, // For memory decryption
          master_salt: userProfile?.master_salt || null, // For deriving KEK server-side
        };

        // Create abort controller
        abortControllerRef.current = new AbortController();

        const response = await fetch("/api/encrypted-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to send message");
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.type === "content") {
                    // Update the streaming message with new content
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessage.id
                          ? {
                              ...msg,
                              content: msg.content + data.content,
                              isStreaming: true,
                              isEncrypted: true, // Always encrypted in this system
                            }
                          : msg
                      )
                    );
                  } else if (data.type === "done") {
                    // Mark streaming as complete
                    updateMessage(assistantMessage.id, {
                      isStreaming: false,
                    });

                    // Handle encryption of assistant response if needed
                    if (isEncryptionEnabled && isSessionActive) {
                      // In a real implementation, the assistant's response would be encrypted here
                      // before final storage, maintaining E2E encryption
                    }
                  } else if (data.type === "error") {
                    throw new Error(data.error);
                  }
                } catch (parseError) {
                  console.error("Error parsing SSE data:", parseError);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // TODO: Extract and encrypt memories from user message for encrypted storage
        // await extractAndEncryptMemories(content);
      } catch (err) {
        // Remove the streaming message if there was an error
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessage.id)
        );

        const errorMessage =
          err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);

        // Add error message
        addMessage({
          content: `Sorry, I encountered an error: ${errorMessage}`,
          role: "assistant",
          isStreaming: false,
          isEncrypted: true, // Always encrypted in this system
        });
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [
      messages,
      addMessage,
      updateMessage,
      isEncryptionEnabled,
      isSessionActive,
      encryptMessage,
      extractAndEncryptMemories,
      resetSessionTimeout,
    ]
  );

  // Clear messages
  const clearMessages = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setMessages([]);
    setError(null);
    setIsLoading(false);
  }, []);

  // Stop generation
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);

    // Mark any streaming message as complete
    setMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg
      )
    );
  }, []);

  // Toggle encryption mode
  const toggleEncryption = useCallback(
    (enabled: boolean) => {
      if (enabled && !userProfile) {
        setEncryptionSetupRequired(true);
        return;
      }
      setIsEncryptionEnabled(enabled);
    },
    [userProfile]
  );

  // Clear session and logout
  const clearSession = useCallback(() => {
    secureSession.clearSession();
    setIsSessionActive(false);
    setPassphrase("");
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
  }, []);

  // Download backup file
  const downloadBackup = useCallback(async () => {
    const storedPassphrase = passphraseManager.getStoredPassphrase();
    if (storedPassphrase) {
      // In a real app, you'd get the user's email from auth context
      passphraseManager.downloadBackup(storedPassphrase, "user@example.com");
      
      // Mark user as no longer new (they've downloaded their recovery keys)
      try {
        await fetch("/api/user-encryption-profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_new: false }),
        });
        
        // Update local state immediately
        setUserProfile(prev => prev ? { ...prev, is_new: false } : null);
        console.log("Marked user as no longer new after backup download");
      } catch (error) {
        console.warn("Failed to update is_new status:", error);
      }
    } else {
      setError("No encryption key available to backup");
    }
  }, []);

  // Function to update user profile state
  const updateUserProfile = useCallback((updates: Partial<UserProfile>) => {
    setUserProfile(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  // Restore from backup file
  const restoreFromBackup = useCallback(
    async (file: File): Promise<boolean> => {
      try {
        const passphrase = await passphraseManager.parseBackupFile(file);
        if (passphrase) {
          const success = await initializeSession(passphrase);
          if (success) {
            console.log("Successfully restored from backup file");
          }
          return success;
        } else {
          setError("Invalid backup file format");
          return false;
        }
      } catch (error) {
        setError("Failed to restore from backup file");
        return false;
      }
    },
    [initializeSession]
  );

  // Clear all encryption data (for testing or reset)
  const clearEncryptionData = useCallback(() => {
    secureSession.clearSession();
    passphraseManager.clearStoredPassphrase();
    setIsSessionActive(false);
    setUserProfile(null);
    setPassphrase("");
    setEncryptionSetupRequired(true);
    console.log("Cleared all encryption data");
  }, []);

  return {
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
    addMessage,
    initializeSession,
    setupEncryption,
    toggleEncryption,
    clearSession,
    downloadBackup,
    restoreFromBackup,
    clearEncryptionData,
    setPassphrase,
    passphrase,
    // Helper functions for UI
    hasStoredPassphrase: () => passphraseManager.hasStoredPassphrase(),
    updateUserProfile,
  };
};
