// Guild member search results go to anonymous visitors, so keep only the
// public profile fields, not the full member record (roles, join date, ...).
export function toPublicDiscordMembers(members: unknown) {
  return (Array.isArray(members) ? members : []).map((member: any) => ({
    user: {
      id: member?.user?.id,
      username: member?.user?.username,
      global_name: member?.user?.global_name ?? null,
      avatar: member?.user?.avatar,
    },
  }))
}
