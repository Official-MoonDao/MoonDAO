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
   * True once the organization has claimed its listing. Gates BRANDING ONLY
   * (logo + brand color); it never gates market visibility. See
   * {@link isCompetitorClaimed}. Distinct from the atlas `RosterStatus`, which
   * stays editorial metadata for panel copy — do not cross-wire them.
   */
  consented?: boolean
  /**
   * Open Field slot — any qualifying entrant not listed above. Odds land in
   * `fieldOdds`, never in `oddsByProjectId`.
   */
  field?: boolean
  /**
   * Optional vehicle / article name shown under the org on the live prize
   * page (e.g. "Griffin Mission One"). Atlas `project.name` is often a
   * family label ("Peregrine & Griffin Landers") and is the wrong line here.
   */
  vehicleLabel?: string
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
   * `teamId` is the alignment checksum; `consented` gates branding only.
   */
  outcomes?: DePrizeRaceOutcome[]
  /** Prior generation this entry superseded (off-chain lineage mirror). */
  supersedes?: number
  /** Next generation that superseded this entry (off-chain lineage mirror). */
  supersededBy?: number
}

export const GENERIC_DEPRIZE_COMPETITION: DePrizeCompetition = {
  title: 'DePrize',
  tagline: 'Back the competitor you think will win — live odds, payout when a winner is declared.',
  metaDescription:
    'Back the competitor you think will win — live odds, payout when a winner is declared.',
}

/** Stable prize-page path for a Moon Base Zero race. Resolves live or atlas. */
export function deprizeDetailHref(sharedGoalId: string): string {
  return `/deprize/${sharedGoalId}`
}

/** Path prefix → chain slug. `/deprize/sep/2` reads Sepolia no matter which network the wallet is on. */
const DEPRIZE_PREFIX_TO_SLUG: Record<string, string> = {
  sep: 'sepolia',
  sepolia: 'sepolia',
  arb: 'arbitrum',
  arbitrum: 'arbitrum',
}

const DEPRIZE_SLUG_TO_PREFIX: Record<string, string> = {
  sepolia: 'sep',
  arbitrum: 'arb',
}

const DEPRIZE_CHAIN_LABEL: Record<string, string> = {
  sepolia: 'Sepolia',
  arbitrum: 'Arbitrum',
}

export function deprizeChainSlugFromPrefix(prefix: string | undefined): string | undefined {
  if (!prefix) return undefined
  return DEPRIZE_PREFIX_TO_SLUG[prefix.toLowerCase()]
}

export function deprizeChainLabel(chainSlug: string): string {
  return DEPRIZE_CHAIN_LABEL[chainSlug] ?? chainSlug
}

/** Prize URL that always reads `chainSlug`, independent of the wallet network. */
export function deprizePrefixedHref(chainSlug: string, id: string | number): string {
  const prefix = DEPRIZE_SLUG_TO_PREFIX[chainSlug]
  return prefix ? `/deprize/${prefix}/${id}` : `/deprize/${id}`
}

/** Index for a chain. Sepolia is `/deprize/sep`, matching `/deprize/sep/:id`. */
export function deprizeIndexHref(chainSlug: string): string {
  const prefix = DEPRIZE_SLUG_TO_PREFIX[chainSlug]
  return prefix ? `/deprize/${prefix}` : '/deprize'
}

/** Chains whose competition map includes this id. */
export function findDePrizeChainSlugs(deprizeId: number | undefined): string[] {
  if (deprizeId === undefined || !Number.isFinite(deprizeId) || deprizeId <= 0) return []
  return Object.entries(DEPRIZE_COMPETITIONS)
    .filter(([, byId]) => !!byId[deprizeId])
    .map(([slug]) => slug)
}

/** Prize-page path that lands on the free prediction panel. */
export function deprizeForecastHref(deprizeId: number | string): string {
  return `/deprize/${deprizeId}#deprize-forecast`
}

/** chainSlug → deprizeId → competition */
const DEPRIZE_COMPETITIONS: Record<string, Record<number, DePrizeCompetition>> = {
  arbitrum: {
    // First Arbitrum mainnet DePrize — internal end-to-end competition.
    // Oracle at prepareCondition = deployer 0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011.
    // Roster is placeholder MoonDAOTeam ids [2, 6, 7, 8]; not race-bound, so it
    // groups under "Other challenges" on the index.
    1: {
      title: 'The Moon Is A Harsh Mistress',
      tagline: 'Which team posts “The Moon is a harsh mistress” first?',
      metaDescription:
        'Arbitrum DePrize: back the MoonDAO team you think will post “The Moon is a harsh mistress” first. Live LMSR odds, and every bet funds the prize pool.',
      questionId: '0xc3efda478f2465a1d402bfe9bc43fd04660daa72d0a71031594b341f2718adb9',
    },
  },
  sepolia: {
    // v2 registry (0x7208B0Ba9B1013000b8D30b60A462079300984E2).
    // Generation 1 is in the Senate vote with a reported winner, so it is
    // not bettable. Generation 2 is the open market.
    1: {
      title: 'Touchdown',
      tagline:
        'Which landing-vehicle operator lands upright on the Moon next and returns 24 hours of surface data? Back a competitor — every bet grows the prize pool.',
      metaDescription:
        'Sepolia DePrize for the next successful lunar landing. Astrobotic Griffin, Intuitive Machines, Firefly Blue Ghost, Blue Origin Blue Moon MK1, CNSA Chang’e-7, and the Open Field.',
      questionId: '0x2c633f9b1a6bd1a6252c49ed56f89d554a85e421ff84a146b1ae9e21f6311f7b',
      sharedGoalId: 'shared-next-landing',
      raceLabel: 'Next lunar landing',
      supersededBy: 2,
      outcomes: [
        { projectId: 'astrobotic-griffin', teamId: 601, vehicleLabel: 'Griffin Mission One' },
        { projectId: 'im-nova-c', teamId: 602, vehicleLabel: 'Nova-C IM-3' },
        { projectId: 'firefly-blue-ghost', teamId: 603, vehicleLabel: 'Blue Ghost M2' },
        { projectId: 'blue-origin-blue-moon-mk1', teamId: 604, vehicleLabel: 'Blue Moon MK1' },
        { projectId: 'cnsa-change-7', teamId: 605, vehicleLabel: "Chang'e-7" },
        { projectId: OPEN_FIELD_PROJECT_ID, teamId: 24, field: true },
      ],
    },
    // v2 registry id 2 — the open Touchdown market. Id 1 is in the Senate vote.
    2: {
      title: 'Touchdown',
      tagline:
        'Which landing-vehicle operator lands upright on the Moon next and returns 24 hours of surface data? Back a competitor — every bet grows the prize pool.',
      metaDescription:
        'Sepolia DePrize for the next successful lunar landing. Astrobotic Griffin, Intuitive Machines, Firefly Blue Ghost, Blue Origin Blue Moon MK1, CNSA Chang’e-7, and the Open Field.',
      questionId: '0x6498f99ba51f63aa7576860e9aff4a7afbc1e805e6c2aef9d4601840249c5898',
      sharedGoalId: 'shared-next-landing',
      raceLabel: 'Next lunar landing',
      supersedes: 1,
      outcomes: [
        { projectId: 'astrobotic-griffin', teamId: 601, vehicleLabel: 'Griffin Mission One' },
        { projectId: 'im-nova-c', teamId: 602, vehicleLabel: 'Nova-C IM-3' },
        { projectId: 'firefly-blue-ghost', teamId: 603, vehicleLabel: 'Blue Ghost M2' },
        { projectId: 'blue-origin-blue-moon-mk1', teamId: 604, vehicleLabel: 'Blue Moon MK1' },
        { projectId: 'cnsa-change-7', teamId: 605, vehicleLabel: "Chang'e-7" },
        { projectId: OPEN_FIELD_PROJECT_ID, teamId: 24, field: true },
      ],
    },
    // v2 registry id 3 — Night Shift. Rungs 1 and 2 (First Tracks, Ice) still
    // have no roster, so this is the next capability race that can open.
    3: {
      title: 'Night Shift',
      tagline:
        'Which power system delivers 10 watts, unplugged, through a lunar night in a cold vacuum chamber? Back a competitor — every bet grows the prize pool.',
      metaDescription:
        'Sepolia DePrize for lunar night power. Zeno Harmonia, Astrobotic NITE, Venturi, Perpetual Atomics ENDURE, CNNC, Rosatom, ISRO BARC, and the Open Field.',
      questionId: '0x6058f2c9f314734e1f1ecf8c34c8d8835fff5d8fb5e075d8044823e1717f00d4',
      sharedGoalId: 'shared-night-shift',
      raceLabel: 'Lunar night power',
      outcomes: [
        { projectId: 'zeno-harmonia', teamId: 611, vehicleLabel: 'Harmonia' },
        { projectId: 'astrobotic-nite', teamId: 612, vehicleLabel: 'NITE' },
        { projectId: 'venturi-lunar-battery', teamId: 613, vehicleLabel: 'Lunar-cycle battery' },
        { projectId: 'perpetual-atomics-endure', teamId: 614, vehicleLabel: 'ENDURE Am-241 RHU' },
        { projectId: 'cnnc-lunar-rtg', teamId: 615, vehicleLabel: "Chang'e lunar RTG" },
        { projectId: 'rosatom-lunar-rtg', teamId: 616, vehicleLabel: 'Rosatom lunar RTG' },
        { projectId: 'isro-barc-rhu', teamId: 617, vehicleLabel: 'BARC / LUPEX night survival' },
        { projectId: OPEN_FIELD_PROJECT_ID, teamId: 24, field: true },
      ],
    },
    // v2 id 4 was the crewed lunar rover, registered by mistake. It is not in
    // this map, and the index does not list shared-lunar-rover. Cancellation
    // was announced on the registry; the id stays on-chain until that notice ends.
    // v2 registry id 5 — unmanned commercial egress. Not the crewed rover.
    5: {
      title: 'First Tracks',
      tagline:
        'Which commercial rover leaves its lander and drives at least 10 metres first? Back a competitor — every bet grows the prize pool.',
      metaDescription:
        'Sepolia DePrize for the first commercial rover egress. Astrolab FLIP, Voyager CubeRover, Lunar Outpost MAPP, ispace Tenacious, Carnegie Mellon Iris, and the Open Field.',
      questionId: '0x5fe6f1664f0de1fc497411f5c6fc53cb2adbe80e6ba50078387f97bb66581dc8',
      sharedGoalId: 'shared-first-tracks',
      raceLabel: 'First Tracks',
      outcomes: [
        { projectId: 'astrolab-flip', teamId: 631, vehicleLabel: 'FLIP' },
        { projectId: 'voyager-cuberover', teamId: 632, vehicleLabel: 'CubeRover' },
        { projectId: 'lunar-outpost-mapp', teamId: 633, vehicleLabel: 'MAPP' },
        { projectId: 'ispace-tenacious', teamId: 634, vehicleLabel: 'Tenacious' },
        { projectId: 'cmu-iris', teamId: 635, vehicleLabel: 'Iris-class' },
        { projectId: OPEN_FIELD_PROJECT_ID, teamId: 24, field: true },
      ],
    },
    // v2 registry id 6 — 2027 in-situ surface water ice.
    6: {
      title: 'Ice',
      tagline:
        'Who first publishes in-situ confirmation of lunar surface water ice? Back a competitor — every bet grows the prize pool.',
      metaDescription:
        'Sepolia DePrize for the first published in-situ lunar water-ice dataset. Chang’e-7, VIPER on Blue Moon MK1, IM-4, and the Open Field.',
      questionId: '0x849f4a11bbe459437a4962debe34fe5d3a1ad64326d37bd60886cf26c1f74d2d',
      sharedGoalId: 'shared-ice',
      raceLabel: 'Surface water ice',
      outcomes: [
        { projectId: 'cnsa-change-7', teamId: 641, vehicleLabel: "Chang'e-7 hopper" },
        { projectId: 'blue-origin-viper', teamId: 642, vehicleLabel: 'VIPER on MK1' },
        { projectId: 'im-4-volatiles', teamId: 643, vehicleLabel: 'IM-4 volatiles' },
        { projectId: OPEN_FIELD_PROJECT_ID, teamId: 24, field: true },
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

/**
 * Live on-chain DePrize to feature at the top of /deprize — the first registered
 * competition on this chain that is NOT bound to a Moon Base Zero race. Today
 * that is Arbitrum #1 (The Moon Is A Harsh Mistress). Sepolia's prizes are
 * race-bound, so that chain has no featured slot.
 */
export function getFeaturedLiveDePrizeId(chainSlug: string): number | undefined {
  const entries = DEPRIZE_COMPETITIONS[chainSlug]
  if (!entries) return undefined
  const unbound = Object.entries(entries)
    .filter(([, c]) => !c.sharedGoalId)
    .map(([id]) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0)
    .sort((a, b) => a - b)
  return unbound[0]
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
 * A binding is usable when it names at least one real competitor. This is a
 * completeness check, NOT a consent check: listing a public company as a market
 * outcome does not require its permission, and hiding a bound market behind an
 * all-or-nothing consent flag was stricter than the disclosure it stood in for.
 * Implied endorsement is handled by the roster disclaimer plus withholding
 * trademarks until a competitor claims — see {@link isCompetitorClaimed}.
 */
export function isRaceBindingComplete(
  outcomes: readonly DePrizeRaceOutcome[] | undefined
): boolean {
  if (!outcomes?.length) return false
  return outcomes.some((o) => !o.field)
}

/** True when this outcome is the Open Field slot. */
export function isOpenFieldOutcome(outcome: DePrizeRaceOutcome | undefined): boolean {
  return !!outcome?.field
}

/**
 * True when a shared goal actually has more than one entrant to bet between.
 * A single-competitor "race" (today, only `shared-mass-driver`: an
 * open-source concept study with no funded developer) has nowhere for odds
 * to point — the sole entry is mechanically priced at 100% by both the mock
 * market (`ensureMarket` in mockMarket.ts, weight 1/N with N=1) and any real
 * LMSR, which reads as MoonDAO declaring that entrant the winning builder.
 * It isn't one; it's the only public writeup on the capability. Gate every
 * odds bar, Buy button, and pool figure in RaceMarketCard/SharedGoalPanel on
 * this so a capability nobody has committed to building yet is shown as an
 * open goal, not a market with a "leading" competitor.
 */
export function isCompetitiveRace(competitorCount: number): boolean {
  return competitorCount >= 2
}

/**
 * Has this competitor claimed its listing? Gates BRANDING ONLY (logo, brand
 * color) — never market visibility. Unclaimed competitors still render their
 * name and link, just with a neutral monogram instead of their mark.
 */
export function isCompetitorClaimed(outcome: DePrizeRaceOutcome | undefined): boolean {
  return outcome?.consented === true
}

/**
 * Shown wherever named competitors appear next to a market. This is the control
 * that replaced the consent gate, so it must render on any surface that lists
 * outcomes: the DePrize detail roster and the Moon Base Zero race panel.
 * Mirrors section 6 of the DePrize Terms and Conditions.
 */
export const ROSTER_DISCLAIMER =
  'Competitors are listed at MoonDAO’s editorial discretion. Listing does not mean the organization has entered, endorsed, or is affiliated with this prize. Bets are on outcomes, not on any affiliation.'

/**
 * True when a race is bound to an on-chain DePrize with a usable roster, so the
 * bridge may report live odds. Unbound goals keep their curator priors.
 */
export function isDePrizeGoalMarketBound(
  chainSlug: string,
  sharedGoalId: string | undefined
): boolean {
  if (!sharedGoalId) return false
  const deprizeId = findDePrizeIdForGoal(chainSlug, sharedGoalId)
  if (deprizeId === undefined) return false
  const binding = getDePrizeRaceBinding(chainSlug, deprizeId)
  return isRaceBindingComplete(binding?.outcomes)
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
