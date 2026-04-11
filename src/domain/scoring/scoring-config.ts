import type { ScoringWindowDefinition } from "./types.js";

export const SCORING_WINDOWS = [
  { label: "0-10m", minMinutes: 0, maxMinutesExclusive: 10, points: 10 },
  { label: "10-20m", minMinutes: 10, maxMinutesExclusive: 20, points: 8 },
  { label: "20-30m", minMinutes: 20, maxMinutesExclusive: 30, points: 6 },
  { label: "30-60m", minMinutes: 30, maxMinutesExclusive: 60, points: 3 },
  { label: "60m+", minMinutes: 60, maxMinutesExclusive: null, points: 0 },
] as const satisfies readonly ScoringWindowDefinition[];
