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
