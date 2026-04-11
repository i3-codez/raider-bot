import { z } from "zod";

const optionalString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? undefined : trimmedValue;
  },
  z.string().min(1).optional(),
);

const operatorUserIdsSchema = z.string().trim().min(1).transform((value, context) => {
  const userIds = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (userIds.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "SLACK_RAID_OPERATOR_USER_IDS must include at least one Slack user ID.",
    });

    return z.NEVER;
  }

  return Array.from(new Set(userIds));
});

export const envSchema = z.object({
  DATABASE_URL: z.string().trim().min(1),
  SLACK_BOT_TOKEN: z.string().trim().min(1),
  SLACK_SIGNING_SECRET: z.string().trim().min(1),
  SLACK_RAID_CHANNEL_ID: z.string().trim().min(1),
  SLACK_RAID_OPERATOR_USER_IDS: operatorUserIdsSchema,
  SLACK_APP_TOKEN: optionalString,
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  APP_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const env = loadEnv();
