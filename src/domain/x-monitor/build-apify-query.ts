export function buildApifyQuery(handles: readonly string[], since: Date): string {
  if (handles.length === 0) {
    throw new Error("buildApifyQuery requires a non-empty handle list.");
  }

  const fromClause = handles.map((handle) => `from:${handle}`).join(" OR ");
  const isoFloored = new Date(Math.floor(since.getTime() / 1000) * 1000).toISOString();
  const sinceStr = `${isoFloored.slice(0, 19).replace("T", "_")}_UTC`;

  return `(${fromClause}) -filter:replies -filter:retweets since:${sinceStr}`;
}
