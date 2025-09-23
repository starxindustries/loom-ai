import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Service client for background/server tasks (no request cookies).
 * Uses the service role key; do NOT expose this to the browser.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  if (!url || !serviceKey) {
    throw new Error('Supabase service client misconfigured: missing URL or SERVICE_ROLE key');
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'service-client',
      },
    },
  });
}


