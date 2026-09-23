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
// WHY IT IS A DISTANCE MINIMUM AND NOT A SEGMENT CROSSING. Because on this plan
// nothing crosses anything: every junction is a T. A branch STARTS on the spine
// and runs away from it to the district at its far end, and a spur starts on its
// parent branch and does the same. A segment-intersection test would find a
// touch at the very end of one segment in all ten cases, which is the numerically
// worst place to ask it, and would find nothing at all the moment a road was
// nudged a centimetre short of the one it joins.
//
// This is a change from the plan before it, where each branch straddled the
// spine at its own midpoint and carried on out the far side, so all seven really
// were crossings. The search did not need editing for that, which is the point
// of having written it this way: a minimum locates a T and a crossing with the
// same code.
//
// The minimum also gives the fillet a CENTRE to grade around, which the
// intersection of two infinitely thin lines does not.

import * as THREE from 'three'
import { RANK_BRANCH, ROAD_HALF_M, type Street } from './baseplan'

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

// Meters of sweep past the point an approach finally leaves the other road's
// graded width, for a junction shallow enough that this is the binding figure
// rather than the fillet above.
//
// A road meeting another SQUARE crosses its graded width in that width. A road
// meeting it at an angle lies inside it for width/sin(angle) — which runs away
// fast, and the plan's branches now leave the spine at 35 to 80 degrees rather
// than all at 90. Construction's branch diverges at 35, so it is inside the
// spine's windrow for 11 m of its own length where the fillet sweeps 8.6, and
// the last 2 m of that had a windrow standing on the spine's shoulder.
//
// Kept as a separate, smaller margin rather than reusing JUNCTION_FILLET_M so
// that the square junctions come out at exactly the figure they always did:
// this only ever raises a clearance, never lowers one, and at 90 degrees it
// does not bind at all.
export const JUNCTION_SHALLOW_MARGIN_M = 1.5

// Meters beyond that over which the windrow climbs back to full height.
export const JUNCTION_TAPER_M = 7

// Meters over which the road that gives way at a crossing brings its surface
// back, measured out from the edge of the through road's sintered lane, AT FULL
// ROAD WIDTH. Scaled by the through road's own width where it is used, because
// the gap it has to fit into scales too.
//
// Long enough not to read as a ruled line, and short enough to fit between
// BED_HALF_M and SPOIL_OPAQUE_OFF_M with the windrow's lateral jitter allowed
// for — which is the invariant, and is asserted. That gap is 1.5 m at full
// width and 0.8 m on a 0.55-width spur, so a merge fixed in absolute meters
// fits the spine and overruns everything narrower: it would bring a road's
// surface back on ground where the road it is joining has already faded to
// gravel, which is the ring of unpaved ground the seam is meant to avoid.
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
  // Which tier of the street plan this road belongs to, which is what decides
  // who carries a crossing — see throughRoad.
  rank: number
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
// The HIGHER-RANKED road wins (see `rank` in Street): the spine carries its
// crossings with the branches, and a branch carries its crossing with its own
// spur. That is the same rule the ground gives you — you do not break a street
// to let a driveway across it — and it falls out of the plan's three tiers
// rather than being decided here. Failing a rank difference the wider road
// carries it, and failing that the earlier one, so the answer never depends on
// the order the plan happens to list its streets in.
//
// This was a BOOLEAN before the plan grew a third tier, and the boolean was
// only ever half an answer. It could say "the spine is the through route", which
// settled the seven spine-and-branch crossings, and it had nothing at all to
// say about a spur meeting its parent branch: both were false, so those fell
// through to the width tie-break — and a 0.55-width spur off a 0.55-width
// branch ties there too — and then to "whichever road the plan listed first".
// That is a correct answer for exactly as long as nobody reorders BASE_STREETS,
// and a wrong one silently, because a spur laid ACROSS its own branch looks
// like scenery rather than like a bug.
//
// Before the boolean it was inferred from `closed`, which was sound while the
// network was two ring roads and a fan of radial spurs — a loop is continuous
// by construction and a spur is not — and stopped deciding anything the moment
// nothing was closed.
function throughRoad(i: number, li: Centreline, j: number, lj: Centreline) {
  if (li.rank !== lj.rank) return li.rank > lj.rank ? i : j
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
    rank: street.rank ?? RANK_BRANCH,
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

// The sine of the angle two roads cross at, taken from their local tangents at
// the crossing rather than from their end-to-end bearings, so a road that meets
// a curve is measured against the part of the curve it actually meets.
function crossingSin(
  walk: Centreline,
  against: Centreline,
  at: THREE.Vector2
) {
  return Math.abs(tangentNear(walk, at).cross(tangentNear(against, at)))
}

// A road's unit direction near a point: the chord of the segment whose interior
// the point projects into, which is exact for the straight roads this plan is
// built from and a good local tangent for anything else.
function tangentNear(line: Centreline, at: THREE.Vector2) {
  const pts = line.plan
  const n = pts.length
  const segs = line.closed ? n : n - 1
  let best = Infinity
  let dir = new THREE.Vector2(1, 0)
  for (let k = 0; k < segs; k++) {
    const a = pts[k]
    const b = pts[(k + 1) % n]
    const ab = new THREE.Vector2(b.x - a.x, b.y - a.y)
    const len2 = ab.lengthSq()
    const t =
      len2 > 0
        ? THREE.MathUtils.clamp(
            ((at.x - a.x) * ab.x + (at.y - a.y) * ab.y) / len2,
            0,
            1
          )
        : 0
    const d = Math.hypot(at.x - (a.x + ab.x * t), at.y - (a.y + ab.y * t))
    if (d < best) {
      best = d
      dir = ab.normalize()
    }
  }
  return dir
}

// Floor on that sine, so two roads which touch nearly tangentially — which this
// plan has none of, and which would be a planning mistake rather than something
// to render around — ask for a finite sweep instead of an unbounded one.
const MIN_CROSSING_SIN = Math.sin(THREE.MathUtils.degToRad(20))

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
        // How obliquely the two meet, which sets how much of each approach lies
        // inside the other's windrow and so how far back each has to be swept.
        const sin = Math.max(crossingSin(walk, against, point), MIN_CROSSING_SIN)
        const clearOf = (other: Centreline) =>
          Math.max(
            other.bedHalfM + JUNCTION_FILLET_M,
            other.toeHalfM / sin + JUNCTION_SHALLOW_MARGIN_M
          )
        out.push({
          east: point.x,
          north: point.y,
          clear: new Map([
            [i, clearOf(against)],
            [j, clearOf(walk)],
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
// carries all of its own junctions, which on this plan is the spine.
export function junctionCutsOn(
  junctions: Junction[],
  streetIdx: number,
  lines: (Centreline | null)[]
): RoadCut[] {
  const out: RoadCut[] = []
  for (const j of junctions) {
    if (!j.clear.has(streetIdx) || j.through === streetIdx) continue
    const line = lines[j.through]
    if (line)
      out.push({
        line,
        halfM: line.bedHalfM,
        mergeM: JUNCTION_MERGE_M * line.widthScale,
      })
  }
  return out
}

export type RoadCut = { line: Centreline; halfM: number; mergeM: number }

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
  cuts: RoadCut[]
): number {
  if (!cuts.length) return 1
  const p = new THREE.Vector2(east, north)
  let open = 1
  for (const c of cuts) {
    const d = distToCentreline(p, c.line)
    const t = THREE.MathUtils.clamp((d - c.halfM) / c.mergeM, 0, 1)
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
