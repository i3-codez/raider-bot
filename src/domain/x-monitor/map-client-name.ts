import type { XClient } from "../../config/x-clients.js";

export function mapHandleToClientName(
  authorHandle: string,
  clients: readonly XClient[],
): string | undefined {
  const normalized = authorHandle.toLowerCase();
  const match = clients.find((client) => client.handle.toLowerCase() === normalized);
  return match?.clientName;
}
