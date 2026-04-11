import {
  formatEasternMonthLabel,
  getCompletedSummaryWindow,
  startOfEasternMonth,
} from "../../lib/time.js";
import {
  querySummaryLeaderboard,
  querySummaryTotals,
} from "../../db/queries/summary-reporting.js";
import { replaceMonthlySnapshots } from "../../db/queries/monthly-snapshots.js";
import { upsertJobRun } from "../../db/queries/job-runs.js";

export interface RunMonthCloseParams {
  dryRun?: boolean;
  now?: Date;
  targetMonthKey?: string;
}

export interface RunMonthCloseDependencies {
  querySummaryLeaderboard?: typeof querySummaryLeaderboard;
  querySummaryTotals?: typeof querySummaryTotals;
  replaceMonthlySnapshots?: typeof replaceMonthlySnapshots;
  upsertJobRun?: typeof upsertJobRun;
}

export interface MonthCloseResult {
  monthKey: string;
  label: string;
  entries: Awaited<ReturnType<typeof querySummaryLeaderboard>>;
  totals: Awaited<ReturnType<typeof querySummaryTotals>>;
  persisted: boolean;
}

function parseTargetMonthWindow(monthKey: string): { monthKey: string; start: Date; end: Date } {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error("The target month must use YYYY-MM format.");
  }

  const [yearValue, monthValue] = monthKey.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);

  if (month < 1 || month > 12) {
    throw new Error("The target month must use a valid calendar month.");
  }

  const approximateMidMonth = new Date(Date.UTC(year, month - 1, 15, 17, 0, 0));
  const start = startOfEasternMonth(approximateMidMonth);
  const nextMonthMidpoint = new Date(Date.UTC(year, month, 15, 17, 0, 0));
  const end = startOfEasternMonth(nextMonthMidpoint);

  return { monthKey, start, end };
}

export async function runMonthClose(
  params: RunMonthCloseParams = {},
  dependencies: RunMonthCloseDependencies = {},
): Promise<MonthCloseResult> {
  const defaultWindow = getCompletedSummaryWindow("monthly", params.now ?? new Date());
  const resolvedWindow = params.targetMonthKey
    ? parseTargetMonthWindow(params.targetMonthKey)
    : {
        monthKey: defaultWindow.key,
        start: defaultWindow.start,
        end: defaultWindow.end,
      };
  const [entries, totals] = await Promise.all([
    (dependencies.querySummaryLeaderboard ?? querySummaryLeaderboard)({
      windowStart: resolvedWindow.start,
      windowEnd: resolvedWindow.end,
      limit: 100,
    }),
    (dependencies.querySummaryTotals ?? querySummaryTotals)({
      windowStart: resolvedWindow.start,
      windowEnd: resolvedWindow.end,
    }),
  ]);
  const label = `Month Close for ${formatEasternMonthLabel(resolvedWindow.start)}`;

  if (!params.dryRun) {
    await (dependencies.replaceMonthlySnapshots ?? replaceMonthlySnapshots)({
      monthKey: resolvedWindow.monthKey,
      totals,
      entries: entries.map((entry, index) => ({
        slackUserId: entry.slackUserId,
        displayName: entry.displayName,
        rank: index + 1,
        totalPoints: entry.totalPoints,
        uniqueRaidsEngaged: entry.uniqueRaidsEngaged,
        earlyWindowActions: entry.earlyWindowActions,
        totalActions: entry.totalActions,
        earlyWindowActionRate: entry.earlyWindowActionRate,
      })),
    });

    await (dependencies.upsertJobRun ?? upsertJobRun)({
      jobName: "month-close",
      windowKey: resolvedWindow.monthKey,
      details: `snapshots=${entries.length}`,
    });
  }

  return {
    monthKey: resolvedWindow.monthKey,
    label,
    entries,
    totals,
    persisted: !(params.dryRun ?? false),
  };
}
