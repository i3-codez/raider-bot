import type { ActionDefinition } from "./types.js";

export const ACTION_REGISTRY = [
  { emoji: "heart", actionType: "like", label: "Like" },
  { emoji: "speech_balloon", actionType: "comment", label: "Comment" },
  { emoji: "repeat", actionType: "repost", label: "Repost" },
  { emoji: "memo", actionType: "quote_post", label: "Quote post" },
] as const satisfies readonly ActionDefinition[];
