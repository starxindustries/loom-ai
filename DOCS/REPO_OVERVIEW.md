# Repo Overview

## What this is

**Loom AI** is a Next.js (App Router) + Supabase web app that acts as an encrypted "memory card" for a single user. The user stores notes, files, and time-based reminders; the AI assistant reads them on demand and can execute automated actions (send Gmail, post to Slack, write to Notion, create calendar events) through OAuth-connected providers.

It is a fully working SaaS skeleton: auth, billing, encrypted storage, integrations, admin, analytics, and a scheduler — built on Supabase Postgres + Edge Functions.

## Tech stack

| Layer            | Choice                                                         |
| ---------------- | -------------------------------------------------------------- |
| Framework        | Next.js 15 (App Router, Turbopack), React 19, TypeScript       |
| Styling          | Tailwind v4 + shadcn/ui + Radix primitives                     |
| Auth + DB        | Supabase (Postgres, RLS, Auth, Storage, Edge Functions)        |
| AI               | OpenAI SDK                                                     |
| Billing          | Lemonsqueezy (webhooks → subscription tables)                  |
| Integrations     | Google (Gmail / Calendar), Slack, Notion — all via OAuth2      |
| Scheduler        | Supabase Edge Function `execute-task` invoked by Postgres cron |
| Crypto           | Per-user E2E encryption (`lib/crypto.ts`)                      |
| Package manager  | Bun (`bun.lock` checked in) — npm also works                   |

## Top-level layout

```
app/                  Next.js App Router
  (public)/           Landing, pricing, blogs, /auth/*
  protected/          Authenticated app: memories, files, billing, settings, admin
  api/                Route handlers for chat, files, integrations, webhooks, etc.
components/           UI building blocks (ui = shadcn primitives)
hooks/                Client-side React hooks
lib/                  All business logic + service modules (crypto, OAuth, billing,
                      memory, reminders, task scheduler, encryption helpers, …)
  supabase/           Server/Client/Service Supabase factory helpers
handlers/             Thin API handlers reused by route.ts files
schema/               Canonical SQL: full schema + numbered migrations
  migrations/         001…023 ordered .sql files + run_migrations.sql
supabase/functions/   Deno Edge Functions (execute-task = the action runner)
scripts/              One-off Node admin scripts (migrations, env check, OAuth debug)
types/                Shared TypeScript types
public/               Static assets
DOCS/                 This folder
middleware.ts         Auth + subscription gating for /protected routes
```

## How to run it (right now)

Prerequisites: Bun (or Node 20+) and a Supabase project.

```bash
# 1. Install deps
bun install        # or: npm install

# 2. Configure environment
cp .env.example .env.local
# fill in Supabase URL/anon/service-role, OPENAI_API_KEY, OAuth creds, etc.

# 3. Provision the database (runs migrations + seeds plans + migrates users)
npm run setup:db

# 4. Start dev server
bun run dev        # http://localhost:3000
```

Available scripts:

| Command                  | What it does                                            |
| ------------------------ | ------------------------------------------------------- |
| `bun run dev`            | Next dev server (Turbopack)                             |
| `bun run build` / `start`| Production build / serve                                |
| `bun run lint`           | Next lint                                               |
| `npm run migrate`        | Apply numbered SQL migrations in `schema/migrations/`   |
| `npm run migrate:status` | Show which migrations have been applied                 |
| `npm run seed:plans`     | Seed Lemonsqueezy subscription plans                    |
| `npm run migrate:users`  | Backfill the user table from auth.users                 |
| `npm run setup:db`       | One-shot: migrate → seed plans → migrate users          |

## Main entrypoints

- `app/(public)/page.tsx` — landing page (unauthenticated)
- `app/protected/page.tsx` — authenticated dashboard
- `app/api/chat/route.ts` — AI chat endpoint (uses `handlers/api/chat.ts`)
- `app/api/webhooks/...` — Lemonsqueezy + integration webhooks
- `supabase/functions/execute-task/index.ts` — scheduled action runner
- `middleware.ts` — auth + plan gating

## Known issues / TODOs

Active TODOs the author is tracking (see `Todo.md`):

1. RPC functions still reference the pre-encryption `memories` table — migrate them to the encrypted table.
2. Unify the visual theme for consistency.
3. Replace Lemonsqueezy with PayPal billing.
4. Add a customer-support email.
5. Make the file-prompt manual (don't auto-send) — let the user edit first.
6. Build out public pages: terms, privacy, about, contact, plus blogs.

**Security note (do this first):** `git log` includes a commit that added `.env.local.backup` containing real Supabase service-role, OpenAI, Google OAuth, and Lemonsqueezy secrets. Even though the file has been removed from the working tree, the secrets remain in git history. **Rotate every key in that file and purge the blob from history** (e.g. `git filter-repo --path .env.local.backup --invert-paths`) before publishing this repo.

## Where to read more

- [ARCHITECTURE.md](./ARCHITECTURE.md) — request flow, scheduler, encryption model
- [oauth-setup.md](./oauth-setup.md) — connecting Google / Slack / Notion
- [project-folder-structure.md](./project-folder-structure.md) — original target layout (aspirational)
- [../schema/migrations/README.md](../schema/migrations/README.md) — migration ordering
