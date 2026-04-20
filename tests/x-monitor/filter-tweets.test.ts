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
