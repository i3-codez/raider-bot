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
  { handle: "jupiterexchange", clientName: "Jupiter" },
] as const satisfies readonly XClient[];
