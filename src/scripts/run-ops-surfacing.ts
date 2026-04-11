#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { closeSql } from "../db/sql.js";
import { publishOpsSurfacing } from "../jobs/publish-ops-surfacing.js";
import { createSlackClient } from "../slack/client.js";

export interface RunOpsSurfacingCommandDependencies {
  publishOpsSurfacing?: typeof publishOpsSurfacing;
  createSlackClient?: typeof createSlackClient;
  stdout?: Pick<typeof console, "log">;
}

function parseDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

export async function runOpsSurfacingCommand(
  argv: string[],
  dependencies: RunOpsSurfacingCommandDependencies = {},
): Promise<void> {
  const dryRun = parseDryRun(argv);
  const result = await (dependencies.publishOpsSurfacing ?? publishOpsSurfacing)(
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
    `${dryRun ? "Dry run generated" : "Published"} ops digest for ${result.channelId} with ${result.digest.alerts.length} alerts.`,
  );
}

async function main() {
  await runOpsSurfacingCommand(process.argv.slice(2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ops surfacing failure.";
    console.error(`Ops surfacing failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await closeSql({ timeout: 0 });
  }
}
