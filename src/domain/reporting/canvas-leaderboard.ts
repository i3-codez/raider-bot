import { deriveMonthKey, formatEasternMonthLabel } from "../../lib/time.js";
import {
  queryMonthlyLeaderboard,
  type MonthlyLeaderboardEntry,
} from "../../db/queries/monthly-reporting.js";

const DEFAULT_LIMIT = 10;

export interface CanvasLeaderboardReport {
  generatedAt: Date;
  monthKey: string;
  monthLabel: string;
  entries: MonthlyLeaderboardEntry[];
}

export interface GetCanvasLeaderboardParams {
  now?: Date;
  limit?: number;
}

export interface GetCanvasLeaderboardDependencies {
  queryMonthlyLeaderboard?: typeof queryMonthlyLeaderboard;
}

export async function getCanvasLeaderboardReport(
  params: GetCanvasLeaderboardParams = {},
  dependencies: GetCanvasLeaderboardDependencies = {},
): Promise<CanvasLeaderboardReport> {
  const now = params.now ?? new Date();
  const limit = params.limit ?? DEFAULT_LIMIT;
  const monthKey = deriveMonthKey(now);
  const entries = await (dependencies.queryMonthlyLeaderboard ?? queryMonthlyLeaderboard)({
    monthKey,
    limit,
  });

  return {
    generatedAt: now,
    monthKey,
    monthLabel: formatEasternMonthLabel(now),
    entries,
  };
}
