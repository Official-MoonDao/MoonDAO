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
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  BASE_PLAN,
  BRANCH_TAIL_M,
  PATROL,
  ROAD_HALF_M,
  ROAD_RUNS,
  SETBACK_M,
  SPINE_BEARING_DEG,
  SPINE_END_M,
  SPINE_START_M,
  at,
  districtAlongM,
  onRoad,
  shuttleAt,
  shuttleLapM,
  spineCoords,
  withinDistrictGround,
  type ShuttleRun,
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
  capLocalDirection,
  capOffsetLatLon,
} from '@/lib/lunar-atlas/southpole'
import { buriedSite, vaultAxis } from '@/lib/lunar-atlas/subplan'
import {
  MASS_DRIVER_ID,
  trackAxis,
  trackBentOffsets,
} from '@/lib/lunar-atlas/trackplan'
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
  Excavator,
  GAS_STATION_HALF_D,
  GAS_STATION_HALF_W,
  gradedDeckRadiusM,
  projectSizeM,
  RoverDepotYard,
  RoverGasStation,
  SparePartsPallet,
  StreetLight,
  SurfaceAnchor,
  UndergroundConstructionSite,
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

// Scratch quaternion for the shuttle's per-frame rotation, so driving the fleet
// allocates nothing.
const TURN = new THREE.Quaternion()

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
  // Strips the map furniture — beacons, tethers, every floating name — and
  // leaves only what would actually be standing on the Moon. This layer is a
  // MAP most of the time and the reticles are the point of it, but they are
  // also the one thing in the frame that could not exist, so a screenshot with
  // them in it can only ever read as a diagram of a base rather than as a base.
  cinematic?: boolean
  // How far along the timeline the base's built environment is, on the same
  // 0..1 scale as a marker's opacity. Drives the street furniture and the vault
  // dig, which belong to no single race but cannot precede all of them.
  infraPresence?: number
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
  cinematic,
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
  // The run to drive and how fast, for a race whose hardware drives rather than
  // stands. Taken straight from PATROL rather than rebuilt per render, because
  // it keys the seating memos below and a fresh object each render would have
  // them resample the terrain for nothing.
  patrol?: ShuttleRun
  // Fraction of one out-and-back this vehicle starts at, which is what keeps a
  // whole depot's worth of them off each other.
  patrolPhase?: number
  // Whether this plot's own race is the open one. Names every asset on the lot,
  // and brings the driving ones to a stand so they can be read.
  raceOpen: boolean
  // Picked out specifically — hovered, or chosen from the competitor list.
  called: boolean
  onSelect?: () => void
  onHover?: (hovered: boolean) => void
  radiusAt?: RadiusAt | null
  // See MarkerLayerProps. Suppresses this plot's name card.
  cinematic?: boolean
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
    const { east, north } = shuttleAt(
      patrol,
      (patrolPhase ?? 0) * shuttleLapM(patrol)
    )
    const ll = capOffsetLatLon(east, north)
    return latLonToVector3(ll.lat, ll.lon, 1)
  }, [standDir, dir, patrol, patrolPhase])

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

  // A buried habitat's vault runs along a KNOWN bearing rather than on the
  // base's camera-facing heading, because the cutaway camera has to stand at one
  // end of it (see vaultAxis, and `sub` in flyToProject). Read off the plot's
  // own slot so the model and the camera derive the axis from one value.
  const vaultAlong = useMemo(
    () => (buriedSite(project.id) ? vaultAxis(slot) : undefined),
    [project.id, slot]
  )

  // The mass driver needs two things no other competitor does, both because it
  // is the only asset that is long rather than compact.
  //
  // Its AXIS is a fixed compass heading rather than the base's camera-facing
  // one, chosen for the ground it has to stay level over (see trackplan) — the
  // same reason a buried vault gets its axis handed down rather than derived.
  //
  // And it needs the GROUND UNDER EVERY BENT, not just under its own anchor.
  // One seat radius is a fair description of where a 10 m reactor stands and a
  // useless one for a 600 m trestle: the far end is 10 m below the near end, so
  // a model built to a single sampled height has to either bury one end or hang
  // the other in the air. This layer is the only one holding the terrain
  // sampler, so the sampling happens here and the model is told the answer.
  const track = useMemo(() => {
    if (project.id !== MASS_DRIVER_ID) return null
    const along = trackAxis()
    if (!radiusAt) return { along, ground: undefined }
    const ground = trackBentOffsets(slot).map((o) => {
      const ll = capOffsetLatLon(o.east, o.north)
      // Scene units back to meters, relative to the seat this model is placed
      // at — which is the frame the model authors its own geometry in.
      return (radiusAt(ll.lat, ll.lon) - seatRadius) / M_TO_UNITS
    })
    return { along, ground }
  }, [project.id, slot, radiusAt, seatRadius])

  // Runs of the spine, for a race whose hardware drives rather than stands (see
  // PATROL). Out to the far end and back, forever.
  //
  // Still a rigid rotation of the vehicle about the globe centre, which is what
  // keeps it cheap and correct: a rotation holds the vehicle at exactly the
  // radius it started from and carries its seating and its heading with it, so
  // neither is recomputed per frame. What changes on a spine is that the
  // rotation can no longer be one angle about one fixed axis — a lap of a circle
  // was, a triangle wave along a line is not — so it is solved each frame as the
  // shortest rotation from where the vehicle was MOUNTED to where it has driven
  // to. Over 680 m on a 1737 km sphere that is 0.02 degrees of arc, so the twist
  // it also imparts is far below anything visible.
  //
  // A whole fleet still shares the road safely. Every vehicle covers the same
  // distance at the same rate, so the gaps the phases opened up are held for
  // good — but unlike a lap, vehicles on opposite legs now close on each other
  // head on, which is what `acrossM` is for: they pass on opposite sides.
  // The outbound direction of the spine, in world space. The nose is mounted on
  // it and the frame loop below turns the vehicle round from there, so this is
  // one fixed axis for the whole fleet rather than a per-vehicle heading.
  const driveAlong = useMemo(
    () => (patrol ? capLocalDirection(SPINE_BEARING_DEG, 0) : undefined),
    [patrol]
  )

  const distRef = useRef(0)
  const throttleRef = useRef(0)
  // +1 driving northeast, -1 coming back. Eased rather than switched, so the
  // turn at each end swings round over a few meters instead of the vehicle
  // snapping to face the other way on one frame. Seeded from the leg this
  // vehicle actually starts on, so a fleet spread over both legs doesn't spend
  // its first second turning around on the spot.
  const headingRef = useRef(
    patrol &&
      !shuttleAt(patrol, (patrolPhase ?? 0) * shuttleLapM(patrol)).outbound
      ? -1
      : 1
  )

  useFrame((_, delta) => {
    const g = groupRef.current
    if (!g || !patrol) return
    // Roll to a stand where it IS when this race is opened — the vehicle sits
    // still while the user reads about it, but stays put on the road rather than
    // teleporting back to a start line. The camera comes to the vehicle instead
    // (see LIVE_PATROL_DIR, published below, and the page's flyToProject).
    const throttle = raceOpen ? 0 : 1
    const ease = 1 - Math.pow(PATROL_EASE, delta)
    throttleRef.current += (throttle - throttleRef.current) * ease
    distRef.current += patrol.speedMps * throttleRef.current * delta

    const pos = shuttleAt(
      patrol,
      (patrolPhase ?? 0) * shuttleLapM(patrol) + distRef.current
    )
    headingRef.current += ((pos.outbound ? 1 : -1) - headingRef.current) * ease

    const ll = capOffsetLatLon(pos.east, pos.north)
    const p = new THREE.Vector3(
      ...latLonToVector3(ll.lat, ll.lon, 1)
    ).normalize()
    // Carry the vehicle from where it was mounted to where it has driven to,
    // then spin it about its own local up by however far round the turn it is.
    // A rotation about `p` fixes `p`, so the spin moves the nose without moving
    // the vehicle.
    g.quaternion
      .setFromAxisAngle(p, (Math.PI * (1 - headingRef.current)) / 2)
      .multiply(TURN.setFromUnitVectors(ndir, p))
    // Published so a drill-in can find it on the road, and reused just below to
    // ride the road's rise and fall.
    LIVE_PATROL_DIR.set(project.id, [p.x, p.y, p.z])
    // Every child is positioned in world space from the globe centre, so a
    // uniform scale IS a radial offset: the ratio of ground radii lifts the
    // vehicle by the height difference. The shape distortion is that same ratio
    // — about a part in a million for a couple of meters of relief against a
    // 1737 km radius.
    if (radiusAt) {
      g.scale.setScalar(radiusAt(ll.lat, ll.lon) / seatRadius)
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
        noseAlong={driveAlong ?? vaultAlong ?? track?.along}
        dim={dim}
        onSelect={onSelect}
        onHover={(id) => onHover?.(Boolean(id))}
        surfaceRadius={seatRadius}
        trackGround={track?.ground}
      />

      {/* The asset's own name. Shown on hover, and for the whole field while
          its race is open — which is how you tell three reactors apart. */}
      {(called || raceOpen) && !cinematic && (
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
// streets it fronts. The rover race has no plots standing: its whole field is
// out shuttling the spine (see PATROL), so the crossing where its branch meets
// the spine has nothing a per-project loop would ever draw there.
//
// `RoverDepotYard` and `RoverGasStation` (ProjectModel.tsx) are what stands
// there instead, and they take two of the crossing's four corners — the same
// lots, at the same frontage, a competitor would get. Neither can stand at the
// crossing itself: that point is on both roads at once, which is what put the
// apron under the pavement the first time this was tried.
//
// Both on the SAME side of the spine, facing each other across the depot's own
// branch, so the pair reads as two sides of one street rather than as two
// unrelated sheds on opposite verges. `BASE_PLAN.rover`'s `reach` is sized for
// these two rather than for the roster, which is the honest way round: at 2.3 m
// an LTV would only need a 13 m branch, and nothing in the roster ever parks.
const DEPOT_FOOTPRINT_R = 9 // half-diagonal of the yard's 13 x 10 m apron, with room to spare

// Half-diagonal of the gas station's own 10 x 8.8 m forecourt apron (see
// `GAS_STATION_HALF_W`/`GAS_STATION_HALF_D`), with room to spare — the same
// role `DEPOT_FOOTPRINT_R` plays for the yard.
const GAS_STATION_FOOTPRINT_R =
  Math.hypot(GAS_STATION_HALF_W, GAS_STATION_HALF_D) + 0.6

// A corner of the depot crossing, plus the point on the branch it should face.
//
// Flat now, and worth noticing how much: this used to be an arcsine swing and a
// radius solved against a circle, because the two roads a district
// fronted were a circle and a radial. A spine and a perpendicular branch are
// two straight lines, so the setback off each is just a distance, and the whole
// thing is one call to `at()`.
function depotCorner(
  footprintR: number,
  alongSign: 1 | -1
): { here: { east: number; north: number }; faces: { east: number; north: number } } {
  const plan = BASE_PLAN.rover!
  const front = ROAD_HALF_M + SETBACK_M + footprintR
  const alongM = districtAlongM(plan)
  return {
    here: at(alongM + alongSign * front, front),
    // Back on the branch's own centreline at the same offset off the spine, so
    // the facing direction runs purely ALONG the spine: the yard's aisle and the
    // station's forecourt each open onto the branch between them, which means
    // they open onto each other.
    faces: at(alongM, front),
  }
}

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
    // The northeast corner of the crossing; the station takes the southwest one.
    const { here, faces } = depotCorner(DEPOT_FOOTPRINT_R, 1)

    const ll = capOffsetLatLon(here.east, here.north)
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

    // The point on the branch it faces, so the yard's open (aisle) side looks
    // down the road it is served by rather than at an arbitrary camera-relative
    // default.
    const backLl = capOffsetLatLon(faces.east, faces.north)
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

// The rover district's recharge/propellant station: a second, freestanding
// piece of shared infrastructure, on the OPPOSITE side of the depot branch
// from `RoverDepotSite` — same setback off the spine, same setback off the
// branch, just the other sign, so the two face each other across the one
// straight road they both front rather than crowding one footprint.
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
    // The depot takes the northeast corner; this takes the southwest one, at
    // whatever setback ITS OWN (smaller) footprint needs.
    const { here, faces } = depotCorner(GAS_STATION_FOOTPRINT_R, -1)

    const ll = capOffsetLatLon(here.east, here.north)
    const d = new THREE.Vector3(
      ...latLonToVector3(ll.lat, ll.lon, 1)
    ).normalize()
    const ground = !radiusAt
      ? GLOBE_RADIUS
      : footprintSeatRadius(d, radiusAt, GAS_STATION_FOOTPRINT_R)

    // Face back toward the branch, same technique as RoverDepotSite — which,
    // since the two sit on opposite sides of it, points this station's own
    // forecourt entrance at the depot yard across the road rather than out
    // into open regolith.
    const backLl = capOffsetLatLon(faces.east, faces.north)
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
// neither a district nor a road: it's the open regolith either side of the
// spine, and the spine itself stitching the districts together. Left bare, that
// is most of what the camera actually sees on approach.
//
// A boulder field fills the open ground — native rock, not manifested cargo,
// so it belongs on unclaimed regolith in a way none of the logistics props in
// ProjectModel.tsx do — and street lights line the haul routes. Both are kept
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

// The ground a boulder can land on: a band running the length of the spine and
// a good way either side of it, sampled as a grid in the spine's own frame with
// per-cell jitter and a low keep-rate — which is what makes a grid read as
// scatter rather than as rows. Roads and district ground are skipped as the
// walk goes (see the filter below), so the band can simply cover the whole base
// instead of being an annulus threaded between two ring roads.
//
// Wider across than the base is (the landing zone's pads reach 70 m off the
// spine) and longer than the spine, so the scatter runs past the settlement in
// every direction rather than stopping at a boundary the eye can find.
const BOULDER_ALONG_MIN_M = SPINE_START_M - 60
const BOULDER_ALONG_MAX_M = SPINE_END_M + 60
const BOULDER_ACROSS_M = 150
const BOULDER_ALONG_STEPS = 34
const BOULDER_ACROSS_STEPS = 15
const BOULDER_KEEP_FRACTION = 0.34

// A post every ~40 m of pavement, just outside the windrow — close enough
// together to actually read as street lighting, far enough apart that 730 m of
// spine doesn't need dozens of them.
const STREET_LIGHT_SPACING_M = 40

// Roads narrower than this are left dark. A lit street is a street with traffic
// on it, and a rover track out to four relay masts has none — see `width` in
// baseplan.ts' Street, and the branches that ask for 0.72.
const LIT_ROAD_WIDTH = 1

// Staged cargo along the shoulders of every road — the manifested-cargo
// counterpart to the boulder field, for stretches of road with nothing to
// look at otherwise. Unlike the boulders (native rock, scattered anywhere on
// open ground) this stays close to a road on purpose: a crate stack or a
// cable reel reads as something a hauler dropped off, which only makes
// sense sitting where a hauler could actually reach it.
const ROADSIDE_SPACING_M = 30
const ROADSIDE_KEEP_PROB = 0.75
type RoadsideKind = 'crates' | 'cablereel' | 'parts' | 'bricks'

// A small grading/earthmoving fleet, parked hard against the shoulder of
// one of the roads — the same "close enough to a road that a
// hauler could reach it" logic as `roadsideCargo`, not the boulder field's
// wide-open annulus, since this is the settlement's own maintenance crew
// working the street it grades rather than native scatter. A handful of
// fixed units rather than a sampled grid: a dozen would read as a second
// race's roster, five to six reads as a crew mid-shift. Placed by walking a
// deterministic sequence of candidate (loop, bearing, side) triples — not a
// grid — until enough clear the road itself and every district's own
// ground, so a change to one district's `reach` can only ever shift where
// these land, never how many.
const EXCAVATOR_COUNT = 6
const EXCAVATOR_SHOULDER_MIN_M = 2.6
const EXCAVATOR_SHOULDER_MAX_M = 6.5

// Fixed spot for the base's own dig: at the far end of the habitat's own
// branch, past the last of its corner lots.
//
// It used to sit in the middle of the habitat district, which was possible
// because that district was a ring of five plots around an empty plaza. There
// is no plaza now — the middle of a crossing is the crossing — so the dig moves
// to the one place on this district that is both served by its road and not
// somebody's lot: the end of the branch, `BRANCH_TAIL_M` short of where the
// pavement stops. That is arguably where it belonged all along, since what this
// is digging is the vaults the buried habitats stand in, and a cut-and-cover
// excavation wants to be at the edge of a settlement rather than its centre.
//
// Offset off the branch's centreline by enough to clear the windrow, so the
// machine works beside its road rather than in it. The composite itself
// (ConstructionPit +
// its Excavator, both authored together in ProjectModel.tsx) is asymmetric —
// the machine stands off to one side of the pit, not scattered by angle like
// InterDistrictFiller's ambient fleet — but SurfaceAnchor's default facing
// (no `noseAlong` given here) turns that whole composite toward the home
// camera on its own, the same as any other un-steered installation, so this
// only ever needs to pick a location, never an orientation.
const UGC_SITE = at(
  districtAlongM(BASE_PLAN.habitat!) - (ROAD_HALF_M + 8),
  (BASE_PLAN.habitat!.reach ?? 0) + BRANCH_TAIL_M - 4
)
const UGC_EAST_M = UGC_SITE.east
const UGC_NORTH_M = UGC_SITE.north
// Clears the arm's own highest hoisted point (see EXC_DIG_POSES' "hoist"
// keyframe) rather than the machine's parked height, so the label never
// clips through the boom mid-cycle.
const UGC_LABEL_HEIGHT_M = 6.5
// SEAT_LIFT is sized to clear z-fighting for a single point sample against
// the rendered (displaced) terrain, but this whole composite spans a good
// 13 m from the pit's own anchor out past the excavator standing off it —
// far wider than the compact, single-point props (a boulder, a streetlight)
// SEAT_LIFT was tuned against. Anywhere the real terrain's own slope across
// that span puts ground even a little above the flat-plane height sampled at
// the anchor's one point eats into that margin, and with this renderer's
// logarithmic depth buffer (needed for a scene that spans orbit-to-meter
// scale) precision loss shows up as shimmer/dropout well before it would on
// a linear buffer — see the ground-level flat pit floor in ProjectModel.tsx
// for the other half of this fix. A flat extra lift on top of SEAT_LIFT,
// well past anything that stretch of ridge terrain plausibly slopes, buys
// back that margin.
const UGC_EXTRA_LIFT_M = 0.6

function UndergroundConstructionSiteMarker({
  radiusAt,
  cinematic,
  presence = 1,
}: {
  radiusAt?: RadiusAt | null
  // See MarkerLayerProps. The dig itself stays — it's real hardware doing real
  // work — but its caption goes, like every other floating name.
  cinematic?: boolean
  // Fades with the construction fleet: this is that fleet at work, so it cannot
  // be digging the vault years before anything that could dig it is on the Moon.
  presence?: number
}) {
  // The caption is shown on hover only, like every other name on the base (see
  // CompetitorPlot). It used to be permanent, which made it the one label in
  // the scene that was always up: a card floating over the middle of the base
  // at fixed screen size whatever the camera was doing, and — since it is
  // pinned above the tallest thing here — one that sat over the habitats behind
  // it from most angles.
  const [hovered, setHovered] = useState(false)

  const { dir, seat, labelAt } = useMemo(() => {
    const ll = capOffsetLatLon(UGC_EAST_M, UGC_NORTH_M)
    const d = latLonToVector3(ll.lat, ll.lon, 1)
    const seat =
      (radiusAt ? radiusAt(ll.lat, ll.lon) : GLOBE_RADIUS) +
      SEAT_LIFT +
      UGC_EXTRA_LIFT_M * M_TO_UNITS
    const labelAt = new THREE.Vector3(...d).multiplyScalar(
      seat + UGC_LABEL_HEIGHT_M * M_TO_UNITS
    )
    return { dir: d, seat, labelAt }
  }, [radiusAt])

  // Nothing is digging the vault until the fleet that digs it is here.
  if (presence <= MODEL_PRESENCE) return null

  return (
    <>
      {/* Hover handled here rather than through SurfaceAnchor's own
          `interactive` flag, which is all-or-nothing: that flag also swallows
          the click and switches the cursor to a pointer, and this is a piece of
          scenery with nothing to open — a dead click on it would stop the
          background click that deselects and zooms back out. Pointer events
          from the meshes inside bubble up to this group either way. */}
      <group
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          setHovered(false)
        }}
      >
        <SurfaceAnchor
          dir={dir}
          surfaceRadius={seat}
          scale={M_TO_UNITS}
          dim={presence}
          castShadows={false}
          interactive={false}
        >
          <UndergroundConstructionSite seed={4021} />
        </SurfaceAnchor>
      </group>
      {hovered && !cinematic && (
        <Html
          position={labelAt}
          center
          zIndexRange={[15, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="whitespace-nowrap rounded border border-white/15 bg-black/75 px-1.5 py-0.5 text-center text-[9px] font-medium leading-tight text-white shadow-md backdrop-blur-sm">
            Underground base construction
          </div>
        </Html>
      )}
    </>
  )
}

// Everything between the districts: the boulder field, and the street furniture
// that accumulates around a base once there is a base. The boulders were on this
// ridge for three billion years and stay at full strength whatever year the
// scrubber is on; the lights, the roadside cargo and the parked excavators are
// hardware, and they fade with the rest of the built environment. Showing lit
// streets and idle diggers in a year whose Moon holds a single dead lander is
// exactly as wrong as standing a habitat there.
function InterDistrictFiller({
  radiusAt,
  presence = 1,
}: {
  radiusAt?: RadiusAt | null
  presence?: number
}) {
  // Same threshold the competitors' own models use: below it the furniture is
  // gone rather than faint, because a ghost street light is still a street
  // light standing on a Moon that has none.
  const built = presence > MODEL_PRESENCE
  const boulders = useMemo(() => {
    const out: { dir: Vec3; seat: number; size: number; seed: number }[] = []
    for (let ai = 0; ai < BOULDER_ALONG_STEPS; ai++) {
      for (let ci = 0; ci < BOULDER_ACROSS_STEPS; ci++) {
        const k = ai * 977 + ci * 31 + 1
        if (hash1(k) > BOULDER_KEEP_FRACTION) continue
        const alongM =
          BOULDER_ALONG_MIN_M +
          ((ai + hash1(k + 1)) / BOULDER_ALONG_STEPS) *
            (BOULDER_ALONG_MAX_M - BOULDER_ALONG_MIN_M)
        const acrossM =
          -BOULDER_ACROSS_M +
          ((ci + hash1(k + 2)) / BOULDER_ACROSS_STEPS) * BOULDER_ACROSS_M * 2
        const { east, north } = at(alongM, acrossM)
        if (onRoad(east, north) || withinDistrictGround(east, north, 20)) {
          continue
        }
        const ll = capOffsetLatLon(east, north)
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
    if (!built) return out
    // A fine step walked along each lit road, placing a light once
    // STREET_LIGHT_SPACING_M of pavement has accumulated since the last one and
    // skipping any candidate over a district's own ground. A fixed COUNT of
    // evenly-spaced stations was tried first and aliased badly: with as many
    // districts as stations, nearly every station landed on a district by
    // coincidence and only one light survived. Walking and accumulating
    // distance instead means a district just delays the next light rather than
    // deleting a whole station, so no road is left with a long dark stretch
    // merely because a station happened to land badly.
    //
    // Posts alternate sides as the walk goes, which a ring road could not do:
    // its two flanks were an inner and an outer circle of different lengths.
    // On a straight road they are the same road, so a single walk lights both
    // verges and the spine gets a post every 20 m of its length rather than
    // every 40.
    const STEP_M = 2
    for (const run of ROAD_RUNS) {
      if (run.width < LIT_ROAD_WIDTH) continue
      let placed = 0
      let lastAt: number | null = null
      for (let d = 0; d < run.lengthM; d += STEP_M) {
        if (lastAt !== null && d - lastAt < STREET_LIGHT_SPACING_M) continue
        const side = placed % 2 ? -1 : 1
        const post = run.at(d, side * (ROAD_HALF_M + 1.4))
        // A narrower margin than the boulders': a thin post just needs to clear
        // a district's own ground, not stand well back from it, so lights still
        // line the road right up to each district's crossing.
        if (withinDistrictGround(post.east, post.north, 11)) continue
        lastAt = d
        placed++

        const ll = capOffsetLatLon(post.east, post.north)
        const dv = new THREE.Vector3(
          ...latLonToVector3(ll.lat, ll.lon, 1)
        ).normalize()
        const seat = radiusAt
          ? radiusAt(ll.lat, ll.lon) + SEAT_LIFT
          : GLOBE_RADIUS + SEAT_LIFT
        // The boom leans toward this road's own centreline, so every light's
        // fixture faces the pavement it actually lights.
        const inner = run.at(d, 0)
        const innerLl = capOffsetLatLon(inner.east, inner.north)
        const innerDir = new THREE.Vector3(
          ...latLonToVector3(innerLl.lat, innerLl.lon, 1)
        )
        const noseAlong = innerDir.sub(dv).normalize().toArray() as Vec3
        out.push({ dir: [dv.x, dv.y, dv.z] as Vec3, seat, noseAlong })
      }
    }
    return out
  }, [radiusAt, built])

  const roadsideCargo = useMemo(() => {
    const out: {
      dir: Vec3
      seat: number
      kind: RoadsideKind
      seed: number
      yaw: number
    }[] = []
    if (!built) return out
    const STEP_M = 2
    ROAD_RUNS.forEach((run, ri) => {
      let lastAt: number | null = null
      for (let d = 0; d < run.lengthM; d += STEP_M) {
        if (lastAt !== null && d - lastAt < ROADSIDE_SPACING_M) continue
        // Alternate shoulders rather than always the same one, so both verges
        // pick up traffic. Offset starts further out than the street lights'
        // own fixed band (ROAD_HALF_M + 1.4) so a crate cluster can never land
        // close enough to clip one.
        const seed = ri * 4001 + d * 13 + 7
        const side = hash1(seed + 1) > 0.5 ? 1 : -1
        const spot = run.at(
          d,
          side * (ROAD_HALF_M + 3.2 + hash1(seed + 2) * 3)
        )
        if (
          onRoad(spot.east, spot.north) ||
          withinDistrictGround(spot.east, spot.north, 8)
        ) {
          continue
        }
        // Advance the walk past this slot regardless of whether it renders
        // anything below — that's what keeps the spacing organic (some
        // slots come up empty) rather than every eligible slot filling.
        lastAt = d
        if (hash1(seed) > ROADSIDE_KEEP_PROB) continue

        const roll = hash1(seed + 1)
        const kind: RoadsideKind =
          roll < 0.4
            ? 'crates'
            : roll < 0.65
            ? 'cablereel'
            : roll < 0.85
            ? 'parts'
            : 'bricks'
        const ll = capOffsetLatLon(spot.east, spot.north)
        const dir = latLonToVector3(ll.lat, ll.lon, 1)
        const seat = radiusAt
          ? radiusAt(ll.lat, ll.lon) + SEAT_LIFT
          : GLOBE_RADIUS + SEAT_LIFT
        out.push({
          dir,
          seat,
          kind,
          seed,
          yaw: hash1(seed + 2) * Math.PI * 2,
        })
      }
    })
    return out
  }, [radiusAt, built])

  const excavators = useMemo(() => {
    const out: { dir: Vec3; seat: number; noseAlong: Vec3; seed: number }[] = []
    if (!built) return out
    let placed = 0
    for (let tries = 0; placed < EXCAVATOR_COUNT && tries < 400; tries++) {
      const k = tries * 733 + 5501
      const run = ROAD_RUNS[Math.floor(hash1(k) * ROAD_RUNS.length)]
      const d = hash1(k + 1) * run.lengthM
      const side = hash1(k + 2) > 0.5 ? 1 : -1
      const shoulder =
        EXCAVATOR_SHOULDER_MIN_M +
        hash1(k + 3) * (EXCAVATOR_SHOULDER_MAX_M - EXCAVATOR_SHOULDER_MIN_M)
      const spot = run.at(d, side * (ROAD_HALF_M + shoulder))
      // A narrower margin than the boulders' (which stand well clear of
      // every district): this fleet works right up against a district's
      // own edge, not out in open regolith.
      if (
        onRoad(spot.east, spot.north) ||
        withinDistrictGround(spot.east, spot.north, 9)
      ) {
        continue
      }
      const ll = capOffsetLatLon(spot.east, spot.north)
      const dir = latLonToVector3(ll.lat, ll.lon, 1)
      const seat = radiusAt
        ? radiusAt(ll.lat, ll.lon) + SEAT_LIFT
        : GLOBE_RADIUS + SEAT_LIFT
      // Nose along the road's own direction (a point a few meters further down
      // the same run), the same "sample a neighbouring point on the base plane
      // and subtract" trick `lights` uses for its boom heading — a grader
      // actually working the shoulder sits lengthwise along the road, not at a
      // random angle to it. Which way down the road is picked per-instance so a
      // run of them doesn't all face the same direction.
      const ahead = run.at(d + 4, side * (ROAD_HALF_M + shoulder))
      const llAhead = capOffsetLatLon(ahead.east, ahead.north)
      const dTangent = new THREE.Vector3(
        ...latLonToVector3(llAhead.lat, llAhead.lon, 1)
      )
      const dVec = new THREE.Vector3(...dir)
      const flip = hash1(k + 4) > 0.5 ? 1 : -1
      const noseAlong = dTangent
        .sub(dVec)
        .multiplyScalar(flip)
        .normalize()
        .toArray() as Vec3
      out.push({ dir, seat, noseAlong, seed: k })
      placed++
    }
    return out
  }, [radiusAt, built])

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
          dim={presence}
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
          dim={presence}
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
      {excavators.map((e, i) => (
        <SurfaceAnchor
          key={`excavator:${i}`}
          dir={e.dir}
          surfaceRadius={e.seat}
          scale={M_TO_UNITS}
          noseAlong={e.noseAlong}
          dim={presence}
          castShadows={false}
          interactive={false}
        >
          <Excavator seed={e.seed} />
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
  cinematic,
  infraPresence = 1,
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
        // evenly along the run rather than sent out as a convoy: three rovers
        // nose to tail is one moving object, where a third of a run apart puts
        // traffic somewhere on the street whichever way the camera is pointing.
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
                  patrolPhase={i / count}
                  raceOpen={isOpen}
                  called={selectedProject?.id === project.id}
                  onSelect={() => onSelectProject?.(project.id)}
                  onHover={(h) => onHoverTree?.(h ? tree.category : null)}
                  radiusAt={radiusAt}
                  cinematic={cinematic}
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

            {/* Dropped entirely rather than made invisible: the beacon owns
                this district's oversized click target (see its hit sphere), and
                leaving that behind would have a base with no visible markers
                still turning the cursor to a pointer over empty sky. In
                cinematic mode the hardware itself is the only thing to click. */}
            {!cinematic && (
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
            )}
          </group>
        )
      })}

      <InterDistrictFiller radiusAt={radiusAt} presence={infraPresence} />
      <UndergroundConstructionSiteMarker
        radiusAt={radiusAt}
        cinematic={cinematic}
        presence={infraPresence}
      />
    </group>
  )
}
