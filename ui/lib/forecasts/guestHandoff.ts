/**
 * A guest who signs in to an existing account cannot keep the guest wallet:
 * Privy only upgrades a guest into a new account. The guest's forecasts are
 * deleted from the guest wallet and remembered here, and the prize page
 * writes each one again from the account's wallet.
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

export function writePendingHandoffs(
  rows: PendingHandoff[],
  store: StorageLike | null = storage()
): void {
  if (!store) return
  if (rows.length === 0) {
    store.removeItem(GUEST_HANDOFF_STORAGE_KEY)
    return
  }
  store.setItem(GUEST_HANDOFF_STORAGE_KEY, JSON.stringify(rows))
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
