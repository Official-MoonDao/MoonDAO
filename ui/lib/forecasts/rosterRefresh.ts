import type { ForecastCaller } from '@/lib/forecasts/consensusTypes'

/** Long enough that a reload inside the consensus CDN window still busts it. */
export const ROSTER_FRESH_WINDOW_MS = 3 * 60 * 1000

export type RosterNotice = {
  chain: string
  deprizeId: number
  address: string
  /** Outcome label they picked. Omitted when the pick is unknown. */
  pick?: string
  removed: boolean
}

export type RosterOverlay = {
  address: string
  pick?: string
  removed: boolean
}

export type RosterStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function rosterFreshKey(chain: string, deprizeId: number): string {
  return `deprize-roster-fresh:${chain}:${deprizeId}`
}

/**
 * True when `savedAt` falls in the open window that ends `windowMs` after the
 * write. A missing or future timestamp is not a fresh write.
 */
export function rosterWithinFreshWindow(
  savedAt: number | null | undefined,
  now: number,
  windowMs = ROSTER_FRESH_WINDOW_MS
): boolean {
  if (savedAt == null || !Number.isFinite(savedAt) || !Number.isFinite(now)) return false
  const age = now - savedAt
  return age >= 0 && age < windowMs
}

function browserRosterStore(): RosterStore | null {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage
}

export function readRosterNeedsFresh(
  chain: string,
  deprizeId: number,
  now = Date.now(),
  store: RosterStore | null = browserRosterStore()
): boolean {
  if (!store) return false
  const raw = store.getItem(rosterFreshKey(chain, deprizeId))
  if (raw == null || raw === '') return false
  return rosterWithinFreshWindow(Number(raw), now)
}

export function markRosterWritten(
  chain: string,
  deprizeId: number,
  now = Date.now(),
  store: RosterStore | null = browserRosterStore()
): void {
  store?.setItem(rosterFreshKey(chain, deprizeId), String(now))
}

export function leadingPickLabel(
  allocation: readonly number[],
  labels: readonly string[]
): string | undefined {
  let best = -1
  allocation.forEach((value, i) => {
    if (value > 0 && (best < 0 || value > (allocation[best] ?? 0))) best = i
  })
  return best >= 0 ? labels[best] : undefined
}

function allocationForLabel(pick: string | undefined, labels: readonly string[]): number[] | null {
  if (!pick) return null
  const index = labels.indexOf(pick)
  if (index < 0) return null
  return labels.map((_, i) => (i === index ? 100 : 0))
}

function blankCaller(address: string, allocation: number[]): ForecastCaller {
  return {
    voterAddress: address,
    citizenId: '',
    citizenName: address,
    allocation,
    weight: 0,
    storedVmooney: 0,
    liveVmooney: 0,
    updatedAt: 0,
    brier: null,
    skill: null,
  }
}

/**
 * Server rows plus optimistic saves. A save that the fresh response has not
 * indexed yet stays on the list. A clear stays hidden while the response
 * still includes that wallet.
 */
export function mergeCallerRoster(
  server: readonly ForecastCaller[],
  overlays: readonly RosterOverlay[],
  labels: readonly string[]
): ForecastCaller[] {
  const removed = new Set(
    overlays.filter((row) => row.removed).map((row) => row.address.toLowerCase())
  )
  const pending = new Map<string, RosterOverlay>()
  for (const row of overlays) {
    if (row.removed) continue
    pending.set(row.address.toLowerCase(), row)
  }

  const merged: ForecastCaller[] = []
  const seen = new Set<string>()
  for (const row of server) {
    const address = row.voterAddress.toLowerCase()
    if (removed.has(address) || seen.has(address)) continue
    seen.add(address)
    const pick = pending.get(address)?.pick
    const allocation = allocationForLabel(pick, labels)
    merged.push(
      allocation ? { ...row, voterAddress: address, allocation } : { ...row, voterAddress: address }
    )
  }
  for (const row of pending.values()) {
    const address = row.address.toLowerCase()
    if (seen.has(address)) continue
    seen.add(address)
    merged.push(blankCaller(address, allocationForLabel(row.pick, labels) ?? labels.map(() => 0)))
  }
  return merged
}

/** Drop an overlay once the server roster agrees with it. Keep it until then. */
export function pruneRosterOverlays(
  overlays: readonly RosterOverlay[],
  server: readonly ForecastCaller[],
  labels: readonly string[]
): RosterOverlay[] {
  return overlays.filter((overlay) => {
    const address = overlay.address.toLowerCase()
    const row = server.find((entry) => entry.voterAddress.toLowerCase() === address)
    if (overlay.removed) return Boolean(row)
    if (!row) return true
    if (!overlay.pick) return false
    return leadingPickLabel(row.allocation, labels) !== overlay.pick
  })
}

type RosterListener = (notice: RosterNotice) => void

const listeners = new Set<RosterListener>()

export function subscribeRoster(listener: RosterListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyRoster(
  notice: RosterNotice,
  now = Date.now(),
  store?: RosterStore | null
): void {
  const target = store === undefined ? browserRosterStore() : store
  markRosterWritten(notice.chain, notice.deprizeId, now, target)
  const payload: RosterNotice = { ...notice, address: notice.address.toLowerCase() }
  for (const listener of [...listeners]) listener(payload)
}
