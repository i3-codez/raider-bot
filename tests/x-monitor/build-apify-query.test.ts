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
