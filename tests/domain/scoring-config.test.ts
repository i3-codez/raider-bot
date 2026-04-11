import { describe, expect, it } from "vitest";

import type { Platform, RaidTimingConfidence } from "../../src/domain/raids/types.js";
import { ACTION_REGISTRY } from "../../src/domain/scoring/action-registry.js";
import { SCORING_WINDOWS } from "../../src/domain/scoring/scoring-config.js";
import type { ActionType, ScoringWindowLabel } from "../../src/domain/scoring/types.js";

describe("shared scoring contracts", () => {
  it("exports the canonical five scoring windows", () => {
    expect(SCORING_WINDOWS).toEqual([
      { label: "0-10m", minMinutes: 0, maxMinutesExclusive: 10, points: 10 },
      { label: "10-20m", minMinutes: 10, maxMinutesExclusive: 20, points: 8 },
      { label: "20-30m", minMinutes: 20, maxMinutesExclusive: 30, points: 6 },
      { label: "30-60m", minMinutes: 30, maxMinutesExclusive: 60, points: 3 },
      { label: "60m+", minMinutes: 60, maxMinutesExclusive: null, points: 0 },
    ]);
  });

  it("exports the canonical Slack emoji registry", () => {
    expect(ACTION_REGISTRY).toEqual([
      { emoji: "heart", actionType: "like", label: "Like" },
      { emoji: "speech_balloon", actionType: "comment", label: "Comment" },
      { emoji: "repeat", actionType: "repost", label: "Repost" },
      { emoji: "memo", actionType: "quote_post", label: "Quote post" },
    ]);
  });

  it("exposes the shared Phase 1 type unions", () => {
    const platform: Platform = "x";
    const timingConfidence: RaidTimingConfidence[] = ["high", "low"];
    const actionTypes: ActionType[] = ["like", "comment", "repost", "quote_post"];
    const scoringWindowLabels: ScoringWindowLabel[] = [
      "0-10m",
      "10-20m",
      "20-30m",
      "30-60m",
      "60m+",
    ];

    expect(platform).toBe("x");
    expect(timingConfidence).toEqual(["high", "low"]);
    expect(actionTypes).toEqual(["like", "comment", "repost", "quote_post"]);
    expect(scoringWindowLabels).toEqual(["0-10m", "10-20m", "20-30m", "30-60m", "60m+"]);
  });
});
