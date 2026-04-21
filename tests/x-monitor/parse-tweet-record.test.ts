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
    expect(parsed!.authorHandle).toBe("jupiterexchange");
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

  it("parses Apify actor format (tweet_id, user_info, no url)", () => {
    const apifyItem = {
      type: "tweet",
      tweet_id: "2046599632843591907",
      screen_name: "Enlivex",
      created_at: "Tue Apr 21 14:39:11 +0000 2026",
      text: "Another key milestone",
      user_info: { screen_name: "Enlivex", name: "Enlivex" },
    };

    const parsed = parseTweetRecord(apifyItem);

    expect(parsed).not.toBeNull();
    expect(parsed!.tweetId).toBe("2046599632843591907");
    expect(parsed!.tweetUrl).toBe("https://x.com/enlivex/status/2046599632843591907");
    expect(parsed!.authorHandle).toBe("enlivex");
    expect(parsed!.authorName).toBe("Enlivex");
    expect(parsed!.isRetweet).toBe(false);
    expect(parsed!.isReply).toBe(false);
  });
});
