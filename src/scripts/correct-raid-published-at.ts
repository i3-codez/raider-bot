#!/usr/bin/env node

import { createSlackApp } from "../app/slack.js";
import { closeSql } from "../db/sql.js";
import { correctRaidPublishedAt } from "../domain/raids/correct-raid-published-at.js";

const REQUIRED_FLAGS = ["--raid-id", "--published-at", "--corrected-by"] as const;

type RequiredFlag = (typeof REQUIRED_FLAGS)[number];

function parseArgs(argv: string[]): Record<RequiredFlag, string> {
  const values = new Map<string, string>();

  for (const argument of argv) {
    const [flag, rawValue] = argument.split("=", 2);

    if (!flag.startsWith("--")) {
      continue;
    }

    values.set(flag, rawValue ?? "");
  }

  const parsed = {} as Record<RequiredFlag, string>;

  for (const flag of REQUIRED_FLAGS) {
    const value = values.get(flag)?.trim();

    if (!value) {
      throw new Error(
        `Missing required flag ${flag}. Expected --raid-id=<uuid> --published-at=<ISO8601> --corrected-by=<slack_user_id>.`,
      );
    }

    parsed[flag] = value;
  }

  return parsed;
}

function parsePublishedAt(value: string): Date {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("The --published-at value must be a valid ISO-8601 timestamp.");
  }

  if (parsed.getTime() > Date.now()) {
    throw new Error("The --published-at value cannot be in the future.");
  }

  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const publishedAt = parsePublishedAt(args["--published-at"]);
  const { app } = createSlackApp();

  const result = await correctRaidPublishedAt({
    raidPostId: args["--raid-id"],
    publishedAt,
    correctedBy: args["--corrected-by"],
    client: app.client,
  });

  console.log(
    `Corrected raid ${result.raid.id} to ${publishedAt.toISOString()} and recalculated ${result.engagementUpdates.length} engagement rows.`,
  );
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown correction failure.";
  console.error(`Correction failed: ${message}`);
  process.exitCode = 1;
} finally {
  await closeSql({ timeout: 0 });
}
