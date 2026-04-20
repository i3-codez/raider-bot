export interface TweetRecord {
  tweetId: string;
  tweetUrl: string;
  authorHandle: string;
  authorName: string;
  createdAt: Date;
  isRetweet: boolean;
  isReply: boolean;
}

export interface MonitorSinceWindow {
  from: Date;
  to: Date;
}

export interface MonitorSkipCounts {
  unmapped: number;
  nonOriginal: number;
  malformed: number;
}

export interface MonitorResult {
  tweetsFetched: number;
  raidsProcessed: number;
  skipped: MonitorSkipCounts;
  failures: number;
  sinceWindow: MonitorSinceWindow;
}
