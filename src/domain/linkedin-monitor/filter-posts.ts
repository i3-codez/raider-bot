import type { LinkedinPostRecord } from "./types.js";

export function filterOriginalPosts(
  records: readonly LinkedinPostRecord[],
): LinkedinPostRecord[] {
  return [...records];
}
