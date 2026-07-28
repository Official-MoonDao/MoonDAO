//https://docs.google.com/spreadsheets/d/1LsYxkI_1alFUD_NxM2a5RngeSRC5e5ElUpP6aR30DiM/edit?gid=0#gid=0
export const BLOCKED_TEAMS: any = new Set([])
export const BLOCKED_CITIZENS: any = new Set([48, 72, 140, 177])
export const BLOCKED_MISSIONS: any = new Set(
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? [0, 1, 2] : []
)
// Blocked missions that remain reachable on their page with an access code
// (process.env.MISSION_ACCESS_CODE) — a private, shareable stealth test for an
// unannounced mission. Blocked-but-not-gated missions stay fully 404'd.
// See pages/mission/[tokenId].tsx.
export const GATED_MISSIONS: Set<number> = new Set()
export const BLOCKED_PROJECTS: any = new Set(
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? [4, 10, 14, 90, 116, 118, 124] : [0, 3, 4, 5, 6, 7]
)
export const BLOCKED_MDPS: any = new Set(
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? [229, 243, 246, 247, 252, 253, 256, 257, 263]
    : []
)
export const BLOCKED_PROPOSALS: any = new Set([221])

export const FEATURED_TEAMS: any = [6, 7, 8, 13, 1, 9, 5, 4, 2]

// Citizen token ids to spotlight on /join as social proof (astronauts,
// founders, notable community members). Edit this list directly to change
// who appears in the featured-citizens marquee.
export const FEATURED_CITIZENS: number[] = [
  22, 4, 158, 45, 77, 175, 17, 111, 162, 8, 217, 186,
]

// Marketing tagline shown under each featured citizen's name — not derivable
// from on-chain data, so it's maintained here alongside the id list above.
export const FEATURED_CITIZEN_ROLES: Record<number, string> = {
  22: 'NASA Astronaut Candidate · Inspiration4 Pilot',
  4: 'Citizen Astronaut · Blue Origin',
  158: 'Inspiration4 Mission Astronaut',
  45: 'Civil Rights Advocate · Blue Origin Astronaut',
  77: 'Author, The Overview Effect',
  175: '668th Human in Space · Virgin Galactic',
  17: 'Founder, SpaceFund & EarthLight Foundation',
  111: 'Executive Director, The Mars Society',
  162: 'Commercial Astronaut · Physician',
  8: 'Founder of LifeShip',
  217: 'NASA Astronaut',
  186: 'Virgin Galactic Spaceflight Participant · Galactic 07',
}
