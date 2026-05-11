# Architecture

A high-level map of how requests flow through Loom AI and where each concern lives.

## System diagram

```
                ┌──────────────────────────────────────────────────────┐
                │                     Browser                          │
                │   Next.js client (RSC + client components)           │
                └───────────────┬─────────────────────┬────────────────┘
                                │                     │
                          (server actions /            │ (Supabase JS
                           fetch to /api/*)            │  auth + realtime)
                                │                     │
                ┌───────────────▼─────────────────────▼────────────────┐
                │            Next.js server  (middleware.ts)           │
                │  • updateSession  → refresh Supabase auth cookie     │
                │  • subscriptionMiddleware → gate /protected routes   │
                └───────────────┬──────────────────────────────────────┘
                                │
       ┌────────────────────────┼──────────────────────────┬───────────────┐
       │                        │                          │               │
       ▼                        ▼                          ▼               ▼
  app/api/chat            app/api/memories/...       app/api/webhooks   app/api/auth
  → handlers/api/         CRUD + encryption          Lemonsqueezy +     OAuth callbacks
    chat.ts → OpenAI                                 integration hooks  (lib/oauth-service)
       │
       ▼
  lib/memory.ts ─────────────────────────────────────────────────┐
  lib/encrypted-file-service.ts                                  │
  lib/crypto.ts  (E2E per-user keys)                             │
       │                                                         │
       ▼                                                         ▼
  Supabase Postgres                                       Supabase Storage
  • RLS on every table                                    • per-user buckets
  • numbered migrations in schema/migrations/             • encrypted blobs
  • cron → execute-task edge fn

                ┌──────────────────────────────────────────────────────┐
                │   Supabase Edge Function:  execute-task              │
                │   • Reads due reminders / scheduled actions          │
                │   • Resolves OAuth tokens (lib/oauth-service)        │
                │   • Calls real provider APIs                         │
                │     (Gmail send, Slack post, Notion write, …)        │
                │   • Writes execution logs back to Postgres           │
                └──────────────────────────────────────────────────────┘
```

## Request flow — typical authenticated page

1. Browser hits `/protected/memories`.
2. `middleware.ts` runs:
   - `updateSession()` refreshes the Supabase auth cookie.
   - If path matches a premium route, `subscriptionMiddleware.checkPremiumAccess()` queries the active plan; non-paying users are redirected to `/protected/billing`.
3. The server component renders, using `lib/supabase/server.ts` to fetch the user's data with RLS.
4. Client components (under `components/memories`) hydrate and use hooks from `hooks/` for further interactions.

## Request flow — AI chat

1. `POST /api/chat` → `app/api/chat/route.ts` → `handlers/api/chat.ts`.
2. Handler authenticates the request via Supabase, loads relevant memories (`lib/memory.ts`), decrypts them with `lib/crypto.ts` keyed by the user.
3. Builds a prompt and calls OpenAI through the `openai` SDK.
4. Streams the reply back; if the model emits an action plan, `lib/action-executor.ts` / `lib/real-action-executor.ts` either runs it inline or enqueues it for the edge function.

## Scheduler — reminders & automations

- `lib/reminder-service.ts` and `lib/task-scheduler.ts` write rows into reminder / task tables.
- Postgres cron (set up in `schema/migrations/019…022`) invokes the **`execute-task` Edge Function** on a schedule.
- The edge function loads due rows, resolves user OAuth credentials, and calls the real provider API (Gmail, Slack, Notion, Google Calendar).
- Outcomes are written to `task_execution_logs` for the user-facing automation feed.

## Encryption model

- Each user has an encryption profile (`/api/user-encryption-profile`); recovery key lives only with the user.
- Memory text, file blobs, and integration tokens are stored encrypted at rest.
- `lib/encrypted-file-service.ts` handles upload/download via Supabase Storage.
- The legacy `memories` table predates encryption; the in-progress migration to the encrypted equivalent is the #1 item in `Todo.md`.

## Billing

- Plans are seeded by `scripts/seed-plans.js` (variant IDs come from Lemonsqueezy).
- Webhook (`app/api/webhooks/...`) receives subscription events → upserts into `subscriptions` + `usage` tables.
- `lib/subscription-service.ts` + `lib/subscription-middleware.ts` answer "can this user do X?" both at the route gate and inside individual API handlers (`lib/api-subscription-guard.ts`).
- Usage limits enforced by `lib/usage-limit-middleware.ts` + `lib/usage-tracking-service.ts`.

## Where the code lives — quick lookup

| If you want to change…           | Go to                                                                   |
| -------------------------------- | ----------------------------------------------------------------------- |
| The chat prompt / OpenAI call    | `handlers/api/chat.ts` + `lib/memory.ts`                                |
| Memory storage / encryption      | `lib/memory.ts`, `lib/crypto.ts`, `lib/encrypted-file-service.ts`        |
| What runs a scheduled action     | `supabase/functions/execute-task/index.ts` + `lib/real-action-executor.ts` |
| Add a new OAuth provider         | `lib/oauth-service.ts` + new row in `integration_providers` table       |
| Billing rules / plan gating      | `lib/subscription-*.ts`, `middleware.ts`                                |
| Add a DB migration               | New `NNN-name.sql` in `schema/migrations/` then `npm run migrate`       |
| Add a new authenticated page     | `app/protected/<route>/page.tsx`                                        |
| Add a new API route              | `app/api/<route>/route.ts` (delegate logic into `lib/` or `handlers/`)  |
