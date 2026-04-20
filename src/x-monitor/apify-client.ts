export interface ApifyRunInput {
  max_posts: number;
  query: string;
  search_type: "Latest" | "Top";
}

export interface ApifyClient {
  runSyncGetDatasetItems(input: ApifyRunInput): Promise<unknown[]>;
}

export interface CreateApifyClientOptions {
  token: string;
  actorId: string;
  fetchImpl?: typeof fetch;
}

const APIFY_BASE = "https://api.apify.com/v2";

export function createApifyClient(options: CreateApifyClientOptions): ApifyClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async runSyncGetDatasetItems(input) {
      const url = `${APIFY_BASE}/acts/${options.actorId}/run-sync-get-dataset-items`;
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Apify run-sync-get-dataset-items failed: ${response.status} ${response.statusText} ${text}`.trim(),
        );
      }

      const body = await response.json();
      if (!Array.isArray(body)) {
        throw new Error("Apify run-sync-get-dataset-items did not return a JSON array.");
      }

      return body;
    },
  };
}
