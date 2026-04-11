import { runMonthClose, type RunMonthCloseDependencies } from "../domain/reporting/month-close.js";

export interface RunMonthCloseJobParams {
  dryRun?: boolean;
  now?: Date;
  targetMonthKey?: string;
}

export interface RunMonthCloseJobDependencies extends RunMonthCloseDependencies {}

export async function runMonthCloseJob(
  params: RunMonthCloseJobParams = {},
  dependencies: RunMonthCloseJobDependencies = {},
) {
  return runMonthClose(params, dependencies);
}
