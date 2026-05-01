export type Platform = "x" | "linkedin";

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
  normalizedPostUrl?: string;
  sourceEventId?: string | null;
  ownerExternalId?: string | null;
  ownerDisplayName?: string | null;
  ownerSlackUserId?: string | null;
}

export interface RaidOwnerMetadata {
  ownerExternalId?: string | null;
  ownerDisplayName?: string | null;
  ownerSlackUserId?: string | null;
}
