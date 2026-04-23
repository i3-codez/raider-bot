import { toEasternLabel } from "../../lib/time.js";
import type { CanvasLeaderboardReport } from "../../domain/reporting/canvas-leaderboard.js";

export const CANVAS_MANAGED_MARKER = "raider-bot-leaderboard";

function renderEntryLines(
  report: CanvasLeaderboardReport,
  nameOverrides?: ReadonlyMap<string, string>,
): string[] {
  if (report.entries.length === 0) {
    return ["_No scored activity yet._"];
  }

  return report.entries.map((entry, index) => {
    const resolved = nameOverrides?.get(entry.slackUserId) ?? entry.displayName;
    const rank = `#${index + 1}`;
    return `${rank} **${resolved}** — ${entry.totalPoints} pts · ${entry.uniqueRaidsEngaged} raids · ${entry.earlyWindowActions} early`;
  });
}

export interface LeaderboardCanvasContent {
  markdown: string;
  marker: string;
}

export function buildLeaderboardCanvasMarkdown(
  report: CanvasLeaderboardReport,
  nameOverrides?: ReadonlyMap<string, string>,
): LeaderboardCanvasContent {
  const header = `🏆 **Raider Bot — ${report.monthLabel} Leaderboard**`;
  const footer = `_${CANVAS_MANAGED_MARKER} · updated ${toEasternLabel(report.generatedAt)} ET_`;
  const lines = [header, ...renderEntryLines(report, nameOverrides), footer];
  const markdown = lines.map((line) => `> ${line}  `).join("\n");

  return {
    markdown,
    marker: CANVAS_MANAGED_MARKER,
  };
}
