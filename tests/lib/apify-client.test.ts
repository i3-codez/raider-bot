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
