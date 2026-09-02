// Where the roads of Moon Base Zero meet each other.
//
// A road network is only a network at its crossings, and a crossing is the one
// piece of a road that cannot be built from that road alone. Everything else in
// BaseRoads is a cross-section swept along a centreline — a job each street can
// do in isolation — but the windrow of pushed-aside rock along a road's edge has
// to KNOW about the other roads, because a grader joining an existing route
// sweeps its spoil out of the crossing rather than heaping it across, and a
// junction with a half-meter wall of rubble and a line of boulders through it
// does not read as a junction at all. It reads as two roads drawn separately
// that happen to overlap, which is exactly what it would be.
//
// So this module is the pre-pass: it samples every street's centreline, finds
// every place two of them meet, and says how far back each of the two has to be
// swept. Both roads at a junction then grade themselves against the same shared
// point, and they agree about it by construction rather than by two hand-tuned
// numbers that have to be kept in step.
//
// WHY THE CROSSINGS ARE FOUND AND NOT DECLARED. The plan already derives its
// branches from the districts (see BASE_STREETS), so a race that moves to another
// crossing, or a branch lengthened by a district that grew, takes its
// junctions with it. A hand-written list of crossings is one more thing that
// would quietly go stale when that happened, and the failure would be silent:
// rubble through a junction looks like scenery, not like a bug.
//
// WHY IT IS A DISTANCE MINIMUM AND NOT A SEGMENT CROSSING. On the linear plan
// every junction really is a crossing — each branch meets the spine at its own
// midpoint and carries on out the far side — so a segment intersection would
// find all seven of them, which was not true before: on the radial plan a road
// T'd into the ring at its own first station, drawn to start at exactly the
// ring's radius while the ring was a spline that bulged a fraction of a meter
// inside the true circle between waypoints, and four of the seven approaches
// therefore came within centimetres of each other and crossed nothing at all.
//
// A minimum stays, for two reasons that outlive that geometry. It is what gives
// the fillet a CENTRE to grade around, which an intersection point of two
// infinitely thin lines does not; and a road that stops on another rather than
// crossing it is a thing this plan is one edit away from at any time — the
// landing zone would have had one if the pads were not on the spine — and an
// intersection test would silently find nothing there, which is a wall of
// rubble through a junction and no error anywhere.

import * as THREE from 'three'
import { ROAD_HALF_M, type Street } from './baseplan'

// One station roughly every 2.5 m of road: close enough that the bed follows
// the terrain's undulations, and that the berm's jitter reads as rubble rather
// than as a slow wave. Lives here because the junction search and the geometry
// build have to walk the same stations.
export const STATION_SPACING_M = 2.5

// Half the sintered lane, in meters, at full road width. Everything outboard of
// this is shoulder and spoil.
export const BED_HALF_M = 4.1

// The inner toe of the windrow, where the heap meets the scuffed verge.
export const SPOIL_TOE_OFF_M = 4.72

// The outermost lane of the cross-section that is still fully opaque; the
// windrow's outer flank feathers into the regolith beyond it.
//
// This lives here, next to the junction figures, because it is the constraint
// that makes JUNCTION_MERGE_M safe rather than a free choice: a road that gives
// way at a crossing has to have its own surface back to full strength while it
// is still over ground the through road covers solidly, or the crossing gets a
// ring of half-transparent ground around it that neither road quite paves.
export const SPOIL_OPAQUE_OFF_M = 5.62

// How far off a road another road's centreline has to pass before the search
// stops looking for a crossing between them. Comfortably wider than the widest
// clearance below, because this is only the window the search runs in; what
// decides whether there is actually a junction there is TOUCH.
export const JUNCTION_SEARCH_M = 18

// How near the two centrelines have to come at their closest for that to count
// as a junction rather than a near miss. Loose on purpose — see the note above
// about roads that T into a splined loop a few centimetres short of it.
export const JUNCTION_TOUCH_M = 3

// Ground swept clear of spoil on each approach, PAST the half-width of whatever
// crosses there. This is what turns a crossing into a flared apron rather than a
// gap punched in a wall of rubble, and it is why the two roads at a junction
// almost never get the same figure: what a road has to be swept back for is the
// OTHER one's width, not its own.
export const JUNCTION_FILLET_M = 4.5

// Meters beyond that over which the windrow climbs back to full height.
export const JUNCTION_TAPER_M = 7

// Meters over which the road that gives way at a crossing brings its surface
// back, measured out from the edge of the through road's sintered lane.
//
// Long enough not to read as a ruled line, and short enough to fit between
// BED_HALF_M and SPOIL_OPAQUE_OFF_M with the windrow's lateral jitter allowed
// for — which is the invariant, and is asserted.
export const JUNCTION_MERGE_M = 1.1

// Subdivisions used to refine a crossing off the station the search landed on.
// Stations are 2.5 m apart, so an unrefined junction can sit over a meter from
// where the two centrelines actually meet, and a junction a meter out of place
// is a junction whose flare is swept a meter further on one approach than on the
// opposite one. This is a single pass over two segments, once per crossing.
const REFINE_STEPS = 40

// A road's centreline, sampled at stations in the flat map frame.
export type Centreline = {
  plan: THREE.Vector2[]
  spans: number
  lengthM: number
  closed: boolean
  // Whether the plan declares this a through route, which is what decides who
  // carries a crossing — see throughRoad.
  through: boolean
  // Half this road's own sintered lane, which is what a road crossing it has to
  // be swept back far enough to clear.
  bedHalfM: number
  // Half the outside of its windrow, which is what the plan measures every
  // plot's setback from.
  toeHalfM: number
  widthScale: number
}

export type Junction = {
  east: number
  north: number
  // Distance along each of the two roads that meet here, keyed by street index,
  // over which that road's windrow is graded flat. Only those two roads are in
  // the map, which is also how a road finds the junctions that concern it.
  clear: Map<number, number>
  // Which of the two owns the ground in the middle. See throughRoad.
  through: number
}

// Which road's surface CARRIES a crossing, the other one stopping at its edge.
//
// Sweeping the rubble out of a junction is not on its own enough to make one,
// because both roads are still a full-width surface swept along their own
// centreline and both still cover the middle. Two textured, cambered, separately
// lit surfaces stacked on the same patch of ground do not average into one: the
// one drawn second wins, and since its grain and its camber run the other way it
// wins as a hard-edged rectangle sitting a shade off its surroundings. That
// rectangle is exactly the tell that the roads are lying on each other, and no
// amount of matching their colours removes it, because the difference is in the
// lighting and not in the paint.
//
// So one of the two gives way: its surface stops at the through road's lane
// edge and picks up again on the far side, which leaves precisely one surface on
// every patch of ground and puts the only seam where a road's edge belongs.
//
// A road the plan DECLARES a through route wins (see `through` in Street, which
// on this plan is the spine and only the spine). It runs the length of the
// settlement and every other road crosses it, so breaking it at all seven of
// its crossings so a branch could lie across it would just be the same artefact
// the other way round. Failing that the wider road carries it, and failing that
// the earlier one, so the answer never depends on the order the plan happens to
// list its streets in.
//
// The flag is declared rather than inferred, and it used to be inferred: a
// CLOSED road was the through route, which was sound when the network was two
// ring roads and a fan of radial spurs, because a loop is continuous by
// construction and a spur is not. Nothing is closed on a linear plan, so that
// test silently stopped deciding anything — and three of the branches are full
// haul width, so the width rule below could not break the tie either and the
// crossings fell through to "whichever road the plan listed first". That is a
// correct answer for exactly as long as nobody reorders BASE_STREETS.
function throughRoad(i: number, li: Centreline, j: number, lj: Centreline) {
  if (li.through !== lj.through) return li.through ? i : j
  if (li.bedHalfM !== lj.bedHalfM) return li.bedHalfM > lj.bedHalfM ? i : j
  return Math.min(i, j)
}

export function centreline(street: Street): Centreline | null {
  if (street.points.length < 2) return null
  // Spline the centreline through the waypoints in the flat map frame — over
  // 150 m of a 1737 km sphere the curvature is far below the width of the road
  // — so a handful of hand-placed corners comes out as a graded curve.
  const curve = new THREE.CatmullRomCurve3(
    street.points.map(([e, n]) => new THREE.Vector3(e, n, 0)),
    !!street.closed,
    'catmullrom',
    0.4
  )
  const lengthM = curve.getLength()
  const spans = Math.max(8, Math.round(lengthM / STATION_SPACING_M))
  // A closed loop's first and last stations are the same point, and letting
  // both exist leaves a hairline seam; consumers wrap to station 0 instead.
  const pts = curve.getSpacedPoints(spans)
  const stations = street.closed ? spans : spans + 1
  const widthScale = street.width ?? 1
  return {
    plan: pts.slice(0, stations).map((p) => new THREE.Vector2(p.x, p.y)),
    spans,
    lengthM,
    closed: !!street.closed,
    through: !!street.through,
    bedHalfM: BED_HALF_M * widthScale,
    toeHalfM: ROAD_HALF_M * widthScale,
    widthScale,
  }
}

export function distToCentreline(p: THREE.Vector2, line: Centreline): number {
  const pts = line.plan
  const n = pts.length
  const segs = line.closed ? n : n - 1
  let best = Infinity
  for (let i = 0; i < segs; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    const abx = b.x - a.x
    const aby = b.y - a.y
    const len2 = abx * abx + aby * aby
    const t =
      len2 > 0
        ? THREE.MathUtils.clamp(
            ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2,
            0,
            1
          )
        : 0
    best = Math.min(
      best,
      Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t))
    )
  }
  return best
}

// The closest the walked road actually comes to the other one, searched between
// the neighbours of the station the sweep settled on. Chording across two
// segments rather than following the spline is exact for a straight road, which is
// straight, and off by under 5 cm on either loop at this station spacing.
function refine(walk: Centreline, against: Centreline, at: number) {
  const n = walk.plan.length
  const idx = (k: number) =>
    walk.closed ? (k + n) % n : THREE.MathUtils.clamp(k, 0, n - 1)
  const a = walk.plan[idx(at - 1)]
  const b = walk.plan[idx(at + 1)]
  let point = walk.plan[at]
  let dist = distToCentreline(point, against)
  const p = new THREE.Vector2()
  for (let s = 1; s < REFINE_STEPS; s++) {
    p.lerpVectors(a, b, s / REFINE_STEPS)
    const d = distToCentreline(p, against)
    if (d < dist) {
      dist = d
      point = p.clone()
    }
  }
  return { point, dist }
}

// Every place two roads meet. Indices into `lines` are the street indices the
// junctions are keyed by, so a null entry still takes its slot.
export function findJunctions(lines: (Centreline | null)[]): Junction[] {
  const out: Junction[] = []
  for (let a = 0; a < lines.length; a++) {
    for (let b = a + 1; b < lines.length; b++) {
      const la = lines[a]
      const lb = lines[b]
      if (!la || !lb) continue
      // Walk the shorter road against the longer one's segments: the same
      // answer either way, and on this plan it means walking a branch rather
      // than a loop. Distance is measured to the other road's SEGMENTS rather
      // than to its stations, so the junction is located to well inside a meter
      // however coarsely the road it meets happens to be sampled.
      const swap = la.plan.length > lb.plan.length
      const i = swap ? b : a
      const j = swap ? a : b
      const walk = swap ? lb : la
      const against = swap ? la : lb

      const n = walk.plan.length
      const d = walk.plan.map((p) => distToCentreline(p, against))
      // A closed road could have a run of near stations straddling station 0,
      // so start the sweep somewhere that isn't in one.
      let start = 0
      if (walk.closed) {
        while (start < n && d[start] < JUNCTION_SEARCH_M) start++
        if (start >= n) start = 0
      }

      let run: number[] = []
      const settle = () => {
        if (!run.length) return
        const at = run.reduce((best, k) => (d[k] < d[best] ? k : best), run[0])
        run = []
        const { point, dist } = refine(walk, against, at)
        if (dist > JUNCTION_TOUCH_M) return
        out.push({
          east: point.x,
          north: point.y,
          clear: new Map([
            [i, against.bedHalfM + JUNCTION_FILLET_M],
            [j, walk.bedHalfM + JUNCTION_FILLET_M],
          ]),
          through: throughRoad(i, walk, j, against),
        })
      }
      for (let s = 0; s < n; s++) {
        const k = (start + s) % n
        if (d[k] < JUNCTION_SEARCH_M) run.push(k)
        else settle()
      }
      settle()
    }
  }
  return out
}

// The junctions on one road, as the flat pair of numbers the geometry build
// actually wants: where the crossing is, and how far back this road's spoil has
// to be swept for it.
export function junctionsOn(junctions: Junction[], streetIdx: number) {
  return junctions
    .filter((j) => j.clear.has(streetIdx))
    .map((j) => ({ x: j.east, y: j.north, clear: j.clear.get(streetIdx)! }))
}

// How much windrow a point on a road is entitled to: nothing inside a crossing,
// climbing back to full over the taper beyond it. Distance is measured as a
// straight line in the plan frame rather than as arc length, which is the same
// thing to well inside a meter over the ~17 m either side of a junction that
// this reaches.
export function junctionBermLevel(
  east: number,
  north: number,
  meets: { x: number; y: number; clear: number }[]
): number {
  let level = 1
  for (const m of meets) {
    const d = Math.hypot(east - m.x, north - m.y)
    const t = THREE.MathUtils.clamp((d - m.clear) / JUNCTION_TAPER_M, 0, 1)
    level = Math.min(level, t * t * (3 - 2 * t))
  }
  return level
}

// The crossings where this road gives way, as the through road's centreline and
// the half-width of the lane its surface has to stop at. Empty for a road that
// carries all of its own junctions, which is every closed loop on this plan.
export function junctionCutsOn(
  junctions: Junction[],
  streetIdx: number,
  lines: (Centreline | null)[]
): { line: Centreline; halfM: number }[] {
  const out: { line: Centreline; halfM: number }[] = []
  for (const j of junctions) {
    if (!j.clear.has(streetIdx) || j.through === streetIdx) continue
    const line = lines[j.through]
    if (line) out.push({ line, halfM: line.bedHalfM })
  }
  return out
}

// How much of its own surface a giving-way road still draws at a point: none
// inside the through road's lane, all of it a merge-length outside.
//
// Measured to the through road's whole CENTRELINE rather than to the junction
// point, because what the surface has to stop at is the edge of the other road's
// lane, which is a straight line across this one — not a circle around where the
// two centrelines happen to be closest. The distinction is the difference
// between a road that meets another squarely and one that meets it through a
// bite taken out of its end.
export function junctionBedCut(
  east: number,
  north: number,
  cuts: { line: Centreline; halfM: number }[]
): number {
  if (!cuts.length) return 1
  const p = new THREE.Vector2(east, north)
  let open = 1
  for (const c of cuts) {
    const d = distToCentreline(p, c.line)
    const t = THREE.MathUtils.clamp((d - c.halfM) / JUNCTION_MERGE_M, 0, 1)
    open = Math.min(open, t * t * (3 - 2 * t))
  }
  return open
}

// How much of the bed a crossing is already carrying, which is what stops a road
// that ENDS in a junction fading out into it. A road that Ts into another joins
// it; fading there would put a notch in the surface at the exact point the two
// are supposed to become one.
export function junctionBedCover(
  east: number,
  north: number,
  meets: { x: number; y: number; clear: number }[]
): number {
  let cover = 0
  for (const m of meets) {
    const d = Math.hypot(east - m.x, north - m.y)
    const t = THREE.MathUtils.clamp(d / m.clear, 0, 1)
    cover = Math.max(cover, 1 - t * t * (3 - 2 * t))
  }
  return cover
}
