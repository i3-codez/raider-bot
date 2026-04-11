import type { App } from "@slack/bolt";

import { env } from "../../config/env.js";
import { buildRaidModal } from "./build-raid-modal.js";

export function registerRaidCommand(app: App): void {
  app.command("/raid", async ({ ack, client, command, respond }) => {
    await ack();

    if (!env.SLACK_RAID_OPERATOR_USER_IDS.includes(command.user_id)) {
      await respond({
        response_type: "ephemeral",
        text: "Only configured raid operators can use /raid.",
      });
      return;
    }

    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        ...buildRaidModal(),
        private_metadata: JSON.stringify({
          channelId: command.channel_id,
          userId: command.user_id,
        }),
      },
    });
  });
}
