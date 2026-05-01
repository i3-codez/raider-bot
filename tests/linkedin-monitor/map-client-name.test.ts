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
