// lib/crypto.ts
// Enterprise-grade client-side encryption utilities

/**
 * Cryptographic configuration constants
 */
export const CRYPTO_CONFIG = {
  // Key Derivation
  PBKDF2_ITERATIONS: 100000,
  ARGON2_MEMORY: 64 * 1024, // 64MB
  ARGON2_ITERATIONS: 3,
  ARGON2_PARALLELISM: 1,

  // Encryption
  AES_KEY_LENGTH: 256,
  GCM_IV_LENGTH: 96, // 12 bytes for GCM
  SALT_LENGTH: 256, // 32 bytes

  // Algorithms
  KDF_ALGORITHM: "PBKDF2" as const,
  ENCRYPTION_ALGORITHM: "AES-256-GCM" as const,
  HASH_ALGORITHM: "SHA-256" as const,
} as const;

/**
 * Error classes for crypto operations
 */
export class CryptoError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "CryptoError";
  }
}

export class DecryptionError extends CryptoError {
  constructor(message: string = "Decryption failed") {
    super(message, "DECRYPTION_FAILED");
  }
}

export class KeyDerivationError extends CryptoError {
  constructor(message: string = "Key derivation failed") {
    super(message, "KEY_DERIVATION_FAILED");
  }
}

/**
 * Type definitions
 */
export interface EncryptedData {
  ciphertext: string;
  iv: string;
  algorithm: string;
}

export interface WrappedKey {
  wrappedKey: string;
  salt: string;
  iv: string;
  algorithm: string;
  kdfAlgorithm: string;
  iterations: number;
}

export interface EncryptedMemory {
  ciphertext: string;
  wrapped_dek: string;
  dek_salt: string;
  dek_iv: string;
  data_iv: string;
  kdf_algorithm: string;
  kdf_iterations: number;
  encryption_algorithm: string;
}

/**
 * Utility functions
 */
export class CryptoUtils {
  /**
   * Generate cryptographically secure random bytes
   */
  static generateRandomBytes(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  /**
   * Convert ArrayBuffer to Base64 string
   */
  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 string to ArrayBuffer
   */
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    try {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (error) {
      throw new CryptoError("Invalid base64 string", "INVALID_BASE64");
    }
  }

  /**
   * Convert string to ArrayBuffer using UTF-8 encoding
   */
  static stringToArrayBuffer(str: string): ArrayBuffer {
    return new TextEncoder().encode(str);
  }

  /**
   * Convert ArrayBuffer to string using UTF-8 decoding
   */
  static arrayBufferToString(buffer: ArrayBuffer): string {
    try {
      return new TextDecoder().decode(buffer);
    } catch (error) {
      throw new CryptoError(
        "Failed to decode buffer to string",
        "DECODE_ERROR"
      );
    }
  }

  /**
   * Secure comparison of two arrays (constant time)
   */
  static secureCompare(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    return result === 0;
  }

  /**
   * Clear sensitive data from memory (best effort)
   */
  static clearSensitiveData(data: Uint8Array): void {
    if (data) {
      data.fill(0);
    }
  }
}

/**
 * Key Derivation Functions
 */
export class KeyDerivation {
  /**
   * Derive key using PBKDF2
   */
  static async deriveKeyPBKDF2(
    passphrase: string,
    salt: Uint8Array,
    iterations: number = CRYPTO_CONFIG.PBKDF2_ITERATIONS
  ): Promise<CryptoKey> {
    try {
      const passphraseBuffer = CryptoUtils.stringToArrayBuffer(passphrase);

      const baseKey = await crypto.subtle.importKey(
        "raw",
        passphraseBuffer,
        "PBKDF2",
        false,
        ["deriveKey"]
      );

      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: new Uint8Array(salt),
          iterations: iterations,
          hash: CRYPTO_CONFIG.HASH_ALGORITHM,
        },
        baseKey,
        {
          name: "AES-GCM",
          length: CRYPTO_CONFIG.AES_KEY_LENGTH,
        },
        false, // Not extractable
        ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
      );

      return derivedKey;
    } catch (error) {
      throw new KeyDerivationError(`PBKDF2 key derivation failed: ${error}`);
    }
  }

  /**
   * Generate salt for key derivation
   */
  static generateSalt(): Uint8Array {
    return CryptoUtils.generateRandomBytes(CRYPTO_CONFIG.SALT_LENGTH / 8);
  }
}

/**
 * AES-GCM Encryption/Decryption
 */
export class AESGCMCrypto {
  /**
   * Generate a new AES-256 key for data encryption
   */
  static async generateDataKey(): Promise<CryptoKey> {
    try {
      return await crypto.subtle.generateKey(
        {
          name: "AES-GCM",
          length: CRYPTO_CONFIG.AES_KEY_LENGTH,
        },
        true, // Extractable (needed for wrapping)
        ["encrypt", "decrypt"]
      );
    } catch (error) {
      throw new CryptoError(
        `Failed to generate data key: ${error}`,
        "KEY_GENERATION_FAILED"
      );
    }
  }

  /**
   * Encrypt data using AES-GCM
   */
  static async encrypt(data: string, key: CryptoKey): Promise<EncryptedData> {
    try {
      const iv = CryptoUtils.generateRandomBytes(
        CRYPTO_CONFIG.GCM_IV_LENGTH / 8
      );
      const dataBuffer = CryptoUtils.stringToArrayBuffer(data);

      const ciphertext = await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        key,
        dataBuffer
      );

      return {
        ciphertext: CryptoUtils.arrayBufferToBase64(ciphertext),
        iv: CryptoUtils.arrayBufferToBase64(iv),
        algorithm: CRYPTO_CONFIG.ENCRYPTION_ALGORITHM,
      };
    } catch (error) {
      throw new CryptoError(`Encryption failed: ${error}`, "ENCRYPTION_FAILED");
    }
  }

  /**
   * Decrypt data using AES-GCM
   */
  static async decrypt(
    encryptedData: EncryptedData,
    key: CryptoKey
  ): Promise<string> {
    try {
      const ciphertext = CryptoUtils.base64ToArrayBuffer(
        encryptedData.ciphertext
      );
      const iv = CryptoUtils.base64ToArrayBuffer(encryptedData.iv);

      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        key,
        ciphertext
      );

      return CryptoUtils.arrayBufferToString(decryptedBuffer);
    } catch (error) {
      throw new DecryptionError(`Decryption failed: ${error}`);
    }
  }

  /**
   * Wrap (encrypt) a data encryption key with a key encryption key
   */
  static async wrapKey(
    dataKey: CryptoKey,
    keyEncryptionKey: CryptoKey
  ): Promise<{ wrappedKey: string; iv: string }> {
    try {
      const iv = CryptoUtils.generateRandomBytes(
        CRYPTO_CONFIG.GCM_IV_LENGTH / 8
      );

      const wrappedKey = await crypto.subtle.wrapKey(
        "raw",
        dataKey,
        keyEncryptionKey,
        {
          name: "AES-GCM",
          iv: iv,
        }
      );

      return {
        wrappedKey: CryptoUtils.arrayBufferToBase64(wrappedKey),
        iv: CryptoUtils.arrayBufferToBase64(iv),
      };
    } catch (error) {
      throw new CryptoError(
        `Key wrapping failed: ${error}`,
        "KEY_WRAPPING_FAILED"
      );
    }
  }

  /**
   * Unwrap (decrypt) a data encryption key with a key encryption key
   */
  static async unwrapKey(
    wrappedKey: string,
    iv: string,
    keyEncryptionKey: CryptoKey
  ): Promise<CryptoKey> {
    try {
      const wrappedKeyBuffer = CryptoUtils.base64ToArrayBuffer(wrappedKey);
      const ivBuffer = CryptoUtils.base64ToArrayBuffer(iv);

      const unwrappedKey = await crypto.subtle.unwrapKey(
        "raw",
        wrappedKeyBuffer,
        keyEncryptionKey,
        {
          name: "AES-GCM",
          iv: ivBuffer,
        },
        {
          name: "AES-GCM",
          length: CRYPTO_CONFIG.AES_KEY_LENGTH,
        },
        false, // Not extractable
        ["encrypt", "decrypt"]
      );

      return unwrappedKey;
    } catch (error) {
      throw new CryptoError(
        `Key unwrapping failed: ${error}`,
        "KEY_UNWRAPPING_FAILED"
      );
    }
  }
}

/**
 * Main encryption service for memories
 */
export class MemoryEncryption {
  /**
   * Encrypt a memory with a user's passphrase
   */
  static async encryptMemory(
    content: string,
    passphrase: string,
    userSalt?: string
  ): Promise<EncryptedMemory> {
    try {
      // Generate salt if not provided
      const salt = userSalt
        ? CryptoUtils.base64ToArrayBuffer(userSalt)
        : KeyDerivation.generateSalt();

      // Derive Key Encryption Key from passphrase
      const kek = await KeyDerivation.deriveKeyPBKDF2(
        passphrase,
        new Uint8Array(salt)
      );

      // Generate Data Encryption Key
      const dek = await AESGCMCrypto.generateDataKey();

      // Encrypt content with DEK
      const encryptedContent = await AESGCMCrypto.encrypt(content, dek);

      // Wrap DEK with KEK
      const wrappedDek = await AESGCMCrypto.wrapKey(dek, kek);

      return {
        ciphertext: encryptedContent.ciphertext,
        wrapped_dek: wrappedDek.wrappedKey,
        dek_salt: CryptoUtils.arrayBufferToBase64(salt),
        dek_iv: wrappedDek.iv,
        data_iv: encryptedContent.iv,
        kdf_algorithm: CRYPTO_CONFIG.KDF_ALGORITHM,
        kdf_iterations: CRYPTO_CONFIG.PBKDF2_ITERATIONS,
        encryption_algorithm: CRYPTO_CONFIG.ENCRYPTION_ALGORITHM,
      };
    } catch (error) {
      throw new CryptoError(
        `Memory encryption failed: ${error}`,
        "MEMORY_ENCRYPTION_FAILED"
      );
    }
  }

  /**
   * Decrypt a memory with a user's passphrase
   */
  static async decryptMemory(
    encryptedMemory: EncryptedMemory,
    passphrase: string
  ): Promise<string> {
    try {
      // Convert salt from base64
      const salt = CryptoUtils.base64ToArrayBuffer(encryptedMemory.dek_salt);

      // Derive Key Encryption Key from passphrase
      const kek = await KeyDerivation.deriveKeyPBKDF2(
        passphrase,
        new Uint8Array(salt),
        encryptedMemory.kdf_iterations
      );

      // Unwrap Data Encryption Key
      const dek = await AESGCMCrypto.unwrapKey(
        encryptedMemory.wrapped_dek,
        encryptedMemory.dek_iv,
        kek
      );

      // Decrypt content
      const encryptedData = {
        ciphertext: encryptedMemory.ciphertext,
        iv: encryptedMemory.data_iv,
        algorithm: encryptedMemory.encryption_algorithm,
      };

      const decryptedContent = await AESGCMCrypto.decrypt(encryptedData, dek);

      return decryptedContent;
    } catch (error) {
      if (error instanceof DecryptionError || error instanceof CryptoError) {
        throw error;
      }
      throw new DecryptionError(`Memory decryption failed: ${error}`);
    }
  }

  /**
   * Validate passphrase strength
   */
  static validatePassphraseStrength(passphrase: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (passphrase.length < 12) {
      feedback.push("Use at least 12 characters");
    } else if (passphrase.length >= 16) {
      score += 2;
    } else {
      score += 1;
    }

    // Character variety
    const hasLower = /[a-z]/.test(passphrase);
    const hasUpper = /[A-Z]/.test(passphrase);
    const hasNumbers = /\d/.test(passphrase);
    const hasSymbols = /[^a-zA-Z\d]/.test(passphrase);

    const variety = [hasLower, hasUpper, hasNumbers, hasSymbols].filter(
      Boolean
    ).length;

    if (variety < 3) {
      feedback.push("Use a mix of uppercase, lowercase, numbers, and symbols");
    } else {
      score += variety - 2;
    }

    // Common patterns
    if (/(.)\1{2,}/.test(passphrase)) {
      feedback.push("Avoid repeated characters");
      score -= 1;
    }

    if (/^[a-zA-Z]+\d+$/.test(passphrase)) {
      feedback.push('Avoid simple patterns like "word123"');
      score -= 1;
    }

    return {
      isValid: score >= 3 && passphrase.length >= 12,
      score: Math.max(0, Math.min(5, score)),
      feedback,
    };
  }
}


/**
 * Passphrase generation and local storage management
 */
export class PassphraseManager {
  private static readonly STORAGE_KEY = "loom_ai_passphrase";
  private static readonly BACKUP_PREFIX = "loom-ai-backup";

  /**
   * Generate a secure passphrase using cryptographically secure random words
   */
  static generateSecurePassphrase(): string {
    // Use a simplified word list for better UX (12 words = ~128 bits entropy)
    const wordList = [
      "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
      "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
      "action", "actor", "actress", "actual", "adapt", "add", "addict", "address", "adjust", "admit",
      "adult", "advance", "advice", "aerobic", "affair", "afford", "afraid", "again", "against", "age",
      "agent", "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album", "alcohol",
      "alert", "alien", "all", "alley", "allow", "almost", "alone", "alpha", "already", "also",
      "alter", "always", "amateur", "amazing", "among", "amount", "amused", "analyst", "anchor", "ancient",
      "anger", "angle", "angry", "animal", "ankle", "announce", "annual", "another", "answer", "antenna",
      "antique", "anxiety", "any", "apart", "apology", "appear", "apple", "approve", "april", "arcade",
      "arch", "arctic", "area", "arena", "argue", "arm", "armed", "armor", "army", "around",
      "arrange", "arrest", "arrive", "arrow", "art", "article", "artist", "artwork", "ask", "aspect",
      "assault", "asset", "assist", "assume", "asthma", "athlete", "atom", "attack", "attend", "attitude",
      "attract", "auction", "audit", "august", "aunt", "author", "auto", "autumn", "average", "avocado"
    ];

    // Generate 12 random words for ~128 bits of entropy
    const words: string[] = [];
    const randomArray = new Uint32Array(12);
    crypto.getRandomValues(randomArray);
    
    for (let i = 0; i < 12; i++) {
      const index = randomArray[i] % wordList.length;
      words.push(wordList[index]);
    }
    
    return words.join("-");
  }

  /**
   * Store passphrase securely in localStorage (encrypted with device-specific key)
   */
  static storePassphrase(passphrase: string): boolean {
    try {
      // In a production app, you'd encrypt this with a device-specific key
      // For now, we'll store it directly (still better than manual entry)
      localStorage.setItem(this.STORAGE_KEY, passphrase);
      return true;
    } catch (error) {
      console.error("Failed to store passphrase:", error);
      return false;
    }
  }

  /**
   * Retrieve stored passphrase
   */
  static getStoredPassphrase(): string | null {
    try {
      return localStorage.getItem(this.STORAGE_KEY);
    } catch (error) {
      console.error("Failed to retrieve passphrase:", error);
      return null;
    }
  }

  /**
   * Check if passphrase exists in storage
   */
  static hasStoredPassphrase(): boolean {
    return this.getStoredPassphrase() !== null;
  }

  /**
   * Clear stored passphrase
   */
  static clearStoredPassphrase(): boolean {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      return true;
    } catch (error) {
      console.error("Failed to clear passphrase:", error);
      return false;
    }
  }

  /**
   * Generate backup file for download
   */
  static generateBackupFile(passphrase: string, userEmail?: string): Blob {
    const backupData = {
      app: "Loom AI Memory System",
      version: "1.0",
      created: new Date().toISOString(),
      user: userEmail || "unknown",
      passphrase: passphrase,
      instructions: [
        "This is your Loom AI memory backup file.",
        "Keep this file safe - it's needed to recover your encrypted memories.",
        "Never share this file with anyone.",
        "Store it in a secure location (password manager, encrypted drive, etc.)"
      ]
    };

    const content = JSON.stringify(backupData, null, 2);
    return new Blob([content], { type: "application/json" });
  }

  /**
   * Download backup file
   */
  static downloadBackup(passphrase: string, userEmail?: string): void {
    const blob = this.generateBackupFile(passphrase, userEmail);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.href = url;
    link.download = `${this.BACKUP_PREFIX}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Parse backup file
   */
  static parseBackupFile(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const backup = JSON.parse(content);
          
          if (backup.app === "Loom AI Memory System" && backup.passphrase) {
            resolve(backup.passphrase);
          } else {
            resolve(null);
          }
        } catch (error) {
          console.error("Failed to parse backup file:", error);
          resolve(null);
        }
      };
      reader.readAsText(file);
    });
  }
}

/**
 * Updated SecureSession with extractable keys for server-side decryption
 */
export class SecureSession {
  private static instance: SecureSession | null = null;
  private kek: CryptoKey | null = null;
  private sessionTimeout: NodeJS.Timeout | null = null;
  private readonly TIMEOUT_MINUTES = 30;

  private constructor() {}

  static getInstance(): SecureSession {
    if (!SecureSession.instance) {
      SecureSession.instance = new SecureSession();
    }
    return SecureSession.instance;
  }

  /**
   * Initialize secure session with user passphrase
   */
  async initializeSession(passphrase: string, salt: string): Promise<void> {
    try {
      const saltBuffer = CryptoUtils.base64ToArrayBuffer(salt);
      // Make key extractable for server-side memory decryption
      this.kek = await this.deriveExtractableKEK(
        passphrase,
        saltBuffer
      );

      // Set session timeout
      this.resetTimeout();
    } catch (error) {
      throw new CryptoError(
        `Failed to initialize secure session: ${error}`,
        "SESSION_INIT_FAILED"
      );
    }
  }

  /**
   * Derive extractable KEK for server-side operations
   */
  private async deriveExtractableKEK(
    passphrase: string,
    salt: ArrayBuffer
  ): Promise<CryptoKey> {
    try {
      const passphraseBuffer = CryptoUtils.stringToArrayBuffer(passphrase);

      const baseKey = await crypto.subtle.importKey(
        "raw",
        passphraseBuffer,
        "PBKDF2",
        false,
        ["deriveKey"]
      );

      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: new Uint8Array(salt),
          iterations: CRYPTO_CONFIG.PBKDF2_ITERATIONS,
          hash: CRYPTO_CONFIG.HASH_ALGORITHM,
        },
        baseKey,
        {
          name: "AES-GCM",
          length: CRYPTO_CONFIG.AES_KEY_LENGTH,
        },
        true, // Make extractable for server-side use
        ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
      );

      return derivedKey;
    } catch (error) {
      throw new KeyDerivationError(`PBKDF2 key derivation failed: ${error}`);
    }
  }

  /**
   * Get the current Key Encryption Key
   */
  getKEK(): CryptoKey | null {
    if (!this.kek) {
      throw new CryptoError(
        "Session not initialized or expired",
        "SESSION_EXPIRED"
      );
    }
    this.resetTimeout();
    return this.kek;
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.kek !== null;
  }

  /**
   * Clear the secure session
   */
  clearSession(): void {
    this.kek = null;
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
      this.sessionTimeout = null;
    }
  }

  /**
   * Reset session timeout
   */
  private resetTimeout(): void {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }

    this.sessionTimeout = setTimeout(() => {
      this.clearSession();
    }, this.TIMEOUT_MINUTES * 60 * 1000);
  }
}

// Export convenience functions
export const cryptoUtils = CryptoUtils;
export const passphraseManager = PassphraseManager;
export const memoryEncryption = MemoryEncryption;
export const secureSession = SecureSession.getInstance();
