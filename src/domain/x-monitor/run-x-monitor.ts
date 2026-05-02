import { X_CLIENTS, type XClient } from "../../config/x-clients.js";
import { logger as defaultLogger } from "../../lib/logger.js";
import type { ApifyClient } from "../../lib/apify-client.js";
import { buildApifyQuery } from "./build-apify-query.js";
import { filterOriginalTweets } from "./filter-tweets.js";
import { mapHandleToClientName } from "./map-client-name.js";
import { parseTweetRecord } from "./parse-tweet-record.js";
import type { MonitorResult, TweetRecord } from "./types.js";
import type {
  CreateRaidContext,
  CreateRaidInput,
  SlackClientLike,
} from "../raids/create-raid.js";
import type { RaidPost } from "../raids/types.js";

const DEFAULT_SINCE_WINDOW_MINUTES = 5;
const MAX_POSTS = 50;
const MONITOR_CREATED_BY = "x-monitor";

export interface MonitorContext {
  apify: ApifyClient;
  apifyActorId: string;
  createRaid: (input: CreateRaidInput, ctx: CreateRaidContext) => Promise<RaidPost>;
  slackClient: SlackClientLike;
  config?: readonly XClient[];
  now?: () => Date;
  logger?: Pick<typeof defaultLogger, "info" | "warn" | "error">;
}

export async function runXMonitor(
  params: { dryRun?: boolean; sinceMinutes?: number },
  context: MonitorContext,
): Promise<MonitorResult> {
  const clients = context.config ?? X_CLIENTS;
  const logger = context.logger ?? defaultLogger;
  const now = context.now ? context.now() : new Date();
  const windowMinutes = params.sinceMinutes ?? DEFAULT_SINCE_WINDOW_MINUTES;
  const since = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const query = buildApifyQuery(
    clients.map((client) => client.handle),
    since,
  );

  const rawItems = await context.apify.runActor(context.apifyActorId, {
    max_posts: MAX_POSTS,
    query,
    search_type: "Latest",
  });

  const result: MonitorResult = {
    tweetsFetched: rawItems.length,
    raidsProcessed: 0,
    skipped: { unmapped: 0, nonOriginal: 0, malformed: 0 },
    failures: 0,
    sinceWindow: { from: since, to: now },
  };

  const parsed: TweetRecord[] = [];
  for (const item of rawItems) {
    const record = parseTweetRecord(item);
    if (!record) {
      result.skipped.malformed += 1;
      logger.warn({ item }, "x-monitor: skipping malformed Apify item");
      continue;
    }
    parsed.push(record);
  }

  const originals = filterOriginalTweets(parsed);
  result.skipped.nonOriginal = parsed.length - originals.length;

  for (const tweet of originals) {
    const clientName = mapHandleToClientName(tweet.authorHandle, clients);
    if (!clientName) {
      result.skipped.unmapped += 1;
      logger.warn(
        { authorHandle: tweet.authorHandle, tweetId: tweet.tweetId },
        "x-monitor: author handle is not in x-clients.ts — skipping",
      );
      continue;
    }

    const raidInput: CreateRaidInput = {
      postUrl: tweet.tweetUrl,
      clientName,
      platform: "x",
      publishedAt: tweet.createdAt,
      createdBySlackUserId: MONITOR_CREATED_BY,
      sourceEventId: tweet.tweetId,
      ownerExternalId: tweet.authorHandle,
      ownerDisplayName: tweet.authorName,
      ownerSlackUserId: null,
    };

    if (params.dryRun) {
      logger.info({ raidInput }, "x-monitor dry-run: would create raid");
      continue;
    }

    try {
      await context.createRaid(raidInput, { client: context.slackClient });
      result.raidsProcessed += 1;
    } catch (error) {
      result.failures += 1;
      logger.error(
        { err: error, tweetId: tweet.tweetId, clientName },
        "x-monitor: createRaid threw — continuing with remaining tweets",
      );
    }
  }

  logger.info({ result }, "x-monitor run complete");

  return result;
}
