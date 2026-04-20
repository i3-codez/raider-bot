import { describe, expect, it } from "vitest";

import { buildRaidMessage } from "../../src/slack/blocks/build-raid-message.js";

describe("buildRaidMessage", () => {
  it("renders the one-line prompt with client name and the post URL", () => {
    const message = buildRaidMessage({
      clientName: "Impact3",
      platform: "x",
      postUrl: "https://x.com/impact3/status/123",
      timingConfidence: "high",
      referenceTime: new Date("2026-04-10T16:00:00.000Z"),
    });

    expect(message.blocks).toHaveLength(1);
    expect(message.blocks[0]).toMatchObject({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "New post from *Impact3* just shipped: go go go! <https://x.com/impact3/status/123>",
      },
    });

    expect(message.text).toBe(
      "New post from Impact3 just shipped: go go go! https://x.com/impact3/status/123",
    );
  });

  it("renders the same shape regardless of timingConfidence (display no longer depends on it)", () => {
    const low = buildRaidMessage({
      clientName: "Impact3",
      platform: "x",
      postUrl: "https://x.com/impact3/status/123",
      timingConfidence: "low",
      referenceTime: new Date("2026-04-10T16:00:00.000Z"),
    });
    const high = buildRaidMessage({
      clientName: "Impact3",
      platform: "x",
      postUrl: "https://x.com/impact3/status/123",
      timingConfidence: "high",
      referenceTime: new Date("2026-04-10T16:00:00.000Z"),
    });

    expect(low).toEqual(high);
    const serialized = JSON.stringify(low);
    expect(serialized).not.toContain("Published time not provided");
    expect(serialized).not.toContain("How to participate");
    expect(serialized).not.toContain("Speed windows");
    expect(serialized).not.toContain("Published:");
  });
});
