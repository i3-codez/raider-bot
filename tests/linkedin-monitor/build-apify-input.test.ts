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
