import postgres, { type TransactionSql } from "postgres";

import { env } from "../config/env.js";

const DEFAULT_MAX_CONNECTIONS = 10;
const DEFAULT_IDLE_TIMEOUT_SECONDS = 20;

export type DbClient = ReturnType<typeof createSqlClient>;
export type DbTransaction = TransactionSql<Record<string, never>>;

export function createSqlClient(databaseUrl: string = env.DATABASE_URL) {
  const connectionString = databaseUrl.trim();

  if (connectionString.length === 0) {
    throw new Error("DATABASE_URL must be configured before opening Postgres.");
  }

  return postgres(connectionString, {
    max: DEFAULT_MAX_CONNECTIONS,
    idle_timeout: DEFAULT_IDLE_TIMEOUT_SECONDS,
    ssl: "require",
  });
}

let sharedSql: DbClient | undefined;

export function getSql() {
  sharedSql ??= createSqlClient();
  return sharedSql;
}

export const sql = getSql();

export function withTransaction<T>(callback: (transaction: DbTransaction) => Promise<T> | T) {
  return getSql().begin(callback);
}

export async function closeSql(options?: Parameters<DbClient["end"]>[0]) {
  if (!sharedSql) {
    return;
  }

  await sharedSql.end(options);
  sharedSql = undefined;
}
