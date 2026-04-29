# LinkedIn raids parity — design

**Date:** 2026-04-29
**Status:** Approved for implementation planning
**Owner:** Gabi

## Goal

Add LinkedIn parity to Raider Bot so newly published LinkedIn posts from a configured list of profiles and company pages drop into the same Slack raid channel as X posts, fast enough to preserve the first-30-minute scoring incentive. The X pilot has been validated; this is the lift the existing `CLAUDE.md` "Launch scope is X only" rule was gating.

## Non-goals

- LinkedIn API integration (LinkedIn Marketing/Posts API requires partner approval and only covers app-granted pages — not in scope).
- Per-platform scoring windows or per-platform action mappings — LinkedIn reuses X's `10/8/6/3/0` scoring config and the existing `like / comment / repost / quote_post` action registry (LinkedIn supports all four engagement types).
- A separate Slack channel for LinkedIn raids — single `SLACK_RAID_CHANNEL_ID`.
- Push-based LinkedIn ingestion via the publish webhook beyond schema-widening; no upstream pipeline is in scope. The webhook is widened to accept `platform: "linkedin"` so a future push path requires no further code change.
- RSS.app as a trigger source — refresh cadence is incompatible with the 30-min fairness window. Apify is the only data source in scope.

## Architecture

Mirror the X monitor pipeline. The canonical raid creation path (`src/domain/raids/create-raid.ts`) is unchanged; LinkedIn flows in through it just like X does, with `platform: "linkedin"` carried opaquely.

```
Coolify cron (*/5 * * * *)
        │
        ▼
src/scripts/run-linkedin-monitor.ts (CLI entry)
        │
        ▼
src/domain/linkedin-monitor/run-linkedin-monitor.ts
        │
        ├── buildLinkedinApifyInput(urls, since)
        ├── apify.runActor("harvestapi/linkedin-profile-posts", input)  ← generalized wrapper
        ├── parsePostRecord(item) per item
        ├── filterOriginalPosts(records)         (defense in depth)
        ├── mapAuthorToClientName(record)        (matches author against LINKEDIN_CLIENTS)
        │
        ▼
createRaid({ platform: "linkedin", ... })  (unchanged)
        │
        ▼
Slack #raid-channel post + raid_posts insert + seeded reactions
```

## Data source — `harvestapi/linkedin-profile-posts`

Verified against the actor's documentation (April 2026):

**Input fields used:**
- `targetUrls: string[]` — mixed list of `https://www.linkedin.com/in/<slug>` and `https://www.linkedin.com/company/<slug>` URLs in one run.
- `postedLimitDate: string` (ISO-8601) — cutoff; only posts at or after this date are returned.
- `includeReposts: false` — exclude reposts.
- `includeQuotePosts: false` — exclude quote-posts.
- `maxPosts: 50` — per-target ceiling.

**Output fields consumed (per post):**
- `id` (numeric string) — stable post ID; mapped to `source_event_id` for dedupe.
- `linkedinUrl` (string) — canonical post URL; mapped to `post_url`.
- `postedAt.date` (ISO-8601 string) — primary publish timestamp; mapped to `published_at` with `timing_confidence: "high"`.
- `postedAt.timestamp` (Unix ms) — fallback if `postedAt.date` is missing or unparseable.
- `author.publicIdentifier` (string) — author slug; lowercased and used as `owner_external_id`.
- `author.name` (string) — `owner_display_name`.
- `author.linkedinUrl` (string) — used as a fallback matcher against `LINKEDIN_CLIENTS.url` when `publicIdentifier` doesn't match (covers the not-yet-verified company-page author shape).
- `type` (string) — guard: only items with `type === "post"` are accepted; others are treated as malformed.

**Cost model:** ~$1.50 per 1k posts. With 10–30 tracked accounts polled every 5 min, expected monthly Apify spend is < $5.

## Components

New files:

- **`src/config/linkedin-clients.ts`**

  ```ts
  export interface LinkedinClient {
    url: string;          // canonical LinkedIn URL fed to harvestapi
    slug: string;         // <slug> portion, lowercased — used to match author.publicIdentifier
    clientName: string;   // user-facing client label
  }

  export const LINKEDIN_CLIENTS = [] as const satisfies readonly LinkedinClient[];
  ```

  Ships empty; the script becomes a safe no-op until populated in a follow-up PR.

- **`src/linkedin-monitor/apify-client.ts`** — IO wrapper around `harvestapi/linkedin-profile-posts` `run-sync-get-dataset-items`. Reuses the generalized `runActor<TInput>` helper (see "Refactor" below).

- **`src/domain/linkedin-monitor/types.ts`** — `LinkedinPostRecord`:
  ```ts
  export interface LinkedinPostRecord {
    postId: string;
    postUrl: string;
    authorSlug: string;
    authorDisplayName: string;
    authorUrl: string;
    createdAt: Date;
  }
  ```
  Plus `LinkedinMonitorResult` mirroring `MonitorResult` (`postsFetched`, `raidsProcessed`, `skipped: { unmapped, nonOriginal, malformed }`, `failures`, `sinceWindow`).

- **`src/domain/linkedin-monitor/parse-post-record.ts`** — defensive parsing of one Apify item into a `LinkedinPostRecord`. Returns `null` on missing required fields, malformed timestamps, or `type !== "post"`. Mirrors the shape of `parse-tweet-record.ts`.

- **`src/domain/linkedin-monitor/filter-posts.ts`** — `filterOriginalPosts(records)`: defense-in-depth filter for any output that slips past the actor flags. Initial implementation passes everything through (the parser already drops `type !== "post"`); the function exists so we can add output-shape filters once we observe live data.

- **`src/domain/linkedin-monitor/map-client-name.ts`** — `mapAuthorToClientName(record, clients)`. Match logic:
  1. Match if `record.authorSlug.toLowerCase() === client.slug`.
  2. Otherwise, match by exact author-URL prefix: normalize both `record.authorUrl` and `client.url` (lowercase, strip trailing slashes), then match if `authorUrl === clientUrl` **or** `authorUrl.startsWith(clientUrl + "/")`. Substring matching (`includes`) is rejected — `linkedin.com/in/foo` would false-positive against `linkedin.com/in/foobar`.

  This covers the unverified company-page author shape: if `author.publicIdentifier` for company posts isn't the company slug, the URL fallback will still match correctly without false positives.

- **`src/domain/linkedin-monitor/build-apify-input.ts`** — `buildLinkedinApifyInput(urls, since)` returns the structured input object. Pure, testable, no IO.

- **`src/domain/linkedin-monitor/run-linkedin-monitor.ts`** — orchestrator. Same `Context`-injection pattern as `runXMonitor` (apify, createRaid, slackClient, optional config/now/logger overrides). `MonitorResult` shape mirrors X. Failures inside one `createRaid` call increment `failures` but do not abort the run.

- **`src/scripts/run-linkedin-monitor.ts`** — CLI entry mirroring `run-x-monitor.ts`. Supports `--dry-run` and `--since-minutes=N` (default 7 — cron cadence + 2-min buffer for clock skew and Apify lag).

Files widened (small edits):

- **`src/domain/raids/types.ts`** — `Platform = "x" | "linkedin"`.
- **`src/app/publish-webhook.ts`** — `platform: z.enum(["x", "linkedin"])`.
- **`src/domain/raids/manual-raid-input.ts`** — accept `"linkedin"` from the modal; new `LINKEDIN_POST_URL_PATTERN` accepting:
  - `linkedin.com/in/<slug>/...`
  - `linkedin.com/company/<slug>/...`
  - `linkedin.com/posts/<slug>_<rest>` (LinkedIn share-out URLs)
  - `linkedin.com/feed/update/urn:li:activity:<id>` (LinkedIn activity URN URLs)
  Both `www.` and bare hosts accepted; `https://` only.
- **`src/slack/commands/build-raid-modal.ts`** — second `static_select` option for "LinkedIn"; existing X option remains the default.
- **`src/config/env.ts`** — new `APIFY_LINKEDIN_MONITOR_ACTOR_ID` (default `harvestapi/linkedin-profile-posts`). `APIFY_TOKEN` is reused.
- **`package.json`** — `monitor:linkedin` script.
- **`docs/pilot-launch-runbook.md`** — new cron entry; new env var note; mention single channel reuse.
- **`CLAUDE.md`** — in the **Design rules** section, replace the line "Launch scope is X only; keep LinkedIn parity out until the core loop is validated." with one stating LinkedIn parity is live (same scoring windows, same channel, same scoring invariants). No other lines in CLAUDE.md need to change — the **Project** description, **Architectural contracts**, and other rules are already platform-agnostic.

## Refactor (justified by second consumer)

Generalize `src/x-monitor/apify-client.ts` from a single-input wrapper to a generic actor caller. The current `ApifyRunInput` is X-specific (`{ max_posts, query, search_type }`); a near-duplicate file for LinkedIn input would be tech debt the moment it lands.

```ts
// src/lib/apify-client.ts (relocated)
export interface ApifyClient {
  runActor<TInput>(actorId: string, input: TInput): Promise<unknown[]>;
}
```

Both monitors call `apify.runActor(env.APIFY_X_MONITOR_ACTOR_ID, xInput)` and `apify.runActor(env.APIFY_LINKEDIN_MONITOR_ACTOR_ID, linkedinInput)` respectively. The X path's existing tests and call sites update mechanically. CLAUDE.md's "no abstractions beyond what the task requires" rule is honored: the abstraction is earned by a real second consumer, not anticipated.

## Data flow (one post)

1. Coolify cron fires `npm run monitor:linkedin` at `*/5 * * * *`.
2. `runLinkedinMonitor` computes `since = now - 7 min`; calls `apify.runActor(actorId, buildLinkedinApifyInput(urls, since))`.
3. For each item: `parsePostRecord` → discard if `null` (missing fields, bad timestamp, or `type !== "post"`); `filterOriginalPosts` → defense-in-depth pass-through; `mapAuthorToClientName` → discard if author doesn't match any configured client.
4. Build `CreateRaidInput { platform: "linkedin", postUrl, clientName, publishedAt: createdAt, sourceEventId: postId, ownerExternalId: authorSlug, ownerDisplayName, createdBySlackUserId: "linkedin-monitor" }` and call `createRaid`.
5. `createRaid` dedupes by `source_event_id` first, then by `(platform, normalized_post_url)`. New posts get one Slack message in `SLACK_RAID_CHANNEL_ID` with seeded reaction emojis. Re-runs are idempotent.

## Database

No migration. `raid_posts.platform` is already `text`; only the TypeScript `Platform` union widens. Existing indexes and constraints are platform-opaque.

## Tests

Mirror the X monitor test layout (vitest, context-injection over module mocking):

- `tests/linkedin-monitor/parse-post-record.test.ts` — profile post (Bill Gates–shape sample), missing fields, malformed timestamps, `type !== "post"` rejection, `postedAt.timestamp` fallback when `postedAt.date` is missing.
- `tests/linkedin-monitor/filter-posts.test.ts` — pass-through behavior; placeholder for future output-shape repost/quote filters.
- `tests/linkedin-monitor/map-client-name.test.ts` — slug match, URL-fallback match, case-insensitive, returns `undefined` for unknowns, handles trailing slashes.
- `tests/linkedin-monitor/build-apify-input.test.ts` — emits `targetUrls`, `postedLimitDate` as ISO string, `includeReposts: false`, `includeQuotePosts: false`, `maxPosts: 50`.
- `tests/linkedin-monitor/run-linkedin-monitor.test.ts` — orchestrator with stub Apify + stub `createRaid`; asserts skip counts, dry-run path, failure isolation, since-window math.
- `tests/domain/raids/manual-raid-input.test.ts` — extend with LinkedIn URL acceptance (all four forms) and rejection cases (`linkedin.com/jobs/...`, malformed slugs).
- `tests/app/publish-webhook.test.ts` — extend with `platform: "linkedin"` happy path.
- `tests/x-monitor/*` — mechanical updates for the generalized `runActor` signature.

No new integration tests. Existing `createRaid`, scoring, summary-reporting, and ops-surfacing tests already exercise platform-opaque code paths.

## Rollout

1. **PR 1: code + tests.** `LINKEDIN_CLIENTS` ships empty; `monitor:linkedin` is a safe no-op. Webhook + manual modal already accept LinkedIn. CLAUDE.md updated. No cron yet.
2. **PR 2: populate `LINKEDIN_CLIENTS`.** User-supplied list of profile and company URLs.
3. **Smoke test.** Run `npm run monitor:linkedin -- --dry-run` against the populated config; confirm parsing succeeds for both profile-authored and company-authored posts and that `mapAuthorToClientName` matches. Surface any company-page author-shape surprise here.
4. **Add Coolify cron.** `*/5 * * * *` → `npm run monitor:linkedin`. Update runbook.
5. **(Optional) team-roster aliases.** If self-raid filtering should apply to LinkedIn, add LinkedIn slugs to existing team-member alias rows. No code change required (`resolvePostOwner` matches on `owner_external_id` opaquely).

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Company-page author shape differs from profile shape (docs unverified) | Medium | URL-fallback matcher in `mapAuthorToClientName`; smoke-test step in rollout flushes it out |
| Repost/quote items leak past actor flags | Low | `type !== "post"` parser guard; `filterOriginalPosts` placeholder ready for output-shape rules |
| harvestapi outage or breaking change | Low | Generalized `runActor` wrapper makes swapping to `apimaestro/linkedin-profile-posts` (+ `apimaestro/linkedin-company-posts`) a config + small parse change, not a rewrite |
| LinkedIn slug rename silently drops posts | Low | Same fragility as X handle changes; documented in runbook, not engineered around |
| Apify cost overrun | Very low | < $5/month at current volume; runbook captures the cost expectation |

## Out of scope (explicit)

- LinkedIn API (Marketing / Community Management) integration.
- Per-platform scoring windows or per-platform action emoji mappings.
- A separate Slack channel for LinkedIn raids.
- RSS.app as a trigger source.
- Verifying real LinkedIn engagement happened (X has the same trust-the-claim model).
- Backfilling historical LinkedIn posts as raids.
