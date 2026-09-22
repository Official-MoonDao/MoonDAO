/**
 * Side markets — additional questions about a race that are not "who wins it".
 *
 * A side market is a full DePrize registry entry with its own CTF condition,
 * its own LMSR and its own outcome set. It is NOT a race binding: it never
 * carries a `sharedGoalId`, so `findDePrizeIdForGoal` keeps mapping one Moon
 * Base Zero goal to exactly one primary market and `goalIndexForChain`'s
 * duplicate-binding guard stays meaningful.
 *
 * Definitions live here rather than in `competitions.ts` for two reasons. A
 * side market is defined before it has an id — `DEPRIZE_COMPETITIONS` is keyed
 * by deprizeId, which a planned market does not have yet. And keeping the
 * editorial copy in one file lets the prize page, the Moon Base Zero panel and
 * the provisioning script read the same outcome list instead of three.
 *
 * Outcome sets freeze at `prepareCondition`, exactly like a race roster. Edit
 * a definition freely while its `REGISTERED_SIDE_MARKETS` entry is absent;
 * after that, changing it silently re-labels someone's position.
 */

/** Stable key for a side market. Never renumbered — it keys registered ids. */
export type SideMarketKey = 'touchdown-attitude' | 'touchdown-window'

export type SideMarketOutcome = {
  /** Stable key. Odds maps are keyed on this, never on the label. */
  key: string
  /** Display label on the outcome card. */
  label: string
  /**
   * How this outcome is judged, in one sentence, tied to a frozen Touchdown
   * test. This is the text that has to survive an argument on resolution day.
   */
  criterion: string
  /**
   * Registry `teamIds[i]` checksum, same role as `DePrizeRaceOutcome.teamId`.
   * Synthetic: `DePrizeRegistry.register` treats teamIds as opaque uint256 and
   * never looks up a Team NFT, so a side-market outcome does not need one.
   */
  teamId: number
}

export type SideMarketDefinition = {
  key: SideMarketKey
  /** Moon Base Zero race this sits beside. Never written as `sharedGoalId`. */
  parentGoalId: string
  /** Short label for the side-market list, e.g. "How it comes to rest". */
  label: string
  /** The question, as asked to a bettor. */
  question: string
  /**
   * Outcomes MUST be mutually exclusive and exhaustive: CTF payout numerators
   * are reported across the whole set, so a gap makes the market unresolvable
   * and an overlap makes it arguable. `sideMarketOutcomesArePartition` is the
   * structural half of that check; the semantic half is the criterion text.
   */
  outcomes: readonly SideMarketOutcome[]
}

/**
 * Touchdown asks which operator lands next. These ask what the landing looks
 * like when it happens. Both resolve off the same public facts as the parent,
 * which is why they must settle in the same Senate vote and the same Safe
 * batch — see docs/DEPRIZE_SIDE_MARKETS.md.
 */
export const SIDE_MARKETS: readonly SideMarketDefinition[] = [
  {
    key: 'touchdown-attitude',
    parentGoalId: 'shared-next-landing',
    label: 'How it comes to rest',
    question: 'How will the next lunar landing attempt end?',
    outcomes: [
      {
        key: 'upright-working',
        label: 'Upright and working',
        criterion:
          'Comes to rest in the planned orientation and returns surface data for 24 hours, or for its full published mission if that is shorter. Touchdown Tests 3 and 4 both pass.',
        teamId: 701,
      },
      {
        key: 'upright-short',
        label: 'Upright, then silent',
        criterion:
          'Planned orientation, but surface data stops before 24 hours and before the published mission ends. Test 3 passes, Test 4 fails.',
        teamId: 702,
      },
      {
        key: 'wrong-orientation',
        label: 'Down, but not as planned',
        criterion:
          'Soft touchdown in an orientation the operator did not plan, whatever it then returns. The IM-1, IM-2 and SLIM outcome. Test 3 fails.',
        teamId: 703,
      },
      {
        key: 'lost-on-descent',
        label: 'Lost on descent',
        criterion:
          'No controlled touchdown: the vehicle is destroyed or contact is lost before it reaches the surface. The Resilience outcome. Test 1 fails.',
        teamId: 704,
      },
    ],
  },
  {
    key: 'touchdown-window',
    parentGoalId: 'shared-next-landing',
    label: 'When it happens',
    question: 'When will the landing that settles Touchdown touch down?',
    outcomes: [
      {
        key: '2026-q4',
        label: 'By 31 Dec 2026',
        criterion: 'Touchdown UTC on or before 2026-12-31T23:59:59Z.',
        teamId: 711,
      },
      {
        key: '2027-h1',
        label: 'First half of 2027',
        criterion: 'Touchdown UTC between 2027-01-01T00:00:00Z and 2027-06-30T23:59:59Z.',
        teamId: 712,
      },
      {
        key: '2027-h2',
        label: 'Second half of 2027',
        criterion: 'Touchdown UTC between 2027-07-01T00:00:00Z and 2027-12-31T23:59:59Z.',
        teamId: 713,
      },
      {
        key: '2028-or-later',
        label: '2028 or later',
        criterion:
          'Touchdown UTC on or after 2028-01-01T00:00:00Z. This slot also absorbs the case where no qualifying landing happens before the market sunsets.',
        teamId: 714,
      },
    ],
  },
]

/**
 * chainSlug → side market key → registered DePrize id.
 *
 * Empty until `provision-sepolia-side-markets.ts` runs. A definition with no
 * entry here renders as Planned, the same way a capability-ladder rung with no
 * market does — the UI ships before the market exists.
 */
const REGISTERED_SIDE_MARKETS: Record<
  string,
  Partial<Record<SideMarketKey, number>>
> = {
  arbitrum: {},
  sepolia: {},
}

export type SideMarketStatus = 'live' | 'planned'

export type SideMarket = SideMarketDefinition & {
  status: SideMarketStatus
  /** Present only when status === 'live'. */
  deprizeId?: number
}

// Definitions are static, so cache the resolved views: callers memoize on
// identity and a fresh array per call busts those memos on every render.
const byGoalCache = new Map<string, readonly SideMarket[]>()

const EMPTY: readonly SideMarket[] = Object.freeze([])

function resolve(chainSlug: string, def: SideMarketDefinition): SideMarket {
  const deprizeId = REGISTERED_SIDE_MARKETS[chainSlug]?.[def.key]
  return Object.freeze({
    ...def,
    status: deprizeId != null ? ('live' as const) : ('planned' as const),
    ...(deprizeId != null ? { deprizeId } : {}),
  })
}

/**
 * Side markets attached to a race, in editorial order.
 * Identity is stable across calls for the same (chain, goal).
 */
export function getSideMarketsForGoal(
  chainSlug: string,
  parentGoalId: string | undefined
): readonly SideMarket[] {
  if (!parentGoalId) return EMPTY

  const cacheKey = `${chainSlug}:${parentGoalId}`
  const cached = byGoalCache.get(cacheKey)
  if (cached) return cached

  const matches = SIDE_MARKETS.filter((def) => def.parentGoalId === parentGoalId)
  const resolved = Object.freeze(matches.map((def) => resolve(chainSlug, def)))
  byGoalCache.set(cacheKey, resolved)
  return resolved
}

/**
 * Reverse lookup: is this DePrize id a side market, and which one?
 * The prize page uses this to render label outcomes instead of atlas
 * competitors, and to draw the "part of <parent>" backlink.
 */
export function getSideMarketByDePrizeId(
  chainSlug: string,
  deprizeId: number | undefined
): SideMarket | undefined {
  if (deprizeId === undefined || !Number.isFinite(deprizeId)) return undefined
  const registered = REGISTERED_SIDE_MARKETS[chainSlug]
  if (!registered) return undefined
  for (const [key, id] of Object.entries(registered)) {
    if (id !== deprizeId) continue
    const def = SIDE_MARKETS.find((d) => d.key === key)
    if (def) return resolve(chainSlug, def)
  }
  return undefined
}

/** True when this DePrize id is a side market rather than a prize. */
export function isSideMarketDePrize(
  chainSlug: string,
  deprizeId: number | undefined
): boolean {
  return getSideMarketByDePrizeId(chainSlug, deprizeId) !== undefined
}

/**
 * Structural partition check: at least two outcomes (the registry rejects
 * fewer), unique keys, and unique teamIds (the registry rejects duplicates).
 * This cannot prove the criteria are semantically exhaustive — that is what
 * the rules of record are for — but it catches the copy-paste failures.
 */
export function sideMarketOutcomesArePartition(
  outcomes: readonly SideMarketOutcome[]
): boolean {
  if (outcomes.length < 2) return false
  const keys = new Set<string>()
  const teamIds = new Set<number>()
  for (const outcome of outcomes) {
    if (!outcome.key || !outcome.label || !outcome.criterion) return false
    if (!Number.isInteger(outcome.teamId) || outcome.teamId <= 0) return false
    if (keys.has(outcome.key)) return false
    if (teamIds.has(outcome.teamId)) return false
    keys.add(outcome.key)
    teamIds.add(outcome.teamId)
  }
  return true
}
