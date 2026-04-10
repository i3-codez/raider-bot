# Phase 1: Slack Core & Trusted Scoring - Research

**Researched:** 2026-04-10
**Domain:** Slack Bolt.js manual raid intake, reaction scoring, and Postgres audit logging
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md) [VERIFIED: .planning/phases/01-slack-core-trusted-scoring/01-CONTEXT.md]

### Locked Decisions [VERIFIED: .planning/phases/01-slack-core-trusted-scoring/01-CONTEXT.md]
- **D-01:** `/raid` should allow operators to create a raid even when they do not know the exact `published_at`; publish time can be supplied when known but is not required for manual creation.
- **D-02:** When manual creation does not include `published_at`, scoring should fall back to Slack post time as an explicit low-confidence path rather than blocking raid creation.
- **D-03:** Low-confidence timing must be visible in the raid message body so staff understand that timing-based scoring for that raid is approximate.
- **D-04:** If an authoritative publish time is added later for a low-confidence manual raid, the system should recalculate affected scores while preserving the underlying audit trail and correction history.

### Claude's Discretion [VERIFIED: .planning/phases/01-slack-core-trusted-scoring/01-CONTEXT.md]
- Exact `/raid` command argument shape and operator ergonomics for optional publish-time entry.
- Block Kit composition and wording details for the raid message, as long as the action legend and timing rules remain clear.
- Canonical emoji selection and alias handling, as long as the mapping is centralized and the user-facing guidance stays in sync with scoring behavior.
- Exact integer points for each timing window, as long as the implementation remains deterministic, auditable, and consistent with fixed scoring windows.

### Deferred Ideas (OUT OF SCOPE) [VERIFIED: .planning/phases/01-slack-core-trusted-scoring/01-CONTEXT.md]
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements [VERIFIED: .planning/REQUIREMENTS.md]

| ID | Description | Research Support |
|----|-------------|------------------|
| RAID-01 | Operator can create a raid target manually with `/raid` using a post URL, client name, and platform. [VERIFIED: .planning/REQUIREMENTS.md] | Use Bolt `command()` with fast `ack()`, parse slash text into a typed DTO, and persist a `raid_posts` row before or alongside `chat.postMessage`. [CITED: https://docs.slack.dev/tools/bolt-js/concepts/commands/] |
| RAID-03 | Each raid post stores `published_at`, `slack_posted_at`, `slack_message_ts`, `slack_channel_id`, `timing_confidence`, and `month_key`. [VERIFIED: .planning/REQUIREMENTS.md] | Put these fields in the initial schema; treat `published_at` as preferred and `slack_posted_at` as explicit low-confidence fallback. [VERIFIED: .planning/phases/01-slack-core-trusted-scoring/01-CONTEXT.md][VERIFIED: AGENTS.md] |
| RAID-05 | Raider Bot posts each new raid target into the configured Slack channel within minutes of ingest. [VERIFIED: .planning/REQUIREMENTS.md] | Use `client.chat.postMessage` with `chat:write`; store the returned channel/message identifiers on the same canonical raid record. [CITED: https://docs.slack.dev/reference/methods/chat.postMessage] |
| RAID-06 | Each raid target message shows the reaction legend and speed-window rules staff need to participate correctly. [VERIFIED: .planning/REQUIREMENTS.md] | Build the raid message from one centralized action registry and a fixed timing matrix so legend and scoring cannot drift. [VERIFIED: .planning/research/PITFALLS.md][VERIFIED: .planning/research/ARCHITECTURE.md] |
| ENG-01 | Supported Slack reactions map to like, comment, repost, and quote-post actions. [VERIFIED: .planning/REQUIREMENTS.md] | Centralize emoji aliases in one registry and use the same registry for message copy, scoring, and tests. [VERIFIED: .planning/research/PITFALLS.md] |
| ENG-02 | A user can claim each action type at most once per post. [VERIFIED: .planning/REQUIREMENTS.md] | Enforce uniqueness in Postgres on `(raid_post_id, slack_user_id, action_type)` rather than with in-memory state. [CITED: https://www.postgresql.org/docs/current/sql-insert.html] |
| ENG-03 | Different action types stack on the same post for the same user. [VERIFIED: .planning/REQUIREMENTS.md] | Model action type as part of the uniqueness key so `like` and `comment` can coexist for the same user/post pair. [VERIFIED: .planning/REQUIREMENTS.md] |
| ENG-04 | Points are calculated from `published_at` using fixed 0-10m, 10-20m, 20-30m, 30-60m, and 60m+ windows. [VERIFIED: .planning/REQUIREMENTS.md] | Implement one deterministic scoring service with the resolved matrix `10/8/6/3/0` across those five windows, and keep the same values in the message copy and tests. [VERIFIED: .planning/PROJECT.md][VERIFIED: .planning/phases/01-slack-core-trusted-scoring/01-CONTEXT.md] |
| ENG-05 | Removing a reaction reverses or deactivates the associated score. [VERIFIED: .planning/REQUIREMENTS.md] | Handle `reaction_removed` and mark the existing engagement row inactive with `removed_at`; do not hard-delete audit facts. [CITED: https://docs.slack.dev/reference/events/reaction_removed/][VERIFIED: .planning/REQUIREMENTS.md] |
| ENG-06 | Engagement logs retain `reacted_at`, `minutes_from_publish`, `scoring_window`, `points_awarded`, and optional `removed_at`. [VERIFIED: .planning/REQUIREMENTS.md] | Store raw event-derived timestamps plus computed scoring facts on each engagement row so any score can be explained later. [CITED: https://docs.slack.dev/reference/events/reaction_added/][CITED: https://docs.slack.dev/reference/events/reaction_removed/] |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Keep the canonical repo under `~/Projects`; this workspace already complies, so planning should treat `/Users/matthewbaggetta/Projects/products/raider-bot` as the canonical path. [VERIFIED: ~/CLAUDE.md]
- If another path appears to represent this same project, stop and ask which path is canonical before planning across both locations. [VERIFIED: ~/CLAUDE.md]
- GSD projects should keep their main spec at `.planning/spec.md`; planning should not invent a different primary spec location. [VERIFIED: ~/CLAUDE.md]

## Project Constraints (from AGENTS.md)

- Plan for a Slack-first app using Bolt.js; Slack events, commands, and bot-posted messages are the core interaction model. [VERIFIED: AGENTS.md]
- Treat `published_at` as the scoring source of truth and `slack_posted_at` only as the explicit low-confidence fallback. [VERIFIED: AGENTS.md]
- Keep the MVP trust model reaction-based; do not add off-platform verification work into Phase 1. [VERIFIED: AGENTS.md]
- Persist durable historical data even though monthly scores will reset later. [VERIFIED: AGENTS.md]
- Keep the launch scope X-first; multi-platform parity is out of Phase 1 scope. [VERIFIED: AGENTS.md]
- Execution should happen inside a GSD workflow rather than ad hoc repo edits. [VERIFIED: AGENTS.md]

## Summary

Phase 1 should plan around one TypeScript service using Bolt's HTTP receiver for slash commands and reaction events, with Socket Mode kept only as a local-development fallback. [CITED: https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/][VERIFIED: AGENTS.md] Slack's current docs recommend HTTP request URLs for production applications and Socket Mode mainly for local development or environments that cannot expose public HTTP endpoints. [CITED: https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/]

The trustworthy scoring loop is mostly a data-model problem, not a Slack-UI problem. [VERIFIED: .planning/research/ARCHITECTURE.md][VERIFIED: .planning/research/PITFALLS.md] Use Slack reaction payload fields as the raw audit facts, store a canonical `raid_posts` row for each raid message, and enforce one active engagement claim per `(raid_post_id, slack_user_id, action_type)` in Postgres so retries, restarts, and duplicate deliveries cannot inflate scores. [CITED: https://docs.slack.dev/reference/events/reaction_added/][CITED: https://docs.slack.dev/reference/events/reaction_removed/][CITED: https://www.postgresql.org/docs/current/sql-insert.html]

The raid message itself must come from the same action registry and timing matrix the scoring engine uses. [VERIFIED: .planning/research/PITFALLS.md] Slack's messaging docs also make the top-level `text` field important when using `blocks`, because it becomes the fallback for notifications and screen readers. [CITED: https://docs.slack.dev/reference/methods/chat.postMessage][CITED: https://docs.slack.dev/reference/block-kit/blocks/]

**Primary recommendation:** Use `@slack/bolt` over HTTP, persist `raid_posts` and `engagement_logs` in Postgres, enforce ENG-02 with database uniqueness instead of in-memory dedupe, and model reaction removal as a reversible state change with `removed_at`, not a delete. [CITED: https://docs.slack.dev/tools/bolt-js/concepts/commands/][CITED: https://docs.slack.dev/tools/bolt-js/concepts/event-listening/][CITED: https://www.postgresql.org/docs/current/sql-insert.html][VERIFIED: .planning/REQUIREMENTS.md]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | `24.x LTS` (latest `24.14.1`; local `24.11.1`) [CITED: https://nodejs.org/en/about/previous-releases][VERIFIED: local node --version] | Runtime for a long-lived Slack service. [CITED: https://nodejs.org/en/about/previous-releases] | Current Node guidance is to use Active LTS or Maintenance LTS in production, and `v24` is the current Active LTS line. [CITED: https://nodejs.org/en/about/previous-releases] |
| TypeScript | `6.0.2` published `2026-03-23` [VERIFIED: npm registry] | Strong typing for Slack payloads, scoring DTOs, and DB contracts. [VERIFIED: npm registry] | TypeScript's `strict` mode gives stronger correctness guarantees, which is useful for event payloads and scoring rules. [CITED: https://www.typescriptlang.org/tsconfig/] |
| `@slack/bolt` | `4.7.0` published `2026-04-06` [VERIFIED: npm registry] | Official Slack app framework for commands, events, and API calls. [VERIFIED: npm registry] | Bolt documents `command()` for slash commands and `event()` for Events API handlers, which maps directly to Phase 1 needs. [CITED: https://docs.slack.dev/tools/bolt-js/concepts/commands/][CITED: https://docs.slack.dev/tools/bolt-js/concepts/event-listening/] |
| Supabase Postgres | `managed Postgres` [VERIFIED: AGENTS.md][CITED: https://supabase.com/docs/guides/database/overview] | Canonical relational store for raid rows, engagement logs, and future reporting. [VERIFIED: AGENTS.md][CITED: https://supabase.com/docs/guides/database/overview] | Project direction already locks Postgres in, and Supabase gives a full Postgres database plus SQL editor/backups for early delivery. [VERIFIED: AGENTS.md][CITED: https://supabase.com/docs/guides/database/overview] |
| `postgres` | `3.4.9` published `2026-04-05` [VERIFIED: npm registry] | Direct SQL driver for transactional writes and query-heavy reporting paths. [VERIFIED: npm registry] | The package is a full PostgreSQL client for Node.js, and direct SQL fits idempotent writes plus leaderboard-style queries cleanly. [VERIFIED: npm registry][VERIFIED: AGENTS.md] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | `4.3.6` published `2026-01-22` [VERIFIED: npm registry] | Runtime validation for slash command parsing, env vars, and future webhook payloads. [VERIFIED: npm registry] | Use at every input boundary where malformed values could create incorrect scores or bad raid rows. [VERIFIED: AGENTS.md] |
| `pino` | `10.3.1` published `2026-02-09` [VERIFIED: npm registry] | Structured JSON logging. [VERIFIED: npm registry] | Use for slash command traces, Slack event handling, DB errors, and future replay or audit investigations. [VERIFIED: AGENTS.md] |
| `vitest` | `4.1.4` published `2026-04-09` [VERIFIED: npm registry] | Test runner for scoring matrix cases and handler-to-service integration tests. [VERIFIED: npm registry] | Use because the repo is greenfield and Vitest is already the documented test runner direction in project research. [VERIFIED: AGENTS.md][VERIFIED: .planning/research/SUMMARY.md] |
| `tsx` | `4.21.0` published `2025-11-30` [VERIFIED: npm registry] | Fast TypeScript execution for local scripts, migrations, and one-off ops tasks. [VERIFIED: npm registry] | Use for lightweight dev scripts without adding build friction to a small service. [VERIFIED: AGENTS.md] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bolt HTTP receiver [CITED: https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/] | Socket Mode [CITED: https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/] | Slack currently recommends HTTP for production reliability and Socket Mode mainly for local dev or firewall-constrained environments. [CITED: https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/] |
| `postgres` direct SQL [VERIFIED: AGENTS.md] | `@supabase/supabase-js` data access [VERIFIED: AGENTS.md] | `supabase-js` is fine for RPC-style access, but direct SQL is a better fit for deterministic scoring writes, uniqueness constraints, and reporting queries. [VERIFIED: AGENTS.md] |
| Versioned Slack app manifest [CITED: https://docs.slack.dev/reference/app-manifest/] | Manual dashboard clicks [ASSUMED] | A manifest keeps scopes, commands, and subscriptions reviewable in git, while manual setup drifts more easily. [CITED: https://docs.slack.dev/reference/app-manifest/][VERIFIED: AGENTS.md] |

**Installation:** [VERIFIED: npm registry]
```bash
npm install @slack/bolt postgres zod pino
npm install -D typescript tsx vitest @types/node
```

**Version verification:** Current package versions were re-checked with `npm view <package> version time` on 2026-04-10. [VERIFIED: npm registry]

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── app/                 # Bolt bootstrap and runtime wiring
├── config/              # env parsing and typed configuration
├── slack/
│   ├── commands/        # /raid and future command handlers
│   ├── events/          # reaction_added and reaction_removed listeners
│   └── blocks/          # raid message and legend builders
├── domain/
│   ├── raids/           # manual raid creation and lookup
│   └── scoring/         # action mapping, windows, and point rules
├── db/
│   ├── migrations/      # schema SQL
│   └── queries/         # reusable SQL statements
├── lib/                 # shared logger/time helpers
└── tests/               # scoring and handler-level tests
```

This structure is already the recommended project shape in the existing architecture research and matches the three Phase 1 roadmap plans cleanly. [VERIFIED: .planning/research/ARCHITECTURE.md][VERIFIED: .planning/ROADMAP.md]

### Recommended Data Model

| Table | Required fields | Action Required in Phase 1 |
|-------|-----------------|----------------------------|
| `raid_posts` | `id`, `post_url`, `client_name`, `platform`, `published_at`, `slack_posted_at`, `slack_message_ts`, `slack_channel_id`, `timing_confidence`, `month_key` [VERIFIED: .planning/REQUIREMENTS.md] | Create in the initial schema and treat it as the join target for every later reaction event. [VERIFIED: .planning/REQUIREMENTS.md][VERIFIED: .planning/research/ARCHITECTURE.md] |
| `engagement_logs` | `id`, `raid_post_id`, `slack_user_id`, `slack_reaction`, `action_type`, `reacted_at`, `minutes_from_publish`, `scoring_window`, `points_awarded`, `removed_at` [VERIFIED: .planning/REQUIREMENTS.md] | Create in the initial schema with a uniqueness rule on `(raid_post_id, slack_user_id, action_type)` so ENG-02 is enforced by data, not process. [VERIFIED: .planning/REQUIREMENTS.md][CITED: https://www.postgresql.org/docs/current/sql-insert.html] |

Inference from D-02, D-04, and RAID-03: plan `month_key` as a field derived from the effective scoring timestamp so low-confidence raids and future timing corrections remain internally consistent. [VERIFIED: .planning/phases/01-slack-core-trusted-scoring/01-CONTEXT.md][VERIFIED: .planning/REQUIREMENTS.md]

### Pattern 1: Thin Slash Command Handler
**What:** A Bolt listener should validate input, acknowledge immediately, and hand off to a raid service. [CITED: https://docs.slack.dev/tools/bolt-js/concepts/commands/][VERIFIED: .planning/research/ARCHITECTURE.md]

**When to use:** Use this for `/raid` and every future slash command so Slack transport details stay out of the scoring and persistence logic. [VERIFIED: .planning/research/ARCHITECTURE.md]

**Example:**
```typescript
// Source: https://docs.slack.dev/tools/bolt-js/concepts/commands/
app.command("/raid", async ({ command, ack, client, logger }) => {
  await ack();

  const input = parseRaidCommand(command.text);
  const raid = await raidService.createManualRaid(input, {
    requestedBy: command.user_id,
    requestedInChannel: command.channel_id,
  });

  await client.chat.postMessage(
    buildRaidMessage({
      channel: command.channel_id,
      raid,
    }),
  );
});
```

### Pattern 2: Canonical Reaction Mapping Registry
**What:** Keep one action registry that maps Slack emoji names and aliases to `like`, `comment`, `repost`, and `quote_post`. [VERIFIED: .planning/REQUIREMENTS.md][VERIFIED: .planning/research/PITFALLS.md]

**When to use:** Use it in the raid message legend, reaction listeners, and tests so copy and behavior cannot diverge. [VERIFIED: .planning/research/PITFALLS.md]

**Example:**
```typescript
// Source: reaction semantics from Slack event docs; registry shape is project-specific.
export const ACTIONS = {
  thumbsup: { actionType: "like", label: "Like" },
  speech_balloon: { actionType: "comment", label: "Comment" },
  repeat: { actionType: "repost", label: "Repost" },
  memo: { actionType: "quote_post", label: "Quote Post" },
} as const;
```

### Pattern 3: DB-Enforced Idempotency and Reversible Logs
**What:** Let Postgres arbitrate duplicates with a unique key and `ON CONFLICT`, and update the existing row with `removed_at` on `reaction_removed` instead of deleting it. [CITED: https://www.postgresql.org/docs/current/sql-insert.html][VERIFIED: .planning/REQUIREMENTS.md]

**When to use:** Use this for every engagement claim write path. [VERIFIED: .planning/REQUIREMENTS.md]

**Example:**
```sql
-- Source: https://www.postgresql.org/docs/current/sql-insert.html
CREATE UNIQUE INDEX engagement_logs_one_action_per_user_post
  ON engagement_logs (raid_post_id, slack_user_id, action_type);

INSERT INTO engagement_logs (
  raid_post_id,
  slack_user_id,
  slack_reaction,
  action_type,
  reacted_at,
  minutes_from_publish,
  scoring_window,
  points_awarded
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (raid_post_id, slack_user_id, action_type) DO NOTHING;
```

### Pattern 4: Event Payloads as Canonical Audit Inputs
**What:** Use Slack's event payload fields for audit facts: `user`, `reaction`, `item.channel`, `item.ts`, and `event_ts`. [CITED: https://docs.slack.dev/reference/events/reaction_added/][CITED: https://docs.slack.dev/reference/events/reaction_removed/]

**When to use:** Use this in both `reaction_added` and `reaction_removed` handlers so logs stay explainable even if message copy or mapping changes later. [CITED: https://docs.slack.dev/reference/events/reaction_added/][CITED: https://docs.slack.dev/reference/events/reaction_removed/]

**Example:**
```typescript
// Source: https://docs.slack.dev/reference/events/reaction_added/
app.event("reaction_added", async ({ event, body }) => {
  if (event.item.type !== "message") return;

  await scoringService.claim({
    slackEventId: body.event_id,
    slackUserId: event.user,
    reactionName: event.reaction,
    channelId: event.item.channel,
    messageTs: event.item.ts,
    reactedAt: new Date(Number(event.event_ts) * 1000),
  });
});
```

### Anti-Patterns to Avoid
- **Scoring inside Bolt listeners:** Keep listeners thin and push scoring, window math, and DB writes into services. [VERIFIED: .planning/research/ARCHITECTURE.md]
- **Using `slack_posted_at` as the default score source:** Only use it when `published_at` is missing and mark the raid low confidence in both data and message copy. [VERIFIED: .planning/phases/01-slack-core-trusted-scoring/01-CONTEXT.md][VERIFIED: AGENTS.md]
- **Keeping only running totals:** Leaderboard totals should be derived from durable engagement rows, not treated as the source of truth. [VERIFIED: .planning/research/ARCHITECTURE.md][VERIFIED: .planning/research/PITFALLS.md]
- **Hard-deleting rows on reaction removal:** Use `removed_at` so the score reversal is explainable later. [VERIFIED: .planning/REQUIREMENTS.md]
- **Duplicating emoji copy in multiple files:** Build the visible legend from the same registry the scoring engine uses. [VERIFIED: .planning/research/PITFALLS.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slack request verification | Custom HMAC middleware unless Bolt is impossible. [CITED: https://docs.slack.dev/authentication/verifying-requests-from-slack/] | Bolt's built-in signing-secret handling. [CITED: https://docs.slack.dev/authentication/verifying-requests-from-slack/][CITED: https://docs.slack.dev/tools/bolt-js] | Slack documents that some SDKs, including Bolt, perform signature verification automatically. [CITED: https://docs.slack.dev/authentication/verifying-requests-from-slack/] |
| Slash command and event routing | Raw Express endpoints for `/raid`, `reaction_added`, and `reaction_removed`. [CITED: https://docs.slack.dev/tools/bolt-js/concepts/commands/][CITED: https://docs.slack.dev/tools/bolt-js/concepts/event-listening/] | Bolt `command()` and `event()` listeners. [CITED: https://docs.slack.dev/tools/bolt-js/concepts/commands/][CITED: https://docs.slack.dev/tools/bolt-js/concepts/event-listening/] | Bolt is the official framework and already models the exact interaction types this phase needs. [VERIFIED: npm registry][CITED: https://docs.slack.dev/tools/bolt-js] |
| Duplicate-score protection | In-memory `Map` or process-local cache for dedupe. [VERIFIED: .planning/research/PITFALLS.md] | Postgres unique constraints plus `ON CONFLICT`. [CITED: https://www.postgresql.org/docs/current/sql-insert.html] | Database arbitration survives retries, concurrent workers, and restarts; memory does not. [CITED: https://www.postgresql.org/docs/current/sql-insert.html] |
| Boundary parsing | Ad hoc string splitting and unchecked env lookups. [VERIFIED: AGENTS.md] | `zod` schemas at command/env boundaries. [VERIFIED: npm registry][VERIFIED: AGENTS.md] | Slash-command text, timing strings, and secrets are all high-leverage failure points for a greenfield bot. [VERIFIED: AGENTS.md] |
| Message legend composition | Scattered hard-coded legend strings. [VERIFIED: .planning/research/PITFALLS.md] | One action registry feeding both Block Kit and scoring. [VERIFIED: .planning/research/PITFALLS.md] | This prevents the most likely Phase 1 UX/behavior drift. [VERIFIED: .planning/research/PITFALLS.md] |

**Key insight:** The easy-to-miss complexity in this phase is retry safety and auditability, not Slack UI rendering. [VERIFIED: .planning/research/SUMMARY.md][VERIFIED: .planning/research/PITFALLS.md]

## Common Pitfalls

### Pitfall 1: Scoring from Slack delivery time when `published_at` exists
**What goes wrong:** Staff get the wrong window score because the system uses Slack delivery time instead of the actual publish time. [VERIFIED: AGENTS.md][VERIFIED: .planning/research/PITFALLS.md]

**Why it happens:** `slack_posted_at` is always available while `published_at` may be optional during manual creation. [VERIFIED: .planning/phases/01-slack-core-trusted-scoring/01-CONTEXT.md]

**How to avoid:** Always persist both timestamps, always persist `timing_confidence`, and always make the low-confidence path visible in the message body. [VERIFIED: .planning/REQUIREMENTS.md][VERIFIED: .planning/phases/01-slack-core-trusted-scoring/01-CONTEXT.md]

**Warning signs:** Staff cannot explain why a visibly late reaction received an early-window score. [VERIFIED: .planning/research/PITFALLS.md]

### Pitfall 2: Legend drift between the raid message and the scoring service
**What goes wrong:** Staff react with the emoji shown in Slack, but the code awards no points or the wrong action type. [VERIFIED: .planning/research/PITFALLS.md]

**Why it happens:** Teams duplicate emoji mapping across copy, code, and tests. [VERIFIED: .planning/research/PITFALLS.md]

**How to avoid:** Generate the visible legend from the same action registry the scoring service uses. [VERIFIED: .planning/research/PITFALLS.md]

**Warning signs:** Support questions like "I reacted but got no points" appear immediately after launch. [VERIFIED: .planning/research/PITFALLS.md]

### Pitfall 3: App-level dedupe without DB enforcement
**What goes wrong:** Slack retries or parallel workers create duplicate awards for the same user, post, and action type. [VERIFIED: .planning/research/PITFALLS.md]

**Why it happens:** Event-driven handlers often assume one delivery per user action. [VERIFIED: .planning/research/PITFALLS.md]

**How to avoid:** Put ENG-02 into a unique constraint and use `ON CONFLICT` as the write contract. [VERIFIED: .planning/REQUIREMENTS.md][CITED: https://www.postgresql.org/docs/current/sql-insert.html]

**Warning signs:** Duplicate engagement rows or unexplained score jumps after transient errors. [VERIFIED: .planning/research/PITFALLS.md]

### Pitfall 4: Deleting audit rows on reaction removal
**What goes wrong:** Scores may look correct today, but the team cannot explain later why a score disappeared. [VERIFIED: .planning/REQUIREMENTS.md]

**Why it happens:** Removing the row seems simpler than modeling a reversible claim. [VERIFIED: .planning/research/PITFALLS.md]

**How to avoid:** Keep the row, set `removed_at`, and let queries count only active rows. [VERIFIED: .planning/REQUIREMENTS.md]

**Warning signs:** Audits can show current totals but cannot reconstruct prior activity. [VERIFIED: .planning/ROADMAP.md][VERIFIED: .planning/research/SUMMARY.md]

### Pitfall 5: Posting Block Kit without a useful top-level `text`
**What goes wrong:** Notifications and screen readers lose the message context even though the visible blocks look fine. [CITED: https://docs.slack.dev/reference/methods/chat.postMessage]

**Why it happens:** Block Kit makes it easy to focus on block layout and forget the fallback field. [CITED: https://docs.slack.dev/reference/methods/chat.postMessage]

**How to avoid:** Always provide a concise top-level `text` summary that includes the post target, action legend, and timing warning when confidence is low. [CITED: https://docs.slack.dev/reference/methods/chat.postMessage]

**Warning signs:** Push notifications are vague or accessibility checks fail even though the channel message looks correct. [CITED: https://docs.slack.dev/reference/methods/chat.postMessage]

## Code Examples

Verified patterns from official sources:

### Slash command listener with fast acknowledgement
```typescript
// Source: https://docs.slack.dev/tools/bolt-js/concepts/commands/
app.command("/raid", async ({ command, ack, respond }) => {
  await ack();

  const result = await raidService.preview(command.text);
  await respond(result.operatorMessage);
});
```

### Reaction listener keyed by message reference
```typescript
// Source: https://docs.slack.dev/reference/events/reaction_added/
app.event("reaction_added", async ({ event }) => {
  if (event.item.type !== "message") return;

  await scoringService.claim({
    slackUserId: event.user,
    reactionName: event.reaction,
    channelId: event.item.channel,
    messageTs: event.item.ts,
    reactedAt: new Date(Number(event.event_ts) * 1000),
  });
});
```

### Accessible Block Kit message post
```typescript
// Source: https://docs.slack.dev/reference/methods/chat.postMessage/
await client.chat.postMessage({
  channel: raid.slackChannelId,
  text: `${raid.clientName}: react with the raid legend below. ${
    raid.timingConfidence === "low" ? "Timing is approximate." : ""
  }`,
  blocks: buildRaidBlocks(raid),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Verification tokens [CITED: https://docs.slack.dev/authentication/verifying-requests-from-slack/] | Signing secrets, with SDK support to verify requests automatically. [CITED: https://docs.slack.dev/authentication/verifying-requests-from-slack/] | Slack's current auth docs state signing secrets replace verification tokens. [CITED: https://docs.slack.dev/authentication/verifying-requests-from-slack/] | Plan for `SLACK_SIGNING_SECRET` and Bolt's built-in verification path, not legacy token checks. [CITED: https://docs.slack.dev/authentication/verifying-requests-from-slack/] |
| Socket Mode as the default everywhere [CITED: https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/] | HTTP request URLs for production; Socket Mode mainly for local dev or firewall-constrained cases. [CITED: https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/] | Current Slack docs retrieved 2026-04-10. [CITED: https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/] | Plan Phase 1 production wiring around HTTPReceiver and keep Socket Mode optional. [CITED: https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/] |

**Deprecated/outdated:**
- Verification tokens are deprecated in favor of signing secrets. [CITED: https://docs.slack.dev/authentication/verifying-requests-from-slack/]
- Legacy custom slash-command integrations are not the right model for a new Slack app; use a Slack app with granular scopes and manifest support. [CITED: https://docs.slack.dev/legacy/legacy-custom-integrations/legacy-custom-integrations-slash-commands/][CITED: https://docs.slack.dev/reference/app-manifest/]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Manual dashboard configuration is the main alternative to a versioned Slack app manifest for this phase. [ASSUMED] | `## Standard Stack` | The planner may overemphasize manifest work if the team already provisions apps another way. |
| A2 | Superseded on 2026-04-10 during plan revision: Phase 1 `/raid` access control is an explicit Slack user allowlist via `SLACK_RAID_OPERATOR_USER_IDS`, not channel-only policy. [RESOLVED: planning] | `## Resolved Planning Decisions` | Low risk after explicit handler enforcement is planned. |
| A3 | Superseded on 2026-04-10 during plan revision: V4 access control is satisfied in Phase 1 by the same operator allowlist plus private denial for non-operators. [RESOLVED: planning] | `## Security Domain` | Low risk after explicit handler enforcement is planned. |

## Resolved Planning Decisions

1. **Timing matrix resolved for Phase 1**
   - Decision: Lock the five windows to `0-10m = 10`, `10-20m = 8`, `20-30m = 6`, `30-60m = 3`, and `60m+ = 0`. [RESOLVED: planning][VERIFIED: .planning/phases/01-slack-core-trusted-scoring/01-CONTEXT.md]
   - Why: This keeps the first 30 minutes materially dominant, preserves deterministic integer scoring, and avoids awarding points after the product's core response window has clearly passed. [INFERENCE from .planning/PROJECT.md and .planning/REQUIREMENTS.md]
   - Planning consequence: The same `10/8/6/3/0` matrix should appear in the canonical scoring config, the Slack raid message timing section, and the scoring tests. [RESOLVED: planning]

2. **Minimum `/raid` operator-control rule resolved for Phase 1**
   - Decision: Restrict `/raid` to an explicit Slack user allowlist loaded from `SLACK_RAID_OPERATOR_USER_IDS`; unauthorized users receive a private denial and the modal never opens. [RESOLVED: planning]
   - Why: This is the smallest reliable V4 access-control rule that still keeps Phase 1 operationally safe without introducing full RBAC or extra admin UI. [INFERENCE from .planning/REQUIREMENTS.md and AGENTS.md]
   - Planning consequence: The command handler should enforce the allowlist, and the bootstrap wiring should register only those production handlers rather than leaving operator control to convention. [RESOLVED: planning]

This section is resolved as of 2026-04-10. No Phase 1 research blockers remain from the timing matrix or `/raid` operator-control questions.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Bolt runtime and local scripts. [VERIFIED: AGENTS.md] | ✓ [VERIFIED: local node --version] | `24.11.1` locally. [VERIFIED: local node --version] | Upgrade to latest `24.x` later if desired; not a planning blocker. [CITED: https://nodejs.org/en/about/previous-releases] |
| npm | Package install and script execution. [VERIFIED: npm registry] | ✓ [VERIFIED: local npm --version] | `11.6.2`. [VERIFIED: local npm --version] | — |
| `psql` | Local schema testing and manual SQL verification. [CITED: https://supabase.com/docs/guides/database/overview] | ✗ [VERIFIED: local psql probe] | — | Use the Supabase SQL editor or remote SQL execution instead. [CITED: https://supabase.com/docs/guides/database/overview] |
| Supabase CLI | Local Supabase workflows. [VERIFIED: AGENTS.md] | ✗ [VERIFIED: local supabase probe] | — | Use committed SQL migrations plus the Supabase dashboard for this phase. [CITED: https://supabase.com/docs/guides/database/overview] |
| Docker | Local containerized Postgres. [VERIFIED: AGENTS.md] | ✗ [VERIFIED: local docker probe] | — | Use managed Supabase Postgres instead of local containers. [VERIFIED: AGENTS.md][CITED: https://supabase.com/docs/guides/database/overview] |
| Slack app credentials (`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`) | Running `/raid`, posting messages, and receiving Events API traffic. [CITED: https://docs.slack.dev/authentication/verifying-requests-from-slack/][CITED: https://docs.slack.dev/reference/methods/chat.postMessage] | ✗ [VERIFIED: no `.env*`, `package.json`, or manifest files in repo] | — | No execution fallback; Phase 1 implementation can be planned without them, but runtime testing cannot happen until they are provisioned. [VERIFIED: no `.env*`, `package.json`, or manifest files in repo] |
| Postgres connection string / Supabase project | Durable raid and engagement persistence. [VERIFIED: AGENTS.md] | ✗ [VERIFIED: no `.env*`, `package.json`, or manifest files in repo] | — | No execution fallback; schema design can proceed now, but real writes need a provisioned database. [VERIFIED: no `.env*`, `package.json`, or manifest files in repo] |

**Missing dependencies with no fallback:**
- Slack app credentials are required to execute and verify the live Slack loop. [VERIFIED: no `.env*`, `package.json`, or manifest files in repo]
- A real Postgres connection is required to execute persistence and reaction-scoring flows. [VERIFIED: AGENTS.md][VERIFIED: no `.env*`, `package.json`, or manifest files in repo]

**Missing dependencies with fallback:**
- `psql`, Supabase CLI, and Docker are absent locally, but planning and even early execution can proceed with SQL files plus the Supabase dashboard. [VERIFIED: local psql probe][VERIFIED: local supabase probe][VERIFIED: local docker probe][CITED: https://supabase.com/docs/guides/database/overview]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no for end-user auth in Phase 1. [VERIFIED: .planning/REQUIREMENTS.md] | Slack request authenticity is handled separately through signed requests, not user login. [CITED: https://docs.slack.dev/authentication/verifying-requests-from-slack/] |
| V3 Session Management | no. [VERIFIED: .planning/REQUIREMENTS.md] | The phase does not introduce browser or user sessions. [VERIFIED: .planning/REQUIREMENTS.md] |
| V4 Access Control | yes. [VERIFIED: .planning/REQUIREMENTS.md] | Restrict `/raid` to `SLACK_RAID_OPERATOR_USER_IDS` and return a private denial for non-operators. [RESOLVED: planning] |
| V5 Input Validation | yes. [VERIFIED: .planning/REQUIREMENTS.md] | Use `zod` to validate slash-command input, env vars, and future webhook payloads. [VERIFIED: npm registry][VERIFIED: AGENTS.md] |
| V6 Cryptography | yes. [CITED: https://docs.slack.dev/authentication/verifying-requests-from-slack/] | Use Slack signing secrets and Bolt's built-in verification path; never invent custom crypto. [CITED: https://docs.slack.dev/authentication/verifying-requests-from-slack/] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged Slack command or event requests. [CITED: https://docs.slack.dev/authentication/verifying-requests-from-slack/] | Spoofing | Verify signed requests with `SLACK_SIGNING_SECRET` and reject stale timestamps. [CITED: https://docs.slack.dev/authentication/verifying-requests-from-slack/] |
| Duplicate event delivery inflating scores. [VERIFIED: .planning/research/PITFALLS.md] | Tampering | Enforce uniqueness in Postgres and use `ON CONFLICT` writes. [CITED: https://www.postgresql.org/docs/current/sql-insert.html] |
| Malformed slash-command text creating bad raid rows. [VERIFIED: .planning/REQUIREMENTS.md] | Tampering | Parse command input into a typed schema and reject invalid or ambiguous values early. [VERIFIED: npm registry][VERIFIED: AGENTS.md] |
| Audit gaps caused by destructive deletes on reaction removal. [VERIFIED: .planning/REQUIREMENTS.md] | Repudiation | Keep immutable engagement facts and use `removed_at` for reversals. [VERIFIED: .planning/REQUIREMENTS.md] |
| Overscoped Slack permissions. [CITED: https://docs.slack.dev/reference/app-manifest/][CITED: https://docs.slack.dev/interactivity/implementing-shortcuts/][CITED: https://docs.slack.dev/reference/events/reaction_added/] | Elevation of Privilege | Start with `commands`, `chat:write`, and `reactions:read`; add more only when a feature requires them. [CITED: https://docs.slack.dev/interactivity/implementing-shortcuts/][CITED: https://docs.slack.dev/tools/node-slack-sdk/getting-started][CITED: https://docs.slack.dev/reference/events/reaction_added/] |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/01-slack-core-trusted-scoring/01-CONTEXT.md` - locked decisions, scope, and discretion.
- `.planning/REQUIREMENTS.md` - requirement IDs and exact acceptance surface for Phase 1.
- `.planning/STATE.md` - current blockers and open product questions.
- `.planning/PROJECT.md` - product constraints and current architecture direction.
- `.planning/ROADMAP.md` - phase success criteria and plan breakdown.
- `AGENTS.md` - stack direction, product constraints, and workflow rules.
- `~/CLAUDE.md` - workspace policy constraints.
- https://docs.slack.dev/tools/bolt-js/concepts/commands/ - Bolt slash command patterns.
- https://docs.slack.dev/tools/bolt-js/concepts/event-listening/ - Bolt event listener patterns.
- https://docs.slack.dev/reference/events/reaction_added/ - reaction payload fields and required scope.
- https://docs.slack.dev/reference/events/reaction_removed/ - removal payload fields and reversal inputs.
- https://docs.slack.dev/reference/methods/chat.postMessage - posting behavior, top-level `text`, and accessibility guidance.
- https://docs.slack.dev/reference/block-kit/blocks/ - Block Kit block limits.
- https://docs.slack.dev/reference/app-manifest/ - manifest structure, slash commands, subscriptions, and scopes.
- https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/ - HTTP versus Socket Mode guidance.
- https://docs.slack.dev/authentication/verifying-requests-from-slack/ - signed-request verification and deprecation of verification tokens.
- https://docs.slack.dev/interactivity/implementing-shortcuts/ - `commands` scope guidance.
- https://docs.slack.dev/tools/node-slack-sdk/getting-started - `chat:write` scope guidance for posting messages.
- https://www.postgresql.org/docs/current/sql-insert.html - `ON CONFLICT` behavior for idempotent writes.
- https://supabase.com/docs/guides/database/overview - managed Postgres capabilities and SQL editor fallback.
- https://nodejs.org/en/about/previous-releases - current Node LTS guidance.
- npm registry queries run on 2026-04-10 for `@slack/bolt`, `postgres`, `zod`, `pino`, `vitest`, `tsx`, and `typescript`.

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` - prior project-level stack and delivery rationale.
- `.planning/research/ARCHITECTURE.md` - prior project-level folder and service boundaries.
- `.planning/research/PITFALLS.md` - prior project-level risk inventory.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - package versions were re-verified against npm, runtime guidance was re-checked against official Node and Slack docs, and the project stack direction is already locked in local project docs. [VERIFIED: npm registry][CITED: https://nodejs.org/en/about/previous-releases][VERIFIED: AGENTS.md]
- Architecture: MEDIUM - the service split and schema direction are well supported by the project docs and Slack/Postgres primitives, but the repo is still greenfield and exact table boundaries are not yet proven in code. [VERIFIED: .planning/research/ARCHITECTURE.md][CITED: https://docs.slack.dev/reference/events/reaction_added/][CITED: https://www.postgresql.org/docs/current/sql-insert.html]
- Pitfalls: HIGH - the highest-risk failure modes are directly implied by the locked product rules and official Slack event semantics. [VERIFIED: .planning/research/PITFALLS.md][VERIFIED: .planning/REQUIREMENTS.md][CITED: https://docs.slack.dev/reference/events/reaction_removed/]

**Research date:** 2026-04-10
**Valid until:** 2026-05-10
