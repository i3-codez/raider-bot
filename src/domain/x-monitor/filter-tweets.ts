import type { TweetRecord } from "./types.js";

export function filterOriginalTweets(tweets: readonly TweetRecord[]): TweetRecord[] {
  return tweets.filter((tweet) => !tweet.isRetweet && !tweet.isReply);
}
