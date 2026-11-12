// The site plan for Moon Base Zero.
//
// The base is laid out as eight DISTRICTS, one per capability race, on a CITY
// GRID on the ridge crest rather than at the projects' (approximate, heavily
// overlapping) real coordinates — so the patch reads as one town instead of
// scattered hardware. Offsets are REAL METERS in the terrain's map frame
// [+east, +north]; the base is true to scale.
//
// A district is a lot shared by everyone competing to do one thing: all three
// fission bids stand in the power district, all four comms bids in the comms
// district. That is not how a real base would be built — nobody erects three
// competing reactors side by side — but it is what the scene is FOR. This is a
// prediction market rendered as ground truth, and the thing being predicted is
// which of these machines ends up on the Moon. Standing the rivals on the same
// lot is what lets you see the bet: press a race and its whole field lights up
// in one place, at one scale, on the same regolith.
//
// THE STREET PLAN IS A GRID
//
// Three AVENUES run northeast along the ridge and CROSS STREETS run square
// across them, all on one 55 m grid. Every district is zoned onto a CITY BLOCK
// of one or more grid cells, and its competitors are seated round the inside of
// that block facing the streets that bound it, every one of them the same
// setback off the pavement. The middle avenue is MAIN AVENUE: it runs the whole
// length of the base, out past the town at both ends to the landing zone and
// the mass driver, and it is the street the rovers drive.
//
// The grid is as TIGHT as the rosters allow. 55 m is the smallest cell the
// one-cell races fit at full setback, and every cell in town is taken: a race
// that needs more ground takes more cells as one block, rather than every block
// being sized for the largest race and standing half empty. The town is a 4 x 3
// rectangle of cells with no gaps in it, so every district has neighbours
// across the street on every side it has a street.
//
// The plan this replaces was one straight spine with a dead-end branch out to
// each district. It was correct and it read as a road with things hung off it:
// one line across the frame, with eight clusters at the ends of eight stubs and
// open regolith between all of them.
//
// WHERE THE TOWN STANDS
//
// The ridge decides. South of the crest there is a hollow, between about -130
// and +20 m along, and a cross street running down into it pitches at 15-20%.
// Every candidate was profiled off the rendered height field at 5 m stations,
// and the town starts where the hollow ends. Each cross street, over the full
// depth of the grid (-55 to +110 m across):
//
//      along     relief    worst step
//        20      11.1 m      12.3%
//        75       9.5 m       8.2%
//       130       2.9 m       6.4%
//       240       1.5 m       5.1%
//
// And North and South Avenue, end to end: 7.8 m and 6.3 m of relief, worst
// steps 10.6% and 6.0%. Starting the town at 0 instead puts the first cross
// street at 14.6%; starting it further northeast buys nothing and moves the
// whole base away from the centre of the patch.
//
// WHY THE AVENUES RUN ON 40 DEGREES
//
// Main Avenue is the old spine, on the old spine's bearing, and the reasons it
// was chosen still hold. A long straight road has nowhere to hide from grade,
// so the bearing was measured off the same height field the terrain draws
// from: profiled over the old spine's 730 m, every whole bearing, at 5 m
// stations, 40 deg comes out at 12.7 m of relief end to end (24th of 180) and
// never pitches past 8.0% (14th of 180) — the only bearing in the top 15% on
// both. It is also the mass driver guideway's heading (TRACK_HEADING_DEG, see
// trackplan), levelled against the same field for its own reasons, so the
// launcher reads as the street continuing out of town. And it lies ~79 deg off
// the home camera's view axis, so the avenues run ACROSS the frame and the
// cross streets recede into it, which is the view of a grid that reads as one.
//
// WHAT IS HERE THAT IS NOT A RACE
//
// The SOLAR FARM (see SOLAR_ARRAYS, below the district keep-out). Nobody is
// competing to build the colony's own generation, so it is not a district and
// has no roster. It takes a two-cell block of its own in the south row, and a
// strip behind North Avenue facing the habitats.
//
// Nothing here is hand-authored twice. The districts name their block, and the
// district's position, its plot packing (districtSlots), the ground it keeps and
// the street network (BASE_STREETS) are all derived from that: a block that is
// zoned brings its four streets with it, and a race that gains a competitor gets
// another lot round its block without a road being drawn for it.
//
// This lives in lib because three unrelated parts of the scene need the same
// plan: the page places the sites from it, the model layer takes each site's
// heading from it, and the roads are laid out against it.

// The solar farm is surveyed to the light rather than to the ridge, so it needs
// the one place the sun's bearing is written down. Taking it from here rather
// than repeating the number is the same discipline sun.ts's own comment asks
// for: a hand-copied azimuth is how the 40/50 degree confusion started.
import { SUN_LOCAL_BEARING_DEG, SUN_LOCAL_ELEV_DEG } from './sun'
import type { ProjectType } from './types'

// Heading of Main Avenue, and so of every avenue, degrees CCW from east (see
// `dirFor`). The cross streets run square to it. Still called the SPINE because
// it is still the frame every other coordinate on the plan is measured in.
export const SPINE_BEARING_DEG = 40

// Heading of every cross street: square to the avenues, outbound to the
// northwest, which is `across` positive in the spine's frame.
export const CROSS_STREET_BEARING_DEG = SPINE_BEARING_DEG + 90

// Road cross-section, in meters. HALF is the centreline to the outside of the
// windrow (see PROFILE in BaseRoads, which must agree); SETBACK is the clear
// regolith a plot keeps between its own edge and that windrow. Together they
// are the only numbers that decide where a building stands relative to the
// street it fronts, which is why frontage across the whole base is uniform.
export const ROAD_HALF_M = 6.3
export const SETBACK_M = 1.8

// Meters of clear regolith the plan keeps between one built thing and the next:
// between neighbouring plots, and between the districts themselves, so one
// number sets how tightly the whole colony is packed.
//
// It is the FLOOR rather than the figure actually used in either place. Plots
// round the same block get LANE_CLEAR_M, which is this plus both their
// setbacks, because nothing else gives them a strip against each other; plots
// facing each other across a street are held apart by the road (see
// ROAD_HALF_M), which is far more than this.
export const DISTRICT_GAP_M = 6

// How far past the last thing it serves a road runs before it stops: the
// turning circle a hauler needs at a dead end, and the stub an avenue runs on
// past the last cross street so the corner is a crossing rather than a notch.
export const BRANCH_TAIL_M = 7

// ---------------------------------------------------------------------------
// The spine's frame
// ---------------------------------------------------------------------------

// Unit vector for a heading, measured in degrees CCW from EAST — the maths
// convention, not the surveyor's. So 0 is +east, 90 is +north, and the spine's
// 40 is northeast. Every `bearingDeg` in this file is in these terms; a compass
// bearing read off a map is 90 minus this.
export function dirFor(bearingDeg: number): [number, number] {
  const r = (bearingDeg * Math.PI) / 180
  return [Math.cos(r), Math.sin(r)]
}

// Unit vector along the spine, pointing northeast, in the map frame.
export function spineDir(): [number, number] {
  return dirFor(SPINE_BEARING_DEG)
}

// Unit vector across the spine, 90 deg left of outbound.
export function spineNormal(): [number, number] {
  const [e, n] = spineDir()
  return [-n, e]
}

// Map-frame position of a point given in the spine's own frame: `along` meters
// northeast of the ridge centre, `across` meters to the left of that.
//
// Every crossing on the plan goes through here rather than being written as a
// coordinate pair: a hand-rounded pair sits centimeters off the road, and every
// plot's setback is then measured from a street it is not quite on.
export function at(alongM: number, acrossM = 0): { east: number; north: number } {
  const [de, dn] = spineDir()
  const [ne, nn] = spineNormal()
  return {
    east: de * alongM + ne * acrossM,
    north: dn * alongM + nn * acrossM,
  }
}

// The inverse: how far along and across the spine a map-frame point lies.
export function spineCoords(p: { east: number; north: number }): {
  alongM: number
  acrossM: number
} {
  const [de, dn] = spineDir()
  const [ne, nn] = spineNormal()
  return {
    alongM: p.east * de + p.north * dn,
    acrossM: p.east * ne + p.north * nn,
  }
}

// Where Main Avenue starts and stops, in meters along: far enough past the
// districts at each end — the landing zone to the southwest, the mass driver's
// breach works to the northeast — to run clear of both, and asserted against
// them rather than eyeballed.
export const SPINE_START_M = -90
export const SPINE_END_M = 320

// ---------------------------------------------------------------------------
// The grid
// ---------------------------------------------------------------------------

// The grid's spacing, in meters between street centrelines, both ways. The
// smallest block that seats every one-block race's real roster at the full
// setback (power and ISRU are the binding ones, at 55 x 55); a race that needs
// more takes two or four cells as one block rather than the grid widening for
// everyone.
export const GRID_PITCH_M = 55

// Meters along Main Avenue where the town's first cross street crosses it. The
// hollow south of the crest ends about here, so every cross street from this
// one northeast stays under 12.5% where it runs down into the south row.
export const TOWN_START_ALONG_M = 20

// Where the two outer avenues run, meters across Main Avenue: North Avenue two
// cells out on the flat side of the crest, South Avenue one cell out on the
// side that falls away.
export const NORTH_AVENUE_ACROSS_M = 2 * GRID_PITCH_M
export const SOUTH_AVENUE_ACROSS_M = -GRID_PITCH_M

// One city block: the street centrelines that bound it, in the spine's frame.
// A block's ground is everything between its four streets; what anyone can
// build on is that, less the road and the setback on every side.
export type CityBlock = {
  alongM: [number, number]
  acrossM: [number, number]
}

// The four sides of a block, by the compass direction they face out of it: a
// block's `southeast` side fronts the street at its low `across` edge, its
// `southwest` side the cross street at its low `along` edge.
export type BlockSide = 'southwest' | 'northeast' | 'southeast' | 'northwest'

// The block spanning grid columns `col0` to `col1` (counted in cells northeast
// from the first cross street) and rows `row0` to `row1` (cells across Main
// Avenue, negative to the south). A multi-cell block has no streets inside it.
function cityBlock(col0: number, col1: number, row0: number, row1: number): CityBlock {
  return {
    alongM: [
      TOWN_START_ALONG_M + col0 * GRID_PITCH_M,
      TOWN_START_ALONG_M + col1 * GRID_PITCH_M,
    ],
    acrossM: [row0 * GRID_PITCH_M, row1 * GRID_PITCH_M],
  }
}

// Every block the town is built out to, named for what stands on it: four
// columns, two rows north of Main Avenue and one south, every cell taken.
// Districts and the solar farm both take their ground from here, and the
// streets are derived from the whole set, so zoning a block is what lays its
// streets.
//
//              col 0          col 1        cols 2-3
//   north 2  construction     rovers       habitat
//   north 1  (two cells)      ISRU        (four cells)
//   ---------------------- Main Avenue --------------------
//   south 1    power          comms        solar farm (two cells)
export const CITY_BLOCKS = {
  construction: cityBlock(0, 1, 0, 2),
  isru: cityBlock(1, 2, 0, 1),
  rover: cityBlock(1, 2, 1, 2),
  habitat: cityBlock(2, 4, 0, 2),
  power: cityBlock(0, 1, -1, 0),
  comms: cityBlock(1, 2, -1, 0),
  solar: cityBlock(2, 4, -1, 0),
}

const ALL_BLOCKS: CityBlock[] = Object.values(CITY_BLOCKS)

// Where cross streets cross Main Avenue, southwest to northeast: every block
// edge across the grid's columns. Derived, so a line no block has an edge on —
// the middle of the habitat's superblock — gets no street.
export const CROSS_STREET_ALONG_M: readonly number[] = [
  ...new Set(ALL_BLOCKS.flatMap((b) => b.alongM)),
].sort((x, y) => x - y)

// ---------------------------------------------------------------------------
// How a district is reached
// ---------------------------------------------------------------------------

// A SPUR: a short road off a branch, taking the `takes` smallest competitors of
// the race out to their own dead end. Nothing on the grid uses one today; it
// stays available to a district that stands off the grid on a branch.
export type Spur = {
  // Meters along the parent branch, from the spine, where the spur leaves it.
  atM: number
  // Absolute compass bearing, degrees CCW from east.
  bearingDeg: number
  lengthM: number
  // How many of the race's SMALLEST competitors stand out here.
  takes: number
  width?: number
}

// A district's BRANCH: a dead-end road off Main Avenue, for a district that
// stands off the grid. The mass driver is the one that does.
export type Branch = {
  // Absolute compass bearing, degrees CCW from east.
  bearingDeg: number
  // Meters from the spine to the district's centre, which is where this road's
  // centreline ends and its turning circle begins.
  lengthM: number
  width?: number
  spur?: Spur
}

// How a district's competitors stand relative to the streets around them.
export type Frontage =
  // Round the inside of the district's own city block, each lot facing the
  // nearest street and set back from it like every other lot on the base. The
  // default for anything with a `cityBlock`.
  | 'block'
  // Around the dead end of the district's own branch: the largest competitor
  // standing at the head where the road runs out, the rest lining the final
  // approach, alternating sides. The default for anything with a `branch`.
  | 'terminus'
  // Flanking Main Avenue itself, one plot each side, with no block or branch.
  // For the landing zone, whose pads must not be boxed in by streets or put at
  // the end of a dead end — see BASE_PLAN.lander.
  | 'flank'
  // No road through the lot at all, assets standing in a line along one shared
  // axis. For the unzoned races standing past the end of town (see
  // FALLBACK_ALONG_M).
  | 'lot'

export type SitePlan = {
  // Meters east and north of the ridge center — the CENTER of the district:
  // the middle of its block, or for a terminus district the point its branch
  // reaches. Individual plots are placed by districtSlots.
  //
  // DERIVED, never written by hand: `onBlock()` and `offGrid()` work it out
  // from the block or the branch, so a district is exactly where its streets
  // say it is however either is edited.
  east: number
  north: number
  // Meters along the spine of the district's centre (for a block district) or
  // of the crossing its branch leaves from (for a terminus).
  alongM: number
  // Degrees this installation is turned off the base's common heading.
  //
  // Every site shares ONE bearing by default (see facingYaw in ProjectModel).
  // That shared axis is the whole trick: sites spread over 700 m that each aim
  // independently at a viewpoint splay by tens of degrees, and that splay is
  // what made the settlement read as unrelated hardware dropped on a plain.
  // Holding one axis makes it read as surveyed. These are the deliberate
  // departures from it — enough to keep the plan from looking like a chorus
  // line, never enough to turn an asset's back on the viewer.
  turn: number
  front?: Frontage
  // The block the district is zoned onto.
  cityBlock?: CityBlock
  // For a block district: which sides of the block its competitors take,
  // largest first, in order of preference. Defaults to Main Avenue's side,
  // then the two cross streets, then the back.
  faces?: BlockSide[]
  branch?: Branch
  // Meters of ground a terminus or flank district occupies in ANY direction
  // from its roads — its keep-out, used to hold base-wide filler off it. A
  // block district keeps its whole block instead and does not use this.
  block?: number
  // For a 'lot' district only: the compass bearing, degrees CCW from east, that
  // its assets stand along, largest to smallest.
  lotAxis?: number
  // For a 'flank' district only: which side of the spine the largest plot
  // takes, +1 for left of the outbound (northeast) direction.
  flankSide?: 1 | -1
}

// One competitor's plot within its district: an absolute position in the same
// map frame as the district centers, so consumers never deal in local frames.
export type Slot = {
  east: number
  north: number
  turn: number
  // Meters from the district center, kept so callers can tell how far a plot
  // sits from the lot it belongs to without recomputing it.
  offsetM: number
}

// A competitor to place: an id to key the result by, and the radius of ground
// it needs. Radii come from the model layer (footprintRadiusM), not from here —
// this module must not depend on what the assets look like.
export type Plot = { id: string; radiusM: number }

// A district zoned onto a city block, centred on it.
function onBlock(
  cityBlock: CityBlock,
  spec: Omit<SitePlan, 'east' | 'north' | 'alongM' | 'cityBlock' | 'front'>
): SitePlan {
  const alongM = (cityBlock.alongM[0] + cityBlock.alongM[1]) / 2
  const acrossM = (cityBlock.acrossM[0] + cityBlock.acrossM[1]) / 2
  return { ...at(alongM, acrossM), alongM, front: 'block', cityBlock, ...spec }
}

// A district off the grid: on Main Avenue itself at `alongM`, or out at the end
// of a branch that leaves it there.
function offGrid(
  alongM: number,
  spec: Omit<SitePlan, 'east' | 'north' | 'alongM'>
): SitePlan {
  const start = at(alongM)
  if (!spec.branch) return { ...start, alongM, ...spec }
  const [de, dn] = dirFor(spec.branch.bearingDeg)
  return {
    east: start.east + de * spec.branch.lengthM,
    north: start.north + dn * spec.branch.lengthM,
    alongM,
    ...spec,
  }
}

// ---------------------------------------------------------------------------
// Packing a district's competitors onto its streets
// ---------------------------------------------------------------------------

// Stable pseudo-random in [0, 1) from a string. Deterministic because plot
// jitter must survive a re-render: Math.random() here would have the whole
// colony twitch every frame.
function hash01(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100003) / 100003
}

// How far off the district's heading an individual plot may be turned, in
// degrees. Small on purpose: buildings on a street read as aligned to it, and
// the jitter is only here so four identical relay terminals on four corners
// aren't four copies of one render.
const PLOT_TURN_JITTER_DEG = 7

// Meters from the centreline of a street to the CENTRE of a plot fronting it.
// The plot's own radius is in here, so a big asset stands further back and every
// asset on the base ends up with the same 1.8 m of clear ground at its edge.
function frontageM(radiusM: number): number {
  return ROAD_HALF_M + SETBACK_M + radiusM
}

// Meters from the point a road's centreline ENDS to the centre of a plot
// standing square across that end: clear of the tail, then the turning circle
// (a disc about as wide as the road, not a point), then its own setback.
function headM(radiusM: number): number {
  return BRANCH_TAIL_M + ROAD_HALF_M + SETBACK_M + radiusM
}

// Meters between the edges of two plots with no road between them — down the
// same side of a road, or round the same block.
//
// More than DISTRICT_GAP_M, and the extra is both setbacks. Plots facing each
// other across a street are held apart by the road, and each keeps its own
// clear strip against the pavement as a side effect. Two plots on the same
// block have nothing between them unless it is put here, and without it a race
// reads as a terrace, its buildings closer to each other than any of them is to
// the street they front.
export const LANE_CLEAR_M = DISTRICT_GAP_M + 2 * SETBACK_M

// Step, in meters, a plot is slid along a block side while looking for room.
const BLOCK_SLIDE_STEP_M = 0.25

// The order a block's sides are offered in when a district names none: Main
// Avenue's side first, so a district's biggest machine fronts the main street,
// then the two cross streets, then the back avenue.
function defaultFaces(b: CityBlock): BlockSide[] {
  return b.acrossM[0] >= 0
    ? ['southeast', 'southwest', 'northeast', 'northwest']
    : ['northwest', 'southwest', 'northeast', 'southeast']
}

// Where a plot of radius `r` can stand on one side of a block, in the spine's
// frame: the line it slides along (exactly one frontage off that side's
// street) and the order it is tried in.
//
// Each side is walked from a DIFFERENT corner, round the block counter-
// clockwise — the southeast side from its southwest end, the northeast side
// from its southeast end, and so on. So the first lot on each side takes a
// different corner, and a district fills its block outward from all four
// rather than piling into one.
function blockSideStations(b: CityBlock, side: BlockSide, r: number) {
  const f = frontageM(r)
  const [a0, a1] = b.alongM
  const [c0, c1] = b.acrossM
  const stations: { a: number; c: number }[] = []
  const walk = (from: number, to: number, place: (s: number) => { a: number; c: number }) => {
    if (from <= to) {
      for (let s = from; s <= to + 1e-9; s += BLOCK_SLIDE_STEP_M) stations.push(place(s))
    } else {
      for (let s = from; s >= to - 1e-9; s -= BLOCK_SLIDE_STEP_M) stations.push(place(s))
    }
  }
  if (a1 - a0 < 2 * f || c1 - c0 < 2 * f) return stations
  switch (side) {
    case 'southeast':
      walk(a0 + f, a1 - f, (s) => ({ a: s, c: c0 + f }))
      break
    case 'northeast':
      walk(c0 + f, c1 - f, (s) => ({ a: a1 - f, c: s }))
      break
    case 'northwest':
      walk(a1 - f, a0 + f, (s) => ({ a: s, c: c1 - f }))
      break
    case 'southwest':
      walk(c1 - f, c0 + f, (s) => ({ a: a0 + f, c: s }))
      break
  }
  return stations
}

// Place a race's competitors on the streets of their district, largest first.
//
// Positions come back absolute. Every case works in the frame of the road it
// fronts — `along` and `across` it — which is a flat offset from a straight
// line and therefore exact.
export function districtSlots(plan: SitePlan, plots: Plot[]): Map<string, Slot> {
  const out = new Map<string, Slot>()
  if (!plots.length) return out
  const order = [...plots].sort(
    (a, b) => b.radiusM - a.radiusM || a.id.localeCompare(b.id)
  )

  // Absolute placement, plus the offset from the district centre that callers
  // read back off the slot.
  const put = (plot: Plot, east: number, north: number) => {
    out.set(plot.id, {
      east,
      north,
      turn:
        plan.turn + (hash01(`${plot.id}:turn`) - 0.5) * 2 * PLOT_TURN_JITTER_DEG,
      offsetM: Math.hypot(east - plan.east, north - plan.north),
    })
  }

  // Pack a field around the dead end of one road: the largest standing square
  // across the head where the pavement runs out, the rest lining the final
  // approach and alternating sides so the road keeps a building on both hands.
  const packDeadEnd = (
    field: Plot[],
    headEast: number,
    headNorth: number,
    bearingDeg: number
  ) => {
    if (!field.length) return
    const [ue, un] = dirFor(bearingDeg)
    // Left of the road's own outbound direction.
    const [ve, vn] = [-un, ue]
    const seat = (plot: Plot, along: number, across: number) =>
      put(
        plot,
        headEast + ue * along + ve * across,
        headNorth + un * along + vn * across
      )

    seat(field[0], headM(field[0].radiusM), 0)
    // How far back down the road each side is filled to, so the two sides pack
    // independently and a big plot on one never pushes a small one on the other
    // further from the end than it needs to be.
    const filled = [0, 0]
    field.slice(1).forEach((plot, i) => {
      const side = i % 2 === 0 ? 1 : -1
      const s = side > 0 ? 0 : 1
      const back = filled[s] + plot.radiusM
      seat(plot, -back, side * frontageM(plot.radiusM))
      filled[s] = back + plot.radiusM + LANE_CLEAR_M
    })
  }

  switch (plan.front ?? (plan.cityBlock ? 'block' : 'terminus')) {
    case 'block': {
      // Round the inside of the block, each competitor fronting one of its four
      // streets at exactly one frontage off it. Largest first, each offered the
      // block's sides in the district's order and slid along a side until it
      // clears everything already standing, by the same strip two lots on one
      // verge keep. A lot that fits nowhere on the frontage is a block too small
      // for its race, which the plan's tests catch; it is seated at the block's
      // centre rather than dropped, so the failure is visible rather than silent.
      const b = plan.cityBlock!
      const faces = plan.faces ?? defaultFaces(b)
      const placed: { a: number; c: number; r: number }[] = []
      for (const plot of order) {
        const r = plot.radiusM
        let spot: { a: number; c: number } | undefined
        for (const side of faces) {
          spot = blockSideStations(b, side, r).find((s) =>
            placed.every(
              (q) => Math.hypot(s.a - q.a, s.c - q.c) - r - q.r >= LANE_CLEAR_M
            )
          )
          if (spot) break
        }
        spot ??= {
          a: (b.alongM[0] + b.alongM[1]) / 2,
          c: (b.acrossM[0] + b.acrossM[1]) / 2,
        }
        placed.push({ ...spot, r })
        const p = at(spot.a, spot.c)
        put(plot, p.east, p.north)
      }
      return out
    }

    case 'lot': {
      // No street through the lot, so the assets simply stand along an axis,
      // offset so the district center falls at the middle of their combined
      // FRONTAGE rather than between their centres.
      const [ue, un] = dirFor(plan.lotAxis ?? SPINE_BEARING_DEG)
      let cursor = 0
      const span = order.reduce(
        (sum, p, i) => sum + p.radiusM * 2 + (i ? DISTRICT_GAP_M : 0),
        0
      )
      for (const plot of order) {
        const s = cursor + plot.radiusM - span / 2
        put(plot, plan.east + ue * s, plan.north + un * s)
        cursor += plot.radiusM * 2 + DISTRICT_GAP_M
      }
      return out
    }

    case 'flank': {
      // Main Avenue itself with a plot either side. Plots opposite each other
      // are held apart by the road's full width plus both setbacks, so they
      // never need spacing along it; a third and a fourth would, which is the
      // step.
      const [alongE, alongN] = spineDir()
      const [acrossE, acrossN] = spineNormal()
      let step = 0
      for (let i = 2; i < order.length; i++) {
        step = Math.max(
          step,
          order[i].radiusM + order[i - 2].radiusM + DISTRICT_GAP_M
        )
      }
      const side = plan.flankSide ?? 1
      const rows = Math.ceil(order.length / 2)
      order.forEach((plot, i) => {
        const along = Math.floor(i / 2) * step - ((rows - 1) * step) / 2
        const across = (i % 2 ? -side : side) * frontageM(plot.radiusM)
        put(
          plot,
          plan.east + alongE * along + acrossE * across,
          plan.north + alongN * along + acrossN * across
        )
      })
      return out
    }

    default: {
      // The dead end of the district's own branch, and — if it has one — of a
      // spur off it, which takes the SMALLEST competitors: the race's headline
      // hardware stands where its road ends and the small stuff goes round the
      // corner.
      const branch = plan.branch
      if (!branch) {
        // A terminus with no branch has nowhere to be but its own centre.
        packDeadEnd(order, plan.east, plan.north, SPINE_BEARING_DEG)
        return out
      }

      const roads = districtRoads(plan)
      const takes = Math.min(
        branch.spur?.takes ?? 0,
        Math.max(0, order.length - 1)
      )
      const onBranch = takes ? order.slice(0, order.length - takes) : order
      const onSpur = takes ? order.slice(order.length - takes) : []

      packDeadEnd(onBranch, roads[0].to.east, roads[0].to.north, roads[0].bearingDeg)
      if (onSpur.length && roads[1]) {
        packDeadEnd(
          onSpur,
          roads[1].to.east,
          roads[1].to.north,
          roads[1].bearingDeg
        )
      }
      return out
    }
  }
}

// One road a district owns: `from` where it leaves the road above it in the
// hierarchy, `to` where its own centreline ends — which is the point its assets
// are arranged around, and NOT where the pavement stops (that is a turning
// circle further on, see BRANCH_TAIL_M).
export type DistrictRoad = {
  bearingDeg: number
  from: { east: number; north: number }
  to: { east: number; north: number }
  lengthM: number
  // Where in the hierarchy: RANK_STREET for a branch, RANK_LANE for a spur.
  rank: number
}

// The roads a district owns, branch first. Empty for a block district, whose
// streets belong to the grid, and for a flank district, which stands on Main
// Avenue.
export function districtRoads(plan: SitePlan): DistrictRoad[] {
  const branch = plan.branch
  if (!branch) return []
  const crossing = at(plan.alongM)
  const [de, dn] = dirFor(branch.bearingDeg)
  const to = {
    east: crossing.east + de * branch.lengthM,
    north: crossing.north + dn * branch.lengthM,
  }
  const out: DistrictRoad[] = [
    {
      bearingDeg: branch.bearingDeg,
      from: crossing,
      to,
      lengthM: branch.lengthM,
      rank: RANK_STREET,
    },
  ]
  if (branch.spur) {
    const from = {
      east: crossing.east + de * branch.spur.atM,
      north: crossing.north + dn * branch.spur.atM,
    }
    const [se, sn] = dirFor(branch.spur.bearingDeg)
    out.push({
      bearingDeg: branch.spur.bearingDeg,
      from,
      to: {
        east: from.east + se * branch.spur.lengthM,
        north: from.north + sn * branch.spur.lengthM,
      },
      lengthM: branch.spur.lengthM,
      rank: RANK_LANE,
    })
  }
  return out
}

// Radius in meters of the ground a district occupies once packed — the farthest
// any of its plots reaches from the district center.
export function districtExtentM(plan: SitePlan, plots: Plot[]): number {
  const slots = districtSlots(plan, plots)
  let max = 0
  for (const plot of plots) {
    const slot = slots.get(plot.id)
    if (slot) max = Math.max(max, slot.offsetM + plot.radiusM)
  }
  return max
}

// How far along the spine a district sits: its block's middle, or the crossing
// its branch leaves Main Avenue from.
export function districtAlongM(plan: SitePlan): number {
  return plan.alongM
}

// The street a point inside a district actually FRONTS, and which side of it
// that point lies on: the street's bearing, the signed lateral offset from it
// (+ is left of that street's own outbound direction), and `head` — for a
// district road, the point its centreline ends; for a block, the foot of the
// perpendicular from the point onto the street.
//
// Read off the point rather than stored per project because lots are assigned
// by roster rank: changing any competitor's footprint can move it to another
// side of its block, and a stored bearing would then be silently stale. The
// buried habitats lay their vaults square to this street (see subplan.ts).
export function frontingRoad(
  plan: SitePlan,
  p: { east: number; north: number }
): { bearingDeg: number; acrossM: number; head: { east: number; north: number } } {
  if (plan.cityBlock) {
    const { alongM: a, acrossM: c } = spineCoords(p)
    const [a0, a1] = plan.cityBlock.alongM
    const [c0, c1] = plan.cityBlock.acrossM
    // Distance to each of the four streets, and what fronting it means: the
    // avenues run outbound northeast with +across on their left, the cross
    // streets outbound northwest with -along on theirs.
    const sides = [
      { d: c - c0, bearingDeg: SPINE_BEARING_DEG, acrossM: c - c0, head: at(a, c0) },
      { d: c1 - c, bearingDeg: SPINE_BEARING_DEG, acrossM: c - c1, head: at(a, c1) },
      { d: a - a0, bearingDeg: CROSS_STREET_BEARING_DEG, acrossM: a0 - a, head: at(a0, c) },
      { d: a1 - a, bearingDeg: CROSS_STREET_BEARING_DEG, acrossM: a1 - a, head: at(a1, c) },
    ]
    const best = sides.reduce((x, y) => (y.d < x.d ? y : x))
    return { bearingDeg: best.bearingDeg, acrossM: best.acrossM, head: best.head }
  }

  const roads = districtRoads(plan)
  if (!roads.length) {
    // A flank district fronts Main Avenue itself.
    return {
      bearingDeg: SPINE_BEARING_DEG,
      acrossM: spineCoords(p).acrossM,
      head: { east: plan.east, north: plan.north },
    }
  }

  let best = roads[0]
  let acrossM = 0
  let nearest = Infinity
  for (const r of roads) {
    const [de, dn] = dirFor(r.bearingDeg)
    const across = -(p.east - r.from.east) * dn + (p.north - r.from.north) * de
    if (Math.abs(across) < nearest) {
      nearest = Math.abs(across)
      best = r
      acrossM = across
    }
  }
  return { bearingDeg: best.bearingDeg, acrossM, head: best.to }
}

// ---------------------------------------------------------------------------
// Where the districts stand
// ---------------------------------------------------------------------------

// Eight districts, six of them in town. Which race gets which block is function
// first and composition second.
//
// The landing zone and the launcher are the two things on the plan that throw
// mass, so they stand off the grid at opposite ends of Main Avenue, just out of
// town. Construction takes the first column, on the corner the pads and the
// haul road come in by, and ISRU the Main Avenue cell next to it, because the
// whole argument for making oxygen on the Moon is pumping it into a lander.
// The habitat race takes the far end of the north side, the quietest address
// on the plan; power takes the opposite corner of town, across Main Avenue and
// two cells down from it. Fission plants go where the crew isn't.
export const BASE_PLAN: Partial<Record<ProjectType, SitePlan>> = {
  // LANDING ZONE, just southwest of town. The pads FLANK Main Avenue rather
  // than taking a block, and this is the one district that must not be boxed in
  // by streets.
  //
  // With no air to slow it, plume-thrown regolith travels ballistic arcs, so
  // what a pad wants is a clear sightline and two ways out of it, not four
  // streets of neighbours. So the pads stand either side of Main Avenue, 55 m
  // short of the first cross street, and the haul road runs BETWEEN them and
  // carries straight on into town.
  lander: offGrid(-35, {
    turn: 0,
    front: 'flank',
    flankSide: 1,
    // Blue Moon MK1's 4.8 m pad plus its frontage off the avenue, with the other
    // Touchdown pads packed down both flanks.
    block: 20,
  }),

  // ISRU YARD, on Main Avenue in the second column, a block from the pads.
  isru_plant: onBlock(CITY_BLOCKS.isru, { turn: 8 }),

  // CONSTRUCTION, the first column, two cells deep: the ground these machines
  // are all bidding to pave, on the corner of town nearest the camera. Five
  // paving bids need more frontage than one cell has. Turned toward the work.
  construction: onBlock(CITY_BLOCKS.construction, { turn: 22 }),

  // THE HABITAT RACE, a four-cell superblock at the far end of the north side:
  // Artemis Base Camp and China/Russia's ILRS against Thales' MPH, Sierra's
  // LIFE and Toyota's Lunar Cruiser. Five plots up to 38 m across need about
  // 90 m of block each way, which is why this is the one race on more than two
  // cells.
  //
  // Faces North Avenue first, so the two largest lots — Artemis Base Camp and a
  // buried module — front the back street rather than the haul road every
  // tanker and paving machine on the base uses; the smaller ones fill in round
  // the block.
  habitat: onBlock(CITY_BLOCKS.habitat, {
    turn: 0,
    faces: ['northwest', 'southwest', 'northeast', 'southeast'],
  }),

  // ROVER DEPOT, behind ISRU on the lane. This is the one district that shows
  // its field TWICE, and the duplication is deliberate: each rover stands on its
  // own lot here, exactly as every other race's hardware stands on its, and a
  // SECOND copy of the same field drives Main Avenue (see PATROL), which is what
  // makes rovers the only moving things on the base.
  rover: onBlock(CITY_BLOCKS.rover, { turn: -6 }),

  // COMMS AND NAVIGATION, the middle of the south row. Ground stations want
  // their horizon clear of structures, so the field faces South Avenue — the
  // edge of town on the side the ridge falls away.
  //
  // Note there is deliberately no `orbital` district. buildTechTrees treats
  // orbital as a non-surface type, so Gateway can never occupy ground here.
  comms_pnt: onBlock(CITY_BLOCKS.comms, {
    turn: -12,
    faces: ['southeast', 'southwest', 'northeast', 'northwest'],
  }),

  // POWER, the first cell of the south row, on the corner across Main Avenue
  // from construction and as far from the habitats as the town allows.
  power: onBlock(CITY_BLOCKS.power, { turn: 6 }),

  // LUNAR MASS DRIVER, just past the end of town at the head of Main Avenue,
  // on a short drive square off it to the northwest.
  //
  // What stands on this lot is the launcher's BREACH WORKS — capacitor hall,
  // power feed, solar field — and that is all this entry describes. The guideway
  // itself runs 600 m out of the lot on its own heading, is not packed as a
  // disc, and is checked as a corridor; see lib/lunar-atlas/trackplan.
  //
  // The drive puts the breach works on the town's middle grid line, one cell
  // out from Main Avenue, so the guideway leaves on the avenues' own bearing as
  // a grid line carried on out of town, and fires over none of it.
  mass_driver: offGrid(275, {
    turn: 0,
    branch: { bearingDeg: CROSS_STREET_BEARING_DEG, lengthM: 26, width: 0.72 },
    block: 24,
  }),
}

// ---------------------------------------------------------------------------
// The crewed pad
// ---------------------------------------------------------------------------

// Starship HLS, on a pad of its own at the southwest end of North Avenue.
//
// A pad rather than a district. The landing zone is Touchdown's, and a 52 m
// vehicle packed in among its CLPS-class pads would set the spacing for all of
// them, so Starship stands here even when it races in Touchdown. With no
// standing race behind it (see buildColonyLayout) it is scenery: no beacon,
// name card or click target.
//
// The ground picks the spot. A 64 m deck seats on the highest point under it,
// so relief across the footprint is skirt standing proud of the regolith. At
// the head of Main Avenue that is 8.8 m; here, on North Avenue's own line, it
// is 1.5 m, 65 m clear of every district. North Avenue runs on out of town onto
// the deck (see avenueLine), and that stretch never pitches past 2.9%.
export const CREWED_PAD_PROJECT_ID = 'spacex-starship-hls'

// Radius of the pad's graded deck. The model layer's own deck for a 52 m
// lander is 31.2 m (GRADED_DECK_FRACTION in ProjectModel); this is that,
// rounded up, because this module must not depend on what the assets look like.
export const CREWED_PAD_R_M = 32

export const CREWED_PAD_ALONG_M = -85

export const CREWED_PAD = at(CREWED_PAD_ALONG_M, NORTH_AVENUE_ACROSS_M)

// ---------------------------------------------------------------------------
// The streets
// ---------------------------------------------------------------------------

// Where a road sits in the hierarchy. Higher CARRIES a crossing: Main Avenue's
// surface runs through unbroken and everything meeting it stops at its lane
// edge; an avenue carries the cross streets that meet it, and a cross street
// carries the lanes that end on it. See throughRoad in junctions.ts.
export const RANK_MAIN = 2
export const RANK_AVENUE = 1
export const RANK_STREET = 0
export const RANK_LANE = -1

// Roads, as polylines of [east, north] waypoints in meters. Curves are splined
// through these, though on this plan nothing bends: every road is straight and
// two waypoints describe it exactly.
export type Street = {
  points: [number, number][]
  closed?: boolean
  // Lane width as a fraction of a full haul road. The avenues carry cargo and
  // propellant and run full width; the cross streets are town streets, and a
  // drive out to one lot is narrower still.
  width?: number
  // The sites this road exists to reach. It stands as long as any of them do,
  // so a street is graded when the first district on it is, and the town is
  // built out block by block as the scrubber moves rather than standing as an
  // empty grid years early. Main Avenue has no `serves`: it is the
  // settlement's own frame and arrives with it, and so does any street that
  // fronts nothing but the solar farm.
  serves?: ProjectType[]
  // Which tier this road belongs to. See RANK_MAIN above.
  rank?: number
}

// Lane width of a cross street, as a fraction of an avenue's.
export const CROSS_STREET_WIDTH = 0.85

// The districts zoned onto a block, by block — so a street can say which of
// them it serves.
function blockDistricts(b: CityBlock): ProjectType[] {
  return (Object.keys(BASE_PLAN) as ProjectType[]).filter(
    (k) => BASE_PLAN[k]!.cityBlock === b
  )
}

function street(
  rank: number,
  width: number,
  from: { east: number; north: number },
  to: { east: number; north: number },
  serves: ProjectType[]
): Street {
  return {
    rank,
    width,
    serves: serves.length ? serves : undefined,
    points: [
      [from.east, from.north],
      [to.east, to.north],
    ],
  }
}

// MAIN AVENUE, the whole length of the base.
function mainAvenue(): Street {
  const a = at(SPINE_START_M)
  const b = at(SPINE_END_M)
  return {
    rank: RANK_MAIN,
    points: [[a.east, a.north], [b.east, b.north]],
  }
}

// How far an outer avenue runs on past its last cross street. Longer than the
// sweep a cross street's junction grades back along the avenue (its lane plus
// JUNCTION_FILLET_M, about 8 m), or the stub is all junction apron and its end
// can never fade out on its own.
const AVENUE_TAIL_M = 20

// A street running with the avenues at `acrossM`, along the full run of
// blocks that front it. On the edge of town it is an OUTER AVENUE, with a tail
// past each end so its last crossings are crossings rather than corners.
// Inside the town it is a LANE between two blocks of one column, running from
// cross street to cross street with both ends on them.
function avenueLine(acrossM: number): Street | null {
  const fronting = ALL_BLOCKS.filter((b) => b.acrossM.includes(acrossM))
  if (!fronting.length) return null
  const outer =
    acrossM === NORTH_AVENUE_ACROSS_M || acrossM === SOUTH_AVENUE_ACROSS_M
  const tail = outer ? AVENUE_TAIL_M : 0
  // North Avenue runs on southwest out of town to the crewed pad's deck.
  const padEnd =
    acrossM === NORTH_AVENUE_ACROSS_M ? CREWED_PAD_ALONG_M + CREWED_PAD_R_M : Infinity
  const from = Math.min(padEnd, Math.min(...fronting.map((b) => b.alongM[0])) - tail)
  const to = Math.max(...fronting.map((b) => b.alongM[1])) + tail
  return street(
    outer ? RANK_AVENUE : RANK_LANE,
    outer ? 1 : CROSS_STREET_WIDTH,
    at(from, acrossM),
    at(to, acrossM),
    fronting.flatMap(blockDistricts)
  )
}

// Every line across Main Avenue a block has an edge on, other than Main
// Avenue's own, outer avenues first.
const AVENUE_LINES_M = [
  NORTH_AVENUE_ACROSS_M,
  SOUTH_AVENUE_ACROSS_M,
  ...[...new Set(ALL_BLOCKS.flatMap((b) => b.acrossM))]
    .filter(
      (c) => c !== 0 && c !== NORTH_AVENUE_ACROSS_M && c !== SOUTH_AVENUE_ACROSS_M
    )
    .sort((x, y) => x - y),
]

// A cross street at `alongM`, across the full depth of the blocks that front it,
// from avenue centreline to avenue centreline — it starts and ends ON the
// avenues, so both its ends are junctions and neither is a dead end.
function crossStreet(alongM: number): Street | null {
  const fronting = ALL_BLOCKS.filter((b) => b.alongM.includes(alongM))
  if (!fronting.length) return null
  const from = Math.min(...fronting.map((b) => b.acrossM[0]))
  const to = Math.max(...fronting.map((b) => b.acrossM[1]))
  return street(
    RANK_STREET,
    CROSS_STREET_WIDTH,
    at(alongM, from),
    at(alongM, to),
    fronting.flatMap(blockDistricts)
  )
}

// One of a district's own roads as a street: its centreline, run on past the
// district's dead end by the turning circle a hauler needs there.
function districtStreet(site: ProjectType, road: DistrictRoad): Street {
  const branch = BASE_PLAN[site]!.branch!
  const [de, dn] = dirFor(road.bearingDeg)
  const end = road.lengthM + BRANCH_TAIL_M
  return {
    rank: road.rank,
    serves: [site],
    width: road.rank === RANK_LANE ? branch.spur!.width : branch.width,
    points: [
      [road.from.east, road.from.north],
      [road.from.east + de * end, road.from.north + dn * end],
    ],
  }
}

// Which districts own roads of their own, in BASE_PLAN order.
const BRANCHED = (Object.keys(BASE_PLAN) as ProjectType[]).filter(
  (k) => !!BASE_PLAN[k]!.branch
)

// Every road on the base, derived from the blocks and the districts rather than
// listed, so a block that is zoned, or a district that moves, cannot leave a
// road behind or a road stranded.
//
// Ordered by TIER — Main Avenue, the outer avenues and the lanes, the cross
// streets, then the district drives — so a consumer walking BASE_STREETS in order draws the
// network from the top down. BaseRoads relies on nothing about the order and
// junctions.ts explicitly refuses to (see throughRoad).
export const BASE_STREETS: Street[] = [
  mainAvenue(),
  ...AVENUE_LINES_M.map(avenueLine),
  ...CROSS_STREET_ALONG_M.map(crossStreet),
  ...BRANCHED.flatMap((k) =>
    districtRoads(BASE_PLAN[k]!).map((road) => districtStreet(k, road))
  ),
].filter((s): s is Street => !!s)

// ---------------------------------------------------------------------------
// The ground the districts keep
// ---------------------------------------------------------------------------

// A stretch of ground something on the plan occupies: everything within `halfM`
// of the segment from `a` to `b`. With no `endM` the ends are round — a capsule,
// for ground that is a road fattened. With `endM` the ends are square and run
// that far past `a` and `b` — a box, for a city block.
export type Zone = {
  a: [number, number]
  b: [number, number]
  halfM: number
  endM?: number
}

// Distance from a point to a segment.
function segDistM(
  east: number,
  north: number,
  [ax, ay]: [number, number],
  [bx, by]: [number, number]
): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t =
    len2 > 0
      ? Math.max(0, Math.min(1, ((east - ax) * dx + (north - ay) * dy) / len2))
      : 0
  return Math.hypot(east - (ax + dx * t), north - (ay + dy * t))
}

// How far a point stands OUTSIDE a zone, in meters: negative inside, zero on its
// edge. The one question everything that keeps clear of ground asks.
export function zoneGapM(z: Zone, east: number, north: number): number {
  if (z.endM === undefined) return segDistM(east, north, z.a, z.b) - z.halfM
  const [ax, ay] = z.a
  const len = Math.hypot(z.b[0] - ax, z.b[1] - ay)
  const ux = len > 0 ? (z.b[0] - ax) / len : 1
  const uy = len > 0 ? (z.b[1] - ay) / len : 0
  const u = (east - ax) * ux + (north - ay) * uy
  const v = -(east - ax) * uy + (north - ay) * ux
  const du = Math.max(-u, u - len) - z.endM
  const dv = Math.abs(v) - z.halfM
  if (du <= 0 && dv <= 0) return Math.max(du, dv)
  return Math.hypot(Math.max(du, 0), Math.max(dv, 0))
}

// The buildable ground of a city block: everything inside its four streets that
// is clear of the road and its setback, which is exactly where a lot's edge may
// begin. As a box along the block's own long axis.
export function blockGround(b: CityBlock): Zone {
  const inset = ROAD_HALF_M + SETBACK_M
  const cMid = (b.acrossM[0] + b.acrossM[1]) / 2
  const p = at(b.alongM[0] + inset, cMid)
  const q = at(b.alongM[1] - inset, cMid)
  return {
    a: [p.east, p.north],
    b: [q.east, q.north],
    halfM: (b.acrossM[1] - b.acrossM[0]) / 2 - inset,
    endM: 0,
  }
}

// The ground one district keeps.
//
// A block district keeps its whole block: it is zoned, and nothing else may be
// put on it whatever its roster does. A terminus district keeps capsules along
// the roads it fronts, `block` meters wide and run on past each dead end by the
// same; a flank district a stretch of Main Avenue.
export function districtGround(plan: SitePlan): Zone[] {
  if (plan.cityBlock) return [blockGround(plan.cityBlock)]

  const halfM = plan.block ?? 20
  const roads = districtRoads(plan)

  if (!roads.length) {
    // A flank district straddles Main Avenue, so its ground is a stretch OF it
    // — short, because its plots sit beside the road rather than along it.
    const a = at(plan.alongM - halfM * 0.5)
    const b = at(plan.alongM + halfM * 0.5)
    return [{ a: [a.east, a.north], b: [b.east, b.north], halfM }]
  }

  return roads.map((r) => {
    const [de, dn] = dirFor(r.bearingDeg)
    return {
      a: [r.from.east, r.from.north] as [number, number],
      b: [r.to.east + de * halfM, r.to.north + dn * halfM] as [number, number],
      halfM,
    }
  })
}

// Every district's ground, read straight from BASE_PLAN rather than duplicated,
// so a district that moves or grows can never leave this stale.
const DISTRICT_ZONES: Zone[] = Object.values(BASE_PLAN)
  .filter((p): p is SitePlan => !!p)
  .flatMap(districtGround)

// True if a point stands on ground some RACE keeps. Private, because it is only
// half the answer the filler wants — the solar farm keeps ground too, and it is
// laid out against this, so the public check below cannot be this one.
function onRaceGround(east: number, north: number, marginM: number): boolean {
  return DISTRICT_ZONES.some((z) => zoneGapM(z, east, north) <= marginM)
}

// ---------------------------------------------------------------------------
// The solar farm
// ---------------------------------------------------------------------------

// Base-wide generation, and the one installation on the whole plan that belongs
// to no race: nobody is competing to build the colony's own switchyard, so this
// is the last piece of shared infrastructure standing.
//
// It exists for two reasons that happen to agree. A settlement with a mass
// driver, an ISRU plant and a construction yard needs power on the order of
// hundreds of kilowatts, and the reactors in the power district are only part
// of that answer — a real base pairs fission with photovoltaics, because at the
// pole PV is nearly continuous and fission is what covers the rest. And it is
// what a town of this size zones a block for: generation, beside the district
// that draws on it.
//
// WHY THE ARRAYS ARE TILTED RATHER THAN LAID FLAT
//
// Because of where the sun is. At this latitude it circles low and never climbs
// overhead, so a panel laid flat sees it at a grazing angle and earns almost
// nothing for its area, while a panel raked back to face it sees it square.
// Every array on this base already follows that argument (see
// SUN_LOCAL_BEARING_DEG in sun.ts, and the relay wings in skyplan): each one
// here stands at the sun's own elevation, which at 44.5 deg is the roughly
// 45 deg rake the reference concepts all show, and turns on its azimuth.
//
// They are ground-mounted, on a torque tube carried by two raked A-frames. An
// earlier pass stood them on ten-meter masts instead, on the argument that
// NASA's south-pole array work is a program about tall masts. That argument is
// sound for a lander's own array, where the mast is buying HORIZON — a few
// meters of height is the difference between seeing the sun and sitting in the
// shadow of a crater rim. It buys a field nothing: a farm forty arrays wide
// gets its horizon from the site, and a mast per array only adds structure,
// shadow, and a pole in front of every panel.
export const SOLAR_PANEL_HALF_W_M = 3.2
export const SOLAR_PANEL_HALF_H_M = 2.8

// Ground clearance under the assembly's lower edge. Enough to keep the
// laminate out of the worst of the disturbed dust without raising the whole
// frame's centre of mass for nothing.
export const SOLAR_PANEL_BOTTOM_M = 0.7

// How tall a standing array actually is, which is the number the row spacing
// comes off. Derived rather than declared: the assembly is raked back at the
// sun's elevation, so a unit of its length up the slope rises by that angle's
// COSINE, and writing the height down separately would let it drift out of
// agreement with the model that gets rendered.
export const SOLAR_TOP_H_M =
  SOLAR_PANEL_BOTTOM_M +
  2 * SOLAR_PANEL_HALF_H_M * Math.cos((SUN_LOCAL_ELEV_DEG * Math.PI) / 180)

// Ground each array needs to itself, which is what the seating and the keep-out
// are both measured on: half the assembly's width, plus the reach of the
// A-frame feet behind it.
export const SOLAR_ARRAY_R_M = 4

// Horizontal reach of one array's footprint either side of its own centre. The
// assembly is raked back at the sun's elevation, so its top edge overhangs
// behind the centre and its lower edge in front of it by the slope's SINE.
const SOLAR_SLOPE_REACH_M =
  SOLAR_PANEL_HALF_H_M * Math.sin((SUN_LOCAL_ELEV_DEG * Math.PI) / 180)

// The closest two rows can stand before one shades the other, measured the way
// the shadow actually lands: from the TOP edge of the casting array, which is
// the part of it that overhangs furthest anti-sunward, to the LOWER edge of the
// receiving one, which is the part that reaches furthest sunward.
//
// Centre-to-centre against the array's height is the tempting version of this
// and it is wrong by two panel reaches — about 4 m here, which is half the
// answer. A field pitched off that number looks correctly spaced and clips the
// bottom of every row behind, which is the one failure a screenshot cannot show.
export const SOLAR_SHADOW_PITCH_M =
  SOLAR_TOP_H_M / Math.tan((SUN_LOCAL_ELEV_DEG * Math.PI) / 180) +
  2 * SOLAR_SLOPE_REACH_M

// Clear ground left between rows on top of that, so the field can be worked.
// Blanket dust is the standing problem with lunar PV and the arrays are the one
// installation here that needs regular physical attention, so a farm with no
// way in is a farm that degrades. Wide enough for a suited crew with a cart.
export const SOLAR_SERVICE_LANE_M = 4

// How far apart the arrays stand: row to row along the lattice's own bearing,
// and array to array across it within a row.
//
// Derived rather than declared, because every input is already written down and
// a hand-set pitch is free to fall quietly inside the shadow figure the moment
// the panel size or the sun changes. The bay pitch only has to stop two
// neighbours' assemblies touching, with a lane between them: side by side they
// are coplanar, facing the same way, and shadow each other not at all.
export const SOLAR_ROW_PITCH_M = Math.ceil(
  SOLAR_SHADOW_PITCH_M + SOLAR_SERVICE_LANE_M
)
export const SOLAR_BAY_PITCH_M = Math.ceil(
  2 * SOLAR_PANEL_HALF_W_M + SOLAR_SERVICE_LANE_M
)

// Where one array's parts sit, in the model's own frame: +X is the direction
// the face looks, +Y is up, +Z is across the assembly's width.
//
// Here rather than in the model, and returning plain numbers rather than
// drawing anything, for one reason: the ONE thing about this hardware that has
// to be true is that no part of the structure stands in front of the face, and
// a claim like that is worth nothing unless something checks it. An earlier
// version of this array hung the assembly off a ten-meter mast on a yoke, and
// because the yoke offset the panel to -X while the mast stayed at 0, the mast
// stood in front of the face and ran on two and a half meters past the top of
// it — a pole through the middle of every panel in the field, in a render that
// otherwise looked entirely plausible. The spec asserts against this.
export function solarArrayFrame(elevRad: number) {
  const sin = Math.sin(elevRad)
  const cos = Math.cos(elevRad)
  const halfW = SOLAR_PANEL_HALF_W_M
  const halfH = SOLAR_PANEL_HALF_H_M

  // The face, laid out from its LOWER EDGE, so its ground clearance is the
  // number actually controlled rather than one that falls out. The centre lies
  // back along -X and up along +Y from there by the slope's own components.
  const lowX = sin * halfH
  const centre: [number, number, number] = [0, SOLAR_PANEL_BOTTOM_M + cos * halfH, 0]
  // The face's outward normal, which is what "in front of" is measured along.
  const normal: [number, number, number] = [cos, sin, 0]

  // The torque tube, behind the face's middle, and the A-frame that carries it:
  // a raked back leg and a forward brace to each side, each on a bedded pad.
  const tube: [number, number, number] = [centre[0] - 0.34, centre[1], 0]
  const rakeZ = halfW * 0.56
  const legs = [-1, 1].map((s) => ({
    z: s * rakeZ,
    back: [tube[0] - 1.15, 0, s * rakeZ] as [number, number, number],
    fore: [lowX - 0.42, 0, s * rakeZ] as [number, number, number],
  }))

  return { halfW, halfH, centre, normal, tube, legs, tubeSpan: halfW * 1.9 }
}

// One field of the farm: where its lattice is centred, in the spine's own
// frame, how many stations to try in each direction, and which way it is
// surveyed.
type SolarField = {
  alongM: number
  acrossM: number
  rows: number
  bays: number
  // Bearing the rows STACK along — so the row LINES, which are what the eye
  // actually reads a field by, run across this. Defaults to the sun's own
  // bearing, which is the orientation that costs the least shadow. Set it to
  // survey a field to something on the ground instead.
  bearingDeg?: number
}

// The farm is TWO fields rather than one, either side of town.
//
// Split for the reason any real installation splits its generation: a single
// field is a single point of failure, and losing all of it to one impact, one
// bad dust event or one blown switchyard is the outcome the whole plant exists
// to avoid. Distributing it is also how a base actually grows — you build the
// field you need, and when you need more you build another one where there is
// room, rather than going back and widening the first.
//
// Both are SURVEYED TO THE GRID rather than to the sun: on a town of square
// blocks, a lattice at its own angle reads as debris rather than as plant. It
// costs them almost nothing, because the sun's bearing is only 10 degrees off
// the avenues' — the rows are pitched for that sun (above), and the spec checks
// every PAIR of arrays against its shadow rather than arguing from the pitch,
// because a lattice off the sun's axis is the case where pitch alone stops being
// proof. Each array still turns onto the sun individually; the lattice and the
// panel aim are separate decisions.
//
// Both are also hundreds of meters from the landing pads. Ejecta off an airless
// body leaves at orbital speed and does not come back down, so a field of glass
// is close to the worst thing to put near a pad.
const SOLAR_FIELDS: SolarField[] = [
  // The main field, on its own two-cell block in the south row, so it fills a
  // block like any district does. Rows square across Main Avenue, parallel to
  // the cross streets either side of the block. 7 x 3 is the whole block: one
  // more bay in either direction puts an array inside a street's setback.
  {
    alongM: (CITY_BLOCKS.solar.alongM[0] + CITY_BLOCKS.solar.alongM[1]) / 2,
    acrossM: (CITY_BLOCKS.solar.acrossM[0] + CITY_BLOCKS.solar.acrossM[1]) / 2,
    rows: 7,
    bays: 3,
    bearingDeg: SPINE_BEARING_DEG,
  },
  // The second, on the edge of town behind North Avenue, backing onto the
  // habitat superblock across the street.
  //
  // Here because of what it is near. The habitats are the one district with a
  // continuous, non-negotiable load, and generation built near the demand is how
  // any real plant is sited. And the far side of North Avenue is the flattest
  // open ground on the plan.
  //
  // Rows parallel to North Avenue, which it fronts, a setback off the pavement,
  // and exactly as long as the habitat block it faces.
  {
    alongM: (CITY_BLOCKS.habitat.alongM[0] + CITY_BLOCKS.habitat.alongM[1]) / 2,
    acrossM: NORTH_AVENUE_ACROSS_M + 32,
    rows: 4,
    bays: 9,
    bearingDeg: CROSS_STREET_BEARING_DEG,
  },
]

// One array's standing position.
export type SolarArray = {
  east: number
  north: number
  // Which field it belongs to, and its station in that field's lattice — so
  // the model can vary without being random, and so a row means a row of ONE
  // field rather than of the farm as a whole.
  field: number
  row: number
  bay: number
}

// Row and bay restart in every field, so the field is part of the identity.
export function solarArrayKey(a: SolarArray): string {
  return `${a.field}:${a.row}:${a.bay}`
}

// The fields, as strict lattices with the fouled stations dropped.
//
// STRICT, because a farm is surveyed and a scattered one reads as litter rather
// than as plant. DROPPED rather than nudged, because a row that bends round an
// obstacle reads as a mistake, where a row that simply stops at one is how
// every real site is built out — you plant the bays that fit and leave the rest
// of the coupon for later.
export const SOLAR_ARRAYS: SolarArray[] = (() => {
  const out: SolarArray[] = []
  SOLAR_FIELDS.forEach((f, field) => {
    const origin = at(f.alongM, f.acrossM)
    // Along the lattice's stacking bearing, and across it.
    const [se, sn] = dirFor(f.bearingDeg ?? SUN_LOCAL_BEARING_DEG)
    const [ce, cn] = [-sn, se]
    for (let row = 0; row < f.rows; row++) {
      for (let bay = 0; bay < f.bays; bay++) {
        const u = (row - (f.rows - 1) / 2) * SOLAR_ROW_PITCH_M
        const v = (bay - (f.bays - 1) / 2) * SOLAR_BAY_PITCH_M
        const east = origin.east + se * u + ce * v
        const north = origin.north + sn * u + cn * v
        // Clear of the pavement by an array's own ground, and clear of every
        // race's ground by enough that a roster change can never reach it.
        if (
          distToRoadM(east, north) <
          ROAD_HALF_M + SETBACK_M + SOLAR_ARRAY_R_M
        ) {
          continue
        }
        if (onRaceGround(east, north, SOLAR_ARRAY_R_M + DISTRICT_GAP_M)) continue
        out.push({ east, north, field, row, bay })
      }
    }
  })
  return out
})()

// The ground the farm keeps, as one capsule per planted row rather than a box
// round each field.
//
// Per row because the rows are what is actually built, so the rows are what is
// reserved — and a row that lost bays to the checks above reserves only as far
// as its own last standing array.
//
// The clear ground BETWEEN two rows is deliberately left unreserved. It is a
// shadow gap, not a yard: a boulder standing in it is fine and costs the field
// nothing, where a farm that claimed its own gaps would sterilize most of the
// flank it stands on and undo the point of putting it there.
export const SOLAR_FARM_ZONES: Zone[] = (() => {
  const out: Zone[] = []
  SOLAR_FIELDS.forEach((f, field) => {
    for (let row = 0; row < f.rows; row++) {
      const bays = SOLAR_ARRAYS.filter((a) => a.field === field && a.row === row)
      if (!bays.length) continue
      const first = bays[0]
      const last = bays[bays.length - 1]
      out.push({
        a: [first.east, first.north],
        b: [last.east, last.north],
        halfM: SOLAR_ARRAY_R_M,
      })
    }
  })
  return out
})()

// True if a map-frame point can plausibly stand on ground the base has already
// built on — any district's own ground, the solar farm's, or the crewed pad.
//
// Used to keep base-wide filler (a boulder field, roadside lighting) off it
// without that filler needing to know the roster, or that the farm exists.
export function withinDistrictGround(
  east: number,
  north: number,
  marginM: number
): boolean {
  if (onRaceGround(east, north, marginM)) return true
  if (
    Math.hypot(east - CREWED_PAD.east, north - CREWED_PAD.north) - CREWED_PAD_R_M <=
    marginM
  ) {
    return true
  }
  return SOLAR_FARM_ZONES.some((z) => zoneGapM(z, east, north) <= marginM)
}

// ---------------------------------------------------------------------------
// Walking the roads
// ---------------------------------------------------------------------------

// Every road as a straight run that can be WALKED: a length in meters, and a
// map position at any distance along it and any offset to its left.
//
// This exists because the base-wide filler — street lighting, roadside cargo,
// the maintenance fleet — needs to place things at a spacing measured along the
// pavement, and it should not have to know that a road is an avenue, a cross
// street or a drive to do it. Every road is straight, so a meter is a meter on
// every road.
export type RoadRun = {
  bearingDeg: number
  lengthM: number
  // `d` meters from the run's start, `offM` meters to its left.
  at: (d: number, offM: number) => { east: number; north: number }
  // Lane width as a fraction of a full haul road, mirroring Street.width — so
  // the filler can put street lighting on the routes that carry cargo and leave
  // a rover track dark.
  width: number
  // Tier, mirroring Street.rank, so filler can tell an avenue from a cross
  // street without inferring it from width.
  rank: number
}

export const ROAD_RUNS: RoadRun[] = BASE_STREETS.map((street) => {
  const [ax, ay] = street.points[0]
  const [bx, by] = street.points[street.points.length - 1]
  const lengthM = Math.hypot(bx - ax, by - ay)
  const de = (bx - ax) / lengthM
  const dn = (by - ay) / lengthM
  return {
    lengthM,
    width: street.width ?? 1,
    rank: street.rank ?? RANK_STREET,
    bearingDeg: (Math.atan2(dn, de) * 180) / Math.PI,
    at: (d, offM) => ({
      east: ax + de * d - dn * offM,
      north: ay + dn * d + de * offM,
    }),
  }
})

// Distance in meters from a map-frame point to the nearest road centreline.
//
// Exact rather than approximate: every road here is straight and described by
// its two endpoints, so the segment distance below IS the distance to the road.
export function distToRoadM(east: number, north: number): number {
  let best = Infinity
  for (const street of BASE_STREETS) {
    const pts = street.points
    for (let i = 0; i + 1 < pts.length; i++) {
      best = Math.min(best, segDistM(east, north, pts[i], pts[i + 1]))
    }
  }
  return best
}

// True if a point sits on, or within a windrow's width of, any road — the one
// check base-wide filler needs that has nothing to do with any one district.
export function onRoad(east: number, north: number): boolean {
  return distToRoadM(east, north) < ROAD_HALF_M + 2
}

// ---------------------------------------------------------------------------
// Traffic
// ---------------------------------------------------------------------------

// Races whose hardware is UNDER WAY: the run the field drives and how fast.
// Absent means the race stands on its lots.
//
// Traffic is worth a great deal here. Everything else on the plan is stationary
// by nature, so a settlement full of immaculate hardware reads as an
// architectural render until something in it is working — and a street reads as
// a street when there is something on it. The whole field drives, spread along
// the run, so Main Avenue carries movement wherever you look rather than one
// vehicle doing laps for an audience.
//
// NASA specifies the LTV around 15 km/h, and a little under half of that is
// what reads as purposeful at this scale: fast enough to be plainly driving,
// slow enough that it never looks sped up. One speed for the whole field, which
// is what guarantees the field never closes up on itself — see the run in
// MarkerLayer.
//
// A SHUTTLE along Main Avenue, out past town to the landing zone at one end and
// the launcher at the other, and back: the one street that reaches every end of
// the base, and the one the whole town fronts.
export type ShuttleRun = {
  speedMps: number
  fromAlongM: number
  toAlongM: number
  // Meters off the centreline the OUTBOUND leg drives on; the return leg takes
  // the other side, so two vehicles meeting head on pass instead of driving
  // through each other. Only worth having because the whole field is out at
  // once, which is also what makes it visible.
  acrossM: number
}

export const PATROL: Partial<Record<ProjectType, ShuttleRun>> = {
  rover: {
    speedMps: 3.2,
    // Short of each end of the spine by a turning circle, so the fleet turns
    // around ON the road rather than at the exact point it stops existing.
    fromAlongM: SPINE_START_M + 24,
    toAlongM: SPINE_END_M - 24,
    acrossM: 2.2,
  },
}

// Meters a vehicle covers in one full out-and-back on a run.
export function shuttleLapM(run: ShuttleRun): number {
  return (run.toAlongM - run.fromAlongM) * 2
}

// Where a vehicle on a shuttle run has got to after driving `distanceM`, and
// which way it is pointing.
//
// The one place this is worked out, because three things need the same answer
// and must not derive it separately: the model drives it every frame, the
// shared layout precomputes where each vehicle comes to REST so a drill-in can
// aim at it, and the camera follows it in. On the concentric plan those agreed
// because a lap was a rigid rotation anyone could reproduce from a bearing and
// a radius; a triangle wave along a line is not something to reimplement twice.
export function shuttleAt(
  run: ShuttleRun,
  distanceM: number
): { east: number; north: number; outbound: boolean } {
  const span = run.toAlongM - run.fromAlongM
  const lap = span * 2
  const d = ((distanceM % lap) + lap) % lap
  const outbound = d < span
  const alongM = run.fromAlongM + (outbound ? d : lap - d)
  return {
    ...at(alongM, outbound ? run.acrossM : -run.acrossM),
    outbound,
  }
}

// Where a category the plan doesn't zone explicitly stands: past the head of
// Main Avenue, so a race added to the dataset lands on open regolith beyond the
// built plan instead of inside somebody's block. Fanned out ACROSS the avenue
// from there, centred south of it: the guideway leaves town one grid cell
// north of Main Avenue and runs on through here.
export const FALLBACK_ALONG_M = SPINE_END_M + 70
export const FALLBACK_ACROSS_M = -40
export const FALLBACK_SPREAD_M = 60
