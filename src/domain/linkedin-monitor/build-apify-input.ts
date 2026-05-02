export interface LinkedinApifyInput {
  targetUrls: string[];
  postedLimitDate: string;
  includeReposts: false;
  includeQuotePosts: false;
  maxPosts: number;
}

const MAX_POSTS = 50;

export function buildLinkedinApifyInput(
  urls: readonly string[],
  since: Date,
): LinkedinApifyInput {
  if (urls.length === 0) {
    throw new Error("buildLinkedinApifyInput requires a non-empty URL list.");
  }

  return {
    targetUrls: [...urls],
    postedLimitDate: since.toISOString(),
    includeReposts: false,
    includeQuotePosts: false,
    maxPosts: MAX_POSTS,
  };
}
