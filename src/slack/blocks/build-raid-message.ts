import type { Platform, RaidTimingConfidence } from "../../domain/raids/types.js";
import { ACTION_REGISTRY } from "../../domain/scoring/action-registry.js";
import { SCORING_WINDOWS } from "../../domain/scoring/scoring-config.js";
import { toEasternLabel } from "../../lib/time.js";

const LOW_CONFIDENCE_WARNING =
  ":warning: Published time not provided. Using Slack post time, so timing-based scores are approximate.";
const FOOTER_NOTE =
  "One score per person per action type. Remove your reaction to undo that action.";

interface PlainTextObject {
  type: "plain_text";
  text: string;
}

interface MrkdwnTextObject {
  type: "mrkdwn";
  text: string;
}

interface HeaderBlock {
  type: "header";
  text: PlainTextObject;
}

interface SectionBlock {
  type: "section";
  text: MrkdwnTextObject;
}

interface DividerBlock {
  type: "divider";
}

interface ContextBlock {
  type: "context";
  elements: [MrkdwnTextObject];
}

type RaidMessageBlock = HeaderBlock | SectionBlock | DividerBlock | ContextBlock;

export interface BuildRaidMessageInput {
  clientName: string;
  platform: Platform;
  postUrl: string;
  timingConfidence: RaidTimingConfidence;
  referenceTime: Date;
}

export interface RaidMessage {
  text: string;
  blocks: RaidMessageBlock[];
}

function formatPlatformLabel(platform: Platform): string {
  if (platform === "x") {
    return "X";
  }

  return platform;
}

function buildTimingText(input: BuildRaidMessageInput): string {
  if (input.timingConfidence === "low") {
    return LOW_CONFIDENCE_WARNING;
  }

  return `Published: ${toEasternLabel(input.referenceTime)} ET`;
}

function buildLegendText(): string {
  return ["*How to participate*", ...ACTION_REGISTRY.map((action) => `:${action.emoji}: ${action.label}`)].join("\n");
}

function buildSpeedWindowText(): string {
  return [
    "*Speed windows*",
    ...SCORING_WINDOWS.map((window) => `${window.label}: ${window.points} points`),
  ].join("\n");
}

export function buildRaidMessage(input: BuildRaidMessageInput): RaidMessage {
  const platformLabel = formatPlatformLabel(input.platform);
  const headerText = `Raid live: ${input.clientName} on ${platformLabel}`;
  const timingText = buildTimingText(input);
  const legendText = buildLegendText();
  const speedWindowText = buildSpeedWindowText();

  return {
    text: [
      headerText,
      `Target: ${input.postUrl}`,
      timingText,
      `Actions: ${ACTION_REGISTRY.map((action) => `${action.label} (:${action.emoji}:)`).join(", ")}`,
      `Speed windows: ${SCORING_WINDOWS.map((window) => `${window.label} = ${window.points}`).join(", ")}`,
      FOOTER_NOTE,
    ].join(" "),
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: headerText },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `<${input.postUrl}>\n*Client:* ${input.clientName}\n*Platform:* ${platformLabel}`,
        },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: timingText },
      },
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: legendText },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: speedWindowText },
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: FOOTER_NOTE }],
      },
    ],
  };
}
