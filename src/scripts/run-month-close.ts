#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { closeSql } from "../db/sql.js";
import { runMonthCloseJob } from "../jobs/run-month-close.js";

export interface RunMonthCloseCommandDependencies {
  runMonthCloseJob?: typeof runMonthCloseJob;
  stdout?: Pick<typeof console, "log">;
}

function parseTargetMonthKey(argv: string[]): string | undefined {
  return argv.find((argument) => argument.startsWith("--month="))?.split("=", 2)[1]?.trim();
}

function parseDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

export async function runMonthCloseCommand(
  argv: string[],
  dependencies: RunMonthCloseCommandDependencies = {},
): Promise<void> {
  const dryRun = parseDryRun(argv);
  const targetMonthKey = parseTargetMonthKey(argv);
  const result = await (dependencies.runMonthCloseJob ?? runMonthCloseJob)({
    dryRun,
    targetMonthKey,
  });
  const logger = dependencies.stdout ?? console;

  logger.log(
    `${dryRun ? "Dry run generated" : "Completed"} month close for ${result.monthKey}: ${result.label}`,
  );
}

async function main() {
  await runMonthCloseCommand(process.argv.slice(2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown month-close failure.";
    console.error(`Month close failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await closeSql({ timeout: 0 });
  }
}
