export type Platform = "x";

export type RaidTimingConfidence = "high" | "low";

export interface RaidPost {
  id: string;
  postUrl: string;
  clientName: string;
  platform: Platform;
  publishedAt: Date | null;
  slackPostedAt: Date;
  slackMessageTs: string;
  slackChannelId: string;
  timingConfidence: RaidTimingConfidence;
  monthKey: string;
}
