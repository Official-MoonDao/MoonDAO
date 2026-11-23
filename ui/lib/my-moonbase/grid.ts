/**
 * The My Moonbase build plot: a square grid of cells holding placed items and
 * road tiles.
 *
 * Pure data and pure functions. No React, three or DOM, so the placement rules
 * run in the unit suite without a GPU. Every operation returns the layout it
 * was given when nothing changed, which is how the caller knows not to record
 * an undo step.
 */

/** Edge of one cell, in meters. A road tile is one cell wide. */
export const CELL_M = 6
/** Cells per side of the plot. */
export const GRID_CELLS = 40
/** Edge of the whole plot, in meters. */
export const PLOT_M = CELL_M * GRID_CELLS
/** Placed items, across assets and scenery. Keeps the scene inside its frame budget. */
export const MAX_ITEMS = 200
export const MAX_NAME_LENGTH = 40
export const LAYOUT_VERSION = 1
export const DEFAULT_BASE_NAME = 'My Moonbase'

export type Cell = { x: number; z: number }
/** Quarter turns about the vertical axis. */
export type Rot = 0 | 1 | 2 | 3
export type ItemKind = 'asset' | 'decor'

export type PlacedItem = {
  id: string
  kind: ItemKind
  /** Atlas project id for an asset, scenery id for decor. */
  ref: string
  /** Min-corner cell of the footprint. */
  x: number
  z: number
  /** Footprint edge in cells. The footprint is always square. */
  span: number
  rot: Rot
}

export type MoonbaseLayout = {
  v: typeof LAYOUT_VERSION
  name: string
  items: PlacedItem[]
  /** Road tiles as `x,z` cell keys. */
  roads: string[]
}

export function emptyLayout(): MoonbaseLayout {
  return { v: LAYOUT_VERSION, name: DEFAULT_BASE_NAME, items: [], roads: [] }
}

export function cellKey(x: number, z: number): string {
  return `${x},${z}`
}

export function parseCellKey(key: string): Cell | null {
  const match = /^(\d+),(\d+)$/.exec(key)
  if (!match) return null
  const cell = { x: Number(match[1]), z: Number(match[2]) }
  return inBounds(cell.x, cell.z) ? cell : null
}

/** True when a `span`-wide footprint with this min corner lies on the plot. */
export function inBounds(x: number, z: number, span = 1): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(z) &&
    Number.isInteger(span) &&
    span >= 1 &&
    x >= 0 &&
    z >= 0 &&
    x + span <= GRID_CELLS &&
    z + span <= GRID_CELLS
  )
}

/** Footprint edge, in cells, for hardware that covers `radiusM` of ground. */
export function spanForRadius(radiusM: number): number {
  if (!(radiusM > 0)) return 1
  return Math.min(GRID_CELLS, Math.max(1, Math.ceil((2 * radiusM) / CELL_M)))
}

/**
 * Min corner that centres a footprint on the cell under the pointer, pulled
 * back onto the plot at the edges so a large asset can still be placed there.
 */
export function footprintAnchor(cell: Cell, span: number): Cell {
  const lead = Math.floor((span - 1) / 2)
  const max = Math.max(0, GRID_CELLS - span)
  return {
    x: Math.min(max, Math.max(0, cell.x - lead)),
    z: Math.min(max, Math.max(0, cell.z - lead)),
  }
}

/** Meters from the plot centre to the low edge of cell index `i`. */
export function cellEdgeM(i: number): number {
  return (i - GRID_CELLS / 2) * CELL_M
}

export function cellCenterM(cell: Cell): Cell {
  return { x: cellEdgeM(cell.x) + CELL_M / 2, z: cellEdgeM(cell.z) + CELL_M / 2 }
}

/** Centre of a footprint, in meters from the plot centre. */
export function footprintCenterM(x: number, z: number, span: number): Cell {
  return {
    x: cellEdgeM(x) + (span * CELL_M) / 2,
    z: cellEdgeM(z) + (span * CELL_M) / 2,
  }
}

/** The cell under a point given in meters from the plot centre, or null off the plot. */
export function cellAtM(xM: number, zM: number): Cell | null {
  const x = Math.floor(xM / CELL_M + GRID_CELLS / 2)
  const z = Math.floor(zM / CELL_M + GRID_CELLS / 2)
  return inBounds(x, z) ? { x, z } : null
}

function overlaps(
  a: { x: number; z: number; span: number },
  b: { x: number; z: number; span: number }
): boolean {
  return a.x < b.x + b.span && b.x < a.x + a.span && a.z < b.z + b.span && b.z < a.z + a.span
}

function covers(item: { x: number; z: number; span: number }, cell: Cell): boolean {
  return (
    cell.x >= item.x &&
    cell.x < item.x + item.span &&
    cell.z >= item.z &&
    cell.z < item.z + item.span
  )
}

export function itemAt(layout: MoonbaseLayout, cell: Cell): PlacedItem | undefined {
  return layout.items.find((item) => covers(item, cell))
}

export function hasRoad(layout: MoonbaseLayout, cell: Cell): boolean {
  return layout.roads.includes(cellKey(cell.x, cell.z))
}

/**
 * Whether a footprint is free: on the plot, clear of every other item and clear
 * of road. `ignoreId` leaves one item out, for moving it over its own ground.
 */
export function canPlace(
  layout: MoonbaseLayout,
  footprint: { x: number; z: number; span: number },
  ignoreId?: string
): boolean {
  if (!inBounds(footprint.x, footprint.z, footprint.span)) return false
  for (const item of layout.items) {
    if (item.id !== ignoreId && overlaps(item, footprint)) return false
  }
  for (const key of layout.roads) {
    const cell = parseCellKey(key)
    if (cell && covers(footprint, cell)) return false
  }
  return true
}

/** Adds an item. Unchanged when the ground is taken, the id repeats, or the plot is full. */
export function placeItem(layout: MoonbaseLayout, item: PlacedItem): MoonbaseLayout {
  if (layout.items.length >= MAX_ITEMS) return layout
  if (layout.items.some((existing) => existing.id === item.id)) return layout
  // One of each asset: a prediction backs one machine, not a fleet of it.
  if (
    item.kind === 'asset' &&
    layout.items.some((existing) => existing.kind === 'asset' && existing.ref === item.ref)
  ) {
    return layout
  }
  if (!canPlace(layout, item)) return layout
  return { ...layout, items: [...layout.items, item] }
}

export function moveItem(layout: MoonbaseLayout, id: string, to: Cell): MoonbaseLayout {
  const item = layout.items.find((existing) => existing.id === id)
  if (!item || (item.x === to.x && item.z === to.z)) return layout
  if (!canPlace(layout, { x: to.x, z: to.z, span: item.span }, id)) return layout
  return {
    ...layout,
    items: layout.items.map((existing) =>
      existing.id === id ? { ...existing, x: to.x, z: to.z } : existing
    ),
  }
}

export function setItemRot(layout: MoonbaseLayout, id: string, rot: Rot): MoonbaseLayout {
  const item = layout.items.find((existing) => existing.id === id)
  if (!item || item.rot === rot) return layout
  return {
    ...layout,
    items: layout.items.map((existing) => (existing.id === id ? { ...existing, rot } : existing)),
  }
}

export function nextRot(rot: Rot): Rot {
  return ((rot + 1) % 4) as Rot
}

export function removeItem(layout: MoonbaseLayout, id: string): MoonbaseLayout {
  if (!layout.items.some((item) => item.id === id)) return layout
  return { ...layout, items: layout.items.filter((item) => item.id !== id) }
}

/**
 * Cells of a road drawn between two picks: along x first, then along z, so two
 * clicks give a straight run or a single right-angle bend.
 */
export function roadPath(from: Cell, to: Cell): Cell[] {
  const cells: Cell[] = []
  const stepX = to.x >= from.x ? 1 : -1
  for (let x = from.x; x !== to.x + stepX; x += stepX) cells.push({ x, z: from.z })
  const stepZ = to.z >= from.z ? 1 : -1
  for (let z = from.z + stepZ; z !== to.z + stepZ && to.z !== from.z; z += stepZ) {
    cells.push({ x: to.x, z })
  }
  return cells
}

/** True when a road tile may be laid here: on the plot and not under an item. */
export function canPave(layout: MoonbaseLayout, cell: Cell): boolean {
  return inBounds(cell.x, cell.z) && !itemAt(layout, cell)
}

/** Lays road on every cell that can take it and skips the rest. */
export function addRoads(layout: MoonbaseLayout, cells: readonly Cell[]): MoonbaseLayout {
  const roads = new Set(layout.roads)
  const before = roads.size
  for (const cell of cells) {
    if (canPave(layout, cell)) roads.add(cellKey(cell.x, cell.z))
  }
  if (roads.size === before) return layout
  return { ...layout, roads: [...roads] }
}

export function removeRoad(layout: MoonbaseLayout, cell: Cell): MoonbaseLayout {
  const key = cellKey(cell.x, cell.z)
  if (!layout.roads.includes(key)) return layout
  return { ...layout, roads: layout.roads.filter((road) => road !== key) }
}

export function renameBase(layout: MoonbaseLayout, name: string): MoonbaseLayout {
  const next = name.slice(0, MAX_NAME_LENGTH)
  if (next === layout.name) return layout
  return { ...layout, name: next }
}

export const ROAD_N = 1
export const ROAD_E = 2
export const ROAD_S = 4
export const ROAD_W = 8

/** Which of a road tile's four sides join another road tile, as a bit mask. */
export function roadLinks(roads: ReadonlySet<string>, cell: Cell): number {
  let mask = 0
  if (roads.has(cellKey(cell.x, cell.z - 1))) mask |= ROAD_N
  if (roads.has(cellKey(cell.x + 1, cell.z))) mask |= ROAD_E
  if (roads.has(cellKey(cell.x, cell.z + 1))) mask |= ROAD_S
  if (roads.has(cellKey(cell.x - 1, cell.z))) mask |= ROAD_W
  return mask
}

function isRot(value: unknown): value is Rot {
  return value === 0 || value === 1 || value === 2 || value === 3
}

/**
 * Rebuilds a layout from untrusted storage. `spanFor` is the current catalogue:
 * it returns the footprint for a known item and undefined for one that no
 * longer exists, which is dropped. Spans are re-read rather than trusted, so a
 * model whose footprint changed since the save cannot overlap its neighbours.
 */
export function sanitizeLayout(
  raw: unknown,
  spanFor: (kind: ItemKind, ref: string) => number | undefined
): MoonbaseLayout {
  const layout = emptyLayout()
  if (!raw || typeof raw !== 'object') return layout
  const source = raw as { v?: unknown; name?: unknown; items?: unknown; roads?: unknown }
  if (source.v !== LAYOUT_VERSION) return layout

  if (typeof source.name === 'string') layout.name = source.name.slice(0, MAX_NAME_LENGTH)

  let next = layout
  if (Array.isArray(source.items)) {
    for (const entry of source.items) {
      if (!entry || typeof entry !== 'object') continue
      const item = entry as Partial<PlacedItem>
      if (typeof item.id !== 'string' || !item.id) continue
      if (item.kind !== 'asset' && item.kind !== 'decor') continue
      if (typeof item.ref !== 'string' || !item.ref) continue
      if (typeof item.x !== 'number' || typeof item.z !== 'number') continue
      const span = spanFor(item.kind, item.ref)
      if (span === undefined) continue
      next = placeItem(next, {
        id: item.id,
        kind: item.kind,
        ref: item.ref,
        x: item.x,
        z: item.z,
        span,
        rot: isRot(item.rot) ? item.rot : 0,
      })
    }
  }

  if (Array.isArray(source.roads)) {
    const cells: Cell[] = []
    for (const key of source.roads) {
      const cell = typeof key === 'string' ? parseCellKey(key) : null
      if (cell) cells.push(cell)
    }
    next = addRoads(next, cells)
  }
  return next
}
