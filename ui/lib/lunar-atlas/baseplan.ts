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
// THE STREET PLAN is radial-concentric, which is what you get whenever a
// settlement grows outward from one landing: a perimeter road round the core,
// MAIN STREET as a concentric loop out at the district radius, and an AVENUE
// running from the perimeter out along each district's bearing. Every district
// sits on the crossroads where its avenue meets main street and takes the four
// CORNER LOTS around that junction, so its competitors front two streets and
// the roads run through the district rather than stopping short of it. Main
// street is what links the districts to each other; the avenues are what link
// them downtown.
//
// The geometry is exact — true circles, true radials, one setback — and that is
// the whole reason it works. An earlier plan tried to make the base look less
// bare by adding roads that wandered between the lots, and it read as tyre
// marks, because a road only reads as surveyed if you can see the survey in it.
// Regular geometry reads as a plan even along the stretches with nothing built
// on them, the same way a city block does.
//
// Nothing here is hand-authored twice: the districts declare where they are and
// how much ground they need, and both the plot packing (districtSlots) and the
// road network (BASE_STREETS) are derived from that. A race that gains a
// competitor gets a corner lot; it never needs a road drawn for it.
//
// The camera looks from the south-east, so the landing zone goes at the BACK:
// the 52 m Starship reads as a backdrop over the small hardware rather than
// blocking it, and main street lies across the foreground.
//
// This lives in lib because three unrelated parts of the scene need the same
// plan: the page places the sites from it, the model layer takes each site's
// heading from it, and the roads are laid out against it.

import type { ProjectType } from './types'

// Radius of the perimeter road's centreline, in meters. The core district packs
// to a 28 m extent, so the road's inner curb clears the camp's apron by about
// 6 m, and the hardstand inside merges under that curb — the core and its ring
// read as one paved area. Every avenue starts here.
export const RING_RADIUS_M = 40

// Radius of MAIN STREET, the concentric loop the districts stand on.
//
// Set by the deepest district rather than by taste: the power district's inner
// corner lots hold 11 m reactors 19 m back down their avenue, so the loop has to
// sit far enough out that those lots still clear the perimeter road's windrow.
// Pulling it in any further would put a reactor on the ring road.
export const MAIN_LOOP_M = 82

// Road cross-section, in meters. HALF is the centreline to the outside of the
// windrow (see PROFILE in BaseRoads, which must agree); SETBACK is the clear
// regolith a plot keeps between its own edge and that windrow. Together they
// are the only numbers that decide where a building stands relative to the
// street it fronts, which is why frontage across the whole base is uniform.
export const ROAD_HALF_M = 6.3
export const SETBACK_M = 1.8

// How a district's competitors stand relative to the streets around them.
export type Frontage =
  // The four corner lots of the avenue × main-street junction, filled
  // diagonally. The default, and what makes a district read as a city block.
  | 'crossroads'
  // Flanking one road, one plot each side. For the landing zone, whose pads are
  // far too big to sit on a junction — the haul road runs between them instead.
  | 'flank'
  // No road through the lot at all. For the core, which stands on a continuous
  // hardstand inside the perimeter road.
  | 'lot'

export type SitePlan = {
  // Meters east and north of the ridge center — the CENTER of the district,
  // which for a crossroads district is the middle of its junction and so a
  // point no asset stands on. Individual plots are placed by districtSlots.
  east: number
  north: number
  // Degrees this installation is turned off the base's common heading.
  //
  // Every site shares ONE bearing by default (see facingYaw in ProjectModel).
  // That shared axis is the whole trick: sites spread over 200 m that each aim
  // independently at a viewpoint 130 m away splay by tens of degrees, and that
  // splay is what made the settlement read as unrelated hardware dropped on a
  // plain. Holding one axis makes it read as surveyed. These are the
  // deliberate departures from it — enough to keep the plan from looking like
  // a chorus line, never enough to turn an asset's back on the viewer.
  turn: number
  front?: Frontage
  // Meters the lot reaches OUTWARD along its avenue, past the junction. The
  // avenue is drawn to run that far plus a turning circle, so this is what stops
  // a road ending in the middle of a district — and, since the avenue comes from
  // the perimeter road, why only the outward side needs a number. Asserted
  // against the real packing in the tests rather than trusted.
  reach?: number
  // For a 'lot' district only: the bearing, degrees CCW from east, that its
  // pair of assets stands along. Worth controlling because the core's two are a
  // 38 m base camp beside a 13 m ILRS cluster, and which of them the eye
  // reaches first is the difference between a group portrait and an eclipse.
  lotAxis?: number
  // For a 'flank' district only: which side of the road the largest plot takes,
  // +1 for left of the outbound direction. The landing zone's Starship is the
  // tallest thing on the base and it wants to stand clear of the frame's centre.
  flankSide?: 1 | -1
}

// Meters of clear regolith between neighbouring plots on the same side of a
// street, and between the districts themselves — so one number sets how tightly
// the whole colony is packed. Plots facing each other across a street are held
// apart by the road instead (see ROAD_HALF_M).
export const DISTRICT_GAP_M = 6

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
// degrees. Small on purpose now that the plan is streets: buildings on a street
// read as aligned to it, and the jitter is only here so four identical relay
// terminals on four corners aren't four copies of one render.
const PLOT_TURN_JITTER_DEG = 7

// Meters from the centreline of a street to the CENTRE of a plot fronting it.
// The plot's own radius is in here, so a big asset stands further back and every
// asset on the base ends up with the same 1.8 m of clear ground at its edge.
function frontageM(radiusM: number): number {
  return ROAD_HALF_M + SETBACK_M + radiusM
}

// The four corner lots of a crossroads, in fill order: outward-left, then the
// diagonally opposite inward-right, then the remaining two. Filling diagonally
// matters for the small fields — a race with two competitors gets one lot on
// each side of BOTH streets, which reads as a junction, where taking two
// adjacent corners would read as one lot cut in half.
const CORNERS: [number, number][] = [
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
]

// Place a race's competitors on the streets of their district, largest first.
//
// Positions come back absolute. Everything below works in the district's own
// frame — `along` runs outward from the core down the avenue, `across` runs to
// its left — and is rotated into the map frame on the way out, which is why a
// district's layout is identical whichever bearing it sits on.
export function districtSlots(plan: SitePlan, plots: Plot[]): Map<string, Slot> {
  const out = new Map<string, Slot>()
  if (!plots.length) return out
  const order = [...plots].sort(
    (a, b) => b.radiusM - a.radiusM || a.id.localeCompare(b.id)
  )

  const bearing = Math.atan2(plan.north, plan.east)
  const alongVec = [Math.cos(bearing), Math.sin(bearing)]
  const acrossVec = [-Math.sin(bearing), Math.cos(bearing)]

  const place = (plot: Plot, along: number, across: number) => {
    const turn =
      plan.turn + (hash01(`${plot.id}:turn`) - 0.5) * 2 * PLOT_TURN_JITTER_DEG
    out.set(plot.id, {
      east: plan.east + alongVec[0] * along + acrossVec[0] * across,
      north: plan.north + alongVec[1] * along + acrossVec[1] * across,
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
      const axis = ((plan.lotAxis ?? 0) * Math.PI) / 180
      let cursor = 0
      const span = order.reduce(
        (sum, p, i) => sum + p.radiusM * 2 + (i ? DISTRICT_GAP_M : 0),
        0
      )
      for (const plot of order) {
        const at = cursor + plot.radiusM - span / 2
        place(plot, Math.cos(axis - bearing) * at, Math.sin(axis - bearing) * at)
        cursor += plot.radiusM * 2 + DISTRICT_GAP_M
      }
      return out
    }

    case 'flank': {
      // One road with a plot either side. Plots opposite each other are held
      // apart by the road's full width plus both setbacks, so they never need
      // spacing along it; a third and a fourth would, which is what the step is.
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
      // Corner lots. Placed in POLAR terms about the base's centre rather than
      // in the district's own flat frame, because the two streets it fronts are
      // a CIRCLE and a RADIAL, and only polar offsets are exactly the setback
      // from both. Offsetting along the tangent instead leaves the inward lots
      // short: main street's arc cuts inside the tangent line by a couple of
      // meters at this radius, which is the whole setback gone.
      //
      // Beyond four competitors the block repeats further out along the avenue —
      // a second row of corners — rather than the lots creeping toward each
      // other.
      const centre = Math.hypot(plan.east, plan.north)
      let step = 0
      for (let i = 4; i < order.length; i++) {
        step = Math.max(
          step,
          frontageM(order[i].radiusM) +
            frontageM(order[i - 4].radiusM) +
            DISTRICT_GAP_M
        )
      }
      order.forEach((plot, i) => {
        const [alongSign, acrossSign] = CORNERS[i % 4]
        const row = Math.floor(i / 4)
        const front = frontageM(plot.radiusM)
        // Radially, `front` off main street's centreline; tangentially, the
        // angle whose perpendicular distance from the avenue is also `front`.
        const radius = centre + alongSign * (front + row * step)
        const swing = acrossSign * Math.asin(Math.min(1, front / radius))
        const a = bearing + swing
        out.set(plot.id, {
          east: Math.cos(a) * radius,
          north: Math.sin(a) * radius,
          turn:
            plan.turn +
            (hash01(`${plot.id}:turn`) - 0.5) * 2 * PLOT_TURN_JITTER_DEG,
          offsetM: Math.hypot(
            Math.cos(a) * radius - plan.east,
            Math.sin(a) * radius - plan.north
          ),
        })
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

// Degrees CCW from east that a district lies on, which is also the bearing of
// its avenue and the junction it takes on the perimeter road.
export function districtBearingDeg(plan: SitePlan): number {
  return (Math.atan2(plan.north, plan.east) * 180) / Math.PI
}

// Where the districts stand.
//
// Six junctions on main street, spaced on a regular 45–60° grid, plus the core
// inside the perimeter road and the landing zone out at the end of the longest
// avenue. The regularity is doing real work: a viewer reads a plan as surveyed
// from its spacing long before they read any individual road, and evenly spaced
// junctions on a true circle is the cheapest way to say a surveyor stood here.
//
// Which race gets which junction is composition and traffic. The camera looks
// from the south-east, so the landing zone takes due north and backs the frame
// with a 52 m Starship; the habitat, comms and rover districts take the near
// south-east arc so the foreground carries something at human scale and the one
// moving vehicle on the base starts close to the eye; the ISRU yard sits next
// door to the landing zone, because the whole argument for making oxygen on the
// Moon is pumping it into a lander, and that tanker run is now one leg of main
// street rather than a trip through town; power goes off west where the crew
// isn't.
//
// Positions are given as a bearing rather than as coordinates so a district is
// EXACTLY on main street. Writing the pair out by hand rounds it a couple of
// centimeters off the loop, and every plot's setback is then measured from a
// junction that isn't quite on the road it fronts.
const at = (bearingDeg: number, radiusM = MAIN_LOOP_M) => {
  const [east, north] = radial(bearingDeg, radiusM)
  return { east, north }
}

export const BASE_PLAN: Partial<Record<ProjectType, SitePlan>> = {
  // THE CORE, at the origin inside the perimeter road: the sustained-presence
  // race, Artemis Base Camp against China/Russia's International Lunar
  // Research Station (ILRS). The one district with no street through it — it
  // stands on a continuous hardstand, which is what a first landing site
  // would actually be.
  crewed_base: { east: 0, north: 0, turn: 0, front: 'lot', lotAxis: 200 },

  // COMMS AND NAVIGATION, due east (0°). Ground stations are sited clear of the
  // structures that would clutter their horizon, and four terminals looking at
  // the same sky want the same thing — so this junction is the outermost corner
  // of the settlement on that side.
  //
  // Note there is deliberately no `orbital` district. buildTechTrees treats
  // orbital as a non-surface type, so Gateway can never occupy ground here — a
  // lot for it would be an avenue to four corners that stay bare regolith at
  // every year on the scrubber.
  comms_pnt: { ...at(0), turn: -12, reach: 22 },

  // CONSTRUCTION, north-east (45°), between the core and the landing zone: the
  // ground these machines are all bidding to pave. Turned toward the work.
  construction: { ...at(45), turn: 22, reach: 20 },

  // LANDING ZONE, due north (90°) at the back of the plan, 130 m out because a
  // Starship-class descent throws ejecta on ballistic arcs with no air to stop
  // them. The two pads FLANK the haul road rather than taking corner lots — at
  // 62 m across, the Starship's apron is most of a city block on its own.
  lander: {
    ...at(90, 130),
    turn: 0,
    front: 'flank',
    flankSide: 1,
    reach: 32,
  },

  // ISRU YARD, north-west (135°), one junction round main street from the pad
  // avenue.
  isru_plant: { ...at(135), turn: 0, reach: 26 },

  // POWER, west-south-west (195°). Fission plants go where the crew isn't:
  // these are the deepest lots on the base, and they are what sets main
  // street's radius.
  power: { ...at(195), turn: 6, reach: 29 },

  // ROVER DEPOT, south-south-west (255°). Its whole field is out driving laps of
  // main street (see PATROL) — the only moving things on the base, touring every
  // district rather than circling the core.
  //
  // Which leaves the depot's own corner lots standing empty, and that is the
  // right answer rather than a gap: a motor pool with its yard bare is a motor
  // pool whose fleet is working. The lots and the avenue are still what the
  // vehicles come home to, and still what the race's beacon is planted on.
  rover: { ...at(255), turn: 0, reach: 13 },

  // HABITAT, south-east (315°). Pressurized modules at human scale, on the near
  // frontage so the eye has somewhere to start before it reaches the core.
  habitat: { ...at(315), turn: 10, reach: 19 },
}

// Races whose hardware is UNDER WAY: the road the field drives and how fast, in
// meters per second. Absent means the race stands on its lots.
//
// Traffic is worth a great deal here. Everything else on the plan is stationary
// by nature, so a settlement full of immaculate hardware reads as an
// architectural render until something in it is working — and a city reads as a
// city when there is something on its streets. The whole field drives, spread
// round the circuit, so main street carries movement wherever you look rather
// than one vehicle doing laps for an audience.
//
// NASA specifies the LTV around 15 km/h, and a little under half of that is what
// reads as purposeful at the scale of a 515 m lap: fast enough to be plainly
// driving, slow enough that it never looks sped up. One speed for the whole
// field, which is what guarantees the field never closes up on itself — see the
// lap in MarkerLayer.
//
// The road is named here rather than taken from a vehicle's plot because a lap is
// a rigid rotation about the patch center, which holds a vehicle at whatever
// radius it starts from: reading that off the plot would have the fleet driving
// laps 10 m out on the shoulder of its own corner lots.
export const PATROL: Partial<
  Record<ProjectType, { speedMps: number; radiusM: number }>
> = {
  rover: { speedMps: 3.2, radiusM: MAIN_LOOP_M },
}

// Ring radius (meters) for any category the plan doesn't zone explicitly —
// outside the built plan, so a race added to the dataset lands on open regolith
// beyond main street instead of inside somebody's district.
export const FALLBACK_RING_M = 150

// The cleared hardstand at the core, in meters — the yard the core district
// stands in, paved continuously with the perimeter road around it.
export const HARDSTAND = { site: 'crewed_base' as ProjectType, radius: 34 }

// Roads, as polylines of [east, north] waypoints in meters. Curves are splined
// through these, so a handful of waypoints describes a road that bends the way
// a graded one does.
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
  // back half of the decade. The perimeter road and main street have no
  // `serves`: they are the settlement's own frame and arrive with it.
  serves?: ProjectType[]
}

function radial(bearingDeg: number, radiusM: number): [number, number] {
  const a = (bearingDeg * Math.PI) / 180
  return [Math.cos(a) * radiusM, Math.sin(a) * radiusM]
}

// A closed concentric road. Twenty-four stations puts a waypoint every ~21 m at
// main street's radius, which a Catmull-Rom spline carries round as a circle to
// well within the width of the windrow.
function loop(radiusM: number, stations = 24): [number, number][] {
  return Array.from({ length: stations }, (_, i) =>
    radial((i / stations) * 360, radiusM)
  )
}

// How far past a district's outer lots its avenue runs before it stops. Enough
// for the turning circle a hauler needs at the end of a road, and no more: an
// avenue that overshoots its last lot is the one thing on this plan that would
// read as a road to nowhere.
const AVENUE_TAIL_M = 7

// An avenue: the radial from the perimeter road out through its district. Three
// waypoints, because a radial is straight and a spline through collinear points
// stays straight — the bend is at the junction, where the road meets the ring.
function avenue(
  site: ProjectType,
  opts: { width?: number; serves?: ProjectType[] } = {}
): Street {
  const plan = BASE_PLAN[site]!
  const bearing = districtBearingDeg(plan)
  const centre = Math.hypot(plan.east, plan.north)
  const end = centre + (plan.reach ?? 20) + AVENUE_TAIL_M
  return {
    serves: opts.serves ?? [site],
    width: opts.width,
    points: [
      radial(bearing, RING_RADIUS_M),
      radial(bearing, (RING_RADIUS_M + end) / 2),
      radial(bearing, end),
    ],
  }
}

export const BASE_STREETS: Street[] = [
  // THE PERIMETER ROAD around the core, and downtown: the rover depot parks on
  // it, the hardstand merges under its inner curb, and all six avenues start
  // here. Arrives with the settlement, so it has no `serves`.
  { closed: true, points: loop(RING_RADIUS_M, 12) },

  // MAIN STREET — the concentric loop out at the district radius. This is the
  // road that makes the base a settlement rather than a hub with spokes: every
  // district fronts it, and it is how you get from the power district to the
  // ISRU yard without driving through the core. It crosses all six avenues, and
  // each of those crossings is a district's own junction.
  { closed: true, points: loop(MAIN_LOOP_M) },

  // PAD AVENUE — the haul road north to the landing zone, and the trunk of the
  // plan: cargo comes down it off the landers, propellant goes up it from the
  // ISRU yard by way of main street, and it runs BETWEEN the two pads rather
  // than stopping at the near one. Much the longest road on the base, because
  // the ejecta standoff is what its length is for.
  avenue('lander'),

  // ISRU AVENUE — the plant's own road downtown, for everything that isn't
  // propellant: crews, spares, and the oxygen and metals the base itself uses.
  avenue('isru_plant'),

  // WEST AVENUE — power. It carries the base's entire electrical supply, and
  // the reason its district sits deepest is the reason this is the longest
  // avenue after the pad road: every meter of standoff between a fission plant
  // and the crew is cable that has to be laid along here.
  avenue('power'),

  // CONSTRUCTION AVENUE — crew and spares out to the paving machines. Rover
  // width, not haul width: these things eat regolith they scoop where they
  // stand, so nothing heavy is ever driven out to them.
  avenue('construction', { width: 0.72 }),

  // COMMS AVENUE — maintenance out to the relay terminals.
  avenue('comms_pnt', { width: 0.72 }),

  // DEPOT AVENUE — the rovers' own road downtown. Rover width, for obvious
  // reasons.
  avenue('rover', { width: 0.72 }),

  // HABITAT AVENUE — the crew's own route between quarters and the core. Narrow
  // because nothing is hauled along it, but graded, because this is the one
  // road on the base people are expected to walk.
  avenue('habitat', { width: 0.85 }),
]
