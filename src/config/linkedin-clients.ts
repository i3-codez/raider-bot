export interface LinkedinClient {
  url: string;
  slug: string;
  clientName: string;
}

export const LINKEDIN_CLIENTS = [
  {
    url: "https://www.linkedin.com/in/zactownsend",
    slug: "zactownsend",
    clientName: "Zac Townsend",
  },
  {
    url: "https://www.linkedin.com/in/shai-novik",
    slug: "shai-novik",
    clientName: "Shai Novik",
  },
  {
    url: "https://www.linkedin.com/in/justin-file",
    slug: "justin-file",
    clientName: "Justin File",
  },
  {
    url: "https://www.linkedin.com/company/jupiter-onchain",
    slug: "jupiter-onchain",
    clientName: "Jupiter",
  },
  {
    url: "https://www.linkedin.com/company/enlivex",
    slug: "enlivex",
    clientName: "Enlivex",
  },
  {
    url: "https://www.linkedin.com/company/litestrategy",
    slug: "litestrategy",
    clientName: "Lite Strategy",
  },
] as const satisfies readonly LinkedinClient[];
