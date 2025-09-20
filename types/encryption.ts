// types/encryption.ts
import { Message } from './chat';

export interface UserEncryptionProfile {
  user_id: string;
  kdf_algorithm: string;
  kdf_iterations: number;
  master_salt: string;
  require_passphrase_verification: boolean;
  auto_logout_minutes: number;
  max_failed_attempts: number;
  recovery_hint?: string;
  is_new?: boolean;
  created_at: string;
  updated_at: string;
  last_passphrase_change: string;
}

export interface CreateProfileRequest {
  kdf_algorithm?: 'pbkdf2' | 'argon2id';
  kdf_iterations?: number;
  require_passphrase_verification?: boolean;
  auto_logout_minutes?: number;
  max_failed_attempts?: number;
  recovery_hint?: string;
}

export interface UpdateProfileRequest {
  kdf_algorithm?: 'pbkdf2' | 'argon2id';
  kdf_iterations?: number;
  require_passphrase_verification?: boolean;
  auto_logout_minutes?: number;
  max_failed_attempts?: number;
  recovery_hint?: string;
  regenerate_master_salt?: boolean;
  is_new?: boolean;
}

export interface UserProfile {
  user_id: string;
  master_salt: string;
  recovery_hint: string;
  kdf_algorithm: string;
  kdf_iterations: number;
  auto_logout_minutes: number;
  is_new?: boolean;
}

export interface EncryptedMessage extends Message {
  isEncrypted?: boolean;
  encryptionMetadata?: {
    ciphertext: string;
    wrapped_dek: string;
    dek_salt: string;
    dek_iv: string;
    data_iv: string;
    kdf_algorithm: string;
    kdf_iterations: number;
    encryption_algorithm: string;
  };
}

export interface EncryptedMemory {
  id: string;
  content: string;
  timestamp: Date;
  tags: string[];
  encryption_algorithm: string;
}

export interface EncryptedChatOptions {
  enableEncryption?: boolean;
  autoSaveMemories?: boolean;
  sessionTimeoutMinutes?: number;
}
