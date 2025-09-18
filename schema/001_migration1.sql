-- Migration: 001_create_encrypted_memories_table.sql
-- This migration creates the new encrypted memories schema

BEGIN;

-- Drop existing memories table (WARNING: This will delete all existing data)
-- In production, you'd want a migration strategy to encrypt existing data
DROP TABLE IF EXISTS public.memories CASCADE;

-- Create encrypted memories table
CREATE TABLE public.encrypted_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Encrypted content
  ciphertext TEXT NOT NULL,
  
  -- Key management
  wrapped_dek TEXT NOT NULL,         -- Data Encryption Key wrapped with Key Encryption Key
  dek_salt TEXT NOT NULL,            -- Salt used for KEK derivation
  dek_iv TEXT NOT NULL,              -- IV for DEK wrapping
  data_iv TEXT NOT NULL,             -- IV for data encryption
  
  -- Crypto metadata
  kdf_algorithm TEXT NOT NULL DEFAULT 'pbkdf2',  -- Key derivation function used
  kdf_iterations INTEGER NOT NULL DEFAULT 100000, -- KDF iterations
  encryption_algorithm TEXT NOT NULL DEFAULT 'aes-256-gcm', -- Encryption algorithm
  
  -- Search and indexing (encrypted keywords for search)
  encrypted_keywords TEXT[], -- Encrypted searchable keywords
  keyword_hints TEXT[],      -- Non-sensitive hints for search UX
  
  -- Metadata
  content_type TEXT DEFAULT 'text/plain',
  content_length INTEGER,
  is_encrypted BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,        -- Schema version for future migrations
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT encrypted_memories_pkey PRIMARY KEY (id),
  CONSTRAINT encrypted_memories_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    
  -- Constraints
  CONSTRAINT valid_kdf_algorithm CHECK (kdf_algorithm IN ('pbkdf2', 'argon2id')),
  CONSTRAINT valid_encryption_algorithm CHECK (encryption_algorithm IN ('aes-256-gcm')),
  CONSTRAINT positive_iterations CHECK (kdf_iterations > 0),
  CONSTRAINT positive_content_length CHECK (content_length >= 0)
);

-- Indexes for performance
CREATE INDEX encrypted_memories_user_id_idx ON public.encrypted_memories(user_id);
CREATE INDEX encrypted_memories_created_at_idx ON public.encrypted_memories(created_at DESC);
CREATE INDEX encrypted_memories_keywords_idx ON public.encrypted_memories USING GIN(encrypted_keywords);

-- Row Level Security (RLS)
ALTER TABLE public.encrypted_memories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can insert their own encrypted memories"
  ON public.encrypted_memories FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select their own encrypted memories"
  ON public.encrypted_memories FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own encrypted memories"
  ON public.encrypted_memories FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own encrypted memories"
  ON public.encrypted_memories FOR DELETE 
  USING (auth.uid() = user_id);

-- Create user encryption profile table for managing user crypto settings
CREATE TABLE public.user_encryption_profiles (
  user_id UUID NOT NULL,
  
  -- Key derivation settings
  kdf_algorithm TEXT NOT NULL DEFAULT 'pbkdf2',
  kdf_iterations INTEGER NOT NULL DEFAULT 100000,
  master_salt TEXT NOT NULL, -- Master salt for this user
  
  -- Security settings
  require_passphrase_verification BOOLEAN DEFAULT true,
  auto_logout_minutes INTEGER DEFAULT 30,
  max_failed_attempts INTEGER DEFAULT 5,
  
  -- Recovery settings
  recovery_hint TEXT, -- Non-sensitive hint for passphrase recovery
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_passphrase_change TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT user_encryption_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_encryption_profiles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    
  -- Constraints
  CONSTRAINT valid_profile_kdf_algorithm CHECK (kdf_algorithm IN ('pbkdf2', 'argon2id')),
  CONSTRAINT positive_profile_iterations CHECK (kdf_iterations > 0),
  CONSTRAINT valid_auto_logout CHECK (auto_logout_minutes >= 5 AND auto_logout_minutes <= 1440)
);

-- RLS for user profiles
ALTER TABLE public.user_encryption_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own encryption profile"
  ON public.user_encryption_profiles 
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_encrypted_memories_updated_at 
  BEFORE UPDATE ON public.encrypted_memories 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_encryption_profiles_updated_at 
  BEFORE UPDATE ON public.user_encryption_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to initialize user encryption profile
CREATE OR REPLACE FUNCTION initialize_user_encryption_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_encryption_profiles (user_id, master_salt)
  VALUES (
    NEW.id, 
    encode(gen_random_bytes(32), 'base64')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create encryption profile for new users
CREATE TRIGGER create_user_encryption_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION initialize_user_encryption_profile();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.encrypted_memories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_encryption_profiles TO authenticated;

COMMIT;