import { LINKEDIN_CLIENTS, type LinkedinClient } from "../../config/linkedin-clients.js";
import { logger as defaultLogger } from "../../lib/logger.js";
import type { ApifyClient } from "../../lib/apify-client.js";
import { buildLinkedinApifyInput } from "./build-apify-input.js";
import { filterOriginalPosts } from "./filter-posts.js";
import { mapAuthorToClientName } from "./map-client-name.js";
import { parsePostRecord } from "./parse-post-record.js";
import type { LinkedinMonitorResult, LinkedinPostRecord } from "./types.js";
import type {
  CreateRaidContext,
  CreateRaidInput,
  SlackClientLike,
} from "../raids/create-raid.js";
import type { RaidPost } from "../raids/types.js";

const DEFAULT_SINCE_WINDOW_MINUTES = 7;
const MONITOR_CREATED_BY = "linkedin-monitor";

export interface LinkedinMonitorContext {
  apify: ApifyClient;
  apifyActorId: string;
  createRaid: (input: CreateRaidInput, ctx: CreateRaidContext) => Promise<RaidPost>;
  slackClient: SlackClientLike;
  config?: readonly LinkedinClient[];
  now?: () => Date;
  logger?: Pick<typeof defaultLogger, "info" | "warn" | "error">;
}

export async function runLinkedinMonitor(
  params: { dryRun?: boolean; sinceMinutes?: number },
  context: LinkedinMonitorContext,
): Promise<LinkedinMonitorResult> {
  const clients = context.config ?? LINKEDIN_CLIENTS;
  const logger = context.logger ?? defaultLogger;
  const now = context.now ? context.now() : new Date();
  const windowMinutes = params.sinceMinutes ?? DEFAULT_SINCE_WINDOW_MINUTES;
  const since = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const result: LinkedinMonitorResult = {
    postsFetched: 0,
    raidsProcessed: 0,
    skipped: { unmapped: 0, nonOriginal: 0, malformed: 0 },
    failures: 0,
    sinceWindow: { from: since, to: now },
  };

  if (clients.length === 0) {
    logger.info({ result }, "linkedin-monitor: no clients configured — skipping fetch");
    return result;
  }

  const input = buildLinkedinApifyInput(
    clients.map((client) => client.url),
    since,
  );

  const rawItems = await context.apify.runActor(context.apifyActorId, input);
  result.postsFetched = rawItems.length;

  const parsed: LinkedinPostRecord[] = [];
  for (const item of rawItems) {
    const record = parsePostRecord(item);
    if (!record) {
      result.skipped.malformed += 1;
      logger.warn({ item }, "linkedin-monitor: skipping malformed Apify item");
      continue;
    }
    parsed.push(record);
  }

  const originals = filterOriginalPosts(parsed);
  result.skipped.nonOriginal = parsed.length - originals.length;

  for (const post of originals) {
    const clientName = mapAuthorToClientName(post, clients);
    if (!clientName) {
      result.skipped.unmapped += 1;
      logger.warn(
        { authorSlug: post.authorSlug, postId: post.postId },
        "linkedin-monitor: author is not in LINKEDIN_CLIENTS — skipping",
      );
      continue;
    }

    const raidInput: CreateRaidInput = {
      postUrl: post.postUrl,
      clientName,
      platform: "linkedin",
      publishedAt: post.createdAt,
      createdBySlackUserId: MONITOR_CREATED_BY,
      sourceEventId: post.postId,
      ownerExternalId: post.authorSlug,
      ownerDisplayName: post.authorDisplayName,
      ownerSlackUserId: null,
    };

    if (params.dryRun) {
      logger.info({ raidInput }, "linkedin-monitor dry-run: would create raid");
      continue;
    }

    try {
      await context.createRaid(raidInput, { client: context.slackClient });
      result.raidsProcessed += 1;
    } catch (error) {
      result.failures += 1;
      logger.error(
        { err: error, postId: post.postId, clientName },
        "linkedin-monitor: createRaid threw — continuing with remaining posts",
      );
    }
  }

  logger.info({ result }, "linkedin-monitor run complete");

  return result;
}
