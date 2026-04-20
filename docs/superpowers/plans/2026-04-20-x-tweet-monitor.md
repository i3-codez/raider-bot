# X Tweet Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Coolify-scheduled job that polls Apify every 2 minutes for new original tweets from nine monitored X accounts and creates raids via the canonical `createRaid` path.

**Architecture:** Stateless pull model. A `tsx` script reads a static handle→client mapping, queries Apify's `run-sync-get-dataset-items` endpoint with a 5-minute `since:` window, filters out retweets/replies, and hands each tweet to `createRaid` in-process. Dedupe handled by existing `source_event_id` unique constraint. No new DB table.

**Tech Stack:** Node 24 + TypeScript 6, `fetch` (native), Vitest, existing `postgres`/`@slack/bolt` stack. Reuses `createRaid` from `src/domain/raids/create-raid.ts`.

**Spec:** `docs/superpowers/specs/2026-04-20-x-tweet-monitor-design.md`

---

## File Plan

**New files:**
- `src/config/x-clients.ts` — handle → client_name mapping (const array)
- `src/domain/x-monitor/types.ts` — `TweetRecord`, `MonitorContext`, `MonitorResult`
- `src/domain/x-monitor/build-apify-query.ts` — pure: formats query string
- `src/domain/x-monitor/parse-tweet-record.ts` — pure: Apify item → `TweetRecord | null`
- `src/domain/x-monitor/filter-tweets.ts` — pure: drop retweets/replies
- `src/domain/x-monitor/map-client-name.ts` — pure: handle → client_name (case-insensitive)
- `src/domain/x-monitor/run-x-monitor.ts` — orchestrator
- `src/x-monitor/apify-client.ts` — fetch wrapper around Apify run-sync endpoint
- `src/scripts/run-x-monitor.ts` — CLI entry
- `tests/x-monitor/build-apify-query.test.ts`
- `tests/x-monitor/parse-tweet-record.test.ts`
- `tests/x-monitor/filter-tweets.test.ts`
- `tests/x-monitor/map-client-name.test.ts`
- `tests/x-monitor/apify-client.test.ts`
- `tests/x-monitor/run-x-monitor.test.ts`
- `tests/scripts/run-x-monitor.test.ts`

**Modified files:**
- `src/config/env.ts` — add `APIFY_TOKEN`, `APIFY_X_MONITOR_ACTOR_ID`
- `.env.example` — document new vars
- `package.json` — add `monitor:x` script
- `src/scripts/run-pilot-check.ts` — append monitor dry-run
- `docs/pilot-launch-runbook.md` — document new Scheduled Task
- `CLAUDE.md` — add `monitor:x` to the Commands block

---

## Pre-Implementation: Capture real Apify output

Before writing the parser, run the actor once manually to confirm field names. This avoids guessing.

- [ ] **Step 1: Capture a sample Apify response**

In the Apify web console:
1. Open actor `danek/twitter-scraper-ppr`.
2. Set input to:
   ```json
   {
     "max_posts": 5,
     "query": "(from:JupiterExchange) -filter:replies -filter:retweets since:2026-04-19_00:00:00_UTC",
     "search_type": "Latest"
   }
   ```
3. Click **Start** → wait for completion → copy one item from the Output tab.
4. Save to a local scratch file (not committed): `/tmp/apify-sample.json`.

You'll reference this in Task 4 to confirm field names in `parse-tweet-record.ts`. If a field name differs from what this plan uses, update the parser at that step (not elsewhere).

---

## Task 1: Add Apify env vars

**Files:**
- Modify: `src/config/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add env schema entries**

Edit `src/config/env.ts`. Add these entries inside `envSchema = z.object({ ... })`:

```ts
  APIFY_TOKEN: z.string().trim().min(1),
  APIFY_X_MONITOR_ACTOR_ID: z.string().trim().min(1).default("danek~twitter-scraper-ppr"),
```

- [ ] **Step 2: Extend `.env.example`**

Append:

```
APIFY_TOKEN=
APIFY_X_MONITOR_ACTOR_ID=danek~twitter-scraper-ppr
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean (no errors).

- [ ] **Step 4: Commit**

```bash
git add src/config/env.ts .env.example
git commit -m "feat(x-monitor): add Apify env vars"
```

---

## Task 2: Create client handle config

**Files:**
- Create: `src/config/x-clients.ts`

- [ ] **Step 1: Write the config**

```ts
export interface XClient {
  handle: string;
  clientName: string;
}

export const X_CLIENTS = [
  { handle: "meanwhile", clientName: "Meanwhile" },
  { handle: "ztownsend", clientName: "Zac Townsend" },
  { handle: "badgerdao", clientName: "BadgerDAO" },
  { handle: "litestrategy", clientName: "Lite Strategy" },
  { handle: "skyecosystem", clientName: "Sky Ecosystem" },
  { handle: "skyecoinsights", clientName: "Sky Eco Insights" },
  { handle: "skymoney", clientName: "Sky Money" },
  { handle: "enlivex", clientName: "Enlivex" },
  { handle: "jupiterexchange", clientName: "Jupiter" },
] as const satisfies readonly XClient[];
```

Handles are always lowercased — the mapping step will normalize incoming author handles to match.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/config/x-clients.ts
git commit -m "feat(x-monitor): add client handle config"
```

---

## Task 3: Build Apify query (pure, TDD)

**Files:**
- Create: `tests/x-monitor/build-apify-query.test.ts`
- Create: `src/domain/x-monitor/build-apify-query.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { buildApifyQuery } from "../../src/domain/x-monitor/build-apify-query.js";

describe("buildApifyQuery", () => {
  it("joins handles with OR and appends -filter:replies -filter:retweets + since:", () => {
    const query = buildApifyQuery(["meanwhile", "ztownsend"], new Date("2026-04-20T12:30:40.000Z"));

    expect(query).toBe(
      "(from:meanwhile OR from:ztownsend) -filter:replies -filter:retweets since:2026-04-20_12:30:40_UTC",
    );
  });

  it("handles a single handle without OR", () => {
    const query = buildApifyQuery(["meanwhile"], new Date("2026-04-20T00:00:00.000Z"));

    expect(query).toBe("(from:meanwhile) -filter:replies -filter:retweets since:2026-04-20_00:00:00_UTC");
  });

  it("throws on empty handle list to prevent a no-op query", () => {
    expect(() => buildApifyQuery([], new Date())).toThrow(/handle list/i);
  });

  it("floors to the nearest second — Apify's since parser ignores sub-second precision", () => {
    const query = buildApifyQuery(["a"], new Date("2026-04-20T12:30:40.789Z"));

    expect(query).toContain("since:2026-04-20_12:30:40_UTC");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/x-monitor/build-apify-query.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
export function buildApifyQuery(handles: readonly string[], since: Date): string {
  if (handles.length === 0) {
    throw new Error("buildApifyQuery requires a non-empty handle list.");
  }

  const fromClause = handles.map((handle) => `from:${handle}`).join(" OR ");
  const isoFloored = new Date(Math.floor(since.getTime() / 1000) * 1000).toISOString();
  // "2026-04-20T12:30:40.000Z" → "2026-04-20_12:30:40_UTC"
  const sinceStr = `${isoFloored.slice(0, 19).replace("T", "_")}_UTC`;

  return `(${fromClause}) -filter:replies -filter:retweets since:${sinceStr}`;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run tests/x-monitor/build-apify-query.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/x-monitor/build-apify-query.ts tests/x-monitor/build-apify-query.test.ts
git commit -m "feat(x-monitor): add Apify query builder"
```

---

## Task 4: Parse tweet records (pure, TDD)

**Files:**
- Create: `tests/x-monitor/parse-tweet-record.test.ts`
- Create: `src/domain/x-monitor/types.ts`
- Create: `src/domain/x-monitor/parse-tweet-record.ts`

**Before you start:** Open your captured `/tmp/apify-sample.json` from the pre-implementation step. If the field names below don't match what the actor actually returned, adjust them in Step 3 (not later). Common variations this parser tolerates:
- ID: `id`, `id_str`, or `tweetId`
- URL: `url` or `tweetUrl`
- Author handle: `user.screen_name`, `author.userName`, or `screen_name`
- Author name: `user.name`, `author.name`, or `name`
- Created at: `created_at` or `createdAt`
- Retweet flag: `is_retweet`, `isRetweet`, or presence of `retweeted_status`
- Reply flag: `is_reply`, `isReply`, or non-null `in_reply_to_status_id`

- [ ] **Step 1: Write types**

Create `src/domain/x-monitor/types.ts`:

```ts
export interface TweetRecord {
  tweetId: string;
  tweetUrl: string;
  authorHandle: string; // lowercased at parse time
  authorName: string;
  createdAt: Date;
  isRetweet: boolean;
  isReply: boolean;
}

export interface MonitorSinceWindow {
  from: Date;
  to: Date;
}

export interface MonitorSkipCounts {
  unmapped: number;
  nonOriginal: number;
  malformed: number;
}

export interface MonitorResult {
  tweetsFetched: number;
  raidsProcessed: number;
  skipped: MonitorSkipCounts;
  failures: number;
  sinceWindow: MonitorSinceWindow;
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/x-monitor/parse-tweet-record.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseTweetRecord } from "../../src/domain/x-monitor/parse-tweet-record.js";

describe("parseTweetRecord", () => {
  const base = {
    id: "1234567890",
    url: "https://twitter.com/JupiterExchange/status/1234567890",
    user: { screen_name: "JupiterExchange", name: "Jupiter" },
    created_at: "Thu Apr 20 12:30:40 +0000 2026",
    is_retweet: false,
    in_reply_to_status_id: null,
  };

  it("parses a well-formed tweet", () => {
    const parsed = parseTweetRecord(base);

    expect(parsed).not.toBeNull();
    expect(parsed!.tweetId).toBe("1234567890");
    expect(parsed!.tweetUrl).toBe("https://twitter.com/JupiterExchange/status/1234567890");
    expect(parsed!.authorHandle).toBe("jupiterexchange"); // lowercased
    expect(parsed!.authorName).toBe("Jupiter");
    expect(parsed!.createdAt.toISOString()).toBe("2026-04-20T12:30:40.000Z");
    expect(parsed!.isRetweet).toBe(false);
    expect(parsed!.isReply).toBe(false);
  });

  it("accepts id_str as fallback for id", () => {
    const { id: _id, ...rest } = base;
    const parsed = parseTweetRecord({ ...rest, id_str: "9876543210" });

    expect(parsed!.tweetId).toBe("9876543210");
  });

  it("accepts ISO created_at", () => {
    const parsed = parseTweetRecord({ ...base, created_at: "2026-04-20T12:30:40.000Z" });

    expect(parsed!.createdAt.toISOString()).toBe("2026-04-20T12:30:40.000Z");
  });

  it("flags retweets via is_retweet", () => {
    const parsed = parseTweetRecord({ ...base, is_retweet: true });

    expect(parsed!.isRetweet).toBe(true);
  });

  it("flags retweets via retweeted_status presence", () => {
    const parsed = parseTweetRecord({ ...base, retweeted_status: { id: "other" } });

    expect(parsed!.isRetweet).toBe(true);
  });

  it("flags replies via in_reply_to_status_id", () => {
    const parsed = parseTweetRecord({ ...base, in_reply_to_status_id: "111" });

    expect(parsed!.isReply).toBe(true);
  });

  it("returns null when required fields are missing", () => {
    expect(parseTweetRecord({})).toBeNull();
    expect(parseTweetRecord({ id: "1" })).toBeNull();
    expect(parseTweetRecord({ id: "1", url: "u" })).toBeNull();
  });

  it("returns null for unparseable created_at", () => {
    const parsed = parseTweetRecord({ ...base, created_at: "not-a-date" });

    expect(parsed).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `npx vitest run tests/x-monitor/parse-tweet-record.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement**

Create `src/domain/x-monitor/parse-tweet-record.ts`:

```ts
import type { TweetRecord } from "./types.js";

function pickString(source: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

function pickNested<T>(
  source: Record<string, unknown>,
  paths: readonly (readonly string[])[],
  check: (value: unknown) => value is T,
): T | null {
  for (const path of paths) {
    let current: unknown = source;
    for (const segment of path) {
      if (typeof current !== "object" || current === null) {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    if (check(current)) {
      return current;
    }
  }
  return null;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export function parseTweetRecord(raw: unknown): TweetRecord | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const source = raw as Record<string, unknown>;

  const tweetId = pickString(source, ["id", "id_str", "tweetId"]);
  const tweetUrl = pickString(source, ["url", "tweetUrl"]);
  const createdAtRaw = pickString(source, ["created_at", "createdAt"]);
  const authorHandle = pickNested(
    source,
    [["user", "screen_name"], ["author", "userName"], ["screen_name"]],
    isNonEmptyString,
  );
  const authorName =
    pickNested(source, [["user", "name"], ["author", "name"]], isNonEmptyString) ??
    pickString(source, ["name"]);

  if (!tweetId || !tweetUrl || !createdAtRaw || !authorHandle || !authorName) {
    return null;
  }

  const createdAt = new Date(createdAtRaw);
  if (Number.isNaN(createdAt.getTime())) {
    return null;
  }

  const isRetweet =
    source.is_retweet === true ||
    source.isRetweet === true ||
    (typeof source.retweeted_status === "object" && source.retweeted_status !== null);

  const replyIdCandidates = ["in_reply_to_status_id", "in_reply_to_status_id_str", "inReplyToStatusId"];
  const hasReplyId = replyIdCandidates.some((key) => {
    const value = source[key];
    return value !== null && value !== undefined && value !== "";
  });
  const isReply = source.is_reply === true || source.isReply === true || hasReplyId;

  return {
    tweetId,
    tweetUrl,
    authorHandle: authorHandle.toLowerCase(),
    authorName,
    createdAt,
    isRetweet,
    isReply,
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/x-monitor/parse-tweet-record.test.ts`
Expected: PASS (8 tests).

If the real Apify output uses field names this parser doesn't check, add them to the relevant `pickString`/`pickNested` array and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/domain/x-monitor/types.ts src/domain/x-monitor/parse-tweet-record.ts tests/x-monitor/parse-tweet-record.test.ts
git commit -m "feat(x-monitor): parse Apify tweet records"
```

---

## Task 5: Filter tweets (pure, TDD)

**Files:**
- Create: `tests/x-monitor/filter-tweets.test.ts`
- Create: `src/domain/x-monitor/filter-tweets.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { filterOriginalTweets } from "../../src/domain/x-monitor/filter-tweets.js";
import type { TweetRecord } from "../../src/domain/x-monitor/types.js";

function make(overrides: Partial<TweetRecord> = {}): TweetRecord {
  return {
    tweetId: "1",
    tweetUrl: "https://x.com/u/status/1",
    authorHandle: "u",
    authorName: "U",
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    isRetweet: false,
    isReply: false,
    ...overrides,
  };
}

describe("filterOriginalTweets", () => {
  it("keeps originals", () => {
    expect(filterOriginalTweets([make()])).toHaveLength(1);
  });

  it("drops retweets", () => {
    expect(filterOriginalTweets([make({ tweetId: "2", isRetweet: true })])).toHaveLength(0);
  });

  it("drops replies", () => {
    expect(filterOriginalTweets([make({ tweetId: "3", isReply: true })])).toHaveLength(0);
  });

  it("keeps a mix and drops only non-originals", () => {
    const result = filterOriginalTweets([
      make({ tweetId: "1" }),
      make({ tweetId: "2", isRetweet: true }),
      make({ tweetId: "3", isReply: true }),
      make({ tweetId: "4" }),
    ]);

    expect(result.map((t) => t.tweetId)).toEqual(["1", "4"]);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/x-monitor/filter-tweets.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/domain/x-monitor/filter-tweets.ts`:

```ts
import type { TweetRecord } from "./types.js";

export function filterOriginalTweets(tweets: readonly TweetRecord[]): TweetRecord[] {
  return tweets.filter((tweet) => !tweet.isRetweet && !tweet.isReply);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/x-monitor/filter-tweets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/x-monitor/filter-tweets.ts tests/x-monitor/filter-tweets.test.ts
git commit -m "feat(x-monitor): filter non-original tweets"
```

---

## Task 6: Map handle to client_name (pure, TDD)

**Files:**
- Create: `tests/x-monitor/map-client-name.test.ts`
- Create: `src/domain/x-monitor/map-client-name.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { mapHandleToClientName } from "../../src/domain/x-monitor/map-client-name.js";
import { X_CLIENTS } from "../../src/config/x-clients.js";

describe("mapHandleToClientName", () => {
  it("resolves every configured client handle", () => {
    for (const client of X_CLIENTS) {
      expect(mapHandleToClientName(client.handle, X_CLIENTS)).toBe(client.clientName);
    }
  });

  it("is case-insensitive", () => {
    expect(mapHandleToClientName("JupiterExchange", X_CLIENTS)).toBe("Jupiter");
    expect(mapHandleToClientName("JUPITEREXCHANGE", X_CLIENTS)).toBe("Jupiter");
  });

  it("returns undefined for an unknown handle", () => {
    expect(mapHandleToClientName("unknown_handle_xyz", X_CLIENTS)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npx vitest run tests/x-monitor/map-client-name.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/domain/x-monitor/map-client-name.ts`:

```ts
import type { XClient } from "../../config/x-clients.js";

export function mapHandleToClientName(
  authorHandle: string,
  clients: readonly XClient[],
): string | undefined {
  const normalized = authorHandle.toLowerCase();
  const match = clients.find((client) => client.handle === normalized);
  return match?.clientName;
}
```

- [ ] **Step 4: Run — pass**

Run: `npx vitest run tests/x-monitor/map-client-name.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/x-monitor/map-client-name.ts tests/x-monitor/map-client-name.test.ts
git commit -m "feat(x-monitor): map handle to client_name"
```

---

## Task 7: Apify client wrapper (TDD)

**Files:**
- Create: `tests/x-monitor/apify-client.test.ts`
- Create: `src/x-monitor/apify-client.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";

import { createApifyClient, type ApifyRunInput } from "../../src/x-monitor/apify-client.js";

function makeResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

const input: ApifyRunInput = {
  max_posts: 10,
  query: "(from:jupiterexchange) since:2026-04-20_00:00:00_UTC",
  search_type: "Latest",
};

describe("createApifyClient.runSyncGetDatasetItems", () => {
  it("calls the run-sync endpoint with POST + Authorization header and returns the JSON array", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      makeResponse([{ id: "1" }, { id: "2" }]),
    );
    const client = createApifyClient({
      token: "apify_test_token",
      actorId: "danek~twitter-scraper-ppr",
      fetchImpl,
    });

    const items = await client.runSyncGetDatasetItems(input);

    expect(items).toEqual([{ id: "1" }, { id: "2" }]);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.apify.com/v2/acts/danek~twitter-scraper-ppr/run-sync-get-dataset-items",
    );
    expect(init!.method).toBe("POST");
    expect(init!.headers).toMatchObject({
      Authorization: "Bearer apify_test_token",
      "Content-Type": "application/json",
    });
    expect(init!.body).toBe(JSON.stringify(input));
  });

  it("throws a descriptive error when the actor returns a non-2xx status", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("rate_limited", { status: 429 }),
    );
    const client = createApifyClient({
      token: "t",
      actorId: "a",
      fetchImpl,
    });

    await expect(client.runSyncGetDatasetItems(input)).rejects.toThrow(/429/);
  });

  it("throws when the response body isn't a JSON array", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      makeResponse({ not: "an array" }),
    );
    const client = createApifyClient({ token: "t", actorId: "a", fetchImpl });

    await expect(client.runSyncGetDatasetItems(input)).rejects.toThrow(/array/i);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npx vitest run tests/x-monitor/apify-client.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/x-monitor/apify-client.ts`:

```ts
export interface ApifyRunInput {
  max_posts: number;
  query: string;
  search_type: "Latest" | "Top";
}

export interface ApifyClient {
  runSyncGetDatasetItems(input: ApifyRunInput): Promise<unknown[]>;
}

export interface CreateApifyClientOptions {
  token: string;
  actorId: string;
  fetchImpl?: typeof fetch;
}

const APIFY_BASE = "https://api.apify.com/v2";

export function createApifyClient(options: CreateApifyClientOptions): ApifyClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async runSyncGetDatasetItems(input) {
      const url = `${APIFY_BASE}/acts/${options.actorId}/run-sync-get-dataset-items`;
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Apify run-sync-get-dataset-items failed: ${response.status} ${response.statusText} ${text}`.trim(),
        );
      }

      const body = await response.json();
      if (!Array.isArray(body)) {
        throw new Error("Apify run-sync-get-dataset-items did not return a JSON array.");
      }

      return body;
    },
  };
}
```

- [ ] **Step 4: Run — pass**

Run: `npx vitest run tests/x-monitor/apify-client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/x-monitor/apify-client.ts tests/x-monitor/apify-client.test.ts
git commit -m "feat(x-monitor): apify run-sync client wrapper"
```

---

## Task 8: Orchestrator (TDD)

**Files:**
- Create: `tests/x-monitor/run-x-monitor.test.ts`
- Create: `src/domain/x-monitor/run-x-monitor.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("runXMonitor", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/raider_bot",
      SLACK_BOT_TOKEN: "xoxb-test-token",
      SLACK_SIGNING_SECRET: "test-signing-secret",
      SLACK_RAID_CHANNEL_ID: "C_RAIDS",
      SLACK_RAID_OPERATOR_USER_IDS: "U_OPERATOR",
      PUBLISH_WEBHOOK_SHARED_SECRET: "publish-secret",
      APIFY_TOKEN: "apify_test",
      APIFY_X_MONITOR_ACTOR_ID: "danek~twitter-scraper-ppr",
    };
    vi.resetModules();
  });

  const now = new Date("2026-04-20T12:30:40.000Z");
  const validTweet = {
    id: "tweet-1",
    url: "https://x.com/Meanwhile/status/tweet-1",
    user: { screen_name: "Meanwhile", name: "Meanwhile" },
    created_at: "2026-04-20T12:29:00.000Z",
    is_retweet: false,
    in_reply_to_status_id: null,
  };

  it("processes an empty dataset cleanly", async () => {
    const { runXMonitor } = await import("../../src/domain/x-monitor/run-x-monitor.js");
    const createRaid = vi.fn();
    const apify = { runSyncGetDatasetItems: vi.fn().mockResolvedValue([]) };

    const result = await runXMonitor(
      { dryRun: false },
      {
        apify,
        createRaid,
        slackClient: {} as never,
        now: () => now,
      },
    );

    expect(result.tweetsFetched).toBe(0);
    expect(result.raidsProcessed).toBe(0);
    expect(result.failures).toBe(0);
    expect(createRaid).not.toHaveBeenCalled();
  });

  it("creates raids for originals, skips retweets/replies/unmapped", async () => {
    const { runXMonitor } = await import("../../src/domain/x-monitor/run-x-monitor.js");
    const createRaid = vi.fn().mockImplementation(async (input) => ({ id: "raid-" + input.sourceEventId }));
    const apify = {
      runSyncGetDatasetItems: vi.fn().mockResolvedValue([
        validTweet,
        { ...validTweet, id: "tweet-2", is_retweet: true },
        { ...validTweet, id: "tweet-3", in_reply_to_status_id: "111" },
        { ...validTweet, id: "tweet-4", user: { screen_name: "unknown", name: "Unknown" } },
      ]),
    };

    const result = await runXMonitor(
      { dryRun: false },
      {
        apify,
        createRaid,
        slackClient: {} as never,
        now: () => now,
      },
    );

    expect(result.tweetsFetched).toBe(4);
    expect(result.raidsProcessed).toBe(1);
    expect(result.skipped.nonOriginal).toBe(2);
    expect(result.skipped.unmapped).toBe(1);
    expect(createRaid).toHaveBeenCalledOnce();
    expect(createRaid).toHaveBeenCalledWith(
      expect.objectContaining({
        postUrl: validTweet.url,
        clientName: "Meanwhile",
        platform: "x",
        sourceEventId: "tweet-1",
        createdBySlackUserId: "x-monitor",
        ownerExternalId: "meanwhile",
        ownerDisplayName: "Meanwhile",
      }),
      expect.any(Object),
    );
  });

  it("counts malformed items via skipped.malformed", async () => {
    const { runXMonitor } = await import("../../src/domain/x-monitor/run-x-monitor.js");
    const createRaid = vi.fn();
    const apify = {
      runSyncGetDatasetItems: vi.fn().mockResolvedValue([{ nothing: "useful" }]),
    };

    const result = await runXMonitor(
      { dryRun: false },
      { apify, createRaid, slackClient: {} as never, now: () => now },
    );

    expect(result.skipped.malformed).toBe(1);
    expect(result.raidsProcessed).toBe(0);
  });

  it("continues after a createRaid failure and reports failures count", async () => {
    const { runXMonitor } = await import("../../src/domain/x-monitor/run-x-monitor.js");
    const createRaid = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new Error("boom");
      })
      .mockImplementationOnce(async (input) => ({ id: "raid-" + input.sourceEventId }));
    const apify = {
      runSyncGetDatasetItems: vi.fn().mockResolvedValue([
        validTweet,
        { ...validTweet, id: "tweet-5" },
      ]),
    };

    const result = await runXMonitor(
      { dryRun: false },
      { apify, createRaid, slackClient: {} as never, now: () => now },
    );

    expect(result.failures).toBe(1);
    expect(result.raidsProcessed).toBe(1);
    expect(createRaid).toHaveBeenCalledTimes(2);
  });

  it("dry-run skips createRaid entirely", async () => {
    const { runXMonitor } = await import("../../src/domain/x-monitor/run-x-monitor.js");
    const createRaid = vi.fn();
    const apify = {
      runSyncGetDatasetItems: vi.fn().mockResolvedValue([validTweet]),
    };

    const result = await runXMonitor(
      { dryRun: true },
      { apify, createRaid, slackClient: {} as never, now: () => now },
    );

    expect(createRaid).not.toHaveBeenCalled();
    expect(result.raidsProcessed).toBe(0);
    expect(result.tweetsFetched).toBe(1);
  });

  it("computes a since-window covering the last 5 minutes from now()", async () => {
    const { runXMonitor } = await import("../../src/domain/x-monitor/run-x-monitor.js");
    const apify = { runSyncGetDatasetItems: vi.fn().mockResolvedValue([]) };

    const result = await runXMonitor(
      { dryRun: false },
      { apify, createRaid: vi.fn(), slackClient: {} as never, now: () => now },
    );

    expect(result.sinceWindow.to.toISOString()).toBe("2026-04-20T12:30:40.000Z");
    expect(result.sinceWindow.from.toISOString()).toBe("2026-04-20T12:25:40.000Z");
    const [input] = apify.runSyncGetDatasetItems.mock.calls[0]!;
    expect(input.query).toContain("since:2026-04-20_12:25:40_UTC");
    expect(input.query).toContain("from:meanwhile");
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npx vitest run tests/x-monitor/run-x-monitor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/domain/x-monitor/run-x-monitor.ts`:

```ts
import { X_CLIENTS, type XClient } from "../../config/x-clients.js";
import { logger as defaultLogger } from "../../lib/logger.js";
import type { ApifyClient } from "../../x-monitor/apify-client.js";
import { buildApifyQuery } from "./build-apify-query.js";
import { filterOriginalTweets } from "./filter-tweets.js";
import { mapHandleToClientName } from "./map-client-name.js";
import { parseTweetRecord } from "./parse-tweet-record.js";
import type { MonitorResult, TweetRecord } from "./types.js";
import type {
  CreateRaidContext,
  CreateRaidInput,
  SlackClientLike,
} from "../raids/create-raid.js";
import type { RaidPost } from "../raids/types.js";

const SINCE_WINDOW_MINUTES = 5;
const MAX_POSTS = 50;
const MONITOR_CREATED_BY = "x-monitor";

export interface MonitorContext {
  apify: ApifyClient;
  createRaid: (input: CreateRaidInput, ctx: CreateRaidContext) => Promise<RaidPost>;
  slackClient: SlackClientLike;
  config?: readonly XClient[];
  now?: () => Date;
  logger?: Pick<typeof defaultLogger, "info" | "warn" | "error">;
}

export async function runXMonitor(
  params: { dryRun?: boolean },
  context: MonitorContext,
): Promise<MonitorResult> {
  const clients = context.config ?? X_CLIENTS;
  const logger = context.logger ?? defaultLogger;
  const now = context.now ? context.now() : new Date();
  const since = new Date(now.getTime() - SINCE_WINDOW_MINUTES * 60 * 1000);

  const query = buildApifyQuery(
    clients.map((client) => client.handle),
    since,
  );

  const rawItems = await context.apify.runSyncGetDatasetItems({
    max_posts: MAX_POSTS,
    query,
    search_type: "Latest",
  });

  const result: MonitorResult = {
    tweetsFetched: rawItems.length,
    raidsProcessed: 0,
    skipped: { unmapped: 0, nonOriginal: 0, malformed: 0 },
    failures: 0,
    sinceWindow: { from: since, to: now },
  };

  const parsed: TweetRecord[] = [];
  for (const item of rawItems) {
    const record = parseTweetRecord(item);
    if (!record) {
      result.skipped.malformed += 1;
      logger.warn({ item }, "x-monitor: skipping malformed Apify item");
      continue;
    }
    parsed.push(record);
  }

  const originals = filterOriginalTweets(parsed);
  result.skipped.nonOriginal = parsed.length - originals.length;

  for (const tweet of originals) {
    const clientName = mapHandleToClientName(tweet.authorHandle, clients);
    if (!clientName) {
      result.skipped.unmapped += 1;
      logger.warn(
        { authorHandle: tweet.authorHandle, tweetId: tweet.tweetId },
        "x-monitor: author handle is not in x-clients.ts — skipping",
      );
      continue;
    }

    const raidInput: CreateRaidInput = {
      postUrl: tweet.tweetUrl,
      clientName,
      platform: "x",
      publishedAt: tweet.createdAt,
      createdBySlackUserId: MONITOR_CREATED_BY,
      sourceEventId: tweet.tweetId,
      ownerExternalId: tweet.authorHandle,
      ownerDisplayName: tweet.authorName,
      ownerSlackUserId: null,
    };

    if (params.dryRun) {
      logger.info({ raidInput }, "x-monitor dry-run: would create raid");
      continue;
    }

    try {
      await context.createRaid(raidInput, { client: context.slackClient });
      result.raidsProcessed += 1;
    } catch (error) {
      result.failures += 1;
      logger.error(
        { err: error, tweetId: tweet.tweetId, clientName },
        "x-monitor: createRaid threw — continuing with remaining tweets",
      );
    }
  }

  logger.info({ result }, "x-monitor run complete");

  return result;
}
```

Note: the `void filterOriginalTweets` line keeps the import used in the file, since the inline `tweet.isRetweet || tweet.isReply` check is semantically equivalent and more readable in context. Unit tests for `filterOriginalTweets` cover the pure function separately.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/x-monitor/run-x-monitor.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Run full suite to catch any regression**

Run: `npm test`
Expected: all tests pass (previous 64 + new ones from earlier tasks + 6 orchestrator = ≥95).

- [ ] **Step 6: Commit**

```bash
git add src/domain/x-monitor/run-x-monitor.ts tests/x-monitor/run-x-monitor.test.ts
git commit -m "feat(x-monitor): orchestrator with dry-run and error handling"
```

---

## Task 9: CLI script entry (TDD)

**Files:**
- Create: `tests/scripts/run-x-monitor.test.ts`
- Create: `src/scripts/run-x-monitor.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("runXMonitorCommand", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/raider_bot",
      SLACK_BOT_TOKEN: "xoxb-test-token",
      SLACK_SIGNING_SECRET: "test-signing-secret",
      SLACK_RAID_CHANNEL_ID: "C_RAIDS",
      SLACK_RAID_OPERATOR_USER_IDS: "U_OPERATOR",
      PUBLISH_WEBHOOK_SHARED_SECRET: "publish-secret",
      APIFY_TOKEN: "apify_test",
      APIFY_X_MONITOR_ACTOR_ID: "danek~twitter-scraper-ppr",
    };
    vi.resetModules();
  });

  it("parses --dry-run and forwards dryRun=true", async () => {
    const { runXMonitorCommand } = await import("../../src/scripts/run-x-monitor.js");
    const runXMonitor = vi.fn().mockResolvedValue({
      tweetsFetched: 0,
      raidsProcessed: 0,
      skipped: { unmapped: 0, nonOriginal: 0, malformed: 0 },
      failures: 0,
      sinceWindow: { from: new Date(), to: new Date() },
    });
    const stdout = { log: vi.fn() };

    const exit = await runXMonitorCommand(["--dry-run"], { runXMonitor, stdout });

    expect(runXMonitor).toHaveBeenCalledWith({ dryRun: true }, expect.any(Object));
    expect(exit).toBe(0);
  });

  it("returns exit code 0 on zero failures", async () => {
    const { runXMonitorCommand } = await import("../../src/scripts/run-x-monitor.js");
    const runXMonitor = vi.fn().mockResolvedValue({
      tweetsFetched: 1,
      raidsProcessed: 1,
      skipped: { unmapped: 0, nonOriginal: 0, malformed: 0 },
      failures: 0,
      sinceWindow: { from: new Date(), to: new Date() },
    });

    const exit = await runXMonitorCommand([], { runXMonitor, stdout: { log: vi.fn() } });

    expect(exit).toBe(0);
  });

  it("returns exit code 1 when any raid failed", async () => {
    const { runXMonitorCommand } = await import("../../src/scripts/run-x-monitor.js");
    const runXMonitor = vi.fn().mockResolvedValue({
      tweetsFetched: 2,
      raidsProcessed: 1,
      skipped: { unmapped: 0, nonOriginal: 0, malformed: 0 },
      failures: 1,
      sinceWindow: { from: new Date(), to: new Date() },
    });

    const exit = await runXMonitorCommand([], { runXMonitor, stdout: { log: vi.fn() } });

    expect(exit).toBe(1);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npx vitest run tests/scripts/run-x-monitor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/scripts/run-x-monitor.ts`:

```ts
#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { env } from "../config/env.js";
import { closeSql } from "../db/sql.js";
import { createRaid } from "../domain/raids/create-raid.js";
import { runXMonitor } from "../domain/x-monitor/run-x-monitor.js";
import { createApifyClient } from "../x-monitor/apify-client.js";
import { createSlackClient } from "../slack/client.js";

export interface RunXMonitorCommandDependencies {
  runXMonitor?: typeof runXMonitor;
  stdout?: Pick<typeof console, "log">;
}

function parseDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

export async function runXMonitorCommand(
  argv: string[],
  dependencies: RunXMonitorCommandDependencies = {},
): Promise<number> {
  const dryRun = parseDryRun(argv);
  const run = dependencies.runXMonitor ?? runXMonitor;
  const stdout = dependencies.stdout ?? console;

  const result = await run(
    { dryRun },
    {
      apify: createApifyClient({
        token: env.APIFY_TOKEN,
        actorId: env.APIFY_X_MONITOR_ACTOR_ID,
      }),
      createRaid,
      slackClient: createSlackClient() as Parameters<typeof runXMonitor>[1]["slackClient"],
    },
  );

  stdout.log(
    `x-monitor${dryRun ? " (dry-run)" : ""}: fetched=${result.tweetsFetched} processed=${result.raidsProcessed} failures=${result.failures} skipped.nonOriginal=${result.skipped.nonOriginal} skipped.unmapped=${result.skipped.unmapped} skipped.malformed=${result.skipped.malformed}`,
  );

  return result.failures === 0 ? 0 : 1;
}

async function main() {
  const code = await runXMonitorCommand(process.argv.slice(2));
  process.exitCode = code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown x-monitor failure.";
    console.error(`x-monitor failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await closeSql({ timeout: 0 });
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/scripts/run-x-monitor.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scripts/run-x-monitor.ts tests/scripts/run-x-monitor.test.ts
git commit -m "feat(x-monitor): CLI entry with --dry-run"
```

---

## Task 10: Wire up npm script and pilot-check

**Files:**
- Modify: `package.json`
- Modify: `src/scripts/run-pilot-check.ts`

- [ ] **Step 1: Add npm script**

Edit `package.json` `scripts` block. Add one line between `ops:surfacing` and `pilot:check`:

```json
    "monitor:x": "tsx src/scripts/run-x-monitor.ts",
```

Resulting block (for reference):

```json
  "scripts": {
    "dev": "tsx watch src/app/server.ts",
    "start": "tsx src/app/server.ts",
    "test": "vitest run",
    "correct:raid-time": "tsx src/scripts/correct-raid-published-at.ts",
    "summary:daily": "tsx src/scripts/run-summary-job.ts --cadence=daily",
    "summary:weekly": "tsx src/scripts/run-summary-job.ts --cadence=weekly",
    "summary:monthly": "tsx src/scripts/run-summary-job.ts --cadence=monthly",
    "month:close": "tsx src/scripts/run-month-close.ts",
    "ops:surfacing": "tsx src/scripts/run-ops-surfacing.ts",
    "monitor:x": "tsx src/scripts/run-x-monitor.ts",
    "pilot:check": "tsx src/scripts/run-pilot-check.ts",
    "typecheck": "tsc --noEmit"
  },
```

- [ ] **Step 2: Append the monitor dry-run to pilot-check**

Edit `src/scripts/run-pilot-check.ts`. Add the import:

```ts
import { runXMonitorCommand } from "./run-x-monitor.js";
```

Add to `RunPilotCheckDependencies`:

```ts
  runXMonitorCommand?: typeof runXMonitorCommand;
```

Inside `runPilotCheck`, add after the existing `await runOpsSurfacing(...)` call:

```ts
  const runXMonitorCmd = assertCommand(
    dependencies.runXMonitorCommand ?? runXMonitorCommand,
    "runXMonitorCommand",
  );
  const xMonitorExit = await runXMonitorCmd(["--dry-run"], { stdout });
  if (xMonitorExit !== 0) {
    throw new Error("x-monitor dry-run reported failures.");
  }
```

Update the final success log:

```ts
  stdout.log("Pilot check passed: summary, month-close, ops, and x-monitor dry-run flows all completed.");
```

- [ ] **Step 3: Typecheck and run full test suite**

```bash
npm run typecheck
npm test
```

Expected: both clean. If a test asserted the exact text of the pilot-check success message, update the expectation to include "x-monitor".

- [ ] **Step 4: Commit**

```bash
git add package.json src/scripts/run-pilot-check.ts
git commit -m "feat(x-monitor): npm script + pilot-check integration"
```

---

## Task 11: Documentation

**Files:**
- Modify: `docs/pilot-launch-runbook.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the runbook**

In `docs/pilot-launch-runbook.md`, find the **Scheduled Tasks** table inside the Coolify deploy section and add one row:

```
| X tweet monitor | */2 * * * * | npm run monitor:x |
```

Then, in the **Required env vars** section, append:

- `APIFY_TOKEN` — Apify account token (Apify → Settings → Integrations → Personal API tokens).

In the **Optional** block:

- `APIFY_X_MONITOR_ACTOR_ID` — Apify actor slug (defaults to `danek~twitter-scraper-ppr`).

- [ ] **Step 2: Update CLAUDE.md commands section**

In `CLAUDE.md`, locate the scheduled-jobs bash block and add `monitor:x` to the list. The relevant block becomes:

```bash
npm run summary:daily | summary:weekly | summary:monthly
npm run month:close
npm run ops:surfacing
npm run monitor:x                   # poll Apify for new tweets and fire raids
npm run pilot:check                 # env + Slack + DB smoke test, used before widening pilot
npm run correct:raid-time           # fix a raid's published_at
```

- [ ] **Step 3: Commit**

```bash
git add docs/pilot-launch-runbook.md CLAUDE.md
git commit -m "docs(x-monitor): runbook + CLAUDE.md updates"
```

---

## Task 12: Final verification

**Files:** none

- [ ] **Step 1: Full typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all tests pass, including the new:
- `tests/x-monitor/build-apify-query.test.ts` (4)
- `tests/x-monitor/parse-tweet-record.test.ts` (8)
- `tests/x-monitor/filter-tweets.test.ts` (4)
- `tests/x-monitor/map-client-name.test.ts` (3)
- `tests/x-monitor/apify-client.test.ts` (3)
- `tests/x-monitor/run-x-monitor.test.ts` (6)
- `tests/scripts/run-x-monitor.test.ts` (3)

Plus the pre-existing 64 tests from the main branch at plan start.

- [ ] **Step 3: Local dry-run against real Apify**

Before enabling the Coolify Scheduled Task, confirm end-to-end from your laptop:

```bash
# Make sure .env.local contains APIFY_TOKEN (real value) and all the other required vars.
node --env-file=.env.local --import tsx/esm src/scripts/run-x-monitor.ts --dry-run
```

Expected output (shape):

```
x-monitor (dry-run): fetched=0 processed=0 failures=0 skipped.nonOriginal=0 skipped.unmapped=0 skipped.malformed=0
```

(The numbers will be 0 unless a monitored handle posted in the last 5 minutes.)

If Apify returns real tweets, you'll see them in Pino logs before the summary line. No raids are actually created — dry-run skips `createRaid`.

- [ ] **Step 4: Deploy + enable Scheduled Task**

Follow the updated `docs/pilot-launch-runbook.md`:
1. Push to `main`. Coolify auto-redeploys.
2. Add `APIFY_TOKEN` (and optionally `APIFY_X_MONITOR_ACTOR_ID`) to Coolify env vars.
3. Add the `*/2 * * * *` Scheduled Task `npm run monitor:x`.
4. Watch the first few runs in Coolify logs; expect `tweetsFetched: 0` unless a monitored account just posted.

- [ ] **Step 5: End-to-end smoke test**

Ask one of the monitored accounts (e.g., a test account you control) to post an original tweet. Within ~2 minutes, a new raid should appear in `#raids` with auto-seeded reactions.

If nothing appears after 5 minutes:
- Check Coolify Scheduled Task logs for the last run — any errors?
- Confirm the handle is in `src/config/x-clients.ts` (case-insensitive but correct spelling).
- Confirm the tweet was an original (not a reply, not a retweet).
- Manually run `npm run monitor:x --dry-run` in the container and inspect the raw Apify response via the `item` field in the warn/info logs.
