# Supabase Edge Functions Setup

## Deploy the Edge Function

1. **Install Supabase CLI:**
```bash
npm install -g supabase
```

2. **Login to Supabase:**
```bash
supabase login
```

3. **Link your project:**
```bash
supabase link --project-ref thyqmgekkwwlqcwkgsmb
```

4. **Deploy the function:**
```bash
supabase functions deploy execute-task
```

## Test the Edge Function

```bash
# Test locally
supabase functions serve

# Test the deployed function
curl -X POST 'https://thyqmgekkwwlqcwkgsmb.supabase.co/functions/v1/execute-task' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "task_id": "test-task-id",
    "user_id": "test-user-id",
    "provider_slug": "gmail",
    "action_type": "send_email",
    "action_config": {
      "to": "test@example.com",
      "subject": "Test Email",
      "body": "Hello from Edge Function!"
    },
    "integration": {
      "encrypted_access_token": "your-gmail-token"
    }
  }'
```

## Environment Variables

The Edge Function automatically uses:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access

## Database Configuration

Run this SQL to update your database function:

```sql
-- Enable HTTP extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS http;

-- Run the migration 019-use-edge-function.sql
-- This updates execute_scheduled_task to call the Edge Function
```

## Benefits of Edge Functions

✅ **No localhost issues** - runs on Supabase infrastructure
✅ **Same network** - fast communication with database
✅ **Built-in auth** - uses Supabase authentication
✅ **Easy deployment** - single command deployment
✅ **Automatic scaling** - handles traffic spikes
✅ **Real Gmail API** - actually sends emails!
