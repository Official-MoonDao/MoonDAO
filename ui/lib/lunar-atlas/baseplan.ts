// The site plan for Moon Base Zero.
//
// The base is laid out as eight DISTRICTS, one per capability race, arranged as
// a compact zoned settlement on the ridge crest rather than at the projects'
// (approximate, heavily overlapping) real coordinates — so the patch reads as
// one base instead of scattered hardware. Offsets are REAL METERS in the
// terrain's map frame [+east, +north]; the base is true to scale.
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
// THE STREET PLAN HAS THREE TIERS. One straight SPINE runs the length of the
// ridge crest. Each district is reached by its own BRANCH off that spine, and
// the district stands at the FAR END of its branch, not at the crossing. The
// larger races put their smaller competitors out on a SPUR off their own
// branch. There is no core, no plaza and no ring: an address on this base is a
// road you drive to the end of.
//
// WHY THE DISTRICTS SIT AT THE ENDS OF THEIR BRANCHES
//
// Because that is what makes a road mean anything. The plan this replaces put
// every district ON the spine, taking the four corner lots of its own crossing,
// which left eight identical perpendicular stubs ticked off one line and every
// asset on the base crowded against the same through road. It read as a
// fishbone rather than a settlement: nothing was anywhere, because everything
// was on the main street.
//
// Standing each race at the end of its own branch buys three things at once. A
// branch acquires a destination, so it reads as a road TO somewhere instead of
// a stub across something. The districts stop competing for frontage on one
// road, so they can be spaced by where they actually are rather than by how far
// apart their blocks are along a single line. And the settlement gains depth
// from every angle, because a district is now separated from its neighbours
// across two axes instead of one.
//
// WHY THE BRANCHES ARE DIAGONAL, AND WHY THEY ARE NOT SYMMETRIC
//
// This is the ground's decision, not a stylistic one, and it is the reason the
// layout comes out varied rather than regular.
//
// A branch has to run somewhere buildable, and perpendicular to the spine is
// very nearly the FALL LINE off the crest. Every crossing was profiled off the
// rendered height field, sweeping all 36 ten-degree bearings and walking out to
// 260 m at 5 m stations, scoring the longest run that holds under a 10% worst
// step grade and 12 m of relief. Three things came out of it:
//
//   1. The buildable direction is DIAGONAL. Perpendicular (130 deg) dies inside
//      100 m at four of the eight crossings. Bearings 40 to 70 deg off the
//      spine run the full 260 m almost everywhere, because they hold a contour
//      instead of crossing them.
//
//   2. The buildable diagonal ROTATES along the spine, because the ridge does.
//      At the southwest end it is 70-100 deg; by the middle 90-120; at the
//      northeast end 130-180. So the branches fan, and they fan because the
//      crest fans.
//
//   3. The two sides of the spine are NOT equivalent. The southeast flank falls
//      away hard around `along` -40 to 0 — every bearing into it dies inside
//      25 m — while the northwest side runs long there. So branches cannot
//      mirror, and a district's side is chosen for it.
//
// The result is seven branches between 55 and 145 m long, at +40, -130, +55,
// -35, +80, -50 and +60 degrees off the spine, four to the northwest and three
// to the southeast. None of that spread was designed. It is what the ridge
// allows, and it is why the plan no longer looks ruled.
//
// WHY LINEAR, AND NOT THE RADIAL-CONCENTRIC PLAN THIS REPLACES
//
// SOM's Moon Village master plan (with ESA) reviewed the obvious precedents —
// grid plans from Roman military camps to the Public Land Survey, radial plans
// from Howard's Garden City — and picked the Linear City as "best suited for the
// irregular terrain at the lunar south pole", on grounds of safety, efficiency
// and expandability, and specifically because it adapts to the rim of
// Shackleton. That is this site. Their plan runs parallel BANDS along the rim:
// habitation, then infrastructure, then staging, with power and transport
// pushed furthest out. On a spine those bands become position ALONG the road,
// which is the order the districts are declared in below.
//
// A ring road says a settlement grew outward from one landing and stopped. A
// spine says it is still being built, in both directions, which is the truer
// thing to say about a base whose whole subject is who gets there. It also
// grows without redrawing: a new race is a new branch further along, where on
// the concentric plan it was another wedge of a circle that only held eight.
//
// WHY THE SPINE RUNS ON 40 DEGREES
//
// Because a straight road 730 m long has nowhere to hide from grade, so the
// bearing is measured off the same rendered height field the terrain draws
// from rather than chosen. Every whole bearing was profiled over the spine's
// true extent (SPINE_START_M to SPINE_END_M, which is not symmetric about the
// origin), sampling every 5 m, and scored two ways: total relief end to end,
// and the worst grade over any one 5 m step. Those two disagree, which is the
// only interesting thing in the measurement:
//
//                    relief          worst grade
//      19 deg       16.4 m  ( 88)      7.2%  (  1)
//      40 deg       12.7 m  ( 24)      8.0%  ( 14)   <- this
//      45 deg       11.9 m  ( 19)      8.6%  ( 23)
//      57 deg       11.1 m  (  1)     12.3%  ( 63)
//      90 deg       17.8 m  ( 60)     15.3%  ( 74)
//     135 deg       41.5 m  (167)     25.6%  (154)
//     144 deg       43.2 m  (180)     30.9%  (177)
//
// (rank out of 180 in brackets). The flattest axis end to end, 57 deg, gets
// there by climbing and descending steeply; the gentlest local grade, 19 deg,
// pays 5 m of extra fall for it. 40 deg is the only bearing in the top 15% on
// BOTH, so it is what the spine runs on: 12.7 m over 730 m is a 1.7% average,
// and nothing on it pitches past 8%.
//
// That it is also the guideway's heading (TRACK_HEADING_DEG, see trackplan) is
// not a coincidence and not a constraint imposed here — the guideway was
// levelled against this same field for its own reasons, needing flat because
// fall is leg height. Two independent answers to the same question about the
// same ridge landing on the same line is the measurement agreeing with itself.
// The launcher therefore reads as the street continuing out of town.
//
// The spine is also ~79 deg off the home camera's view axis (HOME_CAM looks
// from east 171, north -211 at east 20, north 10), so it lies ACROSS the frame
// and reads as a long street rather than receding to a point.
//
// WHAT IS HERE THAT IS NOT A RACE
//
// One thing: the SOLAR FARM (see SOLAR_ARRAYS, below the district keep-out).
// Nobody is competing to build the colony's own generation, so it is not a
// district and has no roster — it is shared infrastructure in the same sense as
// the rover depot, just far larger. It is also the answer to the one thing the
// tiered plan made worse: standing the districts at the ends of their branches
// left large wedges of the flanks between them, and a solar farm is the one
// kind of built ground that is SUPPOSED to be mostly empty. It is surveyed to
// the sun rather than to the ridge, for reasons argued where it is defined.
//
// Nothing here is hand-authored twice: the districts declare where their branch
// leaves the spine and which way it runs, and the district's own position, its
// plot packing (districtSlots) and the road network (BASE_STREETS) are all
// derived from that. A race that gains a competitor gets a lot on its own
// street; it never needs a road drawn for it.
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

// Heading of the spine, degrees CCW from east (see `dirFor`). See the table
// above for why it is this and not one of the other 179.
export const SPINE_BEARING_DEG = 40

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
// down the same verge get LANE_CLEAR_M, which is this plus both their setbacks,
// because nothing else gives them a strip against the pavement; plots facing
// each other across a street are held apart by the road (see ROAD_HALF_M),
// which is far more than this.
export const DISTRICT_GAP_M = 6

// How far past the last thing it serves a road runs before it stops: the
// turning circle a hauler needs at a dead end. A branch that stops short of its
// own district reads as unfinished, and one that overshoots reads as a road to
// nowhere, so this is the only slack either is given.
export const BRANCH_TAIL_M = 7

// ---------------------------------------------------------------------------
// The spine's frame
// ---------------------------------------------------------------------------

// Unit vector for a heading, measured in degrees CCW from EAST — the maths
// convention, not the surveyor's. So 0 is +east, 90 is +north, and the spine's
// 40 is northeast. Every `bearingDeg` in this file, including every branch and
// spur, is in these terms; a compass bearing read off a map is 90 minus this.
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
// coordinate pair, for the same reason the concentric plan wrote bearings
// instead of coordinates: a hand-rounded pair sits centimeters off the road,
// and every plot's setback is then measured from a crossing that is not quite
// on the street it fronts.
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

// Where the spine starts and stops, in meters along: far enough past the
// crossings at each end — the landing zone to the southwest, the mass driver's
// breach works to the northeast — to run clear of both, and asserted against
// them rather than eyeballed.
export const SPINE_START_M = -330
export const SPINE_END_M = 400

// ---------------------------------------------------------------------------
// How a district is reached
// ---------------------------------------------------------------------------

// A SPUR: a short road off a branch, taking the `takes` smallest competitors of
// the race out to their own dead end.
//
// This is what stops a big roster reading as a queue. Five paving bids all
// fronting one branch is a terrace; three on the branch and two round a corner
// is a neighbourhood, and it costs one extra road. Only the larger races get
// one — a spur to a single competitor would be a road built for one shed.
export type Spur = {
  // Meters along the parent branch, from the spine, where the spur leaves it.
  atM: number
  // Absolute compass bearing, degrees CCW from east. Absolute rather than
  // relative to the parent so it can be read straight off the height-field
  // survey, which is what picked it.
  bearingDeg: number
  lengthM: number
  // How many of the race's SMALLEST competitors stand out here.
  takes: number
  width?: number
}

// A district's BRANCH: the road that leaves the spine and runs to it.
export type Branch = {
  // Absolute compass bearing, degrees CCW from east — see the survey notes at
  // the top for why each of these is the value it is.
  bearingDeg: number
  // Meters from the spine to the district's centre, which is where this road's
  // centreline ends and its turning circle begins.
  lengthM: number
  width?: number
  spur?: Spur
}

// How a district's competitors stand relative to the streets around them.
export type Frontage =
  // Around the dead end of the district's own branch: the largest competitor
  // standing at the head where the road runs out, the rest lining the final
  // approach, alternating sides. The default, and what makes a branch read as
  // a road to somewhere.
  | 'terminus'
  // Flanking the spine itself, one plot each side, with no branch of its own.
  // For the landing zone, whose pads are both far too big to stand at the end
  // of a road and far too dangerous to put down one — see BASE_PLAN.lander.
  | 'flank'
  // No road through the lot at all, assets standing in a line along one shared
  // axis. For a district whose competitors read as a procession rather than a
  // block — nothing currently uses this, but it stays available as a frontage a
  // future single-file district can ask for.
  | 'lot'

export type SitePlan = {
  // Meters east and north of the ridge center — the CENTER of the district,
  // which for a terminus district is the point its branch reaches and so a
  // point no asset stands on. Individual plots are placed by districtSlots.
  //
  // DERIVED, never written by hand: `district()` walks it out from the crossing
  // along the branch, so a district is exactly at the end of exactly its own
  // road however either is edited.
  east: number
  north: number
  // Meters along the spine where this district's branch leaves it. The one
  // coordinate that orders the districts, and for a flank district the only
  // one it has.
  alongM: number
  // Degrees this installation is turned off the base's common heading.
  //
  // Every site shares ONE bearing by default (see facingYaw in ProjectModel).
  // That shared axis is the whole trick: sites spread over 700 m that each aim
  // independently at a viewpoint 130 m away splay by tens of degrees, and that
  // splay is what made the settlement read as unrelated hardware dropped on a
  // plain. Holding one axis makes it read as surveyed. These are the
  // deliberate departures from it — enough to keep the plan from looking like
  // a chorus line, never enough to turn an asset's back on the viewer.
  //
  // Note this is NOT the branch's bearing. The roads fan; the buildings do not,
  // because a building turned to face a diagonal street 200 m from the camera
  // turns its back on the camera, and the streets already carry the variety.
  turn: number
  front?: Frontage
  branch?: Branch
  // Meters of ground the district occupies in ANY direction from its centre —
  // its keep-out, used to hold base-wide filler off it.
  //
  // One number rather than a width and a depth, because the shape it stands in
  // for is a CAPSULE and not a box: a terminus district's ground is the corridor
  // either side of its own branch, plus the turning circle at the end of it (see
  // districtGround). So this is simply the farthest any of its plots reaches
  // from its centre, which is what districtExtentM computes and what the tests
  // assert it against — the value is hand-set and the rosters are not.
  block?: number
  // For a 'lot' district only: the compass bearing, degrees CCW from east, that
  // its assets stand along, largest to smallest.
  lotAxis?: number
  // For a 'flank' district only: which side of the spine the largest plot
  // takes, +1 for left of the outbound (northeast) direction. The landing
  // zone's Starship is the tallest thing on the base and it wants to stand
  // clear of the frame's centre.
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

// Walk a district out from its crossing to the end of its branch.
//
// The district's coordinates are derived here and nowhere else, which is the
// invariant that keeps a district on its own road: edit the bearing, the length
// or the crossing and the position follows, where a hand-written pair would
// quietly stay behind.
function district(
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
// standing square across that end.
//
// Not the same as frontageM, and the difference is the whole reason this
// exists. A plot BESIDE a road is set back from a centreline that runs past it,
// so what it clears is the road's half-width. A plot at the HEAD of a dead end
// stands square across the end of the pavement, and the end of the pavement is
// a TURNING CIRCLE — a disc about as wide as the road, not a point. So it has
// to clear the tail, then the circle, then its own setback.
//
// Getting this wrong is not subtle and it is not cosmetic: measuring only the
// tail put the rover depot's own plot 4 m from the middle of its turning
// circle, which is to say in it.
function headM(radiusM: number): number {
  return BRANCH_TAIL_M + ROAD_HALF_M + SETBACK_M + radiusM
}

// Meters between the edges of two plots that stand one behind the other down
// the SAME side of a road.
//
// More than DISTRICT_GAP_M, and the extra is both setbacks. Plots facing each
// other across a street are held apart by the road, and each keeps its own
// clear strip against the pavement as a side effect. Two plots on the same
// verge are the one pair on this plan with no road between them at all, so
// nothing gives them that strip unless it is put here — and without it a race
// with three competitors down one side reads as a terrace, its buildings closer
// to each other than any of them is to the road they front.
const LANE_CLEAR_M = DISTRICT_GAP_M + 2 * SETBACK_M

// Place a race's competitors on the streets of their district, largest first.
//
// Positions come back absolute. The terminus and flank cases each work in the
// frame of the road they front — `along` out from the spine, `across` to its
// left — which is a flat offset from a straight line and therefore exact. That
// is the simplification the linear plan buys: on the concentric plan each
// district had its own rotated frame and the corner lots had to be solved in
// POLAR terms, because the two streets a district fronted were a circle and a
// radial and only polar offsets were exactly the setback from both. Every road
// here is straight, so the arc-versus-tangent correction that used to eat the
// whole setback is simply gone.
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
  //
  // Working BACK from the head rather than out from the spine is what makes the
  // arrangement independent of how long the road is: lengthen a branch and its
  // buildings stay clustered at the end of it, where lengthening it from the
  // other direction would leave the cluster stranded halfway down.
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

  switch (plan.front ?? 'terminus') {
    case 'lot': {
      // No street through the lot, so the assets simply stand along an axis,
      // offset so the district center falls at the middle of their combined
      // FRONTAGE rather than between their centres — which, for a 38 m base
      // camp beside a 12 m stack, are not the same point.
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
      // The spine itself with a plot either side. Plots opposite each other are
      // held apart by the road's full width plus both setbacks, so they never
      // need spacing along it; a third and a fourth would, which is the step.
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
      // The dead end of the district's own branch, and — for the larger races —
      // of a spur off it. The spur takes the SMALLEST competitors, which is the
      // only split that reads correctly: the race's headline hardware stands
      // where its road ends and the camera arrives, and the small stuff is what
      // gets sent round the corner.
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
  // Where in the hierarchy: RANK_BRANCH for the branch, RANK_SPUR for the spur.
  rank: number
}

// The roads a district owns, branch first. Empty for a flank district, which
// owns none — it stands on the spine, which belongs to the settlement.
//
// Every other derivation about a district's geometry goes through here — the
// streets, the plot packing, the ground it keeps, which road a lot fronts — so
// there is exactly one place that knows a spur hangs off a branch at `atM`.
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
      rank: RANK_BRANCH,
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
      rank: RANK_SPUR,
    })
  }
  return out
}

// Radius in meters of the ground a district occupies once packed — the farthest
// any of its plots reaches from the district center. The road network and the
// district spacing are both checked against this.
export function districtExtentM(plan: SitePlan, plots: Plot[]): number {
  const slots = districtSlots(plan, plots)
  let max = 0
  for (const plot of plots) {
    const slot = slots.get(plot.id)
    if (slot) max = Math.max(max, slot.offsetM + plot.radiusM)
  }
  return max
}

// How far along the spine a district's branch leaves it.
export function districtAlongM(plan: SitePlan): number {
  return plan.alongM
}

// The road a point inside a district actually FRONTS, and which side of it that
// point lies on: the bearing of the nearer of the district's own branch and
// spur, and the signed lateral offset from it (+ is left of that road's own
// outbound direction).
//
// Needed because "which way does this lot face" stopped having a single answer
// when the plan grew a second tier. It used to be read off the spine, which was
// correct while every district straddled the spine; a lot on a 95 deg branch
// asked the same question gets an answer 55 degrees wrong, and for anything
// laid out along an axis — the buried vaults, whose mounds are 28 m long — that
// is the difference between a mound running away from its road into open ground
// and one running down the middle of it.
//
// Read off the point rather than stored per project because lots are assigned by
// roster rank: changing any competitor's footprint can move it to the other side
// of its road, or out onto the spur, and a stored bearing would then be silently
// stale.
export function frontingRoad(
  plan: SitePlan,
  p: { east: number; north: number }
): { bearingDeg: number; acrossM: number; head: { east: number; north: number } } {
  const roads = districtRoads(plan)
  if (!roads.length) {
    // A flank district fronts the spine itself.
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

// Eight districts down one street, declared southwest to northeast, which is
// also the order SOM's bands run in: transport and energy at the ends,
// habitation in the middle, the infrastructure that serves it either side.
//
// Which race gets which crossing is function first and composition second.
// Landing goes at one end and the launcher at the other because both throw
// things and neither should throw them over the base. Power sits beside the
// launcher because a reluctance launcher's capacitor hall is the largest
// electrical load on the plan, and it lands 300 m from the habitat, which is
// the ejecta-and-radiation logic the concentric plan could not express at all
// with everything pinned to one 96 m ring. ISRU sits between the habitat and
// the pads because the entire argument for making oxygen on the Moon is pumping
// it into a lander. Rover and construction take the crossings nearest the
// camera so the foreground carries something at human scale and the one moving
// thing on the base starts close to the eye.
//
// WHICH SIDE, AND HOW FAR OUT, IS THE GROUND'S CALL. Each branch's bearing and
// length come off the height-field survey described at the top of this file —
// the longest run at that crossing that holds under a 10% step grade and 12 m
// of relief — and the survey is what makes them uneven. Every branch and spur
// below was re-profiled at its final bearing and length: the steepest is the
// habitat spur at 9.8% and the flattest the comms branch at 2.1%, with relief
// between 0.3 and 3.9 m. Distances between districts are then measured centre to
// centre in the plan rather than along the spine, because a district is no
// longer on the spine — which is what lets the crossings sit closer together
// than their blocks are wide.
export const BASE_PLAN: Partial<Record<ProjectType, SitePlan>> = {
  // LANDING ZONE, at the southwest end. The pads FLANK the spine rather than
  // standing at the end of a branch, and this is the one district the survey
  // could have moved and shouldn't.
  //
  // A branch here is buildable — 260 m at 70-100 deg, comfortably. The reason
  // the pads stay on the through road is not grade, it is that a landing zone
  // is the one installation you must not put at the end of a cul-de-sac. With
  // no air to slow it, plume-thrown regolith travels ballistic arcs that stay
  // dangerous for hundreds of meters, so what a pad wants is the longest clear
  // sightline on the plan and two ways out of it, not a dead end 80 m from the
  // nearest building. So the haul road runs BETWEEN the two pads and carries
  // straight on out to the end of the spine.
  //
  // At 62 m across, the Starship's apron is most of a city block on its own,
  // which is the other half of it: there is no branch on this plan long enough
  // to make that a terminus rather than a blockage.
  lander: district(-280, {
    turn: 0,
    front: 'flank',
    flankSide: 1,
    // The Starship pad's own 31.2 m footprint plus its frontage off the spine,
    // which is why this is more than twice any other district's.
    block: 71,
  }),

  // ISRU YARD, 200 m southwest, out on an 80 m branch to the northwest. The
  // propellant run is 200 m of flat spine to the pads and never enters the
  // settlement, and the yard itself is now off the through road rather than
  // sitting on it, which is what a tank farm should be.
  isru_plant: district(-200, {
    turn: 8,
    branch: { bearingDeg: 80, lengthM: 80 },
    block: 21,
  }),

  // ROVER DEPOT, 120 m southwest, on the shortest branch on the plan — 55 m,
  // and the only one that runs southeast, back down the fall of the ridge
  // toward the pads. A motor pool wants to be off the main road and first on
  // the way out of town, which is exactly where this lands.
  //
  // Its whole field is out driving the spine (see PATROL) — the only moving
  // things on the base — which leaves every COMPETITOR's own lot standing
  // empty, and that is the right answer rather than a gap: a motor pool with
  // its yard bare is a motor pool whose fleet is working. What stands on the
  // district's ground instead is shared, nobody's-competitor infrastructure
  // (see `RoverDepotYard` in ProjectModel.tsx), which MarkerLayer places at the
  // head of this branch. Sized for the yard and the station rather than for the
  // roster: at 2.3 m an LTV needs almost nothing, but nothing in the roster
  // ever stands here.
  rover: district(-120, {
    turn: -6,
    branch: { bearingDeg: 270, lengthM: 55, width: 0.72 },
    // Sized for the depot yard and the recharge station standing either side of
    // this branch's head, not for the roster: the yard's 9 m apron at its own
    // frontage off the road reaches 26.1 m from the district centre, where the
    // biggest thing in the roster is a 2.3 m rover that is never here.
    block: 27,
  }),

  // THE HABITAT RACE, on the longest branch but one: 130 m northwest off the
  // ridge centre, with a spur at 85 m taking the two smaller modules.
  // Artemis Base Camp and China/Russia's ILRS stand against Thales' MPH,
  // Sierra's LIFE and Toyota's Lunar Cruiser.
  //
  // The longest branch of any inhabited district, and that is the point. On the
  // plan this replaces the habitat race stood ON the spine — and before that it
  // had a plaza of its own inside a perimeter road, on a 60.5 m paved
  // hardstand. Both put the crew's front door on the road every hauler,
  // propellant tank and paving machine on the base uses. 130 m up a branch off
  // it is a quiet address, which is what habitation on a linear plan is for,
  // and the spur gives the two buried modules their own frontage instead of a
  // place in a line of five.
  //
  // Its crossing is still at the origin, which keeps the home camera's framing
  // and the buried vaults where they were (see subplan.ts).
  habitat: district(0, {
    turn: 0,
    branch: {
      bearingDeg: 95,
      lengthM: 130,
      spur: { atM: 55, bearingDeg: 30, lengthM: 38, takes: 2, width: 0.55 },
    },
    block: 39,
  }),

  // CONSTRUCTION, 60 m northeast on a 72 m branch southeast, with a spur at
  // 45 m. The ground these machines are all bidding to pave, and near the
  // camera. Turned toward the work.
  //
  // Its branch leaves the spine at only 35 deg — the shallowest divergence on
  // the plan — so it reads as a fork off the main road rather than a crossing
  // of it, which is the right note for the one district whose business is the
  // road surface itself.
  construction: district(60, {
    turn: 22,
    branch: {
      bearingDeg: 5,
      lengthM: 72,
      width: 0.72,
      spur: { atM: 30, bearingDeg: 275, lengthM: 32, takes: 2, width: 0.55 },
    },
    block: 23,
  }),

  // COMMS AND NAVIGATION, 150 m northeast on the longest branch on the plan:
  // 145 m northwest, with a spur at 95 m for two of the four terminals.
  //
  // Ground stations want their horizon clear of the structures that would
  // clutter it, and four terminals looking at the same sky want the same thing,
  // so this race goes further from the settlement than any other — and the
  // ground happens to agree, because this is the flattest branch on the base
  // (0.5 m of relief over 145 m, worst grade 2.1%).
  //
  // Note there is deliberately no `orbital` district. buildTechTrees treats
  // orbital as a non-surface type, so Gateway can never occupy ground here — a
  // lot for it would be a branch to a dead end that stays bare regolith at
  // every year on the scrubber.
  comms_pnt: district(150, {
    turn: -12,
    branch: {
      bearingDeg: 120,
      lengthM: 145,
      width: 0.72,
      spur: { atM: 95, bearingDeg: 60, lengthM: 40, takes: 2, width: 0.55 },
    },
    block: 17,
  }),

  // POWER, 245 m northeast on a 95 m branch southeast — the opposite side of
  // the spine from the habitat, which is most of the point. Fission plants go
  // where the crew isn't, and putting the reactors across the street and 300 m
  // up it from the habitat's own branch end is the whole standoff argument
  // stated as geometry.
  power: district(245, {
    turn: 6,
    branch: { bearingDeg: 350, lengthM: 95 },
    block: 23,
  }),

  // LUNAR MASS DRIVER, 345 m northeast, at the head of the spine, on a 70 m
  // branch northwest.
  //
  // What stands on this lot is the launcher's BREACH WORKS — capacitor hall,
  // power feed, solar field — and that is all this entry describes. The guideway
  // itself runs 600 m out of the lot on its own heading, is not packed as a
  // disc, and is checked as a corridor; see lib/lunar-atlas/trackplan.
  //
  // Its heading and the spine's are the same line, which is not a coincidence:
  // both are answers to the same question about the same ground, the guideway
  // needing level because fall is leg height and the spine needing it because a
  // 730 m road cannot dodge. Standing the breach works 70 m off the spine puts
  // the guideway on a line PARALLEL to the street and offset from it, so the
  // launcher reads as the street continuing out of town while firing over none
  // of it.
  mass_driver: district(345, {
    turn: 0,
    branch: { bearingDeg: 100, lengthM: 70, width: 0.72 },
    block: 24,
  }),
}

// ---------------------------------------------------------------------------
// The streets
// ---------------------------------------------------------------------------

// Where a road sits in the hierarchy. Higher CARRIES a crossing: the spine's
// surface runs through unbroken and a branch stops at its lane edge, a branch's
// runs through and a spur stops at its.
//
// A rank rather than the single boolean this replaces, because the plan now has
// three tiers and not two. A boolean could say "the spine wins" and had nothing
// to say about a spur meeting its own branch — that fell through to the
// width tie-break and then to whichever road the plan happened to list first,
// which is a correct answer only until somebody reorders BASE_STREETS. See
// throughRoad in junctions.ts.
export const RANK_SPINE = 2
export const RANK_BRANCH = 1
export const RANK_SPUR = 0

// Roads, as polylines of [east, north] waypoints in meters. Curves are splined
// through these, so a handful of waypoints describes a road that bends the way
// a graded one does — though on this plan nothing bends: every road is straight
// and two waypoints describe it exactly.
export type Street = {
  points: [number, number][]
  closed?: boolean
  // Lane width as a fraction of a full haul road. The routes that carry cargo
  // and propellant run full width; a track that only ever takes a crew rover
  // out to one machine is narrower, and a spur to two small modules is narrower
  // still. That difference is most of what stops eleven roads reading as one
  // road drawn eleven times.
  width?: number
  // The sites this road exists to reach. It stands as long as any of them do,
  // so a road never runs out to a plot that is still bare regolith at the year
  // on the scrubber — the comms terminals, for one, aren't in service until the
  // back half of the decade. The spine has no `serves`: it is the settlement's
  // own frame and arrives with it.
  serves?: ProjectType[]
  // Which tier this road belongs to. See RANK_SPINE above.
  rank?: number
}

// THE SPINE. Two waypoints, because it is a straight line and a spline through
// two points is one.
function spineStreet(): Street {
  const a = at(SPINE_START_M)
  const b = at(SPINE_END_M)
  return {
    rank: RANK_SPINE,
    points: [[a.east, a.north], [b.east, b.north]],
  }
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
    width: road.rank === RANK_SPUR ? branch.spur!.width : branch.width,
    points: [
      [road.from.east, road.from.north],
      [road.from.east + de * end, road.from.north + dn * end],
    ],
  }
}

// Which districts own roads, southwest to northeast, which is the order
// BASE_PLAN declares them in.
const BRANCHED = (Object.keys(BASE_PLAN) as ProjectType[]).filter(
  (k) => !!BASE_PLAN[k]!.branch
)

// Every road on the base, derived from the districts rather than listed, so a
// district that moves, lengthens its branch, or gains or loses a spur cannot
// leave a road behind or a road stranded.
//
// Ordered by TIER rather than by district — the spine, then all seven branches,
// then the three spurs — so that a consumer walking BASE_STREETS in order draws
// the network from the top down. BaseRoads relies on nothing about the order and
// junctions.ts explicitly refuses to (see throughRoad), but the road runs the
// filler walks come out of it, and lighting the spine before the driveways is
// the right default for anything that stops early.
export const BASE_STREETS: Street[] = [
  // THE SPINE, southwest to northeast: the one road that makes this a
  // settlement rather than eight installations. Every branch starts on it, the
  // pads flank it and the rovers drive it. Arrives with the settlement, so it
  // has no `serves`.
  spineStreet(),

  // One branch per district that has one — every race except the landing zone,
  // whose pads flank the spine itself.
  ...BRANCHED.map((k) => districtStreet(k, districtRoads(BASE_PLAN[k]!)[0])),

  // And a spur for each of the three whose roster is big enough to want a
  // second frontage.
  ...BRANCHED.filter((k) => !!BASE_PLAN[k]!.branch!.spur).map((k) =>
    districtStreet(k, districtRoads(BASE_PLAN[k]!)[1])
  ),
]

// ---------------------------------------------------------------------------
// The ground the districts keep
// ---------------------------------------------------------------------------

// A stretch of ground a district occupies, as a capsule: everything within
// `halfM` of the segment from `a` to `b`.
//
// A capsule and not a box because a terminus district IS a corridor — its
// buildings line its own branch and cluster at the end of it — so the shape
// that describes it is the road it fronts, fattened. The plan this replaces
// could use a box in spine coordinates because every district straddled the
// spine; now that they stand off it on seven different bearings, a box in
// anyone's frame is either wrong or enormous.
export type Zone = { a: [number, number]; b: [number, number]; halfM: number }

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

// The ground one district keeps, as capsules along the roads it fronts.
//
// Deliberately conservative rather than exact: it does not know how many
// competitors a race currently has, only the widest plausible reach its own
// `block` allows for, and it applies that reach sideways as well as ahead. So
// anything checked against it can never spawn on top of a competitor's plot no
// matter how a roster changes.
export function districtGround(plan: SitePlan): Zone[] {
  const halfM = plan.block ?? 20
  const roads = districtRoads(plan)

  if (!roads.length) {
    // A flank district straddles the spine, so its ground is a stretch OF the
    // spine — short, because its plots sit beside the road rather than along it.
    const a = at(plan.alongM - halfM * 0.5)
    const b = at(plan.alongM + halfM * 0.5)
    return [{ a: [a.east, a.north], b: [b.east, b.north], halfM }]
  }

  // Each of the district's roads, fattened by `halfM` sideways and run on past
  // its own dead end by the same, which is what covers whatever stands at the
  // head of it.
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
  for (const z of DISTRICT_ZONES) {
    if (segDistM(east, north, z.a, z.b) <= z.halfM + marginM) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// The solar farm
// ---------------------------------------------------------------------------

// Base-wide generation, and the one large installation here that belongs to no
// race: nobody is competing to build the colony's own switchyard, so this is
// shared infrastructure in the same sense as the rover depot, just far bigger.
//
// It exists for two reasons that happen to agree. A settlement with a mass
// driver, an ISRU plant and a construction yard needs power on the order of
// hundreds of kilowatts, and the reactors in the power district are only part
// of that answer — a real base pairs fission with photovoltaics, because at the
// pole PV is nearly continuous and fission is what covers the rest. And a farm
// is the one kind of built ground that is SUPPOSED to be mostly empty, which
// makes it the honest way to fill the wedges between districts that otherwise
// read as nothing at all.
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
  // survey a field to something on the ground instead; see field 1.
  bearingDeg?: number
}

// The farm is TWO fields rather than one, on opposite sides of the spine.
//
// Split for the reason any real installation splits its generation: a single
// field is a single point of failure, and losing all of it to one impact, one
// bad dust event or one blown switchyard is the outcome the whole plant exists
// to avoid. Distributing it is also how a base actually grows — you build the
// field you need, and when you need more you build another one where there is
// room, rather than going back and widening the first. Putting the two on
// OPPOSITE flanks is the strongest version of that: no one event reaches both.
//
// It also happens to be what the plan needs. Standing every district at the end
// of its branch left large clear wedges on both flanks reading as nothing at
// all, and one field could only ever fill one of them.
//
// WHY THESE TWO WEDGES AND NOT THE OTHERS
//
// The plan's open ground was mapped rather than eyeballed, and these are the
// pockets that answer every constraint at once:
//
//   - They are the largest clear wedges that reach in toward the spine, so each
//     field is served off the main street and needs no road of its own. Most
//     other pockets this size sit 40 m or more from the nearest pavement, and a
//     field with no access is the one installation this plan could not explain.
//   - Both are hundreds of meters from the landing pads. Ejecta off an airless
//     body leaves at orbital speed and does not come back down, so a field of
//     glass is close to the worst thing to put near a pad — which is also the
//     reason the large empty ground BESIDE the landing zone has to stay empty,
//     and is not a candidate however dead it reads.
//   - The larger field adjoins the power district's own crossing, so the base's
//     two kinds of generation read as one complex rather than as panels dropped
//     in a gap.
const SOLAR_FIELDS: SolarField[] = [
  // The main field, in the wedge between the construction and power crossings,
  // on the southeast flank — the side the ridge falls away on, which is the
  // side with the fewest districts on it and so the side with ground to spare.
  // Surveyed to the sun, since nothing on the ground here has a claim on it.
  { alongM: 200, acrossM: -62, rows: 4, bays: 7 },
  // The second, in the northwest pocket short of the habitat crossing, and the
  // larger of the two.
  //
  // Larger because of what it is next to. This is the settled end of the base —
  // the habitats are the one district with a continuous, non-negotiable load,
  // and life support is the load you least want at the far end of a run from
  // the other flank. Generation built near the demand is how any real plant is
  // sited, and it also means the two fields are not redundant copies: field 0
  // backs the industrial end, this one backs the people.
  //
  // Surveyed to the HABITAT ROAD rather than to the sun, so its rows run
  // PARALLEL to that road — hence the stacking bearing is the road's own 95 deg
  // turned by a quarter turn.
  //
  // It shares a frame with that road from most of the spine, and a lattice
  // sitting at its own private angle next to the one strong line near it would
  // read as debris rather than as plant. Aligning it is the whole difference.
  //
  // WHY 5 x 7 AND NOT LARGER
  //
  // Because it is a FULL RECTANGLE, and a lattice with its corners bitten off
  // reads as broken rather than as built out. That is the binding constraint
  // here, not the ground: this pocket is hemmed by the isru_plant's ground to
  // the southwest, the rover's to the south and the spine's own setback, and a
  // lattice much bigger than this loses stations to one of the three whichever
  // way it is nudged. Wider rectangles do exist further out on the flank, but
  // only by walking the field a long way north of where it belongs, which puts
  // it behind the habitats instead of beside them.
  //
  // So the size is the answer rather than the input: 5 x 7 is the largest
  // complete rectangle that fits without moving north. If this needs to grow,
  // the thing to move is the isru_plant, not the field.
  //
  // It is also as far EAST, toward the habitat road, as it can get: the field
  // stands about 50 m off that road and every complete rectangle that fits
  // anywhere in this pocket stands about 50 m off it too, whatever its size,
  // because what caps the distance is the habitat district's own ground rather
  // than the lattice. Shrinking the field to buy the last few meters was tried
  // and buys nothing — a 4 x 6 gets 11 m closer to the spine and no closer to
  // the road. Anyone tempted to nudge it east again should move the habitats.
  //
  // It costs the field nothing measurable: the rows are pitched for a 20 deg
  // sun (above), and even projected onto the sun's bearing from this angle that
  // pitch still clears every row's shadow — which is checked over every PAIR of
  // arrays in the spec rather than argued from the pitch, precisely because a
  // lattice off the sun's axis is the case where pitch alone stops being proof.
  //
  // Note this is the field's SURVEY only. Each array on it still turns onto the
  // sun individually, exactly as the arrays on field 0 do — the lattice angle
  // and the panel aim are separate decisions, and conflating them is what would
  // actually cost output.
  {
    alongM: -55,
    acrossM: 55,
    rows: 5,
    bays: 7,
    bearingDeg: BASE_PLAN.habitat!.branch!.bearingDeg + 90,
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
// Per row because a field is a lattice at an angle to everything else on the
// plan, and a box in any frame either misses a corner of it or swallows the
// clear ground either side. The rows are what is actually built, so the rows
// are what is reserved — and a row that lost bays to the checks above reserves
// only as far as its own last standing array.
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
// built on — any district's own ground, or the solar farm's.
//
// Used to keep base-wide filler (a boulder field, roadside lighting) off it
// without that filler needing to know the roster, or that the farm exists.
export function withinDistrictGround(
  east: number,
  north: number,
  marginM: number
): boolean {
  if (onRaceGround(east, north, marginM)) return true
  for (const z of SOLAR_FARM_ZONES) {
    if (segDistM(east, north, z.a, z.b) <= z.halfM + marginM) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Walking the roads
// ---------------------------------------------------------------------------

// Every road as a straight run that can be WALKED: a length in meters, and a
// map position at any distance along it and any offset to its left.
//
// This exists because the base-wide filler — street lighting, roadside cargo,
// the maintenance fleet — needs to place things at a spacing measured along the
// pavement, and it should not have to know that a road is a spine, a branch or
// a spur to do it. On the concentric plan the same code walked DEGREES around
// two circles and converted to arc length per radius, which is why a station on
// the ring and a station on main street covered different ground for the same
// step; here a meter is a meter on every road.
export type RoadRun = {
  bearingDeg: number
  lengthM: number
  // `d` meters from the run's start, `offM` meters to its left.
  at: (d: number, offM: number) => { east: number; north: number }
  // Lane width as a fraction of a full haul road, mirroring Street.width — so
  // the filler can put street lighting on the routes that carry cargo and leave
  // a rover track dark.
  width: number
  // Tier, mirroring Street.rank, so filler can tell a haul road from a spur
  // without inferring it from width.
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
    rank: street.rank ?? RANK_BRANCH,
    bearingDeg: (Math.atan2(dn, de) * 180) / Math.PI,
    at: (d, offM) => ({
      east: ax + de * d - dn * offM,
      north: ay + dn * d + de * offM,
    }),
  }
})

// Distance in meters from a map-frame point to the nearest road centreline.
//
// Exact rather than approximate, which it could not have been on the concentric
// plan: main street was a spline through 24 waypoints that bulged inside the
// true circle between them, so a check against the waypoints was not a check
// against the road. Every road here is straight and described by its two
// endpoints, so the segment distance below IS the distance to the road.
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
// the run, so the spine carries movement wherever you look rather than one
// vehicle doing laps for an audience.
//
// NASA specifies the LTV around 15 km/h, and a little under half of that is
// what reads as purposeful at this scale: fast enough to be plainly driving,
// slow enough that it never looks sped up. One speed for the whole field, which
// is what guarantees the field never closes up on itself — see the run in
// MarkerLayer.
//
// A SHUTTLE, not a lap, and that is forced. The concentric plan could drive its
// fleet round main street as a rigid rotation about the patch centre, which is
// only a road if the road is a circle. There is no circle now, so the fleet
// runs the length of the spine and turns around, which is also what a motor
// pool on a linear base would actually do: everything anyone needs a rover for
// is somewhere on this street or on a branch off it.
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
// the spine, so a race added to the dataset lands on open regolith beyond the
// built plan instead of inside somebody's district. Fanned out ACROSS the
// spine from there, which the concentric plan could only do by adding another
// wedge to a ring that was already full.
export const FALLBACK_ALONG_M = SPINE_END_M + 70
export const FALLBACK_SPREAD_M = 60
