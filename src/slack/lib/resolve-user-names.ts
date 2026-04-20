export interface SlackUsersInfoClient {
  users: {
    info(payload: { user: string }): Promise<{
      user?: {
        profile?: {
          display_name?: string;
          real_name?: string;
        };
      };
    }>;
  };
}

export async function resolveUserNames(
  client: SlackUsersInfoClient,
  userIds: readonly string[],
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(userIds));
  const entries = await Promise.all(
    unique.map(async (id): Promise<[string, string]> => {
      try {
        const response = await client.users.info({ user: id });
        const profile = response.user?.profile;
        const resolved = profile?.display_name?.trim() || profile?.real_name?.trim() || id;
        return [id, resolved];
      } catch {
        return [id, id];
      }
    }),
  );

  return new Map(entries);
}
