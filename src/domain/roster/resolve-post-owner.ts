import {
  findActiveTeamMembersByOwnerAlias,
  type TeamMemberOwnerAliasMatch,
} from "../../db/queries/team-member-owner-aliases.js";

export interface ResolvePostOwnerInput {
  ownerExternalId?: string | null;
  ownerDisplayName?: string | null;
}

export interface ResolvedPostOwner {
  slackUserId: string;
  displayName: string;
}

export interface ResolvePostOwnerDependencies {
  findActiveTeamMembersByOwnerAlias?: typeof findActiveTeamMembersByOwnerAlias;
}

function uniqueMatches(matches: TeamMemberOwnerAliasMatch[]): TeamMemberOwnerAliasMatch[] {
  const bySlackUserId = new Map<string, TeamMemberOwnerAliasMatch>();

  for (const match of matches) {
    bySlackUserId.set(match.slackUserId, match);
  }

  return Array.from(bySlackUserId.values());
}

export async function resolvePostOwner(
  input: ResolvePostOwnerInput,
  dependencies: ResolvePostOwnerDependencies = {},
): Promise<ResolvedPostOwner | null> {
  const aliasLookup = dependencies.findActiveTeamMembersByOwnerAlias ?? findActiveTeamMembersByOwnerAlias;
  const candidateValues = [input.ownerExternalId, input.ownerDisplayName].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  if (candidateValues.length === 0) {
    return null;
  }

  const matches: TeamMemberOwnerAliasMatch[] = [];

  for (const candidateValue of candidateValues) {
    matches.push(...(await aliasLookup(candidateValue)));
  }

  const distinctMatches = uniqueMatches(matches);

  if (distinctMatches.length !== 1) {
    return null;
  }

  return distinctMatches[0];
}
