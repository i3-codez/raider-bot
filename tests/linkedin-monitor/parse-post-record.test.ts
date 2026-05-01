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
