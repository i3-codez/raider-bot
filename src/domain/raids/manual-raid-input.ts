import type { Platform } from "./types.js";
import { RAID_MODAL_FIELD_IDS } from "../../slack/commands/build-raid-modal.js";

const X_POST_URL_PATTERN =
  /^https:\/\/(?:x|twitter)\.com\/[^/?#]+\/status\/[A-Za-z0-9_]+(?:[/?#].*)?$/i;

type ManualRaidViewValues = Record<string, Record<string, unknown>>;

export interface ManualRaidInput {
  postUrl: string;
  clientName: string;
  platform: Platform;
  publishedAt: Date | null;
}

export interface ManualRaidPrivateMetadata {
  channelId: string;
  userId: string;
}

export type ManualRaidValidationResult =
  | {
      ok: true;
      data: ManualRaidInput;
    }
  | {
      ok: false;
      errors: Record<string, string>;
    };

export interface ParseManualRaidInputOptions {
  now?: Date;
}

function getInputValue(values: ManualRaidViewValues, blockId: string, actionId: string): unknown {
  return values[blockId]?.[actionId];
}

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parsePublishedAt(value: unknown): Date | null {
  if (typeof value !== "number") {
    return null;
  }

  return new Date(value * 1000);
}

export function parseManualRaidInput(
  state: { values?: ManualRaidViewValues },
  options: ParseManualRaidInputOptions = {},
): ManualRaidValidationResult {
  const values = state.values ?? {};
  const errors: Record<string, string> = {};
  const now = options.now ?? new Date();

  const postUrlValue = getInputValue(
    values,
    RAID_MODAL_FIELD_IDS.postUrl.blockId,
    RAID_MODAL_FIELD_IDS.postUrl.actionId,
  ) as { value?: unknown } | undefined;
  const clientNameValue = getInputValue(
    values,
    RAID_MODAL_FIELD_IDS.clientName.blockId,
    RAID_MODAL_FIELD_IDS.clientName.actionId,
  ) as { value?: unknown } | undefined;
  const platformValue = getInputValue(
    values,
    RAID_MODAL_FIELD_IDS.platform.blockId,
    RAID_MODAL_FIELD_IDS.platform.actionId,
  ) as { selected_option?: { value?: unknown } } | undefined;
  const publishedAtValue = getInputValue(
    values,
    RAID_MODAL_FIELD_IDS.publishedAt.blockId,
    RAID_MODAL_FIELD_IDS.publishedAt.actionId,
  ) as { selected_date_time?: unknown } | undefined;

  const postUrl = trimString(postUrlValue?.value);
  const clientName = trimString(clientNameValue?.value);
  const selectedPlatform = trimString(platformValue?.selected_option?.value);
  const publishedAt = parsePublishedAt(publishedAtValue?.selected_date_time);

  if (!X_POST_URL_PATTERN.test(postUrl)) {
    errors[RAID_MODAL_FIELD_IDS.postUrl.blockId] = "Use a valid X post URL.";
  }

  if (clientName.length < 2 || clientName.length > 60) {
    errors[RAID_MODAL_FIELD_IDS.clientName.blockId] = "Client name must be 2-60 characters.";
  }

  if (selectedPlatform !== "x") {
    errors[RAID_MODAL_FIELD_IDS.platform.blockId] = "Platform must be X.";
  }

  if (publishedAt !== null && publishedAt.getTime() > now.getTime()) {
    errors[RAID_MODAL_FIELD_IDS.publishedAt.blockId] = "Published time can't be in the future.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    data: {
      postUrl,
      clientName,
      platform: "x",
      publishedAt,
    },
  };
}

export function parseManualRaidPrivateMetadata(privateMetadata: string | undefined): ManualRaidPrivateMetadata {
  if (typeof privateMetadata !== "string" || privateMetadata.trim().length === 0) {
    throw new Error("Missing manual raid private metadata.");
  }

  const parsed = JSON.parse(privateMetadata) as Partial<ManualRaidPrivateMetadata>;

  if (
    typeof parsed.channelId !== "string" ||
    parsed.channelId.trim().length === 0 ||
    typeof parsed.userId !== "string" ||
    parsed.userId.trim().length === 0
  ) {
    throw new Error("Invalid manual raid private metadata.");
  }

  return {
    channelId: parsed.channelId,
    userId: parsed.userId,
  };
}
