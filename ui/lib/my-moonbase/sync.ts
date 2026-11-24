/**
 * How the base in this browser and the copy saved to an account are brought
 * back in step.
 *
 * The browser keeps its own copy so the plot loads without a round trip and
 * survives a failed save. The account copy is what follows the visitor to
 * another device and what a share link shows. This module decides which of the
 * two stands when they differ.
 *
 * Pure. No React, no network, no storage.
 */
import { DEFAULT_BASE_NAME, type MoonbaseLayout } from './grid'

/** The copy of a base saved to an account. */
export type SavedBase = {
  /** Public id a share link carries. Never the wallet address. */
  id: string
  layout: MoonbaseLayout
  /** Server time of the last save, in ms. Doubles as the copy's version. */
  updatedAt: number
}

/** What this browser remembers about the last save it made or loaded. */
export type SyncMeta = {
  /** Wallet the layout in this browser was last saved under, lower case. */
  owner: string
  /** `updatedAt` of the account copy at that moment. */
  savedAt: number
  /** The layout has been edited since. */
  dirty: boolean
  shareId: string
}

export type SyncDecision =
  /** The two already agree, or there is nothing worth saving yet. */
  | 'keep'
  /** Save the browser's layout to the account. */
  | 'push'
  /** Replace the browser's layout with the account's. */
  | 'adopt'
  /** Both hold work the other lacks. Only the visitor can choose. */
  | 'conflict'

/** True when nothing stands on the plot. */
export function isBarePlot(layout: MoonbaseLayout): boolean {
  return layout.items.length === 0 && layout.roads.length === 0
}

function isUntouched(layout: MoonbaseLayout): boolean {
  return isBarePlot(layout) && (layout.name === DEFAULT_BASE_NAME || layout.name === '')
}

export function sameLayout(a: MoonbaseLayout, b: MoonbaseLayout): boolean {
  if (a === b) return true
  if (a.name !== b.name || a.items.length !== b.items.length || a.roads.length !== b.roads.length) {
    return false
  }
  for (let i = 0; i < a.roads.length; i++) if (a.roads[i] !== b.roads[i]) return false
  for (let i = 0; i < a.items.length; i++) {
    const p = a.items[i]
    const q = b.items[i]
    if (
      p.id !== q.id ||
      p.kind !== q.kind ||
      p.ref !== q.ref ||
      p.x !== q.x ||
      p.z !== q.z ||
      p.span !== q.span ||
      p.rot !== q.rot
    ) {
      return false
    }
  }
  return true
}

/**
 * Called once a wallet is known and its account copy has been read.
 * `remote` is null when that wallet has never saved a base.
 */
export function reconcile(input: {
  address: string
  local: MoonbaseLayout
  meta: SyncMeta | null
  remote: SavedBase | null
}): SyncDecision {
  const { address, local, meta, remote } = input
  if (!remote) return isUntouched(local) ? 'keep' : 'push'
  if (sameLayout(local, remote.layout)) return 'keep'

  const mine = meta?.owner === address.toLowerCase()
  if (mine) {
    if (!meta.dirty) return 'adopt'
    // Edits made here on top of the very copy the account still holds.
    if (meta.savedAt === remote.updatedAt) return 'push'
    return 'conflict'
  }
  // A base built before signing in, or under another wallet.
  return isBarePlot(local) ? 'adopt' : 'conflict'
}

export function parseSyncMeta(raw: unknown): SyncMeta | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Partial<Record<keyof SyncMeta, unknown>>
  if (typeof source.owner !== 'string' || !/^0x[0-9a-f]{40}$/.test(source.owner)) return null
  if (typeof source.savedAt !== 'number' || !Number.isFinite(source.savedAt)) return null
  return {
    owner: source.owner,
    savedAt: source.savedAt,
    dirty: source.dirty !== false,
    shareId: typeof source.shareId === 'string' ? source.shareId : '',
  }
}
