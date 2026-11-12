/**
 * A guest who signs in to an existing account cannot keep the guest wallet:
 * Privy only upgrades a guest into a new account. The guest's forecasts are
 * copied here and then deleted from the guest wallet. The prize page writes
 * each one again from the account's wallet. The copy stays until that
 * rewrite succeeds.
 */

export const GUEST_HANDOFF_STORAGE_KEY = 'deprize:guest-forecast-handoff'

export type PendingHandoff = {
  chainSlug: string
  deprizeId: number
  /** Raw `vote` JSON from the guest's Forecasts row. */
  vote: string
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function storage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function readPendingHandoffs(store: StorageLike | null = storage()): PendingHandoff[] {
  if (!store) return []
  try {
    const parsed = JSON.parse(store.getItem(GUEST_HANDOFF_STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (row): row is PendingHandoff =>
        !!row &&
        typeof row.chainSlug === 'string' &&
        Number.isInteger(row.deprizeId) &&
        typeof row.vote === 'string'
    )
  } catch {
    return []
  }
}

/** False when the copy could not be saved. Callers must not delete the on-chain rows then. */
export function writePendingHandoffs(
  rows: PendingHandoff[],
  store: StorageLike | null = storage()
): boolean {
  if (!store) return false
  try {
    if (rows.length === 0) {
      store.removeItem(GUEST_HANDOFF_STORAGE_KEY)
      return true
    }
    store.setItem(GUEST_HANDOFF_STORAGE_KEY, JSON.stringify(rows))
    return true
  } catch {
    return false
  }
}

/** One row per prize. Later rows replace earlier ones, so a retry does not duplicate. */
export function mergePendingHandoffs(...groups: PendingHandoff[][]): PendingHandoff[] {
  const byPrize = new Map<string, PendingHandoff>()
  for (const group of groups) {
    for (const row of group) {
      byPrize.set(`${row.chainSlug}:${row.deprizeId}`, row)
    }
  }
  return [...byPrize.values()]
}

/** The pending forecast for one prize, left in storage for a retry. */
export function peekPendingHandoff(
  chainSlug: string,
  deprizeId: number,
  store: StorageLike | null = storage()
): PendingHandoff | null {
  return (
    readPendingHandoffs(store).find(
      (row) => row.chainSlug === chainSlug && row.deprizeId === deprizeId
    ) ?? null
  )
}

/** Removes and returns the pending forecast for one prize, if any. */
export function takePendingHandoff(
  chainSlug: string,
  deprizeId: number,
  store: StorageLike | null = storage()
): PendingHandoff | null {
  const rows = readPendingHandoffs(store)
  const match = rows.find((row) => row.chainSlug === chainSlug && row.deprizeId === deprizeId)
  if (!match) return null
  writePendingHandoffs(
    rows.filter((row) => row !== match),
    store
  )
  return match
}
