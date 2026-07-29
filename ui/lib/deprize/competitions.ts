/**
 * Per-competition copy + CTF questionId registry + Moon Base Zero race binding.
 *
 * Production admin/detail pages look up here instead of the global
 * DEPRIZE_QUESTION_ID / ORACLE_ADDRESS scalars (those stay for the
 * deprize-play harness only). Tech-tree prizes seed new entries here
 * until questionId moves on-chain.
 *
 * Seeding `questionId` is what lets the admin panel derive the oracle role
 * (keccak(caller, questionId, numOutcomes) == the market's conditionId). An
 * oracle that is neither registry owner nor fee-router owner cannot unlock the
 * panel without an entry here — resolve via Safe + DePrizeResolve.s.sol until
 * the competition is registered.
 *
 * Race binding (`sharedGoalId` / `outcomes`) is chain-keyed here on purpose:
 * a DePrize id is chain-specific, so Moon Base Zero's plain-string
 * `SharedGoalMarket.deprizeRegistryId` / `deprizeQuestionId` should be dropped
 * (or made a per-chain map) rather than duplicated — agree with Miguel before
 * either side writes atlas seed data that conflicts.
 */

/**
 * Reserved MoonDAOTeam id for the Open Field outcome slot.
 * Pending ops mint on Sepolia — see docs/DEPRIZE_QA.md. Intended id 999.
 */
export const OPEN_FIELD_TEAM_ID = 999

/** Stable projectId key for field outcomes (never rendered as an atlas competitor). */
export const OPEN_FIELD_PROJECT_ID = '__open-field__'

export type DePrizeRaceOutcome = {
  /** Atlas competitor project id (SharedGoal.projectIds / impliedOdds key). */
  projectId: string
  /**
   * Registry teamIds[i] checksum. When set, mapOutcomeOddsToProjectIds refuses
   * to emit odds if it disagrees with the on-chain roster at that index.
   */
  teamId?: number
  /**
   * Competitor consent for public markets. Outside sepolia, every non-field
   * outcome must be consented before the bridge reports status `live`.
   */
  consented?: boolean
  /**
   * Open Field slot — any qualifying entrant not listed above. Odds land in
   * `fieldOdds`, never in `oddsByProjectId`.
   */
  field?: boolean
}

export type DePrizeRaceBinding = {
  sharedGoalId: string
  raceLabel: string
  outcomes: DePrizeRaceOutcome[]
}

export type DePrizeCompetition = {
  /** <Head> title + optional page title suffix. */
  title: string
  /** Header paragraph under the DePrize #{id} title. */
  tagline: string
  /** <Head> meta description. */
  metaDescription: string
  /** CTF questionId used at prepareCondition (needed by reportPayouts). */
  questionId?: string
  /** Moon Base Zero capability race this DePrize settles (SharedGoal.id). */
  sharedGoalId?: string
  /** Short race label for index grouping, e.g. "Fission surface power". */
  raceLabel?: string
  /**
   * CTF outcome index → atlas competitor. Order MUST match registry teamIds.
   * `teamId` is the alignment checksum; `consented` gates public markets.
   */
  outcomes?: DePrizeRaceOutcome[]
  /** Prior generation this entry superseded (off-chain lineage mirror). */
  supersedes?: number
  /** Next generation that superseded this entry (off-chain lineage mirror). */
  supersededBy?: number
}

export const GENERIC_DEPRIZE_COMPETITION: DePrizeCompetition = {
  title: 'DePrize',
  tagline:
    'Back the team you think will win — live odds, payout when a winner is declared.',
  metaDescription:
    'Back the team you think will win — live odds, payout when a winner is declared.',
}

/** chainSlug → deprizeId → competition */
const DEPRIZE_COMPETITIONS: Record<string, Record<number, DePrizeCompetition>> = {
  sepolia: {
    // Browser QA fixture — see docs/DEPRIZE_QA.md (DePrize 9).
    // Oracle at prepareCondition = deployer 0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011.
    // Bound to Moon Base Zero shared-fission-power; teamIds 301/302/303 map 1:1
    // to the race's three competitors in registry order.
    9: {
      title: 'Fission surface power',
      tagline:
        'Sepolia QA fixture for the fission surface power race — three Team NFTs, live LMSR odds, FeeRouter-owned market.',
      metaDescription:
        'Sepolia DePrize bound to the Moon Base Zero fission surface power race. Back a competitor and cash out or claim when resolved.',
      questionId:
        '0xab937cdea2250786bf37ee2dd06f244bbeed62159c337927074523844d5759fb',
      sharedGoalId: 'shared-fission-power',
      raceLabel: 'Fission surface power',
      outcomes: [
        {
          projectId: 'westinghouse-fission-surface-power',
          teamId: 301,
        },
        {
          projectId: 'lockheed-fission-surface-power',
          teamId: 302,
        },
        {
          projectId: 'ix-fission-surface-power',
          teamId: 303,
        },
      ],
    },
  },
}

/** True when this (chain, id) has an explicit registry entry. */
export function isKnownDePrizeCompetition(
  chainSlug: string,
  deprizeId: number | undefined
): boolean {
  if (deprizeId === undefined || !Number.isFinite(deprizeId)) return false
  return !!DEPRIZE_COMPETITIONS[chainSlug]?.[deprizeId]
}

/** Competition copy for a DePrize; falls back to generic copy when unregistered. */
export function getDePrizeCompetition(
  chainSlug: string,
  deprizeId: number | undefined
): DePrizeCompetition {
  if (deprizeId === undefined || !Number.isFinite(deprizeId)) {
    return GENERIC_DEPRIZE_COMPETITION
  }
  return DEPRIZE_COMPETITIONS[chainSlug]?.[deprizeId] ?? GENERIC_DEPRIZE_COMPETITION
}

/** CTF questionId for a DePrize, or undefined when not registered. */
export function getDePrizeQuestionId(
  chainSlug: string,
  deprizeId: number | undefined
): string | undefined {
  if (deprizeId === undefined || !Number.isFinite(deprizeId)) return undefined
  return DEPRIZE_COMPETITIONS[chainSlug]?.[deprizeId]?.questionId
}

// Bindings are derived from a static registry, so cache them: callers memoize
// on binding identity, and a fresh object per call busts those memos on every
// render (React consumers would recompute odds forever).
const bindingCache = new Map<string, DePrizeRaceBinding | undefined>()

/**
 * Race binding for a DePrize, or undefined when unregistered / unbound.
 * Identity is stable across calls for the same (chain, id).
 */
export function getDePrizeRaceBinding(
  chainSlug: string,
  deprizeId: number | undefined
): DePrizeRaceBinding | undefined {
  if (deprizeId === undefined || !Number.isFinite(deprizeId)) return undefined

  const key = `${chainSlug}:${deprizeId}`
  if (bindingCache.has(key)) return bindingCache.get(key)

  const c = DEPRIZE_COMPETITIONS[chainSlug]?.[deprizeId]
  const binding =
    !c?.sharedGoalId || !c.raceLabel || !c.outcomes?.length
      ? undefined
      : Object.freeze({
          sharedGoalId: c.sharedGoalId,
          raceLabel: c.raceLabel,
          outcomes: c.outcomes,
        })
  bindingCache.set(key, binding)
  return binding
}

/** True when this chain has at least one race-bound competition entry. */
export function chainHasRaceBindings(chainSlug: string): boolean {
  const entries = DEPRIZE_COMPETITIONS[chainSlug]
  if (!entries) return false
  return Object.values(entries).some(
    (c) => !!c.sharedGoalId && !!c.raceLabel && !!c.outcomes?.length
  )
}

// Read through globalThis: this module is also compiled by the dependency-free
// mocha runner, which has no node type definitions for a bare `process`.
function isProductionEnv(): boolean {
  return (globalThis as any)?.process?.env?.NODE_ENV === 'production'
}

// Memoized reverse index: chainSlug → sharedGoalId → live tip deprizeId.
const goalIndexByChain = new Map<string, Map<string, number>>()

/** The two lineage links a generation can carry. */
export type DePrizeGenerationLinks = {
  supersedes?: number
  supersededBy?: number
}

/**
 * Walk `supersededBy` forward to the newest generation.
 * Tolerates a malformed registry: a cycle stops the walk instead of hanging.
 */
export function liveTipOf(
  generations: Record<number, DePrizeGenerationLinks>,
  deprizeId: number
): number {
  let tip = deprizeId
  const seen = new Set<number>([tip])
  for (;;) {
    const next = generations[tip]?.supersededBy
    if (next === undefined || !Number.isFinite(next) || seen.has(next)) break
    seen.add(next)
    tip = next
  }
  return tip
}

/**
 * 1-indexed generation number, found by walking `supersedes` backward.
 * Tolerates a malformed registry: a cycle stops the walk instead of hanging.
 */
export function generationNumberOf(
  generations: Record<number, DePrizeGenerationLinks>,
  deprizeId: number
): number {
  let gen = 1
  let cur = deprizeId
  const seen = new Set<number>([cur])
  for (;;) {
    const prev = generations[cur]?.supersedes
    if (prev === undefined || !Number.isFinite(prev) || seen.has(prev)) break
    seen.add(prev)
    gen++
    cur = prev
  }
  return gen
}

function goalIndexForChain(chainSlug: string): Map<string, number> {
  const cached = goalIndexByChain.get(chainSlug)
  if (cached) return cached

  const map = new Map<string, number>()
  const entries = DEPRIZE_COMPETITIONS[chainSlug] ?? {}
  for (const [idStr, comp] of Object.entries(entries)) {
    if (!comp.sharedGoalId) continue
    const deprizeId = Number(idStr)
    const tip = liveTipOf(entries, deprizeId)
    if (map.has(comp.sharedGoalId)) {
      const existingTip = map.get(comp.sharedGoalId)!
      // Same race lineage (generations share a goal) — keep the live tip.
      if (existingTip === tip) continue
      const message = `Duplicate DePrize race binding on ${chainSlug}: sharedGoalId "${comp.sharedGoalId}" maps to both #${existingTip} and #${tip}`
      // Loud in dev/test so the seed error is caught before merge; in
      // production keep the first binding rather than crashing the page.
      if (!isProductionEnv()) throw new Error(message)
      console.error(`[deprize] ${message}`)
      continue
    }
    map.set(comp.sharedGoalId, tip)
  }
  goalIndexByChain.set(chainSlug, map)
  return map
}

/**
 * Walk off-chain `supersededBy` links to the live generation tip.
 * The live generation is the only one that feeds Moon Base Zero odds.
 */
export function resolveLiveDePrizeId(
  chainSlug: string,
  deprizeId: number | undefined
): number | undefined {
  if (deprizeId === undefined || !Number.isFinite(deprizeId)) return undefined
  return liveTipOf(DEPRIZE_COMPETITIONS[chainSlug] ?? {}, deprizeId)
}

/**
 * Generation number (1-indexed) by walking `supersedes` links backward.
 */
export function getDePrizeGenerationNumber(
  chainSlug: string,
  deprizeId: number | undefined
): number {
  if (deprizeId === undefined || !Number.isFinite(deprizeId)) return 1
  return generationNumberOf(DEPRIZE_COMPETITIONS[chainSlug] ?? {}, deprizeId)
}

/**
 * Reverse lookup: Moon Base Zero SharedGoal.id → live DePrize id on this chain.
 * When multiple generations share a goal, returns the tip (newest) generation.
 * Throws outside production if the registry maps two unrelated DePrize ids to
 * the same goal (built once, then cached).
 */
export function findDePrizeIdForGoal(
  chainSlug: string,
  sharedGoalId: string | undefined
): number | undefined {
  if (!sharedGoalId) return undefined
  const bound = goalIndexForChain(chainSlug).get(sharedGoalId)
  return resolveLiveDePrizeId(chainSlug, bound)
}

/**
 * Pure consent check on an outcomes array.
 * Sepolia is always publishable (QA). Elsewhere every non-field outcome must
 * have `consented: true`. Field slots are not competitors and are skipped.
 */
export function areRaceOutcomesPublishable(
  chainSlug: string,
  outcomes: readonly DePrizeRaceOutcome[] | undefined
): boolean {
  if (!outcomes?.length) return false
  if (chainSlug === 'sepolia') return true
  const competitors = outcomes.filter((o) => !o.field)
  if (!competitors.length) return false
  return competitors.every((o) => o.consented === true)
}

/** True when this outcome is the Open Field slot. */
export function isOpenFieldOutcome(
  outcome: DePrizeRaceOutcome | undefined
): boolean {
  return !!outcome?.field
}

/**
 * Consent gate for reporting a race market as live.
 * Unbound goals are not publishable. See {@link areRaceOutcomesPublishable}.
 */
export function isDePrizeGoalMarketPublishable(
  chainSlug: string,
  sharedGoalId: string | undefined
): boolean {
  if (!sharedGoalId) return false
  const deprizeId = findDePrizeIdForGoal(chainSlug, sharedGoalId)
  if (deprizeId === undefined) return false
  const binding = getDePrizeRaceBinding(chainSlug, deprizeId)
  return areRaceOutcomesPublishable(chainSlug, binding?.outcomes)
}

export type DePrizeIndexRaceGroup = {
  /** Null means the unbound "Other challenges" bucket. */
  raceLabel: string | null
  deprizeIds: number[]
  /** False when the chain has no race bindings — render a flat list. */
  showHeading: boolean
}

/**
 * Partition registry ids 1..count by raceLabel for the index page.
 * Unbound ids collect under raceLabel null ("Other challenges").
 * When the chain has no bindings, returns one flat group with showHeading false.
 */
export function partitionDePrizeIndexByRace(
  chainSlug: string,
  count: number
): DePrizeIndexRaceGroup[] {
  if (!Number.isFinite(count) || count <= 0) return []

  const hasBindings = chainHasRaceBindings(chainSlug)
  if (!hasBindings) {
    return [
      {
        raceLabel: null,
        deprizeIds: Array.from({ length: count }, (_, i) => i + 1),
        showHeading: false,
      },
    ]
  }

  const byLabel = new Map<string, number[]>()
  const other: number[] = []
  const labelOrder: string[] = []

  for (let id = 1; id <= count; id++) {
    const binding = getDePrizeRaceBinding(chainSlug, id)
    if (!binding) {
      other.push(id)
      continue
    }
    const existing = byLabel.get(binding.raceLabel)
    if (existing) {
      existing.push(id)
    } else {
      byLabel.set(binding.raceLabel, [id])
      labelOrder.push(binding.raceLabel)
    }
  }

  const groups: DePrizeIndexRaceGroup[] = labelOrder.map((raceLabel) => ({
    raceLabel,
    deprizeIds: byLabel.get(raceLabel)!,
    showHeading: true,
  }))
  if (other.length > 0) {
    groups.push({ raceLabel: null, deprizeIds: other, showHeading: true })
  }
  return groups
}
