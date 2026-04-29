# LinkedIn raids parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LinkedIn parity to Raider Bot by mirroring the X monitor pipeline — a polled Apify-backed scraper that turns newly published posts from configured profiles and company pages into raids in the same Slack channel as X, preserving the 30-min scoring fairness window.

**Architecture:** Shared generalized Apify client (`src/lib/apify-client.ts`) that both monitors use. New `src/domain/linkedin-monitor/` mirrors `src/domain/x-monitor/`. The canonical raid creation path (`createRaid`) is unchanged; LinkedIn flows in opaquely with `platform: "linkedin"`. No DB migration — `raid_posts.platform` is already `text`. See [the design spec](../specs/2026-04-29-linkedin-raids-design.md) for full context.

**Tech Stack:** TypeScript, Node 24, vitest, `postgres` driver, Apify (`harvestapi/linkedin-profile-posts` actor).

**Spec deviation flagged during planning:** the spec mentions `src/linkedin-monitor/apify-client.ts`. The plan replaces it with a single shared `src/lib/apify-client.ts` (the generalized X wrapper). No separate LinkedIn IO wrapper is needed.

---

## Task 1: Generalize the Apify client to `runActor<TInput>`

The existing X wrapper bakes `actorId` into client creation and exposes one input shape. LinkedIn needs a different input shape, so we generalize: `actorId` moves to the call site and the input becomes a type parameter. This removes the need for two near-identical wrappers and keeps the abstraction earned by a real second consumer.

**Files:**
- Create: `src/lib/apify-client.ts`
- Delete: `src/x-monitor/apify-client.ts`
- Modify: `src/domain/x-monitor/run-x-monitor.ts`
- Modify: `src/scripts/run-x-monitor.ts`
- Modify: `tests/x-monitor/apify-client.test.ts` → `tests/lib/apify-client.test.ts`
- Modify: `tests/x-monitor/run-x-monitor.test.ts`

- [ ] **Step 1.1: Write the failing test for the generalized client**

Create `tests/lib/apify-client.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { createApifyClient } from "../../src/lib/apify-client.js";

function makeResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("createApifyClient.runActor", () => {
  it("posts to the run-sync endpoint for the supplied actorId and returns the JSON array", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      makeResponse([{ id: "1" }, { id: "2" }]),
    );
    const client = createApifyClient({ token: "apify_test_token", fetchImpl });

    const items = await client.runActor("danek~twitter-scraper-ppr", {
      max_posts: 10,
      query: "(from:jupiterexchange) since:2026-04-20_00:00:00_UTC",
      search_type: "Latest",
    });

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
    expect(init!.body).toBe(
      JSON.stringify({
        max_posts: 10,
        query: "(from:jupiterexchange) since:2026-04-20_00:00:00_UTC",
        search_type: "Latest",
      }),
    );
  });

  it("accepts a different actorId and a different input shape (LinkedIn use case)", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(makeResponse([]));
    const client = createApifyClient({ token: "t", fetchImpl });

    await client.runActor("harvestapi/linkedin-profile-posts", {
      targetUrls: ["https://www.linkedin.com/in/williamhgates"],
      postedLimitDate: "2026-04-29T12:00:00.000Z",
      includeReposts: false,
      includeQuotePosts: false,
      maxPosts: 50,
    });

    const [url] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.apify.com/v2/acts/harvestapi/linkedin-profile-posts/run-sync-get-dataset-items",
    );
  });

  it("throws a descriptive error when the actor returns a non-2xx status", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("rate_limited", { status: 429 }));
    const client = createApifyClient({ token: "t", fetchImpl });

    await expect(client.runActor("a", {})).rejects.toThrow(/429/);
  });

  it("throws when the response body isn't a JSON array", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(makeResponse({ not: "an array" }));
    const client = createApifyClient({ token: "t", fetchImpl });

    await expect(client.runActor("a", {})).rejects.toThrow(/array/i);
  });
});
```

- [ ] **Step 1.2: Run the new test, expect failure**

Run: `npx vitest run tests/lib/apify-client.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/apify-client.js'`.

- [ ] **Step 1.3: Implement the generalized client**

Create `src/lib/apify-client.ts`:

```ts
export interface ApifyClient {
  runActor<TInput>(actorId: string, input: TInput): Promise<unknown[]>;
}

export interface CreateApifyClientOptions {
  token: string;
  fetchImpl?: typeof fetch;
}

const APIFY_BASE = "https://api.apify.com/v2";

export function createApifyClient(options: CreateApifyClientOptions): ApifyClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async runActor(actorId, input) {
      const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items`;
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

- [ ] **Step 1.4: Run the new test, expect pass**

Run: `npx vitest run tests/lib/apify-client.test.ts`
Expected: PASS — all four cases.

- [ ] **Step 1.5: Update `runXMonitor` to use the generalized client**

The X monitor currently calls `context.apify.runSyncGetDatasetItems(...)`. Replace it with `context.apify.runActor(context.apifyActorId, ...)` and add `apifyActorId` to the context.

Modify `src/domain/x-monitor/run-x-monitor.ts`:

Replace the import block:

```ts
import type { ApifyClient } from "../../lib/apify-client.js";
```

(Remove the old `import type { ApifyClient } from "../../x-monitor/apify-client.js";`)

Replace the `MonitorContext` interface:

```ts
export interface MonitorContext {
  apify: ApifyClient;
  apifyActorId: string;
  createRaid: (input: CreateRaidInput, ctx: CreateRaidContext) => Promise<RaidPost>;
  slackClient: SlackClientLike;
  config?: readonly XClient[];
  now?: () => Date;
  logger?: Pick<typeof defaultLogger, "info" | "warn" | "error">;
}
```

Replace the Apify call inside `runXMonitor`:

```ts
const rawItems = await context.apify.runActor(context.apifyActorId, {
  max_posts: MAX_POSTS,
  query,
  search_type: "Latest",
});
```

- [ ] **Step 1.6: Update the existing X monitor test for the new context shape**

Modify `tests/x-monitor/run-x-monitor.test.ts`:

Replace every `apify: { runSyncGetDatasetItems: vi.fn().mockResolvedValue(...) }` with `apify: { runActor: vi.fn().mockResolvedValue(...) }`.

Wherever the test calls `runXMonitor(..., { apify, createRaid, slackClient: ..., now: ... })`, add `apifyActorId: "danek~twitter-scraper-ppr"`. Example:

```ts
const result = await runXMonitor(
  { dryRun: false },
  {
    apify,
    apifyActorId: "danek~twitter-scraper-ppr",
    createRaid,
    slackClient: {} as never,
    now: () => now,
  },
);
```

The "computes a since-window" test already inspects `apify.runSyncGetDatasetItems.mock.calls`. Update both occurrences to `apify.runActor.mock.calls`. The `runActor` mock receives `(actorId, input)`, so destructure `[, input]`:

```ts
const [, input] = apify.runActor.mock.calls[0]!;
expect(input.query).toContain("since:2026-04-20_12:25:40_UTC");
expect(input.query).toContain("from:meanwhile");
```

- [ ] **Step 1.7: Run the X monitor test, expect pass**

Run: `npx vitest run tests/x-monitor/run-x-monitor.test.ts`
Expected: PASS — six tests.

- [ ] **Step 1.8: Update the script entry to wire the actorId via context**

Modify `src/scripts/run-x-monitor.ts`:

Replace the `runXMonitor` invocation:

```ts
import { createApifyClient } from "../lib/apify-client.js";
```

(Remove `import { createApifyClient } from "../x-monitor/apify-client.js";`)

```ts
const result = await run(
  { dryRun, sinceMinutes },
  {
    apify: createApifyClient({ token: env.APIFY_TOKEN }),
    apifyActorId: env.APIFY_X_MONITOR_ACTOR_ID,
    createRaid,
    slackClient: createSlackClient() as Parameters<typeof runXMonitor>[1]["slackClient"],
  },
);
```

- [ ] **Step 1.9: Migrate the X apify-client test, then delete the old wrapper**

The old `tests/x-monitor/apify-client.test.ts` covers the same behavior as the new `tests/lib/apify-client.test.ts`. Delete it:

```bash
rm tests/x-monitor/apify-client.test.ts
rm src/x-monitor/apify-client.ts
```

Verify nothing references the deleted module:

```bash
grep -rn "x-monitor/apify-client" src tests
```

Expected: no matches.

- [ ] **Step 1.10: Run the full test suite + typecheck**

Run: `npm run typecheck && npm test`
Expected: PASS for both.

- [ ] **Step 1.11: Commit**

```bash
git add src/lib/apify-client.ts src/domain/x-monitor/run-x-monitor.ts src/scripts/run-x-monitor.ts tests/lib/apify-client.test.ts tests/x-monitor/run-x-monitor.test.ts
git rm src/x-monitor/apify-client.ts tests/x-monitor/apify-client.test.ts
git commit -m "refactor: generalize Apify client to runActor for multi-platform reuse"
```

---

## Task 2: Widen `Platform` type to include `"linkedin"`

This is required before any new module can pass `platform: "linkedin"` to `createRaid` without a TS error.

**Files:**
- Modify: `src/domain/raids/types.ts`

- [ ] **Step 2.1: Edit `Platform`**

Modify `src/domain/raids/types.ts`:

```ts
export type Platform = "x" | "linkedin";
```

(All other declarations in the file are unchanged.)

- [ ] **Step 2.2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS. (No call site narrows on `"x"` exhaustively — the existing literal usages all assign or compare to `"x"` directly, which still type-checks.)

- [ ] **Step 2.3: Run the full test suite**

Run: `npm test`
Expected: PASS — no test depends on `Platform` being strictly `"x"`.

- [ ] **Step 2.4: Commit**

```bash
git add src/domain/raids/types.ts
git commit -m "feat: widen Platform type to include linkedin"
```

---

## Task 3: Add `APIFY_LINKEDIN_MONITOR_ACTOR_ID` env var

**Files:**
- Modify: `src/config/env.ts`

- [ ] **Step 3.1: Add the env field**

Modify `src/config/env.ts` to add `APIFY_LINKEDIN_MONITOR_ACTOR_ID` next to the existing X actor ID. The full diff in `envSchema`:

```ts
APIFY_X_MONITOR_ACTOR_ID: z.string().trim().min(1).default("danek~twitter-scraper-ppr"),
APIFY_LINKEDIN_MONITOR_ACTOR_ID: z
  .string()
  .trim()
  .min(1)
  .default("harvestapi/linkedin-profile-posts"),
```

- [ ] **Step 3.2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3.3: Commit**

```bash
git add src/config/env.ts
git commit -m "feat: add APIFY_LINKEDIN_MONITOR_ACTOR_ID env var"
```

---

## Task 4: Add `LinkedinClient` type and empty `LINKEDIN_CLIENTS` config

**Files:**
- Create: `src/config/linkedin-clients.ts`

- [ ] **Step 4.1: Create the config file**

Create `src/config/linkedin-clients.ts`:

```ts
export interface LinkedinClient {
  url: string;
  slug: string;
  clientName: string;
}

export const LINKEDIN_CLIENTS = [] as const satisfies readonly LinkedinClient[];
```

(The list ships empty so `monitor:linkedin` is a safe no-op until populated in a follow-up PR.)

- [ ] **Step 4.2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4.3: Commit**

```bash
git add src/config/linkedin-clients.ts
git commit -m "feat: add LinkedinClient type and empty config"
```

---

## Task 5: Add `LinkedinPostRecord` and `LinkedinMonitorResult` types

**Files:**
- Create: `src/domain/linkedin-monitor/types.ts`

- [ ] **Step 5.1: Create the types file**

Create `src/domain/linkedin-monitor/types.ts`:

```ts
export interface LinkedinPostRecord {
  postId: string;
  postUrl: string;
  authorSlug: string;
  authorDisplayName: string;
  authorUrl: string;
  createdAt: Date;
}

export interface LinkedinMonitorSinceWindow {
  from: Date;
  to: Date;
}

export interface LinkedinMonitorSkipCounts {
  unmapped: number;
  nonOriginal: number;
  malformed: number;
}

export interface LinkedinMonitorResult {
  postsFetched: number;
  raidsProcessed: number;
  skipped: LinkedinMonitorSkipCounts;
  failures: number;
  sinceWindow: LinkedinMonitorSinceWindow;
}
```

- [ ] **Step 5.2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5.3: Commit**

```bash
git add src/domain/linkedin-monitor/types.ts
git commit -m "feat: add LinkedinPostRecord and monitor result types"
```

---

## Task 6: `parsePostRecord` (TDD)

Defensive parsing of one Apify item. Mirrors `parseTweetRecord`.

**Files:**
- Create: `tests/linkedin-monitor/parse-post-record.test.ts`
- Create: `src/domain/linkedin-monitor/parse-post-record.ts`

- [ ] **Step 6.1: Write the failing test**

Create `tests/linkedin-monitor/parse-post-record.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parsePostRecord } from "../../src/domain/linkedin-monitor/parse-post-record.js";

describe("parsePostRecord", () => {
  const base = {
    type: "post",
    id: "7329207003942125568",
    linkedinUrl: "https://www.linkedin.com/posts/williamhgates_some-slug-7329207003942125568",
    author: {
      name: "Bill Gates",
      publicIdentifier: "williamhgates",
      linkedinUrl: "https://www.linkedin.com/in/williamhgates",
    },
    postedAt: {
      timestamp: 1747419119821,
      date: "2025-05-16T18:11:59.821Z",
    },
  };

  it("parses a well-formed profile post", () => {
    const parsed = parsePostRecord(base);

    expect(parsed).not.toBeNull();
    expect(parsed!.postId).toBe("7329207003942125568");
    expect(parsed!.postUrl).toBe(
      "https://www.linkedin.com/posts/williamhgates_some-slug-7329207003942125568",
    );
    expect(parsed!.authorSlug).toBe("williamhgates");
    expect(parsed!.authorDisplayName).toBe("Bill Gates");
    expect(parsed!.authorUrl).toBe("https://www.linkedin.com/in/williamhgates");
    expect(parsed!.createdAt.toISOString()).toBe("2025-05-16T18:11:59.821Z");
  });

  it("falls back to postedAt.timestamp (Unix ms) when postedAt.date is missing", () => {
    const { postedAt: _postedAt, ...rest } = base;
    const parsed = parsePostRecord({ ...rest, postedAt: { timestamp: 1747419119821 } });

    expect(parsed).not.toBeNull();
    expect(parsed!.createdAt.toISOString()).toBe("2025-05-16T18:11:59.821Z");
  });

  it("returns null when type is not 'post' (defends against repost/share rows)", () => {
    expect(parsePostRecord({ ...base, type: "repost" })).toBeNull();
    expect(parsePostRecord({ ...base, type: "share" })).toBeNull();
  });

  it("accepts items missing the type field — actor docs do not guarantee its presence", () => {
    const { type: _type, ...rest } = base;
    expect(parsePostRecord(rest)).not.toBeNull();
  });

  it("returns null when required fields are missing", () => {
    expect(parsePostRecord({})).toBeNull();
    expect(parsePostRecord({ ...base, id: undefined })).toBeNull();
    expect(parsePostRecord({ ...base, linkedinUrl: undefined })).toBeNull();
    expect(parsePostRecord({ ...base, author: undefined })).toBeNull();
    expect(parsePostRecord({ ...base, author: { name: "X" } })).toBeNull();
    expect(parsePostRecord({ ...base, postedAt: undefined })).toBeNull();
    expect(parsePostRecord({ ...base, postedAt: {} })).toBeNull();
  });

  it("returns null for an unparseable timestamp", () => {
    expect(
      parsePostRecord({ ...base, postedAt: { date: "not-a-date" } }),
    ).toBeNull();
  });

  it("lowercases the author slug for downstream case-insensitive matching", () => {
    const parsed = parsePostRecord({
      ...base,
      author: { ...base.author, publicIdentifier: "WilliamHGates" },
    });

    expect(parsed!.authorSlug).toBe("williamhgates");
  });
});
```

- [ ] **Step 6.2: Run the test, expect failure**

Run: `npx vitest run tests/linkedin-monitor/parse-post-record.test.ts`
Expected: FAIL — `Cannot find module ... parse-post-record.js`.

- [ ] **Step 6.3: Implement `parsePostRecord`**

Create `src/domain/linkedin-monitor/parse-post-record.ts`:

```ts
import type { LinkedinPostRecord } from "./types.js";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function parseCreatedAt(postedAt: Record<string, unknown>): Date | null {
  const dateRaw = postedAt.date;
  if (typeof dateRaw === "string" && dateRaw.length > 0) {
    const parsed = new Date(dateRaw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
    return null;
  }

  const timestampRaw = postedAt.timestamp;
  if (typeof timestampRaw === "number" && Number.isFinite(timestampRaw)) {
    const parsed = new Date(timestampRaw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

export function parsePostRecord(raw: unknown): LinkedinPostRecord | null {
  if (!isObject(raw)) {
    return null;
  }

  if ("type" in raw && raw.type !== undefined && raw.type !== "post") {
    return null;
  }

  const postId = raw.id;
  const postUrl = raw.linkedinUrl;
  const author = raw.author;
  const postedAt = raw.postedAt;

  if (!isNonEmptyString(postId)) return null;
  if (!isNonEmptyString(postUrl)) return null;
  if (!isObject(author)) return null;
  if (!isObject(postedAt)) return null;

  const authorSlug = author.publicIdentifier;
  const authorName = author.name;
  const authorUrl = author.linkedinUrl;

  if (!isNonEmptyString(authorSlug)) return null;
  if (!isNonEmptyString(authorName)) return null;
  if (!isNonEmptyString(authorUrl)) return null;

  const createdAt = parseCreatedAt(postedAt);
  if (!createdAt) return null;

  return {
    postId,
    postUrl,
    authorSlug: authorSlug.toLowerCase(),
    authorDisplayName: authorName,
    authorUrl,
    createdAt,
  };
}
```

- [ ] **Step 6.4: Run the test, expect pass**

Run: `npx vitest run tests/linkedin-monitor/parse-post-record.test.ts`
Expected: PASS — eight cases.

- [ ] **Step 6.5: Commit**

```bash
git add src/domain/linkedin-monitor/parse-post-record.ts tests/linkedin-monitor/parse-post-record.test.ts
git commit -m "feat: parse linkedin post records from harvestapi output"
```

---

## Task 7: `filterOriginalPosts` (TDD)

Defense-in-depth pass-through. The actor's `includeReposts: false` + `includeQuotePosts: false` flags are the primary filter; this function exists so output-shape filters can be added once we observe live data.

**Files:**
- Create: `tests/linkedin-monitor/filter-posts.test.ts`
- Create: `src/domain/linkedin-monitor/filter-posts.ts`

- [ ] **Step 7.1: Write the failing test**

Create `tests/linkedin-monitor/filter-posts.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { filterOriginalPosts } from "../../src/domain/linkedin-monitor/filter-posts.js";
import type { LinkedinPostRecord } from "../../src/domain/linkedin-monitor/types.js";

function make(overrides: Partial<LinkedinPostRecord> = {}): LinkedinPostRecord {
  return {
    postId: "1",
    postUrl: "https://www.linkedin.com/posts/u_post-1",
    authorSlug: "u",
    authorDisplayName: "U",
    authorUrl: "https://www.linkedin.com/in/u",
    createdAt: new Date("2026-04-29T12:00:00.000Z"),
    ...overrides,
  };
}

describe("filterOriginalPosts", () => {
  it("passes records through unchanged (parser already drops non-post types)", () => {
    const records = [make(), make({ postId: "2" })];
    expect(filterOriginalPosts(records)).toEqual(records);
  });

  it("returns an empty array unchanged", () => {
    expect(filterOriginalPosts([])).toEqual([]);
  });
});
```

- [ ] **Step 7.2: Run the test, expect failure**

Run: `npx vitest run tests/linkedin-monitor/filter-posts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7.3: Implement `filterOriginalPosts`**

Create `src/domain/linkedin-monitor/filter-posts.ts`:

```ts
import type { LinkedinPostRecord } from "./types.js";

export function filterOriginalPosts(
  records: readonly LinkedinPostRecord[],
): LinkedinPostRecord[] {
  return [...records];
}
```

- [ ] **Step 7.4: Run the test, expect pass**

Run: `npx vitest run tests/linkedin-monitor/filter-posts.test.ts`
Expected: PASS.

- [ ] **Step 7.5: Commit**

```bash
git add src/domain/linkedin-monitor/filter-posts.ts tests/linkedin-monitor/filter-posts.test.ts
git commit -m "feat: add filterOriginalPosts placeholder for defense-in-depth"
```

---

## Task 8: `mapAuthorToClientName` (TDD)

Match a post's author against `LINKEDIN_CLIENTS`. Two-step: slug equality first, URL prefix fallback second. The URL fallback uses `===` or `startsWith(url + "/")` to avoid `linkedin.com/in/foo` false-positiving against `linkedin.com/in/foobar`.

**Files:**
- Create: `tests/linkedin-monitor/map-client-name.test.ts`
- Create: `src/domain/linkedin-monitor/map-client-name.ts`

- [ ] **Step 8.1: Write the failing test**

Create `tests/linkedin-monitor/map-client-name.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { mapAuthorToClientName } from "../../src/domain/linkedin-monitor/map-client-name.js";
import type { LinkedinClient } from "../../src/config/linkedin-clients.js";
import type { LinkedinPostRecord } from "../../src/domain/linkedin-monitor/types.js";

const clients: readonly LinkedinClient[] = [
  {
    url: "https://www.linkedin.com/in/williamhgates",
    slug: "williamhgates",
    clientName: "Bill Gates",
  },
  {
    url: "https://www.linkedin.com/company/microsoft",
    slug: "microsoft",
    clientName: "Microsoft",
  },
];

function record(overrides: Partial<LinkedinPostRecord> = {}): LinkedinPostRecord {
  return {
    postId: "1",
    postUrl: "https://www.linkedin.com/posts/u_post-1",
    authorSlug: "williamhgates",
    authorDisplayName: "Bill Gates",
    authorUrl: "https://www.linkedin.com/in/williamhgates",
    createdAt: new Date("2026-04-29T12:00:00.000Z"),
    ...overrides,
  };
}

describe("mapAuthorToClientName", () => {
  it("matches by author slug (case-insensitive)", () => {
    expect(mapAuthorToClientName(record({ authorSlug: "williamhgates" }), clients)).toBe(
      "Bill Gates",
    );
    expect(mapAuthorToClientName(record({ authorSlug: "WilliamHGates" }), clients)).toBe(
      "Bill Gates",
    );
  });

  it("falls back to author URL exact match when slug doesn't match", () => {
    const result = mapAuthorToClientName(
      record({
        authorSlug: "different-internal-id",
        authorUrl: "https://www.linkedin.com/company/microsoft",
      }),
      clients,
    );

    expect(result).toBe("Microsoft");
  });

  it("falls back to author URL prefix match (handles trailing path segments)", () => {
    const result = mapAuthorToClientName(
      record({
        authorSlug: "different-internal-id",
        authorUrl: "https://www.linkedin.com/company/microsoft/posts",
      }),
      clients,
    );

    expect(result).toBe("Microsoft");
  });

  it("does NOT false-positive on substring overlap", () => {
    const result = mapAuthorToClientName(
      record({
        authorSlug: "williamhgatesfoundation",
        authorUrl: "https://www.linkedin.com/in/williamhgatesfoundation",
      }),
      clients,
    );

    expect(result).toBeUndefined();
  });

  it("normalizes trailing slashes in the URL fallback", () => {
    const result = mapAuthorToClientName(
      record({
        authorSlug: "different-internal-id",
        authorUrl: "https://www.linkedin.com/company/microsoft/",
      }),
      clients,
    );

    expect(result).toBe("Microsoft");
  });

  it("is case-insensitive in the URL fallback", () => {
    const result = mapAuthorToClientName(
      record({
        authorSlug: "different-internal-id",
        authorUrl: "https://WWW.LINKEDIN.COM/company/Microsoft",
      }),
      clients,
    );

    expect(result).toBe("Microsoft");
  });

  it("returns undefined when no client matches", () => {
    const result = mapAuthorToClientName(
      record({
        authorSlug: "nobody",
        authorUrl: "https://www.linkedin.com/in/nobody",
      }),
      clients,
    );

    expect(result).toBeUndefined();
  });
});
```

- [ ] **Step 8.2: Run the test, expect failure**

Run: `npx vitest run tests/linkedin-monitor/map-client-name.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 8.3: Implement `mapAuthorToClientName`**

Create `src/domain/linkedin-monitor/map-client-name.ts`:

```ts
import type { LinkedinClient } from "../../config/linkedin-clients.js";
import type { LinkedinPostRecord } from "./types.js";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function mapAuthorToClientName(
  record: LinkedinPostRecord,
  clients: readonly LinkedinClient[],
): string | undefined {
  const slugLower = record.authorSlug.toLowerCase();
  const slugMatch = clients.find((client) => client.slug.toLowerCase() === slugLower);
  if (slugMatch) {
    return slugMatch.clientName;
  }

  const authorUrlNormalized = stripTrailingSlash(record.authorUrl.toLowerCase());

  for (const client of clients) {
    const clientUrlNormalized = stripTrailingSlash(client.url.toLowerCase());
    if (
      authorUrlNormalized === clientUrlNormalized ||
      authorUrlNormalized.startsWith(`${clientUrlNormalized}/`)
    ) {
      return client.clientName;
    }
  }

  return undefined;
}
```

- [ ] **Step 8.4: Run the test, expect pass**

Run: `npx vitest run tests/linkedin-monitor/map-client-name.test.ts`
Expected: PASS — seven cases.

- [ ] **Step 8.5: Commit**

```bash
git add src/domain/linkedin-monitor/map-client-name.ts tests/linkedin-monitor/map-client-name.test.ts
git commit -m "feat: map post authors to LINKEDIN_CLIENTS by slug and URL prefix"
```

---

## Task 9: `buildLinkedinApifyInput` (TDD)

Pure function that produces the structured input for `harvestapi/linkedin-profile-posts`.

**Files:**
- Create: `tests/linkedin-monitor/build-apify-input.test.ts`
- Create: `src/domain/linkedin-monitor/build-apify-input.ts`

- [ ] **Step 9.1: Write the failing test**

Create `tests/linkedin-monitor/build-apify-input.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildLinkedinApifyInput } from "../../src/domain/linkedin-monitor/build-apify-input.js";

describe("buildLinkedinApifyInput", () => {
  it("emits targetUrls, postedLimitDate (ISO), filter flags, and maxPosts", () => {
    const input = buildLinkedinApifyInput(
      [
        "https://www.linkedin.com/in/williamhgates",
        "https://www.linkedin.com/company/microsoft",
      ],
      new Date("2026-04-29T12:30:40.000Z"),
    );

    expect(input).toEqual({
      targetUrls: [
        "https://www.linkedin.com/in/williamhgates",
        "https://www.linkedin.com/company/microsoft",
      ],
      postedLimitDate: "2026-04-29T12:30:40.000Z",
      includeReposts: false,
      includeQuotePosts: false,
      maxPosts: 50,
    });
  });

  it("throws on empty URL list to prevent a no-op fetch", () => {
    expect(() => buildLinkedinApifyInput([], new Date())).toThrow(/url list/i);
  });

  it("preserves URL ordering and does not lowercase URLs (the actor expects them as-is)", () => {
    const input = buildLinkedinApifyInput(
      ["https://www.linkedin.com/in/CamelCaseUser"],
      new Date("2026-04-29T00:00:00.000Z"),
    );

    expect(input.targetUrls).toEqual(["https://www.linkedin.com/in/CamelCaseUser"]);
  });
});
```

- [ ] **Step 9.2: Run the test, expect failure**

Run: `npx vitest run tests/linkedin-monitor/build-apify-input.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 9.3: Implement `buildLinkedinApifyInput`**

Create `src/domain/linkedin-monitor/build-apify-input.ts`:

```ts
export interface LinkedinApifyInput {
  targetUrls: string[];
  postedLimitDate: string;
  includeReposts: false;
  includeQuotePosts: false;
  maxPosts: number;
}

const MAX_POSTS = 50;

export function buildLinkedinApifyInput(
  urls: readonly string[],
  since: Date,
): LinkedinApifyInput {
  if (urls.length === 0) {
    throw new Error("buildLinkedinApifyInput requires a non-empty URL list.");
  }

  return {
    targetUrls: [...urls],
    postedLimitDate: since.toISOString(),
    includeReposts: false,
    includeQuotePosts: false,
    maxPosts: MAX_POSTS,
  };
}
```

- [ ] **Step 9.4: Run the test, expect pass**

Run: `npx vitest run tests/linkedin-monitor/build-apify-input.test.ts`
Expected: PASS.

- [ ] **Step 9.5: Commit**

```bash
git add src/domain/linkedin-monitor/build-apify-input.ts tests/linkedin-monitor/build-apify-input.test.ts
git commit -m "feat: build harvestapi linkedin-profile-posts input"
```

---

## Task 10: `runLinkedinMonitor` orchestrator (TDD)

The orchestrator. Uses the same `Context`-injection pattern as `runXMonitor`.

**Files:**
- Create: `tests/linkedin-monitor/run-linkedin-monitor.test.ts`
- Create: `src/domain/linkedin-monitor/run-linkedin-monitor.ts`

- [ ] **Step 10.1: Write the failing test**

Create `tests/linkedin-monitor/run-linkedin-monitor.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("runLinkedinMonitor", () => {
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
      APIFY_LINKEDIN_MONITOR_ACTOR_ID: "harvestapi/linkedin-profile-posts",
    };
    vi.resetModules();
  });

  const now = new Date("2026-04-29T12:30:40.000Z");

  const validPost = {
    type: "post",
    id: "post-1",
    linkedinUrl: "https://www.linkedin.com/posts/williamhgates_post-1",
    author: {
      name: "Bill Gates",
      publicIdentifier: "williamhgates",
      linkedinUrl: "https://www.linkedin.com/in/williamhgates",
    },
    postedAt: {
      timestamp: 1745930540000,
      date: "2026-04-29T12:29:00.000Z",
    },
  };

  const testClients = [
    {
      url: "https://www.linkedin.com/in/williamhgates",
      slug: "williamhgates",
      clientName: "Bill Gates",
    },
  ] as const;

  it("processes an empty dataset cleanly", async () => {
    const { runLinkedinMonitor } = await import(
      "../../src/domain/linkedin-monitor/run-linkedin-monitor.js"
    );
    const createRaid = vi.fn();
    const apify = { runActor: vi.fn().mockResolvedValue([]) };

    const result = await runLinkedinMonitor(
      { dryRun: false },
      {
        apify,
        apifyActorId: "harvestapi/linkedin-profile-posts",
        createRaid,
        slackClient: {} as never,
        config: testClients,
        now: () => now,
      },
    );

    expect(result.postsFetched).toBe(0);
    expect(result.raidsProcessed).toBe(0);
    expect(result.failures).toBe(0);
    expect(apify.runActor).toHaveBeenCalledOnce();
    expect(createRaid).not.toHaveBeenCalled();
  });

  it("skips when LINKEDIN_CLIENTS is empty without calling Apify (no-op)", async () => {
    const { runLinkedinMonitor } = await import(
      "../../src/domain/linkedin-monitor/run-linkedin-monitor.js"
    );
    const apify = { runActor: vi.fn().mockResolvedValue([]) };

    const result = await runLinkedinMonitor(
      { dryRun: false },
      {
        apify,
        apifyActorId: "harvestapi/linkedin-profile-posts",
        createRaid: vi.fn(),
        slackClient: {} as never,
        config: [],
        now: () => now,
      },
    );

    expect(apify.runActor).not.toHaveBeenCalled();
    expect(result.postsFetched).toBe(0);
    expect(result.raidsProcessed).toBe(0);
  });

  it("creates raids for originals, skips malformed and unmapped", async () => {
    const { runLinkedinMonitor } = await import(
      "../../src/domain/linkedin-monitor/run-linkedin-monitor.js"
    );
    const createRaid = vi
      .fn()
      .mockImplementation(async (input) => ({ id: "raid-" + input.sourceEventId }));
    const apify = {
      runActor: vi.fn().mockResolvedValue([
        validPost,
        { nothing: "useful" },
        {
          ...validPost,
          id: "post-3",
          author: {
            ...validPost.author,
            publicIdentifier: "unknown",
            linkedinUrl: "https://www.linkedin.com/in/unknown",
          },
        },
      ]),
    };

    const result = await runLinkedinMonitor(
      { dryRun: false },
      {
        apify,
        apifyActorId: "harvestapi/linkedin-profile-posts",
        createRaid,
        slackClient: {} as never,
        config: testClients,
        now: () => now,
      },
    );

    expect(result.postsFetched).toBe(3);
    expect(result.raidsProcessed).toBe(1);
    expect(result.skipped.malformed).toBe(1);
    expect(result.skipped.unmapped).toBe(1);
    expect(createRaid).toHaveBeenCalledOnce();
    expect(createRaid).toHaveBeenCalledWith(
      expect.objectContaining({
        postUrl: validPost.linkedinUrl,
        clientName: "Bill Gates",
        platform: "linkedin",
        sourceEventId: "post-1",
        createdBySlackUserId: "linkedin-monitor",
        ownerExternalId: "williamhgates",
        ownerDisplayName: "Bill Gates",
      }),
      expect.any(Object),
    );
  });

  it("continues after a createRaid failure and reports failures count", async () => {
    const { runLinkedinMonitor } = await import(
      "../../src/domain/linkedin-monitor/run-linkedin-monitor.js"
    );
    const createRaid = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new Error("boom");
      })
      .mockImplementationOnce(async (input) => ({ id: "raid-" + input.sourceEventId }));
    const apify = {
      runActor: vi.fn().mockResolvedValue([validPost, { ...validPost, id: "post-2" }]),
    };

    const result = await runLinkedinMonitor(
      { dryRun: false },
      {
        apify,
        apifyActorId: "harvestapi/linkedin-profile-posts",
        createRaid,
        slackClient: {} as never,
        config: testClients,
        now: () => now,
      },
    );

    expect(result.failures).toBe(1);
    expect(result.raidsProcessed).toBe(1);
    expect(createRaid).toHaveBeenCalledTimes(2);
  });

  it("dry-run skips createRaid entirely", async () => {
    const { runLinkedinMonitor } = await import(
      "../../src/domain/linkedin-monitor/run-linkedin-monitor.js"
    );
    const createRaid = vi.fn();
    const apify = { runActor: vi.fn().mockResolvedValue([validPost]) };

    const result = await runLinkedinMonitor(
      { dryRun: true },
      {
        apify,
        apifyActorId: "harvestapi/linkedin-profile-posts",
        createRaid,
        slackClient: {} as never,
        config: testClients,
        now: () => now,
      },
    );

    expect(createRaid).not.toHaveBeenCalled();
    expect(result.raidsProcessed).toBe(0);
    expect(result.postsFetched).toBe(1);
  });

  it("computes a since-window covering the last 7 minutes from now() and forwards target URLs", async () => {
    const { runLinkedinMonitor } = await import(
      "../../src/domain/linkedin-monitor/run-linkedin-monitor.js"
    );
    const apify = { runActor: vi.fn().mockResolvedValue([]) };

    const result = await runLinkedinMonitor(
      { dryRun: false },
      {
        apify,
        apifyActorId: "harvestapi/linkedin-profile-posts",
        createRaid: vi.fn(),
        slackClient: {} as never,
        config: testClients,
        now: () => now,
      },
    );

    expect(result.sinceWindow.to.toISOString()).toBe("2026-04-29T12:30:40.000Z");
    expect(result.sinceWindow.from.toISOString()).toBe("2026-04-29T12:23:40.000Z");
    const [actorId, input] = apify.runActor.mock.calls[0]!;
    expect(actorId).toBe("harvestapi/linkedin-profile-posts");
    expect(input.postedLimitDate).toBe("2026-04-29T12:23:40.000Z");
    expect(input.targetUrls).toEqual(["https://www.linkedin.com/in/williamhgates"]);
    expect(input.includeReposts).toBe(false);
    expect(input.includeQuotePosts).toBe(false);
  });

  it("respects an explicit sinceMinutes override", async () => {
    const { runLinkedinMonitor } = await import(
      "../../src/domain/linkedin-monitor/run-linkedin-monitor.js"
    );
    const apify = { runActor: vi.fn().mockResolvedValue([]) };

    const result = await runLinkedinMonitor(
      { dryRun: false, sinceMinutes: 30 },
      {
        apify,
        apifyActorId: "harvestapi/linkedin-profile-posts",
        createRaid: vi.fn(),
        slackClient: {} as never,
        config: testClients,
        now: () => now,
      },
    );

    expect(result.sinceWindow.from.toISOString()).toBe("2026-04-29T12:00:40.000Z");
  });
});
```

- [ ] **Step 10.2: Run the test, expect failure**

Run: `npx vitest run tests/linkedin-monitor/run-linkedin-monitor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 10.3: Implement `runLinkedinMonitor`**

Create `src/domain/linkedin-monitor/run-linkedin-monitor.ts`:

```ts
import { LINKEDIN_CLIENTS, type LinkedinClient } from "../../config/linkedin-clients.js";
import { logger as defaultLogger } from "../../lib/logger.js";
import type { ApifyClient } from "../../lib/apify-client.js";
import { buildLinkedinApifyInput } from "./build-apify-input.js";
import { filterOriginalPosts } from "./filter-posts.js";
import { mapAuthorToClientName } from "./map-client-name.js";
import { parsePostRecord } from "./parse-post-record.js";
import type { LinkedinMonitorResult, LinkedinPostRecord } from "./types.js";
import type {
  CreateRaidContext,
  CreateRaidInput,
  SlackClientLike,
} from "../raids/create-raid.js";
import type { RaidPost } from "../raids/types.js";

const DEFAULT_SINCE_WINDOW_MINUTES = 7;
const MONITOR_CREATED_BY = "linkedin-monitor";

export interface LinkedinMonitorContext {
  apify: ApifyClient;
  apifyActorId: string;
  createRaid: (input: CreateRaidInput, ctx: CreateRaidContext) => Promise<RaidPost>;
  slackClient: SlackClientLike;
  config?: readonly LinkedinClient[];
  now?: () => Date;
  logger?: Pick<typeof defaultLogger, "info" | "warn" | "error">;
}

export async function runLinkedinMonitor(
  params: { dryRun?: boolean; sinceMinutes?: number },
  context: LinkedinMonitorContext,
): Promise<LinkedinMonitorResult> {
  const clients = context.config ?? LINKEDIN_CLIENTS;
  const logger = context.logger ?? defaultLogger;
  const now = context.now ? context.now() : new Date();
  const windowMinutes = params.sinceMinutes ?? DEFAULT_SINCE_WINDOW_MINUTES;
  const since = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const result: LinkedinMonitorResult = {
    postsFetched: 0,
    raidsProcessed: 0,
    skipped: { unmapped: 0, nonOriginal: 0, malformed: 0 },
    failures: 0,
    sinceWindow: { from: since, to: now },
  };

  if (clients.length === 0) {
    logger.info({ result }, "linkedin-monitor: no clients configured — skipping fetch");
    return result;
  }

  const input = buildLinkedinApifyInput(
    clients.map((client) => client.url),
    since,
  );

  const rawItems = await context.apify.runActor(context.apifyActorId, input);
  result.postsFetched = rawItems.length;

  const parsed: LinkedinPostRecord[] = [];
  for (const item of rawItems) {
    const record = parsePostRecord(item);
    if (!record) {
      result.skipped.malformed += 1;
      logger.warn({ item }, "linkedin-monitor: skipping malformed Apify item");
      continue;
    }
    parsed.push(record);
  }

  const originals = filterOriginalPosts(parsed);
  result.skipped.nonOriginal = parsed.length - originals.length;

  for (const post of originals) {
    const clientName = mapAuthorToClientName(post, clients);
    if (!clientName) {
      result.skipped.unmapped += 1;
      logger.warn(
        { authorSlug: post.authorSlug, postId: post.postId },
        "linkedin-monitor: author is not in LINKEDIN_CLIENTS — skipping",
      );
      continue;
    }

    const raidInput: CreateRaidInput = {
      postUrl: post.postUrl,
      clientName,
      platform: "linkedin",
      publishedAt: post.createdAt,
      createdBySlackUserId: MONITOR_CREATED_BY,
      sourceEventId: post.postId,
      ownerExternalId: post.authorSlug,
      ownerDisplayName: post.authorDisplayName,
      ownerSlackUserId: null,
    };

    if (params.dryRun) {
      logger.info({ raidInput }, "linkedin-monitor dry-run: would create raid");
      continue;
    }

    try {
      await context.createRaid(raidInput, { client: context.slackClient });
      result.raidsProcessed += 1;
    } catch (error) {
      result.failures += 1;
      logger.error(
        { err: error, postId: post.postId, clientName },
        "linkedin-monitor: createRaid threw — continuing with remaining posts",
      );
    }
  }

  logger.info({ result }, "linkedin-monitor run complete");

  return result;
}
```

- [ ] **Step 10.4: Run the test, expect pass**

Run: `npx vitest run tests/linkedin-monitor/run-linkedin-monitor.test.ts`
Expected: PASS — seven cases.

- [ ] **Step 10.5: Commit**

```bash
git add src/domain/linkedin-monitor/run-linkedin-monitor.ts tests/linkedin-monitor/run-linkedin-monitor.test.ts
git commit -m "feat: orchestrator for linkedin monitor"
```

---

## Task 11: `runLinkedinMonitorCommand` CLI script (TDD)

CLI entry mirroring `run-x-monitor.ts`.

**Files:**
- Create: `tests/scripts/run-linkedin-monitor.test.ts`
- Create: `src/scripts/run-linkedin-monitor.ts`

- [ ] **Step 11.1: Write the failing test**

Create `tests/scripts/run-linkedin-monitor.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("runLinkedinMonitorCommand", () => {
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
      APIFY_LINKEDIN_MONITOR_ACTOR_ID: "harvestapi/linkedin-profile-posts",
    };
    vi.resetModules();
  });

  it("parses --dry-run and forwards dryRun=true", async () => {
    const { runLinkedinMonitorCommand } = await import(
      "../../src/scripts/run-linkedin-monitor.js"
    );
    const runLinkedinMonitor = vi.fn().mockResolvedValue({
      postsFetched: 0,
      raidsProcessed: 0,
      skipped: { unmapped: 0, nonOriginal: 0, malformed: 0 },
      failures: 0,
      sinceWindow: { from: new Date(), to: new Date() },
    });
    const stdout = { log: vi.fn() };

    const exit = await runLinkedinMonitorCommand(["--dry-run"], {
      runLinkedinMonitor,
      stdout,
    });

    expect(runLinkedinMonitor).toHaveBeenCalledWith({ dryRun: true }, expect.any(Object));
    expect(exit).toBe(0);
  });

  it("parses --since-minutes=N and forwards it", async () => {
    const { runLinkedinMonitorCommand } = await import(
      "../../src/scripts/run-linkedin-monitor.js"
    );
    const runLinkedinMonitor = vi.fn().mockResolvedValue({
      postsFetched: 0,
      raidsProcessed: 0,
      skipped: { unmapped: 0, nonOriginal: 0, malformed: 0 },
      failures: 0,
      sinceWindow: { from: new Date(), to: new Date() },
    });

    await runLinkedinMonitorCommand(["--since-minutes=15"], {
      runLinkedinMonitor,
      stdout: { log: vi.fn() },
    });

    expect(runLinkedinMonitor).toHaveBeenCalledWith(
      { dryRun: false, sinceMinutes: 15 },
      expect.any(Object),
    );
  });

  it("returns exit code 0 on zero failures", async () => {
    const { runLinkedinMonitorCommand } = await import(
      "../../src/scripts/run-linkedin-monitor.js"
    );
    const runLinkedinMonitor = vi.fn().mockResolvedValue({
      postsFetched: 1,
      raidsProcessed: 1,
      skipped: { unmapped: 0, nonOriginal: 0, malformed: 0 },
      failures: 0,
      sinceWindow: { from: new Date(), to: new Date() },
    });

    const exit = await runLinkedinMonitorCommand([], {
      runLinkedinMonitor,
      stdout: { log: vi.fn() },
    });

    expect(exit).toBe(0);
  });

  it("returns exit code 1 when any raid failed", async () => {
    const { runLinkedinMonitorCommand } = await import(
      "../../src/scripts/run-linkedin-monitor.js"
    );
    const runLinkedinMonitor = vi.fn().mockResolvedValue({
      postsFetched: 2,
      raidsProcessed: 1,
      skipped: { unmapped: 0, nonOriginal: 0, malformed: 0 },
      failures: 1,
      sinceWindow: { from: new Date(), to: new Date() },
    });

    const exit = await runLinkedinMonitorCommand([], {
      runLinkedinMonitor,
      stdout: { log: vi.fn() },
    });

    expect(exit).toBe(1);
  });
});
```

- [ ] **Step 11.2: Run the test, expect failure**

Run: `npx vitest run tests/scripts/run-linkedin-monitor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 11.3: Implement the CLI**

Create `src/scripts/run-linkedin-monitor.ts`:

```ts
#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { env } from "../config/env.js";
import { closeSql } from "../db/sql.js";
import { createRaid } from "../domain/raids/create-raid.js";
import { runLinkedinMonitor } from "../domain/linkedin-monitor/run-linkedin-monitor.js";
import { createApifyClient } from "../lib/apify-client.js";
import { createSlackClient } from "../slack/client.js";

export interface RunLinkedinMonitorCommandDependencies {
  runLinkedinMonitor?: typeof runLinkedinMonitor;
  stdout?: Pick<typeof console, "log">;
}

function parseDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

function parseSinceMinutes(argv: string[]): number | undefined {
  const arg = argv.find((a) => a.startsWith("--since-minutes="));
  if (!arg) return undefined;
  const value = parseInt(arg.split("=")[1], 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export async function runLinkedinMonitorCommand(
  argv: string[],
  dependencies: RunLinkedinMonitorCommandDependencies = {},
): Promise<number> {
  const dryRun = parseDryRun(argv);
  const sinceMinutes = parseSinceMinutes(argv);
  const run = dependencies.runLinkedinMonitor ?? runLinkedinMonitor;
  const stdout = dependencies.stdout ?? console;

  const result = await run(
    { dryRun, sinceMinutes },
    {
      apify: createApifyClient({ token: env.APIFY_TOKEN }),
      apifyActorId: env.APIFY_LINKEDIN_MONITOR_ACTOR_ID,
      createRaid,
      slackClient: createSlackClient() as Parameters<typeof runLinkedinMonitor>[1]["slackClient"],
    },
  );

  stdout.log(
    `linkedin-monitor${dryRun ? " (dry-run)" : ""}: fetched=${result.postsFetched} processed=${result.raidsProcessed} failures=${result.failures} skipped.nonOriginal=${result.skipped.nonOriginal} skipped.unmapped=${result.skipped.unmapped} skipped.malformed=${result.skipped.malformed}`,
  );

  return result.failures === 0 ? 0 : 1;
}

async function main() {
  const code = await runLinkedinMonitorCommand(process.argv.slice(2));
  process.exitCode = code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown linkedin-monitor failure.";
    console.error(`linkedin-monitor failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await closeSql({ timeout: 0 });
  }
}
```

- [ ] **Step 11.4: Run the test, expect pass**

Run: `npx vitest run tests/scripts/run-linkedin-monitor.test.ts`
Expected: PASS — four cases.

- [ ] **Step 11.5: Commit**

```bash
git add src/scripts/run-linkedin-monitor.ts tests/scripts/run-linkedin-monitor.test.ts
git commit -m "feat: linkedin-monitor CLI entry"
```

---

## Task 12: Widen publish webhook to accept `platform: "linkedin"`

**Files:**
- Modify: `src/app/publish-webhook.ts`
- Modify: `tests/raids/publish-webhook.test.ts`

- [ ] **Step 12.1: Write the failing test addition**

Add at the end of the existing `describe("handlePublishWebhookRequest", ...)` block in `tests/raids/publish-webhook.test.ts`, before its closing `})`:

```ts
  it("routes valid linkedin payloads through createRaid", async () => {
    const { handlePublishWebhookRequest, PUBLISH_WEBHOOK_SECRET_HEADER } = await import(
      "../../src/app/publish-webhook.js"
    );
    const createRaid = vi.fn().mockResolvedValue({
      id: "raid-li-1",
      timingConfidence: "high",
    });

    const response = await handlePublishWebhookRequest(
      {
        headers: {
          [PUBLISH_WEBHOOK_SECRET_HEADER]: "publish-secret",
        },
        bodyText: JSON.stringify({
          post_url: "https://www.linkedin.com/posts/williamhgates_some-post-7329207003942125568",
          client_name: "Bill Gates",
          platform: "linkedin",
          published_at: "2026-04-29T12:00:00.000Z",
          source_event_id: "7329207003942125568",
          owner_external_id: "williamhgates",
        }),
      },
      {
        createRaid,
        context: {
          client: {
            chat: {
              postMessage: vi.fn(),
            },
          },
        },
      },
    );

    expect(createRaid).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "linkedin",
        sourceEventId: "7329207003942125568",
        ownerExternalId: "williamhgates",
      }),
      expect.any(Object),
    );
    expect(response.status).toBe(200);
  });
```

- [ ] **Step 12.2: Run the test, expect failure**

Run: `npx vitest run tests/raids/publish-webhook.test.ts -t "linkedin"`
Expected: FAIL — payload validation rejects `platform: "linkedin"` (currently `z.literal("x")`).

- [ ] **Step 12.3: Widen the schema**

Modify `src/app/publish-webhook.ts` — change the `platform` line in `publishWebhookPayloadSchema`:

```ts
platform: z.enum(["x", "linkedin"]),
```

- [ ] **Step 12.4: Run the test, expect pass**

Run: `npx vitest run tests/raids/publish-webhook.test.ts`
Expected: PASS — the new test plus all existing webhook tests.

- [ ] **Step 12.5: Commit**

```bash
git add src/app/publish-webhook.ts tests/raids/publish-webhook.test.ts
git commit -m "feat: webhook accepts platform=linkedin"
```

---

## Task 13: Widen manual `/raid` modal & input parser for LinkedIn

The modal gains a second platform option and the URL pattern expands to accept four LinkedIn URL forms.

**Files:**
- Modify: `src/slack/commands/build-raid-modal.ts`
- Modify: `src/domain/raids/manual-raid-input.ts`
- Modify: `tests/raid/raid-modal.test.ts`

- [ ] **Step 13.1: Write the failing modal-shape test addition**

The existing `buildRaidModal` test asserts the platform options match `[{ text: { text: "X" }, value: "x" }]`. Update the assertion to expect both X and LinkedIn options, in that order, with X as the initial selection.

In `tests/raid/raid-modal.test.ts`, find:

```ts
        element: {
          type: "static_select",
          options: [{ text: { text: "X" }, value: "x" }],
        },
```

Replace with:

```ts
        element: {
          type: "static_select",
          options: [
            { text: { text: "X" }, value: "x" },
            { text: { text: "LinkedIn" }, value: "linkedin" },
          ],
        },
```

- [ ] **Step 13.2: Write failing input-parser test additions**

The existing rejection of `https://linkedin.com/posts/impact3-123` with `platformValue: "x"` (default) **stays** — when a LinkedIn URL is pasted with platform=X, the X-URL pattern still fails and returns "Use a valid X post URL." That behavior is unchanged.

In `tests/raid/raid-modal.test.ts`, add a new `it(...)` block at the end of the `parseManualRaidInput` describe (before its closing `})`):

```ts
  it("accepts the four supported LinkedIn URL forms when platform=linkedin", () => {
    const now = new Date("2026-04-29T16:00:00.000Z");

    for (const postUrl of [
      "https://www.linkedin.com/in/williamhgates/recent-activity/all",
      "https://linkedin.com/company/microsoft/posts",
      "https://www.linkedin.com/posts/williamhgates_some-shareable-text-7329207003942125568",
      "https://www.linkedin.com/feed/update/urn:li:activity:7329207003942125568",
    ]) {
      const result = parseManualRaidInput(
        buildViewState({ postUrl, platformValue: "linkedin" }),
        { now },
      );

      expect(result).toEqual({
        ok: true,
        data: {
          postUrl,
          clientName: "Impact3",
          platform: "linkedin",
          publishedAt: null,
        },
      });
    }
  });

  it("rejects non-LinkedIn URLs when platform=linkedin", () => {
    const now = new Date("2026-04-29T16:00:00.000Z");

    expect(
      parseManualRaidInput(
        buildViewState({
          postUrl: "https://x.com/impact3/status/1234567890",
          platformValue: "linkedin",
        }),
        { now },
      ),
    ).toEqual({
      ok: false,
      errors: {
        [RAID_MODAL_FIELD_IDS.postUrl.blockId]: "Use a valid LinkedIn post URL.",
      },
    });

    expect(
      parseManualRaidInput(
        buildViewState({
          postUrl: "https://www.linkedin.com/jobs/view/123",
          platformValue: "linkedin",
        }),
        { now },
      ),
    ).toEqual({
      ok: false,
      errors: {
        [RAID_MODAL_FIELD_IDS.postUrl.blockId]: "Use a valid LinkedIn post URL.",
      },
    });
  });

  it("rejects an unknown platform value", () => {
    const now = new Date("2026-04-29T16:00:00.000Z");

    const result = parseManualRaidInput(
      buildViewState({ platformValue: "facebook" }),
      { now },
    );

    expect(result).toEqual({
      ok: false,
      errors: {
        [RAID_MODAL_FIELD_IDS.platform.blockId]: "Platform must be X or LinkedIn.",
      },
    });
  });
```

- [ ] **Step 13.3: Run the tests, expect failure**

Run: `npx vitest run tests/raid/raid-modal.test.ts`
Expected: FAIL — modal options don't include LinkedIn; LinkedIn URL pattern doesn't exist; platform check still says "Platform must be X."

- [ ] **Step 13.4: Update the modal**

Modify `src/slack/commands/build-raid-modal.ts` — in the platform `static_select` element, replace the `options` and remove the `initial_option`-vs-options shape duplication. Update both the `options` list and `initial_option`:

```ts
        element: {
          type: "static_select",
          action_id: RAID_MODAL_FIELD_IDS.platform.actionId,
          options: [
            {
              text: {
                type: "plain_text",
                text: "X",
              },
              value: "x",
            },
            {
              text: {
                type: "plain_text",
                text: "LinkedIn",
              },
              value: "linkedin",
            },
          ],
          initial_option: {
            text: {
              type: "plain_text",
              text: "X",
            },
            value: "x",
          },
        },
```

- [ ] **Step 13.5: Update the input parser**

Modify `src/domain/raids/manual-raid-input.ts`:

Replace the X URL pattern constant with platform-specific patterns:

```ts
const X_POST_URL_PATTERN =
  /^https:\/\/(?:x|twitter)\.com\/[^/?#]+\/status\/[A-Za-z0-9_]+(?:[/?#].*)?$/i;

const LINKEDIN_POST_URL_PATTERN =
  /^https:\/\/(?:www\.)?linkedin\.com\/(?:in\/[^/?#]+|company\/[^/?#]+|posts\/[^/?#]+|feed\/update\/urn:li:activity:[A-Za-z0-9_]+)(?:[/?#].*)?$/i;
```

Replace the `selectedPlatform !== "x"` check and the URL validation block:

```ts
  const platformIsValid = selectedPlatform === "x" || selectedPlatform === "linkedin";

  if (!platformIsValid) {
    errors[RAID_MODAL_FIELD_IDS.platform.blockId] = "Platform must be X or LinkedIn.";
  } else if (selectedPlatform === "x" && !X_POST_URL_PATTERN.test(postUrl)) {
    errors[RAID_MODAL_FIELD_IDS.postUrl.blockId] = "Use a valid X post URL.";
  } else if (selectedPlatform === "linkedin" && !LINKEDIN_POST_URL_PATTERN.test(postUrl)) {
    errors[RAID_MODAL_FIELD_IDS.postUrl.blockId] = "Use a valid LinkedIn post URL.";
  }
```

(Remove the previous `if (!X_POST_URL_PATTERN.test(postUrl)) { ... }` and `if (selectedPlatform !== "x") { ... }` blocks.)

Update the `data` returned in the success branch to use the parsed platform:

```ts
  return {
    ok: true,
    data: {
      postUrl,
      clientName,
      platform: selectedPlatform as Platform,
      publishedAt,
    },
  };
```

- [ ] **Step 13.6: Run the tests, expect pass**

Run: `npx vitest run tests/raid/raid-modal.test.ts`
Expected: PASS.

- [ ] **Step 13.7: Run the manual raid flow tests to confirm no regression**

Run: `npx vitest run tests/raid/manual-raid-flow.test.ts`
Expected: PASS — the existing flow tests use `platformValue: "x"` and still work.

- [ ] **Step 13.8: Commit**

```bash
git add src/slack/commands/build-raid-modal.ts src/domain/raids/manual-raid-input.ts tests/raid/raid-modal.test.ts
git commit -m "feat: manual /raid accepts LinkedIn URLs and platform"
```

---

## Task 14: Add `monitor:linkedin` npm script

**Files:**
- Modify: `package.json`

- [ ] **Step 14.1: Add the script**

Modify `package.json`. After the `"monitor:x"` line in `"scripts"`, add:

```json
    "monitor:linkedin": "tsx src/scripts/run-linkedin-monitor.ts",
```

- [ ] **Step 14.2: Verify the script exists**

Run: `npm run monitor:linkedin -- --dry-run --since-minutes=1`
Expected: exits 0, logs `linkedin-monitor (dry-run): fetched=0 processed=0 failures=0 skipped.nonOriginal=0 skipped.unmapped=0 skipped.malformed=0` (because `LINKEDIN_CLIENTS` ships empty, and the orchestrator short-circuits without calling Apify).

If you don't have a populated `.env`, set the minimum required variables inline:

```bash
DATABASE_URL=postgres://localhost/raider_bot \
  SLACK_BOT_TOKEN=test SLACK_SIGNING_SECRET=test \
  SLACK_RAID_CHANNEL_ID=C SLACK_RAID_OPERATOR_USER_IDS=U \
  PUBLISH_WEBHOOK_SHARED_SECRET=s APIFY_TOKEN=t \
  npm run monitor:linkedin -- --dry-run --since-minutes=1
```

- [ ] **Step 14.3: Commit**

```bash
git add package.json
git commit -m "feat: monitor:linkedin npm script"
```

---

## Task 15: Update `CLAUDE.md` scope rule

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 15.1: Edit the design rules section**

Modify `CLAUDE.md`. Find the line:

```markdown
- Launch scope is X only; keep LinkedIn parity out until the core loop is validated.
```

Replace with:

```markdown
- Launch scope covers X and LinkedIn. LinkedIn was added 2026-04-29 after the X pilot validated; both platforms use the same scoring windows, the same Slack channel, and the same scoring invariants.
```

Also update the **Project** description if it references X-only intent — find:

```markdown
**Raider Bot** is a Slack app for Impact3 that turns newly published client social posts (currently X) into time-sensitive "raid" prompts.
```

Replace `(currently X)` with `(X and LinkedIn)`:

```markdown
**Raider Bot** is a Slack app for Impact3 that turns newly published client social posts (X and LinkedIn) into time-sensitive "raid" prompts.
```

- [ ] **Step 15.2: Verify no other X-only language remains in CLAUDE.md**

Run: `grep -n "X only\|X-only\|currently X\|LinkedIn parity out" CLAUDE.md`
Expected: no matches.

- [ ] **Step 15.3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md scope now covers X and LinkedIn"
```

---

## Task 16: Update pilot-launch-runbook with the LinkedIn cron and env

**Files:**
- Modify: `docs/pilot-launch-runbook.md`

- [ ] **Step 16.1: Add LinkedIn-specific runbook entries**

Modify `docs/pilot-launch-runbook.md`:

In the **Optional** env section (under `### Required env vars`), add a line after `APIFY_X_MONITOR_ACTOR_ID`:

```markdown
- `APIFY_LINKEDIN_MONITOR_ACTOR_ID` — Apify actor slug (defaults to `harvestapi/linkedin-profile-posts`).
```

In the **Scheduled Tasks** table, add a row after the X tweet monitor row:

```markdown
| LinkedIn post monitor | `*/5 * * * *` | `npm run monitor:linkedin` |
```

In **Scheduled Job Commands**, add to the bash block after `npm run monitor:x`:

```bash
npm run monitor:linkedin
```

In **Operational Notes**, add a bullet:

```markdown
- LinkedIn raids land in the same `SLACK_RAID_CHANNEL_ID` as X. To populate the LinkedIn account list, edit `src/config/linkedin-clients.ts` and redeploy. Apify cost is expected to stay under $5/month at current volumes.
```

- [ ] **Step 16.2: Commit**

```bash
git add docs/pilot-launch-runbook.md
git commit -m "docs: runbook covers LinkedIn cron and env"
```

---

## Task 17: Final verification

**Files:** none (verification only)

- [ ] **Step 17.1: Typecheck the whole project**

Run: `npm run typecheck`
Expected: PASS — zero errors.

- [ ] **Step 17.2: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests, including the new LinkedIn-monitor tests, the updated X-monitor tests, the new LinkedIn webhook test, and the updated modal tests.

- [ ] **Step 17.3: Verify no orphaned imports of the old X apify-client**

Run: `grep -rn "x-monitor/apify-client" src tests`
Expected: no matches.

- [ ] **Step 17.4: Verify the empty-config no-op**

Run: `npm run monitor:linkedin -- --dry-run --since-minutes=1`
Expected: exit 0, logs `fetched=0 processed=0 failures=0`. (Provide test env vars inline as in Task 14.2 if needed.)

- [ ] **Step 17.5: Confirm git status is clean**

Run: `git status`
Expected: "nothing to commit, working tree clean".

---

## Out of scope (intentional follow-ups, not in this plan)

- Populating `LINKEDIN_CLIENTS` with the user-provided list of profile and company URLs.
- Adding the Coolify Scheduled Task entry.
- Adding LinkedIn slugs to existing team-member alias rows for self-raid filtering.
- Live smoke-test against harvestapi to confirm the company-page author shape and dial in the author-matching fallback if surprises surface.
