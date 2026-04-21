import type { TweetRecord } from "./types.js";

function pickString(source: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

function pickNested<T>(
  source: Record<string, unknown>,
  paths: readonly (readonly string[])[],
  check: (value: unknown) => value is T,
): T | null {
  for (const path of paths) {
    let current: unknown = source;
    for (const segment of path) {
      if (typeof current !== "object" || current === null) {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    if (check(current)) {
      return current;
    }
  }
  return null;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export function parseTweetRecord(raw: unknown): TweetRecord | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const source = raw as Record<string, unknown>;

  const tweetId = pickString(source, ["id", "id_str", "tweetId", "tweet_id"]);
  const createdAtRaw = pickString(source, ["created_at", "createdAt"]);
  const authorHandle = pickNested(
    source,
    [["user", "screen_name"], ["author", "userName"], ["user_info", "screen_name"], ["screen_name"]],
    isNonEmptyString,
  );
  const authorName =
    pickNested(source, [["user", "name"], ["author", "name"], ["user_info", "name"]], isNonEmptyString) ??
    pickString(source, ["name"]);

  const tweetUrl =
    pickString(source, ["url", "tweetUrl"]) ??
    (tweetId && authorHandle ? `https://x.com/${authorHandle.toLowerCase()}/status/${tweetId}` : null);

  if (!tweetId || !tweetUrl || !createdAtRaw || !authorHandle || !authorName) {
    return null;
  }

  const createdAt = new Date(createdAtRaw);
  if (Number.isNaN(createdAt.getTime())) {
    return null;
  }

  const isRetweet =
    source.is_retweet === true ||
    source.isRetweet === true ||
    (typeof source.retweeted_status === "object" && source.retweeted_status !== null);

  const replyIdCandidates = ["in_reply_to_status_id", "in_reply_to_status_id_str", "inReplyToStatusId"];
  const hasReplyId = replyIdCandidates.some((key) => {
    const value = source[key];
    return value !== null && value !== undefined && value !== "";
  });
  const isReply = source.is_reply === true || source.isReply === true || hasReplyId;

  return {
    tweetId,
    tweetUrl,
    authorHandle: authorHandle.toLowerCase(),
    authorName,
    createdAt,
    isRetweet,
    isReply,
  };
}
