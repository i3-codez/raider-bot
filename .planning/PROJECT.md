# Raider Bot

## What This Is

Raider Bot is a Slack-native internal app for Impact3 that turns newly published client social posts into time-sensitive "raid" prompts for staff. It posts new targets into Slack, lets staff self-report their off-platform actions with emoji reactions, and scores those actions based on both type and speed. The product is designed first for X, with room to extend to LinkedIn once the core loop is working.

## Core Value

A newly published client post reaches the right staff in Slack fast enough that meaningful engagement happens inside the first 30 minutes.

## Requirements

### Validated

(None yet - ship to validate)

### Active

- [ ] Publish or manual raid events create a Slack raid target quickly and reliably.
- [ ] Staff can claim likes, comments, reposts, and quote posts with simple Slack reactions.
- [ ] Scoring rewards early action based on the true publish timestamp, not Slack post time.
- [ ] Leaderboards and personal stats make participation visible and repeatable.
- [ ] Scheduled summaries reinforce early participation behavior over time.
- [ ] Historical raid and scoring data remain queryable even after monthly resets.

### Out of Scope

- Off-platform verification against X or LinkedIn APIs - excluded from MVP to keep launch friction low.
- A full analytics dashboard - deferred until the core Slack loop proves behavior change.
- Broad multi-platform parity at launch - X is the launch priority; LinkedIn stays structurally possible but secondary.
- Custom emoji packs - standard emoji are sufficient until the core reaction flow is stable.

## Context

Raider Bot exists because Impact3's previous engagement workflows depended on manual chasing and had no accountability loop. The product is explicitly optimizing for the first 30 minutes after a client post goes live, because that window has the highest expected distribution value on X.

The interaction model is Slack-native: raid targets are distributed in a dedicated Slack channel, staff log actions through message reactions, and slash commands provide manual creation, stats, and help surfaces. The external system boundary is equally important: a publishing workflow or other upstream trigger should provide the authoritative `published_at` timestamp whenever possible so scoring stays tied to real post timing instead of Slack delivery lag.

The current technical direction is Bolt.js on Node.js, Supabase Postgres for persistence, and Railway or a comparable always-on host for the bot and webhook endpoints. The system should retain a trust-based MVP posture: Slack reactions are accepted as claimed engagement, but the data model must preserve enough detail to support future audits, automation, and reporting.

Open product questions still worth carrying forward:

- Which upstream workflow will provide the authoritative `published_at` value?
- Is LinkedIn truly in the MVP or only schema-ready for later?
- Should 60m+ engagement score low points or zero?
- Should self-raids be excluded whenever an owner can be identified?
- Should weak early participation trigger automated reminders at minute 10 or minute 20?
- Should the raid channel be public, private, or opt-in?

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
| Build Raider Bot as a dedicated Slack app | The product loop is native to Slack distribution, reactions, and commands | Pending |
| Use Bolt.js with a hosted HTTP receiver | Slack events and slash commands fit Bolt cleanly, and HTTP hosting supports production webhooks | Pending |
| Use Supabase Postgres for durable raid and scoring data | The scoring rules, dedupe needs, and reporting queries need relational storage | Pending |
| Treat emoji reactions as trusted engagement claims in MVP | This preserves launch speed and avoids OAuth/API verification complexity | Pending |
| Use a fixed integer timing matrix instead of multipliers | The score model is easier to explain and audit with whole numbers | Pending |
| Prefer publish webhooks over RSS as the primary automation path | The product's core value depends on timing accuracy and low latency | Pending |

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
*Last updated: 2026-04-10 after initialization*
