import {
  getCompletedSummaryWindow,
  type SummaryCadence,
  type SummaryWindow,
} from "../../lib/time.js";
import {
  querySummaryLeaderboard,
  querySummaryTotals,
  type QuerySummaryReportParams,
  type SummaryLeaderboardEntry,
  type SummaryTotals,
} from "../../db/queries/summary-reporting.js";

export interface SummaryReport {
  cadence: SummaryCadence;
  window: SummaryWindow;
  entries: SummaryLeaderboardEntry[];
  totals: SummaryTotals;
}

export interface GetSummaryReportParams {
  cadence: SummaryCadence;
  now?: Date;
  limit?: number;
}

export interface GetSummaryReportDependencies {
  querySummaryLeaderboard?: typeof querySummaryLeaderboard;
  querySummaryTotals?: typeof querySummaryTotals;
}

function buildQueryParams(
  params: GetSummaryReportParams,
  window: SummaryWindow,
): QuerySummaryReportParams {
  return {
    windowStart: window.start,
    windowEnd: window.end,
    limit: params.limit,
  };
}

export async function getSummaryReport(
  params: GetSummaryReportParams,
  dependencies: GetSummaryReportDependencies = {},
): Promise<SummaryReport> {
  const window = getCompletedSummaryWindow(params.cadence, params.now ?? new Date());
  const queryParams = buildQueryParams(params, window);
  const [entries, totals] = await Promise.all([
    (dependencies.querySummaryLeaderboard ?? querySummaryLeaderboard)(queryParams),
    (dependencies.querySummaryTotals ?? querySummaryTotals)(queryParams),
  ]);

  return {
    cadence: params.cadence,
    window,
    entries,
    totals,
  };
}
