import { deriveMonthKey } from "../../lib/time.js";
import {
  queryMemberMonthlyStats,
  queryMonthlyLeaderboard,
  type MemberMonthlyStats,
  type MonthlyLeaderboardEntry,
} from "../../db/queries/monthly-reporting.js";

export interface GetMonthlyLeaderboardParams {
  monthKey?: string;
  limit?: number;
  now?: Date;
}

export interface GetMonthlyLeaderboardDependencies {
  queryMonthlyLeaderboard?: typeof queryMonthlyLeaderboard;
}

export async function getMonthlyLeaderboard(
  params: GetMonthlyLeaderboardParams = {},
  dependencies: GetMonthlyLeaderboardDependencies = {},
): Promise<MonthlyLeaderboardEntry[]> {
  const monthKey = params.monthKey ?? deriveMonthKey(params.now ?? new Date());

  return (dependencies.queryMonthlyLeaderboard ?? queryMonthlyLeaderboard)({
    monthKey,
    limit: params.limit,
  });
}

export interface GetMemberMonthlyStatsParams {
  slackUserId: string;
  monthKey?: string;
  now?: Date;
}

export interface GetMemberMonthlyStatsDependencies {
  queryMemberMonthlyStats?: typeof queryMemberMonthlyStats;
}

export async function getMemberMonthlyStats(
  params: GetMemberMonthlyStatsParams,
  dependencies: GetMemberMonthlyStatsDependencies = {},
): Promise<MemberMonthlyStats | null> {
  const monthKey = params.monthKey ?? deriveMonthKey(params.now ?? new Date());

  return (dependencies.queryMemberMonthlyStats ?? queryMemberMonthlyStats)({
    slackUserId: params.slackUserId,
    monthKey,
  });
}
