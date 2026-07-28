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
// Districts hold their competitors as an informal cluster — plots packed round
// the lot rather than parked in a row — because a row reads as a showroom.
// The packing is computed (see districtSlots) rather than hand-authored, so a
// race that gains a competitor next month lays itself out without anyone
// having to find it a parking space.
//
// A perimeter road rings the habitat core and the rest of the plan hangs off
// it. Every road exists because something has to be HAULED along it, and each
// one is named for that traffic below. That is the whole rule, and it is worth
// stating because the obvious way to make a base look less bare — draw more
// roads, add a bypass, cross-link them into blocks — makes it look worse. A
// loop around ground nobody uses doesn't read as a surveyed lot; it reads as
// tyre marks. The cure for empty ground is hardware on it, not a road round it.
//
// The one cell the plan does close is real: the west approach, the propellant
// road and the pad approach happen to enclose the ground between the utility
// yard and the landing zone, because those three routes all have to exist.
//
// The camera looks from the south-east, so the landing zone goes at the BACK:
// the 52 m Starship reads as a backdrop over the small hardware rather than
// blocking it, and main street lies across the foreground.
//
// This lives in lib because three unrelated parts of the scene need the same
// plan: the page places the sites from it, the model layer takes each site's
// heading from it, and the roads are laid out against it.

import type { ProjectType } from './types'

export type SitePlan = {
  // Meters east and north of the ridge center — the CENTER of the district,
  // which is a point no asset necessarily stands on. Individual plots are
  // packed around it by districtSlots.
  east: number
  north: number
  // Degrees this installation is turned off the base's common heading.
  //
  // Every site shares ONE bearing by default (see facingYaw in ProjectModel).
  // That shared axis is the whole trick: sites spread over 100 m that each aim
  // independently at a viewpoint 130 m away splay by tens of degrees, and that
  // splay is what made the settlement read as unrelated hardware dropped on a
  // plain. Holding one axis makes it read as surveyed. These are the
  // deliberate departures from it — enough to keep the plan from looking like
  // a chorus line, never enough to turn an asset's back on the viewer.
  turn: number
  // Where in the district the LARGEST competitor stands, as an angle CCW from
  // east (the same convention as onRing below). The rest pack around from
  // there. Worth controlling per district because the biggest asset dominates
  // the district's silhouette, and whether it lands in front of its rivals or
  // behind them is the difference between a group portrait and an eclipse.
  spread?: number
}

// Meters of clear regolith between neighbouring plots. Applies both between
// competitors inside a district and between the districts themselves, so one
// number sets how tightly the whole colony is packed.
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

// Smallest ring radius on which every plot fits shoulder to shoulder without
// touching. A plot of radius r sitting R from the center subtends a half-angle
// of asin(r / R), so the ring holds everything exactly when the subtended
// angles (each padded by half a gap) sum to a full turn. That is monotonic in
// R, so bisection nails it.
function ringRadius(radii: number[]): number {
  const need = (R: number) =>
    radii.reduce(
      (sum, r) =>
        sum + 2 * Math.asin(Math.min(1, (r + DISTRICT_GAP_M / 2) / R)),
      0
    )
  let lo = Math.max(...radii) + DISTRICT_GAP_M / 2
  let hi = Math.max(lo, 1)
  while (need(hi) > Math.PI * 2) hi *= 1.6
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2
    if (need(mid) > Math.PI * 2) lo = mid
    else hi = mid
  }
  return hi
}

// How far off the district's heading an individual plot may be turned, in
// degrees. Enough that the field doesn't read as a chorus line; not enough to
// turn anyone's back on the camera.
const PLOT_TURN_JITTER_DEG = 14
// How far a plot may sit in or out of its ring, as a fraction of the radius.
// Kept small deliberately: the jitter eats into the clearance the ring solve
// just bought, and 3% of a 15 m ring is under half a meter against a 6 m gap.
const PLOT_RADIAL_JITTER = 0.03

// Pack a race's competitors into their district, largest first.
//
// Two plots is a special case worth having, because a ring of two is not a
// cluster — it is one asset marooned on each side of an empty middle. A pair
// stands along a single axis instead, offset so the district center falls at
// the middle of their combined frontage rather than between their centres
// (which, for a 62 m Starship pad beside a 19 m one, are not the same point).
export function districtSlots(plan: SitePlan, plots: Plot[]): Map<string, Slot> {
  const out = new Map<string, Slot>()
  if (!plots.length) return out
  const order = [...plots].sort(
    (a, b) => b.radiusM - a.radiusM || a.id.localeCompare(b.id)
  )
  const spread = ((plan.spread ?? 90) * Math.PI) / 180

  const place = (plot: Plot, dist: number, ang: number) => {
    const turn =
      plan.turn + (hash01(`${plot.id}:turn`) - 0.5) * 2 * PLOT_TURN_JITTER_DEG
    out.set(plot.id, {
      east: plan.east + Math.cos(ang) * dist,
      north: plan.north + Math.sin(ang) * dist,
      turn,
      offsetM: dist,
    })
  }

  if (order.length === 1) {
    place(order[0], 0, spread)
    return out
  }

  if (order.length === 2) {
    const [big, small] = order
    const sep = big.radiusM + small.radiusM + DISTRICT_GAP_M
    // Centring the pair's EXTENT rather than its centres: solving
    // p + rBig = q + rSmall with p + q = sep.
    const p = (sep + small.radiusM - big.radiusM) / 2
    place(big, p, spread)
    place(small, sep - p, spread + Math.PI)
    return out
  }

  const radii = order.map((p) => p.radiusM)
  const R = ringRadius(radii)
  const half = radii.map((r) =>
    Math.asin(Math.min(1, (r + DISTRICT_GAP_M / 2) / R))
  )
  // Any turn the plots don't need is shared out evenly, so a district of three
  // small assets breathes instead of huddling on one side of its ring.
  const slack =
    Math.max(0, Math.PI * 2 - half.reduce((s, h) => s + 2 * h, 0)) / order.length
  let ang = spread
  order.forEach((plot, i) => {
    const jitter = 1 + (hash01(`${plot.id}:r`) - 0.5) * 2 * PLOT_RADIAL_JITTER
    place(plot, R * jitter, ang + half[i])
    ang += 2 * half[i] + slack
  })
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

// District centres, arranged around the core at radii set by how much ground
// each one's field needs (see tmp check in scripts: every pair clears by at
// least 5 m of open regolith, edge to edge, and every district clears the
// perimeter road).
//
// Districts are spaced from their EDGES, not their centres. A settlement is
// defined by how little ground it wastes — leave 40 m of nothing between two
// lots and they read as two expeditions that happened to land on the same
// plain, however carefully they are aligned. What sets the radii is therefore
// not taste but the packing: the power district needs a 25 m lot for three
// reactors, so it sits 80 m out, and the landing zone needs 57 m for two pads,
// so it goes right to the back.
export const BASE_PLAN: Partial<Record<ProjectType, SitePlan>> = {
  // THE CORE, at the origin, inside the perimeter road: the sustained-presence
  // race, which is Artemis Base Camp against the Artemis III landed stack.
  // Camp slightly off centre with the smaller stack opposite, so the hero
  // structure sits where the eye lands.
  crewed_base: { east: 0, north: 0, turn: 0, spread: 200 },
  // HABITAT — the pressurized-module race, on the ring's southern frontage.
  // The near side, so the foreground carries something at human scale and the
  // eye has somewhere to start before it reaches the core.
  habitat: { east: 45, north: -54, turn: 10, spread: -50 },
  // ROVER DEPOT, ON the perimeter road south of the core. Alone among the
  // districts this one wants to sit at exactly the ring radius, because the
  // leading vehicle drives laps of that road from its plot (see
  // PATROL_SPEED_MPS) and a lap is a rotation about the patch centre — it
  // holds whatever radius the plot has. The three bids park on the road
  // together and the front-runner pulls out.
  rover: { east: -4, north: -40, turn: 0, spread: -95 },
  // ISRU YARD, north-west, deliberately UPHILL OF THE PAD ROAD rather than
  // tucked somewhere tidier: the entire argument for making oxygen on the Moon
  // is pumping it into a lander, so the plant wants a short tanker run to the
  // landing zone. That run is the propellant road.
  isru_plant: { east: -69, north: 37, turn: 0, spread: 152 },
  // POWER, south-west and at the far end of the west approach. Fission plants
  // go where the crew isn't: this is the longest single spur on the base, and
  // the standoff is the reason for it.
  power: { east: -75, north: -27, turn: 6, spread: 200 },
  // CONSTRUCTION, north-east, between the core and the landing zone — the
  // ground these machines are all bidding to pave. Turned up the pad road,
  // printing toward the work.
  construction: { east: 48, north: 57, turn: 22, spread: 50 },
  // LANDING ZONE, right at the back of the plan. A Starship-class descent
  // throws ejecta on ballistic arcs with no air to stop it, so a real pad
  // stands off from anything pressurized by far more than this; ~100 m of clear
  // regolith from the nearest pad edge to the core is already a compromise with
  // keeping the vehicle in frame. `spread` puts the 62 m Starship pad on the
  // FAR side of the district and the Blue Moon pad in front of it, so the big
  // stack backs the district instead of hiding it.
  lander: { east: -23, north: 128, turn: 0, spread: 90 },
  // COMMS AND NAVIGATION, due east on its own. Ground stations are sited clear
  // of traffic and of the structures that would clutter their horizon, and four
  // terminals looking at the same sky want the same thing.
  //
  // Note there is deliberately no `orbital` district. buildTechTrees treats
  // orbital as a non-surface type, so Gateway can never occupy ground here — a
  // lot for it would be a road to a plot that stays bare at every year on the
  // scrubber.
  comms_pnt: { east: 77, north: -7, turn: -12, spread: -5 },
}

// Sites whose hardware is UNDER WAY, in meters per second, driving laps of the
// perimeter road from their plot. Absent means parked.
//
// One moving thing is worth a great deal here: everything else on the plan is
// stationary by nature, so a settlement full of immaculate hardware reads as an
// architectural render until something in it is working. NASA specifies the LTV
// around 15 km/h, and a little under half of that is what reads as purposeful
// at the scale of a 190 m lap — fast enough to be plainly driving, slow enough
// that it never looks sped up.
//
// This only works for a site whose plot sits at the ring radius, because a lap
// is a rigid rotation about the patch center: it holds the vehicle at whatever
// distance from the core its plot has.
export const PATROL_SPEED_MPS: Partial<Record<ProjectType, number>> = {
  rover: 3.2,
}

// Ring radius (meters) for any category the plan doesn't zone explicitly.
export const FALLBACK_RING_M = 95

// Radius of the perimeter road's centreline, in meters. The core district packs
// to a 28 m extent, so the road's inner curb clears the camp's apron by about
// 6 m, and the hardstand inside merges under that curb — the core and its ring
// read as one paved area. Every district spur meets the base here.
export const RING_RADIUS_M = 40

// The cleared hardstand at the core, in meters — the yard the core district
// stands in, paved continuously with the ring around it.
export const HARDSTAND = { site: 'crewed_base' as ProjectType, radius: 34 }

// Roads, as polylines of [east, north] waypoints in meters. Curves are splined
// through these, so a handful of waypoints describes a road that bends the way
// a graded one does.
//
// Everything is laid out against the plots rather than between them: the ring
// runs at a radius that clears every apron, so it can carry 188 m unbroken
// instead of being chopped into stubs between neighbours that nearly touch.
// Where a road runs into a plot it is because it should — a spur ends at the
// facility it serves, and the rover is parked on the ring.
export type Street = {
  points: [number, number][]
  closed?: boolean
  // Lane width as a fraction of a full haul road. The routes that carry cargo
  // and propellant run full width; a track that only ever takes a crew rover
  // out to one machine is narrower, and that difference is most of what stops
  // five roads reading as one road drawn five times.
  width?: number
  // The sites this road exists to reach. It stands as long as any of them do,
  // so a road never runs out to a plot that is still bare regolith at the year
  // on the scrubber — the comms terminal, for one, isn't in service until the
  // back half of the decade. Only the ring has no `serves`: it is the core's
  // own perimeter and arrives with the settlement.
  serves?: ProjectType[]
}

// Bearings on the ring, in degrees, where each road meets it. Kept here as
// named angles because the constraint that matters is the SPACING: junctions
// closer than about 10 m of arc merge into one shapeless apron, and the rover
// is parked on the ring at 214° and must not be run over.
// Now that every district hangs off the ring there is one junction per spur,
// each placed on the bearing its district actually lies along — so a spur
// leaves the ring pointing at where it is going instead of setting off sideways
// and correcting. Spacing is still the constraint that matters: junctions
// closer than about 10 m of arc (14° at this radius) merge into one shapeless
// apron. The tightest pair below is 45°.
const RING_JOIN = {
  comms: -5,
  habitat: -50,
  // No join at the rover depot (-95°): it stands ON the road.
  power: 200,
  isru: 152,
  pad: 100,
  printer: 50,
}

function onRing(deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [
    +(Math.cos(a) * RING_RADIUS_M).toFixed(1),
    +(Math.sin(a) * RING_RADIUS_M).toFixed(1),
  ]
}

export const BASE_STREETS: Street[] = [
  // The perimeter road around the core.
  {
    closed: true,
    points: Array.from({ length: 12 }, (_, i) => onRing((i / 12) * 360)),
  },

  // PAD APPROACH — the haul road north to the landing zone, and the trunk of
  // the plan: cargo comes down it off the landers and propellant goes up it,
  // sharing the last stretch past the propellant road's merge.
  //
  // It THREADS BETWEEN the two pads rather than stopping at the near one,
  // passing a few meters off the Blue Moon apron and running on to the far edge
  // of the Starship's. A haul road that dead-ends at the first pad leaves the
  // bigger vehicle — the one the whole district is arranged around — with no way
  // to be reached, and a road that ends inside an apron reads as unfinished.
  {
    serves: ['lander'],
    points: [
      onRing(RING_JOIN.pad),
      [-8, 54],
      [-9.7, 70],
      [-10.5, 86],
      [-11.5, 98],
      [-15, 108],
    ],
  },

  // PROPELLANT ROAD — ISRU yard onto the pad haul road. The whole argument for
  // making oxygen on the Moon is filling a lander with it, so the tanker run
  // out of the yard is the busiest thing on the base. It merges onto the pad
  // approach rather than running its own way north: two roads to the same
  // ground would enclose 60 m of ejecta zone nothing will ever be built in.
  {
    serves: ['isru_plant', 'lander'],
    points: [
      [-51, 53],
      [-42, 60],
      [-30, 65],
      [-19, 68],
      [-9.7, 70],
    ],
  },

  // ISRU SPUR — the plant's own road in to the ring, for everything that isn't
  // propellant: crews, spares, and the oxygen and metals the base itself uses.
  {
    serves: ['isru_plant'],
    points: [onRing(RING_JOIN.isru), [-40, 21], [-46, 24]],
  },

  // WEST APPROACH — power. Short, but it is the road that carries the base's
  // entire electrical supply, and the reason the district it reaches sits 80 m
  // out: a fission plant is sited away from the crew, and every meter of that
  // standoff is cable that has to be laid along here.
  {
    serves: ['power'],
    points: [onRing(RING_JOIN.power), [-44, -16], [-51, -19]],
  },

  // PRINTER TRACK — crew and spares out to the paving machines. A rover-width
  // track, not a haul road: these things eat regolith they scoop where they
  // stand, so nothing heavy is ever driven to them.
  {
    serves: ['construction'],
    width: 0.72,
    points: [onRing(RING_JOIN.printer), [30, 36], [35, 42]],
  },

  // EAST APPROACH — maintenance out to the comms terminals, sited off on their
  // own to keep structures off their horizon.
  {
    serves: ['comms_pnt'],
    width: 0.72,
    points: [onRing(RING_JOIN.comms), [47, -4], [55, -5]],
  },

  // HABITAT WALK — the crew's own route between quarters and the core. Narrow
  // because nothing is hauled along it, but graded, because this is the one
  // road on the base that people are expected to walk.
  {
    serves: ['habitat'],
    width: 0.85,
    points: [onRing(RING_JOIN.habitat), [30, -36], [35, -42]],
  },
]
