# Phase 2: Publish Automation & Staff Commands - Research

**Researched:** 2026-04-11
**Domain:** Publish webhook automation, raid dedupe, roster mapping, self-raid exclusion, and staff command query surfaces
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md) [VERIFIED: .planning/phases/02-publish-automation-staff-commands/02-CONTEXT.md]

### Locked Decisions [VERIFIED: .planning/phases/02-publish-automation-staff-commands/02-CONTEXT.md]
- **D-01:** Automated raid creation should use a dedicated authenticated HTTP webhook endpoint handled by the same Node or Bolt service.
- **D-02:** The publish webhook must require authoritative `published_at`, `post_url`, `client_name`, and `platform`; missing `published_at` should fail validation instead of creating a low-confidence automated raid.
- **D-03:** Webhook authentication should use a shared-secret header pattern with payload validation and secret redaction in logs.
- **D-04:** Publish automation should reuse the canonical raid creation path instead of creating a second posting code path.
- **D-05:** Dedupe should prefer an upstream idempotency key when present, while also protecting against repeated `(platform, post_url)` submissions.
- **D-06:** Duplicate publish requests should return an idempotent success result that points to the existing raid.
- **D-07:** Team roster data should be stored durably in Postgres, keyed by Slack user ID with active display name and optional owner identifiers or handles.
- **D-08:** Self-raid exclusion should be config-driven and apply only when owner data maps confidently to a known roster member.
- **D-09:** `/leaderboard` should be shared in Slack, while `/mystats` and `/raiderhelp` stay private.
- **D-10:** Command outputs must use reusable reporting or query services over canonical raid and engagement data.

### the agent's Discretion [VERIFIED: .planning/phases/02-publish-automation-staff-commands/02-CONTEXT.md]
- Exact webhook route shape and header naming.
- Exact URL normalization strategy for dedupe.
- Exact roster schema details for owner aliases.
- Exact leaderboard and help-message formatting.

</user_constraints>

<phase_requirements>
## Phase Requirements [VERIFIED: .planning/REQUIREMENTS.md]

| ID | Description | Research Support |
|----|-------------|------------------|
| RAID-02 | Publishing workflow can create a raid target through an authenticated webhook that includes `published_at`. | Extend the existing HTTP service with a dedicated authenticated webhook route, validate the required fields with `zod`, and feed the request into the same canonical raid-creation service used by Slack-driven flows. |
| RAID-04 | Duplicate publish events or repeated manual submissions do not create duplicate raid posts. | Add durable idempotency or dedupe schema plus query-layer conflict handling; do not rely on in-memory caches or Slack message identity alone. |
| ENG-07 | Self-raids can be excluded when a post owner is known and the rule is enabled. | Model post-owner metadata separately from `created_by_slack_user_id`, then enforce the rule in the scoring service before engagement writes are persisted. |
| TEAM-01 | Slack user IDs can be mapped to active leaderboard display names. | Add roster storage keyed by Slack user ID with display names and active state, plus optional owner aliases or handles for matching incoming payload owner data. |
| TEAM-02 | `/leaderboard` returns the current monthly ranking in Slack. | Build monthly aggregate queries from `engagement_logs` joined to `raid_posts`, filtered to active rows and grouped by roster display name. |
| TEAM-03 | `/mystats` DMs the requesting user their current-month stats. | Reuse the same reporting query layer as `/leaderboard`, but scoped to the requesting Slack user and delivered privately. |
| TEAM-04 | `/raiderhelp` explains the emoji mapping and scoring rules on demand. | Reuse the existing action registry and scoring windows so help text cannot drift from the scoring engine or raid message legend. |

</phase_requirements>

## Project Constraints (from AGENTS.md)

- Slack remains the primary interaction surface; command handlers and event handlers should stay thin and delegate into domain services. [VERIFIED: AGENTS.md]
- `published_at` stays the scoring source of truth; Slack post time is only a manual fallback path from Phase 1, not the automated webhook default. [VERIFIED: AGENTS.md][VERIFIED: .planning/phases/01-slack-core-trusted-scoring/01-CONTEXT.md]
- Reaction claims remain trust-based; Phase 2 should not add off-platform verification work. [VERIFIED: AGENTS.md]
- Historical raid and engagement rows remain the source of truth even as reporting surfaces are added. [VERIFIED: AGENTS.md]
- Work should stay inside GSD workflows and preserve the existing folder structure under `src/app`, `src/slack`, `src/domain`, and `src/db`. [VERIFIED: AGENTS.md]

## Existing Codebase Signals

- The HTTP runtime seam is `src/app/slack.ts`, which creates the `HTTPReceiver` and Bolt app, then delegates command and event registration. [VERIFIED: src/app/slack.ts]
- The current server entrypoint in `src/app/server.ts` only starts Bolt, so publish webhook ingress will require widening runtime wiring rather than dropping code into an existing generic router. [VERIFIED: src/app/server.ts]
- The canonical raid creation path is `src/domain/raids/create-manual-raid.ts`, which already derives `timing_confidence`, `month_key`, renders the raid message, posts to Slack, and persists the `raid_posts` row. [VERIFIED: src/domain/raids/create-manual-raid.ts]
- The canonical scoring write path is `src/domain/scoring/claim-engagement.ts` plus `src/db/queries/engagement-logs.ts`; this is the natural seam for optional self-raid exclusion. [VERIFIED: src/domain/scoring/claim-engagement.ts][VERIFIED: src/db/queries/engagement-logs.ts]
- The current schema only includes `raid_posts`, `engagement_logs`, and `raid_timing_corrections`, with no roster tables, publish idempotency fields, or reporting query layer yet. [VERIFIED: supabase/migrations/20260410213000_phase1_core.sql]

## Summary

Phase 2 should extend the Phase 1 architecture rather than branch away from it. The fastest safe path is to keep one canonical raid-creation flow, one canonical scoring model, and one query-backed reporting layer, then add automation and staff surfaces around those existing contracts. The main engineering risk is not HTTP routing itself; it is duplicate or ambiguous data corrupting raids, ownership logic, or leaderboard outputs.

The strongest reuse opportunity is the existing `createManualRaid` flow. Rather than building a separate “webhook raid” path, Phase 2 should extract or generalize the raid-creation logic so both manual and automated ingestion end with the same persisted raid shape and the same Slack message builder. That keeps timing correction, reporting, and message copy consistent with Phase 1.

The main schema gap is dedupe and roster identity. `raid_posts` only guarantees uniqueness for `(slack_channel_id, slack_message_ts)`, which is too late in the flow to prevent duplicate posts from repeated submissions. Phase 2 therefore needs a durable idempotency strategy at the database layer plus roster tables that distinguish the Slack operator who created a raid from the actual owner of the published post.

## Recommended Architecture

### 1. Shared Raid Ingestion Service
Create a transport-agnostic raid ingestion service that accepts validated input from either `/raid` or the publish webhook and centralizes:
- request normalization,
- timing confidence rules,
- dedupe lookup or insert behavior,
- Slack post creation,
- canonical `raid_posts` persistence,
- upgrade-from-manual behavior when a later webhook provides authoritative `published_at`.

If a webhook arrives for a post that already exists as a low-confidence manual raid, the preferred behavior is to reuse the existing raid and invoke the existing timing-correction path rather than create a second post. [VERIFIED: src/domain/raids/correct-raid-published-at.ts]

### 2. Durable Idempotency and Dedupe
Do not dedupe in memory. Follow the same general pattern as `engagement_logs`, which already uses database conflict handling for safe retry behavior. [VERIFIED: src/db/queries/engagement-logs.ts]

Recommended database support:
- a nullable upstream idempotency key or source event ID stored on `raid_posts` or a companion inbox table,
- a normalized post URL field suitable for unique comparison by `(platform, normalized_post_url)`,
- indexes that support month-scoped reporting and roster joins.

### 3. Roster and Ownership Model
Do not overload `created_by_slack_user_id` to mean “post owner.” That field is already the Slack operator who created the raid. [VERIFIED: src/db/queries/insert-raid-post.ts]

Recommended Phase 2 model:
- `team_members` or equivalent table keyed by Slack user ID,
- active display name stored with the member record,
- one or more external owner identifiers or handles associated with a member,
- owner metadata captured on the raid record so self-raid decisions remain auditable later.

### 4. Reporting Query Layer
Build query services under `src/db/queries/` or `src/domain/reporting/` and keep Slack handlers transport-only. `/leaderboard` and `/mystats` should reuse the same aggregates:
- read from `engagement_logs`,
- ignore removed claims via `removed_at IS NULL`,
- join to `raid_posts` for `month_key`,
- map Slack users through roster display names.

### 5. Help and Message Consistency
`/raiderhelp` should be generated from the existing action registry and scoring config so staff-facing help cannot drift from the raid message legend or points logic. [VERIFIED: src/domain/scoring/action-registry.ts][VERIFIED: src/domain/scoring/scoring-config.ts][VERIFIED: src/slack/blocks/build-raid-message.ts]

## Likely Code and Schema Changes

### Runtime and config
- `src/app/slack.ts` — widen HTTP receiver wiring for webhook ingress.
- `src/app/server.ts` — possibly adjust startup or routing bootstrapping.
- `src/config/env.ts` and `.env.example` — add webhook auth config and any feature toggles for self-raid exclusion.
- `slack/app-manifest.yml` — add `/leaderboard`, `/mystats`, and `/raiderhelp`.

### Domain and query layer
- Extend or refactor `src/domain/raids/create-manual-raid.ts` into a shared ingestion path.
- Add new query modules for webhook dedupe, roster lookup, leaderboard aggregation, and personal stats.
- Add new Slack command registration files under `src/slack/commands/`.
- Add a lightweight help or leaderboard block builder under `src/slack/blocks/`.

### Schema
- Add a new migration under `supabase/migrations/` for dedupe metadata, roster tables, ownership mapping, and reporting indexes.
- Preserve Phase 1 tables and audit semantics; Phase 2 should extend them, not replace them.

## Patterns to Follow

### Thin transport handlers
Match the existing command and event style:
- parse and validate input at the boundary,
- `ack()` quickly for Slack commands,
- delegate to domain services,
- keep SQL out of Slack handlers.

### Database-arbitrated retries
Use Postgres constraints and `ON CONFLICT` behavior for idempotent webhook writes. This is already the working pattern for engagement claims.

### Canonical reporting from logs
Treat `engagement_logs` plus `raid_posts` as canonical and derive leaderboard or personal stats from them. Do not introduce separate “score totals” tables as the new source of truth in Phase 2.

### Explicit privacy boundaries
Keep `/leaderboard` intentionally shared, but send `/mystats` and `/raiderhelp` privately. This matches the product intent and avoids unnecessary exposure of personal stats.

## Anti-Patterns to Avoid

- Creating a second automated raid-posting flow that bypasses the existing message builder or persistence path.
- Using Slack message identity alone for dedupe; that only helps after a duplicate has already been posted.
- Reusing `created_by_slack_user_id` as owner identity.
- Implementing leaderboard math directly in slash-command handlers instead of shared query services.
- Hard-coding help text that can drift from `ACTION_REGISTRY` or `SCORING_WINDOWS`.

## Testing Focus

Phase 2 planning should include tests for:
- webhook authentication and request validation,
- idempotent duplicate publish behavior,
- manual-then-webhook upgrade paths,
- roster matching and self-raid exclusion behavior,
- monthly leaderboard aggregation,
- private `/mystats` delivery behavior,
- `/raiderhelp` consistency with the scoring config.

## Primary Recommendation

Plan Phase 2 around three executable slices:
1. webhook ingest plus dedupe on top of the existing raid-creation flow,
2. roster and owner mapping plus optional self-raid exclusion,
3. reporting queries and staff commands that reuse the same canonical scoring data.

This matches the roadmap’s existing 02-01, 02-02, and 02-03 split while preserving the Phase 1 contracts already established in code and schema.

---

*Phase: 02-publish-automation-staff-commands*
*Research completed: 2026-04-11*
