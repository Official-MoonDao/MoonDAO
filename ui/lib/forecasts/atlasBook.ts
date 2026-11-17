/**
 * Free forecasts for Moon Base Zero races that have no DePrize on chain.
 *
 * A DePrize race predicts under its prize id. Every other race in the atlas
 * predicts under a fixed id from the reserved range below, with one outcome per
 * competitor in `SharedGoal.projectIds` order. Forecasts is a plain uint256
 * keyed table, so no deployment is involved, and no ETH market is implied.
 *
 * Ids are written out rather than derived from the dataset so reordering or
 * renaming atlas entries can never move a saved prediction onto another race.
 * The atlas test fails when a race is missing from this map.
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

export type AtlasForecastBook = {
  /** Forecasts voteId, and the `deprizeId` the forecast session is keyed by. */
  voteId: number
  numOutcomes: number
  /** Outcome slot for a competitor, or undefined when it is not in this race. */
  outcomeIndexOf: (projectId: string) => number | undefined
}

/**
 * The forecast book for a race with no DePrize, or undefined when it cannot
 * take predictions: no reserved id, or fewer than two competitors to choose
 * between.
 */
export function atlasForecastBook(
  goalId: string | undefined,
  projectIds: readonly string[]
): AtlasForecastBook | undefined {
  if (!goalId) return undefined
  const voteId = ATLAS_FORECAST_VOTE_IDS[goalId]
  if (voteId === undefined || projectIds.length < 2) return undefined
  return {
    voteId,
    numOutcomes: projectIds.length,
    outcomeIndexOf: (projectId) => {
      const index = projectIds.indexOf(projectId)
      return index >= 0 ? index : undefined
    },
  }
}
