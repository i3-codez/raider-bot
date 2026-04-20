# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Raider Bot** is a Slack app for Impact3 that turns newly published client social posts (currently X) into time-sensitive "raid" prompts. When a post is published, the bot drops it into a Slack channel; staff claim engagement actions via emoji reactions and earn points based on speed. Core value: a newly published client post reaches the right staff in Slack fast enough that meaningful engagement happens inside the first 30 minutes.

## Commands

```bash
npm run dev           # watch-mode server (tsx). User runs this — do not start it yourself.
npm run start         # one-shot server
npm run typecheck     # tsc --noEmit
npm test              # vitest run (all tests)
npx vitest run tests/scoring/scoring-windows.test.ts  # single file
npx vitest run -t "pattern"                            # single test by name
```

Scheduled job entry points (all accept `--dry-run`; `run-month-close.ts` also accepts `--month=YYYY-MM`):

```bash
npm run summary:daily | summary:weekly | summary:monthly
npm run month:close
npm run ops:surfacing
npm run monitor:x                   # poll Apify for new tweets and fire raids
npm run pilot:check                 # env + Slack + DB smoke test, used before widening pilot
npm run correct:raid-time           # fix a raid's published_at
```

Node `>=24 <25` is enforced in `package.json#engines`. Module type is ESM with `NodeNext` resolution — imports in `.ts` files use `.js` extensions (e.g. `from "./foo.js"`). Do not drop those extensions.

## Stack

Node 24 · TypeScript 6 · `@slack/bolt` 4.7 (HTTP receiver) · Supabase Postgres via `postgres` 3.4.9 driver · `zod` 4 for boundary validation · `pino` for logs · `vitest` for tests · `tsx` for local/script execution.

## Architectural contracts (non-obvious)

**Scoring source of truth is `published_at`, not Slack's message timestamp.** `slack_posted_at` is only a low-confidence fallback when no webhook payload is available. Breaking this invariant breaks scoring fairness — see `src/domain/raids/create-raid.ts` and `timingConfidence`. When a raid was created with low confidence and a later webhook delivers `published_at`, `correctRaidPublishedAt` re-keys the month and updates the Slack message in place; do not replicate that logic elsewhere.

**All reporting windows are Eastern Time.** Daily/weekly/monthly summaries, month-close snapshots, and `monthKey` derivation all go through `src/lib/time.ts`. Never use `toISOString()` slicing or raw UTC math to build period keys — use `deriveMonthKey`, `startOfEasternDay/Week/Month`, and `getCompletedSummaryWindow`.

**One HTTP process serves both Slack and the publish webhook.** `src/app/slack.ts` wires a Bolt `HTTPReceiver` with a `customRoutes` entry that mounts `createPublishWebhookHandler` at `/publish/webhook`. The webhook authenticates via the `x-raider-webhook-secret` header and shares the canonical `createRaid` path. When adding new HTTP surfaces, prefer extending `customRoutes` over spinning up a second server.

**Single raid creation path.** Both `/raid` (manual) and the publish webhook go through `src/domain/raids/create-raid.ts`. It handles dedupe (by normalized post URL or `source_event_id`), Slack post, and persistence atomically. Do not write parallel insert paths.

**Dependency injection via `Context` objects.** Domain functions (`createRaid`, `correctRaidPublishedAt`, scoring, reporting) take a context with optional overrides for the Slack client, `now()`, and DB query functions. Tests rely on this — when adding a domain function, follow the same shape instead of importing the shared `sql` client directly.

**Direct SQL via `postgres` (not an ORM).** One shared pool lives in `src/db/sql.ts` (`getSql()` / `withTransaction`). Query modules under `src/db/queries/` own their own SQL strings. Keep SQL explicit; no query builder.

**Scoring windows and action mappings are data, not code paths.** `src/domain/scoring/scoring-config.ts` (`10/8/6/3/0`) and `src/domain/scoring/action-registry.ts` (emoji → action) drive the entire scoring + help surface. Changes here ripple into `/raiderhelp`, reporting, and tests — do not hardcode these values elsewhere.

**Channel routing has an explicit fallback chain.** Summary posts fall back `SLACK_SUMMARY_CHANNEL_ID → SLACK_RAID_CHANNEL_ID`; ops posts fall back `SLACK_OPS_CHANNEL_ID → SLACK_SUMMARY_CHANNEL_ID → SLACK_RAID_CHANNEL_ID`. Preserve this chain when touching job code.

**Operator-gated `/raid`.** Only Slack user IDs in `SLACK_RAID_OPERATOR_USER_IDS` may open the manual raid modal. Do not loosen this check.

## Design rules

- Publish trigger must be authenticated webhooks carrying `published_at` — **no RSS** (feed lag breaks the first-30-minute incentive).
- Scoring windows are fixed integer buckets (`10/8/6/3/0`). **No fractional timing multipliers** — they are harder to explain, audit, and test.
- Reactions are accepted as good-faith claims; there is no external platform API verification in the MVP. Do not add one without an explicit scope change.
- Monthly scores reset but history persists — month-close snapshots are durable and must not be mutated by later jobs.
- Launch scope is X only; keep LinkedIn parity out until the core loop is validated.

## Tests

Vitest config (`vitest.config.ts`) only picks up `tests/**/*.test.ts` — tests are **not** colocated with `src/`. Tests mirror the `src/` tree under `tests/` (e.g. `tests/domain/`, `tests/slack/`, `tests/db/`). Prefer injecting DB/Slack stubs via the context pattern above over module mocking.

## Operational notes

- `docs/pilot-launch-runbook.md` is the authoritative pilot/Railway-cron checklist; mirror any job/env changes there.
- Commits: do not add `Co-Authored-By: Claude` trailers.
