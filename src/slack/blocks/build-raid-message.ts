import type { Platform, RaidTimingConfidence } from "../../domain/raids/types.js";

interface MrkdwnTextObject {
  type: "mrkdwn";
  text: string;
}

interface SectionBlock {
  type: "section";
  text: MrkdwnTextObject;
}

type RaidMessageBlock = SectionBlock;

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

export function buildRaidMessage(input: BuildRaidMessageInput): RaidMessage {
  const bodyText = `New post from *${input.clientName}* just shipped: go go go! <${input.postUrl}>`;

  return {
    text: `New post from ${input.clientName} just shipped: go go go! ${input.postUrl}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: bodyText },
      },
    ],
  };
}
