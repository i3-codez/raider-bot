import { timingSafeEqual } from "node:crypto";
import type { ServerResponse } from "node:http";

import { z } from "zod";

import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { createRaid, type CreateRaidContext } from "../domain/raids/create-raid.js";

export const PUBLISH_WEBHOOK_ENDPOINT = "/publish/webhook";
export const PUBLISH_WEBHOOK_SECRET_HEADER = "x-raider-webhook-secret";
export const PUBLISH_WEBHOOK_CREATED_BY = "publish-webhook";
export const PUBLISH_WEBHOOK_MAX_BODY_BYTES = 64 * 1024;

class PayloadTooLargeError extends Error {
  constructor() {
    super("payload_too_large");
  }
}

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

const publishedAtSchema = z.string().trim().min(1).transform((value, context) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "published_at must be a valid ISO-8601 datetime string.",
    });
    return z.NEVER;
  }

  return date;
});

export const publishWebhookPayloadSchema = z.object({
  post_url: z.string().trim().url(),
  client_name: z.string().trim().min(1),
  platform: z.enum(["x", "linkedin"]),
  published_at: publishedAtSchema,
  source_event_id: optionalString,
  owner_external_id: optionalString,
  owner_display_name: optionalString,
  owner_slack_user_id: optionalString,
});

export type PublishWebhookPayload = z.infer<typeof publishWebhookPayloadSchema>;

export interface PublishWebhookRequest {
  bodyText: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface PublishWebhookDependencies {
  createRaid?: typeof createRaid;
  context: CreateRaidContext;
}

export interface PublishWebhookResponse {
  status: number;
  body: Record<string, unknown>;
}

async function readBody(req: AsyncIterable<Buffer | string>): Promise<string> {
  const chunks: Buffer[] = [];
  let totalSize = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalSize += buffer.length;

    if (totalSize > PUBLISH_WEBHOOK_MAX_BODY_BYTES) {
      throw new PayloadTooLargeError();
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function secretsMatch(provided: string | null, expected: string): boolean {
  if (provided === null) {
    return false;
  }

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function writeJson(res: ServerResponse, response: PublishWebhookResponse) {
  res.statusCode = response.status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(response.body));
}

function getHeaderValue(headers: PublishWebhookRequest["headers"], name: string): string | null {
  const value = headers[name];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" ? value : null;
}

export async function handlePublishWebhookRequest(
  request: PublishWebhookRequest,
  dependencies: PublishWebhookDependencies,
): Promise<PublishWebhookResponse> {
  const providedSecret = getHeaderValue(request.headers, PUBLISH_WEBHOOK_SECRET_HEADER);

  if (!secretsMatch(providedSecret, env.PUBLISH_WEBHOOK_SHARED_SECRET)) {
    return {
      status: 401,
      body: {
        ok: false,
        error: "unauthorized",
      },
    };
  }

  let payload: unknown;

  try {
    payload = JSON.parse(request.bodyText);
  } catch {
    return {
      status: 400,
      body: {
        ok: false,
        error: "invalid_json",
      },
    };
  }

  const parsed = publishWebhookPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "invalid_payload",
        issues: parsed.error.issues.map((issue) => issue.message),
      },
    };
  }

  const raid = await (dependencies.createRaid ?? createRaid)(
    {
      postUrl: parsed.data.post_url,
      clientName: parsed.data.client_name,
      platform: parsed.data.platform,
      publishedAt: parsed.data.published_at,
      createdBySlackUserId: PUBLISH_WEBHOOK_CREATED_BY,
      sourceEventId: parsed.data.source_event_id ?? null,
      ownerExternalId: parsed.data.owner_external_id ?? null,
      ownerDisplayName: parsed.data.owner_display_name ?? null,
      ownerSlackUserId: parsed.data.owner_slack_user_id ?? null,
    },
    dependencies.context,
  );

  return {
    status: 200,
    body: {
      ok: true,
      raid_id: raid.id,
      timing_confidence: raid.timingConfidence,
    },
  };
}

export function createPublishWebhookHandler(dependencies: PublishWebhookDependencies) {
  return (req: PublishWebhookRequest["headers"] & AsyncIterable<Buffer | string>, res: ServerResponse) => {
    void (async () => {
      try {
        const bodyText = await readBody(req);
        const response = await handlePublishWebhookRequest(
          {
            bodyText,
            headers: (req as unknown as { headers: PublishWebhookRequest["headers"] }).headers,
          },
          dependencies,
        );

        writeJson(res, response);
      } catch (error) {
        if (error instanceof PayloadTooLargeError) {
          writeJson(res, {
            status: 413,
            body: {
              ok: false,
              error: "payload_too_large",
            },
          });
          return;
        }

        logger.error(
          {
            err: error,
            endpoint: PUBLISH_WEBHOOK_ENDPOINT,
          },
          "Failed to process publish webhook.",
        );

        writeJson(res, {
          status: 500,
          body: {
            ok: false,
            error: "internal_error",
          },
        });
      }
    })();
  };
}
