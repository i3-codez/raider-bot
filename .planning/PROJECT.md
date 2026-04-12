# Raider Bot

## What This Is

Raider Bot is a shipped Slack-native internal app for Impact3 that turns newly published client social posts into time-sensitive raid prompts for staff. It posts new targets into Slack, lets staff self-report their off-platform actions with emoji reactions, and scores those actions based on both type and speed. The v1.0 release is X-first, with the data model and command surfaces ready for future platform expansion once the core loop is proven in production.

## Core Value

A newly published client post reaches the right staff in Slack fast enough that meaningful engagement happens inside the first 30 minutes.

## Current State

- Shipped version: `v1.0 Raider Bot MVP` on 2026-04-12
- Product state: manual and webhook raid ingest, reaction scoring, staff commands, scheduled summaries, month-close snapshots, and ops surfacing are implemented and verified in-repo
- Remaining operational debt: private-pilot Slack validation, Railway cron ownership confirmation, and real month-close execution in a credentialed environment

## Requirements

### Validated

- ✓ Slack raid intake, canonical Slack posting, and durable raid metadata — v1.0 (`RAID-01` to `RAID-06`)
- ✓ Reaction-based scoring, reversible audit history, and optional self-raid exclusion — v1.0 (`ENG-01` to `ENG-07`)
- ✓ Staff leaderboard, personal stats, and help command surfaces — v1.0 (`TEAM-01` to `TEAM-04`)
- ✓ Scheduled summaries, monthly snapshotting, and ops surfacing — v1.0 (`RPT-01` to `RPT-04`)

### Active

- [ ] Verify claimed engagement against supported platform APIs when trust issues justify the added complexity.
- [ ] Support an additional launch-ready platform flow beyond X with platform-specific copy and scoring guardrails.
- [ ] Provide client-level historical analytics outside Slack.
- [ ] Allow custom emoji and richer gamification rules without rewriting the scoring engine.

### Out of Scope

- Off-platform verification against X or LinkedIn APIs - excluded from MVP to keep launch friction low.
- A full analytics dashboard in v1.0 - deferred until the core Slack loop proves behavior change.
- Broad multi-platform parity at launch - X remains the proven launch path; expansion should follow validated operator demand.
- Custom emoji packs - standard emoji are sufficient until the core reaction flow is stable.

## Context

Raider Bot exists because Impact3's previous engagement workflows depended on manual chasing and had no accountability loop. The shipped v1.0 product now covers the full Slack-native operating loop: operators can create raids manually or via webhook, staff can claim actions with canonical emoji, and reporting plus reminder jobs reinforce the behavior over completed ET windows.

The interaction model remains Slack-native: raid targets are distributed in a dedicated Slack channel, staff log actions through message reactions, and slash commands provide manual creation, stats, and help surfaces. The external system boundary is equally important: a publishing workflow or other upstream trigger should provide the authoritative `published_at` timestamp whenever possible so scoring stays tied to real post timing instead of Slack delivery lag.

The current codebase is roughly 7.6k lines of TypeScript and SQL across `src`, `tests`, and `supabase`, with `58` passing Vitest checks and successful typechecking during milestone closeout. The technical direction remains Bolt.js on Node.js, Supabase Postgres for persistence, and Railway or a comparable always-on host for the bot and webhook endpoints. The system still retains a trust-based posture: Slack reactions are accepted as claimed engagement, but the data model preserves enough detail to support future audits, automation, and reporting.

Open follow-through items worth carrying forward:

- Which upstream workflow will own the production `published_at` webhook path and monitoring?
- Which additional platform should follow X once the private pilot proves the loop?
- When should off-platform verification become worth the auth and API complexity?
- What analytics surface is most useful once Slack-only reporting stops being enough?

## Next Milestone Goals

- Turn the private-pilot operational checklist into verified production evidence rather than documented debt.
- Decide whether the next investment is trust hardening, platform expansion, or analytics depth.
- Preserve the canonical raid/scoring/reporting seams while broadening product scope.

## Constraints

- **Platform**: Slack-first app using Bolt.js - the product interaction model depends on Slack events, commands, and bot-posted messages.
- **Timing**: Score against `published_at` - fairness and product alignment break if Slack delivery time becomes the source of truth.
- **Trust Model**: Reactions are accepted as good-faith claims - MVP should avoid external API verification complexity.
- **Data Retention**: Monthly scores reset but history persists - reporting and future audits require durable logs.
- **Operational Scope**: Launch around X first - broad social parity would dilute the first release.
- **Reporting Timezone**: Scheduled summaries should align to Eastern Time - the spec defines report timing in ET and staff behavior will be judged on that cadence.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build Raider Bot as a dedicated Slack app | The product loop is native to Slack distribution, reactions, and commands | ✓ Good |
| Use Bolt.js with a hosted HTTP receiver | Slack events and slash commands fit Bolt cleanly, and HTTP hosting supports production webhooks | ✓ Good |
| Use Supabase Postgres for durable raid and scoring data | The scoring rules, dedupe needs, and reporting queries need relational storage | ✓ Good |
| Treat emoji reactions as trusted engagement claims in MVP | This preserves launch speed and avoids OAuth/API verification complexity | ✓ Good |
| Use a fixed integer timing matrix instead of multipliers | The score model is easier to explain and audit with whole numbers | ✓ Good |
| Prefer publish webhooks over RSS as the primary automation path | The product's core value depends on timing accuracy and low latency | ✓ Good |
| Use one canonical raid creation path for manual and automated ingest | Shared persistence and Slack-posting logic reduce drift between operator and webhook flows | ✓ Good |
| Keep reporting and scheduled jobs ET-aware with dry-run-safe script entrypoints | Reporting cadence and pilot safety both depend on deterministic time windows and script-level validation | ✓ Good |
| Accept Phase 3 pilot validation as operational debt for milestone closeout | The code and integration contracts are complete, but live Slack and scheduler proof require a credentialed environment | ⚠ Revisit after pilot |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-12 after v1.0 milestone completion*
