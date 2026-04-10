# Project Research Summary

**Project:** Raider Bot
**Domain:** Slack-native staff engagement automation for client social publishing
**Researched:** 2026-04-10
**Confidence:** MEDIUM

## Executive Summary

Raider Bot is best treated as an event-driven Slack service with four core responsibilities: ingest raid targets, post them into Slack, score staff reactions against the real publish timestamp, and turn those logs into recurring reinforcement loops. The safest implementation path is a single Node.js service using Bolt for Slack interactions and Postgres for canonical raid and scoring data.

The research points to one dominant product risk: if `published_at` is not authoritative, the score model quickly loses credibility. That makes authenticated publish webhooks and explicit low-confidence fallbacks part of the core product, not optional polish. The other major delivery risk is non-idempotent event handling, because duplicate events would directly corrupt the leaderboard.

## Key Findings

### Recommended Stack

Node.js 24 LTS, TypeScript, Bolt for JavaScript, and Supabase-backed Postgres are a strong fit for the MVP. This keeps the product in one language, one runtime, and one durable store while still supporting Slack events, commands, recurring jobs, and audit-friendly reporting.

**Core technologies:**
- Node.js: runtime for long-lived event processing
- `@slack/bolt`: Slack app framework for events, commands, and message posting
- Postgres: canonical source of truth for raids, logs, and reporting
- `postgres` SQL driver: transactional writes and leaderboard queries

### Expected Features

The table-stakes feature set is compact but strict: fast raid posting, simple reaction logging, deterministic timing-based scoring, audit logs, and command/scheduled reporting loops. Differentiation comes from accurate webhook timing, first-30-minute metrics, and selective reminders instead of generic "engagement" counting.

**Must have (table stakes):**
- Raid target posting into Slack
- Reaction-to-action mapping with dedupe and reversal
- Timeliness scoring based on `published_at`
- Monthly leaderboard and personal stats
- Durable logs for reporting and resets

**Should have (competitive):**
- Webhook ingest with authoritative timing
- Low-confidence timing flags
- First-30-minute metrics in reports

**Defer (v2+):**
- Off-platform verification
- Full analytics dashboard
- Heavy gamification polish

### Architecture Approach

The architecture should separate transport concerns from product rules. Slack handlers and webhook routes should stay thin, while scoring, raid creation, reporting, and reminder logic live in shared domain services backed by Postgres. Scheduled jobs should reuse the same reporting layer as slash commands so there is one canonical interpretation of the data.

**Major components:**
1. Ingestion layer - `/raid`, publish webhooks, and recurring jobs
2. Slack app layer - commands, event handlers, and message builders
3. Domain services - raid creation, scoring, roster, reporting, reminders
4. Data layer - `team_members`, `raid_posts`, `engagement_logs`, and snapshots

### Critical Pitfalls

1. **Wrong timing source** - always score from `published_at` when available
2. **Duplicate event handling** - make every write path idempotent
3. **Emoji ambiguity** - keep mapping canonical and visible
4. **Wrong reset timezone** - define ET explicitly in reports and month boundaries
5. **Manual flow becoming the default** - treat webhook ingest as a launch requirement, not a future nice-to-have

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Slack Core & Trusted Scoring
**Rationale:** The team needs a trustworthy scoring core before adding automation or reporting.
**Delivers:** Manual raid creation, Slack raid messages, canonical scoring rules, and durable logs.
**Addresses:** Core staff interaction loop and product correctness.
**Avoids:** Emoji ambiguity and untestable scoring logic.

### Phase 2: Publish Automation & Staff Commands
**Rationale:** The core value depends on fast, authoritative publish ingest and reliable command surfaces.
**Delivers:** Authenticated webhook ingest, dedupe, roster mapping, and staff-visible commands.
**Uses:** Bolt HTTP receiver and Postgres-backed idempotency.
**Implements:** Ingestion and query services.

### Phase 3: Reporting, Reminders & Launch Hardening
**Rationale:** Once the loop works end-to-end, the product needs reinforcement and operational durability.
**Delivers:** Scheduled summaries, monthly resets, low-participation surfacing, and launch validation.
**Uses:** Scheduled jobs and reusable reporting queries.

### Phase Ordering Rationale

- Scoring correctness comes before automation because bad scores destroy trust quickly.
- Automation comes before advanced reporting because the product goal is zero-manual-chasing with accurate timing.
- Reporting and reminders come last because they depend on stable logs and trustworthy aggregates.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Upstream publish webhook contract and auth details
- **Phase 3:** Reminder thresholds and scheduler ownership

Phases with standard patterns (skip research-phase):
- **Phase 1:** Slack event handling and deterministic scoring logic are straightforward

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core platform choices are strong and current, though final package mix can still shift |
| Features | HIGH | The supplied technical spec is unusually specific about product behavior |
| Architecture | MEDIUM | Architecture shape is clear, but upstream publish integration details are still open |
| Pitfalls | MEDIUM | Risks are well understood, but reminder tuning and ownership rules need live feedback |

**Overall confidence:** MEDIUM

### Gaps to Address

- Confirm the authoritative `published_at` source and webhook contract
- Decide whether 60m+ engagement scores low points or zero
- Decide whether LinkedIn belongs in launch scope or just the schema
- Decide whether self-raids are excluded by default or only when enabled per team/client

## Sources

### Primary (HIGH confidence)
- https://docs.slack.dev/tools/bolt-js/getting-started/
- https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/
- https://docs.slack.dev/tools/bolt-js/concepts/commands
- https://supabase.com/docs/guides/database/overview
- https://supabase.com/docs/guides/functions/schedule-functions
- https://docs.railway.com/reference/cron-jobs

### Secondary (MEDIUM confidence)
- npm registry queries on 2026-04-10 for package versions
- Raider Bot technical specification provided on 2026-04-10

### Tertiary (LOW confidence)
- Product-pattern inference comparing employee advocacy tools and manual Slack processes

---
*Research completed: 2026-04-10*
*Ready for roadmap: yes*
