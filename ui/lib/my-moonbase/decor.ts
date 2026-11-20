/**
 * Scenery anyone can place on their base, free and as often as they like.
 * Metadata only: the models are drawn in components/my-moonbase/BuilderScene.
 */
export type DecorGroup = 'Power and light' | 'Logistics' | 'Terrain'

export type DecorDef = {
  id: string
  label: string
  group: DecorGroup
  /** Footprint edge in cells. */
  span: number
}

export const DECOR: readonly DecorDef[] = [
  { id: 'street-light', label: 'Street light', group: 'Power and light', span: 1 },
  { id: 'solar-array', label: 'Solar array', group: 'Power and light', span: 2 },
  { id: 'gas-station', label: 'Rover charging bay', group: 'Logistics', span: 2 },
  { id: 'depot-yard', label: 'Rover depot', group: 'Logistics', span: 3 },
  { id: 'excavator', label: 'Excavator', group: 'Logistics', span: 1 },
  { id: 'crates', label: 'Cargo crates', group: 'Logistics', span: 1 },
  { id: 'cable-reel', label: 'Cable reel', group: 'Logistics', span: 1 },
  { id: 'spare-parts', label: 'Spare parts', group: 'Logistics', span: 1 },
  { id: 'bricks', label: 'Regolith bricks', group: 'Logistics', span: 1 },
  { id: 'boulder', label: 'Boulder', group: 'Terrain', span: 1 },
  { id: 'boulder-large', label: 'Large boulder', group: 'Terrain', span: 1 },
]

export const DECOR_GROUPS: readonly DecorGroup[] = ['Power and light', 'Logistics', 'Terrain']

export function decorById(id: string): DecorDef | undefined {
  return DECOR.find((decor) => decor.id === id)
}
