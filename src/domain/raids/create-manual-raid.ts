import { createRaid, type CreateRaidContext } from "./create-raid.js";
import type { ManualRaidInput } from "./manual-raid-input.js";
import type { RaidPost } from "./types.js";

export interface CreateManualRaidInput extends ManualRaidInput {
  createdBySlackUserId: string;
}

export type CreateManualRaidContext = CreateRaidContext;

export async function createManualRaid(
  input: CreateManualRaidInput,
  context: CreateManualRaidContext,
): Promise<RaidPost> {
  return createRaid(
    {
      postUrl: input.postUrl,
      clientName: input.clientName,
      platform: input.platform,
      createdBySlackUserId: input.createdBySlackUserId,
      publishedAt: input.publishedAt,
    },
    context,
  );
}
