export const RAID_MODAL_CALLBACK_ID = "raid_create_modal";

export const RAID_MODAL_FIELD_IDS = {
  postUrl: {
    blockId: "post_url",
    actionId: "post_url_input",
  },
  clientName: {
    blockId: "client_name",
    actionId: "client_name_input",
  },
  platform: {
    blockId: "platform",
    actionId: "platform_select",
  },
  publishedAt: {
    blockId: "published_at",
    actionId: "published_at_input",
  },
} as const;

interface PlainTextObject {
  type: "plain_text";
  text: string;
}

interface MrkdwnTextObject {
  type: "mrkdwn";
  text: string;
}

interface InputBlock {
  type: "input";
  block_id: string;
  optional?: boolean;
  label: PlainTextObject;
  hint?: PlainTextObject;
  element:
    | {
        type: "url_text_input";
        action_id: string;
        focus_on_load?: boolean;
      }
    | {
        type: "plain_text_input";
        action_id: string;
      }
    | {
        type: "static_select";
        action_id: string;
        options: Array<{
          text: PlainTextObject;
          value: string;
        }>;
        initial_option: {
          text: PlainTextObject;
          value: string;
        };
      }
    | {
        type: "datetimepicker";
        action_id: string;
      };
}

interface SectionBlock {
  type: "section";
  text: MrkdwnTextObject;
}

type RaidModalBlock = SectionBlock | InputBlock;

export interface RaidModalView {
  type: "modal";
  callback_id: typeof RAID_MODAL_CALLBACK_ID;
  title: PlainTextObject;
  submit: PlainTextObject;
  close: PlainTextObject;
  blocks: RaidModalBlock[];
  private_metadata?: string;
}

export function buildRaidModal(): RaidModalView {
  return {
    type: "modal",
    callback_id: RAID_MODAL_CALLBACK_ID,
    title: {
      type: "plain_text",
      text: "Create raid",
    },
    submit: {
      type: "plain_text",
      text: "Create raid",
    },
    close: {
      type: "plain_text",
      text: "Close without posting",
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Post a raid target for the team. Published time is optional.",
        },
      },
      {
        type: "input",
        block_id: RAID_MODAL_FIELD_IDS.postUrl.blockId,
        label: {
          type: "plain_text",
          text: "Post URL",
        },
        element: {
          type: "url_text_input",
          action_id: RAID_MODAL_FIELD_IDS.postUrl.actionId,
          focus_on_load: true,
        },
      },
      {
        type: "input",
        block_id: RAID_MODAL_FIELD_IDS.clientName.blockId,
        label: {
          type: "plain_text",
          text: "Client name",
        },
        element: {
          type: "plain_text_input",
          action_id: RAID_MODAL_FIELD_IDS.clientName.actionId,
        },
      },
      {
        type: "input",
        block_id: RAID_MODAL_FIELD_IDS.platform.blockId,
        label: {
          type: "plain_text",
          text: "Platform",
        },
        element: {
          type: "static_select",
          action_id: RAID_MODAL_FIELD_IDS.platform.actionId,
          options: [
            {
              text: {
                type: "plain_text",
                text: "X",
              },
              value: "x",
            },
            {
              text: {
                type: "plain_text",
                text: "LinkedIn",
              },
              value: "linkedin",
            },
          ],
          initial_option: {
            text: {
              type: "plain_text",
              text: "X",
            },
            value: "x",
          },
        },
      },
      {
        type: "input",
        block_id: RAID_MODAL_FIELD_IDS.publishedAt.blockId,
        optional: true,
        label: {
          type: "plain_text",
          text: "Published at (optional)",
        },
        hint: {
          type: "plain_text",
          text: "Leave blank if unknown. Raider Bot will use Slack post time and mark the raid as approximate.",
        },
        element: {
          type: "datetimepicker",
          action_id: RAID_MODAL_FIELD_IDS.publishedAt.actionId,
        },
      },
    ],
  };
}
