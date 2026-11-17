/**
 * Free forecasts for Moon Base Zero races that have no DePrize on chain.
 *
 * A DePrize race predicts under its prize id. Every other race in the atlas
 * predicts under a fixed id from the reserved range below, with one outcome per
 * competitor. Forecasts is a plain uint256 keyed table, so no deployment is
 * involved, and no ETH market is implied. A saved forecast stores only the
 * outcome slot (`{index: 100}`), so that slot is the competitor's identity.
 *
 * Vote ids and outcome slots are written out rather than derived from the
 * dataset. Reordering, inserting, or removing atlas entries must never move a
 * saved prediction onto another race or another team. Append a competitor by
 * giving them the next free slot. Never renumber. The atlas test fails when a
 * race or competitor is missing from these maps.
 */
export const ATLAS_FORECAST_VOTE_ID_BASE = 1_000_000

export const ATLAS_FORECAST_VOTE_IDS: Readonly<Record<string, number>> = Object.freeze({
  'shared-next-landing': ATLAS_FORECAST_VOTE_ID_BASE + 1,
  'shared-first-tracks': ATLAS_FORECAST_VOTE_ID_BASE + 2,
  'shared-ice': ATLAS_FORECAST_VOTE_ID_BASE + 3,
  'shared-night-shift': ATLAS_FORECAST_VOTE_ID_BASE + 4,
  'shared-landing-pads': ATLAS_FORECAST_VOTE_ID_BASE + 5,
  'shared-crewed-lander': ATLAS_FORECAST_VOTE_ID_BASE + 6,
  'shared-isru-oxygen': ATLAS_FORECAST_VOTE_ID_BASE + 7,
  'shared-lunar-rover': ATLAS_FORECAST_VOTE_ID_BASE + 8,
  'shared-fission-power': ATLAS_FORECAST_VOTE_ID_BASE + 9,
  'shared-habitat': ATLAS_FORECAST_VOTE_ID_BASE + 10,
  'shared-lunar-comms': ATLAS_FORECAST_VOTE_ID_BASE + 11,
  'shared-mass-driver': ATLAS_FORECAST_VOTE_ID_BASE + 12,
})

/**
 * On-chain outcome slot for each competitor. The number is the identity.
 * Deleting a line must not change any other number — a gap is a retired slot,
 * and the next competitor appends at max + 1.
 */
export const ATLAS_FORECAST_OUTCOMES: Readonly<Record<string, Readonly<Record<string, number>>>> =
  Object.freeze({
    'shared-next-landing': Object.freeze({
      'astrobotic-griffin': 0,
      'im-nova-c': 1,
      'firefly-blue-ghost': 2,
      'blue-origin-blue-moon-mk1': 3,
      'cnsa-change-7': 4,
      'ispace-apex': 5,
      'spacex-starship-hls': 6,
    }),
    'shared-first-tracks': Object.freeze({
      'astrolab-flip': 0,
      'voyager-cuberover': 1,
      'lunar-outpost-mapp': 2,
      'ispace-tenacious': 3,
      'cmu-iris': 4,
    }),
    'shared-ice': Object.freeze({
      'cnsa-change-7': 0,
      'blue-origin-viper': 1,
      'im-4-volatiles': 2,
    }),
    'shared-night-shift': Object.freeze({
      'zeno-harmonia': 0,
      'astrobotic-nite': 1,
      'venturi-lunar-battery': 2,
      'perpetual-atomics-endure': 3,
      'cnnc-lunar-rtg': 4,
      'rosatom-lunar-rtg': 5,
      'isro-barc-rhu': 6,
    }),
    'shared-landing-pads': Object.freeze({
      'icon-project-olympus': 0,
      'redwire-mason': 1,
      'astroport-lunatron': 2,
      'ai-spacefactory-react': 3,
      'astrobotic-additive-construction': 4,
    }),
    'shared-crewed-lander': Object.freeze({
      'spacex-starship-hls': 0,
      'blue-origin-blue-moon-mk2': 1,
    }),
    'shared-isru-oxygen': Object.freeze({
      'blue-origin-blue-alchemist': 0,
      'sierra-space-carbothermal': 1,
      'lunar-resources-mre': 2,
      'cislune-lunar-isru': 3,
    }),
    'shared-lunar-rover': Object.freeze({
      'astrolab-flex': 0,
      'lunar-outpost-lunar-dawn': 1,
      'im-moon-racer': 2,
    }),
    'shared-fission-power': Object.freeze({
      'westinghouse-fission-surface-power': 0,
      'lockheed-fission-surface-power': 1,
      'ix-fission-surface-power': 2,
    }),
    'shared-habitat': Object.freeze({
      'nasa-artemis-base-camp': 0,
      ilrs: 1,
      'thales-mph': 2,
      'sierra-space-life': 3,
      'jaxa-lunar-cruiser': 4,
    }),
    'shared-lunar-comms': Object.freeze({
      'nokia-lunar-lte': 0,
      'im-near-space-network': 1,
      'esa-lunar-pathfinder': 2,
      'crescent-parsec': 3,
      'solstar-lunar-wifi': 4,
    }),
    'shared-mass-driver': Object.freeze({
      'lunar-mass-driver-concept': 0,
    }),
  })

export type AtlasForecastBook = {
  /** Forecasts voteId, and the `deprizeId` the forecast session is keyed by. */
  voteId: number
  numOutcomes: number
  /** Project id at each on-chain slot. A retired slot is undefined. */
  outcomeIds: readonly (string | undefined)[]
  /** Outcome slot for a competitor still in this race, or undefined. */
  outcomeIndexOf: (projectId: string) => number | undefined
}

/**
 * Slots in index order, or undefined when two competitors share a slot or a
 * slot number is not a whole number. Length is one past the highest slot, so
 * a gap does not slide the competitors above it down.
 */
function outcomeIdsFor(
  assigned: Readonly<Record<string, number>>
): readonly (string | undefined)[] | undefined {
  let max = -1
  const used = new Set<number>()
  for (const index of Object.values(assigned)) {
    if (!Number.isInteger(index) || index < 0 || used.has(index)) return undefined
    used.add(index)
    if (index > max) max = index
  }
  if (max < 0) return undefined
  const outcomeIds: (string | undefined)[] = Array.from({ length: max + 1 }, () => undefined)
  for (const [projectId, index] of Object.entries(assigned)) {
    outcomeIds[index] = projectId
  }
  return Object.freeze(outcomeIds)
}

/**
 * The forecast book for a race with no DePrize, or undefined when it cannot
 * take predictions: no reserved id, or fewer than two competitors to choose
 * between.
 *
 * `projectIds` says who is still in the race. It does not assign slots.
 */
export function atlasForecastBook(
  goalId: string | undefined,
  projectIds: readonly string[]
): AtlasForecastBook | undefined {
  if (!goalId) return undefined
  const voteId = ATLAS_FORECAST_VOTE_IDS[goalId]
  const assigned = ATLAS_FORECAST_OUTCOMES[goalId]
  if (voteId === undefined || assigned === undefined || projectIds.length < 2) return undefined
  const outcomeIds = outcomeIdsFor(assigned)
  if (!outcomeIds || outcomeIds.length < 2) return undefined
  const live = new Set(projectIds)
  return {
    voteId,
    numOutcomes: outcomeIds.length,
    outcomeIds,
    outcomeIndexOf: (projectId) => {
      if (!live.has(projectId)) return undefined
      const index = assigned[projectId]
      if (index === undefined || outcomeIds[index] !== projectId) return undefined
      return index
    },
  }
}
