import type { App } from "@slack/bolt";

import { createManualRaid, type CreateManualRaidContext } from "../../domain/raids/create-manual-raid.js";
import {
  parseManualRaidInput,
  parseManualRaidPrivateMetadata,
} from "../../domain/raids/manual-raid-input.js";
import { RAID_MODAL_CALLBACK_ID } from "./build-raid-modal.js";

interface PostEphemeralPayload {
  channel: string;
  user: string;
  text: string;
}

interface AckValidationErrors {
  response_action: "errors";
  errors: Record<string, string>;
}

interface ViewLike {
  private_metadata?: string;
  state: {
    values?: Record<string, Record<string, unknown>>;
  };
}

export interface HandleRaidSubmitArgs {
  ack(response?: AckValidationErrors): Promise<void>;
  client: CreateManualRaidContext["client"] & {
    chat: CreateManualRaidContext["client"]["chat"] & {
      postEphemeral(payload: PostEphemeralPayload): Promise<unknown>;
    };
  };
  view: ViewLike;
}

export interface HandleRaidSubmitDependencies {
  createManualRaid?: typeof createManualRaid;
}

function buildConfirmationText(channelId: string, timingConfidence: "high" | "low"): string {
  const confidenceLabel = timingConfidence === "high" ? "high" : "approximate";
  return `Raid posted in <#${channelId}>. Timing confidence: ${confidenceLabel}.`;
}

export async function handleRaidSubmit(
  args: HandleRaidSubmitArgs,
  dependencies: HandleRaidSubmitDependencies = {},
): Promise<void> {
  const parsed = parseManualRaidInput(args.view.state);

  if (!parsed.ok) {
    await args.ack({
      response_action: "errors",
      errors: parsed.errors,
    });
    return;
  }

  await args.ack();

  const metadata = parseManualRaidPrivateMetadata(args.view.private_metadata);
  const raid = await (dependencies.createManualRaid ?? createManualRaid)(
    {
      ...parsed.data,
      createdBySlackUserId: metadata.userId,
    },
    {
      client: args.client,
    },
  );

  await args.client.chat.postEphemeral({
    channel: metadata.channelId,
    user: metadata.userId,
    text: buildConfirmationText(raid.slackChannelId, raid.timingConfidence),
  });
}

export function registerRaidSubmit(app: App): void {
  app.view(RAID_MODAL_CALLBACK_ID, async (args) => {
    await handleRaidSubmit(args as HandleRaidSubmitArgs);
  });
}
