import type { LinkedinPostRecord } from "./types.js";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function parseCreatedAt(postedAt: Record<string, unknown>): Date | null {
  const dateRaw = postedAt.date;
  if (typeof dateRaw === "string" && dateRaw.length > 0) {
    const parsed = new Date(dateRaw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
    return null;
  }

  const timestampRaw = postedAt.timestamp;
  if (typeof timestampRaw === "number" && Number.isFinite(timestampRaw)) {
    const parsed = new Date(timestampRaw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

export function parsePostRecord(raw: unknown): LinkedinPostRecord | null {
  if (!isObject(raw)) {
    return null;
  }

  if ("type" in raw && raw.type !== undefined && raw.type !== "post") {
    return null;
  }

  const postId = raw.id;
  const postUrl = raw.linkedinUrl;
  const author = raw.author;
  const postedAt = raw.postedAt;

  if (!isNonEmptyString(postId)) return null;
  if (!isNonEmptyString(postUrl)) return null;
  if (!isObject(author)) return null;
  if (!isObject(postedAt)) return null;

  const authorSlug = author.publicIdentifier;
  const authorName = author.name;
  const authorUrl = author.linkedinUrl;

  if (!isNonEmptyString(authorSlug)) return null;
  if (!isNonEmptyString(authorName)) return null;
  if (!isNonEmptyString(authorUrl)) return null;

  const createdAt = parseCreatedAt(postedAt);
  if (!createdAt) return null;

  return {
    postId,
    postUrl,
    authorSlug: authorSlug.toLowerCase(),
    authorDisplayName: authorName,
    authorUrl,
    createdAt,
  };
}
