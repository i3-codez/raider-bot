#!/usr/bin/env node

import { closeSql } from "../db/sql.js";
import { publishSummaryJob } from "../jobs/publish-summary.js";
import { createSlackClient } from "../slack/client.js";
import type { SummaryCadence } from "../lib/time.js";

const ALLOWED_CADENCES = new Set<SummaryCadence>(["daily", "weekly", "monthly"]);

export interface RunSummaryJobCommandDependencies {
  publishSummaryJob?: typeof publishSummaryJob;
  createSlackClient?: typeof createSlackClient;
  stdout?: Pick<typeof console, "log">;
}

function parseCadence(argv: string[]): SummaryCadence {
  const rawCadence = argv
    .find((argument) => argument.startsWith("--cadence="))
    ?.split("=", 2)[1]
    ?.trim() as SummaryCadence | undefined;

  if (!rawCadence || !ALLOWED_CADENCES.has(rawCadence)) {
    throw new Error("Missing or invalid --cadence value. Use daily, weekly, or monthly.");
  }

  return rawCadence;
}

function parseDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

export async function runSummaryJobCommand(
  argv: string[],
  dependencies: RunSummaryJobCommandDependencies = {},
): Promise<void> {
  const cadence = parseCadence(argv);
  const dryRun = parseDryRun(argv);
  const result = await (dependencies.publishSummaryJob ?? publishSummaryJob)(
    {
      cadence,
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
    `${dryRun ? "Dry run generated" : "Published"} ${cadence} summary for ${result.channelId}: ${result.report.window.label}`,
  );
  logger.log(result.payload.text);
}

async function main() {
  await runSummaryJobCommand(process.argv.slice(2));
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown summary job failure.";
  console.error(`Summary job failed: ${message}`);
  process.exitCode = 1;
} finally {
  await closeSql({ timeout: 0 });
}
