import { ACTION_REGISTRY } from "../../domain/scoring/action-registry.js";
import { logger } from "../../lib/logger.js";

export interface SlackReactionsAddClient {
  reactions: {
    add(payload: { channel: string; timestamp: string; name: string }): Promise<unknown>;
  };
}

export async function seedRaidReactions(
  client: SlackReactionsAddClient,
  channel: string,
  timestamp: string,
): Promise<void> {
  await Promise.all(
    ACTION_REGISTRY.map(async (action) => {
      try {
        await client.reactions.add({
          channel,
          timestamp,
          name: action.emoji,
        });
      } catch (error) {
        logger.warn(
          { err: error, emoji: action.emoji, channel, timestamp },
          "Failed to seed raid reaction.",
        );
      }
    }),
  );
}
