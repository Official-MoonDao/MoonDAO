// The mass driver's own plan: where its guideway runs, how long it is, and
// where each trestle bent stands.
//
// This is a separate module for the same reason subplan.ts is one. The launcher
// is the only asset on the base whose geometry three different layers have to
// agree about: MarkerLayer has to sample the ground under every bent (it is the
// only layer holding the terrain sampler), ProjectModel has to draw legs of the
// heights that sampling implies, and the layout tests have to check a 600 m
// corridor against the road network. Deriving all three from one file is what
// stops them drifting.
//
// WHY IT IS NOT PACKED LIKE EVERYTHING ELSE
//
// Every other installation on the base is modelled for layout purposes as a
// DISC — one radius, checked against its neighbours and the roads (see
// footprintRadiusM and districtSlots). That is a fair model of a reactor or a
// habitat and a useless one for a guideway 600 m long and 6 m wide: the disc
// that contains it is 300 m across, which would reserve a quarter of the base
// for a structure that, anywhere except along its own axis, needs almost
// nothing. So the launcher is split in two: the BREACH WORKS are a small disc
// on a normal district lot (BREACH_LOT_RADIUS_M), and the track itself is a
// corridor running out of that lot into open regolith, checked as a corridor.
//
// WHY THE TRACK CARRIES A HEADING OF ITS OWN
//
// A district's position places its lot and the branch that serves it. It has no
// authority over which way a 600 m structure standing on that lot points, and
// following it here would be actively wrong, because the base sits on the ridge
// CREST: every direction runs downhill, and 300 deg runs downhill hardest —
// 62.6 m of fall in the first 400 m, measured off the rendered height field.
// A guideway is level, so fall is leg height, and 62 m legs under a 6 m deck is
// not a structure anyone would build.
//
// TRACK_HEADING_DEG is the flattest run available from the lot, which is also
// simply what you would survey for. Fall over the 600 m run, by heading, from
// the breach lot:
//
//     300 deg   94.2 m      (the steepest first 400 m)
//     330 deg  117.0 m      (the worst)
//      15 deg   18.6 m
//      30 deg   11.4 m
//      40 deg   10.6 m      <- this
//     250 deg   11.2 m      (as good, but see below)
//
// 40 deg over 250 deg because those two are opposite ends of one line and only
// one of them points away from town. The breach lot sits at the head of the
// spine, so 250 deg walks the corridor back down the street and over every
// district standing on it, while 40 deg leaves the base behind and keeps going.
// The corridor tests in cypress/integration/unit/lunar-atlas-baseplan.cy.ts
// check that directly — no road touched, no other district crossed, muzzle past
// the far end of the spine — rather than fixing a window of usable bearings.
//
// That it equals SPINE_BEARING_DEG is not a coincidence and not a constraint
// either: the road and the guideway were levelled against the same ridge for
// different reasons and arrived at the same line. See the bearing table in
// baseplan.ts, and the test that pins the two together.

import { type Vec3 } from './geo'
import { capLocalDirection } from './southpole'

// The one competitor in the mass driver race. Named here because three layers
// need to recognise it and none of them should be matching on a string.
export const MASS_DRIVER_ID = 'lunar-mass-driver-concept'

// Compass bearing of the run, degrees CCW from east — the same frame the spine
// and every district placement use. See the table above for why this value.
export const TRACK_HEADING_DEG = 40

// Length of the rendered guideway, breach to muzzle. A real reluctance launcher
// is kilometers ("for a kilometer or four" — the source design study), so this
// is still a near segment; it is as much of one as the ground will carry level
// at a credible leg height, which is what actually caps it.
export const TRACK_LENGTH_M = 600

// Spacing of the trestle bents. 15 m gives 41 of them over the run, which is
// the rhythm the reference animation reads at — close enough that the row
// carries the eye out to the muzzle, far enough apart to be a trestle and not a
// wall.
export const TRACK_BAY_M = 15

// Clearance from the deck's underside down to the HIGHEST ground under the run.
// Every other bent is taller than this by however far its own ground has
// fallen away.
export const TRACK_DECK_CLEAR_M = 5

// Half-width of the ground the guideway needs kept clear: the deck, the widest
// thing hung off it, and room to get a machine in alongside a bent.
export const TRACK_CORRIDOR_HALF_M = 8

// The breach works' own disc — capacitor hall, power feed, solar field — which
// is what stands on the district lot and what the packing math sees.
export const BREACH_LOT_RADIUS_M = 14

// --- Bent splay ------------------------------------------------------------
// How far each leg's foot stands out from the bent's centreline, per meter of
// height, and half the gap between the two legs where they meet under the pier
// cap. The splay is what makes the row read as a trestle carrying a load rather
// than a fence, and structurally it is the base width resisting the cross-track
// overturning moment on a launcher this exposed.
export const TRACK_SPLAY = 0.2
export const TRACK_LEG_TOP_HALF = 0.36

export type BentLeg = {
  // Both ends in the MODEL's own frame: x along the run, y up from the ground
  // under the lot, z across the track.
  foot: [number, number, number]
  head: [number, number, number]
}

// The two legs of one bent, as the points they actually span.
//
// This returns POINTS, not an angle, and lives here rather than in the model on
// purpose. Handing the model a lean angle means the model has to work out which
// way the lean goes, and getting that sign backwards builds a perfectly
// self-consistent bent that is upside down — an A turned into a V, same
// members, same feet, splayed at the top and standing on its points. That
// happened. From two endpoints the lean is forced, so it cannot happen again,
// and the orientation is checkable without looking at it (see the guideway
// tests in cypress/integration/unit/lunar-atlas-baseplan.cy.ts).
export function bentLegs(x: number, footY: number, headY: number): BentLeg[] {
  const spread = TRACK_SPLAY * Math.max(0, headY - footY)
  return [-1, 1].map((s) => ({
    foot: [x, footY, s * (TRACK_LEG_TOP_HALF + spread)] as [
      number,
      number,
      number
    ],
    head: [x, headY, s * TRACK_LEG_TOP_HALF] as [number, number, number],
  }))
}

// Distance along the run of each bent, breach end first.
export function trackBentStations(): number[] {
  const n = Math.floor(TRACK_LENGTH_M / TRACK_BAY_M)
  return Array.from({ length: n + 1 }, (_, i) => i * TRACK_BAY_M)
}

// World-space unit direction the guideway runs. Independent of the lot: the
// heading is a compass bearing on the ridge's own frame, so this is the axis
// both the model (as `noseAlong`) and any check of the corridor use.
export function trackAxis(): Vec3 {
  return capLocalDirection(TRACK_HEADING_DEG, 0)
}

// Each bent's position as a map-frame offset in meters from the ridge centre,
// given the lot the breach works stand on. This is the form the terrain sampler
// wants (capOffsetLatLon takes east/north meters).
export function trackBentOffsets(slot: { east: number; north: number }): {
  east: number
  north: number
}[] {
  const rad = (TRACK_HEADING_DEG * Math.PI) / 180
  const ce = Math.cos(rad)
  const cn = Math.sin(rad)
  return trackBentStations().map((d) => ({
    east: slot.east + ce * d,
    north: slot.north + cn * d,
  }))
}

// Height of the level deck, in meters above the model's own origin (which sits
// on the ground under the LOT, not under the run).
//
// `groundM` is the ground at each bent, in the same frame — so mostly negative,
// since the run descends. The deck clears the high point by TRACK_DECK_CLEAR_M,
// and 0 is included because the origin's own ground is under the breach works
// whether or not a bent happens to stand there.
export function trackDeckY(groundM: number[]): number {
  return Math.max(0, ...groundM) + TRACK_DECK_CLEAR_M
}

// How tall each bent stands, from its own ground up to the deck's underside.
export function trackLegHeights(groundM: number[]): number[] {
  const deck = trackDeckY(groundM)
  return groundM.map((g) => deck - g)
}
