-- Migration: Create user_files table
-- Description: Creates table for storing file metadata and references
-- Requirements: File upload functionality

CREATE TABLE IF NOT EXISTS public.user_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  storage_path text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'user-files',
  is_encrypted boolean NOT NULL DEFAULT false,
  encryption_key_id text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_files_pkey PRIMARY KEY (id),
  CONSTRAINT user_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT positive_file_size CHECK (file_size > 0),
  CONSTRAINT valid_file_type CHECK (file_type IS NOT NULL AND file_type != '')
) TABLESPACE pg_default;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS user_files_user_id_idx ON public.user_files USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS user_files_created_at_idx ON public.user_files USING btree (created_at DESC) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS user_files_file_type_idx ON public.user_files USING btree (file_type) TABLESPACE pg_default;

-- Create trigger for updated_at
CREATE TRIGGER update_user_files_updated_at
  BEFORE UPDATE ON public.user_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own files
CREATE POLICY "Users can view own files" ON public.user_files
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own files
CREATE POLICY "Users can insert own files" ON public.user_files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own files
CREATE POLICY "Users can update own files" ON public.user_files
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete own files" ON public.user_files
  FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.user_files TO authenticated;
GRANT ALL ON public.user_files TO service_role;

-- Add comment
COMMENT ON TABLE public.user_files IS 'Stores metadata for user uploaded files';
COMMENT ON COLUMN public.user_files.storage_path IS 'Path to file in storage bucket';
COMMENT ON COLUMN public.user_files.storage_bucket IS 'Storage bucket name (default: user-files)';
COMMENT ON COLUMN public.user_files.is_encrypted IS 'Whether the file is encrypted';
COMMENT ON COLUMN public.user_files.encryption_key_id IS 'ID of encryption key used (if encrypted)';
