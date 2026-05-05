export interface XClient {
  handle: string;
  clientName: string;
}

export const X_CLIENTS = [
  { handle: "meanwhile", clientName: "Meanwhile" },
  { handle: "ztownsend", clientName: "Zac Townsend" },
  { handle: "badgerdao", clientName: "BadgerDAO" },
  { handle: "litestrategy", clientName: "Lite Strategy" },
  { handle: "skyecosystem", clientName: "Sky Ecosystem" },
  { handle: "skyecoinsights", clientName: "Sky Eco Insights" },
  { handle: "skymoney", clientName: "Sky Money" },
  { handle: "enlivex", clientName: "Enlivex" },
  { handle: "kylereidhead", clientName: "Kyle Reidhead" },
  { handle: "snovik", clientName: "Snovik" },
  { handle: "orenhershkovitz", clientName: "Oren Hershkovitz" }
] as const satisfies readonly XClient[];
