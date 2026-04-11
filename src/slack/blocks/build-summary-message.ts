import type { SummaryReport } from "../../domain/reporting/summary-reporting.js";

export interface SummaryMessage {
  text: string;
  blocks: unknown[];
}

function toPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function buildTotalsText(report: SummaryReport): string {
  return [
    `Points: ${report.totals.totalPoints}`,
    `Unique raids: ${report.totals.uniqueRaidsEngaged}`,
    `Early actions: ${report.totals.earlyWindowActions}`,
    `Early rate: ${toPercent(report.totals.earlyWindowActionRate)}`,
  ].join(" | ");
}

function buildEntryLine(
  entry: SummaryReport["entries"][number],
  index: number,
): string {
  return `${index + 1}. ${entry.displayName} - ${entry.totalPoints} pts (${entry.uniqueRaidsEngaged} raids, ${entry.earlyWindowActions} early, ${toPercent(entry.earlyWindowActionRate)} early rate)`;
}

export function buildSummaryMessage(report: SummaryReport): SummaryMessage {
  const entryLines =
    report.entries.length > 0
      ? report.entries.map(buildEntryLine)
      : ["No scored activity in this reporting window."];
  const text = [report.window.label, buildTotalsText(report), ...entryLines].join("\n");

  return {
    text,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: report.window.label,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Window totals*\n${buildTotalsText(report)}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Leaderboard*\n${entryLines.join("\n")}`,
        },
      },
    ],
  };
}
