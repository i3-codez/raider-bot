#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { closeSql } from "../db/sql.js";
import { runSummaryJobCommand } from "./run-summary-job.js";
import { runMonthCloseCommand } from "./run-month-close.js";
import { runOpsSurfacingCommand } from "./run-ops-surfacing.js";

export interface RunPilotCheckDependencies {
  runSummaryJobCommand?: typeof runSummaryJobCommand;
  runMonthCloseCommand?: typeof runMonthCloseCommand;
  runOpsSurfacingCommand?: typeof runOpsSurfacingCommand;
  stdout?: Pick<typeof console, "log">;
}

function assertCommand<T>(value: T | undefined, label: string): T {
  if (!value) {
    throw new Error(`Pilot check requires ${label} to be available.`);
  }

  return value;
}

export async function runPilotCheck(
  dependencies: RunPilotCheckDependencies = {},
): Promise<void> {
  const runSummary = assertCommand(
    dependencies.runSummaryJobCommand ?? runSummaryJobCommand,
    "runSummaryJobCommand",
  );
  const runMonthClose = assertCommand(
    dependencies.runMonthCloseCommand ?? runMonthCloseCommand,
    "runMonthCloseCommand",
  );
  const runOpsSurfacing = assertCommand(
    dependencies.runOpsSurfacingCommand ?? runOpsSurfacingCommand,
    "runOpsSurfacingCommand",
  );
  const stdout = dependencies.stdout ?? console;

  await runSummary(["--cadence=daily", "--dry-run"], { stdout });
  await runSummary(["--cadence=weekly", "--dry-run"], { stdout });
  await runSummary(["--cadence=monthly", "--dry-run"], { stdout });
  await runMonthClose(["--dry-run"], { stdout });
  await runOpsSurfacing(["--dry-run"], { stdout });

  stdout.log("Pilot check passed: summary, month-close, and ops dry-run flows all completed.");
}

async function main() {
  await runPilotCheck();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pilot-check failure.";
    console.error(`Pilot check failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await closeSql({ timeout: 0 });
  }
}
