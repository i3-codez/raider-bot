import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CANVAS_MANAGED_MARKER } from "../../src/slack/canvas/build-leaderboard-canvas.js";

const originalEnv = { ...process.env };

function baseEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    ...originalEnv,
    DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/raider_bot",
    SLACK_BOT_TOKEN: "xoxb-test-token",
    SLACK_SIGNING_SECRET: "test-signing-secret",
    SLACK_RAID_CHANNEL_ID: "C_RAIDS",
    SLACK_RAID_OPERATOR_USER_IDS: "U_OPERATOR",
    PUBLISH_WEBHOOK_SHARED_SECRET: "publish-secret",
    RAIDER_EXCLUDE_SELF_RAIDS: "false",
    APIFY_TOKEN: "test-apify-token",
    SLACK_LEADERBOARD_CANVAS_ID: "F_CANVAS",
    ...overrides,
  };
}

function stubLeaderboard() {
  return vi.fn().mockResolvedValue([
    {
      slackUserId: "U1",
      displayName: "Alice",
      totalPoints: 150,
      uniqueRaidsEngaged: 12,
      earlyWindowActions: 9,
      totalActions: 14,
    },
    {
      slackUserId: "U2",
      displayName: "Bob",
      totalPoints: 120,
      uniqueRaidsEngaged: 10,
      earlyWindowActions: 7,
      totalActions: 11,
    },
  ]);
}

describe("publishCanvasLeaderboard", () => {
  beforeEach(() => {
    process.env = baseEnv();
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it("deletes existing managed sections then appends fresh content", async () => {
    const { publishCanvasLeaderboard } = await import(
      "../../src/jobs/publish-canvas-leaderboard.js"
    );
    const edit = vi.fn().mockResolvedValue(undefined);
    const lookup = vi
      .fn()
      .mockResolvedValue({ sections: [{ id: "SEC_1" }, { id: "SEC_STALE" }] });

    const result = await publishCanvasLeaderboard(
      {},
      {
        queryMonthlyLeaderboard: stubLeaderboard(),
        client: {
          canvases: {
            edit,
            sections: { lookup },
          },
        },
      },
    );

    expect(result.action).toBe("replaced");
    expect(result.canvasId).toBe("F_CANVAS");
    expect(result.replacedSectionCount).toBe(2);
    expect(lookup).toHaveBeenCalledWith({
      canvas_id: "F_CANVAS",
      criteria: { contains_text: CANVAS_MANAGED_MARKER },
    });
    expect(edit).toHaveBeenNthCalledWith(1, {
      canvas_id: "F_CANVAS",
      changes: [{ operation: "delete", section_id: "SEC_1" }],
    });
    expect(edit).toHaveBeenNthCalledWith(2, {
      canvas_id: "F_CANVAS",
      changes: [{ operation: "delete", section_id: "SEC_STALE" }],
    });
    expect(edit).toHaveBeenNthCalledWith(3, {
      canvas_id: "F_CANVAS",
      changes: [
        {
          operation: "insert_at_end",
          document_content: {
            type: "markdown",
            markdown: result.markdown,
          },
        },
      ],
    });
    expect(result.markdown).toContain("Alice");
    expect(result.markdown).toContain(CANVAS_MANAGED_MARKER);
  });

  it("inserts a new section on first run when no managed section exists", async () => {
    const { publishCanvasLeaderboard } = await import(
      "../../src/jobs/publish-canvas-leaderboard.js"
    );
    const edit = vi.fn().mockResolvedValue(undefined);
    const lookup = vi.fn().mockResolvedValue({ sections: [] });

    const result = await publishCanvasLeaderboard(
      {},
      {
        queryMonthlyLeaderboard: stubLeaderboard(),
        client: {
          canvases: {
            edit,
            sections: { lookup },
          },
        },
      },
    );

    expect(result.action).toBe("inserted");
    expect(edit).toHaveBeenCalledWith({
      canvas_id: "F_CANVAS",
      changes: [
        {
          operation: "insert_at_end",
          document_content: {
            type: "markdown",
            markdown: result.markdown,
          },
        },
      ],
    });
  });

  it("skips Slack calls in dry-run mode", async () => {
    const { publishCanvasLeaderboard } = await import(
      "../../src/jobs/publish-canvas-leaderboard.js"
    );
    const edit = vi.fn();
    const lookup = vi.fn();

    const result = await publishCanvasLeaderboard(
      { dryRun: true },
      {
        queryMonthlyLeaderboard: stubLeaderboard(),
        client: {
          canvases: {
            edit,
            sections: { lookup },
          },
        },
      },
    );

    expect(result.dryRun).toBe(true);
    expect(result.action).toBe("skipped");
    expect(edit).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
    expect(result.markdown).toContain("Alice");
  });

  it("throws when the canvas id is missing in live mode", async () => {
    process.env = baseEnv({ SLACK_LEADERBOARD_CANVAS_ID: undefined });
    vi.resetModules();
    const { publishCanvasLeaderboard } = await import(
      "../../src/jobs/publish-canvas-leaderboard.js"
    );

    await expect(
      publishCanvasLeaderboard(
        {},
        {
          queryMonthlyLeaderboard: stubLeaderboard(),
          client: {
            canvases: {
              edit: vi.fn(),
              sections: { lookup: vi.fn() },
            },
          },
        },
      ),
    ).rejects.toThrow(/SLACK_LEADERBOARD_CANVAS_ID/);
  });

  it("renders a placeholder row when the leaderboard is empty", async () => {
    const { publishCanvasLeaderboard } = await import(
      "../../src/jobs/publish-canvas-leaderboard.js"
    );

    const result = await publishCanvasLeaderboard(
      { dryRun: true },
      {
        queryMonthlyLeaderboard: vi.fn().mockResolvedValue([]),
      },
    );

    expect(result.markdown).toContain("No scored activity yet");
  });
});
