export type ActionType = "like" | "comment" | "repost" | "quote_post";

export type ScoringWindowLabel = "0-10m" | "10-20m" | "20-30m" | "30-60m" | "60m+";

export interface ActionDefinition {
  emoji: string;
  actionType: ActionType;
  label: string;
}

export interface ScoringWindowDefinition {
  label: ScoringWindowLabel;
  minMinutes: number;
  maxMinutesExclusive: number | null;
  points: number;
}
