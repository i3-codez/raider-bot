#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { closeSql } from "../db/sql.js";
import { publishCanvasLeaderboard } from "../jobs/publish-canvas-leaderboard.js";
import { createSlackClient } from "../slack/client.js";

export interface RunCanvasLeaderboardCommandDependencies {
  publishCanvasLeaderboard?: typeof publishCanvasLeaderboard;
  createSlackClient?: typeof createSlackClient;
  stdout?: Pick<typeof console, "log">;
}

function parseDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

export async function runCanvasLeaderboardCommand(
  argv: string[],
  dependencies: RunCanvasLeaderboardCommandDependencies = {},
): Promise<void> {
  const dryRun = parseDryRun(argv);
  const result = await (dependencies.publishCanvasLeaderboard ?? publishCanvasLeaderboard)(
    {
      dryRun,
    },
    dryRun
      ? {}
      : {
          client: (dependencies.createSlackClient ?? createSlackClient)(),
        },
  );
  const logger = dependencies.stdout ?? console;

  logger.log(
    `${dryRun ? "Dry run generated" : "Published"} leaderboard canvas${
      result.canvasId ? ` ${result.canvasId}` : ""
    } (${result.action}, ${result.replacedSectionCount} managed section${
      result.replacedSectionCount === 1 ? "" : "s"
    } found).`,
  );
  logger.log(result.markdown);
}

async function main() {
  await runCanvasLeaderboardCommand(process.argv.slice(2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown canvas leaderboard failure.";
    console.error(`Canvas leaderboard failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await closeSql({ timeout: 0 });
  }
}
