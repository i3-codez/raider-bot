#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { env } from "../config/env.js";
import { closeSql } from "../db/sql.js";
import { createRaid } from "../domain/raids/create-raid.js";
import { runLinkedinMonitor } from "../domain/linkedin-monitor/run-linkedin-monitor.js";
import { createApifyClient } from "../lib/apify-client.js";
import { createSlackClient } from "../slack/client.js";

export interface RunLinkedinMonitorCommandDependencies {
  runLinkedinMonitor?: typeof runLinkedinMonitor;
  stdout?: Pick<typeof console, "log">;
}

function parseDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

function parseSinceMinutes(argv: string[]): number | undefined {
  const arg = argv.find((a) => a.startsWith("--since-minutes="));
  if (!arg) return undefined;
  const value = parseInt(arg.split("=")[1], 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export async function runLinkedinMonitorCommand(
  argv: string[],
  dependencies: RunLinkedinMonitorCommandDependencies = {},
): Promise<number> {
  const dryRun = parseDryRun(argv);
  const sinceMinutes = parseSinceMinutes(argv);
  const run = dependencies.runLinkedinMonitor ?? runLinkedinMonitor;
  const stdout = dependencies.stdout ?? console;

  const result = await run(
    { dryRun, sinceMinutes },
    {
      apify: createApifyClient({ token: env.APIFY_TOKEN }),
      apifyActorId: env.APIFY_LINKEDIN_MONITOR_ACTOR_ID,
      createRaid,
      slackClient: createSlackClient() as Parameters<typeof runLinkedinMonitor>[1]["slackClient"],
    },
  );

  stdout.log(
    `linkedin-monitor${dryRun ? " (dry-run)" : ""}: fetched=${result.postsFetched} processed=${result.raidsProcessed} failures=${result.failures} skipped.nonOriginal=${result.skipped.nonOriginal} skipped.unmapped=${result.skipped.unmapped} skipped.malformed=${result.skipped.malformed}`,
  );

  return result.failures === 0 ? 0 : 1;
}

async function main() {
  const code = await runLinkedinMonitorCommand(process.argv.slice(2));
  process.exitCode = code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown linkedin-monitor failure.";
    console.error(`linkedin-monitor failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await closeSql({ timeout: 0 });
  }
}
