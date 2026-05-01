import type { LinkedinClient } from "../../config/linkedin-clients.js";
import type { LinkedinPostRecord } from "./types.js";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function mapAuthorToClientName(
  record: LinkedinPostRecord,
  clients: readonly LinkedinClient[],
): string | undefined {
  const slugLower = record.authorSlug.toLowerCase();
  const slugMatch = clients.find((client) => client.slug.toLowerCase() === slugLower);
  if (slugMatch) {
    return slugMatch.clientName;
  }

  const authorUrlNormalized = stripTrailingSlash(record.authorUrl.toLowerCase());

  for (const client of clients) {
    const clientUrlNormalized = stripTrailingSlash(client.url.toLowerCase());
    if (
      authorUrlNormalized === clientUrlNormalized ||
      authorUrlNormalized.startsWith(`${clientUrlNormalized}/`)
    ) {
      return client.clientName;
    }
  }

  return undefined;
}
