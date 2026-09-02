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
// THE STREET PLAN IS A SPINE. One straight road runs the length of the ridge
// crest and every district crosses it on its own straight branch, taking the
// four CORNER LOTS around that crossing. There is no core and no plaza: the
// habitat race stands on a block of the same street as everyone else.
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
// grows without redrawing: a new race is a new crossing further along, where on
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
// The 4x spread between best and worst also decides that BRANCHES MUST BE
// SHORT: perpendicular to the spine is very nearly the fall line, so a branch
// pays close to the 130 deg rate. At the +/-30 to +/-55 m a crossing actually
// needs that is 1 to 9 m of relief, worst 15% on the habitat's (the longest);
// at the 300 m a landing zone wants it would be tens of meters, which is why
// the pads flank the spine itself instead of standing at the end of a spur.
//
// The spine is also ~79 deg off the home camera's view axis (HOME_CAM looks
// from east 171, north -211 at east 20, north 10), so it lies ACROSS the frame
// and reads as a long street rather than receding to a point.
//
// Nothing here is hand-authored twice: the districts declare where they are and
// how much ground they need, and both the plot packing (districtSlots) and the
// road network (BASE_STREETS) are derived from that. A race that gains a
// competitor gets a corner lot; it never needs a road drawn for it.
//
// This lives in lib because three unrelated parts of the scene need the same
// plan: the page places the sites from it, the model layer takes each site's
// heading from it, and the roads are laid out against it.

import type { ProjectType } from './types'

// Compass bearing of the spine, degrees CCW from east. See the table above.
export const SPINE_BEARING_DEG = 40

// Road cross-section, in meters. HALF is the centreline to the outside of the
// windrow (see PROFILE in BaseRoads, which must agree); SETBACK is the clear
// regolith a plot keeps between its own edge and that windrow. Together they
// are the only numbers that decide where a building stands relative to the
// street it fronts, which is why frontage across the whole base is uniform.
export const ROAD_HALF_M = 6.3
export const SETBACK_M = 1.8

// Meters of clear regolith between neighbouring plots on the same side of a
// street, and between the districts themselves — so one number sets how tightly
// the whole colony is packed. Plots facing each other across a street are held
// apart by the road instead (see ROAD_HALF_M).
export const DISTRICT_GAP_M = 6

// How a district's competitors stand relative to the streets around them.
export type Frontage =
  // The four corner lots of the branch × spine crossing, filled diagonally.
  // The default, and what makes a district read as a city block.
  | 'crossroads'
  // Flanking the spine itself, one plot each side, with no branch of its own.
  // For the landing zone, whose pads are both far too big to sit on a corner
  // and far too far out to reach down a spur — see BASE_PLAN.lander.
  | 'flank'
  // No road through the lot at all, assets standing in a line along one shared
  // axis. For a district whose competitors read as a procession rather than a
  // block — nothing currently uses this, but it stays available as a frontage a
  // future single-file district can ask for.
  | 'lot'

export type SitePlan = {
  // Meters east and north of the ridge center — the CENTER of the district,
  // which for a crossroads district is the middle of its crossing and so a
  // point no asset stands on. Individual plots are placed by districtSlots.
  //
  // Written by `at()` from a position ALONG the spine rather than by hand, so a
  // district is exactly on the road it fronts.
  east: number
  north: number
  // Degrees this installation is turned off the base's common heading.
  //
  // Every site shares ONE bearing by default (see facingYaw in ProjectModel).
  // That shared axis is the whole trick: sites spread over 700 m that each aim
  // independently at a viewpoint 130 m away splay by tens of degrees, and that
  // splay is what made the settlement read as unrelated hardware dropped on a
  // plain. Holding one axis makes it read as surveyed. These are the
  // deliberate departures from it — enough to keep the plan from looking like
  // a chorus line, never enough to turn an asset's back on the viewer.
  turn: number
  front?: Frontage
  // Meters the district's BRANCH runs either side of the spine: how far ACROSS
  // the spine its outermost lot reaches. The branch is drawn to run that far
  // plus a turning circle, so this is what stops a road ending in the middle of
  // a district. Symmetric because a crossing is — the corner lots sit at the
  // same offset on both sides.
  reach?: number
  // Meters of ground the district occupies in ANY direction from its centre —
  // its keep-out, used to hold base-wide filler off it.
  //
  // A separate number from `reach` because a block is not square. `reach` is
  // measured ACROSS the spine, where a district is bounded by the length of the
  // branch it can afford to grade; ALONG the spine it is bounded by nothing,
  // because the spine runs past it in both directions whatever its roster does.
  // So a race with more than four competitors spreads along the street (see
  // districtSlots' crossroads case) and gets much wider than it is deep:
  // construction's five paving bids reach 21 m across and 43 m along.
  //
  // Both are asserted against the real rosters in the tests rather than
  // trusted, since both are hand-set and the rosters are not.
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

// ---------------------------------------------------------------------------
// The spine's frame
// ---------------------------------------------------------------------------

// Unit vector along the spine, pointing northeast, in the map frame.
export function spineDir(): [number, number] {
  const a = (SPINE_BEARING_DEG * Math.PI) / 180
  return [Math.cos(a), Math.sin(a)]
}

// Unit vector across the spine, 90 deg left of outbound.
export function spineNormal(): [number, number] {
  const [e, n] = spineDir()
  return [-n, e]
}

// Map-frame position of a point given in the spine's own frame: `along` meters
// northeast of the ridge centre, `across` meters to the left of that.
//
// Every district position on the plan goes through here rather than being
// written as a coordinate pair, for the same reason the concentric plan wrote
// bearings instead of coordinates: a hand-rounded pair sits centimeters off the
// road, and every plot's setback is then measured from a crossing that is not
// quite on the street it fronts.
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
// districts at each end — the landing zone to the southwest, the mass driver's
// breach works to the northeast — to run clear of both, and asserted against
// them rather than eyeballed.
export const SPINE_START_M = -330
export const SPINE_END_M = 400

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

// The four corner lots of a crossing, in fill order: northeast-left, then the
// diagonally opposite southwest-right, then the remaining two. Filling
// diagonally matters for the small fields — a race with two competitors gets
// one lot on each side of BOTH streets, which reads as a crossing, where taking
// two adjacent corners would read as one lot cut in half.
const CORNERS: [number, number][] = [
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
]

// Place a race's competitors on the streets of their district, largest first.
//
// Positions come back absolute. Everything below works in the SPINE's frame —
// `along` runs northeast up the spine, `across` runs to its left — which is the
// same frame for every district on the base. That is the simplification the
// linear plan buys: on the concentric plan each district had its own rotated
// frame and the corner lots had to be solved in POLAR terms, because the two
// streets a district fronted were a circle and a radial and only polar offsets
// were exactly the setback from both. A spine and a perpendicular branch are
// two straight lines, so a flat offset is exact from both and the arc-versus-
// tangent correction that used to eat the whole setback is simply gone.
export function districtSlots(plan: SitePlan, plots: Plot[]): Map<string, Slot> {
  const out = new Map<string, Slot>()
  if (!plots.length) return out
  const order = [...plots].sort(
    (a, b) => b.radiusM - a.radiusM || a.id.localeCompare(b.id)
  )

  const [alongE, alongN] = spineDir()
  const [acrossE, acrossN] = spineNormal()

  const place = (plot: Plot, along: number, across: number) => {
    const turn =
      plan.turn + (hash01(`${plot.id}:turn`) - 0.5) * 2 * PLOT_TURN_JITTER_DEG
    out.set(plot.id, {
      east: plan.east + alongE * along + acrossE * across,
      north: plan.north + alongN * along + acrossN * across,
      turn,
      offsetM: Math.hypot(along, across),
    })
  }

  switch (plan.front ?? 'crossroads') {
    case 'lot': {
      // No street through the lot, so the assets simply stand along an axis,
      // offset so the district center falls at the middle of their combined
      // FRONTAGE rather than between their centres — which, for a 38 m base
      // camp beside a 12 m stack, are not the same point.
      const axis =
        ((plan.lotAxis ?? SPINE_BEARING_DEG) - SPINE_BEARING_DEG) *
        (Math.PI / 180)
      let cursor = 0
      const span = order.reduce(
        (sum, p, i) => sum + p.radiusM * 2 + (i ? DISTRICT_GAP_M : 0),
        0
      )
      for (const plot of order) {
        const seat = cursor + plot.radiusM - span / 2
        place(plot, Math.cos(axis) * seat, Math.sin(axis) * seat)
        cursor += plot.radiusM * 2 + DISTRICT_GAP_M
      }
      return out
    }

    case 'flank': {
      // The spine itself with a plot either side. Plots opposite each other are
      // held apart by the road's full width plus both setbacks, so they never
      // need spacing along it; a third and a fourth would, which is the step.
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
        place(plot, along, (i % 2 ? -side : side) * frontageM(plot.radiusM))
      })
      return out
    }

    default: {
      // Corner lots of the crossing. `across` is the plot's setback off the
      // SPINE, `along` its setback off its own BRANCH, and because both streets
      // are straight both are exact.
      //
      // Beyond four competitors the block continues ALONG THE SPINE, each extra
      // lot taking the next frontage past the corner on its own side, rather
      // than marching further out along the branch. Out along the branch is
      // where a fifth lot wants to go on paper and it is the one direction that
      // does not work: the branch is only built to `reach` either side of the
      // spine, so a second row lands beyond the end of the only road serving
      // it. The spine, by contrast, runs past this district in both directions
      // whatever the roster does — and it is the flat direction besides, which
      // out along the branch is not.
      //
      // Two lots further along the spine on the same side are the one pair in
      // the plan with no road between them: the corners face each other across
      // a street and are held apart by frontage, but these only have open
      // ground. So each keeps the clear strip it would have had against a
      // street, and the district's gap of untouched regolith separates the two.
      //
      // Which corner an extra lot continues past is whichever is currently
      // SHORTEST along the street, not its own corner in sequence. That matters
      // because the corners are filled largest first: continuing past a lot's
      // own corner puts the fifth competitor behind the first and therefore
      // behind the biggest, and the habitat race's 3.3 m Lunar Cruiser landed
      // 62 m up the street from its crossing — past Artemis Base Camp's 19 m
      // plot and the clear ground either side of it — to stand on a lot 3.3 m
      // wide. Filling the shortest corner instead puts it at 50 m, and shortens
      // the whole district's frontage by the same 12 m.
      const laneClearM = DISTRICT_GAP_M + 2 * SETBACK_M
      // Signed outer edge of each corner's run, indexed like CORNERS.
      const edge: number[] = [0, 0, 0, 0]
      order.forEach((plot, i) => {
        const front = frontageM(plot.radiusM)
        let corner = i
        let along: number
        if (i < 4) {
          along = CORNERS[i][0] * front
        } else {
          corner = 0
          for (let c = 1; c < 4; c++) {
            if (edge[c] < edge[corner]) corner = c
          }
          along =
            CORNERS[corner][0] * (edge[corner] + laneClearM + plot.radiusM)
        }
        edge[corner] = Math.abs(along) + plot.radiusM
        place(plot, along, CORNERS[corner][1] * front)
      })
      return out
    }
  }
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

// How far along the spine a district sits — which is also where its branch
// crosses, and the only coordinate that distinguishes one district from
// another on this plan.
export function districtAlongM(plan: SitePlan): number {
  return spineCoords(plan).alongM
}

// ---------------------------------------------------------------------------
// Where the districts stand
// ---------------------------------------------------------------------------

// Eight crossings down one street, declared southwest to northeast, which is
// also the order SOM's bands run in: transport and energy at the ends,
// habitation in the middle, the infrastructure that serves it either side.
//
// Which race gets which crossing is function first and composition second.
// Landing goes at one end and the launcher at the other because both throw
// things and neither should throw them over the base. Power sits beside the
// launcher because a reluctance launcher's capacitor hall is the largest
// electrical load on the plan, and it lands 265 m from the habitat, which is
// the ejecta-and-radiation logic the concentric plan could not express at all
// with everything pinned to one 96 m ring. ISRU sits between the habitat and
// the pads because the entire argument for making oxygen on the Moon is pumping
// it into a lander. Rover and construction take the crossings nearest the
// camera so the foreground carries something at human scale and the one moving
// thing on the base starts close to the eye.
// Spacing along the street is not a matter of taste either: each district is
// placed far enough from its neighbours that their real packed blocks clear
// each other by DISTRICT_GAP_M with room over, which is why the gaps are
// uneven. Construction's five paving bids spread 43 m along the spine and the
// habitat race's five spread 50, so those two need 100 m of street between
// their centres where comms and power need 70.
const CROSSING = (alongM: number) => at(alongM)

export const BASE_PLAN: Partial<Record<ProjectType, SitePlan>> = {
  // LANDING ZONE, 280 m southwest, at the far end of the spine. The pads FLANK
  // the road rather than taking corner lots: at 62 m across, the Starship's
  // apron is most of a city block on its own, and the haul road runs BETWEEN
  // the two pads the way the pad avenue used to.
  //
  // On the spine itself and not down a spur, which is the one place this plan
  // is dictated by the ground rather than by zoning. A 300 m spur would run the
  // fall line off the crest: 23 m of drop and a 21% grade (see the bearing
  // table at the top). Along the spine the same 280 m costs 6.4 m and 7.5%.
  // With no air to slow it, plume-thrown regolith travels ballistic arcs that
  // stay dangerous for hundreds of meters, so this is still a compromise
  // against keeping the vehicle in the home-view frame rather than the
  // kilometer-plus a real site would want — but it is now the longest single
  // sightline on the base, which is what an ejecta standoff should look like.
  lander: {
    ...CROSSING(-280),
    turn: 0,
    front: 'flank',
    flankSide: 1,
    // The Starship pad's own 31.2 m footprint plus its frontage off the spine,
    // which is why this is more than twice any other district's: the apron is
    // 62 m across and it stands beside the road rather than at a crossing.
    reach: 71,
    block: 71,
  },

  // ISRU YARD, 165 m southwest: one crossing up the street from the pads, so
  // the propellant run is 115 m of flat spine and never enters the settlement.
  isru_plant: { ...CROSSING(-205), turn: 0, reach: 28, block: 28 },

  // ROVER DEPOT, 85 m southwest. Its whole field is out driving the spine (see
  // PATROL) — the only moving things on the base, shuttling the length of the
  // street rather than circling a core that no longer exists.
  //
  // Which leaves every COMPETITOR's own corner lot standing empty, and that is
  // the right answer rather than a gap: a motor pool with its yard bare is a
  // motor pool whose fleet is working. What stands on the district's own ground
  // instead is shared, nobody's-competitor infrastructure (see `RoverDepotYard`
  // in ProjectModel.tsx), which MarkerLayer places on a corner of this
  // crossing.
  // Sized for the yard and the station rather than for the roster: at 2.3 m
  // an LTV needs a 13 m branch, but nothing in the roster ever stands here.
  rover: { ...CROSSING(-135), turn: 0, reach: 27, block: 27 },

  // THE HABITAT RACE, at the ridge centre. Artemis Base Camp and China/Russia's
  // ILRS stand against Thales' MPH, Sierra's LIFE and Toyota's Lunar Cruiser.
  //
  // A block on the street like every other race, which it did not used to be:
  // it had a plaza of its own inside a perimeter road, on a 60.5 m paved
  // hardstand, packed as a ring of five with no road through it. That was the
  // last of the radial plan's centre and it went with the rest of it. A base is
  // not a different KIND of thing from a habitat module — just more of them
  // integrated together — so it does not get a different kind of ground, and
  // the race now fronts two streets and packs to 38 m rather than 58.7.
  //
  // Still at the origin, which keeps the home camera's framing and the buried
  // vaults where they were (see subplan.ts).
  habitat: { ...CROSSING(0), turn: 0, reach: 47, block: 51 },

  // CONSTRUCTION, 90 m northeast: the ground these machines are all bidding to
  // pave, and near the camera. Turned toward the work.
  construction: { ...CROSSING(110), turn: 22, reach: 21, block: 43 },

  // COMMS AND NAVIGATION, 175 m northeast. Ground stations want their horizon
  // clear of the structures that would clutter it, and four terminals looking at
  // the same sky want the same thing, so they take the crossing on the flattest
  // and most open stretch of the whole spine (0.3 m of relief across it).
  //
  // Note there is deliberately no `orbital` district. buildTechTrees treats
  // orbital as a non-surface type, so Gateway can never occupy ground here — a
  // lot for it would be a branch to four corners that stay bare regolith at
  // every year on the scrubber.
  comms_pnt: { ...CROSSING(190), turn: -12, reach: 24, block: 24 },

  // POWER, 265 m northeast. Fission plants go where the crew isn't, and this is
  // the far end of the street next to the launcher that draws from them.
  power: { ...CROSSING(260), turn: 6, reach: 31, block: 31 },

  // LUNAR MASS DRIVER, 360 m northeast, at the head of the spine.
  //
  // What stands on this lot is the launcher's BREACH WORKS — capacitor hall,
  // power feed, solar field — and that is all this entry describes. The guideway
  // itself runs 600 m out of the lot on its own heading, is not packed as a
  // disc, and is checked as a corridor; see lib/lunar-atlas/trackplan.
  //
  // Its heading (40 deg) and the spine's (45) are all but the same line, which
  // is not a coincidence: both are answers to the same question about the same
  // ground, the guideway needing level because fall is leg height and the spine
  // needing it because a 730 m road cannot dodge. So the launcher now reads as
  // the street continuing out of town, and it fires away from every lot on the
  // plan instead of across the middle of the old ring.
  mass_driver: { ...CROSSING(345), turn: 0, reach: 37, block: 37 },
}

// Every district's position along the spine and the ground it keeps, read
// straight from BASE_PLAN rather than duplicated, so a district that moves or
// grows can never leave this stale.
const DISTRICT_ZONES = Object.values(BASE_PLAN)
  .filter((p): p is SitePlan => !!p)
  .map((p) => ({
    alongM: districtAlongM(p),
    block: p.block ?? p.reach ?? 20,
  }))

// How far past a district's outer lots its branch runs before it stops. Enough
// for the turning circle a hauler needs at the end of a road, and no more: a
// branch that overshoots its last lot is the one thing on this plan that would
// read as a road to nowhere.
export const BRANCH_TAIL_M = 7

// True if a map-frame point can plausibly stand on some district's OWN ground.
//
// Deliberately conservative rather than exact: it does not know how many
// competitors a race currently has, only the widest plausible block its own
// `block` allows for, and it treats that block as square when only construction
// and the habitat race are anywhere near that wide. So anything checked against
// it can never spawn on top of a competitor's plot no matter how a roster
// changes. Used to keep base-wide filler (a boulder field, roadside lighting)
// off every district's ground without that filler needing to know the roster.
export function withinDistrictGround(
  east: number,
  north: number,
  marginM: number
): boolean {
  const { alongM, acrossM } = spineCoords({ east, north })
  for (const z of DISTRICT_ZONES) {
    const half = z.block + BRANCH_TAIL_M + marginM
    if (Math.abs(alongM - z.alongM) <= half && Math.abs(acrossM) <= half) {
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// The streets
// ---------------------------------------------------------------------------

// Roads, as polylines of [east, north] waypoints in meters. Curves are splined
// through these, so a handful of waypoints describes a road that bends the way
// a graded one does — though on this plan nothing bends: every road is straight
// and two waypoints describe it exactly.
export type Street = {
  points: [number, number][]
  closed?: boolean
  // Lane width as a fraction of a full haul road. The routes that carry cargo
  // and propellant run full width; a track that only ever takes a crew rover
  // out to one machine is narrower, and that difference is most of what stops
  // eight roads reading as one road drawn eight times.
  width?: number
  // The sites this road exists to reach. It stands as long as any of them do,
  // so a road never runs out to a plot that is still bare regolith at the year
  // on the scrubber — the comms terminals, for one, aren't in service until the
  // back half of the decade. The spine has no `serves`: it is the settlement's
  // own frame and arrives with it.
  serves?: ProjectType[]
  // Whether this road's SURFACE runs through a crossing, the road meeting it
  // stopping at its lane edge. Exactly one road on the plan sets it, and it has
  // to be set by hand: three of the branches are full haul width, so "the wider
  // road wins" cannot pick the spine out on its own. See throughRoad in
  // junctions.ts for what goes wrong without it.
  through?: boolean
}

// THE SPINE. Two waypoints, because it is a straight line and a spline through
// two points is one.
function spineStreet(): Street {
  const a = at(SPINE_START_M)
  const b = at(SPINE_END_M)
  return {
    through: true,
    points: [[a.east, a.north], [b.east, b.north]],
  }
}

// A district's BRANCH: the perpendicular that crosses the spine at its
// crossing. Symmetric about the spine, because a crossing is — and short,
// because perpendicular to the spine is the fall line off the crest.
function branch(
  site: ProjectType,
  opts: { width?: number; serves?: ProjectType[] } = {}
): Street {
  const plan = BASE_PLAN[site]!
  const alongM = districtAlongM(plan)
  const half = (plan.reach ?? 20) + BRANCH_TAIL_M
  const a = at(alongM, -half)
  const b = at(alongM, half)
  return {
    serves: opts.serves ?? [site],
    width: opts.width,
    points: [[a.east, a.north], [b.east, b.north]],
  }
}

export const BASE_STREETS: Street[] = [
  // THE SPINE, southwest to northeast: the one road that makes this a
  // settlement rather than eight installations. Every district crosses it,
  // every branch starts on it, the pads flank it and the rovers drive it.
  // Arrives with the settlement, so it has no `serves`.
  spineStreet(),

  // ISRU BRANCH — the plant's own road, for everything that isn't propellant:
  // crews, spares, and the oxygen and metals the base itself uses. Full width,
  // because the propellant that leaves here by the spine is loaded here.
  branch('isru_plant'),

  // HABITAT BRANCH — the crossing the whole habitat race fronts. Full width:
  // this is where crew and their cargo actually arrive.
  branch('habitat'),

  // POWER BRANCH. It carries the base's entire electrical supply, so every
  // meter of standoff between a fission plant and the crew is cable laid along
  // this and then down the spine.
  branch('power'),

  // CONSTRUCTION BRANCH — crew and spares out to the paving machines. Rover
  // width, not haul width: these things eat regolith they scoop where they
  // stand, so nothing heavy is ever driven out to them.
  branch('construction', { width: 0.72 }),

  // COMMS BRANCH — maintenance out to the relay terminals.
  branch('comms_pnt', { width: 0.72 }),

  // DEPOT BRANCH — the rovers' own road. Rover width, for obvious reasons.
  branch('rover', { width: 0.72 }),

  // MASS DRIVER BRANCH — maintenance out to the launcher's breach works, which
  // is the only part of it standing on a lot. Rover width: one concept-study
  // competitor generates no haul traffic yet.
  branch('mass_driver', { width: 0.72 }),
]

// Every road as a straight run that can be WALKED: a length in meters, and a
// map position at any distance along it and any offset to its left.
//
// This exists because the base-wide filler — street lighting, roadside cargo,
// the maintenance fleet — needs to place things at a spacing measured along the
// pavement, and it should not have to know that a road is a spine or a branch
// to do it. On the concentric plan the same code walked DEGREES around two
// circles and converted to arc length per radius, which is why a station on the
// ring and a station on main street covered different ground for the same step;
// here a meter is a meter on every road.
export type RoadRun = {
  bearingDeg: number
  lengthM: number
  // `d` meters from the run's start, `offM` meters to its left.
  at: (d: number, offM: number) => { east: number; north: number }
  // Lane width as a fraction of a full haul road, mirroring Street.width — so
  // the filler can put street lighting on the routes that carry cargo and leave
  // a rover track dark.
  width: number
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
      const [ax, ay] = pts[i]
      const [bx, by] = pts[i + 1]
      const dx = bx - ax
      const dy = by - ay
      const len2 = dx * dx + dy * dy
      const t =
        len2 > 0
          ? Math.max(
              0,
              Math.min(1, ((east - ax) * dx + (north - ay) * dy) / len2)
            )
          : 0
      best = Math.min(best, Math.hypot(east - (ax + dx * t), north - (ay + dy * t)))
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
// is somewhere on this street.
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
