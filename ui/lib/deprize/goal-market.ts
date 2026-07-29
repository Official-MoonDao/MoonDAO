/**
 * Merge live DePrize odds into a Moon Base Zero shared goal.
 *
 * Deliberately NOT typed against `@/lib/lunar-atlas` — those types ship with the
 * Moon Base Zero branch, and this module has to build and unit test without them.
 * The structural types below are a subset that the atlas `SharedGoal` already
 * satisfies, so the page can call this with its concrete type and get it back
 * unchanged.
 *
 * Keep dependency-free for yarn test:deprize.
 */

import { OPEN_FIELD_PROJECT_ID } from './competitions'

/** Subset of the atlas `MarketStatus` union. */
export type MergeableMarketStatus = 'none' | 'planned' | 'live' | 'resolved'

/** Subset of the atlas `SharedGoalMarket`. */
export type MergeableMarket = {
  status: MergeableMarketStatus
  /** Fractions of 1 keyed by atlas projectId. */
  impliedOdds?: Record<string, number>
}

/** Subset of the atlas `SharedGoal`. */
export type MergeableGoal = {
  id: string
  market?: MergeableMarket
}

/** What the goal-odds bridge produces for one race. */
export type LiveGoalOdds = {
  deprizeId: number | undefined
  oddsByProjectId: Record<string, number> | undefined
  fieldOdds: number | undefined
  status: 'live' | 'resolved' | 'planned'
}

/**
 * Swap a goal's curator priors for live market-implied odds.
 *
 * Returns the goal untouched when there is nothing trustworthy to show: no bound
 * DePrize, a `planned` bridge status (unbound, superseded, or still loading), or
 * an empty odds map. Curator priors are better than a blank market, so a partial
 * result must never overwrite them.
 *
 * Open Field mass is carried under {@link OPEN_FIELD_PROJECT_ID} so the rendered
 * bars still sum to ~1 rather than silently overstating the named competitors.
 */
export function mergeLiveMarket<T extends MergeableGoal>(
  goal: T,
  live: LiveGoalOdds | undefined
): T {
  if (!live || live.deprizeId === undefined) return goal
  if (live.status === 'planned') return goal

  const odds = live.oddsByProjectId
  if (!odds || Object.keys(odds).length === 0) return goal

  const impliedOdds: Record<string, number> = { ...odds }
  if (live.fieldOdds !== undefined && Number.isFinite(live.fieldOdds)) {
    impliedOdds[OPEN_FIELD_PROJECT_ID] = live.fieldOdds
  }

  return {
    ...goal,
    market: {
      // A goal can be bound before a curator ever wrote a market block.
      ...(goal.market ?? { status: 'planned' as MergeableMarketStatus }),
      status: live.status,
      impliedOdds,
    },
  }
}

/**
 * Merge live odds into whichever goal in the list the bridge was mounted for.
 * Every other goal is returned by reference so downstream memos that key on
 * identity (buildTechTrees, the races memo) only recompute when they must.
 *
 * Takes and returns a mutable array on purpose: `buildTechTrees(projects,
 * sharedGoals: SharedGoal[])` rejects `readonly`, and copying the result to
 * satisfy that would defeat the identity preservation above.
 */
export function mergeLiveMarketInto<T extends MergeableGoal>(
  goals: T[],
  sharedGoalId: string | undefined,
  live: LiveGoalOdds | undefined
): T[] {
  if (!sharedGoalId || !live) return goals
  let changed = false
  const next = goals.map((g) => {
    if (g.id !== sharedGoalId) return g
    const merged = mergeLiveMarket(g, live)
    if (merged !== g) changed = true
    return merged
  })
  return changed ? next : goals
}
