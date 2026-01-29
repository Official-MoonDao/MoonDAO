//https://docs.google.com/spreadsheets/d/1LsYxkI_1alFUD_NxM2a5RngeSRC5e5ElUpP6aR30DiM/edit?gid=0#gid=0
export const BLOCKED_TEAMS: any = new Set([])
export const BLOCKED_CITIZENS: any = new Set([48, 72, 140])
export const BLOCKED_MISSIONS: any = new Set(
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? [0, 1, 2] : []
)
export const BLOCKED_PROJECTS: any = new Set(
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? [4, 10, 14, 90] : [0, 3, 4, 5, 6, 7]
)
export const BLOCKED_PROPOSALS: any = new Set([221])

export const FEATURED_TEAMS: any = [6, 7, 8, 13, 1, 9, 5, 4, 2]
