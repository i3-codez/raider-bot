# X Tweet Monitor — Design

**Status:** Draft for implementation
**Date:** 2026-04-20
**Owner:** Gabriel Fratica

## Problem

Raider Bot has a `/publish/webhook` endpoint that accepts authenticated notifications about new client social posts and drops them into the `#raids` channel. Today there is no upstream system firing that webhook for X (Twitter) posts — manual `/raid` is the only way raids get created, which defeats the first-30-minutes engagement design.

We need a reliable, low-latency way to detect new **original** tweets (not replies, not retweets) from a curated list of client X handles and turn each one into a raid.

## Goals

- Catch new original tweets from the curated client list within ~1 minute of publish.
- Treat scoring fairness as a hard invariant: raids must carry the real `published_at` (X's `created_at`), never the detection time.
- Reuse the existing canonical raid creation path (`src/domain/raids/create-raid.ts`) — no parallel insert flow, no duplicate Slack posts.
- Fit the deploy shape we already have (Coolify service + Coolify Scheduled Tasks).
- Keep the handle list and client names in code so changes are reviewable and auditable.

## Non-goals

- LinkedIn or other platforms (per AGENTS.md — X only until the core loop is validated).
- Real-time push from X (requires X API Pro tier, ~$5k/mo — out of budget).
- A UI for managing the handle list. Ops can submit a PR when the list changes.
- External API verification of engagement. Reactions remain good-faith claims; this document is only about **ingest**, not scoring.

## Constraints inherited from the project

Lifted verbatim from `AGENTS.md` / `CLAUDE.md`:

- **Publish trigger must be authenticated webhooks carrying `published_at` — no RSS.** The monitor is an authenticated client of Apify; it hands `published_at` (the tweet's `created_at`) directly to `createRaid`.
- **Scoring source of truth is `published_at`, not Slack's message timestamp.** The monitor fills `publishedAt` from X's `created_at` on every call. `timingConfidence` becomes `"high"` automatically.
- **Single raid creation path.** The monitor calls `createRaid` in-process. `/publish/webhook` is untouched — it stays open for any non-X upstream we add later.

## Approach

**Pull model, stateless.** A small Node script runs every 2 minutes under Coolify's Scheduled Tasks. Each run asks Apify for the tweets posted in the last 5 minutes across all monitored handles, filters out replies/retweets, maps each handle to a `client_name`, and hands each tweet to `createRaid`. Dedupe on `source_event_id = tweet_id` makes window overlap a no-op.

### Why pull and not Apify-driven (push)

Apify's scheduler only accepts static input. Our query needs a dynamic `since:` timestamp to keep per-run result sets small (pay-per-result pricing). The cleanest way to inject a dynamic timestamp on every run is to drive Apify from our side.

### Why stateless

With `cadence = 2 min` and `since: now() - 5 min`, each run overlaps the previous by 3 minutes. Transient failures (container restart, Apify timeout, brief network blip — typically <1 min) are absorbed by the overlap because `createRaid` dedupes on tweet ID. A sustained outage >5 min will lose tweets, but will also trigger other signals (Coolify alerts, empty `#raids`), and manual catch-up is straightforward.

Adding durable state later is one migration + ~30 lines. We'll revisit if the 5-min-outage edge case ever bites.

## Architecture

```
Coolify Scheduled Task (*/2 * * * *)
  └── npm run monitor:x
       └── tsx src/scripts/run-x-monitor.ts
            ├── load config from src/config/x-clients.ts
            ├── build Apify query string (since: now - 5min)
            ├── POST to Apify run-sync-get-dataset-items
            ├── for each returned tweet:
            │    ├── filter replies/retweets (belt-and-suspenders)
            │    ├── map author handle → client_name
            │    └── createRaid({ postUrl, clientName, platform: "x",
            │                     publishedAt, sourceEventId: tweet_id, ... })
            └── closeSql({ timeout: 0 })
```

No new HTTP surface. No new DB table. One new npm script. One new Coolify Scheduled Task entry.

## Components

```
src/
  config/
    x-clients.ts                 ← handle → client_name mapping (type-safe const array)
  domain/
    x-monitor/
      build-apify-query.ts       ← pure: (handles, sinceDate) → query string
      filter-tweets.ts           ← pure: drop replies + retweets
      map-client-name.ts         ← pure: case-insensitive handle → client_name lookup
      run-x-monitor.ts           ← orchestrator; takes MonitorContext for DI
      types.ts                   ← TweetRecord, MonitorResult, MonitorContext
  x-monitor/
    apify-client.ts              ← thin fetch wrapper: runSyncGetDatasetItems(input)
  scripts/
    run-x-monitor.ts             ← CLI entry; --dry-run flag; closeSql in finally
```

### `src/config/x-clients.ts`

Static, type-safe list. PR-reviewable. Handle stored lowercase for case-insensitive lookup.

```ts
export interface XClient {
  handle: string;          // lowercased
  clientName: string;      // human display string used in Slack
}

export const X_CLIENTS = [
  { handle: "meanwhile",       clientName: "Meanwhile" },
  { handle: "ztownsend",       clientName: "Zac Townsend" },
  { handle: "badgerdao",       clientName: "BadgerDAO" },
  { handle: "litestrategy",    clientName: "Lite Strategy" },
  { handle: "skyecosystem",    clientName: "Sky Ecosystem" },
  { handle: "skyecoinsights",  clientName: "Sky Eco Insights" },
  { handle: "skymoney",        clientName: "Sky Money" },
  { handle: "enlivex",         clientName: "Enlivex" },
  { handle: "jupiterexchange", clientName: "Jupiter" },
] as const satisfies readonly XClient[];
```

### `src/domain/x-monitor/build-apify-query.ts`

Pure function. Formats `since` to the exact string X search expects (`YYYY-MM-DD_HH:MM:SS_UTC`).

```ts
export function buildApifyQuery(handles: readonly string[], since: Date): string {
  const fromClause = handles.map((h) => `from:${h}`).join(" OR ");
  const sinceStr = since.toISOString().slice(0, 19).replace("T", "_") + "_UTC";
  return `(${fromClause}) -filter:replies -filter:retweets since:${sinceStr}`;
}
```

### `src/x-monitor/apify-client.ts`

Thin wrapper around Apify's synchronous run endpoint.

```ts
export interface ApifyClient {
  runSyncGetDatasetItems(input: ApifyRunInput): Promise<TweetRecord[]>;
}

export function createApifyClient(deps: {
  token: string;
  actorId: string;  // "danek~twitter-scraper-ppr"
  fetchImpl?: typeof fetch;  // injectable for tests
}): ApifyClient;
```

URL template:
```
POST https://api.apify.com/v2/acts/{actorId}/run-sync-get-dataset-items?token={token}
```

Body is the input object (`max_posts`, `query`, `search_type`).

### `TweetRecord` shape (what we parse from Apify's dataset items)

We only use a narrow slice of the actor's output. Everything else is ignored:

```ts
export interface TweetRecord {
  tweetId: string;        // maps from actor's `id` or `id_str`
  tweetUrl: string;       // maps from actor's `url`
  authorHandle: string;   // maps from actor's `user.screen_name` — lowercased at parse time
  authorName: string;     // maps from actor's `user.name`
  createdAt: Date;        // parsed from actor's `created_at` ISO string
  isRetweet: boolean;     // actor's `is_retweet` or presence of `retweeted_status`
  isReply: boolean;       // actor's `is_reply` or presence of `in_reply_to_status_id`
}
```

Exact field mappings will be finalized in the implementation plan after calling the actor once and inspecting a real response; the design assumes the actor exposes enough detection for reply/retweet (X's own `-filter:replies -filter:retweets` is the primary line of defense).

### `src/domain/x-monitor/run-x-monitor.ts`

The orchestrator. Signature:

```ts
export interface MonitorContext {
  apify: ApifyClient;
  createRaid: (input: CreateRaidInput, ctx: CreateRaidContext) => Promise<RaidPost>;
  slackClient: SlackClientLike;
  config?: readonly XClient[];
  now?: () => Date;
  logger?: Pick<typeof logger, "info" | "warn" | "error">;
}

export interface MonitorResult {
  tweetsFetched: number;
  raidsProcessed: number;   // total createRaid calls that succeeded (new or dedupe)
  skipped: { unmapped: number; nonOriginal: number; malformed: number };
  failures: number;         // createRaid throws
  sinceWindow: { from: Date; to: Date };
}

export async function runXMonitor(
  params: { dryRun?: boolean },
  context: MonitorContext,
): Promise<MonitorResult>;
```

### `src/scripts/run-x-monitor.ts`

CLI entry. Parses `--dry-run`. Constructs defaults. Calls `runXMonitor`. Returns exit code based on `MonitorResult.failures`.

Follows the same pattern as `src/scripts/run-summary-job.ts`:
- `pathToFileURL` guard so the module can be imported in tests without executing
- `try ... finally { await closeSql({ timeout: 0 }); }`

### New env vars

Added to `src/config/env.ts` Zod schema:

```ts
APIFY_TOKEN: z.string().trim().min(1),
APIFY_X_MONITOR_ACTOR_ID: z.string().trim().min(1).default("danek~twitter-scraper-ppr"),
```

And to `.env.example`. Documented in `docs/pilot-launch-runbook.md`.

### `package.json` scripts

```json
"monitor:x": "tsx src/scripts/run-x-monitor.ts"
```

### Coolify Scheduled Task

One new entry alongside the existing five:

```
*/2 * * * *   npm run monitor:x
```

## Data flow (per run)

1. Script starts.
2. Script calls `runXMonitor({ dryRun: false }, context)`.
3. Context builds `sinceDate = new Date(now - 5 min)`.
4. Query string built via `buildApifyQuery(handles, sinceDate)`.
5. Apify client `POST`s to run-sync-get-dataset-items. Response is an array of dataset items.
6. For each item:
   a. Parse into `TweetRecord`. Skip and count as `malformed` if required fields missing.
   b. If `isRetweet || isReply`, count as `nonOriginal` and skip.
   c. Look up `client_name` via lowercased `authorHandle`. If not found, log `warn` and count as `unmapped`.
   d. Call `createRaid({ postUrl: tweet.tweetUrl, clientName, platform: "x", publishedAt: tweet.createdAt, createdBySlackUserId: "x-monitor", sourceEventId: tweet.tweetId, ownerExternalId: tweet.authorHandle, ownerDisplayName: tweet.authorName }, { client: slackClient })`.
   e. On success (whether new raid or dedupe-return of existing), increment `raidsProcessed`.
   f. If throws → log `error`, increment `failures`, continue loop.
7. Log the `MonitorResult` summary.
8. Exit code: 0 if `failures === 0`, else 1.

## Error handling

Exactly as specified in Section 4 of the brainstorm. Summary:

| Failure | Behavior |
|---|---|
| Missing `APIFY_TOKEN` | Zod fails at import; container won't boot |
| Apify 4xx/5xx | Log + exit 1; next run retries |
| Apify timeout | Same |
| Malformed response item | Log warn; skip; continue |
| Unknown handle | Log warn; skip; continue |
| `createRaid` throws for one tweet | Log error; continue; exit 1 at end |
| DB/network issue during `createRaid` | `closeSql` in `finally` still fires; exit 1 |
| `--dry-run` | Skip `createRaid` entirely; log what would have fired |

## Testing

### Unit tests

| File | Covers |
|---|---|
| `tests/x-monitor/build-apify-query.test.ts` | Query string format: handle join, since timestamp format, filter suffixes, zero-handles edge |
| `tests/x-monitor/filter-tweets.test.ts` | Drops retweets, drops replies, keeps originals, handles both flag names per actor variation |
| `tests/x-monitor/map-client-name.test.ts` | Case-insensitive lookup, unknown handle returns undefined, all 9 clients resolve |
| `tests/x-monitor/apify-client.test.ts` | URL construction, Authorization header, 5xx surfaces error, malformed JSON surfaces error, uses injected `fetchImpl` |

### Integration test

`tests/x-monitor/run-x-monitor.test.ts` — exercises the orchestrator with stubbed `apify` and stubbed `createRaid`:

| Scenario | Expected `MonitorResult` |
|---|---|
| Empty dataset | `{ tweetsFetched: 0, raidsProcessed: 0, failures: 0 }` |
| 3 original tweets, all mapped | `raidsProcessed: 3` + `createRaid` called 3× with correct payloads |
| 1 original + 1 retweet + 1 reply | `raidsProcessed: 1, skipped.nonOriginal: 2` |
| Unknown handle | `skipped.unmapped: 1`, Pino warn logged |
| Repeat of previous tweet ID (dedupe on existing raid) | `raidsProcessed: 1` — `createRaid` returns existing raid, not an error |
| `createRaid` throws for 1 of 3 | `raidsProcessed: 2, failures: 1` |
| `--dry-run` | `createRaid` never called; log contains dry-run marker |

### CLI entry test

`tests/scripts/run-x-monitor.test.ts` — verifies `--dry-run` is parsed, exit code matches `MonitorResult.failures`, `closeSql` called in `finally`.

### Pilot-check integration

Append a dry-run monitor step to `src/scripts/run-pilot-check.ts` so `npm run pilot:check` in a credentialed environment exercises the full chain (Apify auth, query, filter, handle mapping) without posting.

## Deployment

1. Merge + push. Coolify auto-deploys.
2. Add `APIFY_TOKEN` to Coolify env vars.
3. Add one Scheduled Task: `*/2 * * * *` → `npm run monitor:x`.
4. Watch the first few runs in Coolify logs. Expect `raidsFetched: 0` most cycles until a monitored handle posts an original tweet.
5. Manually verify end-to-end by having a monitored account post a test tweet — should land in `#raids` within ~1 minute with auto-seeded reactions.

## Open questions / assumptions

- **Apify actor output shape** — Assumed the `danek~twitter-scraper-ppr` actor returns tweet records with recognizable fields for `id`, `url`, `user.screen_name`, `created_at`, and reply/retweet flags. First implementation step is calling the actor with one real query and printing the raw output to confirm field names before finishing the parser.
- **Timezone of Apify's `since:` timestamp** — Assumed UTC as shown in the user's example (`since:2026-04-20_12:30:40_UTC`). The format builder always emits `_UTC`; ET math is irrelevant at this layer.
- **Rate limits** — Apify doesn't publish hard limits for this actor beyond free-tier caps. At 2-min cadence × 9 handles × 5-min window, we expect 0–2 results/run, well under any reasonable ceiling. No throttling logic planned for v1.

## Out of scope

- Persisting the Apify run ID or dataset ID for audit. If we need that later, we add a small `x_monitor_runs` table.
- Alerting on repeated failures. Coolify Scheduled Task UI shows failures; good enough for pilot.
- Per-client or per-handle cadence. All handles share the same 2-min cadence.
- Manual `since:` backfill via CLI flag. If we need catch-up after an outage, we add `--since=<ISO8601>` later.
