/**
 * Which atlas hardware a visitor has backed, read off their saved predictions.
 *
 * A prediction is a row in the Forecasts table keyed by a vote id, and its
 * payload names outcome slots, not competitors. This module maps both back to
 * atlas ids the same way the race panels do: a race bound to a DePrize predicts
 * under the prize id against the prize roster, and every other race predicts
 * under its reserved atlas id against its frozen slot list.
 *
 * Pure. No React, no network.
 */
import {
  findDePrizeIdForGoal,
  getDePrizeRaceBinding,
  isCompetitiveRace,
  isDePrizeGoalMarketBound,
} from '@/lib/deprize/competitions'
import { decodeForecastVote, deprizeForecastVoteId } from '@/lib/deprize/forecastVote'
import { atlasForecastBook } from '@/lib/forecasts/atlasBook'
import type { SharedGoal } from '@/lib/lunar-atlas/types'

export type RaceBook = {
  goalId: string
  /** Forecasts vote id this race's predictions are saved under. */
  voteId: number
  /** Atlas project id at each outcome slot. Undefined for a retired or field slot. */
  outcomeIds: readonly (string | undefined)[]
  /** Set when the race is bound to a DePrize on this chain, so it can also be bet on. */
  deprizeId?: number
}

export type ForecastRow = { voteId: number; vote: unknown }

export type PickSource = 'forecast' | 'bet'

export type RacePick = { goalId: string; projectId: string; source: PickSource }

export type MoonbasePick = {
  projectId: string
  /** Every race this asset was backed in, in the order first seen. */
  goalIds: string[]
  sources: PickSource[]
}

/** True when the race has a field to choose between, so it can be predicted at all. */
export function isPredictableRace(goal: Pick<SharedGoal, 'projectIds'>): boolean {
  return isCompetitiveRace(goal.projectIds.length)
}

/** The book each predictable race saves under on this chain. */
export function raceBooks(chainSlug: string, goals: readonly SharedGoal[]): RaceBook[] {
  const books: RaceBook[] = []
  for (const goal of goals) {
    if (!isPredictableRace(goal)) continue
    if (isDePrizeGoalMarketBound(chainSlug, goal.id)) {
      const deprizeId = findDePrizeIdForGoal(chainSlug, goal.id)
      const binding = getDePrizeRaceBinding(chainSlug, deprizeId)
      if (deprizeId === undefined || !binding) continue
      books.push({
        goalId: goal.id,
        voteId: deprizeForecastVoteId(deprizeId),
        outcomeIds: binding.outcomes.map((outcome) =>
          outcome.field ? undefined : outcome.projectId
        ),
        deprizeId,
      })
      continue
    }
    const book = atlasForecastBook(goal.id, goal.projectIds)
    if (!book) continue
    books.push({
      goalId: goal.id,
      voteId: book.voteId,
      // A competitor that left the race keeps its slot number but is no
      // longer something this race can be won by.
      outcomeIds: book.outcomeIds.map((projectId, index) =>
        projectId !== undefined && book.outcomeIndexOf(projectId) === index ? projectId : undefined
      ),
    })
  }
  return books
}

/** Every competitor a set of saved predictions puts weight on. */
export function picksFromForecastRows(
  rows: readonly ForecastRow[],
  books: readonly RaceBook[]
): RacePick[] {
  const byVoteId = new Map(books.map((book) => [book.voteId, book]))
  const picks: RacePick[] = []
  for (const row of rows) {
    const book = byVoteId.get(row.voteId)
    if (!book) continue
    const decoded = decodeForecastVote(row.vote, book.outcomeIds.length)
    if (!decoded) continue
    decoded.allocation.forEach((weight, index) => {
      const projectId = book.outcomeIds[index]
      if (weight > 0 && projectId) {
        picks.push({ goalId: book.goalId, projectId, source: 'forecast' })
      }
    })
  }
  return picks
}

/**
 * A prediction this page has just saved or removed. The gateway takes a while
 * to see a new row, so until it does this stands in for the race's row.
 * `index` is the outcome slot picked, or null when the prediction was removed.
 */
export type PickOverlay = { voteId: number; index: number | null }

/** Saved rows with each overlaid race's row replaced by what was just written. */
export function overlayForecastRows(
  rows: readonly ForecastRow[],
  overlays: readonly PickOverlay[],
  books: readonly RaceBook[]
): ForecastRow[] {
  if (overlays.length === 0) return [...rows]
  const latest = new Map(overlays.map((overlay) => [overlay.voteId, overlay.index]))
  const out = rows.filter((row) => !latest.has(row.voteId))
  for (const [voteId, index] of latest) {
    const book = books.find((b) => b.voteId === voteId)
    if (index === null || !book || index < 0 || index >= book.outcomeIds.length) continue
    out.push({ voteId, vote: { v: 1, a: { [String(index)]: 100 }, vp: 0 } })
  }
  return out
}

/** Every competitor a wallet holds outcome tokens on, in a race bound to a DePrize. */
export function picksFromBets(
  book: RaceBook | undefined,
  balances: readonly { index: number; balance: number }[]
): RacePick[] {
  if (!book) return []
  const picks: RacePick[] = []
  for (const { index, balance } of balances) {
    const projectId = book.outcomeIds[index]
    if (balance > 0 && projectId) picks.push({ goalId: book.goalId, projectId, source: 'bet' })
  }
  return picks
}

/** One entry per asset, however many races or ways it was backed. */
export function mergePicks(picks: readonly RacePick[]): MoonbasePick[] {
  const byProject = new Map<string, MoonbasePick>()
  for (const pick of picks) {
    let merged = byProject.get(pick.projectId)
    if (!merged) {
      merged = { projectId: pick.projectId, goalIds: [], sources: [] }
      byProject.set(pick.projectId, merged)
    }
    if (!merged.goalIds.includes(pick.goalId)) merged.goalIds.push(pick.goalId)
    if (!merged.sources.includes(pick.source)) merged.sources.push(pick.source)
  }
  return [...byProject.values()]
}
