# Loom AI

> An encrypted "memory card" for humans — store notes, files, and reminders; let an AI assistant recall them and run automations on your behalf.

Built with Next.js 15, Supabase, and OpenAI. Per-user end-to-end encryption, OAuth-driven integrations (Gmail, Slack, Notion, Google Calendar), Lemonsqueezy billing, and a Supabase Edge Function scheduler that executes time-based actions.

## What this project does

- 📒 **Memory store** — encrypted notes, passwords, reference info, structured records.
- 📎 **Encrypted files** — upload & retrieve documents stored as encrypted blobs in Supabase Storage.
- ⏰ **Reminders & automations** — schedule actions like "email my boss at 9am Monday"; an Edge Function executes them via the user's OAuth-connected accounts.
- 🤖 **AI chat** — assistant that reads (decrypted) memories on demand and proposes / runs actions.
- 💳 **Subscriptions** — plan gating + usage limits powered by Lemonsqueezy webhooks.
- 🛠️ **Admin / analytics / settings** — full SaaS shell.

## Tech stack

- **Framework:** Next.js 15 (App Router, Turbopack) · React 19 · TypeScript
- **Styling:** Tailwind v4 · shadcn/ui · Radix
- **Auth + DB + Storage + Edge Functions:** Supabase (Postgres + RLS)
- **AI:** OpenAI SDK
- **Billing:** Lemonsqueezy
- **Integrations:** Google OAuth (Gmail / Calendar), Slack, Notion
- **Package manager:** Bun (npm works too)

## Quickstart

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 (or Node 20+)
- A [Supabase](https://supabase.com) project (free tier is fine)
- An [OpenAI](https://platform.openai.com) API key
- *(Optional)* Lemonsqueezy store, Google / Slack / Notion OAuth apps for the full feature set

### Install & run

```bash
git clone <this-repo> loom-ai && cd loom-ai

# 1. Install
bun install              # or: npm install

# 2. Configure environment
cp .env.example .env.local
# fill in Supabase, OpenAI, OAuth, and Lemonsqueezy keys (all documented inline)

# 3. Provision the database
npm run setup:db         # = migrate + seed plans + migrate users

# 4. Start the dev server
bun run dev              # http://localhost:3000
```

For OAuth integration setup (Gmail, Slack, Notion), see **[DOCS/oauth-setup.md](DOCS/oauth-setup.md)**.

### All scripts

| Command                   | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `bun run dev`             | Next dev server (Turbopack)                            |
| `bun run build` / `start` | Production build / serve                               |
| `bun run lint`            | Lint                                                   |
| `npm run migrate`         | Apply numbered SQL migrations in `schema/migrations/`  |
| `npm run migrate:status`  | Show which migrations have been applied                |
| `npm run seed:plans`      | Seed Lemonsqueezy subscription plans                   |
| `npm run migrate:users`   | Backfill the `users` table from `auth.users`           |
| `npm run setup:db`        | One-shot: migrate → seed plans → migrate users         |

## Usage examples

**AI chat endpoint** (authenticated):

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: <your supabase session cookie>" \
  -d '{"messages":[{"role":"user","content":"What is my wifi password?"}]}'
```

**Common pages once the dev server is running:**

- `/` — landing page
- `/auth/login` — sign in (Supabase auth)
- `/protected` — main dashboard (requires login + active plan)
- `/protected/memories` — encrypted memory store
- `/protected/automations` — scheduled actions
- `/protected/settings` — connect OAuth integrations
- `/protected/billing` — Lemonsqueezy plan management

## Architecture

```
Browser
  │
  ▼
Next.js middleware  ── auth refresh + subscription gating
  │
  ├─► app/api/chat            → OpenAI + memory recall
  ├─► app/api/memories/*      → encrypted CRUD
  ├─► app/api/webhooks/*      → Lemonsqueezy + integration callbacks
  └─► app/api/auth/oauth/*    → connect Google / Slack / Notion
        │
        ▼
   Supabase  (Postgres w/ RLS · Auth · Storage · Edge Functions)
        │
        ▼
   execute-task edge function   ── cron-driven action runner
   (Gmail send · Slack post · Notion write · Calendar event)
```

A deeper, annotated diagram lives in **[DOCS/ARCHITECTURE.md](DOCS/ARCHITECTURE.md)**.

## Repo layout

```
app/             Next.js App Router (public, protected, api)
components/      UI components (ui/ = shadcn primitives)
hooks/           Client hooks
lib/             Business logic: crypto, memory, OAuth, billing, scheduler
  supabase/      Supabase client/server/service factories
handlers/        Thin API handlers shared by route.ts files
schema/          Canonical SQL + numbered migrations
supabase/        Edge functions (execute-task)
scripts/         One-off Node admin scripts
types/           Shared TS types
DOCS/            REPO_OVERVIEW, ARCHITECTURE, CHANGELOG, OAuth setup
middleware.ts    Auth + plan gating
```

Where to look when changing things → see the lookup table in **[DOCS/ARCHITECTURE.md](DOCS/ARCHITECTURE.md#where-the-code-lives--quick-lookup)**.

## ⚠️ Security note for anyone forking this repo

A previous commit (`66aeb95`) added `.env.local.backup` containing **live secrets**: Supabase service-role key, OpenAI key, Google OAuth secrets, and Lemonsqueezy API key. The file has been removed from the working tree, but **the secrets are still recoverable from git history**. Before publishing:

1. **Rotate** every key that appeared in that file.
2. **Purge** the blob from history:
   ```bash
   git filter-repo --path .env.local.backup --invert-paths
   git push --force-with-lease
   ```
   (or use [BFG](https://rtyley.github.io/bfg-repo-cleaner/))
3. Confirm `git log --all -- .env.local.backup` returns no matches.

## Roadmap

Tracked in [`Todo.md`](Todo.md). Highlights: migrate legacy RPCs onto the encrypted memories table, replace Lemonsqueezy with PayPal, build out the public-facing pages (terms, privacy, about, contact).

## License

No license file is currently in the repo. Add one (MIT / Apache-2.0 / proprietary) before sharing publicly. 
