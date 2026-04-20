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
