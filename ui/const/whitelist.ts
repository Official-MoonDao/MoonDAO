//https://docs.google.com/spreadsheets/d/1LsYxkI_1alFUD_NxM2a5RngeSRC5e5ElUpP6aR30DiM/edit?gid=0#gid=0
export const BLOCKED_TEAMS: any = new Set([])
export const BLOCKED_CITIZENS: any = new Set([48, 72, 140, 177])
// Missions to reveal on a specific deployment (comma-separated ids). Lets a private
// preview expose an otherwise-hidden mission — e.g. a stealth re-open under end-to-end
// test — without surfacing it on the public production site. Production leaves this
// unset; a protected preview sets NEXT_PUBLIC_REVEALED_MISSIONS="4".
const REVEALED_MISSIONS: Set<number> = new Set(
  (process.env.NEXT_PUBLIC_REVEALED_MISSIONS || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n))
)
// Mission 4 (Frank) is blocked on public mainnet while its re-open is validated; reveal
// it only on the private tester preview via NEXT_PUBLIC_REVEALED_MISSIONS.
export const BLOCKED_MISSIONS: any = new Set(
  (process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? [0, 1, 2, 4] : []).filter(
    (id) => !REVEALED_MISSIONS.has(id)
  )
)
export const BLOCKED_PROJECTS: any = new Set(
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? [4, 10, 14, 90, 116, 118, 124] : [0, 3, 4, 5, 6, 7]
)
export const BLOCKED_MDPS: any = new Set(
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? [229, 238, 243, 246, 247]
    : []
)
export const BLOCKED_PROPOSALS: any = new Set([221])

export const FEATURED_TEAMS: any = [6, 7, 8, 13, 1, 9, 5, 4, 2]
