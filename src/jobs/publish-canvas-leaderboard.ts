import { env } from "../config/env.js";
import {
  getCanvasLeaderboardReport,
  type CanvasLeaderboardReport,
  type GetCanvasLeaderboardDependencies,
} from "../domain/reporting/canvas-leaderboard.js";
import {
  buildLeaderboardCanvasMarkdown,
  CANVAS_MANAGED_MARKER,
} from "../slack/canvas/build-leaderboard-canvas.js";
import type {
  SlackCanvasChange,
  SlackCanvasClient,
} from "../slack/client.js";
import {
  resolveUserNames,
  type SlackUsersInfoClient,
} from "../slack/lib/resolve-user-names.js";

export interface PublishCanvasLeaderboardParams {
  dryRun?: boolean;
  now?: Date;
  limit?: number;
}

export interface PublishCanvasLeaderboardDependencies
  extends GetCanvasLeaderboardDependencies {
  client?: SlackCanvasClient & SlackUsersInfoClient;
  resolveCanvasId?: () => string | undefined;
  resolveUserNames?: typeof resolveUserNames;
}

export type CanvasLeaderboardAction = "replaced" | "inserted" | "skipped";

export interface PublishCanvasLeaderboardResult {
  canvasId: string;
  dryRun: boolean;
  markdown: string;
  report: CanvasLeaderboardReport;
  action: CanvasLeaderboardAction;
  replacedSectionCount: number;
}

function resolveCanvasId(): string | undefined {
  return env.SLACK_LEADERBOARD_CANVAS_ID;
}

export async function publishCanvasLeaderboard(
  params: PublishCanvasLeaderboardParams = {},
  dependencies: PublishCanvasLeaderboardDependencies = {},
): Promise<PublishCanvasLeaderboardResult> {
  const canvasId = (dependencies.resolveCanvasId ?? resolveCanvasId)();
  const dryRun = params.dryRun ?? false;

  if (!canvasId && !dryRun) {
    throw new Error(
      "SLACK_LEADERBOARD_CANVAS_ID must be set before publishing the canvas leaderboard.",
    );
  }

  const report = await getCanvasLeaderboardReport(
    {
      now: params.now,
      limit: params.limit,
    },
    dependencies,
  );

  const unresolvedIds = report.entries
    .filter((entry) => entry.displayName === entry.slackUserId)
    .map((entry) => entry.slackUserId);

  let nameOverrides: Map<string, string> | undefined;
  if (unresolvedIds.length > 0 && dependencies.client) {
    const resolver = dependencies.resolveUserNames ?? resolveUserNames;
    nameOverrides = await resolver(dependencies.client, unresolvedIds);
  }

  const { markdown } = buildLeaderboardCanvasMarkdown(report, nameOverrides);

  if (dryRun) {
    return {
      canvasId: canvasId ?? "",
      dryRun,
      markdown,
      report,
      action: "skipped",
      replacedSectionCount: 0,
    };
  }

  if (!dependencies.client) {
    throw new Error(
      "A Slack canvas client is required when publishing the leaderboard canvas live.",
    );
  }

  if (!canvasId) {
    throw new Error(
      "SLACK_LEADERBOARD_CANVAS_ID must be set before publishing the canvas leaderboard.",
    );
  }

  const { sections } = await dependencies.client.canvases.sections.lookup({
    canvas_id: canvasId,
    criteria: { contains_text: CANVAS_MANAGED_MARKER },
  });

  for (const section of sections) {
    await dependencies.client.canvases.edit({
      canvas_id: canvasId,
      changes: [{ operation: "delete", section_id: section.id }],
    });
  }

  await dependencies.client.canvases.edit({
    canvas_id: canvasId,
    changes: [
      {
        operation: "insert_at_end",
        document_content: { type: "markdown", markdown },
      },
    ],
  });

  return {
    canvasId,
    dryRun,
    markdown,
    report,
    action: sections.length > 0 ? "replaced" : "inserted",
    replacedSectionCount: sections.length,
  };
}
