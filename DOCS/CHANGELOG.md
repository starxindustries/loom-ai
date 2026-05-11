# Restructure Changelog

Tracks structural / documentation changes made during the "make this showcasable" pass.
Application behavior, public APIs, and dependencies are unchanged.

## Restructure pass — initial

**Docs**
- Added `DOCS/REPO_OVERVIEW.md` — plain-English overview, stack, run commands, TODOs.
- Added `DOCS/ARCHITECTURE.md` — request flow, scheduler, encryption, lookup table.
- Added `DOCS/CHANGELOG.md` (this file).
- Renamed lowercase `docs/` → `DOCS/`; existing `oauth-setup.md` and `project-folder-structure.md` preserved inside.
- Rewrote `README.md` as a developer-facing entry point (quickstart, architecture, layout). Old marketing copy preserved as **"What is Loom AI?"** intro at the top.

**Repo hygiene**
- Moved stray `update-gmail-scopes.sql` from repo root → `schema/migrations/023-update-gmail-scopes.sql` so all SQL lives in one ordered place.
- Removed working-tree copy of `.env.local.backup` (it contained live secrets — see security note below).
- Tightened `.gitignore` to ignore `*.backup` and `.env.*.backup`.

**Env**
- Expanded `.env.example` from 2 vars → full list of every `process.env.*` actually referenced in the codebase (Supabase service role, OpenAI, Google primary + integration OAuth, Slack, Notion, Lemonsqueezy, internal/admin tokens, app URL).

## Not done (would need owner sign-off)

- Did **not** purge `.env.local.backup` from git history. The secrets are still recoverable from prior commits. Action required by repo owner: rotate every key in that file and run `git filter-repo --path .env.local.backup --invert-paths` (or BFG) and force-push.
- Did **not** rename any source files or move modules out of `lib/` — the flat-but-readable layout is fine for a Next.js app this size; touching it would churn imports across dozens of files without clear payoff for a showcase.
- Did **not** introduce a `tests/` folder — the project currently has no test runner configured; adding one is a separate decision.
