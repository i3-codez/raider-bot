export interface LinkedinPostRecord {
  postId: string;
  postUrl: string;
  authorSlug: string;
  authorDisplayName: string;
  authorUrl: string;
  createdAt: Date;
}

export interface LinkedinMonitorSinceWindow {
  from: Date;
  to: Date;
}

export interface LinkedinMonitorSkipCounts {
  unmapped: number;
  nonOriginal: number;
  malformed: number;
}

export interface LinkedinMonitorResult {
  postsFetched: number;
  raidsProcessed: number;
  skipped: LinkedinMonitorSkipCounts;
  failures: number;
  sinceWindow: LinkedinMonitorSinceWindow;
}
