-- ============================================================================
-- Add Server-Side OAuth Tokens for Automation
-- ============================================================================

-- Add unencrypted token fields for server-side access
ALTER TABLE public.user_integrations 
ADD COLUMN IF NOT EXISTS server_access_token TEXT,
ADD COLUMN IF NOT EXISTS server_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS server_token_expires_at TIMESTAMPTZ;

-- Add index for token lookups
CREATE INDEX IF NOT EXISTS idx_user_integrations_server_tokens 
ON public.user_integrations(user_id, provider_id) 
WHERE server_access_token IS NOT NULL;

-- Update RLS policies to allow service role access to server tokens
CREATE POLICY "Service role can access server tokens" 
ON public.user_integrations 
FOR ALL 
TO service_role 
USING (true);

COMMENT ON COLUMN public.user_integrations.server_access_token IS 'Unencrypted OAuth access token for server-side automation (reminders, etc.)';
COMMENT ON COLUMN public.user_integrations.server_refresh_token IS 'Unencrypted OAuth refresh token for server-side automation';
COMMENT ON COLUMN public.user_integrations.server_token_expires_at IS 'When the server access token expires';
