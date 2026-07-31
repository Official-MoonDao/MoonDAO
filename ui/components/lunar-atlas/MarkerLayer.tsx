// Race district layer for Moon Base Zero.
//
// The surface shows EVERY competitor in every capability race, each on its own
// plot, grouped into one district per race: all three fission bids stand
// together in the power district, all four comms bids in the comms district.
// The scene is a prediction market rendered as ground truth, so standing the
// rivals on the same lot at the same scale is the whole point — you can see the
// bet rather than read it.
//
// Each district carries ONE beacon, at the lot's centre, because 24 pins is not
// a map, it is a pincushion. Individual assets are still clickable and name
// themselves on hover; the pin names the race. Pins on the far side of the Moon
// fade out, and beacons recede as the camera closes in so the models read.
//
// Opening a race dims every OTHER district rather than hiding it, so the colony
// still reads as one settlement while the field you asked about is the only
// thing at full strength.

import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  BASE_PLAN,
  MAIN_LOOP_M,
  onLoopRoad,
  PATROL,
  RING_RADIUS_M,
  ROAD_HALF_M,
  SETBACK_M,
  withinDistrictGround,
  type Slot,
} from '@/lib/lunar-atlas/baseplan'
import {
  MOON_RADIUS_M,
  latLonToVector3,
  vector3ToLatLon,
  Vec3,
} from '@/lib/lunar-atlas/geo'
import { PROJECT_TYPE_LABEL, orgColor } from '@/lib/lunar-atlas/display'
import {
  M_TO_UNITS,
  capCenterDirection,
  capOffsetLatLon,
} from '@/lib/lunar-atlas/southpole'
import { GLOBE_RADIUS } from '@/lib/lunar-atlas/textures'
import type { TechTree } from '@/lib/lunar-atlas/selectors'
import type {
  Organization,
  Project,
  ProjectType,
} from '@/lib/lunar-atlas/types'
import ProjectModel, {
  BoulderCluster,
  BrickPallet,
  CableReel,
  CargoCrate,
  CrateCluster,
  GAS_STATION_HALF_D,
  GAS_STATION_HALF_W,
  gradedDeckRadiusM,
  projectSizeM,
  RoverDepotYard,
  RoverGasStation,
  SparePartsPallet,
  StreetLight,
  SurfaceAnchor,
} from './ProjectModel'
import type { RadiusAt } from './useTerrainSampler'

// The competitors of a race, best-placed first. Order matters because the
// front-runner is the one the district's beacon is named for.
export function rankedMembers(tree: TechTree): Project[] {
  const odds = tree.goal?.market?.impliedOdds
  if (!odds) return tree.projects
  return [...tree.projects].sort(
    (a, b) => (odds[b.id] ?? -1) - (odds[a.id] ?? -1)
  )
}

// Axis of the map patch, and so of the perimeter road: a lap is a rotation
// about it. Fixed for the life of the app.
const CAP_AXIS = new THREE.Vector3(...capCenterDirection()).normalize()

// Seconds-ish for a patrolling vehicle to reach speed, or to come to a stand
// when its race is opened. A vehicle that stops dead reads as a paused
// animation; one that rolls to a halt reads as a driver lifting off.
const PATROL_EASE = 0.03

// Live surface direction of each DRIVING competitor, keyed by project id and
// rewritten every frame by its `CompetitorPlot`. A rover laps the road, so
// where it actually is at any instant is runtime state, not something the
// static layout table can know — the camera reads this when a rover is picked
// from the list so it zooms to the vehicle where it stands on the road, rather
// than teleporting it (or the camera) to its empty plot. Module-level because
// it's a per-frame side channel, not part of the render tree's prop data.
export const LIVE_PATROL_DIR = new Map<string, Vec3>()

// How far down a district is taken while a DIFFERENT race is open. Heavy enough
// that the open race is unmistakably the subject, light enough that the rest of
// the base is still plainly there — which is the point of dimming rather than
// hiding. Shared with the sky layer, so the orbital hardware is held back by
// exactly as much as the ground hardware.
export const DIM_FACTOR = 0.28

export type MarkerStyle = { opacity: number; visible: boolean }

// Above this a plot is present enough to stand its hardware up; below it the
// district's beacon marks the ground on its own. The road network reads the
// same threshold, so a spur is never graded out to a district that is still
// bare regolith.
export const MODEL_PRESENCE = 0.5

// Where each competitor stands, and where each district's beacon goes. Built
// once by the page so the models, the pins and the camera cannot disagree.
export type ColonyLayout = {
  // District centre directions, keyed by race category — what the camera flies
  // to when a race is opened.
  districts: Map<ProjectType, Vec3>
  // Per-project plot: its surface direction and its slot in the district.
  // `standDir` is set only for a competitor whose race DRIVES (see PATROL): the
  // road position it rests at, out on the patrol loop rather than on `dir` (its
  // own plot). The model stands here and the camera aims here, off one shared
  // value, so the two cannot land in different places.
  plots: Map<string, { dir: Vec3; slot: Slot; standDir?: Vec3 }>
}

type MarkerLayerProps = {
  trees: TechTree[]
  organizations: Organization[]
  layout: ColonyLayout
  // The open race. Its district stays at full strength; the others dim.
  selectedTreeCategory?: ProjectType | null
  // Competitor picked from a race panel — its plot is called out by name.
  selectedProject?: Project | null
  hoveredCategory?: ProjectType | null
  onSelectTree?: (category: ProjectType) => void
  onSelectProject?: (projectId: string) => void
  onHoverTree?: (category: ProjectType | null) => void
  // Timeline styling per member project.
  getProjectStyle?: (project: Project) => MarkerStyle
  // Displaced terrain radius lookup so pins/models sit on the rendered ground.
  radiusAt?: RadiusAt | null
}

// Offsets above the local terrain (which the sampler provides per marker),
// in REAL METERS — the base is true-to-scale on the 16 km ridge patch.
const SEAT_LIFT = 0.5 * M_TO_UNITS // clears z-fighting with the terrain
// Pins are sized to the district they mark: the reticle floats clear of the
// tallest thing on the lot (a rover depot gets a ~25 m pin, the landing zone
// with its 52 m Starship a ~68 m one). One fixed height either buried the
// reticle inside tall models or dwarfed the small ones.
const MIN_PIN_HEIGHT_M = 25
const pinHeightUnits = (modelSizeM: number) =>
  Math.max(MIN_PIN_HEIGHT_M, modelSizeM * 1.3) * M_TO_UNITS
// Beacon dimensions, in REAL METERS. These are deliberately hairline: at true
// scale the old pin was a 1.4 m-thick opaque rod under a 6 m emissive ball —
// a plastic lollipop the size of a small building, which is what made the
// markers read as toys next to photoreal hardware. A map marker should be
// instrument-like, so the beacon is a thin billboarded reticle on a tether
// that dissolves toward the ground instead of a solid mast.
const HEAD_RADIUS = 3.4 * M_TO_UNITS
const STEM_RADIUS = 0.16 * M_TO_UNITS
// As the camera closes in, beacons fade so the detailed on-surface models take
// over (findability markers far, physical builds near). The district drill-in
// parks the camera 75-84 m off a beacon, so NEAR sits just above that: one
// still half-opaque at that range hangs over the very district the user clicked
// to see.
const FADE_NEAR = 80 * M_TO_UNITS
const FADE_FAR = 150 * M_TO_UNITS

// The highest rendered ground within a footprint. Only the padded lander uses
// this: a rigid pad cannot sink into a slope, so it rests on the high point and
// its skirt covers the gap on the downhill side. Everything else seats on the
// ground directly beneath it — taking the footprint maximum there just lifts
// the model by the terrain's relief, with no skirt to hide the daylight.
function footprintSeatRadius(
  d: THREE.Vector3,
  radiusAt: RadiusAt,
  footprintM: number
): number {
  const ll = vector3ToLatLon([d.x, d.y, d.z])
  let seat = radiusAt(ll.lat, ll.lon)
  // Tangent basis at d (d is never at the equator here, but guard anyway).
  const ref =
    Math.abs(d.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)
  const u = new THREE.Vector3().crossVectors(ref, d).normalize()
  const w = new THREE.Vector3().crossVectors(d, u)
  const ang = footprintM / MOON_RADIUS_M
  const cosA = Math.cos(ang)
  const sinA = Math.sin(ang)
  for (let i = 0; i < 8; i++) {
    const az = (i / 8) * Math.PI * 2
    const p = d
      .clone()
      .multiplyScalar(cosA)
      .addScaledVector(u, Math.cos(az) * sinA)
      .addScaledVector(w, Math.sin(az) * sinA)
    const pll = vector3ToLatLon([p.x, p.y, p.z])
    seat = Math.max(seat, radiusAt(pll.lat, pll.lon))
  }
  return seat
}

// ---------------------------------------------------------------------------
// One competitor's plot
// ---------------------------------------------------------------------------

function CompetitorPlot({
  project,
  slot,
  dir,
  standDir,
  accent,
  opacity,
  dim,
  patrol,
  patrolPhase,
  raceOpen,
  called,
  onSelect,
  onHover,
  radiusAt,
}: {
  project: Project
  slot: Slot
  dir: Vec3
  // The road position a DRIVING competitor rests at, precomputed in the shared
  // layout so the model and the camera agree (see ColonyLayout). Absent for a
  // competitor that stands on its own plot, in which case `dir` is used.
  standDir?: Vec3
  accent: string
  opacity: number
  // 1 while this plot's race is the subject, DIM_FACTOR while another's is.
  dim: number
  // The road to drive and how fast, for a race whose hardware drives rather than
  // stands. Taken straight from PATROL rather than rebuilt per render, because
  // it keys the seating memos below and a fresh object each render would have
  // them resample the terrain for nothing.
  patrol?: { speedMps: number; radiusM: number }
  // Radians round that road this vehicle starts at, which is what keeps a whole
  // depot's worth of them off each other.
  patrolPhase?: number
  // Whether this plot's own race is the open one. Names every asset on the lot,
  // and brings the driving ones to a stand so they can be read.
  raceOpen: boolean
  // Picked out specifically — hovered, or chosen from the competitor list.
  called: boolean
  onSelect?: () => void
  onHover?: (hovered: boolean) => void
  radiusAt?: RadiusAt | null
}) {
  const groupRef = useRef<THREE.Group>(null)

  // Where this competitor actually stands. Normally its own plot — but a vehicle
  // that drives starts OUT ON THE ROAD it laps rather than parked in its yard,
  // spaced from its rivals by `phase` around that road so the whole depot can be
  // out at once without one machine standing inside another.
  const standAt = useMemo(() => {
    // The shared layout already worked this out for a driving competitor; fall
    // back to computing it here only if it wasn't handed down, and to the plot
    // itself for anything that isn't driving.
    if (standDir) return standDir
    if (!patrol) return dir
    const bearing = Math.atan2(slot.north, slot.east) + (patrolPhase ?? 0)
    const ll = capOffsetLatLon(
      Math.cos(bearing) * patrol.radiusM,
      Math.sin(bearing) * patrol.radiusM
    )
    return latLonToVector3(ll.lat, ll.lon, 1)
  }, [standDir, dir, patrol, patrolPhase, slot.east, slot.north])

  const { ndir, seatRadius, labelAt } = useMemo(() => {
    const d = new THREE.Vector3(
      standAt[0],
      standAt[1],
      standAt[2]
    ).normalize()
    const ll = vector3ToLatLon([d.x, d.y, d.z])
    // A model on a graded deck (a lander's pad, the construction apron) seats
    // on the highest ground under that deck, whose skirt then grades down over
    // the downhill side. Anything else has nothing to hide a gap with, so it
    // seats on the ground directly beneath it: the footprint maximum would
    // lift it by the terrain's relief across the footprint, which is exactly
    // the "slightly floating" look. Bedding an edge a centimeter into regolith
    // is invisible; hovering is not.
    // Until the height maps decode, fall back to the analytic sphere.
    const deckR = gradedDeckRadiusM(project)
    const ground = !radiusAt
      ? GLOBE_RADIUS
      : deckR !== null
      ? footprintSeatRadius(d, radiusAt, deckR)
      : radiusAt(ll.lat, ll.lon)
    return {
      ndir: d,
      seatRadius: ground,
      // Just clear of the model's own height, so a name never sits inside the
      // thing it names.
      labelAt: d
        .clone()
        .multiplyScalar(ground + projectSizeM(project) * 1.25 * M_TO_UNITS),
    }
  }, [standAt, radiusAt, project])

  // Laps of main street, for a race whose hardware drives rather than stands
  // (see PATROL).
  //
  // The lap is a rigid rotation of the vehicle about the patch axis, which is
  // what makes it both cheap and correct: a rotation of the sphere holds it at
  // exactly the radius it started from — the road — and carries its seating and
  // its heading with it, so neither has to be recomputed per frame.
  //
  // It is also why a whole fleet can share one road safely. Every vehicle turns
  // through the same angle at the same rate, so the gaps the phases opened up are
  // held for good: the convoy can never close on itself, however long it runs.
  const lap = useMemo(() => {
    if (!patrol) return null
    // Travel direction where it stands. Rotating a point p about axis n moves it
    // along n × p, so this is the way a positive rate drives.
    const along = CAP_AXIS.clone().cross(ndir).normalize()
    return {
      rate: patrol.speedMps / patrol.radiusM,
      noseAlong: [along.x, along.y, along.z] as Vec3,
    }
  }, [patrol, ndir])
  const lapRef = useRef(0)
  const throttleRef = useRef(0)

  useFrame((_, delta) => {
    const g = groupRef.current
    if (!g || !lap) return
    // Roll to a stand where it IS when this race is opened — the vehicle sits
    // still while the user reads about it, but stays put on the road rather than
    // teleporting back to a start line. The camera comes to the vehicle instead
    // (see LIVE_PATROL_DIR, published below, and the page's flyToProject).
    const throttle = raceOpen ? 0 : 1
    throttleRef.current +=
      (throttle - throttleRef.current) * (1 - Math.pow(PATROL_EASE, delta))
    lapRef.current += lap.rate * throttleRef.current * delta
    g.quaternion.setFromAxisAngle(CAP_AXIS, lapRef.current)
    // Where the vehicle actually is this frame — its start direction carried
    // round the lap. Published so a drill-in can find it on the road, and
    // reused just below to ride the road's rise and fall.
    const p = ndir.clone().applyQuaternion(g.quaternion)
    LIVE_PATROL_DIR.set(project.id, [p.x, p.y, p.z])
    // Every child is positioned in world space from the globe centre, so a
    // uniform scale IS a radial offset: the ratio of ground radii lifts the
    // vehicle by the height difference. The shape distortion is that same ratio
    // — about a part in a million for a couple of meters of relief against a
    // 1737 km radius.
    if (radiusAt) {
      const pll = vector3ToLatLon([p.x, p.y, p.z])
      g.scale.setScalar(radiusAt(pll.lat, pll.lon) / seatRadius)
    }
  })

  // Drop the live position when this vehicle leaves the scene (filtered out by
  // the timeline, say), so a drill-in can never chase a stale spot.
  useEffect(() => {
    const id = project.id
    return () => {
      LIVE_PATROL_DIR.delete(id)
    }
  }, [project.id])

  if (opacity <= MODEL_PRESENCE) return null

  return (
    <group ref={groupRef}>
      <ProjectModel
        project={project}
        dir={[ndir.x, ndir.y, ndir.z]}
        accent={accent}
        turn={THREE.MathUtils.degToRad(slot.turn)}
        noseAlong={lap?.noseAlong}
        dim={dim}
        onSelect={onSelect}
        onHover={(id) => onHover?.(Boolean(id))}
        surfaceRadius={seatRadius}
      />

      {/* The asset's own name. Shown on hover, and for the whole field while
          its race is open — which is how you tell three reactors apart. */}
      {(called || raceOpen) && (
        <Html
          position={labelAt}
          center
          zIndexRange={[20, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className={`whitespace-nowrap rounded border px-1.5 py-0.5 text-center text-[9px] font-medium leading-tight shadow-md backdrop-blur-sm ${
              called
                ? 'border-white/25 bg-black/80 text-white'
                : 'border-white/10 bg-black/55 text-white/70'
            }`}
          >
            {project.name}
          </div>
        </Html>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// The rover district's own lot — shared infrastructure, not a competitor
// ---------------------------------------------------------------------------
//
// Every other district's plots are populated by `CompetitorPlot` above, one
// per project, placed by `districtSlots` with a setback that clears both
// streets it fronts. The rover race has no plots standing: its whole field
// drives permanent laps (see PATROL), so `districtDir` itself — the raw
// junction where the depot avenue crosses main street — has nothing a
// per-project loop would ever draw there. `RoverDepotYard` (ProjectModel.tsx)
// is the fix, but it cannot simply stand AT `districtDir`: that point sits
// ON both roads at once (the avenue's own radial line and the loop's circle
// both pass through it), which is exactly what put the pad under the pavement
// the first time this was tried.
//
// So this reproduces `districtSlots`' own radial/angular setback by hand
// rather than calling it, but placed INWARD of main street rather than at an
// outward corner like a real competitor's plot would be: `districtSlots`
// always gives a single plot the district's first (outward) corner, which
// would need `BASE_PLAN.rover.reach` inflated well past what this district's
// own LTV-scale roster justifies — exactly what the avenue-overshoot check
// in lunar-atlas-baseplan.cy.ts exists to catch, since `reach` is shared
// with the real (if never-standing) competitor plots. Sitting inward instead
// touches neither the avenue's own radial line nor the loop's circle, with
// no baseplan.ts change at all: same radial setback off main street, same
// angular swing off the avenue, just measured toward the core instead of
// away from it. That belt is only ~23 m deep once both roads' own setbacks
// are spent, which is what keeps `RoverDepotYard` a compact 13 x 10 m.
const DEPOT_FOOTPRINT_R = 9 // half-diagonal of the yard's 13 x 10 m apron, with room to spare

function RoverDepotSite({
  accent,
  dim,
  opacity,
  radiusAt,
}: {
  accent: string
  dim: number
  opacity: number
  radiusAt?: RadiusAt | null
}) {
  const { seat, ndir, noseAlong } = useMemo(() => {
    const plan = BASE_PLAN.rover!
    const bearing = Math.atan2(plan.north, plan.east)
    const front = ROAD_HALF_M + SETBACK_M + DEPOT_FOOTPRINT_R
    const radius = MAIN_LOOP_M - front
    const swing = Math.asin(Math.min(1, front / radius))
    const a = bearing + swing

    const ll = capOffsetLatLon(Math.cos(a) * radius, Math.sin(a) * radius)
    const d = new THREE.Vector3(
      ...latLonToVector3(ll.lat, ll.lon, 1)
    ).normalize()
    // A rigid 13 x 10 m apron cannot sink into a slope, so — exactly like
    // the padded lander (see footprintSeatRadius's own comment) — it seats
    // on the HIGHEST ground under its own footprint rather than the single
    // point at its center, and RoverDepotYard grades a skirt down from
    // there to hide whatever the downhill side leaves uncovered.
    const ground = !radiusAt
      ? GLOBE_RADIUS
      : footprintSeatRadius(d, radiusAt, DEPOT_FOOTPRINT_R)

    // A second point at the same radius but zero swing — back on the
    // avenue's own radial line — so the yard's open (aisle) side faces the
    // road it is served by rather than an arbitrary camera-relative default.
    const backLl = capOffsetLatLon(
      Math.cos(bearing) * radius,
      Math.sin(bearing) * radius
    )
    const backDir = new THREE.Vector3(
      ...latLonToVector3(backLl.lat, backLl.lon, 1)
    )
    const face: Vec3 = backDir.sub(d).normalize().toArray() as Vec3

    return { seat: ground + SEAT_LIFT, ndir: d, noseAlong: face }
  }, [radiusAt])

  if (opacity <= MODEL_PRESENCE) return null

  return (
    <SurfaceAnchor
      dir={[ndir.x, ndir.y, ndir.z]}
      surfaceRadius={seat}
      scale={M_TO_UNITS}
      dim={dim}
      noseAlong={noseAlong}
    >
      {/* RoverDepotYard is authored with its open, aisle-facing side on
          local +Z (stalls back toward -Z); `noseAlong` steers local +X (see
          `headingYaw`), so this 90° turn hands it the axis that convention
          expects without re-authoring the yard itself. */}
      <group rotation={[0, Math.PI / 2, 0]}>
        <RoverDepotYard accent={accent} />
      </group>
    </SurfaceAnchor>
  )
}

// Half-diagonal of the gas station's own 10 x 8.8 m forecourt apron (see
// `GAS_STATION_HALF_W`/`GAS_STATION_HALF_D`), with room to spare — the same
// role `DEPOT_FOOTPRINT_R` plays for the yard above.
const GAS_STATION_FOOTPRINT_R = Math.hypot(GAS_STATION_HALF_W, GAS_STATION_HALF_D) + 0.6

// The rover district's recharge/propellant station: a second, freestanding
// piece of shared infrastructure, sited on the OPPOSITE side of the depot
// avenue from `RoverDepotSite` — same radial setback off main street, same
// angular swing off the avenue, just the other sign, so the two face each
// other across the one straight road they both front rather than crowding
// one footprint. This is the "different structure, across the street" the
// depot's own corner never had room for.
function RoverGasStationSite({
  accent,
  dim,
  opacity,
  radiusAt,
}: {
  accent: string
  dim: number
  opacity: number
  radiusAt?: RadiusAt | null
}) {
  const { seat, ndir, noseAlong } = useMemo(() => {
    const plan = BASE_PLAN.rover!
    const bearing = Math.atan2(plan.north, plan.east)
    const front = ROAD_HALF_M + SETBACK_M + GAS_STATION_FOOTPRINT_R
    const radius = MAIN_LOOP_M - front
    const swing = Math.asin(Math.min(1, front / radius))
    // The depot itself takes `bearing + swing` (see RoverDepotSite); this
    // stands at `bearing - swing` — the mirror image across the avenue's own
    // radial line, at whatever radius ITS OWN (smaller) footprint needs.
    const a = bearing - swing

    const ll = capOffsetLatLon(Math.cos(a) * radius, Math.sin(a) * radius)
    const d = new THREE.Vector3(
      ...latLonToVector3(ll.lat, ll.lon, 1)
    ).normalize()
    const ground = !radiusAt
      ? GLOBE_RADIUS
      : footprintSeatRadius(d, radiusAt, GAS_STATION_FOOTPRINT_R)

    // Face back toward the avenue's own radial line, same technique as
    // RoverDepotSite — which, since the two sit on opposite sides of that
    // line, points this station's own forecourt entrance at the depot yard
    // across the road rather than out into open regolith.
    const backLl = capOffsetLatLon(
      Math.cos(bearing) * radius,
      Math.sin(bearing) * radius
    )
    const backDir = new THREE.Vector3(
      ...latLonToVector3(backLl.lat, backLl.lon, 1)
    )
    const face: Vec3 = backDir.sub(d).normalize().toArray() as Vec3

    return { seat: ground + SEAT_LIFT, ndir: d, noseAlong: face }
  }, [radiusAt])

  if (opacity <= MODEL_PRESENCE) return null

  return (
    <SurfaceAnchor
      dir={[ndir.x, ndir.y, ndir.z]}
      surfaceRadius={seat}
      scale={M_TO_UNITS}
      dim={dim}
      noseAlong={noseAlong}
    >
      {/* Same authoring convention as RoverDepotYard: forecourt entrance on
          local +Z, so the same 90° turn hands it the noseAlong axis. */}
      <group rotation={[0, Math.PI / 2, 0]}>
        <RoverGasStation accent={accent} />
      </group>
    </SurfaceAnchor>
  )
}

// ---------------------------------------------------------------------------
// Base-wide filler — the open ground between districts
// ---------------------------------------------------------------------------
//
// Everything above is either a competitor's plot or the depot's own shared
// yard — one per district. This is the one layer that renders ONCE for the
// whole base rather than per-district, because most of the plan by area is
// neither a district nor a road: it's the open regolith between avenues, and
// the two closed loops stitching the districts together. Left bare, that is
// most of what the camera actually sees on approach.
//
// A boulder field fills the open ground — native rock, not manifested cargo,
// so it belongs on unclaimed regolith in a way none of the logistics props in
// ProjectModel.tsx do — and street lights line both loop roads. Both are kept
// off every district's own ground by `withinDistrictGround` (baseplan.ts),
// which is deliberately generous rather than exact: it doesn't know any
// district's live roster, only the widest plausible spread its `reach`
// allows, so nothing here can ever end up sitting on a competitor's plot no
// matter how a roster changes. Neither is dimmed when a race is opened (see
// SurfaceAnchor's own `dim`, left at its default): this belongs to the
// settlement, not to whichever district happens to be nearest.

function hash1(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

// The annulus a boulder can land in: just past the ring road's own clearance
// out to a bit beyond the landing zone's own reach (the single furthest any
// district goes — see `wide` in baseplan.ts' DISTRICT_ZONES). Sampled as a
// polar grid with per-cell jitter and a low keep-rate, which is what makes a
// grid read as scatter instead of a filled ring.
const BOULDER_MIN_R = RING_RADIUS_M + 5
const BOULDER_MAX_R = 165
const BOULDER_RADIAL_BANDS = 7
const BOULDER_ANGULAR_STEPS = 30
const BOULDER_KEEP_FRACTION = 0.34

// A post every ~40 m along a loop, just outside its windrow — close enough
// together to actually read as street lighting, far enough apart that a
// closed loop doesn't need dozens of them.
const STREET_LIGHT_SPACING_M = 40

// Staged cargo along the shoulders of both loop roads — the manifested-cargo
// counterpart to the boulder field, for stretches of road with nothing to
// look at otherwise. Unlike the boulders (native rock, scattered anywhere on
// open ground) this stays close to a road on purpose: a crate stack or a
// cable reel reads as something a hauler dropped off, which only makes
// sense sitting where a hauler could actually reach it.
const ROADSIDE_SPACING_M = 30
const ROADSIDE_KEEP_PROB = 0.75
type RoadsideKind = 'crates' | 'cablereel' | 'parts' | 'bricks'

function InterDistrictFiller({ radiusAt }: { radiusAt?: RadiusAt | null }) {
  const boulders = useMemo(() => {
    const out: { dir: Vec3; seat: number; size: number; seed: number }[] = []
    for (let ri = 0; ri < BOULDER_RADIAL_BANDS; ri++) {
      for (let ai = 0; ai < BOULDER_ANGULAR_STEPS; ai++) {
        const k = ri * 977 + ai * 31 + 1
        if (hash1(k) > BOULDER_KEEP_FRACTION) continue
        const rFrac = (ri + 0.15 + hash1(k + 1) * 0.7) / BOULDER_RADIAL_BANDS
        const r = BOULDER_MIN_R + rFrac * (BOULDER_MAX_R - BOULDER_MIN_R)
        const bearing = ((ai + hash1(k + 2)) / BOULDER_ANGULAR_STEPS) * 360
        if (onLoopRoad(r) || withinDistrictGround(r, bearing, 20)) continue
        const a = (bearing * Math.PI) / 180
        const ll = capOffsetLatLon(Math.cos(a) * r, Math.sin(a) * r)
        const dir = latLonToVector3(ll.lat, ll.lon, 1)
        const seat = radiusAt
          ? radiusAt(ll.lat, ll.lon) + SEAT_LIFT
          : GLOBE_RADIUS + SEAT_LIFT
        out.push({ dir, seat, size: 0.3 + hash1(k + 3) * 1.4, seed: k })
      }
    }
    return out
  }, [radiusAt])

  const lights = useMemo(() => {
    const out: { dir: Vec3; seat: number; noseAlong: Vec3 }[] = []
    // A fine angular step (every ~1-3 m of arc on these radii) walked all the
    // way round each loop, placing a light once STREET_LIGHT_SPACING_M has
    // accumulated since the last one and skipping any candidate over a
    // district's own ground. A fixed COUNT of evenly-spaced stations was
    // tried first and aliased badly: with 7 districts on the ring road and 7
    // evenly-spaced stations, nearly every station landed within a wedge by
    // coincidence and only one light survived. Walking and accumulating arc
    // length instead means a wedge just delays the next light rather than
    // deleting a whole station, so the loop is never left with a long dark
    // stretch merely because a station's angle happened to land badly.
    const STEP_DEG = 2
    for (const r of [RING_RADIUS_M, MAIN_LOOP_M]) {
      const postR = r + ROAD_HALF_M + 1.4
      let lastPlacedDeg: number | null = null
      for (let deg = 0; deg < 360; deg += STEP_DEG) {
        // A narrower margin than the boulders': a thin post just needs to
        // clear a district's own ground, not stand well back from it, so
        // lights still line the road right up to each district's junction.
        if (withinDistrictGround(postR, deg, 11)) continue
        if (lastPlacedDeg !== null) {
          const arcSinceM = ((deg - lastPlacedDeg) * Math.PI * r) / 180
          if (arcSinceM < STREET_LIGHT_SPACING_M) continue
        }
        lastPlacedDeg = deg

        const a = (deg * Math.PI) / 180
        const ll = capOffsetLatLon(Math.cos(a) * postR, Math.sin(a) * postR)
        const d = new THREE.Vector3(
          ...latLonToVector3(ll.lat, ll.lon, 1)
        ).normalize()
        const seat = radiusAt
          ? radiusAt(ll.lat, ll.lon) + SEAT_LIFT
          : GLOBE_RADIUS + SEAT_LIFT
        // The boom leans toward the road's own centerline (radius r), not
        // toward the ridge center generally — for the ring road that's the
        // same thing, but for main street it keeps every light's fixture
        // facing the pavement it actually lights rather than the core.
        const innerLl = capOffsetLatLon(Math.cos(a) * r, Math.sin(a) * r)
        const innerDir = new THREE.Vector3(
          ...latLonToVector3(innerLl.lat, innerLl.lon, 1)
        )
        const noseAlong = innerDir.sub(d).normalize().toArray() as Vec3
        out.push({ dir: [d.x, d.y, d.z] as Vec3, seat, noseAlong })
      }
    }
    return out
  }, [radiusAt])

  const roadsideCargo = useMemo(() => {
    const out: {
      dir: Vec3
      seat: number
      kind: RoadsideKind
      seed: number
      yaw: number
    }[] = []
    const STEP_DEG = 2
    for (const r of [RING_RADIUS_M, MAIN_LOOP_M]) {
      let lastSlotDeg: number | null = null
      for (let deg = 0; deg < 360; deg += STEP_DEG) {
        if (lastSlotDeg !== null) {
          const arcSinceM = ((deg - lastSlotDeg) * Math.PI * r) / 180
          if (arcSinceM < ROADSIDE_SPACING_M) continue
        }
        // Alternate shoulders rather than always the outward side, so a
        // loop's inner and outer edges both pick up traffic. Offset starts
        // further out than the street lights' own fixed band (r + ROAD_HALF_M
        // + 1.4) so a crate cluster can never land close enough to clip one.
        const side = hash1(r + deg * 3 + 1) > 0.5 ? 1 : -1
        const postR = r + side * (ROAD_HALF_M + 3.2 + hash1(r + deg * 3 + 2) * 3)
        if (onLoopRoad(postR) || withinDistrictGround(postR, deg, 8)) continue
        // Advance the walk past this slot regardless of whether it renders
        // anything below — that's what keeps the spacing organic (some
        // slots come up empty) rather than every eligible slot filling.
        lastSlotDeg = deg
        const k = Math.round(r) * 4001 + deg * 13 + 7
        if (hash1(k) > ROADSIDE_KEEP_PROB) continue

        const roll = hash1(k + 1)
        const kind: RoadsideKind =
          roll < 0.4
            ? 'crates'
            : roll < 0.65
            ? 'cablereel'
            : roll < 0.85
            ? 'parts'
            : 'bricks'
        const a = (deg * Math.PI) / 180
        const ll = capOffsetLatLon(Math.cos(a) * postR, Math.sin(a) * postR)
        const dir = latLonToVector3(ll.lat, ll.lon, 1)
        const seat = radiusAt
          ? radiusAt(ll.lat, ll.lon) + SEAT_LIFT
          : GLOBE_RADIUS + SEAT_LIFT
        out.push({ dir, seat, kind, seed: k, yaw: hash1(k + 2) * Math.PI * 2 })
      }
    }
    return out
  }, [radiusAt])

  return (
    <group>
      {boulders.map((b, i) => (
        <SurfaceAnchor
          key={`boulder:${i}`}
          dir={b.dir}
          surfaceRadius={b.seat}
          scale={M_TO_UNITS}
          castShadows={false}
          interactive={false}
        >
          <BoulderCluster seed={b.seed} size={b.size} />
        </SurfaceAnchor>
      ))}
      {lights.map((l, i) => (
        <SurfaceAnchor
          key={`light:${i}`}
          dir={l.dir}
          surfaceRadius={l.seat}
          scale={M_TO_UNITS}
          noseAlong={l.noseAlong}
          castShadows={false}
          interactive={false}
        >
          <StreetLight />
        </SurfaceAnchor>
      ))}
      {roadsideCargo.map((c, i) => (
        <SurfaceAnchor
          key={`cargo:${i}`}
          dir={c.dir}
          surfaceRadius={c.seat}
          scale={M_TO_UNITS}
          castShadows={false}
          interactive={false}
        >
          <group rotation={[0, c.yaw, 0]}>
            {c.kind === 'crates' && (
              <CrateCluster
                seed={c.seed}
                count={2 + Math.floor(hash1(c.seed + 50) * 3)}
                spread={1.6}
              />
            )}
            {c.kind === 'cablereel' && (
              <group>
                <CableReel />
                <group position={[0.85, 0, 0.35]} rotation={[0, 0.6, 0]}>
                  <CargoCrate variant="small" seed={c.seed + 1} />
                </group>
              </group>
            )}
            {c.kind === 'parts' && <SparePartsPallet seed={c.seed} />}
            {c.kind === 'bricks' && <BrickPallet seed={c.seed} />}
          </group>
        </SurfaceAnchor>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// One district's beacon
// ---------------------------------------------------------------------------

function DistrictBeacon({
  dir,
  color,
  label,
  pinModelSizeM,
  selected,
  hovered,
  style,
  onSelect,
  onHover,
  radiusAt,
}: {
  dir: Vec3
  color: string
  label: string
  // The tallest model on the lot, so the reticle floats clear of all of them.
  pinModelSizeM: number
  selected: boolean
  hovered: boolean
  style: MarkerStyle
  onSelect?: () => void
  onHover?: (hovered: boolean) => void
  radiusAt?: RadiusAt | null
}) {
  const { camera } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Group>(null)
  const stemRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const scaleRef = useRef(1)

  const { base, tip, ndir } = useMemo(() => {
    const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize()
    const ll = vector3ToLatLon([d.x, d.y, d.z])
    const ground = radiusAt ? radiusAt(ll.lat, ll.lon) : GLOBE_RADIUS
    const seat = ground + SEAT_LIFT
    return {
      base: d.clone().multiplyScalar(seat),
      tip: d.clone().multiplyScalar(seat + pinHeightUnits(pinModelSizeM)),
      ndir: d,
    }
  }, [dir, radiusAt, pinModelSizeM])

  useFrame((_, delta) => {
    const g = groupRef.current
    if (!g) return
    // Backface fade: how much the marker's surface normal faces the camera.
    const camDir = camera.position.clone().normalize()
    const facing = ndir.dot(camDir)
    const limb = THREE.MathUtils.clamp((facing + 0.05) / 0.25, 0, 1)
    g.visible = style.visible && facing > -0.05

    // Proximity fade: dots recede as the camera approaches so the models read.
    const dist = camera.position.distanceTo(tip)
    const proximity = THREE.MathUtils.clamp(
      (dist - FADE_NEAR) / (FADE_FAR - FADE_NEAR),
      0,
      1
    )
    const beaconOpacity = style.opacity * limb * proximity

    // Ease the reticle scale toward its hover/selected target. Kept subtle:
    // the reticle is a fixed-size instrument mark, so it grows just enough to
    // acknowledge the pointer rather than ballooning.
    const target = selected ? 1.35 : hovered ? 1.18 : 1
    scaleRef.current += (target - scaleRef.current) * (1 - Math.pow(0.001, delta))
    const head = headRef.current
    if (head) {
      head.visible = beaconOpacity > 0.02
      head.scale.setScalar(scaleRef.current)
      head.lookAt(camera.position)
      const emphasis = selected ? 1 : hovered ? 0.95 : 0.8
      for (const child of head.children) {
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
        mat.opacity =
          beaconOpacity * emphasis * (child.userData.alphaScale ?? 1)
      }
    }
    if (stemRef.current) {
      const smat = stemRef.current.material as THREE.MeshBasicMaterial
      smat.opacity = beaconOpacity * 0.85
      stemRef.current.visible = beaconOpacity > 0.02
    }
    if (ringRef.current) {
      // Selection halo is a *locator* for the open district — useful from
      // orbit, but up close (surface view) it would fill the screen and sit
      // on top of the models, so it fades out with the same proximity ramp as
      // the beacon dot.
      const haloOpacity = 0.85 * limb * proximity
      ringRef.current.visible = selected && haloOpacity > 0.02
      ringRef.current.lookAt(camera.position)
      const t = performance.now() * 0.003
      ringRef.current.scale.setScalar(1 + Math.sin(t) * 0.1)
      const rmat = ringRef.current.material as THREE.MeshBasicMaterial
      rmat.opacity = haloOpacity
    }
  })

  const stemMid = base.clone().lerp(tip, 0.5)
  const stemLen = base.distanceTo(tip)
  const stemQuat = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ndir.clone().normalize())
    return q
  }, [ndir])

  // The tether carries a per-vertex alpha ramp: solid where it meets the
  // reticle, dissolving as it descends so it never draws a hard line across
  // the hardware it points at. Baking the ramp into the geometry keeps the
  // material a plain MeshBasicMaterial — a vec4 color attribute is enough,
  // no custom shader. Normal blending (not additive) so the accent color stays
  // readable over bright regolith as well as against black sky.
  const stemGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(
      STEM_RADIUS,
      STEM_RADIUS * 2.2, // flares slightly where it meets the ground
      stemLen,
      8,
      1,
      true // open-ended: caps would show as bright discs end-on
    )
    const pos = g.attributes.position
    const rgba = new Float32Array(pos.count * 4)
    for (let i = 0; i < pos.count; i++) {
      // Local y runs -len/2 (ground) to +len/2 (reticle).
      const f = THREE.MathUtils.clamp(pos.getY(i) / stemLen + 0.5, 0, 1)
      rgba[i * 4] = 1
      rgba[i * 4 + 1] = 1
      rgba[i * 4 + 2] = 1
      rgba[i * 4 + 3] = Math.pow(f, 2.6)
    }
    g.setAttribute('color', new THREE.BufferAttribute(rgba, 4))
    return g
  }, [stemLen])
  useEffect(() => () => stemGeo.dispose(), [stemGeo])

  return (
    <group ref={groupRef}>
      {/* Tether — hairline, fading out toward the ground (see stemGeo) */}
      <mesh
        ref={stemRef}
        geometry={stemGeo}
        position={stemMid}
        quaternion={stemQuat}
      >
        <meshBasicMaterial
          color={color}
          vertexColors
          transparent
          opacity={style.opacity * 0.85}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Selection halo — billboarded, always drawn on top */}
      <mesh ref={ringRef} position={tip} visible={false} renderOrder={10}>
        <ringGeometry args={[HEAD_RADIUS * 1.5, HEAD_RADIUS * 1.62, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Reticle: a thin ring around a small core, billboarded to the camera.
          Flat rings read as precision instrumentation at any distance, where a
          shaded sphere just reads as a ball of plastic. Depth-TESTED, so a
          beacon behind the Starship is correctly hidden by it — only the
          selection halo above is allowed to draw through geometry. */}
      <group ref={headRef} position={tip}>
        <mesh userData={{ alphaScale: 0.9 }}>
          <ringGeometry args={[HEAD_RADIUS * 0.84, HEAD_RADIUS, 64]} />
          <meshBasicMaterial
            color={color}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh userData={{ alphaScale: 1 }}>
          <circleGeometry args={[HEAD_RADIUS * 0.3, 24]} />
          <meshBasicMaterial
            color={color}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Generous invisible hit target around the dot — the beacon itself is
          only a few pixels from orbit, far too small to click reliably. */}
      <mesh
        position={tip}
        onClick={(e) => {
          e.stopPropagation()
          onSelect?.()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover?.(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          onHover?.(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <sphereGeometry args={[HEAD_RADIUS * 4, 8, 8]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>

      {/* Hover / selected label — fixed on-screen size */}
      {(hovered || selected) && (
        <Html
          position={tip}
          center
          zIndexRange={[30, 0]}
          style={{ pointerEvents: 'none' }}
        >
          {/* Lifted clear of the reticle and its selection halo, which are
              centered on this same point. */}
          <div className="-translate-y-10 whitespace-nowrap rounded border border-white/15 bg-black/75 px-1.5 py-0.5 text-center text-[10px] font-medium leading-tight text-white shadow-md backdrop-blur-sm">
            {label}
          </div>
        </Html>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// A race district: every competitor, plus the one pin that names the race
// ---------------------------------------------------------------------------

// A district is as visible as its most-visible member at the current timeline
// year — it appears when the first member program appears. Shared with the road
// network, which has to appear and fade on exactly the same schedule as the
// districts it serves.
export function siteOpacity(
  tree: TechTree,
  getProjectStyle?: (project: Project) => MarkerStyle
) {
  let opacity = 0
  for (const p of tree.projects) {
    const s = getProjectStyle?.(p) ?? { opacity: 1, visible: true }
    if (s.visible) opacity = Math.max(opacity, s.opacity)
  }
  return opacity
}

export default function MarkerLayer({
  trees,
  organizations,
  layout,
  selectedTreeCategory,
  selectedProject,
  hoveredCategory,
  onSelectTree,
  onSelectProject,
  onHoverTree,
  getProjectStyle,
  radiusAt,
}: MarkerLayerProps) {
  const orgMap = useMemo(() => {
    const m = new Map<string, Organization>()
    for (const o of organizations) m.set(o.id, o)
    return m
  }, [organizations])

  const raceOpen = Boolean(selectedTreeCategory)

  return (
    <group>
      {trees.map((tree) => {
        const districtDir = layout.districts.get(tree.category)
        if (!districtDir) return null
        const members = rankedMembers(tree)
        if (!members.length) return null

        const districtOpacity = siteOpacity(tree, getProjectStyle)
        if (districtOpacity <= 0) return null

        const leader = members[0]
        const leaderOrg = orgMap.get(leader.orgId)
        const color = orgColor(leaderOrg)
        const isOpen = selectedTreeCategory === tree.category
        const dim = raceOpen && !isOpen ? DIM_FACTOR : 1

        const count = members.length
        const label =
          tree.goal && leaderOrg
            ? `${PROJECT_TYPE_LABEL[tree.category]} · ${leaderOrg.name} leading`
            : `${PROJECT_TYPE_LABEL[tree.category]} · ${count} ${
                tree.goal ? 'competitor' : 'project'
              }${count === 1 ? '' : 's'}`

        // The pin has to clear the tallest thing on the lot, not the average.
        const tallestM = Math.max(...members.map((p) => projectSizeM(p)))
        // The whole field drives, if this race's hardware is vehicles. Spread
        // evenly round the circuit rather than sent out as a convoy: three rovers
        // nose to tail is one moving object, where a third of a lap apart puts
        // traffic somewhere in the city whichever way the camera is pointing.
        const patrol = PATROL[tree.category]

        return (
          <group key={tree.category}>
            {members.map((project, i) => {
              const plot = layout.plots.get(project.id)
              if (!plot) return null
              const style = getProjectStyle?.(project) ?? {
                opacity: 1,
                visible: true,
              }
              if (!style.visible) return null
              const org = orgMap.get(project.orgId)
              return (
                <CompetitorPlot
                  key={project.id}
                  project={project}
                  slot={plot.slot}
                  dir={plot.dir}
                  standDir={plot.standDir}
                  accent={orgColor(org)}
                  opacity={style.opacity}
                  dim={dim}
                  patrol={patrol}
                  patrolPhase={(i / count) * Math.PI * 2}
                  raceOpen={isOpen}
                  called={selectedProject?.id === project.id}
                  onSelect={() => onSelectProject?.(project.id)}
                  onHover={(h) => onHoverTree?.(h ? tree.category : null)}
                  radiusAt={radiusAt}
                />
              )
            })}

            {tree.category === 'rover' && (
              <>
                <RoverDepotSite
                  accent={color}
                  dim={dim}
                  opacity={districtOpacity}
                  radiusAt={radiusAt}
                />
                <RoverGasStationSite
                  accent={color}
                  dim={dim}
                  opacity={districtOpacity}
                  radiusAt={radiusAt}
                />
              </>
            )}

            <DistrictBeacon
              dir={districtDir}
              color={color}
              label={label}
              pinModelSizeM={tallestM}
              selected={isOpen}
              hovered={hoveredCategory === tree.category}
              style={{ opacity: districtOpacity * dim, visible: true }}
              onSelect={() => onSelectTree?.(tree.category)}
              onHover={(h) => onHoverTree?.(h ? tree.category : null)}
              radiusAt={radiusAt}
            />
          </group>
        )
      })}

      <InterDistrictFiller radiusAt={radiusAt} />
    </group>
  )
}
