/**
 * Client-only demo betting sandbox for capability races that don't have a
 * bound on-chain DePrize market yet. Moon Base Zero curates 8 capability
 * races (`lib/lunar-atlas/seed/atlas.dataset.json`), but only one is wired to
 * a live Sepolia LMSR/mint router at any given time — the rest carry curator
 * `impliedOdds` priors with no way to actually place a bet.
 *
 * This module lets the `/deprize` index page simulate the full bet → odds
 * move → position → cash out loop for those unbound races so the product can
 * be tested end to end before every race has a deployed market. No real value
 * ever moves: everything lives in `localStorage` and is clearly labeled
 * "Demo" everywhere it surfaces.
 */

import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'deprize:mock:v1'
const UPDATE_EVENT = 'deprize-mock-updated'

export type MockPosition = {
  /** Outcome-token qty — mirrors real markets, where 1 token redeems for 1 ETH if it wins. */
  qty: number
  costEth: number
}

type MockMarketState = {
  pool: number
  /** Unnormalized odds weights keyed by atlas projectId. */
  weights: Record<string, number>
}

type MockStore = {
  markets: Record<string, MockMarketState>
  // address (or 'guest') -> sharedGoalId -> projectId -> position
  positions: Record<string, Record<string, Record<string, MockPosition>>>
}

function emptyStore(): MockStore {
  return { markets: {}, positions: {} }
}

function readStore(): MockStore {
  if (typeof window === 'undefined') return emptyStore()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw)
    return {
      markets: parsed?.markets ?? {},
      positions: parsed?.positions ?? {},
    }
  } catch {
    return emptyStore()
  }
}

function writeStore(store: MockStore) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* quota / private mode — demo data just won't persist */
  }
  window.dispatchEvent(new Event(UPDATE_EVENT))
}

// Deterministic-but-varied starting prize pool per race so demo cards don't
// all show an identical number. Range mirrors real Sepolia fixture pools
// (roughly 0.005 - 0.06 ETH) so it reads believably next to the live market.
function seedPool(sharedGoalId: string): number {
  let h = 0
  for (let i = 0; i < sharedGoalId.length; i++) {
    h = (h * 31 + sharedGoalId.charCodeAt(i)) >>> 0
  }
  const frac = (h % 1000) / 1000
  return Math.round((0.005 + frac * 0.055) * 1e6) / 1e6
}

function ensureMarket(
  store: MockStore,
  sharedGoalId: string,
  projectIds: string[],
  impliedOdds: Record<string, number> | undefined,
): MockMarketState {
  const existing = store.markets[sharedGoalId]
  if (existing) {
    // New competitors added to the atlas after this market was first seeded
    // (or a stale localStorage entry) still need a starting weight.
    for (const id of projectIds) {
      if (existing.weights[id] === undefined) {
        existing.weights[id] = impliedOdds?.[id] ?? 1 / projectIds.length
      }
    }
    return existing
  }
  const weights: Record<string, number> = {}
  for (const id of projectIds) {
    weights[id] = impliedOdds?.[id] ?? 1 / projectIds.length
  }
  const created: MockMarketState = { pool: seedPool(sharedGoalId), weights }
  store.markets[sharedGoalId] = created
  return created
}

export type MockMarketSnapshot = {
  pool: number
  /** Percent (0-100) per projectId — always renormalized to sum to ~100 across the roster. */
  odds: Record<string, number>
  positions: Record<string, MockPosition>
}

/** Read-only snapshot of a demo market + the given address's positions in it. */
export function getMockMarket(
  sharedGoalId: string,
  projectIds: string[],
  impliedOdds: Record<string, number> | undefined,
  address: string | undefined,
): MockMarketSnapshot {
  const store = readStore()
  const market = ensureMarket(store, sharedGoalId, projectIds, impliedOdds)
  const totalWeight = projectIds.reduce((sum, id) => sum + (market.weights[id] ?? 0), 0) || 1
  const odds: Record<string, number> = {}
  for (const id of projectIds) {
    odds[id] = ((market.weights[id] ?? 0) / totalWeight) * 100
  }
  const positions = store.positions[address ?? 'guest']?.[sharedGoalId] ?? {}
  return { pool: market.pool, odds, positions }
}

// How strongly a bet shifts the demo odds toward the backed outcome. Tuned so
// a typical testnet-sized bet (0.01-0.1 ETH) moves the line a few points —
// enough to feel alive without pretending to be a real AMM.
const ODDS_IMPACT = 3

/** Simulate placing a bet: grows the pool, nudges odds, and records a position. */
export function placeMockBet(
  sharedGoalId: string,
  projectIds: string[],
  impliedOdds: Record<string, number> | undefined,
  projectId: string,
  address: string | undefined,
  amountEth: number,
): { qty: number; costEth: number } {
  const store = readStore()
  const market = ensureMarket(store, sharedGoalId, projectIds, impliedOdds)
  const totalWeightBefore =
    projectIds.reduce((sum, id) => sum + (market.weights[id] ?? 0), 0) || 1
  const priceBefore = Math.max((market.weights[projectId] ?? 0) / totalWeightBefore, 0.01)
  const qty = amountEth / priceBefore

  market.pool = Math.round((market.pool + amountEth) * 1e6) / 1e6
  market.weights[projectId] = (market.weights[projectId] ?? 0) + amountEth * ODDS_IMPACT

  const who = address ?? 'guest'
  if (!store.positions[who]) store.positions[who] = {}
  if (!store.positions[who][sharedGoalId]) store.positions[who][sharedGoalId] = {}
  const prevPos = store.positions[who][sharedGoalId][projectId]
  store.positions[who][sharedGoalId][projectId] = {
    qty: (prevPos?.qty ?? 0) + qty,
    costEth: (prevPos?.costEth ?? 0) + amountEth,
  }

  writeStore(store)
  return { qty, costEth: amountEth }
}

/** Simulate cashing out a full demo position at the current implied price. Returns ETH received. */
export function exitMockPosition(
  sharedGoalId: string,
  projectId: string,
  address: string | undefined,
): number {
  const store = readStore()
  const who = address ?? 'guest'
  const pos = store.positions[who]?.[sharedGoalId]?.[projectId]
  if (!pos) return 0
  const market = store.markets[sharedGoalId]
  const totalWeight = market
    ? Object.values(market.weights).reduce((s, w) => s + w, 0) || 1
    : 1
  const price = market ? (market.weights[projectId] ?? 0) / totalWeight : 0
  const valueEth = Math.round(pos.qty * price * 1e6) / 1e6

  delete store.positions[who][sharedGoalId][projectId]
  if (market) {
    market.weights[projectId] = Math.max(0.001, (market.weights[projectId] ?? 0) - pos.qty * price * ODDS_IMPACT)
    market.pool = Math.max(0, Math.round((market.pool - valueEth) * 1e6) / 1e6)
  }
  writeStore(store)
  return valueEth
}

/** Wipe all demo markets/positions (a "reset demo data" escape hatch for QA). */
export function resetMockData() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event(UPDATE_EVENT))
}

function subscribeMockMarket(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(UPDATE_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(UPDATE_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/** Live-updating view of one demo market, re-rendering whenever any tab writes to it. */
export function useMockMarket(
  sharedGoalId: string,
  projectIds: string[],
  impliedOdds: Record<string, number> | undefined,
  address: string | undefined,
): MockMarketSnapshot {
  const [tick, setTick] = useState(0)
  useEffect(() => subscribeMockMarket(() => setTick((t) => t + 1)), [])
  const idsKey = projectIds.join(',')
  return useMemo(
    () => getMockMarket(sharedGoalId, projectIds, impliedOdds, address),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sharedGoalId, idsKey, address, tick],
  )
}
