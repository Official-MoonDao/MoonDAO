import { findDePrizeIdForGoal, resolveLiveDePrizeId } from './competitions'

export type DePrizeLadderKey = 'touchdown' | 'first-tracks' | 'ice' | 'night-shift'

/** Three states, each with exactly one producer — see getLadderForCompetition. */
export type DePrizeLadderStatus = 'live' | 'planned' | 'achieved'

const SPEC = (file: string) =>
  `https://github.com/Official-MoonDao/MoonDAO/blob/main/docs/${file}`

/** Single public spec URL for the ladder page. Empty rung specHrefs must not 404. */
export const CAPABILITY_LADDER_SPEC_HREF = SPEC('DEPRIZE_CAPABILITY_LADDER.md')

export type CapabilityRung = {
  rung: number
  key: DePrizeLadderKey
  label: string
  bar: string
  /** Goal id of the market that satisfies this rung. Absent = not a market. NEVER a DePrize id. */
  sharedGoalId?: string
  /** Empty until the spec file exists on `main`. Empty = render as plain text, not a link. */
  specHref: string
  /** Only producer of `'achieved'`. Set by hand when a goal is retired with no successor. */
  statusOverride?: 'achieved'
}

export const CAPABILITY_LADDER: readonly CapabilityRung[] = [
  {
    rung: 0,
    key: 'touchdown',
    label: 'Touchdown',
    bar: 'Next upright working lunar landing',
    sharedGoalId: 'shared-next-landing',
    specHref: SPEC('DEPRIZE_TOUCHDOWN.md'),
  },
  {
    rung: 1,
    key: 'first-tracks',
    label: 'First Tracks',
    bar: 'First commercial rover egress and drive',
    specHref: '',
  },
  {
    rung: 2,
    key: 'ice',
    label: 'Ice',
    bar: '2027 in-situ surface water ice',
    specHref: '',
  },
  {
    rung: 3,
    key: 'night-shift',
    label: 'Night Shift',
    bar: 'Chamber proxy now · surface night 2028+',
    specHref: '',
  },
]

export type LadderRung = {
  rung: number
  key: DePrizeLadderKey
  label: string
  bar: string
  status: DePrizeLadderStatus
  /** Present only when status === 'live'. */
  deprizeId?: number
  /** '/deprize/<id>' when live; specHref when non-empty; otherwise undefined → render as text. */
  href?: string
  current: boolean
}

export type LadderForCompetition = {
  rungs: LadderRung[]
  currentKey: DePrizeLadderKey | undefined
}

export function getLadderForCompetition(
  chainSlug: string,
  deprizeId: number | undefined,
  // Seam for the supersede test. Defaults to the real registry lookup.
  deps: { findDePrizeIdForGoal: typeof findDePrizeIdForGoal } = { findDePrizeIdForGoal }
): LadderForCompetition {
  const viewedLiveId = resolveLiveDePrizeId(chainSlug, deprizeId)
  const rungs: LadderRung[] = CAPABILITY_LADDER.map((entry) => {
    const liveId = entry.sharedGoalId
      ? deps.findDePrizeIdForGoal(chainSlug, entry.sharedGoalId)
      : undefined
    const status: DePrizeLadderStatus =
      entry.statusOverride ?? (liveId != null ? 'live' : 'planned')
    const href =
      liveId != null ? `/deprize/${liveId}` : entry.specHref ? entry.specHref : undefined
    return {
      rung: entry.rung,
      key: entry.key,
      label: entry.label,
      bar: entry.bar,
      status,
      ...(status === 'live' && liveId != null ? { deprizeId: liveId } : {}),
      ...(href ? { href } : {}),
      current: liveId != null && viewedLiveId === liveId,
    }
  })
  return {
    rungs,
    currentKey: rungs.find((r) => r.current)?.key,
  }
}
