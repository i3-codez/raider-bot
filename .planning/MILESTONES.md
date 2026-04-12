# Milestones

## v1.0 Raider Bot MVP (Shipped: 2026-04-12)

**Phases completed:** 3 phases, 13 plans, 25 tasks

**Key accomplishments:**

- Node 24 TypeScript service scaffolding with validated Slack/Postgres env loading, redacted pino logging, and shared Eastern-time helpers
- Versioned Slack app manifest with a shared `/slack/events` delivery path and Bolt HTTPReceiver bootstrap seams for commands and reactions
- Canonical Phase 1 scoring types, emoji registry, fixed timing matrix, and reusable Slack raid message builder
- Postgres pool entry point plus explicit Supabase tables for raid posts, engagement logs, and timing-correction audit history
- Operator-only `/raid` modal intake, manual raid posting, durable Slack metadata persistence, and approximate-timing confirmation flow
- Slack reaction listeners wired into deterministic scoring services with reversible engagement audit rows and exact raid-message lookup
- Authoritative publish-time correction service with audit history, deterministic engagement rescoring, and a reachable operator CLI
- Authenticated webhook ingest plus shared raid creation and dedupe metadata
- Roster storage, owner-alias resolution, and optional self-raid exclusion
- Reusable monthly reporting plus leaderboard, mystats, and help commands
- Reusable ET-aware summaries and cron-safe summary jobs
- Durable month-close snapshots and ops surfacing
- Pilot-check orchestration, runbook, and final verification

---
