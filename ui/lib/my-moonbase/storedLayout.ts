/**
 * Checks a layout sent by a browser before it is saved to an account.
 *
 * The server cannot measure hardware: footprints come from the 3D models,
 * which only load in a browser. So it keeps the footprint each asset was sent
 * with, within the plot, and enforces everything else itself: known hardware
 * and scenery only, one of each asset, nothing overlapping, nothing off the
 * plot, and the item cap. Every browser that later loads the layout re-reads
 * the footprints from its own catalogue (see `sanitizeLayout`).
 *
 * Pure. No React, no network.
 */
import type { AtlasDataset } from '@/lib/lunar-atlas/types'
import { decorById } from './decor'
import { GRID_CELLS, MAX_ITEMS, sanitizeLayout, type ItemKind, type MoonbaseLayout } from './grid'
import { isPredictableRace } from './picks'

/** Longest item id kept. The builder's own are 36-character UUIDs. */
export const MAX_ITEM_ID_LENGTH = 64
/** Largest request body the save route reads. A full plot is about 40 KB. */
export const MAX_LAYOUT_BYTES = 96 * 1024

/** Atlas ids of every piece of hardware that stands in a race someone can predict. */
export function placeableAssetIds(dataset: AtlasDataset): Set<string> {
  return new Set(dataset.sharedGoals.filter(isPredictableRace).flatMap((goal) => goal.projectIds))
}

/** Null when `raw` is not a layout at all. */
export function sanitizeIncomingLayout(
  raw: unknown,
  assetIds: ReadonlySet<string>
): MoonbaseLayout | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as { v?: unknown; items?: unknown; roads?: unknown }
  if (!Array.isArray(source.items) || !Array.isArray(source.roads)) return null
  // More than a full plot can hold is not something the builder produces.
  if (source.items.length > MAX_ITEMS || source.roads.length > GRID_CELLS * GRID_CELLS) return null

  const claimedSpan = new Map<string, number>()
  const items = source.items.filter((entry) => {
    if (!entry || typeof entry !== 'object') return false
    const item = entry as { id?: unknown; kind?: unknown; ref?: unknown; span?: unknown }
    if (typeof item.id !== 'string' || item.id.length > MAX_ITEM_ID_LENGTH) return false
    if (item.kind === 'asset' && typeof item.ref === 'string' && assetIds.has(item.ref)) {
      const span = Number(item.span)
      if (!Number.isInteger(span) || span < 1 || span > GRID_CELLS) return false
      if (!claimedSpan.has(item.ref)) claimedSpan.set(item.ref, span)
    }
    return true
  })

  const spanFor = (kind: ItemKind, ref: string) =>
    kind === 'asset' ? claimedSpan.get(ref) : decorById(ref)?.span
  const layout = sanitizeLayout({ ...source, items }, spanFor)
  // `sanitizeLayout` answers an unknown version with an empty plot. Saving
  // that would wipe the account copy.
  return source.v === layout.v ? layout : null
}
