// On-surface 3D model for a project. If the project supplies a `modelURI` (GLB),
// it's loaded via drei useGLTF and normalized (centered, scaled, seated on the
// ground) with the project's optional ModelTransform; while it loads or if it
// fails, a detailed procedural stand-in for the project type is shown. When no
// modelURI is given, the procedural model is used directly. Everything is
// oriented so its "up" is the local surface normal and seated at the surface.
//
// The procedural installations are intentionally detailed — modules with
// airlocks and lit windows, solar farms, radiators, landing gear, rovers with
// rocker-bogie wheels, ISRU tanks and piping — so that drilling into a project
// reveals a legible little outpost rather than a blob.

import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import {
  ComponentType,
  ReactNode,
  RefObject,
  Suspense,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { solarArrayFrame } from '@/lib/lunar-atlas/baseplan'
import { HOME_CAM, HOME_TARGET } from '@/lib/lunar-atlas/homeview'
import { M_TO_UNITS } from '@/lib/lunar-atlas/southpole'
import { buriedVault, type VaultGeometry } from '@/lib/lunar-atlas/subplan'
import { GLOBE_RADIUS } from '@/lib/lunar-atlas/textures'
import {
  BREACH_LOT_RADIUS_M,
  MASS_DRIVER_ID,
  TRACK_LENGTH_M,
  bentLegs,
  trackBentStations,
  trackDeckY,
} from '@/lib/lunar-atlas/trackplan'
import type { ModelTransform, Project, ProjectType } from '@/lib/lunar-atlas/types'
import type { Vec3 } from '@/lib/lunar-atlas/geo'

// Fallback seat while the height maps decode (ridge heights are within
// ±0.12% of the sphere radius, so the sphere itself is a fine placeholder).
const SURFACE = GLOBE_RADIUS
// Every model (GLB or procedural) is normalized so its largest dimension is
// ~this many local units; dividing a real size by it gives the world scale.
const UNIT_MAX_DIM = 1.7

// TRUE SCALE: each installation renders at its real-world size on the 16 km
// ridge patch. Sizes are the largest dimension in meters — public figures
// where they exist, honest estimates otherwise. Per-project entries override
// the per-type defaults (a Starship is not the same size as a Blue Moon).
const TYPE_SIZE_M: Partial<Record<ProjectType, number>> = {
  // A single pressurized module end to end, ISS-element class — the generic
  // fallback for a habitat with no model of its own. The full camp (see
  // CAMP_M) and the ILRS cluster are authored to their own real sizes
  // instead; only projects on the generic model use this default.
  habitat: 11,
  lander: 16,
  rover: 4.5,
  // Reactor drum, shroud and a 17 m radiator run end to end. POWER_M below
  // inverts this exact number, so the plant is authored in real meters.
  power: 22,
  // Mirror field through radiator, end to end. ISRU_M inverts this exact
  // number, so the plant is authored in real meters.
  isru_plant: 19,
  // Apron ~13 m across with the printer gantry straddling its edge. SITE_M
  // below inverts this exact number, so the site is authored in real meters.
  construction: 14,
  // Dish rim to the far edge of the equipment skid. TERM_M below inverts this
  // exact number, so the terminal is authored in real meters.
  comms_pnt: 15,
  orbital: 20,
  // Breach to muzzle. A launcher able to reach lunar escape velocity runs for
  // kilometers, so this is still only its near segment — but the segment is now
  // authored at true 1:1 size, and its length lives in one place (trackplan)
  // because the layout tests and the terrain sampling need the same number.
  mass_driver: TRACK_LENGTH_M,
}
const PROJECT_SIZE_M: Record<string, number> = {
  'spacex-starship-hls': 52, // Ship upper stage ~50 m + gear
  // Dome-to-dome across the connector spine (see CAMP_M, which this exact
  // number inverts). Without an entry here `projectSizeM` fell back to
  // TYPE_SIZE_M.habitat (11 m, the generic single-module default) once
  // `crewed_base` merged into `habitat` and took its own type-level default
  // with it — SurfaceAnchor's outer scale (projectScale) and CrewedBase's
  // own inner CAMP_M scale are supposed to cancel out to true 1:1 size, and
  // with the wrong number feeding the outer one they no longer did: the
  // whole camp rendered at 11/38 of its real size instead.
  'nasa-artemis-base-camp': 38,
  'blue-origin-blue-moon-mk1': 8,
  // Footpad to nose tip — NASA's own Artemis III renders show a tall stack:
  // splayed legs, a windowed crew module with a deployable crew ladder, two
  // open lattice bays exposing the propellant tanks, then a smooth ascent
  // hull and nose. BM2_M inverts this exact number, so BlueMoonMk2 below is
  // authored in real meters (see the model for the per-stage breakdown).
  'blue-origin-blue-moon-mk2': 16,
  // No published footprint exists for ILRS — it is still concept renders, not
  // a frozen design. CNSA's own public roadmap has two horizons rather than
  // one: a single-mast "basic model" through 2035, then an "extended model"
  // in the 2040s the officials describe as "considerable scale and stable
  // operation," built around a second, orbiting hub. This model portrays that
  // extended state — five linked modules under the mast's fan, a redundant
  // comms tower and a fixed PV field on their own footings, still one cargo
  // stack short of finished — which is what makes it a real second
  // competitor for the habitat district rather than a construction footnote
  // next to Artemis Base Camp. Comms-tower guy-anchor to the PV field's far
  // corner is the widest span (see scripts/tmp-ilrs-check.ts). ILRS_M inverts
  // this exact number.
  ilrs: 21.9,
  // Bumper to array, roughly LTV class. RACER_M inverts this exact number, so
  // the rover is authored in real meters.
  'im-moon-racer': 4.6,
  // Light bar to rear wheel — Astrolab pitch FLEX as Jeep-sized. FLEX_M
  // inverts this exact number.
  'astrolab-flex': 4.2,
  // Bumper to tailgate. The longest of the three LTV bids, and it looks it —
  // cab forward, cargo aft. VOY_M inverts this exact number.
  'lunar-outpost-lunar-dawn': 4.4,
  // Toyota has pitched the Lunar Cruiser at roughly two microbuses. It leads
  // the habitat race, so the habitat site shows a vehicle rather than a module
  // — which is the point of it. CRUISER_M inverts this exact number.
  'jaxa-lunar-cruiser': 6.6,
  // Landing feet to the top of the radiator mast. The bus itself fits a 4 m
  // launch shroud; nearly everything above the collar is deployed on orbit or
  // on the surface, which is why it ends up the tallest thing on the base bar
  // the Starship. FSP_M inverts this exact number.
  'lockheed-fission-surface-power': 19,
  // Across the radiator canopy, which is wider than the unit is tall — the only
  // reactor here whose size is set by something horizontal. IXP_M inverts this
  // exact number.
  'ix-fission-surface-power': 13,
  // Berthing port to vestibule. Sierra quote LIFE at 8.2 m ACROSS, which is the
  // number that matters: it is twice the MPH's diameter out of the same launch
  // shroud, and that ratio is the entire argument for softgoods. LIFE_M inverts
  // this exact number.
  'sierra-space-life': 12,
  // Mast foot to the antenna head. ESA does not build south-pole ground
  // infrastructure the way the other three comms bids do — Moonlight is sold as
  // a SERVICE off a relay in orbit, and the "ground segment" a customer mission
  // actually needs is the small UHF/S-band user terminal SSTL ships with the
  // subscription, not an agency-built site. Deliberately the smallest lot in
  // the district, because that absence is the argument. PATH_TERM_M inverts
  // this exact number.
  'esa-lunar-pathfinder': 2.6,
  // Case front to the solar panel's trailing top corner once it's racked up
  // on its bracket — the single largest axis on the rebuilt ground terminal
  // (see ParsecTerminal). Smaller again than ESA's terminal, and for the same
  // reason taken one step further: a multi-satellite constellation means a
  // customer's terminal never has to track one specific node, only keep a
  // patch pointed at the sky, so there is no antenna gimbal to house, and the
  // whole package is sealed-case ground support equipment rather than a
  // built site. PSEC_TERM_M inverts this exact number. Confirmed against the
  // authored geometry with scripts/tmp-parsecterm-check.ts — the first pass
  // at this case measured a true 0.79 m and read as basically invisible next
  // to its neighbors, so it was scaled up 2.5x (proportions unchanged).
  'crescent-parsec': 2.0,
  // Ground to the dish's tilted apex — taller than it is wide, unlike the
  // other three comms terminals, because the dish rides gimballed straight
  // on the equipment box's lid rather than on its own ground mount (see
  // RTM_M). Bigger than ESA's and Crescent's customer terminals — IM operates
  // the network the other two subscribe to — but a fraction of the generic
  // CommsPnt lot Nokia still stands on. Confirmed against the authored
  // geometry with scripts/tmp-relayterm-check.ts.
  'im-near-space-network': 2.7,
  // Solar tracker's outboard corner to the far end of the product tanks —
  // see SCR_M. A packaged skid plant rather than IsruPlant's sprawling
  // field-plus-tower installation (19 m): Sierra already ran a full-scale
  // unit in a thermal-vacuum chamber at NASA Johnson, which is a
  // demonstrated near-term hardware story, not a concept spread across open
  // ground. Confirmed against the authored geometry with
  // scripts/tmp-carbothermal-check.ts.
  'sierra-space-carbothermal': 8.1,
  // Crucible foot to the power box's far edge — see MRE_M. Smaller again than
  // Sierra's skid: MRE trades Sierra's hopper-plus-condenser stack for one
  // riveted crucible, and trades a solar tracker for a busbar to the base
  // grid, so there is less standalone hardware to spread out. Confirmed
  // against the authored geometry with scripts/tmp-mre-check.ts.
  'lunar-resources-mre': 6.8,
}

// Real-world largest dimension (meters) of the model a project renders —
// also used by the marker layer to size beacon pins to their model.
export function projectSizeM(project: Project): number {
  return PROJECT_SIZE_M[project.id] ?? TYPE_SIZE_M[project.type] ?? 10
}

// World scale (scene units per local model unit) for a project's model.
export function projectScale(project: Project): number {
  return (projectSizeM(project) * M_TO_UNITS) / UNIT_MAX_DIM
}

// The radius, as a fraction of a model's size, of the rigid deck it brings
// with it. Only models with their own graded skirt appear here: they seat on
// the highest ground under that deck and let the skirt fall away over the
// downhill side. Everything else meets the ground directly beneath it, because
// taking a footprint maximum with nothing to hide the gap underneath is
// exactly the "slightly floating" look.
const GRADED_DECK_FRACTION: Partial<Record<ProjectType, number>> = {
  lander: 0.6, // the LandingPad deck and its blast wall
  // Just outside the printed deck and inside the apron's flare (see
  // ConstructionSite). A flat 11 m disc seated at its own center buries its
  // uphill edge on any slope worth the name.
  construction: 0.45,
}

// Radius in meters of the graded deck a model rests on, or null if it has none
// and must meet the ground directly beneath it.
export function gradedDeckRadiusM(project: Project): number | null {
  // A buried habitat is nothing BUT graded deck: its cover mound is 28 m of
  // placed regolith with a skirt bedded below grade all the way round, so it
  // seats on the high ground under its footprint and lets the skirt fall away
  // downhill — exactly the case this mechanism exists for, and the alternative
  // (seating a 28 m mound on the single point beneath its centre) buries its
  // uphill end on any slope at all.
  const vault = buriedVault(project.id)
  if (vault) return vault.footprintM
  const f = GRADED_DECK_FRACTION[project.type]
  return f === undefined ? null : projectSizeM(project) * f
}

// How much of a model's SIZE is actually its footprint on the ground. The
// default assumes the largest dimension is horizontal, which holds for most of
// these: a rover, a radiator run and a dish are all wider than they are tall.
// A model that is mostly mast is the exception, and it needs saying, because
// the district packer spaces plots by these radii — take a 19 m column's height
// for its footprint and it reserves a 38 m lot for a machine that stands on
// four feet, pushing its whole district outward for nothing.
const FOOTPRINT_FRACTION: Record<string, number> = {
  // Feet on the diagonals out to about 4 m; everything above the collar is
  // mast and radiator, which overhangs nothing it has to be spaced from.
  'lockheed-fission-surface-power': 0.21,
  // Guy anchors out to about 1 m; the rest of the 2.6 m is mast height, which
  // the packer should not be spacing a lot by.
  'esa-lunar-pathfinder': 0.4,
  // The opposite problem from the mast entries above: the 2.0 m size figure
  // is a front-to-back span, already mostly horizontal, but the panel's
  // corner reaches out diagonally (off both the case's long axis AND its
  // tilt) rather than straight down one of them — so the true radial reach
  // from center (1.49 m, scripts/tmp-parsecterm-check.ts) is well past what
  // the 0.5 default would reserve.
  'crescent-parsec': 0.76,
  // Most of the 2.7 m size figure is the dish's tilt height above the box,
  // not ground spread — the pallet footprint (RTM_BOX_L/W plus its lip) is
  // what actually has to sit clear of the neighboring plot.
  'im-near-space-network': 0.42,
  // Almost the whole 8.1 m size figure IS ground spread (the skid, tower,
  // hopper and tracker all stand well under the tower's own 4.2 m height),
  // but asymmetrically — the tracker sits off to one side on its own mast,
  // so the true radial reach from the plant's center (5.29 m,
  // scripts/tmp-carbothermal-check.ts) is well past the 0.5 default.
  'sierra-space-carbothermal': 0.66,
  // The crucible sits at the plant's own origin and everything else — tank,
  // power box, grid cable — strings out along +X from there rather than
  // spreading symmetrically, so almost the entire 6.8 m size figure IS the
  // radial reach from that origin (5.53 m, scripts/tmp-mre-check.ts), not
  // half of it.
  'lunar-resources-mre': 0.82,
  // The 21.9 m size figure is the span between two outlying pieces (a comms
  // guy anchor and the PV field's far corner), not a span through the mast
  // axis every asset stands on — so the true radial reach from that axis
  // (12.86 m, scripts/tmp-ilrs-check.ts) is well past the 0.5 default, though
  // not the whole figure the way MRE's single-origin plant is.
  ilrs: 0.587,
}

// Radius in meters of the ground a project occupies, for laying out plots that
// must not overlap. Where a model brings its own graded deck that deck IS the
// footprint — it is the part that has to sit on clear regolith.
export function footprintRadiusM(project: Project): number {
  // A buried habitat's footprint is its EARTHWORKS, not its module: the cover
  // mound reaches about twice as far as the can under it, and that reach is
  // already derived from the vault's own dimensions (see vaultGeometry). Taken
  // from there rather than through a FOOTPRINT_FRACTION entry so the number
  // cannot drift away from the mound the model layer actually draws.
  const vault = buriedVault(project.id)
  if (vault) return vault.footprintM
  // The mass driver is the one asset a DISC cannot describe: 600 m long and 6 m
  // wide, so the disc containing it is 300 m across and would reserve a quarter
  // of the base. Only its BREACH WORKS stand on a lot; the guideway runs out of
  // that lot into open regolith on a heading picked for the ground, and is
  // checked as a corridor instead (see trackplan, and the corridor test in
  // cypress/integration/unit/lunar-atlas-baseplan.cy.ts).
  //
  // This replaced a FOOTPRINT_FRACTION entry that had to be solved jointly with
  // the district's `turn` — 0.32 paired with 45 degrees — because the fraction
  // was standing in for "how much of a 105 m model swings where". Nothing has to
  // be co-solved now: the lot is sized to the hardware that is actually on it,
  // and the track's direction is set by trackplan rather than by whatever angle
  // happened to miss both roads.
  if (project.id === MASS_DRIVER_ID) return BREACH_LOT_RADIUS_M
  const graded = gradedDeckRadiusM(project)
  if (graded !== null) return graded
  return projectSizeM(project) * (FOOTPRINT_FRACTION[project.id] ?? 0.5)
}

// Which local-frame azimuth of a model is its "presentation" side — the
// direction SurfaceAnchor aims at the home camera. Angles are atan2(x, z),
// so 0 = local +Z and PI/2 = local +X.
//
// The rule is BROADSIDE: aim the camera down each asset's SHORTER horizontal
// axis so the longer one spans the frame. A rover or lander reads as itself
// in profile; head-on or corner-on it's an unreadable lump. Values come from
// each GLB's authored bounding box, so they are properties of the asset
// files, not of the curated dataset.
const MODEL_FRONT_AZ: Record<string, number> = {
  // X 16.7 > Z 12.6.
  '/moonbase/models/viking-lander.glb': 0,
  // Z 3.1 > X 2.7: chassis length across the frame.
  '/moonbase/models/perseverance-rover.glb': Math.PI / 2,
  // Z 3.6 > X 1.9 puts broadside at PI/2, which also lands within 1.5° of
  // the bare stainless flank: the Heatshield_Tiles material's vertices
  // centroid at local azimuth -91.5°, so the un-tiled side faces +88.5°.
  // Without this the ship shows the camera its black heat shield.
  '/moonbase/models/starship-hls.glb': 1.545,
}

const MODEL_UP = new THREE.Vector3(0, 1, 0)

// The yaw (about the model's own up axis) that puts `frontAz` on the base's
// common heading. Models hold this heading as the user orbits — ground
// installations shouldn't pivot to track the camera — so the base always
// looks deliberately arranged from the angle it is first seen at.
//
// The bearing is taken from the hub to the home viewpoint, NOT from each site
// to it. Sites spread over 150 m aiming individually at a camera 130 m away
// splay by tens of degrees, and that splay is what made the settlement read as
// unrelated hardware dropped on a plain; on one shared axis it reads as
// surveyed. `turn` is the site's deliberate departure from that axis
// (see BASE_PLAN).
function facingYaw(
  alignedToSurface: THREE.Quaternion,
  frontAz: number,
  turn: number
) {
  const toCam = new THREE.Vector3(...HOME_CAM)
    .sub(new THREE.Vector3(...HOME_TARGET))
    .applyQuaternion(alignedToSurface.clone().invert())
  return Math.atan2(toCam.x, toCam.z) - frontAz + turn
}

// The yaw that points a model's NOSE along a world-space direction, for the
// one case where facingYaw's rule is wrong: a vehicle under way faces where it
// is going, not the viewer.
//
// Every rover here is authored driving down its own +X — bumpers at positive X,
// tailgates at negative — so +X is what has to land on the travel direction. A
// yaw of `a` about the model's up carries +X to (cos a, 0, -sin a), which puts
// it on a local direction (x, ·, z) at a = atan2(-z, x).
function headingYaw(alignedToSurface: THREE.Quaternion, world: Vec3) {
  const along = new THREE.Vector3(...world).applyQuaternion(
    alignedToSurface.clone().invert()
  )
  return Math.atan2(-along.z, along.x)
}

// Self-hosted Draco decoder (copied from three's examples into public/draco/).
// The drei default fetches it from gstatic.com, which the app's CSP blocks.
const DRACO_PATH = '/draco/'

const HULL = '#d7dbe2'
const HULL_DARK = '#9aa0ab'
const METAL = '#6b7280'
const DARK = '#3a3f4a'
const PANEL = '#12325f'
const PANEL_EDGE = '#2a4d86'
const WINDOW = '#ffd98a'
// Worked-regolith site surfaces. These are LIT (unlike the natural terrain,
// whose lighting is baked into its albedo) for two reasons: built structure
// should respond to the sun like the hardware standing on it, and an unlit
// material cannot receive shadows — an unlit pad deck would make a lander's
// own shadow disappear the moment it crossed its pad. Colors are therefore
// albedos, not final tones, so they run brighter than the terrain's.
const PAD_SURFACE = '#a6a298' // compacted/graded pad deck
const PAD_WALL = '#b2aea4' // sintered-regolith blast wall
const PAD_SLAB = '#aeaa9f' // a laid slab, marginally lighter than the raw deck
const PAD_SLAB_ALT = '#a09c92' // its neighbour, so a course reads as pieces
const PAD_SCORCH = '#8a867d' // touchdown core, darkened by the plume
const PAD_MARK = '#cfc9bc' // sintered-in markings

// Pad geometry, as fractions of the deck radius so a 52 m Starship pad and a
// 20 m Blue Moon pad are the same design at two sizes.
const PAD_CORE_R = 0.28 // monolithic touchdown slab
const PAD_COURSE_B_R = 0.6
const PAD_COURSE_C_R = 0.88
const PAD_B_COUNT = 12
const PAD_C_COUNT = 18
// The wall stands ON the deck, so its flared foot has to fall inside the deck
// radius — put the foot at r and it hangs off the edge over the skirt.
const PAD_WALL_FOOT = 0.995
const PAD_WALL_TOP = 0.935
// Radians of wall left open where the haul road comes in, centred on the pad's
// own local +Z.
const PAD_ROAD_GAP = 0.62
// Which way that gate faces, as an offset from the heading SurfaceAnchor gives
// the installation. The anchor aims a model's MODEL_FRONT_AZ at the home
// viewpoint, and for the Starship that is 88.5° off its +Z — which swung the
// pad's one gate round to the far side of the deck, where the ramp came down
// onto untouched regolith. Adding frontAz back turns the cut onto the camera
// axis; this is the remaining swing from there to the bearing of the base
// core, so the ramp lands on the perimeter road (see the pad approach in
// BASE_STREETS). It is a property of where the landing zone sits in the plan,
// which is why it is one number rather than a per-model table.
const PAD_CUT_OFFSET = -0.375

// Only LANDERS get a pad — every other installation sits directly on the
// regolith (a pedestal under a rover or reactor read as a plinth in a museum,
// not equipment on the Moon). A landing pad is real infrastructure though, and
// it is built the way MMPACT and ICON propose building one: a graded deck with
// a flared skirt that grades down into the terrain (the lander seats on the
// highest ground under its footprint, so on a slope the downhill side would
// otherwise hover), a monolithic sintered core where the plume does its worst,
// courses of laid slab worked outward from it, and a blast wall to stop the
// ejecta — which on an airless body departs at orbital speed and does not come
// back down.
//
// The courses are stacked discs rather than true annuli, each a little smaller
// and a little higher than the one beneath. The lips that leaves are the point:
// they catch the light as laid edges, and the joints between the wedges of a
// course are simply the course below showing through.
function LandingPad({
  r = 1.2,
  wallHeight = 0.09,
  yaw = 0,
  accent = '#f5b841',
}: {
  r?: number
  wallHeight?: number
  // Local yaw that puts the road cut on the haul road; see PAD_CUT_OFFSET.
  yaw?: number
  accent?: string
}) {
  // One geometry per course, reused by every wedge in it. Rebuilding thirty
  // cylinders on each hover is exactly the kind of thing that makes selecting
  // a site feel sticky.
  const { courseB, courseC, core, slabH, step } = useMemo(() => {
    const slabH = r * 0.06
    const wedge = (radius: number, count: number) => {
      const span = ((Math.PI * 2) / count) * 0.96
      return new THREE.CylinderGeometry(
        radius,
        radius,
        slabH,
        Math.max(3, Math.ceil(span / 0.1)),
        1,
        false,
        0,
        span
      )
    }
    return {
      courseB: wedge(r * PAD_COURSE_B_R, PAD_B_COUNT),
      courseC: wedge(r * PAD_COURSE_C_R, PAD_C_COUNT),
      core: new THREE.CylinderGeometry(r * PAD_CORE_R, r * PAD_CORE_R, slabH, 40),
      slabH,
      step: r * 0.006,
    }
  }, [r])

  useEffect(
    () => () => {
      courseB.dispose()
      courseC.dispose()
      core.dispose()
    },
    [courseB, courseC, core]
  )

  const deck = 0.02 // top of the graded deck; every course stacks off this
  const topC = deck + step
  const topB = deck + step * 2
  const topCore = deck + step * 3
  const wallArc = Math.PI * 2 - PAD_ROAD_GAP
  const wallStart = PAD_ROAD_GAP / 2

  return (
    <group rotation={[0, yaw, 0]}>
      {/* Graded deck + skirt. The skirt grades down into the regolith so the
          downhill side never hovers. */}
      <mesh position={[0, 0.01 - 0.24, 0]}>
        <cylinderGeometry args={[r, r * 1.34, 0.5, 64]} />
        <meshStandardMaterial color={PAD_SURFACE} roughness={0.98} />
      </mesh>

      {/* Outer course, then inner, then the core — each one smaller and a step
          prouder than the last. */}
      {Array.from({ length: PAD_C_COUNT }, (_, i) => (
        <mesh
          key={`c${i}`}
          geometry={courseC}
          position={[0, topC - slabH / 2, 0]}
          rotation={[0, ((i + 0.5) / PAD_C_COUNT) * Math.PI * 2, 0]}
        >
          <meshStandardMaterial
            color={i % 2 ? PAD_SLAB : PAD_SLAB_ALT}
            roughness={0.96}
          />
        </mesh>
      ))}
      {Array.from({ length: PAD_B_COUNT }, (_, i) => (
        <mesh
          key={`b${i}`}
          geometry={courseB}
          position={[0, topB - slabH / 2, 0]}
          rotation={[0, (i / PAD_B_COUNT) * Math.PI * 2, 0]}
        >
          <meshStandardMaterial
            color={i % 2 ? PAD_SLAB_ALT : PAD_SLAB}
            roughness={0.96}
          />
        </mesh>
      ))}
      <mesh geometry={core} position={[0, topCore - slabH / 2, 0]}>
        <meshStandardMaterial color={PAD_SCORCH} roughness={0.99} />
      </mesh>

      {/* Touchdown mark: a ring round the core and a cross through it, sintered
          a shade lighter than the deck rather than painted onto it. */}
      <mesh position={[0, topCore + step * 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r * PAD_CORE_R * 0.82, r * 0.009, 6, 48]} />
        <meshStandardMaterial color={PAD_MARK} roughness={0.9} />
      </mesh>
      {[0, Math.PI / 2].map((a) => (
        <mesh key={a} position={[0, topCore + step * 0.4, 0]} rotation={[0, a, 0]}>
          <boxGeometry args={[r * 0.024, step * 0.8, r * 0.4]} />
          <meshStandardMaterial color={PAD_MARK} roughness={0.9} />
        </mesh>
      ))}
      {/* Approach bars round the rim, the way a pad edge is marked out */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = ((i + 0.5) / 8) * Math.PI * 2
        const rad = r * 0.74
        return (
          <mesh
            key={`m${i}`}
            position={[Math.sin(a) * rad, topC + step * 0.4, Math.cos(a) * rad]}
            rotation={[0, a, 0]}
          >
            <boxGeometry args={[r * 0.02, step * 0.8, r * 0.2]} />
            <meshStandardMaterial color={PAD_MARK} roughness={0.9} />
          </mesh>
        )
      })}

      {/* Blast wall, battered so it thickens into the ground, with a rounded
          coping over the top edge. Double-sided: the camera looks down into the
          pad as often as at it. */}
      <mesh position={[0, deck + wallHeight / 2, 0]}>
        <cylinderGeometry
          args={[
            r * PAD_WALL_TOP,
            r * PAD_WALL_FOOT,
            wallHeight,
            72,
            1,
            true,
            wallStart,
            wallArc,
          ]}
        />
        <meshStandardMaterial
          color={PAD_WALL}
          roughness={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* The coping is a torus, whose arc runs the opposite way round from the
          cylinder's and starts at +X rather than +Z. Hence the Z pre-rotation:
          it lands the open span of the ring on the same road cut the wall
          leaves, instead of on the far side of the pad. */}
      <mesh
        position={[0, deck + wallHeight, 0]}
        rotation={[Math.PI / 2, 0, Math.PI / 2 + PAD_ROAD_GAP / 2]}
      >
        <torusGeometry args={[r * PAD_WALL_TOP, r * 0.022, 8, 64, wallArc]} />
        <meshStandardMaterial color={PAD_WALL} roughness={0.9} />
      </mesh>
      {/* Buttresses on the outside, heaped against the wall */}
      {Array.from({ length: 10 }, (_, i) => {
        const a = wallStart + ((i + 0.5) / 10) * wallArc
        const rad = r * 0.99
        return (
          <mesh
            key={`bt${i}`}
            position={[
              Math.sin(a) * rad,
              deck + wallHeight * 0.3,
              Math.cos(a) * rad,
            ]}
            rotation={[0, a, 0]}
          >
            <cylinderGeometry
              args={[r * 0.02, r * 0.075, wallHeight * 0.62, 4]}
            />
            <meshStandardMaterial color={PAD_WALL} roughness={0.95} />
          </mesh>
        )
      })}
      {/* Squared jambs where the wall stops either side of the road cut */}
      {[-1, 1].map((s) => {
        const a = s * (PAD_ROAD_GAP / 2)
        return (
          <mesh
            key={s}
            position={[
              Math.sin(a) * r * 0.965,
              deck + wallHeight / 2,
              Math.cos(a) * r * 0.965,
            ]}
            rotation={[0, a, 0]}
          >
            <boxGeometry args={[r * 0.055, wallHeight * 1.12, r * 0.11]} />
            <meshStandardMaterial color={PAD_WALL} roughness={0.92} />
          </mesh>
        )
      })}

      {/* Ramp out through the cut, buried at the foot so it never floats */}
      <group position={[0, 0, r * 1.24]} rotation={[0.27, 0, 0]}>
        <mesh position={[0, deck - 0.07, 0]}>
          <boxGeometry args={[r * 0.52, r * 0.05, r * 0.78]} />
          <meshStandardMaterial color={PAD_SURFACE} roughness={0.98} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * r * 0.29, deck - 0.045, 0]}>
            <boxGeometry args={[r * 0.045, r * 0.06, r * 0.78]} />
            <meshStandardMaterial color={PAD_WALL} roughness={0.95} />
          </mesh>
        ))}
      </group>

      {/* Approach lights inside the wall, and one on each jamb */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = wallStart + ((i + 0.5) / 8) * wallArc
        const rad = r * 0.915
        const x = Math.sin(a) * rad
        const z = Math.cos(a) * rad
        return (
          <group key={`l${i}`}>
            <mesh position={[x, deck + wallHeight * 0.6, z]}>
              <cylinderGeometry args={[r * 0.007, r * 0.007, wallHeight * 1.2, 6]} />
              <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh position={[x, deck + wallHeight * 1.22, z]}>
              <sphereGeometry args={[r * 0.017, 8, 8]} />
              <meshStandardMaterial
                color={accent}
                emissive={accent}
                emissiveIntensity={1.7}
                toneMapped={false}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function Lander({ accent }: { accent: string }) {
  const legs = [0, 1, 2, 3]
  return (
    <group>
      <LandingPad r={1.1} yaw={PAD_CUT_OFFSET} accent={accent} />
      {/* descent stage */}
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.42, 0.52, 0.62, 10]} />
        <meshStandardMaterial color={HULL} roughness={0.55} metalness={0.35} />
      </mesh>
      {/* mli wrap bands */}
      {[0.5, 0.72].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <torusGeometry args={[0.47, 0.02, 8, 24]} />
          <meshStandardMaterial color="#caa64a" metalness={0.6} roughness={0.4} emissive="#4a3a12" emissiveIntensity={0.2} />
        </mesh>
      ))}
      {/* ascent/tank stack */}
      <mesh position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.5, 12]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshStandardMaterial color={HULL} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* nozzle */}
      <mesh position={[0, 0.24, 0]}>
        <coneGeometry args={[0.2, 0.32, 16, 1, true]} />
        <meshStandardMaterial color={DARK} side={THREE.DoubleSide} metalness={0.7} roughness={0.35} />
      </mesh>
      {/* landing legs with footpads */}
      {legs.map((i) => {
        const a = (i / legs.length) * Math.PI * 2 + Math.PI / 4
        const lx = Math.cos(a)
        const lz = Math.sin(a)
        return (
          <group key={i}>
            <mesh position={[lx * 0.55, 0.28, lz * 0.55]} rotation={[0, -a, Math.PI / 4.5]}>
              <cylinderGeometry args={[0.028, 0.028, 0.8, 6]} />
              <meshStandardMaterial color={METAL} metalness={0.4} />
            </mesh>
            <mesh position={[lx * 0.82, 0.02, lz * 0.82]}>
              <cylinderGeometry args={[0.1, 0.1, 0.05, 12]} />
              <meshStandardMaterial color={HULL_DARK} metalness={0.3} />
            </mesh>
          </group>
        )
      })}
      <mesh position={[0.32, 0.9, 0.0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Blue Origin Blue Moon MK2 — crewed lunar lander
// ---------------------------------------------------------------------------
//
// Replaces the InSight-lander stand-in. Built from NASA's own Artemis renders
// of the selected lander: a splayed, bipod-braced landing gear on gold MLI
// struts; a windowed crew module low on the stack with a deployable ladder
// down to the regolith opposite a docking hatch; two open lattice bays that
// expose the propellant tanks between the crew module and the ascent stage,
// the way the real vehicle's structure is not fully faired over; then a
// smooth ascent hull tapering to a domed nose. `frontAz` is always 0 for a
// procedural (non-GLB) model — see MODEL_FRONT_AZ — so the crew module's
// windows are authored on local +Z like everything else that has a "front."
const BM2_M = UNIT_MAX_DIM / (PROJECT_SIZE_M['blue-origin-blue-moon-mk2'] ?? 16)

const BM2_HULL = HULL
const BM2_HULL_DARK = HULL_DARK
const BM2_FOIL = '#cbd0d6' // brighter aluminized foil over the tank bays
const BM2_GOLD = '#d1a53d' // kapton MLI on the landing gear's lower struts
const BM2_BLUE = PANEL // the one livery band — see the house rule on flags/logos

// Stations up the stack, in meters above the footpad. Sized so the total
// (footpad to nose tip) lands on PROJECT_SIZE_M's 16 m exactly.
const BM2_FOOT_R = 4.6 // footpad splay radius
const BM2_HIP_R = 2.7 // where the gear attaches, near the module's rim
const BM2_HIP_Y = 2.9 // = the crew module's underside
const BM2_KNEE_Y = 1.7
const BM2_FOOT_Y = 0.16
const BM2_DECK_R = 3.0 // crew module radius
const BM2_DECK_TOP = 6.4
const BM2_TRUSS1_TOP = 9.2
const BM2_TRUSS2_TOP = 11.7
const BM2_HULL_TOP = 13.8
const BM2_NOSE_TOP = 16.0

// The crew module tapers — radius BM2_DECK_R at its top rim, BM2_DECK_R*1.08
// at its base — rather than running a constant radius, so anything mounted
// on its flank at a flat BM2_DECK_R offset ends up partly buried in the
// wider skirt below it: two coincident surfaces fighting the z-buffer, which
// is what reads as a grainy, flickering seam rather than a window standing
// proud of the hull. Same fix as mphFlankZ, for a cone instead of a sphere:
// sample the actual radius AT THE FEATURE'S OWN HEIGHT before offsetting it.
function bm2HullR(y: number): number {
  const t = (y - BM2_HIP_Y) / (BM2_DECK_TOP - BM2_HIP_Y)
  return BM2_DECK_R * (1.08 - 0.08 * t)
}

// One leg: two struts from the module's rim converge on a knee, which
// continues as a single gold-wrapped strut down to the footpad — the same
// bipod-to-single-strut arrangement real lunar module gear uses, and
// visually the strongest cue in the reference art (the lower run is
// distinctly gold against the white hull above it).
function Bm2Leg({ angle }: { angle: number }) {
  const hip1: [number, number, number] = [
    Math.cos(angle - 0.22) * BM2_HIP_R,
    BM2_HIP_Y,
    Math.sin(angle - 0.22) * BM2_HIP_R,
  ]
  const hip2: [number, number, number] = [
    Math.cos(angle + 0.22) * BM2_HIP_R,
    BM2_HIP_Y,
    Math.sin(angle + 0.22) * BM2_HIP_R,
  ]
  const kneeR = (BM2_HIP_R + BM2_FOOT_R) * 0.46
  const knee: [number, number, number] = [
    Math.cos(angle) * kneeR,
    BM2_KNEE_Y,
    Math.sin(angle) * kneeR,
  ]
  const foot: [number, number, number] = [
    Math.cos(angle) * BM2_FOOT_R,
    BM2_FOOT_Y,
    Math.sin(angle) * BM2_FOOT_R,
  ]
  return (
    <group>
      <Strut from={hip1} to={knee} r={0.1} color={BM2_HULL} />
      <Strut from={hip2} to={knee} r={0.1} color={BM2_HULL} />
      <Strut from={knee} to={foot} r={0.16} color={BM2_GOLD} />
      <mesh position={knee}>
        <sphereGeometry args={[0.2, 10, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.55} roughness={0.35} />
      </mesh>
      {/* footpad: a shallow dish, splayed foot of a real gear rather than a
          spike — ground pressure on uncompacted regolith is the problem */}
      <mesh position={[foot[0], foot[1] - 0.08, foot[2]]}>
        <cylinderGeometry args={[0.85, 0.6, 0.24, 16]} />
        <meshStandardMaterial color={BM2_HULL_DARK} metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[foot[0], foot[1] + 0.08, foot[2]]}>
        <sphereGeometry args={[0.72, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={METAL} metalness={0.4} roughness={0.5} />
      </mesh>
    </group>
  )
}

// The crew module's ladder: a converging pair of rails with rungs between,
// running from a small porch at the hatch down to the regolith on the side
// opposite the docking port — a deployable boom rather than a fixed
// staircase, matching the reference art's crew access gear.
function Bm2Ladder({ attachY }: { attachY: number }) {
  const topX = -bm2HullR(attachY) * 0.95
  const botX = -(BM2_DECK_R + 3.2)
  const rungCount = 9
  return (
    <group>
      <mesh position={[topX - 0.35, attachY, 0]}>
        <boxGeometry args={[0.9, 0.08, 1.1]} />
        <meshStandardMaterial color={BM2_HULL_DARK} roughness={0.7} metalness={0.2} />
      </mesh>
      {[-1, 1].map((s) => (
        <Strut
          key={s}
          from={[topX, attachY, s * 0.5]}
          to={[botX, 0.22, s * 0.35]}
          r={0.045}
          color={METAL}
        />
      ))}
      {Array.from({ length: rungCount }, (_, i) => {
        const t = (i + 0.5) / rungCount
        const x = topX + (botX - topX) * t
        const y = attachY + (0.22 - attachY) * t
        const zHalf = 0.5 - (0.5 - 0.35) * t
        return (
          <Strut key={i} from={[x, y, -zHalf]} to={[x, y, zHalf]} r={0.025} color={METAL} />
        )
      })}
    </group>
  )
}

// The pressurized crew module: two big lit windows facing the base (local
// +Z), a docking hatch on +X, the ladder on -X, and the one livery band —
// kept to a stripe rather than a flag or agency roundel, per house rule.
function Bm2CrewModule({ accent }: { accent: string }) {
  const y0 = BM2_HIP_Y
  const h = BM2_DECK_TOP - y0
  return (
    <group>
      <mesh position={[0, y0 + h / 2, 0]}>
        <cylinderGeometry args={[BM2_DECK_R, BM2_DECK_R * 1.08, h, 28]} />
        <meshStandardMaterial color={BM2_HULL} roughness={0.55} metalness={0.25} />
      </mesh>
      <mesh position={[0, y0, 0]}>
        <sphereGeometry args={[BM2_DECK_R * 1.08, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={BM2_HULL_DARK} roughness={0.6} metalness={0.2} />
      </mesh>

      {[-0.85, 0.85].map((x) => {
        const winY = y0 + h * 0.62
        return (
          <group key={x} position={[x, winY, bm2HullR(winY) * 0.995]}>
            <mesh>
              <boxGeometry args={[0.85, 1.05, 0.06]} />
              <meshStandardMaterial color={DARK} roughness={0.5} metalness={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.035]}>
              <boxGeometry args={[0.68, 0.88, 0.02]} />
              <meshStandardMaterial
                color={WINDOW}
                emissive={WINDOW}
                emissiveIntensity={1.3}
                toneMapped={false}
              />
            </mesh>
          </group>
        )
      })}

      {(() => {
        const stripeY = y0 + h * 0.24
        const r = bm2HullR(stripeY)
        return (
          <mesh position={[0, stripeY, 0]}>
            <cylinderGeometry args={[r * 1.01, r * 1.025, 0.32, 28]} />
            <meshStandardMaterial color={BM2_BLUE} roughness={0.5} metalness={0.15} />
          </mesh>
        )
      })()}

      {/* Docking hatch, opposite the ladder */}
      {(() => {
        const hatchY = y0 + h * 0.55
        return (
          <group
            position={[bm2HullR(hatchY) * 0.98, hatchY, 0]}
            rotation={[0, -Math.PI / 2, 0]}
          >
            <mesh>
              <cylinderGeometry args={[0.62, 0.62, 0.22, 20]} />
              <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.14]}>
              <cylinderGeometry args={[0.5, 0.5, 0.05, 20]} />
              <meshStandardMaterial color={DARK} roughness={0.6} />
            </mesh>
          </group>
        )
      })()}

      <Bm2Ladder attachY={y0 + h * 0.32} />

      {(() => {
        const beaconY = y0 + h * 0.92
        return (
          <mesh position={[0, beaconY, bm2HullR(beaconY) + 0.03]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={1.8}
              toneMapped={false}
            />
          </mesh>
        )
      })()}

      {/* Crew stepping down, for scale and life at the one hatch a person
          actually uses on this vehicle */}
      <PatrollingAstronaut
        center={[-(BM2_DECK_R + 4.6), 1.0]}
        radius={1.0}
        seed={9}
        accent={accent}
      />
    </group>
  )
}

// An open lattice bay between deck stages, with foil-wrapped tanks nested
// inside it — the exposed structure the reference art shows rather than a
// faired-over tank section, which is what makes the stack read as staged
// hardware instead of one smooth shell.
function Bm2TrussBay({
  y0,
  y1,
  rBottom,
  rTop,
  tankCount,
  tankR,
  postCount = 6,
}: {
  y0: number
  y1: number
  rBottom: number
  rTop: number
  tankCount: number
  tankR: number
  postCount?: number
}) {
  const posts = Array.from({ length: postCount }, (_, i) => (i / postCount) * Math.PI * 2)
  return (
    <group>
      {posts.map((a, i) => {
        const b = posts[(i + 1) % postCount]
        const p0b: [number, number, number] = [Math.cos(a) * rBottom, y0, Math.sin(a) * rBottom]
        const p1b: [number, number, number] = [Math.cos(b) * rBottom, y0, Math.sin(b) * rBottom]
        const p0t: [number, number, number] = [Math.cos(a) * rTop, y1, Math.sin(a) * rTop]
        const p1t: [number, number, number] = [Math.cos(b) * rTop, y1, Math.sin(b) * rTop]
        return (
          <group key={a}>
            <Strut from={p0b} to={p0t} r={0.07} color={METAL} />
            <Strut from={p0b} to={p1t} r={0.045} color={METAL} />
            <Strut from={p1b} to={p0t} r={0.045} color={METAL} />
            <Strut from={p0b} to={p1b} r={0.05} color={METAL} />
            <Strut from={p0t} to={p1t} r={0.05} color={METAL} />
          </group>
        )
      })}
      {Array.from({ length: tankCount }, (_, i) => {
        const a = (i / tankCount) * Math.PI * 2 + Math.PI / tankCount
        const rMid = ((rBottom + rTop) / 2) * 0.6
        const yMid = (y0 + y1) / 2
        return (
          <mesh key={i} position={[Math.cos(a) * rMid, yMid, Math.sin(a) * rMid]}>
            <sphereGeometry args={[tankR, 14, 10]} />
            <meshStandardMaterial color={BM2_FOIL} metalness={0.35} roughness={0.3} />
          </mesh>
        )
      })}
    </group>
  )
}

// Smooth ascent hull above the lattice bays: viewports, an RCS quad either
// side, and the taper into the nose collar.
function Bm2UpperHull({ accent }: { accent: string }) {
  const y0 = BM2_TRUSS2_TOP
  const r = 1.75
  const h = BM2_HULL_TOP - y0
  return (
    <group>
      <mesh position={[0, y0 + h / 2, 0]}>
        <cylinderGeometry args={[r * 0.85, r, h, 24]} />
        <meshStandardMaterial color={BM2_HULL} roughness={0.5} metalness={0.3} />
      </mesh>
      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((a) => (
        <mesh
          key={a}
          position={[Math.cos(a) * r * 0.83, y0 + h * 0.68, Math.sin(a) * r * 0.83]}
        >
          <sphereGeometry args={[0.15, 10, 8]} />
          <meshStandardMaterial
            color={WINDOW}
            emissive={WINDOW}
            emissiveIntensity={0.8}
            toneMapped={false}
          />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * r * 0.72, y0 + h * 0.18, 0]} rotation={[0, 0, s * 0.4]}>
          <boxGeometry args={[0.3, 0.22, 0.22]} />
          <meshStandardMaterial color={DARK} metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, y0 + h * 0.95, r * 0.6]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.8}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// The nose: a short taper collar into a rounded dome, with a whip antenna
// and a scatter of small dark ports rather than an attempt at an exact
// thruster layout — decorative at this distance, and every other dome cap
// on the base (the habitat's end caps, the ILRS modules) is built the same
// plain-hemisphere way rather than a stretched/distorted sphere.
function Bm2Nose() {
  const y0 = BM2_HULL_TOP
  const rBase = 1.4
  const rDome = 1.15
  // A long taper rather than a short collar: this is what puts the dome's
  // apex exactly on BM2_NOSE_TOP (the antenna whip is allowed to overshoot
  // it, same as every other thin decorative antenna on the base).
  const collarH = BM2_NOSE_TOP - y0 - rDome
  return (
    <group position={[0, y0, 0]}>
      <mesh position={[0, collarH / 2, 0]}>
        <cylinderGeometry args={[rDome, rBase, collarH, 20]} />
        <meshStandardMaterial color={BM2_HULL} roughness={0.45} metalness={0.25} />
      </mesh>
      <mesh position={[0, collarH, 0]}>
        <sphereGeometry args={[rDome, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={BM2_HULL} roughness={0.45} metalness={0.25} />
      </mesh>
      {[
        [-0.32, 0.18],
        [0.18, -0.34],
        [0.24, 0.3],
      ].map(([dx, dz], i) => (
        <mesh key={i} position={[dx, collarH + rDome * 0.92, dz]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial color={DARK} roughness={0.6} />
        </mesh>
      ))}
      <Strut
        from={[0.5, collarH + 0.3, 0.5]}
        to={[0.78, collarH + rDome * 1.35, 0.78]}
        r={0.02}
        color={METAL}
      />
    </group>
  )
}

function BlueMoonMk2({ accent }: { accent: string }) {
  const legAngles = [0, 1, 2, 3].map((i) => (i / 4) * Math.PI * 2 + Math.PI / 4)
  return (
    <group>
      <LandingPad r={0.85} yaw={PAD_CUT_OFFSET} accent={accent} />
      <group scale={BM2_M}>
        {legAngles.map((a) => (
          <Bm2Leg key={a} angle={a} />
        ))}
        <Bm2CrewModule accent={accent} />
        <Bm2TrussBay
          y0={BM2_DECK_TOP}
          y1={BM2_TRUSS1_TOP}
          rBottom={2.9}
          rTop={2.3}
          tankCount={4}
          tankR={0.82}
        />
        <Bm2TrussBay
          y0={BM2_TRUSS1_TOP}
          y1={BM2_TRUSS2_TOP}
          rBottom={2.3}
          rTop={1.75}
          tankCount={3}
          tankR={0.6}
        />
        <Bm2UpperHull accent={accent} />
        <Bm2Nose />
      </group>
    </group>
  )
}

// Rover body reused standalone and parked in the base compound.
function RoverBody({ accent }: { accent: string }) {
  const wheels: [number, number][] = [
    [-0.4, -0.3],
    [0, -0.3],
    [0.4, -0.3],
    [-0.4, 0.3],
    [0, 0.3],
    [0.4, 0.3],
  ]
  return (
    <group>
      {/* chassis */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[1.0, 0.26, 0.66]} />
        <meshStandardMaterial color={HULL} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* crew/instrument deck */}
      <mesh position={[-0.1, 0.5, 0]}>
        <boxGeometry args={[0.5, 0.18, 0.5]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.7} />
      </mesh>
      {/* solar/roof panel */}
      <mesh position={[0.28, 0.46, 0]}>
        <boxGeometry args={[0.5, 0.02, 0.55]} />
        <meshStandardMaterial color={PANEL} metalness={0.3} roughness={0.35} />
      </mesh>
      {/* mast + sensor head */}
      <mesh position={[-0.32, 0.66, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.34, 6]} />
        <meshStandardMaterial color={METAL} />
      </mesh>
      <mesh position={[-0.32, 0.86, 0.02]}>
        <boxGeometry args={[0.1, 0.08, 0.14]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      <mesh position={[-0.32, 0.86, 0.1]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      {/* rocker-bogie wheels */}
      {wheels.map(([x, z], i) => (
        <group key={i}>
          <mesh position={[x, 0.14, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.1, 14]} />
            <meshStandardMaterial color="#20242c" roughness={0.9} />
          </mesh>
          <mesh position={[x, 0.28, z]}>
            <boxGeometry args={[0.03, 0.16, 0.03]} />
            <meshStandardMaterial color={METAL} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Rover({ accent }: { accent: string }) {
  return <RoverBody accent={accent} />
}

// A truss member between two points, in the parent group's units. Lattice
// structure is what makes heavy equipment read as equipment rather than as a
// box on legs. Shared by the ISRU pipe runs, the reactor's stand and the
// printer gantry.
function Strut({
  from,
  to,
  r = 0.07,
  color = METAL,
  glow = 0,
  seg = 6,
}: {
  from: [number, number, number]
  to: [number, number, number]
  r?: number
  color?: string
  // Emissive strength, for runs carrying concentrated heat. 0 = inert metal.
  glow?: number
  // Six sides is plenty for a thin member, but reads as a hexagonal prism once
  // the radius grows to walk-through size.
  seg?: number
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const axis = b.clone().sub(a)
    const length = axis.length() || 1e-6
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        MODEL_UP,
        axis.divideScalar(length)
      ),
      length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from[0], from[1], from[2], to[0], to[1], to[2]])
  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[r, r, length, seg]} />
      <meshStandardMaterial
        color={color}
        metalness={0.5}
        roughness={0.55}
        emissive={color}
        emissiveIntensity={glow}
      />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Suited astronaut — shared across every site
// ---------------------------------------------------------------------------
//
// This used to be a GLB (astronaut.glb): a single rigid mesh, no skeleton, no
// skin, frozen in whatever reference pose it was exported in — arms and legs
// out to the sides, which is exactly what a Vitruvian Man silhouette is. There
// is no way to re-pose a mesh with no joints, so it was replaced outright with
// a procedural rig built the same way every other piece of moving hardware on
// this map is (the LTV's rocker-bogie wheels, the print gantry's slewing
// boom): hinge groups a real skeleton would use — two hips, two knees, two
// shoulders — driven by `useFrame` rather than a baked clip, because nothing
// here has an animation track to bake from in the first place.
//
// Authored at a fixed 1.85 m standing height regardless of context, exactly
// like `GLBModel`'s `fitHeight`: `AstronautRig` and `PatrollingAstronaut` both
// take a `fitHeight` prop and rescale internally, so a call site inside a
// true-meters model (`ILRSBase`) and one inside a normalized generic-model
// scale (`AstronautCompanion`) both just pass the height they want in THEIR
// own local units, the same as the old `GLBModel` calls did.

const ASTRO_SUIT = HULL
const ASTRO_SUIT_DARK = HULL_DARK
const ASTRO_VISOR = '#9c8250' // gold-coated glass, the real reason EVA visors read gold on camera
const ASTRO_JOINT = METAL

const ASTRO_HIP_Y = 0.92
const ASTRO_SHOULDER_Y = 1.42
const ASTRO_HIP_X = 0.13
const ASTRO_SHOULDER_X = 0.22
const ASTRO_LEG_UP = 0.46
const ASTRO_LEG_LO = 0.44
const ASTRO_ARM_UP = 0.27
const ASTRO_ARM_LO = 0.25
// A suit's joints do not fully straighten under pressure, so even standing
// still the arms hang bent slightly forward rather than dead vertical — one
// more thing that reads as a person rather than a mannequin.
const ASTRO_ARM_BASE = 0.14

const ASTRO_STRIDE_OMEGA = 6.2 // rad/s — a brisk walking cadence
const ASTRO_LEG_SWING = 0.5
const ASTRO_ARM_SWING = 0.4
const ASTRO_KNEE_BEND = 0.9
const ASTRO_BOB = 0.03

// Cheap deterministic pseudo-random from an integer, so instances started
// from a plain `seed` prop (0, 1, 2…) desynchronize their gait and wander
// path instead of every astronaut on the base walking in lockstep.
function hash1(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

// A bounded, never-repeating-soon wander: two circles of different periods
// summed (an epicycle), which is the cheapest path that looks like an idle
// patrol rather than a lap or a random-walk jitter. Returns a UNIT-scale
// offset (roughly ±1) plus the direction of travel, so callers just multiply
// by their own patrol radius.
function astroWander(
  t: number,
  seed: number
): { x: number; z: number; heading: number } {
  const w1 = 0.1 + hash1(seed * 3 + 1) * 0.035
  const w2 = 0.24 + hash1(seed * 3 + 2) * 0.05
  const p1 = hash1(seed * 3 + 3) * Math.PI * 2
  const p2 = hash1(seed * 3 + 4) * Math.PI * 2
  const a1 = 0.62
  const a2 = 0.38
  const x = a1 * Math.cos(t * w1 + p1) + a2 * Math.cos(t * w2 + p2)
  const z = a1 * Math.sin(t * w1 + p1) + a2 * Math.sin(t * w2 + p2)
  // The velocity, not the position, is what a walker's heading actually is.
  const dx = -a1 * w1 * Math.sin(t * w1 + p1) - a2 * w2 * Math.sin(t * w2 + p2)
  const dz = a1 * w1 * Math.cos(t * w1 + p1) + a2 * w2 * Math.cos(t * w2 + p2)
  return { x, z, heading: Math.atan2(dx, dz) }
}

// The rig: two hinged legs (hip + knee) and two hinged arms (shoulder only —
// suit elbows barely bend), a torso that bobs once per stride, and a helmet
// with a gold visor. Standing pose keeps the limbs hanging under the body
// rather than out to the sides, which is the actual fix for the old model's
// Vitruvian-Man read; the walk cycle is what sells it as a person instead of
// a statue.
function AstronautRig({
  accent,
  fitHeight = 1.85,
  seed = 0,
}: {
  accent: string
  fitHeight?: number
  seed?: number
}) {
  const lHip = useRef<THREE.Group>(null)
  const rHip = useRef<THREE.Group>(null)
  const lKnee = useRef<THREE.Group>(null)
  const rKnee = useRef<THREE.Group>(null)
  const lShoulder = useRef<THREE.Group>(null)
  const rShoulder = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)
  const phase = useMemo(() => hash1(seed * 7 + 11) * Math.PI * 2, [seed])

  useFrame((state) => {
    const t = state.clock.elapsedTime * ASTRO_STRIDE_OMEGA + phase
    const swing = Math.sin(t) * ASTRO_LEG_SWING
    const armSwing = Math.sin(t) * ASTRO_ARM_SWING
    if (lHip.current) lHip.current.rotation.x = swing
    if (rHip.current) rHip.current.rotation.x = -swing
    // Each knee only bends on its own leg's forward swing — a trailing leg
    // stays straight, a leading one bends — rather than both hinging in
    // lockstep, which is what made an early pass read as goose-stepping.
    if (lKnee.current) lKnee.current.rotation.x = ASTRO_KNEE_BEND * Math.max(0, -swing)
    if (rKnee.current) rKnee.current.rotation.x = ASTRO_KNEE_BEND * Math.max(0, swing)
    // Contralateral: the arm opposite a forward leg swings forward with it.
    if (lShoulder.current) lShoulder.current.rotation.x = ASTRO_ARM_BASE - armSwing
    if (rShoulder.current) rShoulder.current.rotation.x = ASTRO_ARM_BASE + armSwing
    if (torso.current) {
      // Two bobs per stride (one per footfall), plus a small idle sway.
      torso.current.position.y = ASTRO_HIP_Y + Math.abs(Math.sin(t)) * ASTRO_BOB
      torso.current.rotation.z = Math.sin(t) * 0.025
    }
  })

  const torsoH = ASTRO_SHOULDER_Y - ASTRO_HIP_Y

  return (
    <group scale={fitHeight / 1.85}>
      {[1, -1].map((side) => (
        <group
          key={`leg${side}`}
          ref={side === 1 ? lHip : rHip}
          position={[side * ASTRO_HIP_X, ASTRO_HIP_Y, 0]}
        >
          <mesh>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial color={ASTRO_JOINT} metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, -ASTRO_LEG_UP / 2, 0]}>
            <cylinderGeometry args={[0.075, 0.095, ASTRO_LEG_UP, 10]} />
            <meshStandardMaterial color={ASTRO_SUIT} roughness={0.75} />
          </mesh>
          <group ref={side === 1 ? lKnee : rKnee} position={[0, -ASTRO_LEG_UP, 0]}>
            <mesh>
              <sphereGeometry args={[0.075, 8, 8]} />
              <meshStandardMaterial color={ASTRO_JOINT} metalness={0.4} roughness={0.5} />
            </mesh>
            <mesh position={[0, -ASTRO_LEG_LO / 2, 0]}>
              <cylinderGeometry args={[0.065, 0.08, ASTRO_LEG_LO, 10]} />
              <meshStandardMaterial color={ASTRO_SUIT} roughness={0.75} />
            </mesh>
            <mesh position={[0, -ASTRO_LEG_LO - 0.05, 0.03]}>
              <boxGeometry args={[0.11, 0.1, 0.2]} />
              <meshStandardMaterial color={ASTRO_SUIT_DARK} roughness={0.85} />
            </mesh>
          </group>
        </group>
      ))}

      {[1, -1].map((side) => (
        <group
          key={`arm${side}`}
          ref={side === 1 ? lShoulder : rShoulder}
          position={[side * ASTRO_SHOULDER_X, ASTRO_SHOULDER_Y, 0]}
        >
          <mesh>
            <sphereGeometry args={[0.075, 8, 8]} />
            <meshStandardMaterial color={ASTRO_JOINT} metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, -ASTRO_ARM_UP / 2, 0]}>
            <cylinderGeometry args={[0.06, 0.075, ASTRO_ARM_UP, 8]} />
            <meshStandardMaterial color={ASTRO_SUIT} roughness={0.75} />
          </mesh>
          <mesh position={[0, -ASTRO_ARM_UP - ASTRO_ARM_LO / 2, 0]}>
            <cylinderGeometry args={[0.05, 0.06, ASTRO_ARM_LO, 8]} />
            <meshStandardMaterial color={ASTRO_SUIT} roughness={0.75} />
          </mesh>
          <mesh position={[0, -ASTRO_ARM_UP - ASTRO_ARM_LO - 0.04, 0]}>
            <sphereGeometry args={[0.065, 8, 8]} />
            <meshStandardMaterial color={ASTRO_SUIT_DARK} roughness={0.8} />
          </mesh>
        </group>
      ))}

      <group ref={torso} position={[0, ASTRO_HIP_Y, 0]}>
        <mesh position={[0, torsoH / 2, 0]}>
          <cylinderGeometry args={[0.17, 0.2, torsoH, 12]} />
          <meshStandardMaterial color={ASTRO_SUIT} roughness={0.7} />
        </mesh>
        {/* PLSS backpack, worn on the back rather than floating free of it */}
        <mesh position={[0, torsoH * 0.6, -0.19]}>
          <boxGeometry args={[0.34, 0.4, 0.18]} />
          <meshStandardMaterial color={ASTRO_JOINT} metalness={0.3} roughness={0.6} />
        </mesh>
        {/* Chest status light — the house's small operator-colored accent */}
        <mesh position={[0.1, torsoH * 0.75, 0.17]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={2.2}
            toneMapped={false}
          />
        </mesh>
        <group position={[0, torsoH + 0.11, 0]}>
          <mesh>
            <sphereGeometry args={[0.185, 16, 12]} />
            <meshStandardMaterial color={ASTRO_SUIT} roughness={0.55} metalness={0.1} />
          </mesh>
          <mesh position={[0, -0.02, 0.1]}>
            <sphereGeometry
              args={[0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.1]}
            />
            <meshStandardMaterial color={ASTRO_VISOR} metalness={0.6} roughness={0.25} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

// A suited figure that wanders a bounded patrol around `center` instead of
// standing frozen for a screenshot. `center` and `radius` are in whatever
// local units the call site already uses — the same convention `fitHeight`
// followed as a `GLBModel` prop — so dropping this in place of the old
// `<GLBModel url={ASTRONAUT_URI}>` calls needed no unit conversion.
function PatrollingAstronaut({
  center = [0, 0],
  radius = 2.5,
  seed = 0,
  accent,
  fitHeight = 1.85,
}: {
  center?: [number, number]
  radius?: number
  seed?: number
  accent: string
  fitHeight?: number
}) {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!group.current) return
    const w = astroWander(state.clock.elapsedTime, seed)
    group.current.position.set(center[0] + w.x * radius, 0, center[1] + w.z * radius)
    group.current.rotation.y = w.heading
  })
  return (
    <group ref={group}>
      <AstronautRig accent={accent} fitHeight={fitHeight} seed={seed} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Site clutter — small props shared across every installation
// ---------------------------------------------------------------------------
//
// Every generic-type model above is built from ONE story: the reactor, the
// dish, the dome. A real site also has the stuff that piles up around a
// story — the resupply that hasn't been unpacked yet, the cable spooled off
// a reel because a run needed lengthening, the spoil a dig leaves behind.
// None of it is a competitor's hardware, so none of it belongs in any
// per-project model; it belongs here, as a handful of small shared props
// hand-placed into the generic models the same deliberate way the ISRU
// plant's own staged feedstock or the print site's paver stacks already are.
//
// Every prop below is authored directly in real meters, exactly like `Strut`
// and `LandingPad` — there is no `fitHeight`-style rescale prop, because
// every call site that uses these (IsruPlant, Power, Habitat, CommsPnt,
// ConstructionSite, CrewedBase, ILRSBase) already authors its OWN local
// geometry in real meters before its outer `scale={..._M}` wrapper
// normalizes the whole assembly, so a 1.3 m pallet is written as 1.3 no
// matter which model it is dropped into.

const MLI_GOLD = '#b8934a' // multi-layer insulation blanket — the standard soft-cargo wrap
const MLI_GOLD_DK = '#8a6c34' // shadow in a crinkle fold
const STRAP_DARK = '#1c1c1c'
const CRATE_WHITE = '#dcded4' // hard-case composite, not painted bare metal
const REEL_CABLE = '#2b2f36'
const TAILINGS_COLOR = '#8f8a7d' // loose worked regolith — lighter/rawer than the compacted PAD_SURFACE beside it

// A single MLI-wrapped soft cargo module or a hard case, strapped to a
// pallet — the two things an actual resupply flight carries. `hard` swaps
// the crate variant; `seed` only nudges yaw so a few of these in one shot
// don't read as one mesh copy-pasted three times.
function CargoPallet({ hard = false, seed = 0 }: { hard?: boolean; seed?: number }) {
  const yaw = hash1(seed * 11 + 3) * Math.PI * 2
  const crateH = hard ? 0.82 : 0.78
  const baseTop = 0.1
  return (
    <group rotation={[0, yaw, 0]}>
      {/* Pallet base, standing proud of the ground rather than seated exactly
          at grade — see the "nothing floats" rule, which cuts both ways: a
          footing sunk IN is invisible, one resolved exactly at y=0 reads as
          hovering the instant the ground isn't perfectly flat under it. */}
      <mesh position={[0, baseTop / 2, 0]}>
        <boxGeometry args={[1.3, baseTop, 1.05]} />
        <meshStandardMaterial color={METAL} roughness={0.7} metalness={0.4} />
      </mesh>
      <mesh position={[0, baseTop + crateH / 2, 0]}>
        <boxGeometry args={[1.15, crateH, 0.95]} />
        <meshStandardMaterial
          color={hard ? CRATE_WHITE : MLI_GOLD}
          roughness={hard ? 0.6 : 0.55}
          metalness={hard ? 0.1 : 0.25}
        />
      </mesh>
      {/* Crinkled MLI reads as folds of slightly darker gold banding, not a
          flat gold box — that single cue is what sells "blanket" over
          "painted crate". */}
      {!hard &&
        [-0.24, -0.04, 0.16, 0.32].map((dy) => (
          <mesh key={dy} position={[0, baseTop + crateH / 2 + dy, 0.476]}>
            <boxGeometry args={[1.13, 0.035, 0.01]} />
            <meshStandardMaterial color={MLI_GOLD_DK} roughness={0.6} metalness={0.2} />
          </mesh>
        ))}
      {/* Cargo straps over the top, standing proud of the crate face. */}
      {[-0.28, 0.28].map((dz) => (
        <mesh key={dz} position={[0, baseTop + crateH + 0.012, dz]}>
          <boxGeometry args={[1.18, 0.022, 0.09]} />
          <meshStandardMaterial color={STRAP_DARK} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

// A cable reel standing on edge like a wheel — the axle horizontal, the
// wound cable and both flanges sharing one rotation so nothing has to be
// re-derived per mesh. Sunk a hair into the ground at the tire-contact rule
// every wheeled thing on this map already follows (see the LTV's rockers).
export function CableReel() {
  const R = 0.42
  const W = 0.34
  const rot: [number, number, number] = [0, 0, Math.PI / 2]
  return (
    <group position={[0, R * 0.97, 0]}>
      {[-W / 2, W / 2].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={rot}>
          <cylinderGeometry args={[R, R, 0.045, 24]} />
          <meshStandardMaterial color={HULL_DARK} roughness={0.8} metalness={0.15} />
        </mesh>
      ))}
      <mesh rotation={rot}>
        <cylinderGeometry args={[R * 0.8, R * 0.8, W * 0.93, 24]} />
        <meshStandardMaterial color={REEL_CABLE} roughness={0.92} />
      </mesh>
      <mesh rotation={rot}>
        <cylinderGeometry args={[R * 0.12, R * 0.12, W * 1.08, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  )
}

// Loose regolith spoil, built as several overlapping, non-uniformly-scaled
// blobs off one shared geometry rather than one clean dome: real tailings
// are a jumble of separate dumped loads, and a single graded mound reads as
// a hill, not a spoil pile. Sunk into the ground on purpose — the "footing
// below grade" rule applies to a heap exactly like it does to a footpad.
const TAILINGS_LUMP_GEO = new THREE.IcosahedronGeometry(1, 1)

function TailingsPile({ size = 1.6, seed = 0 }: { size?: number; seed?: number }) {
  const lumps = useMemo(() => {
    return Array.from({ length: 3 }, (_, i) => {
      const k = seed * 7 + i * 5
      const a = hash1(k + 1) * Math.PI * 2
      const r = size * (0.14 + hash1(k + 2) * 0.12)
      const s = size * (0.3 + hash1(k + 3) * 0.16)
      const h = s * (0.5 + hash1(k + 4) * 0.22)
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, s, h, yaw: hash1(k + 5) * Math.PI * 2 }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, seed])
  return (
    <group>
      {lumps.map((l, i) => (
        <mesh
          key={i}
          geometry={TAILINGS_LUMP_GEO}
          position={[l.x, l.h * 0.3, l.z]}
          rotation={[0, l.yaw, 0]}
          scale={[l.s, l.h, l.s]}
        >
          <meshStandardMaterial color={TAILINGS_COLOR} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

// A small tow cart — four unpowered casters, not a rover — for hauling a
// couple of crates between a landing zone and wherever they're needed. Bed
// height and wheel size deliberately smaller than the LTV's, so the two
// wheeled things on a site never get confused for one another at a glance.
function UtilityCart() {
  const L = 1.8
  const W = 0.95
  const deckY = 0.42
  const wheelR = 0.16
  return (
    <group>
      <mesh position={[0, deckY, 0]}>
        <boxGeometry args={[L, 0.08, W]} />
        <meshStandardMaterial color={METAL} roughness={0.7} metalness={0.3} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, deckY + 0.16, s * (W / 2 - 0.02)]}>
          <boxGeometry args={[L * 0.94, 0.24, 0.03]} />
          <meshStandardMaterial color={METAL} roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}:${sz}`}
            position={[sx * (L / 2 - 0.22), wheelR * 0.95, sz * (W / 2 - 0.05)]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[wheelR, wheelR, 0.1, 14]} />
            <meshStandardMaterial color={DARK} roughness={0.9} />
          </mesh>
        ))
      )}
      {/* Tow hitch, folded down to the ground at the front — parked, not
          being towed. */}
      <Strut from={[L / 2 - 0.1, deckY, 0]} to={[L / 2 + 0.55, 0.05, 0]} r={0.03} />
      {/* Two strapped crates riding the bed, off-center and at a slight yaw
          so the cart reads as loaded rather than as a display stand. */}
      <group position={[-0.25, deckY + 0.22, 0.12]}>
        <mesh>
          <boxGeometry args={[0.6, 0.36, 0.5]} />
          <meshStandardMaterial color={CRATE_WHITE} roughness={0.65} />
        </mesh>
      </group>
      <group position={[0.4, deckY + 0.19, -0.15]} rotation={[0, 0.4, 0]}>
        <mesh>
          <boxGeometry args={[0.45, 0.26, 0.4]} />
          <meshStandardMaterial color={MLI_GOLD} roughness={0.55} metalness={0.2} />
        </mesh>
      </group>
    </group>
  )
}

// A touchdown mark for hardware that lands directly on graded regolith
// rather than a full engineered pad — see `LandingPad`/`PAD_SCORCH` for the
// paved version every full lander race entry gets. Concentric discs
// darkening toward the core, each a hair proud of the last exactly like
// `LandingPad`'s own touchdown rings, so the two techniques read as the same
// house style at two different budgets.
function ScorchMark({ r = 2.0 }: { r?: number }) {
  const rings: Array<{ radius: number; color: string; y: number }> = [
    { radius: r, color: TAILINGS_COLOR, y: 0.01 },
    { radius: r * 0.62, color: '#726d61', y: 0.02 },
    { radius: r * 0.3, color: '#54514a', y: 0.03 },
  ]
  return (
    <group>
      {rings.map((ring, i) => (
        <mesh key={i} position={[0, ring.y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[ring.radius, 32]} />
          <meshStandardMaterial color={ring.color} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Logistics prop library — reusable, "operational" small clutter
// ---------------------------------------------------------------------------
//
// Everything above this line (CargoPallet, CableReel, TailingsPile,
// UtilityCart, ScorchMark) is one-off clutter, each authored once for the
// spot it was needed. This is a small standardized FAMILY instead: every
// kilogram that reaches the Moon is manifested cargo, so nothing here is a
// bare box — every prop is either a recognizable logistics unit (a crate
// family with corner handles and a placard, not one cube reused), something
// staged for a specific job (spare parts racked beside a wheel, bricks
// palletized for a pour), or something already doing work (a battery rack
// mid-charge, a junction box with its runs actually terminating in it).
//
// Reused, not redesigned, the same way the earlier clutter pass's props are:
// each takes a small `seed` for deterministic yaw/variant/color variation so
// three of the same call don't read as one mesh copy-pasted, and every
// dimension is real meters like everything else in this file.

const CRATE_GRAY = '#9a9d97' // second hard-case tone — a run of crates in one color reads as one mesh reused
const STENCIL_DARK = '#2b2c2c'
const HAZARD = '#d99a2b'
const BATTERY_CASE = '#3f4550'
const BATTERY_TRIM = '#232830'
const CHARGE_GREEN = '#5fe07a' // a battery's own status light — never a team's accent, real hardware included
const TANK_BODY = '#6d8890'
const BRICK_COLOR = '#9c9184' // sintered/pressed regolith paver — warmer, more uniform than loose TAILINGS_COLOR spoil

type CrateVariant = 'small' | 'medium' | 'large' | 'case'

const CRATE_DIMS: Record<CrateVariant, [number, number, number]> = {
  small: [0.5, 0.42, 0.42],
  medium: [0.85, 0.62, 0.62],
  large: [1.25, 0.88, 0.85],
  // A long, low case rather than a cube — antenna sections, drill strings,
  // and instrument packages all ship in this proportion, not a box.
  case: [1.55, 0.32, 0.38],
}
const CRATE_VARIANTS: CrateVariant[] = ['small', 'medium', 'large', 'case']

// One standardized hard-sided cargo crate, in one of four size/proportion
// families rather than one cube resized — "use three or four crate sizes
// rather than one repeated cube" is the whole brief this answers. Corner
// reinforcement blocks double as the handles a suited crew would actually
// grab, and the stenciled placard plus hazard-corner stripe are what read as
// "manifested cargo" instead of a rendering primitive.
export function CargoCrate({
  variant = 'medium',
  seed = 0,
}: {
  variant?: CrateVariant
  seed?: number
}) {
  const [w, h, d] = CRATE_DIMS[variant]
  const body = hash1(seed * 13 + 1) > 0.5 ? CRATE_GRAY : CRATE_WHITE
  const yaw = hash1(seed * 13 + 2) * Math.PI * 2
  const corner = Math.min(w, d) * 0.09
  const corners: [number, number][] = [
    [-w / 2 + corner / 2, -d / 2 + corner / 2],
    [w / 2 - corner / 2, -d / 2 + corner / 2],
    [-w / 2 + corner / 2, d / 2 - corner / 2],
    [w / 2 - corner / 2, d / 2 - corner / 2],
  ]
  return (
    <group position={[0, h / 2, 0]} rotation={[0, yaw, 0]}>
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={body} roughness={0.55} metalness={0.15} />
      </mesh>
      {corners.map(([cx, cz], i) => (
        <mesh key={i} position={[cx, 0, cz]}>
          <boxGeometry args={[corner, h * 1.02, corner]} />
          <meshStandardMaterial color={METAL} roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, h * 0.12, d / 2 + 0.002]}>
        <planeGeometry args={[w * 0.4, h * 0.22]} />
        <meshStandardMaterial color={STENCIL_DARK} roughness={0.8} />
      </mesh>
      <mesh position={[-w / 2 + corner * 1.4, h / 2 - 0.03, d / 2 + 0.001]}>
        <planeGeometry args={[corner * 1.6, 0.05]} />
        <meshStandardMaterial color={HAZARD} roughness={0.7} />
      </mesh>
    </group>
  )
}

// A small staged cluster of crates — the shape an actual pallet-load takes
// once broken down for storage, not a grid — cycling all four size families
// so a run of these across a site never reads as one box repeated.
export function CrateCluster({
  count = 4,
  seed = 0,
  spread = 1.4,
}: {
  count?: number
  seed?: number
  spread?: number
}) {
  const crates = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const k = seed * 31 + i * 7
      const variant = CRATE_VARIANTS[Math.floor(seed + i) % CRATE_VARIANTS.length]
      const a = hash1(k + 1) * Math.PI * 2
      const r = spread * (0.15 + hash1(k + 2) * 0.75)
      return { variant, x: Math.cos(a) * r, z: Math.sin(a) * r, seed: k }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })
  }, [count, seed, spread])
  return (
    <group>
      {crates.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]}>
          <CargoCrate variant={c.variant} seed={c.seed} />
        </group>
      ))}
    </group>
  )
}

// A spare wheel racked on edge beside a low parts pallet — cut pipe stock, a
// flange, and a coiled hose — the inventory an actually-functioning depot
// keeps beside its bays, rather than one bare wheel dropped on the regolith.
export function SparePartsPallet({ seed = 0 }: { seed?: number }) {
  const wheelR = 0.42
  const wheelW = 0.22
  const yaw = hash1(seed * 17 + 1) * Math.PI * 2
  return (
    <group rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[1.3, 0.1, 0.9]} />
        <meshStandardMaterial color={METAL} roughness={0.7} metalness={0.4} />
      </mesh>
      {/* Spare wheel, racked upright and leaned a couple degrees against a
          stop rather than lying flat — the way a wheel actually stands when
          racked rather than staged for fitting. */}
      <group position={[-0.35, 0.1 + wheelR * 0.97, 0.15]} rotation={[0, 0, 0.12]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[wheelR, wheelR, wheelW, 20]} />
          <meshStandardMaterial color="#20242c" roughness={0.9} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[wheelR * 0.34, wheelR * 0.34, wheelW * 1.05, 12]} />
          <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * wheelR * 0.67, 0, Math.sin(a) * wheelR * 0.67]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.025, 0.025, wheelW * 1.02, 6]} />
              <meshStandardMaterial color={DARK} roughness={0.7} />
            </mesh>
          )
        })}
      </group>
      {/* Cut pipe stock: short lengths staged for a run, not one long unused
          pipe. */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0.28 + i * 0.09, 0.16, -0.25]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.55, 10]} />
          <meshStandardMaterial color={METAL} metalness={0.55} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0.42, 0.13, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.09, 0.025, 8, 16]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0.05, 0.15, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.16, 0.04, 10, 20]} />
        <meshStandardMaterial color={REEL_CABLE} roughness={0.85} />
      </mesh>
    </group>
  )
}

// Battery modules racked two-high on their own skid, mid-charge — a swap
// depot's actual inventory rather than a crate repainted. Each module's
// status LED is a fixed charge-green rather than any org's accent: a
// battery's own indicator is never a team's brand color, real hardware
// included.
function BatteryStack({ seed = 0 }: { seed?: number }) {
  const w = 0.5
  const h = 0.32
  const d = 0.4
  const rows = 2
  const cols = 2
  const yaw = hash1(seed * 19 + 1) * Math.PI * 2
  return (
    <group rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[w * cols + 0.1, 0.1, d + 0.1]} />
        <meshStandardMaterial color={METAL} roughness={0.7} metalness={0.4} />
      </mesh>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const x = (c - (cols - 1) / 2) * (w + 0.04)
          const y = 0.1 + r * (h + 0.03) + h / 2
          const charged = hash1(seed * 19 + r * 3 + c + 5) > 0.25
          const ledColor = charged ? CHARGE_GREEN : '#8a3a2a'
          return (
            <group key={`${r}:${c}`} position={[x, y, 0]}>
              <mesh>
                <boxGeometry args={[w, h, d]} />
                <meshStandardMaterial color={BATTERY_CASE} roughness={0.5} metalness={0.35} />
              </mesh>
              <mesh position={[0, 0, d / 2 + 0.002]}>
                <planeGeometry args={[w * 0.85, h * 0.22]} />
                <meshStandardMaterial color={BATTERY_TRIM} roughness={0.6} />
              </mesh>
              <mesh position={[w * 0.32, h * 0.28, d / 2 + 0.003]}>
                <circleGeometry args={[0.025, 10]} />
                <meshStandardMaterial
                  color={ledColor}
                  emissive={ledColor}
                  emissiveIntensity={1.4}
                  toneMapped={false}
                />
              </mesh>
              <mesh
                position={[-w * 0.32, -h * 0.3, d / 2 + 0.01]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[0.03, 0.03, 0.03, 10]} />
                <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.3} />
              </mesh>
            </group>
          )
        })
      )}
      {/* Charging cable off the rack's base, coiled at the foot — feeding
          the stack rather than one dropped in a vacuum. */}
      <Strut
        from={[w * cols * 0.5 + 0.05, 0.1, 0]}
        to={[w * cols * 0.5 + 0.35, 0.03, 0.1]}
        r={0.02}
        color={DARK}
      />
    </group>
  )
}

// A cubic water/feedstock tank inside its own protective strut frame — the
// shape resupply tankage actually ships and stands in, not a bare cube on
// the regolith.
function FramedTank({ seed = 0 }: { seed?: number }) {
  const s = 0.9
  const yaw = hash1(seed * 23 + 1) * Math.PI * 2
  const half = s / 2
  const corners: [number, number][] = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ]
  return (
    <group position={[0, half + 0.08, 0]} rotation={[0, yaw, 0]}>
      <mesh>
        <boxGeometry args={[s * 0.9, s * 0.9, s * 0.9]} />
        <meshStandardMaterial color={TANK_BODY} roughness={0.4} metalness={0.25} />
      </mesh>
      <mesh position={[0, half + 0.04, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.08, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.35} />
      </mesh>
      {corners.map(([cx, cz], i) => (
        <mesh key={i} position={[cx, 0, cz]}>
          <boxGeometry args={[0.055, s * 1.04, 0.055]} />
          <meshStandardMaterial color={METAL} roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      {[-half * 1.02, half * 1.02].map((y) =>
        corners.map(([cx, cz], i) => {
          const [nx, nz] = corners[(i + 1) % 4]
          return (
            <Strut key={`${y}:${i}`} from={[cx, y, cz]} to={[nx, y, nz]} r={0.03} color={METAL} />
          )
        })
      )}
    </group>
  )
}

// A utility junction box on a short post, cable stubs actually terminating
// in it from both sides — a junction connects runs, it doesn't just stand
// there. The hazard band and status LED are what read as "live
// infrastructure" rather than a mailbox.
function JunctionBox({ accent = HAZARD }: { accent?: string }) {
  const postH = 0.55
  const boxW = 0.34
  const boxH = 0.4
  const boxD = 0.22
  return (
    <group>
      <mesh position={[0, postH / 2, 0]}>
        <cylinderGeometry args={[0.045, 0.05, postH, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} />
      </mesh>
      <group position={[0, postH + boxH / 2, 0]}>
        <mesh>
          <boxGeometry args={[boxW, boxH, boxD]} />
          <meshStandardMaterial color={BATTERY_CASE} roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0, boxH * 0.32, boxD / 2 + 0.002]}>
          <planeGeometry args={[boxW * 0.94, 0.035]} />
          <meshStandardMaterial color={accent} roughness={0.6} />
        </mesh>
        <mesh position={[0, -boxH * 0.05, boxD / 2 + 0.003]}>
          <planeGeometry args={[boxW * 0.7, boxH * 0.5]} />
          <meshStandardMaterial color={STENCIL_DARK} roughness={0.7} metalness={0.1} />
        </mesh>
        <mesh position={[0, boxH * 0.42, boxD / 2 + 0.004]}>
          <circleGeometry args={[0.02, 10]} />
          <meshStandardMaterial
            color={CHARGE_GREEN}
            emissive={CHARGE_GREEN}
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>
      </group>
      {[-1, 1].map((s) => (
        <Strut key={s} from={[0, 0.08, 0]} to={[s * 0.5, 0.04, s * 0.15]} r={0.025} color={DARK} />
      ))}
    </group>
  )
}

// A portable tripod work light — folding legs and a foot-mounted battery
// pack, the temporary rig an active work site actually runs on. Kept
// visually distinct from the depot's fixed, cranked-over yard masts
// (`DepotLightMast`): shorter, three-legged, and clearly meant to be struck
// and moved rather than planted.
function WorkLightTower({ on = true }: { on?: boolean }) {
  const headH = 1.9
  const legs = [0, 120, 240].map((deg) => (deg * Math.PI) / 180)
  return (
    <group>
      {legs.map((a, i) => (
        <Strut
          key={i}
          from={[0, headH, 0]}
          to={[Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55]}
          r={0.025}
          color={METAL}
        />
      ))}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.22, 0.12, 0.16]} />
        <meshStandardMaterial color={DARK} roughness={0.6} />
      </mesh>
      <mesh position={[0, headH + 0.08, 0]}>
        <boxGeometry args={[0.28, 0.16, 0.1]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, headH + 0.08, 0.07]} rotation={[Math.PI * 0.42, 0, 0]}>
        <circleGeometry args={[0.11, 16]} />
        <meshStandardMaterial
          color={on ? '#eef2ff' : HULL_DARK}
          emissive={on ? '#dfe6ff' : '#000000'}
          emissiveIntensity={on ? 2.2 : 0}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// A towed single-axle cargo trailer, loaded — bigger paired wheels and a
// raised, unhitched tow tongue distinguish it from `UtilityCart`'s four
// small casters (which is parked rather than ever meant to be hitched).
function CargoTrailer({ seed = 0 }: { seed?: number }) {
  const L = 2.1
  const W = 1.15
  const deckY = 0.5
  const wheelR = 0.3
  return (
    <group>
      <mesh position={[0, deckY, 0]}>
        <boxGeometry args={[L, 0.08, W]} />
        <meshStandardMaterial color={METAL} roughness={0.7} metalness={0.3} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, deckY + 0.16, s * (W / 2 - 0.02)]}>
          <boxGeometry args={[L * 0.92, 0.26, 0.03]} />
          <meshStandardMaterial color={METAL} roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[0, wheelR, s * (W / 2 + 0.06)]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[wheelR, wheelR, 0.16, 16]} />
          <meshStandardMaterial color="#20242c" roughness={0.9} />
        </mesh>
      ))}
      <Strut
        from={[0, wheelR, -W / 2 - 0.06]}
        to={[0, wheelR, W / 2 + 0.06]}
        r={0.04}
        color={DARK}
      />
      {/* Raised tow tongue at the front, unhitched — parked rather than
          mid-tow. */}
      <Strut from={[L / 2 - 0.1, deckY, 0]} to={[L / 2 + 0.75, deckY + 0.4, 0]} r={0.035} />
      <group position={[-0.3, deckY + 0.04, 0]}>
        <CargoCrate variant="medium" seed={seed} />
      </group>
      <group position={[0.45, deckY + 0.04, 0.15]} rotation={[0, 0.5, 0]}>
        <CargoCrate variant="small" seed={seed + 3} />
      </group>
    </group>
  )
}

// A pallet stacked with regolith-brick or landing-pad-tile stock — staged
// paver units, not raw excavation spoil (see `TailingsPile` for that).
export function BrickPallet({ seed = 0 }: { seed?: number }) {
  const brickW = 0.42
  const brickH = 0.09
  const brickD = 0.28
  const rows = 5
  const perRow = 3
  const yaw = hash1(seed * 29 + 1) * Math.PI * 2
  return (
    <group rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[brickW * perRow + 0.1, 0.1, brickD + 0.16]} />
        <meshStandardMaterial color={METAL} roughness={0.7} metalness={0.4} />
      </mesh>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: perRow }, (_, c) => {
          const x = (c - (perRow - 1) / 2) * (brickW + 0.01)
          const y = 0.1 + r * brickH + brickH / 2
          return (
            <mesh key={`${r}:${c}`} position={[x, y, 0]}>
              <boxGeometry args={[brickW * 0.96, brickH * 0.92, brickD]} />
              <meshStandardMaterial color={BRICK_COLOR} roughness={0.95} />
            </mesh>
          )
        })
      )}
      {[-0.14, 0.14].map((dx) => (
        <mesh key={dx} position={[dx, 0.1 + rows * brickH + 0.01, 0]}>
          <boxGeometry args={[0.03, 0.02, brickD + 0.1]} />
          <meshStandardMaterial color={STRAP_DARK} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

// A survey tripod with its instrument head — what an active construction or
// pad-layout site is actually staked out with, not decoration.
function SurveyTripod({ seed = 0 }: { seed?: number }) {
  const headH = 1.1
  const legs = [30, 150, 270].map(
    (deg) => (deg * Math.PI) / 180 + hash1(seed * 3 + 1) * 0.3
  )
  return (
    <group rotation={[0, hash1(seed * 3 + 2) * Math.PI * 2, 0]}>
      {legs.map((a, i) => (
        <Strut
          key={i}
          from={[0, headH, 0]}
          to={[Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5]}
          r={0.022}
          color={METAL}
        />
      ))}
      <mesh position={[0, headH + 0.06, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.12, 12]} />
        <meshStandardMaterial color={DARK} roughness={0.6} />
      </mesh>
      <mesh
        position={[0, headH + 0.15, 0]}
        rotation={[0, hash1(seed * 3 + 3) * Math.PI * 2, 0]}
      >
        <boxGeometry args={[0.1, 0.08, 0.14]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, headH + 0.15, 0.08]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial
          color="#dfe6ff"
          emissive="#dfe6ff"
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Base-wide filler — native rock for the open ground between districts
// ---------------------------------------------------------------------------
//
// Everything above this point is manifested cargo or built infrastructure:
// every prop reads as something that arrived on a lander or got assembled on
// site. The open regolith BETWEEN districts is neither — it's unclaimed
// native ground, and on an airless, ungraded body that ground is not
// perfectly bare. It's strewn with impact ejecta at every scale. `Boulder`/
// `BoulderCluster` are the one family in this file drawn from that instead
// of from the colony's own manifest, placed by `InterDistrictFiller` in
// MarkerLayer.tsx well clear of every district's ground (see
// `withinDistrictGround` in baseplan.ts) so native rock never reads as
// clutter dropped in somebody's lot.

const BOULDER_GEO = new THREE.IcosahedronGeometry(1, 0) // 0 subdivisions: angular facets read as fractured rock, not the smoother TAILINGS_LUMP_GEO worked-spoil look
const BOULDER_COLOR_A = '#7d7972'
const BOULDER_COLOR_B = '#8f8b82'

// A single weathered boulder: non-uniformly scaled and tipped off-axis so it
// reads as an irregular fractured rock rather than a squashed sphere, sunk a
// little into the ground so it sits embedded rather than resting on top of
// the regolith.
function Boulder({ size = 1, seed = 0 }: { size?: number; seed?: number }) {
  const sx = size * (0.75 + hash1(seed * 41 + 1) * 0.5)
  const sy = size * (0.55 + hash1(seed * 41 + 2) * 0.45)
  const sz = size * (0.75 + hash1(seed * 41 + 3) * 0.5)
  const yaw = hash1(seed * 41 + 4) * Math.PI * 2
  const tilt = (hash1(seed * 41 + 5) - 0.5) * 0.5
  const bury = sy * 0.32
  const color = hash1(seed * 41 + 6) > 0.5 ? BOULDER_COLOR_A : BOULDER_COLOR_B
  return (
    <mesh
      geometry={BOULDER_GEO}
      position={[0, sy - bury, 0]}
      rotation={[tilt, yaw, tilt * 0.6]}
      scale={[sx, sy, sz]}
    >
      <meshStandardMaterial color={color} roughness={1} flatShading />
    </mesh>
  )
}

// One to three boulders grouped the way ejecta actually lands — one
// dominant rock with a couple of smaller fragments nearby — rather than
// evenly sized rocks spaced on a grid, so a field of these reads as scatter
// rather than as one rock model repeated at a fixed size.
export function BoulderCluster({
  seed = 0,
  size = 1,
}: {
  seed?: number
  size?: number
}) {
  const items = useMemo(() => {
    const extras = Math.floor(hash1(seed * 53 + 1) * 3)
    const arr = [{ x: 0, z: 0, s: size, k: seed * 53 + 2 }]
    for (let i = 0; i < extras; i++) {
      const k = seed * 53 + 10 + i * 4
      const a = hash1(k + 1) * Math.PI * 2
      const r = size * (0.85 + hash1(k + 2) * 0.7)
      arr.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        s: size * (0.25 + hash1(k + 3) * 0.35),
        k: k + 4,
      })
    }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, size])
  return (
    <group>
      {items.map((it, i) => (
        <group key={i} position={[it.x, 0, it.z]}>
          <Boulder size={it.s} seed={it.k} />
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Excavator — ambient construction hardware, not a competitor's model
// ---------------------------------------------------------------------------
//
// Scattered by `InterDistrictFiller` in MarkerLayer.tsx the same way boulders
// and roadside cargo are: base-wide scenery that reads as the settlement's
// own grading/earthmoving fleet at work along the roads, unaffiliated with
// any org's race entry (compare `RoverBody` for the same "generic, no
// accent" treatment). Built to the same standard as an actual competitor
// model like `CruiserRover` — layered panel lines, glazing with real
// envMapIntensity, hydraulic rams alongside every boom member rather than a
// single bare cylinder — rather than the flat-primitive treatment that
// works for a crate or a boulder but reads as a placeholder on something
// this size and this close to the road.

const EXC_HULL = '#e3e6ea' // main bodywork, a shade brighter than the shared HULL
const EXC_SHADE = '#8f95a0' // wheel-arch / skirt shading, matches CRU_SHADE's role
const EXC_TRIM = '#33383f' // frame rails, pins, roof trim
const EXC_GLASS = '#173042' // canopy glazing base tone, lit through envMapIntensity
const EXC_GLASS_BRACE = '#8be8ff' // interior brace glowing through the glass
const EXC_BEACON = '#ffb454' // rotating hazard beacon, work-light amber
const EXC_TRACK_DARK = '#1b1d22'

const EXC_TRACK_LEN = 2.6
const EXC_TRACK_W = 0.58
const EXC_TRACK_H = 0.52
const EXC_TRACK_GAUGE = 2.05 // center-to-center distance between the two tracks
const EXC_ROLLER_R = EXC_TRACK_H / 2
const EXC_TURRET_R = 1.02
const EXC_TURRET_H = 0.22
const EXC_BODY_D = 1.9
const EXC_BODY_W = 1.7
const EXC_BODY_H = 0.98
const EXC_DECK_Y = EXC_TRACK_H + EXC_TURRET_H
const EXC_BODY_Y = EXC_DECK_Y + EXC_BODY_H / 2

// One track unit: a frame rail over a row of road rollers, a drive sprocket
// and idler at the ends, and a lugged belt — the same "layer several
// primitives instead of one box" treatment `CruiserRover`'s wheel arches use,
// just applied to a tracked undercarriage instead of a wheeled one.
function ExcavatorTrack({ side }: { side: 1 | -1 }) {
  const z = (side * EXC_TRACK_GAUGE) / 2
  const rollerCount = 5
  const rollerSpan = EXC_TRACK_LEN - EXC_TRACK_H - 0.3
  return (
    <group position={[0, EXC_TRACK_H / 2, z]}>
      {/* belt */}
      <mesh>
        <boxGeometry args={[EXC_TRACK_LEN, EXC_TRACK_H, EXC_TRACK_W]} />
        <meshStandardMaterial color={EXC_TRACK_DARK} roughness={0.9} />
      </mesh>
      {/* drive sprocket + idler at each end, with a hub cap so they read as
          driven wheels rather than the belt's own rounded corners */}
      {[-1, 1].map((end) => (
        <group key={end} position={[end * (EXC_TRACK_LEN / 2 - EXC_TRACK_H / 2), 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[EXC_TRACK_H / 2, EXC_TRACK_H / 2, EXC_TRACK_W + 0.04, 16]} />
            <meshStandardMaterial color={EXC_TRIM} metalness={0.55} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0, side * (EXC_TRACK_W / 2 + 0.02)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[EXC_TRACK_H / 2 - 0.05, EXC_TRACK_H / 2 - 0.05, 0.05, 16]} />
            <meshStandardMaterial color={METAL} metalness={0.65} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, side * (EXC_TRACK_W / 2 + 0.05)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.04, 10]} />
            <meshStandardMaterial color={DARK} metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* road rollers along the top run, under a frame rail */}
      {Array.from({ length: rollerCount }, (_, i) => {
        const x = -rollerSpan / 2 + (i * rollerSpan) / (rollerCount - 1)
        return (
          <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[EXC_ROLLER_R - 0.03, EXC_ROLLER_R - 0.03, EXC_TRACK_W - 0.06, 14]} />
            <meshStandardMaterial color={EXC_TRIM} metalness={0.5} roughness={0.5} />
          </mesh>
        )
      })}
      <mesh position={[0, EXC_TRACK_H / 2 + 0.02, 0]}>
        <boxGeometry args={[EXC_TRACK_LEN - EXC_TRACK_H * 0.6, 0.09, EXC_TRACK_W + 0.06]} />
        <meshStandardMaterial color={EXC_TRIM} metalness={0.4} roughness={0.55} />
      </mesh>
      {/* lugged belt */}
      {Array.from({ length: 16 }, (_, i) => {
        const x = -EXC_TRACK_LEN / 2 + 0.15 + i * ((EXC_TRACK_LEN - 0.3) / 15)
        return (
          <mesh key={i} position={[x, -EXC_TRACK_H / 2 + 0.01, 0]}>
            <boxGeometry args={[0.07, 0.05, EXC_TRACK_W + 0.06]} />
            <meshStandardMaterial color="#0d0e11" roughness={0.95} />
          </mesh>
        )
      })}
    </group>
  )
}

// Turntable ring connecting the tracked undercarriage to the upper works —
// the joint that, on a real excavator, is what actually lets the house swing
// independent of the tracks. Static here, but modeling the ring is what
// keeps the hull from reading as bolted straight to the chassis.
function ExcavatorTurret() {
  return (
    <group position={[0, EXC_TRACK_H + EXC_TURRET_H / 2, 0]}>
      <mesh>
        <cylinderGeometry args={[EXC_TURRET_R, EXC_TURRET_R * 0.94, EXC_TURRET_H, 24]} />
        <meshStandardMaterial color={EXC_TRIM} metalness={0.5} roughness={0.5} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * (EXC_TURRET_R - 0.05), EXC_TURRET_H / 2, Math.sin(a) * (EXC_TURRET_R - 0.05)]}
          >
            <cylinderGeometry args={[0.025, 0.025, 0.05, 8]} />
            <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.35} />
          </mesh>
        )
      })}
    </group>
  )
}

// The house: a shouldered hull built from stacked, progressively inset boxes
// (skirt → lower body → upper body → roof deck) the same way CruiserRover's
// cabin reads as glazing on a shoulder line instead of one slab, plus a
// framed canopy over the compute/sensor bay, a ribbed rear counterweight,
// a roof-mounted solar array for a machine with no engine to run off, and a
// hazard beacon.
function ExcavatorCab() {
  return (
    <group position={[0, EXC_BODY_Y, 0]}>
      {/* skirt */}
      <mesh position={[0, -EXC_BODY_H / 2 - 0.07, 0]}>
        <boxGeometry args={[EXC_BODY_D + 0.1, 0.16, EXC_BODY_W + 0.1]} />
        <meshStandardMaterial color={EXC_SHADE} roughness={0.6} metalness={0.15} />
      </mesh>
      {/* lower body */}
      <mesh position={[0.05, -EXC_BODY_H * 0.18, 0]}>
        <boxGeometry args={[EXC_BODY_D - 0.1, EXC_BODY_H * 0.62, EXC_BODY_W - 0.06]} />
        <meshStandardMaterial color={EXC_SHADE} roughness={0.55} metalness={0.2} />
      </mesh>
      {/* upper body */}
      <mesh position={[0.05, EXC_BODY_H * 0.16, 0]}>
        <boxGeometry args={[EXC_BODY_D - 0.18, EXC_BODY_H * 0.56, EXC_BODY_W - 0.16]} />
        <meshStandardMaterial color={EXC_HULL} roughness={0.5} metalness={0.18} />
      </mesh>
      {/* roof deck */}
      <mesh position={[0.05, EXC_BODY_H / 2 - 0.03, 0]}>
        <boxGeometry args={[EXC_BODY_D - 0.1, 0.1, EXC_BODY_W - 0.06]} />
        <meshStandardMaterial color={EXC_HULL} roughness={0.5} metalness={0.18} />
      </mesh>
      {/* ribbed counterweight, opposite the arm's reach */}
      <mesh position={[-EXC_BODY_D / 2 - 0.09, -0.04, 0]}>
        <boxGeometry args={[0.2, EXC_BODY_H * 0.72, EXC_BODY_W * 0.9]} />
        <meshStandardMaterial color={EXC_TRIM} roughness={0.6} metalness={0.35} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => {
        const z = -EXC_BODY_W * 0.4 + (i * (EXC_BODY_W * 0.8)) / 4
        return (
          <mesh key={i} position={[-EXC_BODY_D / 2 - 0.19, -0.04, z]}>
            <boxGeometry args={[0.03, EXC_BODY_H * 0.68, 0.06]} />
            <meshStandardMaterial color={DARK} roughness={0.65} metalness={0.3} />
          </mesh>
        )
      })}

      {/* canopy over the compute/sensor bay: a proper glazed box with a
          frame instead of one glass slab, plus the internal brace glowing
          through it. Offset toward the arm side, mirroring how a real
          excavator's cab sits opposite its counterweight. */}
      <group position={[EXC_BODY_D * 0.12, EXC_BODY_H / 2 + 0.18, EXC_BODY_W * 0.06]}>
        <mesh position={[0, -0.16, 0]}>
          <boxGeometry args={[0.86, 0.08, 0.8]} />
          <meshStandardMaterial color={EXC_TRIM} metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.8, 0.34, 0.74]} />
          <meshStandardMaterial
            color={EXC_GLASS}
            roughness={0.12}
            metalness={0.6}
            envMapIntensity={1.6}
          />
        </mesh>
        {/* corner pillars framing the glazing */}
        {[
          [-0.39, -0.35],
          [-0.39, 0.35],
          [0.39, -0.35],
          [0.39, 0.35],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, 0, z]}>
            <boxGeometry args={[0.06, 0.36, 0.06]} />
            <meshStandardMaterial color={EXC_TRIM} metalness={0.5} roughness={0.45} />
          </mesh>
        ))}
        <mesh position={[0, 0.18, 0]}>
          <boxGeometry args={[0.84, 0.05, 0.78]} />
          <meshStandardMaterial color={EXC_TRIM} metalness={0.45} roughness={0.5} />
        </mesh>
        <Strut from={[-0.32, 0, -0.3]} to={[0.32, 0, 0.3]} r={0.022} color={EXC_GLASS_BRACE} glow={1.1} />
        <Strut from={[0.32, 0, -0.3]} to={[-0.32, 0, 0.3]} r={0.022} color={EXC_GLASS_BRACE} glow={1.1} />
      </group>

      {/* roof solar array, tilted toward the sun-facing side */}
      <group position={[-EXC_BODY_D * 0.14, EXC_BODY_H / 2 + 0.08, 0]} rotation={[0, 0, 0.08]}>
        {[-1, 0, 1].map((i) => (
          <mesh key={i} position={[0, 0.02, i * 0.42]}>
            <boxGeometry args={[0.62, 0.04, 0.36]} />
            <meshStandardMaterial color={PANEL} metalness={0.15} roughness={0.4} />
          </mesh>
        ))}
      </group>

      {/* hazard beacon on a short mast */}
      <group position={[0, EXC_BODY_H / 2 + 0.06, -EXC_BODY_W * 0.34]}>
        <mesh position={[0, 0.13, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.26, 8]} />
          <meshStandardMaterial color={METAL} metalness={0.55} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.29, 0]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial
            color={EXC_BEACON}
            emissive={EXC_BEACON}
            emissiveIntensity={2.2}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* forward work lights, low on the hull facing the arm's reach */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[EXC_BODY_D / 2 - 0.06, -EXC_BODY_H * 0.24, s * EXC_BODY_W * 0.32]}>
          <boxGeometry args={[0.04, 0.1, 0.14]} />
          <meshStandardMaterial
            color="#fff6de"
            emissive="#fff6de"
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

// A parallel pair of beams from A to B, tapering slightly toward B, plus a
// hydraulic ram mounted alongside — the actuator every real boom/stick/
// bucket joint is driven by, and the single detail that reads as "hydraulic
// excavator" rather than "robot arm." `rodExtend` is how far out of its
// barrel the ram's piston sits, which is what lets the same component pose
// as either fully retracted (arm folded) or extended (arm reaching).
function ExcavatorMember({
  from,
  to,
  width,
  rodExtend = 0.5,
  ramSide = 1,
}: {
  from: [number, number, number]
  to: [number, number, number]
  width: number
  rodExtend?: number
  ramSide?: 1 | -1
}) {
  const a = new THREE.Vector3(...from)
  const b = new THREE.Vector3(...to)
  const mid = a.clone().add(b).multiplyScalar(0.5)
  const axis = b.clone().sub(a)
  const len = axis.length() || 1e-6
  const quat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(MODEL_UP, axis.clone().normalize()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from[0], from[1], from[2], to[0], to[1], to[2]]
  )
  // A perpendicular offset for the ram, in the member's local frame (off the
  // X axis once rotated by `quat`), then rotated into world space.
  const perp = new THREE.Vector3(ramSide * (width * 0.62), 0, 0).applyQuaternion(quat)
  const ramBarrelLen = len * 0.55
  const ramA = a.clone().add(perp.clone().multiplyScalar(0.3))
  const ramBarrelB = a
    .clone()
    .lerp(b, ramBarrelLen / len)
    .add(perp)
  const ramRodB = a
    .clone()
    .lerp(b, (ramBarrelLen + rodExtend) / len)
    .add(perp)
  return (
    <group>
      <mesh position={mid} quaternion={quat}>
        <boxGeometry args={[width, len, width * 0.72]} />
        <meshStandardMaterial color={EXC_HULL} roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={mid} quaternion={quat}>
        <boxGeometry args={[width * 0.72, len - width * 0.1, width * 0.78]} />
        <meshStandardMaterial color={EXC_SHADE} roughness={0.55} metalness={0.15} />
      </mesh>
      <Strut from={ramA.toArray() as Vec3} to={ramBarrelB.toArray() as Vec3} r={width * 0.24} color={EXC_TRIM} />
      <Strut from={ramBarrelB.toArray() as Vec3} to={ramRodB.toArray() as Vec3} r={width * 0.11} color={METAL} />
    </group>
  )
}

// A wide bucket: an open trapezoidal shell (back plate, two tapered side
// plates, a curled underside) plus a rocker-link tying it to the stick, the
// way a real bucket curls on a 4-bar linkage rather than a rigid extension
// of the arm.
function ExcavatorBucket({
  position,
  rotation,
}: {
  position: [number, number, number]
  rotation: [number, number, number]
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[-0.14, 0.05, 0]}>
        <boxGeometry args={[0.1, 0.44, 0.62]} />
        <meshStandardMaterial color={EXC_TRIM} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0.1, -0.02, 0]} rotation={[0, 0, -0.32]}>
        <boxGeometry args={[0.5, 0.4, 0.58]} />
        <meshStandardMaterial color={METAL} metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0.32, -0.24, 0]} rotation={[0, 0, -0.62]}>
        <boxGeometry args={[0.3, 0.34, 0.56]} />
        <meshStandardMaterial color={METAL} metalness={0.55} roughness={0.4} />
      </mesh>
      {/* rocker link back to the stick's wrist pin */}
      <Strut from={[-0.14, 0.24, 0]} to={[-0.02, 0.5, 0]} r={0.05} color={EXC_TRIM} />
      {Array.from({ length: 5 }, (_, i) => {
        const z = -0.24 + i * 0.12
        return (
          <mesh key={i} position={[0.5, -0.42, z]} rotation={[0, 0, Math.PI / 2 - 0.62]}>
            <coneGeometry args={[0.055, 0.17, 8]} />
            <meshStandardMaterial color={DARK} metalness={0.4} roughness={0.5} />
          </mesh>
        )
      })}
    </group>
  )
}

// Fixed boom/stick link lengths — now that the arm actually rotates at its
// own joints (see `digging` below) rather than being posed once from static
// absolute points, a rigid link's own length never changes, only the angle
// between links does.
const EXC_BOOM_LEN = 1.7
const EXC_STICK_LEN = 1.75

// Four hand-posed keyframes of one real dig cycle — reach out and bite,
// curl the bucket through the load, hoist the loaded bucket up and swing
// back, tip it to dump — each a [boom, stick, bucket] triple in radians.
// Boom is measured off horizontal at the shoulder; stick and bucket are each
// relative to the link they're mounted on (a stick angle is how far it's
// bent off the BOOM's own line, not off horizontal), so nesting the three
// rotating groups directly reproduces the pose without any extra math.
//
// Boom stays in a narrow, always-slightly-upward band across every keyframe
// on purpose. The shoulder pivot sits at the REAR corner of the hull, right
// at roof height (see `shoulderPos` below) — exactly like a real excavator's
// king-pin, which is why a real one never dips its BOOM down; it keeps the
// boom raised and lets the stick do the reaching. Any keyframe that swings
// the boom down past ~horizontal drags the whole link back down through the
// cab and turret it pivots from, since the pivot itself is still directly
// over the hull — that's the "arm phasing through the body" bug this exact
// range fixes. The stick supplies all the real reach, from nearly straight
// down (K0) to curled back up over the boom (K2), while staying forward of
// the elbow (see the excavator's own shoulder mount) the entire time so it
// never sweeps back across the hull either.
const EXC_DIG_POSES: [number, number, number][] = [
  [0.15, -1.35, -0.3], // reach down and forward, bucket angled to bite
  [0.2, -0.95, 1.0], // curl the bucket up through the load
  [0.15, 0.55, 0.85], // hoist the loaded bucket up and back
  [0.2, 0.15, -0.35], // tip the bucket, dumping the load
]

function smoothstep01(x: number): number {
  const t = Math.max(0, Math.min(1, x))
  return t * t * (3 - 2 * t)
}

// Blends between EXC_DIG_POSES around the cycle with smoothstep easing at
// each keyframe, the same "a boom has mass, it slows into and out of every
// reversal" reasoning PrinterGantry's own boom slew already uses — a linear
// blend snaps at each keyframe instead of settling into it.
function excDigPose(p: number): [number, number, number] {
  const n = EXC_DIG_POSES.length
  const cyc = ((p % 1) + 1) % 1
  const seg = cyc * n
  const i = Math.floor(seg) % n
  const f = smoothstep01(seg - Math.floor(seg))
  const a = EXC_DIG_POSES[i]
  const b = EXC_DIG_POSES[(i + 1) % n]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

// The full machine: tracked undercarriage, turret, hull, and a
// boom/stick/bucket arm mounted off one rear corner — the same asymmetric
// mount the reference concept uses, sized here to a real compact
// excavator's proportions rather than a toy scale. `seed` jitters the arm's
// resting pose a little so a handful scattered along the roads read as a
// fleet mid-shift rather than one model copy-pasted (see `Boulder`'s own
// seeded variation for the same reasoning). `digging` swaps that static rest
// pose for a continuously looping dig cycle, driving the boom/stick/bucket
// joints directly off refs each frame (see EXC_DIG_POSES) instead of
// re-deriving absolute points on every render — the same imperative-ref
// pattern AstronautRig's stride and PrinterGantry's slew already use.
export function Excavator({
  seed = 0,
  digging = false,
}: {
  seed?: number
  digging?: boolean
}) {
  const shoulderRef = useRef<THREE.Group>(null)
  const elbowRef = useRef<THREE.Group>(null)
  const wristRef = useRef<THREE.Group>(null)
  // A few seconds either way per machine, so a handful of these digging at
  // once don't all swing in lockstep.
  const period = 6 + hash1(seed * 7 + 5) * 2
  const phase = hash1(seed * 7 + 6) * period

  useFrame((state) => {
    if (!digging) return
    const p = (state.clock.elapsedTime + phase) / period
    const [boom, stick, bucket] = excDigPose(p)
    if (shoulderRef.current) shoulderRef.current.rotation.z = boom
    if (elbowRef.current) elbowRef.current.rotation.z = stick
    if (wristRef.current) wristRef.current.rotation.z = bucket
  })

  const armZ = EXC_BODY_W / 2 - 0.22
  const shoulderPos: [number, number, number] = [
    -EXC_BODY_D / 2 + 0.24,
    EXC_BODY_Y + EXC_BODY_H / 2 - 0.05,
    armZ,
  ]
  // A parked machine rests with the boom raised a little (same safe,
  // slightly-upward band EXC_DIG_POSES uses, for the same reason — see the
  // comment there) and the stick curled down toward the ground, jittered a
  // little per-seed; a digging one starts from the cycle's own first pose
  // instead (the ref-driven useFrame above takes over from there).
  const restBoom = digging ? EXC_DIG_POSES[0][0] : 0.15 + hash1(seed * 7 + 1) * 0.25
  const restStick = digging ? EXC_DIG_POSES[0][1] : -0.6 - hash1(seed * 7 + 2) * 0.5
  const restBucket = digging ? EXC_DIG_POSES[0][2] : -0.1 + hash1(seed * 7 + 3) * 0.3

  return (
    <group>
      <ExcavatorTrack side={1} />
      <ExcavatorTrack side={-1} />
      <ExcavatorTurret />
      <ExcavatorCab />
      <group ref={shoulderRef} position={shoulderPos} rotation={[0, 0, restBoom]}>
        <ExcavatorMember
          from={[0, 0, 0]}
          to={[EXC_BOOM_LEN, 0, 0]}
          width={0.26}
          rodExtend={0.55}
          ramSide={1}
        />
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.11, 0.11, 0.44, 12]} />
          <meshStandardMaterial color={EXC_TRIM} metalness={0.6} roughness={0.35} />
        </mesh>
        <group ref={elbowRef} position={[EXC_BOOM_LEN, 0, 0]} rotation={[0, 0, restStick]}>
          <ExcavatorMember
            from={[0, 0, 0]}
            to={[EXC_STICK_LEN, 0, 0]}
            width={0.2}
            rodExtend={0.4}
            ramSide={-1}
          />
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.11, 0.11, 0.44, 12]} />
            <meshStandardMaterial color={EXC_TRIM} metalness={0.6} roughness={0.35} />
          </mesh>
          <group ref={wristRef} position={[EXC_STICK_LEN, 0, 0]} rotation={[0, 0, restBucket]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.11, 0.11, 0.44, 12]} />
              <meshStandardMaterial color={EXC_TRIM} metalness={0.6} roughness={0.35} />
            </mesh>
            <ExcavatorBucket position={[0.3, -0.34, 0]} rotation={[0.18, 0, 0]} />
          </group>
        </group>
      </group>
    </group>
  )
}

const PIT_HOLE_R = 2.3 // radius of the dark "opening" patch
// This map's terrain is one continuous height-mapped shell with no seam for
// a decorative feature to cut a real void into — the same reason every other
// "sunk" object here (Boulder's own bury, TailingsPile's slight settle) only
// ever tucks a SMALL fraction of itself below grade rather than excavating
// one. So the hole itself is sold entirely by what's ABOVE grade: a dark,
// low-albedo patch standing in for the shadowed opening, a crumbling rubble
// edge around it, and the loose material a real dig would have piled up
// going out from there — not by any actual depth.
const PIT_HALO_R = 2.85
const PIT_HOLE_COLOR = '#15130f'
const PIT_HALO_COLOR = '#3a352c'
const PIT_SPOIL_GAP_DEG = 130
const PIT_SPOIL_COUNT = 10
// Real clearance above local y=0 for the two flat, ground-parallel meshes
// below — see the comment on them for why a wide flat disc needs much more
// of this than a compact prop does under a logarithmic depth buffer.
const PIT_LIFT_M = 0.18

// One shallow excavation: a dark patch (see PIT_HOLE_R above) ringed by
// TailingsPile heaps of the material it displaced, plus a scatter of small
// rubble right at the patch's own edge so the flat disc reads as a
// crumbling lip rather than a printed decal. `gapCenterRad` leaves a wedge
// of the spoil ring empty — the bearing the digging Excavator actually
// works from, so its swing never has to cross ground the scene says is
// already piled with what it dug.
function ConstructionPit({
  seed = 0,
  gapCenterRad = 0,
}: {
  seed?: number
  gapCenterRad?: number
}) {
  const spoil = useMemo(() => {
    const out: { x: number; z: number; size: number; seed: number }[] = []
    const gapHalf = (PIT_SPOIL_GAP_DEG * Math.PI) / 360
    for (let i = 0; i < PIT_SPOIL_COUNT; i++) {
      const k = seed * 97 + i * 13 + 3
      const a = hash1(k) * Math.PI * 2
      const d = Math.atan2(Math.sin(a - gapCenterRad), Math.cos(a - gapCenterRad))
      if (Math.abs(d) < gapHalf) continue
      const r = PIT_HALO_R + 0.3 + hash1(k + 1) * 1.5
      out.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        size: 0.7 + hash1(k + 2) * 0.5,
        seed: k,
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, gapCenterRad])

  const dumpPiles = useMemo(
    () =>
      [0, 1].map((i) => {
        const k = seed * 131 + i * 29 + 11
        const a = gapCenterRad + Math.PI + (hash1(k) - 0.5) * 1.3
        const r = PIT_HALO_R + 2.4 + hash1(k + 1) * 1.4
        return { x: Math.cos(a) * r, z: Math.sin(a) * r, seed: k }
      }),
    [seed, gapCenterRad]
  )

  const rubble = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const k = seed * 227 + i * 17 + 41
        const a = hash1(k) * Math.PI * 2
        const r = PIT_HOLE_R * (0.82 + hash1(k + 1) * 0.3)
        return {
          x: Math.cos(a) * r,
          z: Math.sin(a) * r,
          size: 0.14 + hash1(k + 2) * 0.22,
          seed: k,
        }
      }),
    [seed]
  )

  return (
    <group>
      {/* One disc plus a ring sharing its exact outer/inner radius, rather
          than two overlapping discs a few centimeters apart in y, so there's
          no coincident geometry for the two to fight each other over. Both
          also sit a real fraction of a meter clear of local y=0 (not flush
          with it, and nowhere near the centimeter-scale offset an earlier
          version used) — this scene runs a logarithmic depth buffer (needed
          to span orbit-to-meter scale in one camera), which loses precision
          for near-coincident surfaces far sooner than a linear buffer would,
          and a WIDE flat disc lying parallel to the local ground plane is
          the worst case for that: unlike a boulder or a track, which only
          touches the terrain at a point or a curve, every pixel of a flat
          disc is fighting the terrain at once if the two are close enough.
          PIT_LIFT_M is sized well past that risk rather than just clearing
          it, and UGC_EXTRA_LIFT_M in MarkerLayer.tsx does the same for this
          whole composite's anchor, for the same reason. */}
      <mesh position={[0, PIT_LIFT_M, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[PIT_HOLE_R, 32]} />
        <meshStandardMaterial color={PIT_HOLE_COLOR} roughness={1} />
      </mesh>
      <mesh position={[0, PIT_LIFT_M, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[PIT_HOLE_R, PIT_HALO_R, 32]} />
        <meshStandardMaterial color={PIT_HALO_COLOR} roughness={1} />
      </mesh>
      {rubble.map((r, i) => (
        <group key={i} position={[r.x, 0, r.z]}>
          <Boulder size={r.size} seed={r.seed} />
        </group>
      ))}
      {spoil.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]}>
          <TailingsPile size={s.size} seed={s.seed} />
        </group>
      ))}
      {dumpPiles.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <TailingsPile size={1.9} seed={p.seed} />
        </group>
      ))}
    </group>
  )
}

const UGC_EXCAVATOR_STANDOFF_M = 3.9

// The base's first real excavation: one animated Excavator (`digging`)
// worked up against a ConstructionPit, offset out on the excavator's own
// side (local -X) so its arm's reach lands inside the pit's dark patch —
// see the placement comment on `UndergroundConstructionSiteMarker` in
// MarkerLayer.tsx for why this whole assembly sits where it does.
export function UndergroundConstructionSite({ seed = 0 }: { seed?: number }) {
  return (
    <group>
      <ConstructionPit seed={seed} gapCenterRad={Math.PI} />
      <group position={[-UGC_EXCAVATOR_STANDOFF_M, 0, 0]}>
        <Excavator seed={seed + 1} digging />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Rover depot yard — the motor pool's own lot, not a competitor's model
// ---------------------------------------------------------------------------
//
// The rover race's actual hardware never stands here: the whole field is out
// shuttling the spine (see PATROL in baseplan.ts), so every
// competitor's own plot in this district is bare regolith by design — "a
// motor pool with its yard bare is a motor pool whose fleet is working," per
// BASE_PLAN.rover's own comment. Left literally empty, though, that reads as
// a gap in the map rather than as that story, because there is nothing built
// there to read the absence against. This is the shared fix: a paved apron
// with marked bays, charging points, and a service canopy — infrastructure
// nobody's competitor owns.
//
// It takes a real LOT at the head of the depot's own branch, at the same
// frontage off that road a competitor's plot would get, with the recharge
// station facing it across the branch. `BASE_PLAN.rover.block` is sized for
// these two rather than for the district's LTV-class roster, which is the
// honest way round: nothing in that roster ever parks, and a district's ground
// has to hold what actually stands on it. Kept a compact 13 x 10 m all the same, because a motor pool
// whose apron dwarfs the vehicles using it reads as a car park — see
// MarkerLayer's `RoverDepotSite`, which does the placement and picks the exact
// setback this footprint needs.
//
// Two of the three bays are filled, not three, and not zero: a full lot
// reads as "nobody drives today," an empty one reads as "nothing was ever
// built here," and two-of-three is the one count that reads as an active
// yard with most of its fleet out. The parked units are `RoverBody` — the
// generic, unbranded rover shape kept in this file as the fallback for a
// future competitor with no custom model yet — painted a flat neutral tone
// rather than any org's accent, since a spares/support buggy sitting idle at
// the depot must never read as one team's actual race entry benched here.
//
// Authored directly in real meters like every model in this file, but with
// no PROJECT_SIZE_M/TYPE_SIZE_M entry: it isn't a project, so MarkerLayer
// anchors it straight off a hand-computed direction with a plain
// meters-to-scene-units scale instead of going through projectScale's
// per-project normalization.

const DEPOT_STRIPE = '#e9e7df' // painted bay lines — brighter than any hardware on the lot
const DEPOT_CURB = '#5f5c53'
const DEPOT_CANOPY = '#c7cbd2'
const DEPOT_CANOPY_DARK = '#8b909b'
// A muted steel-blue, distinct from every org's own accent — the spares
// buggies' one splash of color, deliberately unaffiliated with any racer.
const DEPOT_NEUTRAL = '#8b93a0'

export const DEPOT_HALF_W = 6.5
export const DEPOT_HALF_D = 5.0

// Three bays — standing in for a support/spares unit rather than any one
// competitor's actual race entry (see the section note above).
const DEPOT_STALL_W = 3.0
const DEPOT_STALL_D = 4.0
const DEPOT_STALL_X = [-3.2, 0, 3.2]
const DEPOT_STALL_BACK_Z = -4.3
const DEPOT_STALL_FRONT_Z = DEPOT_STALL_BACK_Z + DEPOT_STALL_D // -0.3
const DEPOT_STALL_CENTER_Z = (DEPOT_STALL_BACK_Z + DEPOT_STALL_FRONT_Z) / 2
// Which bays are occupied right now — see the section note on why two, not
// three or zero.
const DEPOT_OCCUPIED = [0, 2]

// One painted bay: stripes down both long edges and a stop-line at the back,
// left open toward the aisle exactly like a real marked space. A hair proud
// of the apron (see ScorchMark for the same technique) rather than resolved
// flush with it, which is what keeps a decal from swimming into the pad
// underneath it as the camera moves.
function ParkingStall({ x }: { x: number }) {
  return (
    <group position={[x, 0.015, 0]}>
      {[-DEPOT_STALL_W / 2, DEPOT_STALL_W / 2].map((dx) => (
        <mesh key={dx} position={[dx, 0, DEPOT_STALL_CENTER_Z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.12, DEPOT_STALL_D]} />
          <meshStandardMaterial color={DEPOT_STRIPE} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, 0, DEPOT_STALL_BACK_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[DEPOT_STALL_W, 0.12]} />
        <meshStandardMaterial color={DEPOT_STRIPE} roughness={0.85} />
      </mesh>
    </group>
  )
}

// A charging point at a bay's mouth — the reason a support buggy would ever
// be parked nose-in rather than left out on the regolith. The glowing cap
// takes the district's own accent (the leading org's color, same as its
// beacon) rather than a fixed color, tying the depot's lights to whichever
// team the map currently favors without claiming the depot itself as theirs.
function ChargeBollard({ accent }: { accent: string }) {
  return (
    <group>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.8, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.83, 0]}>
        <boxGeometry args={[0.16, 0.06, 0.16]} />
        <meshStandardMaterial color={DARK} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// A yard light, boom cranked out over the aisle rather than run straight up
// its own pole — the way an actual lot light leans its fixture in over what
// it's lighting instead of down onto itself. Parameterized (rather than a
// second component) so the same fixture serves both the depot's own
// accent-colored yard lights and the neutral roadside `StreetLight` below —
// a taller pole with a longer boom reaches out over a wider road than a
// yard aisle needs.
function DepotLightMast({
  accent,
  height = 4.2,
  boomLen = 1.1,
}: {
  accent: string
  height?: number
  boomLen?: number
}) {
  const h = height
  const boomOut = boomLen * 0.5
  const headOut = boomLen * 0.95
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.09, 0.12, h, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.45} />
      </mesh>
      <group position={[0, h, 0]} rotation={[0, 0, -0.55]}>
        <mesh position={[boomOut, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, boomLen, 8]} />
          <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.45} />
        </mesh>
        <mesh position={[headOut, -0.05, 0]}>
          <coneGeometry args={[0.16, 0.22, 12]} />
          <meshStandardMaterial color={DARK} roughness={0.6} />
        </mesh>
        <mesh position={[headOut, -0.19, 0]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={2.2}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  )
}

// A neutral roadside street light — the same leaning-boom fixture as the
// depot's own yard lights, taller and longer-armed to reach a full haul
// road rather than a parking aisle, and lit a fixed cool white rather than
// any org's accent: public lighting along the spine belongs to the
// settlement, not to whichever race happens to be nearest. Placed by
// `InterDistrictFiller` in MarkerLayer.tsx along every haul route,
// clear of every district's own ground (see `withinDistrictGround` in
// baseplan.ts) — the one piece of infrastructure in this file with no
// district or competitor tied to it at all.
export function StreetLight() {
  return <DepotLightMast accent="#eef2ff" height={5.4} boomLen={1.5} />
}

// The one piece of built shelter on the lot: an open-sided canopy over a
// wheel-service bay, set back in the aisle clear of every stall. The hoist
// is what tells a carport from a maintenance bay.
// ---------------------------------------------------------------------------
// One array of the base's solar farm
// ---------------------------------------------------------------------------

// The cell grid, as a texture rather than as geometry.
//
// A real array's face is the thing that makes it read as a solar array at all:
// modules in a frame, cells in a module, an interconnect dot at every cell
// corner. Built as geometry that is hundreds of meshes for ONE array and tens
// of thousands for a field of forty, which is not a trade worth making for
// detail that is a few pixels across from any angle the camera actually takes.
//
// Two maps, because the frame and the glass are different SURFACES and not
// merely different colours. That is the whole reason the first version of this
// looked like painted cardboard: one flat colour at one roughness cannot be
// both a matte anodized rail and a sheet of glass, and it is the difference
// between them that the eye reads as glass.
function makeSolarFaceMaps(): { albedo: THREE.Texture; rough: THREE.Texture } | null {
  const SIZE = 1024
  const a = document.createElement('canvas')
  const r = document.createElement('canvas')
  a.width = a.height = r.width = r.height = SIZE
  const ac = a.getContext('2d')
  const rc = r.getContext('2d')
  if (!ac || !rc) return null

  // Modules across and down the assembly, matching the references: a tall
  // portrait module, three columns of them, three rows deep.
  const COLS = 3
  const ROWS = 3
  // Frame widths in texture pixels: the outer rail is heavier than the bars
  // between modules, which is true of every framed array and is most of what
  // gives the face its scale.
  const RAIL = 15
  const BAR = 9

  // Frame first, as the ground the modules are cut out of.
  ac.fillStyle = '#dfe4ec'
  ac.fillRect(0, 0, SIZE, SIZE)
  // Deliberately a NARROW range against the laminate below (0.42 vs 0.24 of
  // full roughness, not 0.60 vs 0.12). The contrast is what reads as glass, but
  // past a point extra contrast buys no more of that and costs stability: the
  // wider the swing between neighbouring texels, the more a half-resolved edge
  // shimmers when the camera moves.
  rc.fillStyle = '#6b6b6b' // matte: anodized rail
  rc.fillRect(0, 0, SIZE, SIZE)

  const cellW = (SIZE - 2 * RAIL - (COLS - 1) * BAR) / COLS
  const cellH = (SIZE - 2 * RAIL - (ROWS - 1) * BAR) / ROWS

  for (let cx = 0; cx < COLS; cx++) {
    for (let cy = 0; cy < ROWS; cy++) {
      const x0 = RAIL + cx * (cellW + BAR)
      const y0 = RAIL + cy * (cellH + BAR)

      // The laminate. A shallow vertical gradient rather than a flat fill: a
      // module's glass picks up the sky unevenly down its own height, and a
      // dead-flat blue is the other half of why the first version read as
      // cardboard.
      const g = ac.createLinearGradient(x0, y0, x0, y0 + cellH)
      g.addColorStop(0, '#22406e')
      g.addColorStop(0.55, '#16294f')
      g.addColorStop(1, '#1b3560')
      ac.fillStyle = g
      ac.fillRect(x0, y0, cellW, cellH)
      rc.fillStyle = '#3d3d3d' // glossy: glass over cells
      rc.fillRect(x0, y0, cellW, cellH)

      // Cells within the module, and the interconnect dot at each corner. The
      // dots are the detail the reference images actually read by, so they are
      // drawn even though each is barely a pixel on screen — in aggregate they
      // are what stops the module looking like a painted rectangle.
      // Chosen so the cells come out very nearly SQUARE on the finished
      // panel, which they are in reality and which the eye notices. The
      // texture is square and the assembly is not (6.4 x 5.6 m), so equal
      // counts here would stretch every cell by the panel's aspect ratio.
      const CELLS_X = 6
      const CELLS_Y = 5
      const gw = cellW / CELLS_X
      const gh = cellH / CELLS_Y
      ac.strokeStyle = 'rgba(150,175,220,0.26)'
      ac.lineWidth = 2.4
      for (let i = 1; i < CELLS_X; i++) {
        ac.beginPath()
        ac.moveTo(x0 + i * gw, y0)
        ac.lineTo(x0 + i * gw, y0 + cellH)
        ac.stroke()
      }
      for (let j = 1; j < CELLS_Y; j++) {
        ac.beginPath()
        ac.moveTo(x0, y0 + j * gh)
        ac.lineTo(x0 + cellW, y0 + j * gh)
        ac.stroke()
      }
      ac.fillStyle = 'rgba(198,214,238,0.3)'
      for (let i = 0; i <= CELLS_X; i++) {
        for (let j = 0; j <= CELLS_Y; j++) {
          ac.beginPath()
          ac.arc(x0 + i * gw, y0 + j * gh, 2.8, 0, Math.PI * 2)
          ac.fill()
        }
      }
      // A busbar down the middle of each module, brighter than the cell lines.
      ac.strokeStyle = 'rgba(206,220,244,0.32)'
      ac.lineWidth = 3.5
      ac.beginPath()
      ac.moveTo(x0 + cellW / 2, y0)
      ac.lineTo(x0 + cellW / 2, y0 + cellH)
      ac.stroke()
    }
  }

  // Mipmapped and trilinear, explicitly. The cell lines and interconnect dots
  // are near the finest detail this texture can carry, and a whole field of
  // them is usually seen small — sampled without mip selection they alias into
  // a crawling sparkle the moment the camera moves. Anisotropy is what keeps
  // them from smearing to mush at the grazing angles most of the field is
  // seen at, which is the other half of the same problem.
  const albedo = new THREE.CanvasTexture(a)
  albedo.colorSpace = THREE.SRGBColorSpace
  albedo.generateMipmaps = true
  albedo.minFilter = THREE.LinearMipmapLinearFilter
  albedo.magFilter = THREE.LinearFilter
  albedo.anisotropy = 16
  // The roughness map matters MORE than the albedo here, not less. Aliasing a
  // colour makes a speckled colour; aliasing roughness makes whole pixels flip
  // between matte rail and mirror glass frame to frame, which is far louder.
  const rough = new THREE.CanvasTexture(r)
  rough.generateMipmaps = true
  rough.minFilter = THREE.LinearMipmapLinearFilter
  rough.magFilter = THREE.LinearFilter
  rough.anisotropy = 16
  return { albedo, rough }
}

let SOLAR_FACE_MAPS: {
  albedo: THREE.Texture
  rough: THREE.Texture
} | null | undefined

// Built once for the whole farm and shared by every array on it, rather than
// per instance: it is the same hardware forty times over, and one 1024 canvas
// is cheaper than forty of anything.
//
// Deliberately NOT disposed on unmount, which is where this differs from the
// road surface maps in BaseRoads. Those belong to one mesh, so that mesh can
// own them; this one is shared by every array in both fields, so disposing it
// when any single array unmounts would pull the texture out from under all the
// others. It is one texture for the life of the page.
function solarFaceMaps() {
  if (SOLAR_FACE_MAPS === undefined) SOLAR_FACE_MAPS = makeSolarFaceMaps()
  return SOLAR_FACE_MAPS
}

// A single sun-tracking solar array: one framed assembly of modules on a
// torque tube, carried on two raked A-frames.
//
// This is the base's own generation, not any competitor's — see SOLAR_ARRAYS in
// baseplan.ts for where the fields stand and why. Authored in real meters.
//
// AIMED AT THE SUN, and aimed off the one place the sun is written down. The
// assembly's normal is the model's own +X, so the caller turns the whole array
// onto the sun's azimuth by handing SurfaceAnchor the sun vector as `noseAlong`
// (see headingYaw) — which is also what a tracker physically does, and means
// the azimuth is never written down twice. The elevation is applied here, about
// +Z, which carries +X up toward +Y: a positive angle lifts the face off the
// horizon by that much, so passing the sun's own elevation points it at the sun.
// Signs on this were confirmed against the resulting world vector rather than
// reasoned about, per the house rule — negated, the face looks into the ground.
//
// EVERY MEMBER STANDS BEHIND THE FACE, and that is a constraint rather than an
// observation — see solarArrayFrame in baseplan.ts, which is where the layout
// actually lives and which the spec asserts that property against. This only
// draws what that returns.
const SOLAR_RAIL = '#cfd5de' // anodized frame, matching the face map's rail
const SOLAR_STEEL = '#5d636e' // the structure under it
const SOLAR_FOOT = '#a6a298' // a bedded footing pad, same worked regolith as a deck

export function VerticalSolarArray({
  elevRad,
  seed,
}: {
  // Radians the face is lifted off the horizon — the sun's own elevation,
  // passed in rather than imported so the model stays a model.
  elevRad: number
  seed: number
}) {
  const maps = solarFaceMaps()
  const f = solarArrayFrame(elevRad)

  // A degree or so of tracking error, which every array in a real field carries
  // and no two carry identically. Small enough to read as slack in a drive
  // rather than as a fault, and deterministic in the array's own seed so a
  // reload never reshuffles the field.
  const slop = (hash1(seed * 17 + 3) - 0.5) * 0.05

  return (
    <group rotation={[0, slop, 0]}>
      {/* Torque tube, spanning the assembly's width behind its middle. */}
      <mesh position={f.tube} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, f.tubeSpan, 10]} />
        <meshStandardMaterial
          color={SOLAR_STEEL}
          metalness={0.5}
          roughness={0.5}
        />
      </mesh>

      {/* Two A-frames: a raked back leg and a forward brace to each side of the
          tube, tied at the feet, each foot on a bedded pad. This is the support
          the reference arrays stand on, and unlike a mast it cannot foul the
          face. */}
      {f.legs.map((leg) => (
        <group key={leg.z}>
          <Strut
            from={leg.back}
            to={[f.tube[0], f.tube[1], leg.z]}
            r={0.075}
            color={SOLAR_STEEL}
          />
          <Strut
            from={leg.fore}
            to={[f.tube[0], f.tube[1], leg.z]}
            r={0.065}
            color={SOLAR_STEEL}
          />
          <Strut from={leg.back} to={leg.fore} r={0.045} color={SOLAR_STEEL} />
          {[leg.back, leg.fore].map((foot) => (
            <mesh key={foot[0]} position={[foot[0], -0.08, foot[2]]}>
              <cylinderGeometry args={[0.34, 0.42, 0.3, 10]} />
              <meshStandardMaterial color={SOLAR_FOOT} roughness={0.97} />
            </mesh>
          ))}
        </group>
      ))}

      {/* The assembly. Its parts live in the tilted frame so they stay
          coplanar: a backing tray, then the textured face just clear of it. */}
      <group position={f.centre} rotation={[0, 0, elevRad]}>
        {/* The backing tray sits a clear 5 cm behind the face rather than the
            1 cm it first had. At 1 cm the two surfaces Z-FOUGHT: this scene is
            a globe, so the depth range is enormous relative to a panel and the
            buffer cannot separate two near-coplanar faces a centimeter apart.
            The result was patches of every panel flickering between tray and
            glass as the camera turned, which reads as the material shimmering
            rather than as the depth artifact it actually is. */}
        <mesh position={[-0.1, 0, 0]}>
          <boxGeometry
            args={[0.09, f.halfH * 2 + 0.05, f.halfW * 2 + 0.05]}
          />
          <meshStandardMaterial
            color={SOLAR_RAIL}
            metalness={0.35}
            roughness={0.62}
          />
        </mesh>
        {/* Glass over cells, which is literally what a module is — so the gloss
            is a CLEARCOAT over a dark diffuse base rather than a low roughness
            on the base itself. A metallic near-mirror was tried first and is
            wrong twice over: a solar cell is not a metal, and a near-specular
            surface reflects the environment at a frequency finer than a pixel,
            which the renderer cannot filter and which crawls as the camera
            moves. A clearcoat gives the single crisp highlight that actually
            reads as glass, and leaves the cells' own colour alone underneath.
            The roughness MAP is what carries it: the rails come out matte and
            the laminate glossy, and it is the CONTRAST between the two that the
            eye reads as glass rather than either value on its own. */}
        <mesh position={[0.005, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[f.halfW * 2, f.halfH * 2]} />
          <meshPhysicalMaterial
            map={maps?.albedo ?? null}
            roughnessMap={maps?.rough ?? null}
            color={maps ? '#ffffff' : '#16294f'}
            metalness={0.04}
            roughness={maps ? 1 : 0.22}
            clearcoat={1}
            // NOT the near-mirror 0.045 this started at. That value is exactly
            // the case the comment above warns about and it behaved exactly as
            // warned: a clearcoat that sharp samples the environment at a
            // frequency finer than a pixel, and since the renderer has no way
            // to filter a specular lobe per pixel, the highlight crawled across
            // the field as the camera turned. 0.18 is still plainly glass —
            // the highlight is what sells it, not how tight the highlight is —
            // and it lands on a PMREM mip that is prefiltered enough to hold
            // still.
            clearcoatRoughness={0.18}
            envMapIntensity={1.15}
          />
        </mesh>
      </group>
    </group>
  )
}

function ServiceCanopy() {
  const w = 2.8
  const d = 3.6
  const postH = 2.4
  // Clear of the stalls on both axes: past their front line in Z (see
  // DEPOT_STALL_FRONT_Z) regardless of X, so there is no corner where the
  // canopy's own footprint and a stall's paint overlap.
  const cx = 4.3
  const cz = 2.0
  const corners: [number, number][] = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [-w / 2, d / 2],
    [w / 2, d / 2],
  ]
  return (
    <group position={[cx, 0, cz]}>
      {corners.map(([dx, dz]) => (
        <mesh key={`${dx}:${dz}`} position={[dx, postH / 2, dz]}>
          <cylinderGeometry args={[0.09, 0.09, postH, 10]} />
          <meshStandardMaterial color={METAL} metalness={0.45} roughness={0.5} />
        </mesh>
      ))}
      {/* Roof, canted a couple degrees the way every open-sided shed on an
          airless site is — there's nothing to shed, but a dead-flat panel
          reads as a rendering primitive rather than a built roof. */}
      <mesh position={[0, postH + 0.12, 0]} rotation={[0.035, 0, 0]}>
        <boxGeometry args={[w + 0.6, 0.12, d + 0.6]} />
        <meshStandardMaterial color={DEPOT_CANOPY} metalness={0.3} roughness={0.55} />
      </mesh>
      <mesh position={[0, postH + 0.04, 0]} rotation={[0.035, 0, 0]}>
        <boxGeometry args={[w + 0.5, 0.02, d + 0.5]} />
        <meshStandardMaterial color={DEPOT_CANOPY_DARK} metalness={0.35} roughness={0.5} />
      </mesh>
      {/* Wheel-service hoist: a beam between the front posts, a drop line,
          and a hook. */}
      <Strut
        from={[-w / 2, postH - 0.05, -d / 2 + 0.5]}
        to={[w / 2, postH - 0.05, -d / 2 + 0.5]}
        r={0.05}
      />
      <Strut
        from={[0, postH - 0.05, -d / 2 + 0.5]}
        to={[0, 1.1, -d / 2 + 0.5]}
        r={0.025}
        color={DARK}
      />
      <mesh position={[0, 1.0, -d / 2 + 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.09, 0.02, 8, 16]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  )
}

// A spares/support buggy standing in a bay, nose out toward the aisle —
// `RoverBody` reused exactly as its own comment always intended ("parked in
// the base compound"), just finally given somewhere to stand. Every rover in
// this file drives down its own local +X, so facing that out of the bay
// toward the aisle (+Z from the stall's own center) is a yaw of -90°.
function DepotSupportRover({ x }: { x: number }) {
  return (
    <group
      position={[x, 0, DEPOT_STALL_CENTER_Z]}
      rotation={[0, -Math.PI / 2, 0]}
      scale={2.8}
    >
      <RoverBody accent={DEPOT_NEUTRAL} />
    </group>
  )
}

// The un-paved counterpart to an occupied bay: a pair of faint wheel ruts
// running from the empty stall out through the aisle, the visible trace of
// the unit that left it to go drive its lap. Two strips at roughly an LTV's
// track gauge, not one wide smear — a single mark reads as a stain, a pair
// reads as tires.
function TreadTracks({ x }: { x: number }) {
  const gauge = 1.3
  const zFrom = DEPOT_STALL_BACK_Z + 1.2
  const zTo = DEPOT_HALF_D - 0.3
  const len = zTo - zFrom
  const cz = (zFrom + zTo) / 2
  return (
    <group position={[x, 0.012, 0]}>
      {[-gauge / 2, gauge / 2].map((dx) => (
        <mesh key={dx} position={[dx, 0, cz]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.22, len]} />
          <meshStandardMaterial
            color={DEPOT_CURB}
            roughness={1}
            transparent
            opacity={0.55}
          />
        </mesh>
      ))}
    </group>
  )
}

// A recharge/propellant station — the depot's answer to a terrestrial gas
// station, sized for LTV-class hardware rather than cars. Two islands under
// one canopy, larger than `ServiceCanopy` (that one shelters a single
// wheel-hoist; this is the yard's primary built structure) so the two never
// compete for which one reads as the depot's main feature. Each island's
// pump head is deliberately ambiguous between a high-current connector and
// a cryogenic nozzle — a future competitor's hardware could plausibly be
// either — fed from a pair of upright tanks at one end via visible piping,
// so the station reads as actually supplied rather than a prop with nothing
// behind it.
const GAS_CANOPY = '#d6d9de'
const GAS_CANOPY_DARK = '#888e9a'
const GAS_ISLAND = '#5f5c53' // matches DEPOT_CURB — a raised island is poured the same as a curb
const GAS_TANK_BODY = '#b9bdc3'
const GAS_TANK_BAND = '#c0402e' // hazard band — pressurized/cryogenic contents

// One pump: a post with a display readout, a nozzle racked in its holster on
// a coiled hose, standing on a raised island rather than flush with the
// apron — the one thing that unmistakably reads as "pump" rather than
// "bollard" is the hose actually running somewhere.
function GasPumpIsland({ x, accent }: { x: number; accent: string }) {
  const islandW = 0.7
  const islandD = 1.3
  const postH = 1.05
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[islandW, 0.12, islandD]} />
        <meshStandardMaterial color={GAS_ISLAND} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.12 + postH / 2, 0]}>
        <boxGeometry args={[0.28, postH, 0.22]} />
        <meshStandardMaterial color={METAL} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Readout — a glowing panel rather than literal digits, same
          shorthand as a beacon's own reticle: legible as instrumentation at
          the distance this scene is ever viewed from. */}
      <mesh position={[0, 0.12 + postH * 0.72, 0.112]}>
        <planeGeometry args={[0.16, 0.1]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
      {/* Nozzle holster + coiled hose, racked rather than lying loose — the
          detail that tells a pump from a charging bollard. */}
      <mesh position={[0.16, 0.12 + postH * 0.4, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.09, 0.028, 8, 16]} />
        <meshStandardMaterial color={REEL_CABLE} roughness={0.85} />
      </mesh>
      <mesh
        position={[0.16, 0.12 + postH * 0.22, 0.1]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.03, 0.035, 0.16, 8]} />
        <meshStandardMaterial color={DARK} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.12 + postH + 0.02, 0]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.4}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// The canopy overhead — wider and taller than `ServiceCanopy`'s wheel-hoist
// shed, with recessed under-canopy lighting rather than one bare roof, since
// this is meant to read as the depot's principal built structure.
function GasStationCanopy() {
  const w = 3.4
  const d = 2.8
  const postH = 2.6
  const corners: [number, number][] = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [-w / 2, d / 2],
    [w / 2, d / 2],
  ]
  return (
    <group>
      {corners.map(([dx, dz]) => (
        <mesh key={`${dx}:${dz}`} position={[dx, postH / 2, dz]}>
          <cylinderGeometry args={[0.1, 0.1, postH, 10]} />
          <meshStandardMaterial color={METAL} metalness={0.45} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, postH + 0.12, 0]}>
        <boxGeometry args={[w + 0.6, 0.14, d + 0.6]} />
        <meshStandardMaterial color={GAS_CANOPY} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, postH + 0.03, 0]}>
        <boxGeometry args={[w + 0.5, 0.02, d + 0.5]} />
        <meshStandardMaterial color={GAS_CANOPY_DARK} metalness={0.35} roughness={0.5} />
      </mesh>
      {/* Recessed lighting: a row of small emissive rectangles set into the
          underside rather than one bare panel — what actually illuminates a
          canopy's own islands after dark. */}
      {[-1, 1].map((s) =>
        [-0.9, 0.9].map((dz) => (
          <mesh
            key={`${s}:${dz}`}
            position={[s * 1.1, postH - 0.02, dz]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.4, 0.14]} />
            <meshStandardMaterial
              color="#eef2ff"
              emissive="#dfe6ff"
              emissiveIntensity={1.2}
              toneMapped={false}
            />
          </mesh>
        ))
      )}
    </group>
  )
}

// An upright resupply tank, banded for pressurized/cryogenic contents and
// standing on short legs rather than resting flush — a fitting real
// pump-station tankage would keep off bare regolith to inspect its own
// underside.
function PropellantTank({ x, z }: { x: number; z: number }) {
  const r = 0.26
  const h = 1.5
  return (
    <group position={[x, 0, z]}>
      {[-1, 1].map((s) =>
        [-1, 1].map((t) => (
          <mesh
            key={`${s}:${t}`}
            position={[s * r * 0.7, 0.09, t * r * 0.7]}
          >
            <cylinderGeometry args={[0.02, 0.02, 0.18, 6]} />
            <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
          </mesh>
        ))
      )}
      <mesh position={[0, 0.18 + h / 2, 0]}>
        <cylinderGeometry args={[r, r, h, 18]} />
        <meshStandardMaterial color={GAS_TANK_BODY} metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.18 + h * 0.62, 0]}>
        <cylinderGeometry args={[r * 1.01, r * 1.01, h * 0.16, 18]} />
        <meshStandardMaterial color={GAS_TANK_BAND} roughness={0.6} />
      </mesh>
      {/* Domed cap, its equator flush with the cylinder's own top rim rather
          than floating above it. */}
      <mesh position={[0, 0.18 + h, 0]}>
        <sphereGeometry args={[r, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={GAS_TANK_BODY} metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.18 + h + r + 0.05, 0]}>
        <cylinderGeometry args={[0.04, 0.045, 0.1, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.55} roughness={0.4} />
      </mesh>
      {/* Pressure gauge, face-out toward the aisle. */}
      <mesh position={[0, 0.18 + h * 0.75, r + 0.005]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.045, 14]} />
        <meshStandardMaterial color={DARK} roughness={0.5} />
      </mesh>
    </group>
  )
}

// A pylon sign at the station's approach corner — the one piece of signage
// on the whole lot, an emissive panel rather than legible text (see
// `GasPumpIsland`'s own readout for the same shorthand), lit the district's
// accent so it reads as the same infrastructure the charge bollards and
// yard lights already tie to whichever team the map currently favors. Faces
// stay on local ±Z with no extra rotation, since the station itself is
// authored front-on-+Z (see `RoverGasStation`) and a pylon at the front
// corner is meant to read from the branch the whole lot fronts.
function StationSign({ accent }: { accent: string }) {
  const h = 2.8
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.07, h, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[0, h + 0.26, 0]}>
        <boxGeometry args={[0.06, 0.52, 0.72]} />
        <meshStandardMaterial color={DARK} roughness={0.6} />
      </mesh>
      <mesh position={[0.032, h + 0.26, 0]}>
        <planeGeometry args={[0.46, 0.44]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.8}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[-0.032, h + 0.26, 0]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.46, 0.44]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.8}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// A short reflective corner bollard — the plain safety marking a forecourt's
// own approach corners get, distinct from `ChargeBollard`'s glowing accent
// cap (that one marks a bay's charge point; this just marks apron geometry
// at night).
function CornerBollard() {
  return (
    <group>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.055, 0.065, 0.56, 10]} />
        <meshStandardMaterial color="#c0402e" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.058, 0.058, 0.06, 10]} />
        <meshStandardMaterial color="#eef2ff" roughness={0.5} />
      </mesh>
    </group>
  )
}

// The attendant's booth — a small pressurized enclosure rather than an open
// kiosk (nothing on an airless site is unsealed), with a window, a door
// outline, and a stub antenna, standing at the back corner clear of both
// islands. What tells this forecourt apart from a bare pair of pumps: a
// real gas station's whole reason to have staff on site.
function AttendantBooth() {
  const w = 1.6
  const d = 1.6
  const wallH = 2.0
  return (
    <group>
      <mesh position={[0, wallH / 2, 0]}>
        <boxGeometry args={[w, wallH, d]} />
        <meshStandardMaterial color="#d8dadd" roughness={0.6} />
      </mesh>
      {/* Roof, canted like every open-air shed on this base. */}
      <mesh position={[0, wallH + 0.08, 0]} rotation={[0.04, 0, 0.03]}>
        <boxGeometry args={[w + 0.3, 0.14, d + 0.3]} />
        <meshStandardMaterial color={GAS_CANOPY_DARK} metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Window, facing the forecourt (+Z). */}
      <mesh position={[0, wallH * 0.62, d / 2 + 0.01]}>
        <planeGeometry args={[0.9, 0.55]} />
        <meshStandardMaterial
          color="#dfe6ff"
          emissive="#aebdf2"
          emissiveIntensity={0.5}
          roughness={0.25}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[0, wallH * 0.62, d / 2 + 0.015]}>
        <boxGeometry args={[0.94, 0.6, 0.02]} />
        <meshStandardMaterial color={DARK} roughness={0.6} wireframe />
      </mesh>
      {/* Door, on the side facing the booth's own approach path. */}
      <mesh position={[w / 2 + 0.005, 0.85, 0]}>
        <boxGeometry args={[0.03, 1.7, 0.7]} />
        <meshStandardMaterial color={GAS_CANOPY_DARK} metalness={0.3} roughness={0.55} />
      </mesh>
      {/* Stub antenna. */}
      <mesh position={[-w / 2 + 0.2, wallH + 0.2, -d / 2 + 0.2]}>
        <cylinderGeometry args={[0.015, 0.02, 0.7, 8]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[-w / 2 + 0.2, wallH + 0.56, -d / 2 + 0.2]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial
          color="#eef2ff"
          emissive="#eef2ff"
          emissiveIntensity={1}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// A short dashed lane running along Z, guiding the eye (there is no traffic
// AI to guide) from the forecourt's own entrance in toward a pump island —
// the one detail that makes an apron read as a place vehicles actually
// approach in a line rather than park wherever.
function LaneDashes({ x, zFrom, zTo }: { x: number; zFrom: number; zTo: number }) {
  const dashLen = 0.5
  const gap = 0.4
  const dashes: number[] = []
  for (let z = zFrom; z < zTo; z += dashLen + gap) dashes.push(z + dashLen / 2)
  return (
    <group position={[x, 0.014, 0]}>
      {dashes.map((z, i) => (
        <mesh key={i} position={[0, 0, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.14, dashLen]} />
          <meshStandardMaterial color={DEPOT_STRIPE} roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

// A stepped, outward-flaring skirt of graded fill under a rigid apron — the
// same fix `LandingPad`'s own cone-frustum skirt exists for (see its
// comment there), adapted for a rectangular footprint. A single
// vertical-walled box reads as a slab standing PROUD of the ground the
// instant the seat point (the highest ground under the footprint — see
// `footprintSeatRadius`) sits above the surrounding regolith on any side,
// which on this ridge's terrain was often enough to make the whole apron
// look like it was floating on a plinth rather than resting on it.
// Terracing it instead — each course a little lower and a little wider than
// the one above, the same "coursed" language `LandingPad`'s own build-up
// uses — means there is no single hard vertical edge for a slope mismatch
// to expose: whichever course the true ground surface actually intersects,
// everything below it is already buried and everything above it reads as a
// deliberate stepped foundation rather than a hovering box. Four courses
// reach 3.6 m down and flare 2.8 m out from the apron's own edge, roughly
// double the straight box this replaced on both counts.
function TerracedSkirt({
  halfW,
  halfD,
  steps = 4,
  stepDepth = 0.9,
  stepOut = 0.7,
}: {
  halfW: number
  halfD: number
  steps?: number
  stepDepth?: number
  stepOut?: number
}) {
  return (
    <group>
      {Array.from({ length: steps }, (_, i) => {
        const w = (halfW + stepOut * (i + 1)) * 2
        const d = (halfD + stepOut * (i + 1)) * 2
        // A hair taller than the nominal spacing, so consecutive courses
        // overlap slightly rather than leaving a seam between them.
        const h = stepDepth + 0.06
        const y = 0.03 - stepDepth * (i + 0.5)
        return (
          <mesh key={i} position={[0, y, 0]}>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={PAD_SURFACE} roughness={0.99} />
          </mesh>
        )
      })}
    </group>
  )
}

// Half-extents of the station's own forecourt apron, in meters — exported so
// MarkerLayer's `RoverGasStationSite` can compute the same footprint radius
// and setback the depot yard's own site function uses.
export const GAS_STATION_HALF_W = 5.0
export const GAS_STATION_HALF_D = 4.4

// ---------------------------------------------------------------------------
// Rover gas/recharge station — a second, freestanding piece of shared rover
// infrastructure, not a room tacked onto `RoverDepotYard`
// ---------------------------------------------------------------------------
//
// The depot yard is a parking apron; this is what refuels or recharges a
// unit before or after that, and a real forecourt is its own lot with its
// own frontage, not a corner of somebody else's — the reason `MarkerLayer`
// stands this on the OPPOSITE side of the depot branch from
// `RoverDepotYard` (see `RoverGasStationSite`), so the two face each other
// across the one straight road they both front rather than sharing a single
// footprint. Same authoring convention as the depot yard: real meters, open
// (forecourt) side on local +Z, no `PROJECT_SIZE_M` entry since this isn't a
// competitor's model.
export function RoverGasStation({ accent }: { accent: string }) {
  // Tank positions, back-left, clear of the canopy's own roof (X down to
  // -2.4) by 1.2 m and of the apron's own edge (X = -4.8) by ~1 m.
  const tankA: [number, number] = [-3.6, -1.9]
  const tankB: [number, number] = [-3.6, -0.6]
  return (
    <group>
      {/* Terraced skirt — see `TerracedSkirt`'s own comment on why a rigid
          apron needs one graded down rather than resting on a hard edge. */}
      <TerracedSkirt halfW={GAS_STATION_HALF_W} halfD={GAS_STATION_HALF_D} />

      {/* Apron */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[GAS_STATION_HALF_W * 2, 0.04, GAS_STATION_HALF_D * 2]} />
        <meshStandardMaterial color={PAD_SURFACE} roughness={0.96} />
      </mesh>

      {/* Curb */}
      {(
        [
          [GAS_STATION_HALF_W * 2 + 0.3, 0.18, 0, -GAS_STATION_HALF_D - 0.06],
          [GAS_STATION_HALF_W * 2 + 0.3, 0.18, 0, GAS_STATION_HALF_D + 0.06],
          [0.18, GAS_STATION_HALF_D * 2, -GAS_STATION_HALF_W - 0.06, 0],
          [0.18, GAS_STATION_HALF_D * 2, GAS_STATION_HALF_W + 0.06, 0],
        ] as [number, number, number, number][]
      ).map(([w, d, x, z], i) => (
        <mesh key={i} position={[x, 0.05, z]}>
          <boxGeometry args={[w, 0.1, d]} />
          <meshStandardMaterial color={DEPOT_CURB} roughness={0.9} />
        </mesh>
      ))}

      {/* Canopy over its two islands, set back slightly from the forecourt's
          own entrance so the approach lanes have somewhere to run. */}
      <group position={[0, 0, -0.4]}>
        <GasStationCanopy />
        <GasPumpIsland x={-1.05} accent={accent} />
        <GasPumpIsland x={1.05} accent={accent} />
      </group>

      {/* Approach lanes, from the apron's own front edge in to each island. */}
      <LaneDashes x={-1.05} zFrom={0.4} zTo={GAS_STATION_HALF_D - 0.3} />
      <LaneDashes x={1.05} zFrom={0.4} zTo={GAS_STATION_HALF_D - 0.3} />

      {/* Tanks feeding the islands by visible piping. */}
      <PropellantTank x={tankA[0]} z={tankA[1]} />
      <PropellantTank x={tankB[0]} z={tankB[1]} />
      <Strut from={[tankA[0], 0.3, tankA[1]]} to={[-1.05, 0.15, -0.9]} r={0.03} />
      <Strut from={[tankB[0], 0.3, tankB[1]]} to={[1.05, 0.15, -0.9]} r={0.03} />

      {/* Attendant's booth, back-right, and a little supply clutter beside
          it — the reel and crate reused straight from the shared prop
          library rather than one-off geometry. Set well clear of the
          canopy's own roof corner (X to 2.4, Z to -2.4). */}
      <group position={[3.8, 0, -3.2]} rotation={[0, Math.PI, 0]}>
        <AttendantBooth />
      </group>
      <group position={[3.5, 0, -1.3]} rotation={[0, 0.4, 0]}>
        <CableReel />
      </group>
      <group position={[1.9, 0, -3.7]} rotation={[0, -0.5, 0]}>
        <CargoCrate variant="small" seed={71} />
      </group>

      {/* Pylon sign at the front-left corner, facing the forecourt's own
          entrance. */}
      <group position={[-3.6, 0, 3.3]}>
        <StationSign accent={accent} />
      </group>

      {/* Corner bollards marking the entrance. */}
      <group position={[-4.3, 0, 3.7]}>
        <CornerBollard />
      </group>
      <group position={[4.3, 0, 3.7]}>
        <CornerBollard />
      </group>

      {/* The attendant on shift, patrolling a loop bounded to the booth end
          of the forecourt — the same PatrollingAstronaut convention as
          every other staffed site, with its own seed so it never
          synchronizes with RoverDepotYard's own mechanic. */}
      <PatrollingAstronaut center={[2.6, -2.0]} radius={1.0} seed={77} accent={accent} />
    </group>
  )
}

export function RoverDepotYard({ accent }: { accent: string }) {
  return (
    <group>
      {/* Terraced skirt: MarkerLayer seats this yard on the HIGHEST ground
          under its own footprint (a rigid apron cannot sink into a slope —
          see footprintSeatRadius), which is what stops the uphill edge
          burying itself but leaves the downhill edge standing clear of the
          regolith. See `TerracedSkirt`'s own comment for why this is
          stepped and flared rather than a single vertical-walled block. */}
      <TerracedSkirt halfW={DEPOT_HALF_W} halfD={DEPOT_HALF_D} />

      {/* Apron */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[DEPOT_HALF_W * 2, 0.04, DEPOT_HALF_D * 2]} />
        <meshStandardMaterial color={PAD_SURFACE} roughness={0.96} />
      </mesh>

      {/* Curb — a thin darker border reads the apron as a built, edged
          surface rather than a patch of unusually flat regolith. */}
      {(
        [
          [DEPOT_HALF_W * 2 + 0.3, 0.18, 0, -DEPOT_HALF_D - 0.06],
          [DEPOT_HALF_W * 2 + 0.3, 0.18, 0, DEPOT_HALF_D + 0.06],
          [0.18, DEPOT_HALF_D * 2, -DEPOT_HALF_W - 0.06, 0],
          [0.18, DEPOT_HALF_D * 2, DEPOT_HALF_W + 0.06, 0],
        ] as [number, number, number, number][]
      ).map(([w, d, x, z], i) => (
        <mesh key={i} position={[x, 0.05, z]}>
          <boxGeometry args={[w, 0.1, d]} />
          <meshStandardMaterial color={DEPOT_CURB} roughness={0.9} />
        </mesh>
      ))}

      {DEPOT_STALL_X.map((x, i) => {
        const occupied = DEPOT_OCCUPIED.includes(i)
        return (
          <group key={x}>
            <ParkingStall x={x} />
            <group position={[x, 0, DEPOT_STALL_FRONT_Z + 0.45]}>
              <ChargeBollard accent={accent} />
            </group>
            {occupied ? <DepotSupportRover x={x} /> : <TreadTracks x={x} />}
          </group>
        )
      })}

      <ServiceCanopy />
      <group position={[2.9, 0, 3.1]} rotation={[0, 0.5, 0]}>
        <CableReel />
      </group>
      <group position={[5.6, 0, 3.3]} rotation={[0, -0.6, 0]}>
        <CargoPallet hard seed={41} />
      </group>

      <group position={[-DEPOT_HALF_W + 0.9, 0, DEPOT_HALF_D - 0.9]}>
        <DepotLightMast accent={accent} />
      </group>
      <group
        position={[DEPOT_HALF_W - 0.9, 0, DEPOT_HALF_D - 0.9]}
        rotation={[0, Math.PI, 0]}
      >
        <DepotLightMast accent={accent} />
      </group>

      {/* A mechanic making rounds of the bay rather than standing frozen at
          one panel — the same PatrollingAstronaut every other staffed site
          uses, bounded to the canopy end of the lot so its loop never
          crosses the stalls. */}
      <PatrollingAstronaut center={[4.3, 2.0]} radius={1.1} seed={42} accent={accent} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Solar-thermal ISRU plant
// ---------------------------------------------------------------------------

// Local units per METER, as in the other true-size installations.
const ISRU_M = UNIT_MAX_DIM / (TYPE_SIZE_M.isru_plant ?? 19)

const LOOP_HOT = '#c8402a' // concentrated-heat side: receiver and its supply run
const LOOP_COLD = '#4d7fb0' // return side, back from the radiator
const THERMAL_MASS = '#4a463f' // packed regolith
const ISRU_RADIATOR = '#eef1f5'
const SUNSHIELD = '#1b1d21'

// Stations along the plant's long axis, left to right. Naming them keeps the
// pipe runs below honest: every line starts and ends at real hardware.
const ISRU_RECEIVER_X = -2.3
const ISRU_RECEIVER_Y = 5.2
const ISRU_MASS_X = 1.8
const ISRU_STIRLING_X = 4.6
const ISRU_RAD_X = 7.2

// The array that powers the plant: framed photovoltaic panels on short posts,
// tilted back rather than skyward because at the pole the sun stays near the
// horizon. Fitting hardware for Blue Alchemist, whose whole premise is making
// solar cells out of regolith.
//
// Deliberately NOT a mirror finish. A near-specular material (high metalness,
// very low roughness) reflects the environment at a frequency finer than one
// pixel, and the renderer cannot filter that — it breaks up into crawling
// glitter that reads as noise rather than as glass. Real panels are dark and
// only semi-gloss, which is both truer and stable to shade.
function PvField() {
  const tilt = -0.6 // radians back from vertical
  const halfH = 1.3
  const centerY = 1.7
  // Where the tilted panel's lower edge lands, so the post meets it.
  const footY = centerY - halfH * Math.cos(tilt)
  const footZ = -halfH * Math.sin(tilt)
  return (
    <group>
      {Array.from({ length: 5 }, (_, i) => {
        const x = -9.0 + i * 1.3
        return (
          <group key={x}>
            {/* Panel parts live in the tilted frame, so they stay coplanar. */}
            <group position={[x, centerY, 0]} rotation={[tilt, 0, 0]}>
              <mesh position={[0, 0, -0.02]}>
                <boxGeometry args={[2.14, halfH * 2 + 0.14, 0.09]} />
                <meshStandardMaterial
                  color={PANEL_EDGE}
                  metalness={0.45}
                  roughness={0.52}
                />
              </mesh>
              <mesh position={[0, 0, 0.038]}>
                <boxGeometry args={[1.98, halfH * 2, 0.04]} />
                <meshStandardMaterial
                  color={PANEL}
                  metalness={0.12}
                  roughness={0.44}
                />
              </mesh>
              {/* Busbars between cell columns/rows */}
              {[-0.66, 0.66].map((gx) => (
                <mesh key={gx} position={[gx, 0, 0.059]}>
                  <boxGeometry args={[0.035, halfH * 2, 0.008]} />
                  <meshStandardMaterial
                    color={PANEL_EDGE}
                    metalness={0.4}
                    roughness={0.5}
                  />
                </mesh>
              ))}
              <mesh position={[0, 0, 0.059]}>
                <boxGeometry args={[1.98, 0.035, 0.008]} />
                <meshStandardMaterial
                  color={PANEL_EDGE}
                  metalness={0.4}
                  roughness={0.5}
                />
              </mesh>
            </group>
            <mesh position={[x, footY / 2, footZ]}>
              <cylinderGeometry args={[0.07, 0.09, footY + 0.3, 8]} />
              <meshStandardMaterial
                color={METAL}
                metalness={0.5}
                roughness={0.5}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// Solar-thermal ISRU: a photovoltaic array and a raised solar receiver, which
// charges a regolith thermal mass so the plant keeps running through the
// night, driving a Stirling engine that dumps its waste heat from a shaded
// radiator. Hot runs are red, the return from the radiator blue.
function IsruPlant({ accent }: { accent: string }) {
  return (
    <group scale={ISRU_M}>
      <PvField />

      {/* Receiver tower */}
      <mesh position={[ISRU_RECEIVER_X, ISRU_RECEIVER_Y / 2, 0]}>
        <cylinderGeometry args={[0.11, 0.15, ISRU_RECEIVER_Y, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} />
      </mesh>
      {[-1, 1].map((s) => (
        <Strut
          key={s}
          from={[ISRU_RECEIVER_X + s * 1.5, 0.05, s * 0.9]}
          to={[ISRU_RECEIVER_X, ISRU_RECEIVER_Y * 0.62, 0]}
          r={0.055}
        />
      ))}
      {/* Receiver tube itself — the hot spot the whole field aims at */}
      <mesh
        position={[ISRU_RECEIVER_X, ISRU_RECEIVER_Y, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.19, 0.19, 2.8, 12]} />
        <meshStandardMaterial
          color={LOOP_HOT}
          emissive={LOOP_HOT}
          emissiveIntensity={1.5}
          roughness={0.55}
          toneMapped={false}
        />
      </mesh>
      {/* Aperture shroud around it, open toward the mirrors */}
      <mesh position={[ISRU_RECEIVER_X, ISRU_RECEIVER_Y + 0.34, -0.2]}>
        <boxGeometry args={[3.1, 0.5, 0.7]} />
        <meshStandardMaterial color={SUNSHIELD} roughness={0.8} />
      </mesh>

      {/* Supply run: receiver over to the thermal mass, then on to the engine */}
      <Strut
        from={[ISRU_RECEIVER_X + 1.4, ISRU_RECEIVER_Y, 0]}
        to={[ISRU_MASS_X, ISRU_RECEIVER_Y, 0]}
        r={0.13}
        color={LOOP_HOT}
        glow={0.35}
      />
      <Strut
        from={[ISRU_MASS_X, ISRU_RECEIVER_Y, 0]}
        to={[ISRU_MASS_X, 1.7, 0]}
        r={0.13}
        color={LOOP_HOT}
        glow={0.35}
      />
      <Strut
        from={[ISRU_MASS_X + 1.6, 0.95, 0]}
        to={[ISRU_STIRLING_X - 0.8, 0.95, 0]}
        r={0.11}
        color={LOOP_HOT}
        glow={0.35}
      />

      {/* Thermal mass: packed regolith in a frame, charged through the day so
          the engine keeps turning through the two-week night. */}
      <mesh position={[ISRU_MASS_X, 0.9, 0]}>
        <boxGeometry args={[3.2, 1.8, 2.6]} />
        <meshStandardMaterial color={THERMAL_MASS} roughness={0.95} />
      </mesh>
      <mesh position={[ISRU_MASS_X, 1.85, 0]}>
        <boxGeometry args={[3.4, 0.14, 2.8]} />
        <meshStandardMaterial
          color={HULL_DARK}
          metalness={0.4}
          roughness={0.6}
        />
      </mesh>

      {/* Stirling engine: cylinder with cooling fins on a low skid */}
      <mesh position={[ISRU_STIRLING_X, 0.95, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.42, 0.42, 1.5, 14]} />
        <meshStandardMaterial color={HULL} metalness={0.45} roughness={0.45} />
      </mesh>
      {[-0.5, -0.2, 0.1, 0.4].map((dx) => (
        <mesh
          key={dx}
          position={[ISRU_STIRLING_X + dx, 0.95, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.56, 0.56, 0.06, 14]} />
          <meshStandardMaterial
            color={HULL_DARK}
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>
      ))}
      <mesh position={[ISRU_STIRLING_X, 0.3, 0]}>
        <boxGeometry args={[1.8, 0.6, 1.2]} />
        <meshStandardMaterial color={METAL} metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[ISRU_STIRLING_X, 1.6, 0]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.9}
          toneMapped={false}
        />
      </mesh>

      {/* Return side: engine to radiator, then the long cold leg back */}
      <Strut
        from={[ISRU_STIRLING_X + 0.8, 0.95, 0]}
        to={[ISRU_RAD_X - 0.6, 0.95, 0.4]}
        r={0.11}
        color={LOOP_COLD}
      />
      <Strut
        from={[ISRU_RAD_X, 0.5, -1.3]}
        to={[ISRU_MASS_X, 0.5, -1.3]}
        r={0.1}
        color={LOOP_COLD}
      />

      {/* Radiator, with a sunshield standing between it and the sun. A
          radiator in direct sunlight absorbs more than it rejects, so on the
          Moon they are always shaded. */}
      <mesh position={[ISRU_RAD_X, 2.2, 0.45]}>
        <boxGeometry args={[3.4, 2.8, 0.12]} />
        <meshStandardMaterial
          color={ISRU_RADIATOR}
          metalness={0.25}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[ISRU_RAD_X, 2.35, -0.6]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[3.8, 3.2, 0.1]} />
        <meshStandardMaterial color={SUNSHIELD} roughness={0.85} />
      </mesh>
      {[-1.4, 1.4].map((dx) => (
        <mesh key={dx} position={[ISRU_RAD_X + dx, 0.4, 0.45]}>
          <cylinderGeometry args={[0.08, 0.1, 0.8, 8]} />
          <meshStandardMaterial
            color={METAL}
            metalness={0.5}
            roughness={0.5}
          />
        </mesh>
      ))}

      {/* A tech patrolling the loop, clear of the hot supply run at z=0 */}
      <PatrollingAstronaut
        center={[ISRU_MASS_X + 1.4, 2.2]}
        radius={1.3}
        seed={5}
        accent={accent}
      />

      {/* Spare-parts resupply and a spooled-off cable run, both mirrored onto
          the -Z side so they sit clear of the hot supply line at z=0 and of
          the astronaut's own patrol loop on +Z. */}
      <group position={[-1.2, 0, -2.6]} rotation={[0, 0.6, 0]}>
        <CargoPallet seed={5} />
      </group>
      <group position={[5.4, 0, -2.3]}>
        <CableReel />
      </group>
      {/* Product/feedstock tankage, framed rather than a bare cube, plus the
          utility box its own line actually terminates in — a plant is
          connected to something, not just staffed. */}
      <group position={[2.0, 0, -2.9]}>
        <FramedTank seed={5} />
      </group>
      <group position={[3.0, 0, -1.9]} rotation={[0, -0.4, 0]}>
        <JunctionBox />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Sierra Space Carbothermal Oxygen Reactor
// ---------------------------------------------------------------------------

// Sierra ran a full-scale unit in a thermal-vacuum chamber at NASA Johnson
// (the CaRD demonstration) — a real, already-tested skid rather than a
// concept sketch, which is the case for a compact packaged plant instead of
// the generic IsruPlant's sprawling field-plus-tower installation. Carbon
// monoxide comes off the reaction, not the electrolysis oxygen IsruPlant's
// hot loop carries, but the same red-hot / blue-cold convention still tells
// the story: concentrated heat in, cooled product gas out.
const SCR_M = UNIT_MAX_DIM / (PROJECT_SIZE_M['sierra-space-carbothermal'] ?? 8.1)

const SCR_VESSEL = '#8b8f97' // steel pressure vessels
const SCR_VESSEL_HI = '#c7cbd1' // top-lit highlight band on each vessel
const SCR_FRAME = '#4a4e57' // structural steel lattice
const SCR_HOPPER = '#5c6068'
// The reaction itself: regolith melts under concentrated heat above 1,600°C,
// visible through a small viewport the way a foundry's is — the single
// detail that makes this read as "carbothermal" rather than "generic tank
// farm" from across the district.
const SCR_GLOW = '#ff7a30'

const SCR_SKID_L = 5.0
const SCR_SKID_W = 3.0
const SCR_SKID_H = 0.22
const SCR_TOWER_X = 0.5 // reactor stack's position along the skid

function CarbothermalFeet() {
  const pts: [number, number][] = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
    [-1, 0],
    [1, 0],
  ]
  return (
    <>
      {pts.map(([sx, sz]) => (
        <mesh
          key={`${sx}:${sz}`}
          position={[
            (sx * (SCR_SKID_L - 0.3)) / 2,
            -0.09,
            (sz * (SCR_SKID_W - 0.3)) / 2,
          ]}
        >
          <cylinderGeometry args={[0.14, 0.16, 0.22, 10]} />
          <meshStandardMaterial color={SCR_FRAME} roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
    </>
  )
}

// The reactor stack: a wide lower vessel where regolith actually melts, a
// narrower condenser stage above it recovering the carbon monoxide, both
// held inside a four-post lattice tower rather than free-standing — this is
// the part of the plant that gets hot, so it is the part that gets braced.
function CarbothermalTower({ accent }: { accent: string }) {
  const baseY = SCR_SKID_H
  const vesselR = 0.55
  const vesselH = 1.9
  const vesselTopY = baseY + vesselH
  const condR = 0.34
  const condH = 1.0
  const condTopY = vesselTopY + 0.35 + condH // +0.35 for the reducer cone
  const towerTopY = condTopY + 0.3
  return (
    <group position={[SCR_TOWER_X, 0, 0]}>
      {/* Lattice tower */}
      {[
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].map(([sx, sz]) => (
        <Strut
          key={`${sx}:${sz}`}
          from={[sx * 0.75, baseY, sz * 0.75]}
          to={[sx * 0.42, towerTopY, sz * 0.42]}
          r={0.05}
          color={SCR_FRAME}
        />
      ))}
      {[vesselTopY * 0.35, vesselTopY * 0.75, condTopY - 0.1].map((y) => {
        const t = y < vesselTopY ? 0.75 - (y / vesselTopY) * 0.33 : 0.42
        return (
          <group key={y}>
            {[
              [-1, -1, 1, -1],
              [1, -1, 1, 1],
              [1, 1, -1, 1],
              [-1, 1, -1, -1],
            ].map(([ax, az, bx, bz], i) => (
              <Strut
                key={i}
                from={[ax * t, y, az * t]}
                to={[bx * t, y, bz * t]}
                r={0.028}
                color={SCR_FRAME}
              />
            ))}
          </group>
        )
      })}

      {/* Reactor vessel — the melt zone */}
      <mesh position={[0, baseY + vesselH / 2, 0]}>
        <cylinderGeometry args={[vesselR, vesselR, vesselH, 20]} />
        <meshStandardMaterial color={SCR_VESSEL} roughness={0.42} metalness={0.55} />
      </mesh>
      <mesh position={[0, vesselTopY - 0.16, 0]}>
        <cylinderGeometry args={[vesselR + 0.01, vesselR + 0.01, 0.16, 20]} />
        <meshStandardMaterial color={SCR_VESSEL_HI} roughness={0.35} metalness={0.5} />
      </mesh>
      {/* Viewport into the reaction, stood proud of the shell so it doesn't
          strobe against the curve. */}
      <mesh position={[0, baseY + 0.5, vesselR - 0.03]}>
        <boxGeometry args={[0.34, 0.34, 0.06]} />
        <meshStandardMaterial color={SCR_FRAME} roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, baseY + 0.5, vesselR + 0.02]}>
        <circleGeometry args={[0.13, 16]} />
        <meshStandardMaterial
          color={SCR_GLOW}
          emissive={SCR_GLOW}
          emissiveIntensity={2.4}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* Reducer cone up to the condenser stage */}
      <mesh position={[0, vesselTopY + 0.175, 0]}>
        <cylinderGeometry args={[condR, vesselR, 0.35, 18]} />
        <meshStandardMaterial color={SCR_VESSEL} roughness={0.45} metalness={0.5} />
      </mesh>
      {/* Condenser vessel — CO recovery */}
      <mesh position={[0, vesselTopY + 0.35 + condH / 2, 0]}>
        <cylinderGeometry args={[condR, condR, condH, 16]} />
        <meshStandardMaterial color={SCR_VESSEL} roughness={0.42} metalness={0.55} />
      </mesh>
      <mesh position={[0, condTopY, 0]}>
        <sphereGeometry args={[condR, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={SCR_VESSEL_HI} roughness={0.4} metalness={0.5} />
      </mesh>

      {/* Top platform and its beacon */}
      <mesh position={[0, towerTopY, 0]}>
        <boxGeometry args={[1.0, 0.05, 1.0]} />
        <meshStandardMaterial color={SCR_FRAME} roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0.42, towerTopY + 0.16, 0.42]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.7}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// Feed hopper: regolith in. Elevated on its own legs beside the tower and fed
// down a chute into the reactor's crown rather than through the melt zone
// directly, the way a foundry charges a furnace from above.
function CarbothermalHopper() {
  const hopperX = SCR_TOWER_X - 1.85
  const baseY = SCR_SKID_H
  const topY = baseY + 1.85
  const throatY = baseY + 1.05
  return (
    <group position={[hopperX, 0, 0]}>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <Strut
            key={`${sx}:${sz}`}
            from={[sx * 0.55, baseY, sz * 0.4]}
            to={[sx * 0.24, throatY, sz * 0.18]}
            r={0.035}
            color={SCR_FRAME}
          />
        ))
      )}
      {/* Inverted frustum hopper body */}
      <mesh position={[0, (throatY + topY) / 2, 0]}>
        <cylinderGeometry args={[0.58, 0.16, topY - throatY, 16]} />
        <meshStandardMaterial color={SCR_HOPPER} roughness={0.65} metalness={0.3} />
      </mesh>
      <mesh position={[0, topY, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 0.08, 16]} />
        <meshStandardMaterial color={SCR_FRAME} roughness={0.55} metalness={0.4} />
      </mesh>
      {/* Chute across to the reactor's crown */}
      <Strut
        from={[0.16, throatY - 0.1, 0]}
        to={[SCR_TOWER_X - hopperX - 0.4, throatY + 0.4, 0]}
        r={0.09}
        color={SCR_FRAME}
      />
    </group>
  )
}

// Product tanks: two horizontal accumulators on saddles, downstream of the
// condenser. The hot supply run off the reactor and the cooled recycle line
// carrying carbon back to be re-fed are the same red/blue convention
// IsruPlant uses for its own hot and cold legs.
function CarbothermalTanks({ towerTopReach }: { towerTopReach: number }) {
  const tankX = SCR_TOWER_X + 1.55
  const tankY = SCR_SKID_H + 0.55
  const tankR = 0.36
  const tankLen = 1.5
  return (
    <group>
      {[-0.55, 0.55].map((dz) => (
        <group key={dz} position={[tankX, tankY, dz]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[tankR, tankR, tankLen, 16]} />
            <meshStandardMaterial color={SCR_VESSEL} roughness={0.4} metalness={0.5} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[(s * tankLen) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <sphereGeometry args={[tankR, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={SCR_VESSEL_HI} roughness={0.4} metalness={0.5} />
            </mesh>
          ))}
          {[-0.5, 0, 0.5].map((s) => (
            <mesh key={s} position={[s * (tankLen / 2 - 0.1), -tankR - 0.12, 0]}>
              <boxGeometry args={[0.18, 0.24, 0.5]} />
              <meshStandardMaterial color={SCR_FRAME} roughness={0.6} metalness={0.35} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Hot supply from the condenser crown down to the tanks */}
      <Strut
        from={[SCR_TOWER_X, towerTopReach - 0.5, 0]}
        to={[tankX - 0.4, tankY + 0.3, 0]}
        r={0.07}
        color={LOOP_HOT}
        glow={0.3}
      />
      {/* Cooled recycle line, back to the hopper's side of the plant */}
      <Strut
        from={[tankX, tankY - tankR - 0.05, 0.55]}
        to={[SCR_TOWER_X - 0.9, SCR_SKID_H + 0.12, 0.55]}
        r={0.06}
        color={LOOP_COLD}
      />
    </group>
  )
}

// A single tracker panel rather than IsruPlant's field of small ones — Sierra
// buys conventional power instead of making cells out of regolith the way
// Blue Alchemist's whole pitch requires, so one deployable array is the
// honest amount of hardware to show for it.
function CarbothermalTracker() {
  const mastX = -SCR_SKID_L / 2 - 1.4
  const tilt = -0.6
  const halfH = 1.0
  const centerY = 1.55
  const footY = centerY - halfH * Math.cos(tilt)
  const footZ = -halfH * Math.sin(tilt)
  return (
    <group position={[mastX, 0, 0]}>
      <mesh position={[0, footY / 2, footZ]}>
        <cylinderGeometry args={[0.09, 0.12, footY + 0.3, 10]} />
        <meshStandardMaterial color={SCR_FRAME} roughness={0.5} metalness={0.5} />
      </mesh>
      <group position={[0, centerY, 0]} rotation={[tilt, 0, 0]}>
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[2.7, halfH * 2 + 0.16, 0.1]} />
          <meshStandardMaterial color={PANEL_EDGE} roughness={0.52} metalness={0.45} />
        </mesh>
        <mesh position={[0, 0, 0.04]}>
          <boxGeometry args={[2.5, halfH * 2, 0.04]} />
          <meshStandardMaterial color={PANEL} roughness={0.44} metalness={0.12} />
        </mesh>
        {[-0.82, 0, 0.82].map((gx) => (
          <mesh key={gx} position={[gx, 0, 0.062]}>
            <boxGeometry args={[0.035, halfH * 2, 0.008]} />
            <meshStandardMaterial color={PANEL_EDGE} roughness={0.5} metalness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function SierraCarbothermal({ accent }: { accent: string }) {
  const vesselH = 1.9
  const condH = 1.0
  const towerTopReach = SCR_SKID_H + vesselH + 0.35 + condH + 0.3
  return (
    <group scale={SCR_M}>
      <CarbothermalFeet />
      {/* Skid deck, sunk slightly like every other footing on the base */}
      <mesh position={[0, SCR_SKID_H / 2 - 0.02, 0]}>
        <boxGeometry args={[SCR_SKID_L, SCR_SKID_H, SCR_SKID_W]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.6} metalness={0.35} />
      </mesh>

      <CarbothermalHopper />
      <CarbothermalTower accent={accent} />
      <CarbothermalTanks towerTopReach={towerTopReach} />
      <CarbothermalTracker />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Lunar Resources Molten Regolith Electrolysis reactor
// ---------------------------------------------------------------------------

// MRE runs raw regolith AS its own electrolyte at ~1,600°C rather than
// reducing it with a reagent — Lunar Resources' whole pitch is "no
// consumable reagents" — so the signature hardware is one big riveted
// crucible rather than Sierra's tower-and-condenser stack: a dome the
// electrolyte lives in, fed from a hopper on top, drawing the heavy
// continuous current electrolysis needs off a busbar rather than carrying
// its own solar field. Oxygen comes off as gas, metal collects molten at the
// cathode — the tank beside the dome is the metal/oxygen separator, not a
// second reaction stage the way Sierra's condenser is.
const MRE_M = UNIT_MAX_DIM / (PROJECT_SIZE_M['lunar-resources-mre'] ?? 6.8)

const MRE_HULL = '#a3a7ad' // riveted crucible shell
const MRE_HULL_DARK = '#7c8087' // rivet bands, weathered seams
const MRE_TRIM = '#4a4e57' // collars, frames, feet
const MRE_GOLD = '#c9a13e' // brass valve fitting on the collection tank
// The melt itself, seen through the crucible's viewport — paler and hotter
// than Sierra's carbothermal glow (SCR_GLOW), since this is the electrolyte
// pool rather than a reduction flame.
const MRE_GLOW = '#fff2b8'
// Heavy DC busbar to the electrodes, copper rather than steel — electrolysis
// draws current the way carbothermal reduction draws heat, and this is the
// one part of the plant built to carry it.
const MRE_BUS = '#b5502e'

const MRE_DOME_R = 1.3
const MRE_DOME_Y = MRE_DOME_R + 0.08
// Sphere surface offset at a given height — see mphFlankZ above. Every
// fitting on the crucible's flank uses this instead of a fixed radius, or it
// floats off the curve the moment its height changes.
const mreDomeZ = (y: number) => Math.sqrt(MRE_DOME_R ** 2 - (y - MRE_DOME_Y) ** 2)

const MRE_TANK_X = 2.7
const MRE_BOX_X = 4.6

// The crucible: a riveted dome fed from a hopper on top, a viewport into the
// melt on the flank, and rivet bands standing proud of the shell the way
// every seam on this base has to (nothing here is coplanar).
function MreCrucible({ accent }: { accent: string }) {
  const domeTopY = MRE_DOME_Y + MRE_DOME_R
  const viewY = MRE_DOME_Y - 0.3
  const viewZ = mreDomeZ(viewY)
  return (
    <group>
      {/* Point feet, sunk below grade like every other footing here */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.55, -0.04, Math.sin(a) * 0.55]}
          >
            <coneGeometry args={[0.1, 0.24, 8]} />
            <meshStandardMaterial color={MRE_TRIM} roughness={0.7} metalness={0.3} />
          </mesh>
        )
      })}

      {/* Riveted dome */}
      <mesh position={[0, MRE_DOME_Y, 0]}>
        <sphereGeometry args={[MRE_DOME_R, 28, 20]} />
        <meshStandardMaterial color={MRE_HULL} roughness={0.55} metalness={0.4} />
      </mesh>
      {[-0.5, 0, 0.55].map((f) => {
        const y = MRE_DOME_Y + f * MRE_DOME_R
        return (
          <mesh key={f} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[mreDomeZ(y), 0.045, 8, 32]} />
            <meshStandardMaterial color={MRE_HULL_DARK} roughness={0.6} metalness={0.35} />
          </mesh>
        )
      })}

      {/* Viewport into the melt, nested against the curve rather than
          floating off it */}
      <mesh position={[0, viewY, viewZ - 0.02]}>
        <boxGeometry args={[0.4, 0.4, 0.1]} />
        <meshStandardMaterial color={MRE_TRIM} roughness={0.6} metalness={0.35} />
      </mesh>
      <mesh position={[0, viewY, viewZ + 0.035]}>
        <circleGeometry args={[0.15, 20]} />
        <meshStandardMaterial
          color={MRE_GLOW}
          emissive={MRE_GLOW}
          emissiveIntensity={2.6}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* Latch handles either side of the port, for scale and detail */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * 0.32, viewY, mreDomeZ(viewY) - 0.01]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.02, 0.02, 0.16, 8]} />
          <meshStandardMaterial color={MRE_HULL_DARK} roughness={0.5} metalness={0.5} />
        </mesh>
      ))}

      {/* Neck collar and feed hopper */}
      <mesh position={[0, domeTopY - 0.05, 0]}>
        <cylinderGeometry args={[0.42, 0.5, 0.2, 20]} />
        <meshStandardMaterial color={MRE_TRIM} roughness={0.55} metalness={0.4} />
      </mesh>
      <mesh position={[0, domeTopY + 0.45, 0]}>
        <cylinderGeometry args={[0.85, 0.4, 0.85, 20, 1, true]} />
        <meshStandardMaterial
          color={MRE_HULL}
          roughness={0.55}
          metalness={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, domeTopY + 0.875, 0]}>
        <torusGeometry args={[0.85, 0.035, 8, 28]} />
        <meshStandardMaterial color={MRE_HULL_DARK} roughness={0.5} metalness={0.4} />
      </mesh>

      {/* Beacon on the collar, the house signature */}
      <mesh position={[0.38, domeTopY, 0.18]}>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.7}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// Product tank: metal and oxygen come off the same cell, so one collector
// downstream rather than IsruPlant's or Sierra's second reaction stage. The
// brass valve stack on top is the one warm color note on an otherwise grey
// plant, echoing the gold fitting on the reference hardware.
function MreTank() {
  const footY = 0.15
  const bodyR = 0.42
  const bodyH = 1.5
  const bodyTopY = footY + bodyH
  return (
    <group position={[MRE_TANK_X, 0, 0]}>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}:${sz}`} position={[sx * 0.3, footY / 2 - 0.03, sz * 0.3]}>
            <cylinderGeometry args={[0.06, 0.08, footY + 0.1, 8]} />
            <meshStandardMaterial color={MRE_TRIM} roughness={0.65} metalness={0.35} />
          </mesh>
        ))
      )}
      <mesh position={[0, footY + bodyH / 2, 0]}>
        <cylinderGeometry args={[bodyR, bodyR, bodyH, 20]} />
        <meshStandardMaterial color={MRE_HULL} roughness={0.5} metalness={0.45} />
      </mesh>
      <mesh position={[0, bodyTopY, 0]}>
        <sphereGeometry args={[bodyR, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={MRE_HULL} roughness={0.45} metalness={0.45} />
      </mesh>
      {/* Brass valve stack */}
      <mesh position={[0, bodyTopY + 0.16, 0]}>
        <cylinderGeometry args={[0.1, 0.13, 0.32, 12]} />
        <meshStandardMaterial color={MRE_GOLD} roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, bodyTopY + 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
        <meshStandardMaterial color={MRE_GOLD} roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Sight-glass band, a thin lit ring near the base */}
      <mesh position={[0, footY + 0.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[bodyR + 0.01, 0.025, 8, 24]} />
        <meshStandardMaterial
          color={MRE_GLOW}
          emissive={MRE_GLOW}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// Power conditioning box: the electrode driver, with its own small glowing
// port (the same rectifier gear runs hot) and the heavy busbar back to the
// crucible. A grid cable trails off the far edge rather than a solar field —
// electrolysis draws more continuous current than a plant this size could
// collect on its own roof, so it plugs into the base rather than generating
// for itself, the same reasoning LIFE's softgoods module uses for power.
function MreBox({ crucibleBaseY }: { crucibleBaseY: number }) {
  const footY = 0.15
  const w = 1.05
  const h = 0.95
  const d = 0.9
  return (
    <group position={[MRE_BOX_X, 0, 0]}>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}:${sz}`}
            position={[(sx * (w - 0.14)) / 2, footY / 2 - 0.03, (sz * (d - 0.14)) / 2]}
          >
            <cylinderGeometry args={[0.06, 0.08, footY + 0.1, 8]} />
            <meshStandardMaterial color={MRE_TRIM} roughness={0.65} metalness={0.35} />
          </mesh>
        ))
      )}
      <mesh position={[0, footY + h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.55} metalness={0.3} />
      </mesh>
      {/* Vent slats, the box's own waste heat */}
      {Array.from({ length: 4 }, (_, i) => (
        <mesh key={i} position={[-w / 2 - 0.01, footY + 0.25 + i * 0.16, 0]}>
          <boxGeometry args={[0.02, 0.09, d - 0.16]} />
          <meshStandardMaterial color={MRE_TRIM} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {/* Glowing port — the rectifier gear runs hot too */}
      <mesh position={[0, footY + h * 0.6, d / 2 + 0.01]}>
        <boxGeometry args={[0.3, 0.24, 0.05]} />
        <meshStandardMaterial color={MRE_TRIM} roughness={0.6} metalness={0.35} />
      </mesh>
      <mesh position={[0, footY + h * 0.6, d / 2 + 0.045]}>
        <planeGeometry args={[0.22, 0.16]} />
        <meshStandardMaterial
          color={MRE_GLOW}
          emissive={MRE_GLOW}
          emissiveIntensity={2.0}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* Busbar back to the crucible — "to" is in this group's own local
          frame, so it has to subtract MRE_BOX_X to land back at the
          crucible's world-space x = 0. */}
      <Strut
        from={[-w / 2, footY + h * 0.7, 0]}
        to={[-MRE_BOX_X + 0.6, crucibleBaseY, 0]}
        r={0.06}
        color={MRE_BUS}
      />
      {/* Grid cable stub, trailing off toward the base's buried conduit run
          rather than a solar field of its own — short on purpose, since the
          run itself belongs to the base's cable network, not this plot. */}
      <Strut
        from={[w / 2, footY + 0.1, d / 2 - 0.1]}
        to={[w / 2 + 0.35, -0.05, d / 2 + 0.3]}
        r={0.045}
        color={MRE_TRIM}
      />
    </group>
  )
}

function LunarResourcesMre({ accent }: { accent: string }) {
  const crucibleBaseY = 0.55
  return (
    <group scale={MRE_M}>
      <MreCrucible accent={accent} />
      <MreTank />
      <MreBox crucibleBaseY={crucibleBaseY} />
      {/* Hot product line off the crucible into the tank */}
      <Strut
        from={[0.6, crucibleBaseY, 0]}
        to={[MRE_TANK_X - 0.5, 0.55, 0]}
        r={0.07}
        color={LOOP_HOT}
        glow={0.3}
      />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Fission surface power: eVinci-class microreactor + radiator wall
// ---------------------------------------------------------------------------

// Local units per METER, as in the construction site: the plant is authored at
// real size and this cancels the model normalization exactly.
const POWER_M = UNIT_MAX_DIM / (TYPE_SIZE_M.power ?? 22)

const REACTOR_SHELL = '#cdc7ae' // pale thermal coating on the reactor drum
const REACTOR_DUCT = '#26282b' // the shroud is nearly black in every published render
const RAD_PANEL = '#c6cad0'
const RAD_PANEL_ALT = '#aeb3ba'

// Radiator wall geometry (meters).
const RAD_BAYS = 8
const RAD_BAY_W = 2.1
const RAD_H = 3.2 // panel stack, split by a mid rail
const RAD_Y = 0.95 // underside of the wall above the regolith
const RAD_X0 = -5.8 // inboard end, where the duct meets it
const RAD_TOP = RAD_Y + RAD_H
const RAD_FRAME = '#8b9099'

// The waste-heat radiator: a long straight run of framed panel bays on legs.
// This linear wall, not the reactor itself, is what makes a surface fission
// plant recognizable — 40 kWe of electricity means rejecting several hundred
// kW of heat, and with no air to convect into that takes a lot of area.
function RadiatorWall() {
  const posts = Array.from({ length: RAD_BAYS + 1 }, (_, i) => RAD_X0 + i * RAD_BAY_W)
  const wallLen = RAD_BAYS * RAD_BAY_W
  const midX = RAD_X0 + wallLen / 2
  const panelH = RAD_H / 2 - 0.13
  return (
    <group>
      {/* Horizontal rails: bottom, mid and top chords run the whole length */}
      {[RAD_Y, RAD_Y + RAD_H / 2, RAD_TOP].map((y) => (
        <mesh key={y} position={[midX, y, 0]}>
          <boxGeometry args={[wallLen + 0.16, 0.14, 0.5]} />
          <meshStandardMaterial color={RAD_FRAME} metalness={0.5} roughness={0.5} />
        </mesh>
      ))}

      {posts.map((x, i) => (
        <group key={x}>
          {/* Bay post */}
          <mesh position={[x, RAD_Y + RAD_H / 2, 0]}>
            <boxGeometry args={[0.13, RAD_H, 0.46]} />
            <meshStandardMaterial
              color={RAD_FRAME}
              metalness={0.5}
              roughness={0.5}
            />
          </mesh>
          {/* Leg. Runs well below the surface rather than ending in a foot
              pad: the wall is 17 m long and rigid while the ground under it
              is not level, so a pad would hover at one end and bury at the
              other. A slender leg vanishing into the regolith reads as
              planted at any ground angle. */}
          <mesh position={[x, (RAD_Y - 1.0) / 2, 0]}>
            <cylinderGeometry args={[0.075, 0.075, RAD_Y + 1.0, 8]} />
            <meshStandardMaterial
              color={RAD_FRAME}
              metalness={0.5}
              roughness={0.5}
            />
          </mesh>
          {/* Splayed brace every other bay, for lateral stiffness */}
          {i % 2 === 0 && i < RAD_BAYS && (
            <Strut
              from={[x, 0.05, 0]}
              to={[x + RAD_BAY_W * 0.8, RAD_Y, 0.34]}
              r={0.045}
              color={RAD_FRAME}
            />
          )}
        </group>
      ))}

      {/* Panels: two courses per bay, alternating tone bay to bay so the run
          reads as a series of discrete radiator faces rather than one long
          ribbon. */}
      {Array.from({ length: RAD_BAYS }, (_, i) => {
        const x = RAD_X0 + (i + 0.5) * RAD_BAY_W
        const tone = i % 2 ? RAD_PANEL_ALT : RAD_PANEL
        return [0, 1].map((row) => (
          <mesh
            key={`${i}:${row}`}
            position={[
              x,
              RAD_Y + 0.13 + panelH / 2 + row * (RAD_H / 2),
              0,
            ]}
          >
            <boxGeometry args={[RAD_BAY_W - 0.2, panelH, 0.1]} />
            <meshStandardMaterial
              color={tone}
              metalness={0.35}
              roughness={0.42}
            />
          </mesh>
        ))
      })}

      {/* Mullion splitting each bay, echoing the vertical ribbing of the
          real panels without a texture. */}
      {Array.from({ length: RAD_BAYS }, (_, i) => (
        <mesh
          key={i}
          position={[RAD_X0 + (i + 0.5) * RAD_BAY_W, RAD_Y + RAD_H / 2, 0.055]}
        >
          <boxGeometry args={[0.05, RAD_H - 0.3, 0.06]} />
          <meshStandardMaterial color={RAD_FRAME} metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

// The reactor: a horizontal drum held clear of the ground on a braced stand,
// venting into the radiator run through a flared shroud.
function ReactorUnit({ accent }: { accent: string }) {
  const drumX = -9.6
  // Level with the shroud, which is centered on the radiator wall's midline.
  const drumY = RAD_Y + RAD_H / 2
  const drumR = 0.85
  const drumLen = 2.8
  const standFeet: [number, number][] = [
    [-10.7, -1.7],
    [-10.7, 1.7],
    [-8.6, -1.7],
    [-8.6, 1.7],
  ]
  return (
    <group>
      {/* Drum, lying along the plant's long axis */}
      <mesh position={[drumX, drumY, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[drumR, drumR, drumLen, 20]} />
        <meshStandardMaterial
          color={REACTOR_SHELL}
          metalness={0.25}
          roughness={0.62}
        />
      </mesh>
      {/* Dark closure head on the outboard end, with a raised rim */}
      <mesh
        position={[drumX - drumLen / 2 - 0.09, drumY, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[drumR * 1.02, drumR * 0.94, 0.2, 20]} />
        <meshStandardMaterial color={REACTOR_DUCT} metalness={0.4} roughness={0.55} />
      </mesh>
      <mesh
        position={[drumX - drumLen / 2 - 0.02, drumY, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <torusGeometry args={[drumR * 0.99, 0.06, 8, 24]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Coolant headers along the drum */}
      {[-0.55, 0.55].map((z) => (
        <mesh key={z} position={[drumX, drumY + 0.62, z]}>
          <cylinderGeometry args={[0.09, 0.09, drumLen * 0.9, 8]} />
          <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />
        </mesh>
      ))}

      {/* Braced stand. Its feet sit on pads: the stand spans only ~3 m, so
          unlike the radiator run it cannot straddle enough ground to matter. */}
      {standFeet.map(([x, z]) => (
        <group key={`${x}:${z}`}>
          <Strut from={[x, 0.06, z]} to={[x * 0.985, drumY - 0.5, z * 0.2]} r={0.09} />
          <mesh position={[x, 0.05, z]}>
            <cylinderGeometry args={[0.3, 0.34, 0.1, 12]} />
            <meshStandardMaterial color={HULL_DARK} roughness={0.7} />
          </mesh>
        </group>
      ))}
      {/* Cross-bracing between the two A-frames */}
      {[-1, 1].map((s) => (
        <Strut
          key={s}
          from={[-10.7, 0.3, s * 1.7]}
          to={[-8.6, drumY - 0.6, s * 0.4]}
          r={0.05}
        />
      ))}
      <Strut
        from={[-10.6, 1.2, 0]}
        to={[-8.7, 1.2, 0]}
        r={0.06}
      />

      {/* Flared shroud carrying heat into the radiator wall. A four-sided
          frustum (thetaStart offsets it so the flats face the axes) squashed
          in Z, which is the duct's rectangular section: 3.2 m tall at the wall
          to match it exactly, necking down to the drum's diameter. */}
      <mesh
        position={[-7.0, drumY, 0]}
        rotation={[0, 0, -Math.PI / 2]}
        scale={[1, 1, 0.4]}
      >
        <cylinderGeometry args={[2.3, 1.2, 2.4, 4, 1, false, Math.PI / 4]} />
        <meshStandardMaterial color={REACTOR_DUCT} metalness={0.3} roughness={0.6} />
      </mesh>
      {/* Collar over the joint: the drum is round and the shroud rectangular,
          so without it the section change shows as a fin on a barrel. */}
      <mesh position={[-8.15, drumY, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[drumR * 1.06, drumR * 1.06, 0.5, 20]} />
        <meshStandardMaterial color={REACTOR_DUCT} metalness={0.4} roughness={0.55} />
      </mesh>

      {/* Status beacon, on a short mast off the top of the drum */}
      <mesh position={[drumX, drumY + 1.35, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 1.3, 6]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[drumX, drumY + 2.14, 0]}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.9}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function Power({ accent }: { accent: string }) {
  return (
    <group scale={POWER_M}>
      <ReactorUnit accent={accent} />
      <RadiatorWall />
      {/* An operator walking the radiator wall's front clearance zone */}
      <PatrollingAstronaut center={[1.5, 3.0]} radius={2.0} seed={6} accent={accent} />

      {/* A spooled-off length of power cable and a spares pallet, both kept
          behind the wall (-Z) rather than in its front clearance zone the
          astronaut above is already walking. */}
      <group position={[-8.0, 0, -2.0]}>
        <CableReel />
      </group>
      <group position={[9.0, 0, -2.2]} rotation={[0, -1.1, 0]}>
        <CargoPallet hard seed={6} />
      </group>
      {/* A battery rack mid-charge and the junction box its own feed
          terminates in — the storage/distribution side of a power plant,
          not just the generation half. */}
      <group position={[-9.2, 0, -3.6]} rotation={[0, 0.9, 0]}>
        <BatteryStack seed={6} />
      </group>
      <group position={[-7.6, 0, -4.3]}>
        <JunctionBox />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Fission surface power: Lockheed Martin FSP
// ---------------------------------------------------------------------------

// Local units per METER, as in the other true-size installations.
const FSP_M =
  UNIT_MAX_DIM / (PROJECT_SIZE_M['lockheed-fission-surface-power'] ?? 19)

const FSP_BODY = '#e7eaef' // white bodywork: the bus, the collar, the mast
const FSP_TRIM = '#1f6cc4' // Lockheed blue, on the landing feet and wing braces
const FSP_GOLD = '#b08c2e' // MLI over the reactor and the conversion machinery
const FSP_RAD = '#b7bec7' // radiator face
const FSP_FRAME = '#2b2f36' // panel segmentation, and the coolant loop below
const FSP_TIP = '#d9622b' // wing-tip markings

// Stations up the stack, in meters above the regolith. The whole unit is one
// tall column, so these read top to bottom as the assembly order: bus, collar,
// truss, spreader wing, and the radiator mast above it.
const FSP_DECK_Y = 2.3 // top of the machinery, underside of the collar
const FSP_COLLAR_TOP = 3.05
const FSP_WING_Y = 6.1
const FSP_MAST_TOP = 18.7

// The radiator bank: courses of panel either side of the mast, two columns to a
// side, coming to about 96 m² counting both faces. 40 kWe of electricity means
// rejecting several hundred kW of heat with no air to convect into, which takes
// area on this scale — and standing it VERTICAL is the whole idea of the
// layout. At the pole the sun never rises far, so a panel held on edge to it
// sheds heat to black sky instead of trading it with the hot regolith the way a
// flat roof of radiator would.
const FSP_RAD_Y0 = 6.55
const FSP_RAD_ROWS = 8
const FSP_RAD_ROW_H = 1.475
const FSP_RAD_COL_W = 1.17
const FSP_RAD_COLS = 2
const FSP_RAD_X0 = 0.28 // inboard edge, clear of the mast
const FSP_RAD_X1 = FSP_RAD_X0 + FSP_RAD_COLS * FSP_RAD_COL_W

// One landing foot: a splayed blue A-frame out to a broad pad. Set on the
// diagonals so no foot stands in front of the machinery it is holding up.
function FspFoot() {
  return (
    <group>
      {/* Both members root INSIDE the bus floor rather than against its face,
          so the foot reads as bolted through the structure. */}
      {[-1, 1].map((s) => (
        <Strut
          key={s}
          from={[1.42, 0.48, s * 0.18]}
          to={[2.24, 0.19, s * 0.35]}
          r={0.075}
          color={FSP_TRIM}
        />
      ))}
      <Strut
        from={[1.48, 0.33, 0]}
        to={[2.22, 0.17, 0]}
        r={0.055}
        color={FSP_TRIM}
      />
      {/* Broad pad. Ground pressure is the whole problem on regolith nobody
          has compacted, which is why these are plates and not spikes. */}
      <mesh position={[2.3, 0.09, 0]}>
        <boxGeometry args={[0.6, 0.17, 0.92]} />
        <meshStandardMaterial color={FSP_TRIM} metalness={0.35} roughness={0.5} />
      </mesh>
    </group>
  )
}

// The reactor and its power conversion, slung under the collar: a shielded
// vessel on the axis, Stirling converters either side, and the primary loop
// running round them. Kept deliberately dense and dark — everything above the
// collar is deployed structure, and this is the only part that is machinery.
function FspBus({ accent }: { accent: string }) {
  return (
    <group>
      {/* Bus floor, which the feet hang off */}
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[1.72, 1.66, 0.22, 28]} />
        <meshStandardMaterial color={FSP_BODY} metalness={0.3} roughness={0.55} />
      </mesh>

      {/* Shielded reactor vessel on the axis */}
      <mesh position={[0, 1.24, 0]}>
        <cylinderGeometry args={[0.5, 0.56, 1.36, 20]} />
        <meshStandardMaterial color={FSP_GOLD} metalness={0.72} roughness={0.36} />
      </mesh>
      <mesh position={[0, 1.98, 0]}>
        <cylinderGeometry args={[0.36, 0.5, 0.28, 20]} />
        <meshStandardMaterial color={FSP_FRAME} metalness={0.4} roughness={0.6} />
      </mesh>

      {/* Stirling converters, lying either side of the vessel */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * 0.98, 1.02, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.29, 0.29, 0.86, 16]} />
          <meshStandardMaterial
            color={FSP_GOLD}
            metalness={0.7}
            roughness={0.38}
          />
        </mesh>
      ))}

      {/* Primary loop, taking heat from the vessel out to the mast */}
      <mesh position={[0, 1.76, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.04, 0.12, 10, 28]} />
        <meshStandardMaterial color={FSP_FRAME} metalness={0.55} roughness={0.45} />
      </mesh>
      {[-1, 1].map((s) => (
        <Strut
          key={s}
          from={[s * 0.42, 1.9, 0]}
          to={[s * 1.02, 1.76, 0]}
          r={0.09}
          color={FSP_FRAME}
        />
      ))}

      {/* Accumulators */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.78, s * 0.95]}>
          <sphereGeometry args={[0.27, 14, 12]} />
          <meshStandardMaterial color={FSP_FRAME} metalness={0.5} roughness={0.5} />
        </mesh>
      ))}

      {/* Corner posts carrying the collar over the machinery */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 1.44, (0.5 + FSP_DECK_Y) / 2, Math.sin(a) * 1.44]}
          >
            <cylinderGeometry args={[0.1, 0.1, FSP_DECK_Y - 0.5, 10]} />
            <meshStandardMaterial color={FSP_BODY} metalness={0.4} roughness={0.5} />
          </mesh>
        )
      })}

      {/* Work lights under the bus, aimed at the ground it landed on */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 1.2, 0.28, Math.sin(a) * 1.2]}>
            <cylinderGeometry args={[0.11, 0.11, 0.06, 10]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

// The collar over the machinery and the truss above it, which together carry
// the mast. The truss is left open because that is what it looks like: nothing
// up here is pressurized, so the structure is all chord and diagonal.
function FspTower() {
  const chordHalf = (t: number) => 0.6 * (1 - t) + 0.42 * t
  return (
    <group>
      {/* Collar: the ring of avionics and cabling round the top of the bus. Its
          height is derived so the flange lands flush on it rather than hovering
          a hand's width above. */}
      <mesh position={[0, (FSP_DECK_Y + FSP_COLLAR_TOP - 0.12) / 2, 0]}>
        <cylinderGeometry
          args={[1.82, 1.82, FSP_COLLAR_TOP - 0.12 - FSP_DECK_Y, 28]}
        />
        <meshStandardMaterial color={FSP_BODY} metalness={0.32} roughness={0.5} />
      </mesh>
      <mesh position={[0, FSP_COLLAR_TOP - 0.06, 0]}>
        <cylinderGeometry args={[1.98, 1.9, 0.12, 28]} />
        <meshStandardMaterial color={FSP_BODY} metalness={0.35} roughness={0.48} />
      </mesh>
      <mesh position={[0, FSP_DECK_Y + 0.13, 0]}>
        <cylinderGeometry args={[1.84, 1.84, 0.1, 28]} />
        <meshStandardMaterial color={FSP_FRAME} metalness={0.4} roughness={0.5} />
      </mesh>

      {/* Truss chords */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        const [cx, cz] = [Math.cos(a), Math.sin(a)]
        return (
          <Strut
            key={i}
            from={[cx * chordHalf(0), FSP_COLLAR_TOP, cz * chordHalf(0)]}
            to={[cx * chordHalf(1), FSP_WING_Y, cz * chordHalf(1)]}
            r={0.075}
            color={FSP_BODY}
          />
        )
      })}
      {/* Diagonals, one per face per tier, alternating hand up the tower */}
      {[0, 1, 2].map((tier) => {
        const t0 = tier / 3
        const t1 = (tier + 1) / 3
        const y0 = FSP_COLLAR_TOP + (FSP_WING_Y - FSP_COLLAR_TOP) * t0
        const y1 = FSP_COLLAR_TOP + (FSP_WING_Y - FSP_COLLAR_TOP) * t1
        return [0, 1, 2, 3].map((i) => {
          const flip = (tier + i) % 2
          const a0 = ((i + (flip ? 1 : 0)) / 4) * Math.PI * 2 + Math.PI / 4
          const a1 = ((i + (flip ? 0 : 1)) / 4) * Math.PI * 2 + Math.PI / 4
          return (
            <Strut
              key={`${tier}:${i}`}
              from={[
                Math.cos(a0) * chordHalf(t0),
                y0,
                Math.sin(a0) * chordHalf(t0),
              ]}
              to={[
                Math.cos(a1) * chordHalf(t1),
                y1,
                Math.sin(a1) * chordHalf(t1),
              ]}
              r={0.042}
              color={FSP_GOLD}
            />
          )
        })
      })}
    </group>
  )
}

// The spreader wing at the root of the mast, and the braces that hold it. This
// is the part of the reference silhouette that makes the unit recognizable:
// the radiator bank is far wider than the bus that landed it, so something has
// to reach out and take the load, and it ends up looking like a wing.
function FspWing() {
  return (
    <group>
      <mesh position={[0, FSP_WING_Y, 0]}>
        <boxGeometry args={[5.0, 0.24, 0.95]} />
        <meshStandardMaterial color={FSP_BODY} metalness={0.35} roughness={0.45} />
      </mesh>
      {/* Taper to the tips, then a marked cap on each */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 2.68, FSP_WING_Y, 0]}>
            <boxGeometry args={[0.38, 0.19, 0.66]} />
            <meshStandardMaterial
              color={FSP_BODY}
              metalness={0.35}
              roughness={0.45}
            />
          </mesh>
          <mesh position={[s * 2.93, FSP_WING_Y, 0]}>
            <boxGeometry args={[0.14, 0.16, 0.5]} />
            <meshStandardMaterial color={FSP_TIP} roughness={0.5} />
          </mesh>
          {/* Blue brace, deck edge to the underside of the wing */}
          <Strut
            from={[s * 1.5, FSP_COLLAR_TOP - 0.06, 0]}
            to={[s * 2.12, FSP_WING_Y - 0.1, 0]}
            r={0.085}
            color={FSP_TRIM}
          />
        </group>
      ))}
      {/* Fairing where the mast passes through */}
      <mesh position={[0, FSP_WING_Y + 0.24, 0]}>
        <boxGeometry args={[1.3, 0.3, 0.8]} />
        <meshStandardMaterial color={FSP_BODY} metalness={0.35} roughness={0.45} />
      </mesh>
    </group>
  )
}

// The mast and the radiator courses on it.
function FspRadiatorMast({ accent }: { accent: string }) {
  const bankTop = FSP_RAD_Y0 + FSP_RAD_ROWS * FSP_RAD_ROW_H
  return (
    <group>
      {/* Mast, tapering as the load comes off it */}
      <mesh position={[0, (FSP_WING_Y + FSP_MAST_TOP) / 2, 0]}>
        <cylinderGeometry
          args={[0.13, 0.2, FSP_MAST_TOP - FSP_WING_Y, 14]}
        />
        <meshStandardMaterial color={FSP_BODY} metalness={0.4} roughness={0.44} />
      </mesh>
      <mesh position={[0, FSP_MAST_TOP + 0.05, 0]}>
        <boxGeometry args={[0.62, 0.1, 0.5]} />
        <meshStandardMaterial color={FSP_BODY} metalness={0.4} roughness={0.44} />
      </mesh>
      <mesh position={[0, FSP_MAST_TOP + 0.2, 0]}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </mesh>

      {[-1, 1].map((s) => (
        <group key={s}>
          {/* Panel courses */}
          {Array.from({ length: FSP_RAD_ROWS }, (_, r) =>
            Array.from({ length: FSP_RAD_COLS }, (_, c) => (
              <mesh
                key={`${r}:${c}`}
                position={[
                  s * (FSP_RAD_X0 + (c + 0.5) * FSP_RAD_COL_W),
                  FSP_RAD_Y0 + (r + 0.5) * FSP_RAD_ROW_H,
                  0,
                ]}
              >
                <boxGeometry
                  args={[FSP_RAD_COL_W - 0.09, FSP_RAD_ROW_H - 0.09, 0.06]}
                />
                <meshStandardMaterial
                  color={FSP_RAD}
                  metalness={0.32}
                  roughness={0.44}
                />
              </mesh>
            ))
          )}
          {/* Spars up the panel edges */}
          {Array.from({ length: FSP_RAD_COLS + 1 }, (_, c) => (
            <mesh
              key={`spar${c}`}
              position={[
                s * (FSP_RAD_X0 + c * FSP_RAD_COL_W),
                (FSP_RAD_Y0 + bankTop) / 2,
                0,
              ]}
            >
              <boxGeometry args={[0.08, bankTop - FSP_RAD_Y0, 0.11]} />
              <meshStandardMaterial
                color={FSP_FRAME}
                metalness={0.45}
                roughness={0.5}
              />
            </mesh>
          ))}
          {/* Cross rails every other course, stopping short of the mast */}
          {[0, 2, 4, 6, 8].map((r) => (
            <mesh
              key={`rail${r}`}
              position={[
                s * (FSP_RAD_X0 + FSP_RAD_X1) / 2,
                FSP_RAD_Y0 + r * FSP_RAD_ROW_H,
                0,
              ]}
            >
              <boxGeometry args={[FSP_RAD_X1 - FSP_RAD_X0, 0.08, 0.11]} />
              <meshStandardMaterial
                color={FSP_FRAME}
                metalness={0.45}
                roughness={0.5}
              />
            </mesh>
          ))}
          {/* Coolant riser feeding the bank from the loop below */}
          <Strut
            from={[s * 0.26, FSP_WING_Y + 0.3, 0.12]}
            to={[s * 0.26, bankTop - 0.4, 0.12]}
            r={0.055}
            color={FSP_FRAME}
          />
        </group>
      ))}
    </group>
  )
}

// Lockheed Martin's Fission Surface Power unit: a landed reactor bus under a
// mast of vertical radiator. Where the eVinci above lays its radiator out as a
// wall on the ground, this one stands it up on a spar — same problem, opposite
// answer, which is the point of showing whichever design is leading the race.
function LockheedFsp({ accent }: { accent: string }) {
  return (
    <group scale={FSP_M}>
      <FspBus accent={accent} />
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, (i / 4) * Math.PI * 2 + Math.PI / 4, 0]}>
          <FspFoot />
        </group>
      ))}
      <FspTower />
      <FspWing />
      <FspRadiatorMast accent={accent} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Fission surface power: IX (Intuitive Machines / X-energy) FSP
// ---------------------------------------------------------------------------

// Local units per METER, as in the other true-size installations.
const IXP_M = UNIT_MAX_DIM / (PROJECT_SIZE_M['ix-fission-surface-power'] ?? 13)

const IXP_BODY = '#dfe3e9' // structure: the base plate rim and the manifold
const IXP_RAD = '#c3c9d2' // canopy face
const IXP_TUBE = '#a2abb5' // the heat pipes
const IXP_FRAME = '#2a2f37' // ribs, bands and plumbing
const IXP_TRIM = '#17243d' // Intuitive Machines navy, on the base and machinery
const IXP_GOLD = '#a8862c' // MLI over the core stack

// Stations up the unit, in meters above the regolith. It reads bottom to top as
// the power path: core, shadow shield, converters, heat pipes, canopy.
const IXP_PLATE_TOP = 0.28
const IXP_CORE_TOP = 1.1
const IXP_SHIELD_TOP = 1.75
const IXP_PCU_Y = 2.7 // centre of the conversion units
const IXP_MANIFOLD_Y = 10.62
const IXP_CANOPY_Y = 11.0
const IXP_CANOPY_R = 6.5

// The heat-pipe bundle: ten pipes on a half-meter ring, carrying the core's heat
// ten meters straight up to the canopy.
const IXP_PIPES = 10
const IXP_PIPE_RING = 0.5
const IXP_PIPE_TOP = 10.4

// The core, its shield and the plate they stand on. There is no lander bus here
// and no legs: this design emplaces the reactor AT GRADE and puts the shielding
// in the ground under it, which is why the whole thing rises out of a plate a
// meter and a half across rather than off a set of feet.
function IxpBase({ accent }: { accent: string }) {
  return (
    <group>
      {/* Bedding ring, graded into the regolith */}
      <mesh position={[0, 0.035, 0]}>
        <cylinderGeometry args={[1.55, 1.6, 0.07, 30]} />
        <meshStandardMaterial color={IXP_FRAME} metalness={0.3} roughness={0.62} />
      </mesh>
      {/* Plate */}
      <mesh position={[0, IXP_PLATE_TOP / 2 + 0.035, 0]}>
        <cylinderGeometry args={[1.35, 1.42, IXP_PLATE_TOP - 0.035, 30]} />
        <meshStandardMaterial color={IXP_TRIM} metalness={0.42} roughness={0.5} />
      </mesh>
      <mesh position={[0, IXP_PLATE_TOP, 0]}>
        <cylinderGeometry args={[1.38, 1.38, 0.06, 30]} />
        <meshStandardMaterial color={IXP_BODY} metalness={0.38} roughness={0.48} />
      </mesh>

      {/* Core stack under MLI. X-energy's contribution to the bid is TRISO fuel,
          which is the reason this vessel is as small as it is — the fuel takes
          its own containment with it, in the pebble. */}
      <mesh position={[0, (IXP_PLATE_TOP + IXP_CORE_TOP) / 2, 0]}>
        <cylinderGeometry args={[0.52, 0.56, IXP_CORE_TOP - IXP_PLATE_TOP, 22]} />
        <meshStandardMaterial color={IXP_GOLD} metalness={0.72} roughness={0.36} />
      </mesh>

      {/* Shadow shield: a truncated cone that widens going UP, because what it
          is for is casting a radiation shadow over everything above it. The
          machinery sits inside that cone and nothing else has to be shielded. */}
      <mesh position={[0, (IXP_CORE_TOP + IXP_SHIELD_TOP) / 2, 0]}>
        <cylinderGeometry
          args={[1.02, 0.6, IXP_SHIELD_TOP - IXP_CORE_TOP, 24]}
        />
        <meshStandardMaterial color={IXP_FRAME} metalness={0.34} roughness={0.58} />
      </mesh>
      <mesh position={[0, IXP_SHIELD_TOP, 0]}>
        <cylinderGeometry args={[1.06, 1.06, 0.08, 24]} />
        <meshStandardMaterial color={IXP_TRIM} metalness={0.4} roughness={0.5} />
      </mesh>

      {/* Switchgear on the plate, and the cable that leaves the plant. 40 kWe
          has to get to the base somehow, and this is the end it leaves from. */}
      <mesh position={[1.0, 0.52, 0.34]}>
        <boxGeometry args={[0.52, 0.42, 0.38]} />
        <meshStandardMaterial color={IXP_TRIM} metalness={0.44} roughness={0.46} />
      </mesh>
      <Strut
        from={[1.0, 0.7, 0.34]}
        to={[0.72, 2.0, 0.42]}
        r={0.045}
        color={IXP_FRAME}
      />

      {/* Work lights round the plate, aimed at the ground crew would stand on */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.5
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 1.2, IXP_PLATE_TOP + 0.04, Math.sin(a) * 1.2]}
          >
            <cylinderGeometry args={[0.1, 0.1, 0.06, 10]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

// The heat-pipe bundle, and the spine inside it.
//
// It looks impossibly slender for what it carries — a 13 m canopy on a column a
// meter across — and it is worth saying why it isn't. At 1.62 m/s² the canopy
// weighs a sixth of what it would here, and there is no air to load it: no wind,
// no gusts, nothing that would size a terrestrial mast. What is left is its own
// weight and whatever the crew bumps into it, so ten steel pipes on a ring are
// plenty, and no guy wires are needed to stand it up.
function IxpStack() {
  const height = IXP_PIPE_TOP - IXP_PLATE_TOP
  return (
    <group>
      {Array.from({ length: IXP_PIPES }, (_, i) => {
        const a = (i / IXP_PIPES) * Math.PI * 2
        return (
          <mesh
            key={i}
            position={[
              Math.cos(a) * IXP_PIPE_RING,
              IXP_PLATE_TOP + height / 2,
              Math.sin(a) * IXP_PIPE_RING,
            ]}
          >
            <cylinderGeometry args={[0.07, 0.07, height, 10]} />
            <meshStandardMaterial
              color={IXP_TUBE}
              metalness={0.68}
              roughness={0.34}
            />
          </mesh>
        )
      })}

      {/* Structural spine up the middle of the bundle */}
      <mesh position={[0, IXP_PLATE_TOP + height / 2, 0]}>
        <cylinderGeometry args={[0.13, 0.15, height, 12]} />
        <meshStandardMaterial color={IXP_BODY} metalness={0.42} roughness={0.44} />
      </mesh>

      {/* Bands holding the pipes to the spine. Only above the converters: below
          them the pipes are still splayed out to their own hot ends. */}
      {[4.1, 6.3, 8.5].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[IXP_PIPE_RING, 0.045, 8, 24]} />
          <meshStandardMaterial
            color={IXP_FRAME}
            metalness={0.5}
            roughness={0.48}
          />
        </mesh>
      ))}
    </group>
  )
}

// The Stirling conversion units, slung either side of the bundle just above the
// shield. Pressure vessels, so they are cylinders and banded like it — and they
// sit LOW, because every meter of hot leg between the core and the converter is
// heat lost before it ever becomes electricity.
function IxpConverters() {
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 1.0, IXP_PCU_Y, 0]}>
          <mesh>
            <cylinderGeometry args={[0.42, 0.42, 1.46, 18]} />
            <meshStandardMaterial
              color={IXP_TRIM}
              metalness={0.52}
              roughness={0.42}
            />
          </mesh>
          {/* Domed ends */}
          {[-1, 1].map((e) => (
            <mesh key={e} position={[0, e * 0.73, 0]} scale={[1, 0.45, 1]}>
              <sphereGeometry args={[0.42, 18, 10]} />
              <meshStandardMaterial
                color={IXP_TRIM}
                metalness={0.52}
                roughness={0.42}
              />
            </mesh>
          ))}
          {/* Bands */}
          {[-0.52, -0.18, 0.18, 0.52].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.44, 0.04, 8, 20]} />
              <meshStandardMaterial
                color={IXP_FRAME}
                metalness={0.5}
                roughness={0.46}
              />
            </mesh>
          ))}
          {/* Hot leg in from the core, cold leg out to the pipe bundle */}
          <Strut
            from={[-s * 0.3, -0.62, 0]}
            to={[-s * 0.62, -1.05, 0]}
            r={0.07}
            color={IXP_GOLD}
          />
          <Strut
            from={[-s * 0.3, 0.5, 0]}
            to={[-s * 0.56, 0.86, 0]}
            r={0.06}
            color={IXP_FRAME}
          />
        </group>
      ))}
    </group>
  )
}

// The radiator canopy, and the manifold under it that the pipes run into.
//
// This is the whole argument of the design, and it is the opposite of the two
// bids beside it: the eVinci lays its radiator out as a wall on the ground and
// Lockheed stands it up on a mast, where this one holds it FLAT, overhead, like
// a parasol. Which is a real answer at this latitude rather than a stylistic
// one. The sun here never rises far off the horizon, so a horizontal sheet meets
// it at a grazing angle and picks up almost no solar load, while its upper face
// looks straight into black sky — and its shadow falls on the machinery below.
function IxpCanopy({ accent }: { accent: string }) {
  return (
    <group>
      {/* Manifold: the pipes terminate here and the heat spreads into the disc */}
      <mesh position={[0, IXP_MANIFOLD_Y, 0]}>
        <cylinderGeometry args={[0.72, 0.78, 0.68, 24]} />
        <meshStandardMaterial color={IXP_BODY} metalness={0.44} roughness={0.42} />
      </mesh>

      {/* Hub plate, then the canopy itself. Kept to 40 radial segments rather
          than smoothed: a deployed radiator is a fan of flat gores, and the
          facets are what say so. */}
      <mesh position={[0, IXP_CANOPY_Y - 0.09, 0]}>
        <cylinderGeometry args={[1.0, 1.0, 0.14, 40]} />
        <meshStandardMaterial color={IXP_BODY} metalness={0.4} roughness={0.44} />
      </mesh>
      <mesh position={[0, IXP_CANOPY_Y, 0]}>
        <cylinderGeometry args={[IXP_CANOPY_R, IXP_CANOPY_R, 0.1, 40]} />
        <meshStandardMaterial color={IXP_RAD} metalness={0.34} roughness={0.44} />
      </mesh>
      {/* Rim, which is what gives the disc a readable edge against black sky */}
      <mesh position={[0, IXP_CANOPY_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[IXP_CANOPY_R, 0.065, 6, 56]} />
        <meshStandardMaterial color={IXP_FRAME} metalness={0.45} roughness={0.5} />
      </mesh>

      {/* Radial ribs on the underside, one per two gores, and two hoops across
          them. The disc is 13 m of unsupported sheet otherwise. */}
      {Array.from({ length: 20 }, (_, i) => {
        const a = (i / 20) * Math.PI * 2
        return (
          <Strut
            key={i}
            from={[Math.cos(a) * 0.95, IXP_CANOPY_Y - 0.1, Math.sin(a) * 0.95]}
            to={[
              Math.cos(a) * (IXP_CANOPY_R - 0.1),
              IXP_CANOPY_Y - 0.1,
              Math.sin(a) * (IXP_CANOPY_R - 0.1),
            ]}
            r={0.05}
            color={IXP_FRAME}
          />
        )
      })}
      {[2.7, 4.7].map((r) => (
        <mesh
          key={r}
          position={[0, IXP_CANOPY_Y - 0.09, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[r, 0.04, 6, 44]} />
          <meshStandardMaterial
            color={IXP_FRAME}
            metalness={0.45}
            roughness={0.5}
          />
        </mesh>
      ))}

      {/* Beacon on the hub — the highest point on the unit */}
      <mesh position={[0, IXP_CANOPY_Y + 0.14, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.18, 8]} />
        <meshStandardMaterial color={IXP_BODY} metalness={0.4} roughness={0.44} />
      </mesh>
      <mesh position={[0, IXP_CANOPY_Y + 0.28, 0]}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// The IX bid — Intuitive Machines with X-energy, Maxar and Boeing — as the third
// of NASA's Fission Surface Power Phase 1 teams. A core emplaced at grade, its
// converters low and shielded, and ten heat pipes carrying the waste heat ten
// meters up to a canopy wider than the unit is tall.
function IxFsp({ accent }: { accent: string }) {
  return (
    <group scale={IXP_M}>
      <IxpBase accent={accent} />
      <IxpConverters />
      <IxpStack />
      <IxpCanopy accent={accent} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Lunar relay satellite — the only hardware on this map that is not on ground
// ---------------------------------------------------------------------------

// Tip to tip across the deployed wings, which is the satellite's largest
// dimension by a factor of six and therefore the one TYPE_SIZE_M measures.
export const RELAY_SPAN_M = TYPE_SIZE_M.orbital ?? 20
// Local units per METER, as in every surface installation: the satellite is
// authored in real meters and scaled by this, which exactly cancels the
// model-size normalization.
const SAT_M = UNIT_MAX_DIM / RELAY_SPAN_M
// World scale for a satellite, for the sky layer that stations them.
export const RELAY_SCALE = (RELAY_SPAN_M * M_TO_UNITS) / UNIT_MAX_DIM

const SAT_MLI = '#eef0f4' // blanketed bus — the brightest thing in the sky
const SAT_SHADE = '#a8aeb8' // undersides, and panels turned off the sun
const SAT_TRIM = '#565c66' // frames, gimbals, booms
const SAT_FOIL = '#c9a94f' // gold MLI over the feeds and the engine bay
const SAT_REFLECT = '#f4f6f9' // dish face, brighter again than the bus

// The bus, in meters. A relay bus is small — this is a 3 m box — and the wings
// are enormous next to it, which is most of why a satellite reads as a
// satellite rather than as a module that happens to be off the ground.
const SAT_BUS_W = 2.4 // across the wing axis (X)
const SAT_BUS_D = 2.2
const SAT_BUS_H = 3.0

// Wings. Four panels a side off a yoke, which with the bus makes the 20 m span.
const SAT_YOKE = 1.2
const SAT_PANEL_L = 1.9 // along the wing axis
const SAT_PANEL_H = 1.7
const SAT_PANELS = 4
const SAT_WING_ROOT = SAT_BUS_W / 2 + SAT_YOKE

// The high-gain dish points at EARTH, and from 89°S the Earth sits within a few
// degrees of the horizon — so the dish axis is very nearly HORIZONTAL, tilted
// up by a hair. This is the single most important fact about the model: a relay
// with its big dish aimed straight down at the base would be aiming it at the
// one customer that does not need it. The base is served by the nadir horn
// underneath, which is small because a few hundred km is a short link.
const SAT_DISH_D = 2.6 // aperture
const SAT_DISH_THETA = 0.96 // rim half-angle of the reflector cap, radians
const SAT_DISH_R = SAT_DISH_D / 2 / Math.sin(SAT_DISH_THETA) // sphere radius
const SAT_DISH_DEPTH = SAT_DISH_R * (1 - Math.cos(SAT_DISH_THETA))
const SAT_DISH_FOCUS = SAT_DISH_R / 2 // where the feed goes, ~R/2 for a cap
// Radians UP off horizontal, toward an Earth that librates a few degrees either
// side of the horizon from 89°S. Applied negated: a positive rotation about the
// local X carries +Z toward -Y, so using it as written aims the dish 8° into the
// regolith — at the one customer the high-gain link is not for.
//
// Exported: EarthGlobe.tsx reuses this exact figure for the fixed backdrop
// Earth's own elevation (see capLocalDirection there), rather than picking an
// independent number — the dish and the planet it points at should agree on
// where "up" is.
export const SAT_DISH_EL = 0.14
// Yawed off the panels' axis so the reflector is never seen exactly face-on: a
// dish square to the eye is a disc, and a disc is not a dish.
const SAT_DISH_YAW = -0.7

// The omni whip, which is what carries telemetry when the dish is off target.
// Tall and thin, and the reason the silhouette reads as a spacecraft from a
// distance at which the wings have gone to a line.
const SAT_MAST_H = 4.5

// One rigid panel of a wing: cells, frame, and the hinge line to its neighbour.
function RelayPanel({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh>
        <boxGeometry args={[SAT_PANEL_L, SAT_PANEL_H, 0.05]} />
        <meshStandardMaterial color={PANEL} roughness={0.4} metalness={0.18} />
      </mesh>
      {/* Cell strings, standing proud of the face. Coplanar detail strobes as
          the camera moves, which is why every panel on this base is built the
          same way. */}
      {Array.from({ length: 3 }, (_, i) => (
        <mesh
          key={i}
          position={[SAT_PANEL_L * ((i + 1) / 4 - 0.5), 0, 0.04]}
        >
          <boxGeometry args={[0.04, SAT_PANEL_H - 0.1, 0.02]} />
          <meshStandardMaterial color={PANEL_EDGE} roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
      {/* Frame: top and bottom rails, and the hinge stub outboard */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, (s * SAT_PANEL_H) / 2, 0]}>
          <boxGeometry args={[SAT_PANEL_L, 0.07, 0.09]} />
          <meshStandardMaterial color={SAT_SHADE} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[SAT_PANEL_L / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, SAT_PANEL_H * 0.8, 8]} />
        <meshStandardMaterial color={SAT_TRIM} roughness={0.5} metalness={0.45} />
      </mesh>
    </group>
  )
}

// One wing: the drive that turns it, the yoke out to the hinge, and the panels.
function RelayWing({ side }: { side: 1 | -1 }) {
  return (
    <group scale={[side, 1, 1]}>
      {/* Solar array drive. The wings turn about the wing AXIS to keep the
          cells on a sun that circles the horizon — which is also why the panel
          faces stand vertical rather than lying flat. */}
      <mesh position={[SAT_BUS_W / 2 + 0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.32, 0.32, 0.3, 16]} />
        <meshStandardMaterial color={SAT_TRIM} roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh
        position={[SAT_BUS_W / 2 + SAT_YOKE / 2, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.11, 0.11, SAT_YOKE, 10]} />
        <meshStandardMaterial color={SAT_SHADE} roughness={0.55} metalness={0.4} />
      </mesh>
      {Array.from({ length: SAT_PANELS }, (_, i) => (
        <RelayPanel key={i} x={SAT_WING_ROOT + SAT_PANEL_L * (i + 0.5)} />
      ))}
    </group>
  )
}

// The Earth link: a two-axis gimbal, the reflector, and a feed on a tripod at
// the focus. The tripod is worth the four extra meshes — it is the detail that
// says "antenna" rather than "bowl", and it is unmistakable in every photograph
// of one of these.
function RelayDish({ accent }: { accent: string }) {
  const rimR = SAT_DISH_D / 2
  return (
    <group>
      {/* Gimbal: azimuth ring on the bus, elevation trunnion above it */}
      <mesh position={[0, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.34, 0.36, 14]} />
        <meshStandardMaterial color={SAT_TRIM} roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.42]}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color={SAT_SHADE} roughness={0.5} metalness={0.45} />
      </mesh>

      <group position={[0, 0, 0.42]} rotation={[-SAT_DISH_EL, 0, 0]}>
        {/* Reflector. Sunk so its VERTEX sits at the boom head — a cap placed
            by its sphere centre floats a whole radius off the mount. */}
        <mesh position={[0, 0, SAT_DISH_R]} rotation={[-Math.PI / 2, 0, 0]}>
          <sphereGeometry
            args={[SAT_DISH_R, 28, 16, 0, Math.PI * 2, 0, SAT_DISH_THETA]}
          />
          <meshStandardMaterial
            color={SAT_REFLECT}
            side={THREE.DoubleSide}
            roughness={0.32}
            metalness={0.3}
          />
        </mesh>
        {/* Rim hoop, at the aperture plane */}
        <mesh position={[0, 0, SAT_DISH_DEPTH]}>
          <torusGeometry args={[rimR, 0.045, 8, 40]} />
          <meshStandardMaterial color={SAT_SHADE} roughness={0.45} metalness={0.5} />
        </mesh>
        {/* Feed at the focus, on its tripod */}
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((a) => (
          <Strut
            key={a}
            from={[
              Math.cos(a) * rimR * 0.86,
              Math.sin(a) * rimR * 0.86,
              SAT_DISH_DEPTH * 0.72,
            ]}
            to={[0, 0, SAT_DISH_FOCUS]}
            r={0.03}
            color={SAT_TRIM}
          />
        ))}
        <mesh position={[0, 0, SAT_DISH_FOCUS + 0.06]}>
          <cylinderGeometry args={[0.13, 0.17, 0.3, 12]} />
          <meshStandardMaterial color={SAT_FOIL} roughness={0.4} metalness={0.6} />
        </mesh>
        {/* Boresight marker in the operator's colour, so the aim point reads */}
        <mesh position={[0, 0, SAT_DISH_FOCUS + 0.24]}>
          <sphereGeometry args={[0.075, 10, 10]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  )
}

// A commercial relay in lunar orbit: Intuitive Machines' answer to the Near
// Space Network contract, and the one competitor on this map whose hardware
// never touches regolith.
//
// Authored about the BUS CENTRE rather than seated on a ground plane like every
// other model here — there is no ground to seat it on, and the sky layer wants
// to station the satellite's middle at an altitude, not its underside.
export function RelaySat({ accent }: { accent: string }) {
  const halfH = SAT_BUS_H / 2
  return (
    <group scale={SAT_M}>
      {/* Bus */}
      <mesh>
        <boxGeometry args={[SAT_BUS_W, SAT_BUS_H, SAT_BUS_D]} />
        <meshStandardMaterial color={SAT_MLI} roughness={0.62} metalness={0.24} />
      </mesh>
      {/* Blanket seams. A bus this bright is a white box without them. */}
      {[-0.85, 0, 0.85].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[SAT_BUS_W + 0.04, 0.07, SAT_BUS_D + 0.04]} />
          <meshStandardMaterial color={SAT_SHADE} roughness={0.7} metalness={0.2} />
        </mesh>
      ))}
      {/* Corner posts */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}:${sz}`}
            position={[(sx * SAT_BUS_W) / 2, 0, (sz * SAT_BUS_D) / 2]}
          >
            <boxGeometry args={[0.1, SAT_BUS_H, 0.1]} />
            <meshStandardMaterial color={SAT_TRIM} roughness={0.55} metalness={0.45} />
          </mesh>
        ))
      )}
      {/* Avionics and transponder boxes down the shaded flank */}
      {[-0.8, 0.25, 1.1].map((y, i) => (
        <mesh key={y} position={[0, y, -SAT_BUS_D / 2 - 0.13]}>
          <boxGeometry args={[1.5 - i * 0.25, 0.5, 0.26]} />
          <meshStandardMaterial color={SAT_TRIM} roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      {/* Gold MLI over the propulsion bay at the base */}
      <mesh position={[0, -halfH + 0.28, 0]}>
        <boxGeometry args={[SAT_BUS_W + 0.06, 0.56, SAT_BUS_D + 0.06]} />
        <meshStandardMaterial
          color={SAT_FOIL}
          roughness={0.42}
          metalness={0.62}
          emissive={SAT_FOIL}
          emissiveIntensity={0.12}
        />
      </mesh>

      <RelayWing side={1} />
      <RelayWing side={-1} />

      {/* Earth link, off the sunward face at mid-height (see SAT_DISH_EL) */}
      <group
        position={[0.1, 0.35, SAT_BUS_D / 2]}
        rotation={[0, SAT_DISH_YAW, 0]}
      >
        <RelayDish accent={accent} />
      </group>

      {/* Crosslink dish — small, and aimed along the constellation at the next
          satellite rather than at anything on the ground. */}
      <group position={[-0.7, halfH + 0.1, -0.4]} rotation={[-0.5, 1.2, 0]}>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 0.36, 10]} />
          <meshStandardMaterial color={SAT_TRIM} roughness={0.5} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2.6, 0, 0]}>
          <sphereGeometry args={[0.42, 18, 10, 0, Math.PI * 2, 0, 0.95]} />
          <meshStandardMaterial
            color={SAT_REFLECT}
            side={THREE.DoubleSide}
            roughness={0.35}
            metalness={0.3}
          />
        </mesh>
      </group>

      {/* Omni whip (see SAT_MAST_H) */}
      <mesh position={[0.75, halfH + 0.1, 0.45]}>
        <cylinderGeometry args={[0.1, 0.13, 0.2, 10]} />
        <meshStandardMaterial color={SAT_TRIM} roughness={0.55} metalness={0.45} />
      </mesh>
      <mesh position={[0.75, halfH + 0.2 + SAT_MAST_H / 2, 0.45]}>
        <cylinderGeometry args={[0.022, 0.04, SAT_MAST_H, 8]} />
        <meshStandardMaterial color={SAT_SHADE} roughness={0.45} metalness={0.55} />
      </mesh>

      {/* Star trackers and sun sensors on the top deck */}
      {[
        [-0.75, 0.55],
        [0.15, -0.55],
      ].map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, halfH + 0.16, z]} rotation={[0.3, 0.5, 0]}>
          <cylinderGeometry args={[0.14, 0.16, 0.32, 10]} />
          <meshStandardMaterial color={DARK} roughness={0.5} metalness={0.5} />
        </mesh>
      ))}

      {/* Nadir horn: the surface link, and the reason the base has a network at
          all. Small — the dish above it is fighting 380,000 km, this one a few
          hundred. */}
      <mesh position={[-0.35, -halfH - 0.34, 0.1]}>
        <cylinderGeometry args={[0.34, 0.16, 0.68, 14]} />
        <meshStandardMaterial color={SAT_FOIL} roughness={0.4} metalness={0.62} />
      </mesh>

      {/* Apogee engine, and the attitude thrusters at the corners */}
      <mesh position={[0.45, -halfH - 0.42, -0.15]}>
        <cylinderGeometry args={[0.26, 0.1, 0.72, 14]} />
        <meshStandardMaterial color={METAL} roughness={0.42} metalness={0.7} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`t${sx}:${sz}`}
            position={[
              (sx * SAT_BUS_W) / 2,
              -halfH + 0.1,
              (sz * SAT_BUS_D) / 2,
            ]}
            rotation={[sz * 0.5, 0, -sx * 0.5]}
          >
            <cylinderGeometry args={[0.09, 0.04, 0.22, 8]} />
            <meshStandardMaterial color={METAL} roughness={0.45} metalness={0.65} />
          </mesh>
        ))
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// ESA Lunar Pathfinder — the second orbiter on this map, and a very different
// answer to the same job. IM builds a TDRS-class relay for an operational
// network; SSTL build Pathfinder to a 300 kg smallsat budget as a single
// precursor mission, and that budget shows in almost every dimension: one
// bus-mounted fixed array plus two smaller deployables instead of four-panel
// wings, horn feeds instead of a steerable Earth dish, and a reflector that
// points at the MOON rather than at Earth. Proportions below are matched to
// SSTL's own renders (ESA — Moonlight); the 2.5 x 1.5 x 1.5 m bus SSTL quote
// in their papers describes the stowed launch envelope, and reads far more
// cubic than that once the fixed array is standing in front of it, which is
// what every published render actually shows and what is modelled here.
// ---------------------------------------------------------------------------

// Wingtip to wingtip — the largest dimension, same convention as
// RELAY_SPAN_M. SSTL do not publish a deployed span, so this is measured off
// the geometry below rather than chosen first (verified with a scratch
// script; see the recipe in docs/MOONBASE_MODEL_HANDOFF.md).
export const PATHFINDER_SPAN_M = 5.59
const PATH_M = UNIT_MAX_DIM / PATHFINDER_SPAN_M
export const PATHFINDER_SCALE = (PATHFINDER_SPAN_M * M_TO_UNITS) / UNIT_MAX_DIM

// The S-band reflector and UHF boom read near-black/carbon in every published
// render — a deliberate contrast with the relay's bright white MLI bus above.
const PATH_DARK = '#17181c'
// The small horn feeds are the one bright thing on this bus.
const PATH_FEED = '#e7e9ee'

const PSAT_BUS_W = 1.5 // across the wing axis (X)
const PSAT_BUS_D = 1.5
const PSAT_BUS_H = 1.7

// SSTL's "one fixed, two deployable" arrays: a fixed panel standing proud of
// the bus's forward face (see "nothing is coplanar"), plus two smaller
// deployables hinged off ITS edges rather than off the bus — every render
// shows the wings rooted to the fixed array's corners, not the bus body.
const PSAT_FIXED_W = 2.0
const PSAT_FIXED_H = 2.0

// The two deployable wings are staggered, not mirrored: one hinges high and
// swings up-and-out, the other hinges low and swings down-and-out, a pinwheel
// rather than the relay's straight left-right pair above. PSAT_STAGGER is
// that vertical hinge offset — the whole reason this satellite reads as a
// different design from across the sky and not just a smaller copy.
const PSAT_WING_W = 1.5
const PSAT_WING_H = 1.5
const PSAT_YOKE = 0.25
const PSAT_STAGGER = 0.5

// The Moon link is the one that matters here: S-band service to landers and
// orbiters a few hundred km away, not Earth at 380,000 km. So unlike the
// relay above — whose big reflector serves Earth and whose small horn covers
// the Moon — Pathfinder's reflector points at the MOON and is small, because
// the link it closes is short. SSTL publish the antenna hardware, not an
// aperture, so this is an honest estimate sized for that short link.
const PSAT_DISH_D = 0.6
const PSAT_DISH_THETA = 0.9
const PSAT_DISH_R = PSAT_DISH_D / 2 / Math.sin(PSAT_DISH_THETA)
const PSAT_DISH_DEPTH = PSAT_DISH_R * (1 - Math.cos(PSAT_DISH_THETA))
const PSAT_DISH_FOCUS = PSAT_DISH_R / 2

// A member for a member: mounts a tapered cylinder between two points, radius
// r0 at `from` and r1 at `to`. Strut assumes both ends are the same radius,
// which is wrong for a horn (throat to flared mouth) or the UHF boom (thick
// root to thin tip), so this is Strut's geometry with an independent radius
// at each end.
function TaperedMast({
  from,
  to,
  r0,
  r1,
  color,
}: {
  from: [number, number, number]
  to: [number, number, number]
  r0: number
  r1: number
  color: string
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const axis = b.clone().sub(a)
    const length = axis.length() || 1e-6
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        MODEL_UP,
        axis.divideScalar(length)
      ),
      length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from[0], from[1], from[2], to[0], to[1], to[2]])
  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[r1, r0, length, 10]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.45} />
    </mesh>
  )
}

// The bus. Mostly hidden behind its own fixed array in every published
// render, so it gets far less surface detail than the relay's bus above —
// a couple of avionics boxes on the one flank the array doesn't cover is all
// that actually reads.
function PathfinderBus() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[PSAT_BUS_W, PSAT_BUS_H, PSAT_BUS_D]} />
        <meshStandardMaterial color={SAT_MLI} roughness={0.6} metalness={0.24} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sy) => (
          <mesh
            key={`${sx}:${sy}`}
            position={[(sx * PSAT_BUS_W) / 2, (sy * PSAT_BUS_H) / 2, 0]}
          >
            <boxGeometry args={[0.08, 0.08, PSAT_BUS_D + 0.02]} />
            <meshStandardMaterial color={SAT_TRIM} roughness={0.55} metalness={0.45} />
          </mesh>
        ))
      )}
      {/* Avionics on the flank the fixed array leaves bare */}
      <mesh position={[0, -0.15, -PSAT_BUS_D / 2 - 0.09]}>
        <boxGeometry args={[0.7, 0.9, 0.16]} />
        <meshStandardMaterial color={SAT_TRIM} roughness={0.6} metalness={0.4} />
      </mesh>
    </group>
  )
}

// The fixed array. Standing proud of the bus face by a few centimetres, not
// flush — coplanar detail strobes as the camera moves, the same rule as every
// panel on this map.
function PathfinderFixedArray() {
  return (
    <group position={[0, 0, PSAT_BUS_D / 2 + 0.05]}>
      <mesh>
        <boxGeometry args={[PSAT_FIXED_W, PSAT_FIXED_H, 0.06]} />
        <meshStandardMaterial color={PANEL} roughness={0.4} metalness={0.18} />
      </mesh>
      {/* Gold cell-string trim, standing proud again of the panel face */}
      {[-0.6, -0.2, 0.2, 0.6].map((f) => (
        <mesh key={f} position={[f * (PSAT_FIXED_W / 2), 0, 0.04]}>
          <boxGeometry args={[0.035, PSAT_FIXED_H - 0.1, 0.015]} />
          <meshStandardMaterial color={SAT_FOIL} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * PSAT_FIXED_W) / 2, 0, 0.035]}>
          <boxGeometry args={[0.06, PSAT_FIXED_H, 0.09]} />
          <meshStandardMaterial color={SAT_TRIM} roughness={0.5} metalness={0.45} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, (s * PSAT_FIXED_H) / 2, 0.035]}>
          <boxGeometry args={[PSAT_FIXED_W, 0.06, 0.09]} />
          <meshStandardMaterial color={SAT_TRIM} roughness={0.5} metalness={0.45} />
        </mesh>
      ))}
    </group>
  )
}

// One deployable wing, hinged off the fixed array's edge and staggered
// vertically off the bus centreline (see PSAT_STAGGER). Mirrored about X the
// same way RelayWing is, so every position below is authored for side = 1.
function PathfinderWing({ side }: { side: 1 | -1 }) {
  return (
    <group position={[0, side * PSAT_STAGGER, 0]} scale={[side, 1, 1]}>
      <mesh
        position={[PSAT_FIXED_W / 2 + PSAT_YOKE / 2, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.05, 0.05, PSAT_WING_H * 0.6, 8]} />
        <meshStandardMaterial color={SAT_TRIM} roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[PSAT_FIXED_W / 2 + PSAT_YOKE + PSAT_WING_W / 2, 0, 0.03]}>
        <boxGeometry args={[PSAT_WING_W, PSAT_WING_H, 0.05]} />
        <meshStandardMaterial color={PANEL} roughness={0.4} metalness={0.18} />
      </mesh>
      {[0.25, 0.5, 0.75].map((f) => (
        <mesh
          key={f}
          position={[
            PSAT_FIXED_W / 2 + PSAT_YOKE + PSAT_WING_W * f,
            0,
            0.065,
          ]}
        >
          <boxGeometry args={[0.035, PSAT_WING_H - 0.12, 0.015]} />
          <meshStandardMaterial color={SAT_FOIL} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[
            PSAT_FIXED_W / 2 + PSAT_YOKE + PSAT_WING_W / 2,
            (s * PSAT_WING_H) / 2,
            0.03,
          ]}
        >
          <boxGeometry args={[PSAT_WING_W, 0.06, 0.08]} />
          <meshStandardMaterial color={SAT_TRIM} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

// The Moon-link antenna assembly: a gimballed reflector fed by a back-fire
// helix, aimed at NADIR rather than at the relay's Earth-ish elevation.
// Authored pointing local +Z, like RelayDish, then rolled onto -Y (nadir) by
// the +X rotation on the mounting group below — the exact fact the house
// rules warn about ("about +X, a positive rotation carries +Z toward −Y"),
// used deliberately here instead of caught as a bug.
function PathfinderMoonDish({ accent }: { accent: string }) {
  return (
    <group
      position={[0.15, -PSAT_BUS_H / 2 - 0.14, -0.15]}
      rotation={[Math.PI / 2, 0, 0]}
    >
      <mesh position={[0, 0, -0.12]}>
        <cylinderGeometry args={[0.16, 0.19, 0.22, 12]} />
        <meshStandardMaterial color={SAT_TRIM} roughness={0.5} metalness={0.5} />
      </mesh>
      {/* Reflector, sunk so its vertex sits at the gimbal — a cap placed by
          its sphere centre floats a whole radius off the mount. */}
      <mesh position={[0, 0, PSAT_DISH_R]} rotation={[-Math.PI / 2, 0, 0]}>
        <sphereGeometry
          args={[PSAT_DISH_R, 24, 14, 0, Math.PI * 2, 0, PSAT_DISH_THETA]}
        />
        <meshStandardMaterial
          color={PATH_DARK}
          side={THREE.DoubleSide}
          roughness={0.3}
          metalness={0.35}
        />
      </mesh>
      <mesh position={[0, 0, PSAT_DISH_DEPTH]}>
        <torusGeometry args={[PSAT_DISH_D / 2, 0.03, 8, 32]} />
        <meshStandardMaterial color={SAT_TRIM} roughness={0.45} metalness={0.5} />
      </mesh>
      {/* Back-fire helix feed at the focus */}
      <mesh position={[0, 0, PSAT_DISH_FOCUS + 0.05]}>
        <cylinderGeometry args={[0.05, 0.07, 0.14, 10]} />
        <meshStandardMaterial color={PATH_DARK} roughness={0.4} metalness={0.5} />
      </mesh>
      {/* Boresight marker in the operator's colour */}
      <mesh position={[0, 0, PSAT_DISH_FOCUS + 0.14]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.4}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// ESA's Lunar Pathfinder — precursor to the Moonlight constellation, and
// authored about the bus centre like the relay above, for the same reason:
// there is no ground to seat it on.
export function Pathfinder({ accent }: { accent: string }) {
  return (
    <group scale={PATH_M}>
      <PathfinderBus />
      <PathfinderFixedArray />
      <PathfinderWing side={1} />
      <PathfinderWing side={-1} />
      <PathfinderMoonDish accent={accent} />

      {/* UHF boom (UANT): fixed, not steerable — a wide beam needs mounting
          with a clear view of the Moon, not pointing. Tapered rather than
          wound: at this scale a helix's turns are a texture, not a geometry,
          and the taper is the detail every render actually shows. */}
      <TaperedMast
        from={[-0.3, -PSAT_BUS_H / 2, 0.15]}
        to={[-0.5, -PSAT_BUS_H / 2 - 0.6, -0.2]}
        r0={0.09}
        r1={0.025}
        color={PATH_DARK}
      />

      {/* Two X-band horns (HGAs) on opposite bus corners — SSTL fly a pair so
          Earth access survives whatever attitude the spacecraft is in for its
          Moon-link work, which is also why neither needs to be solved for a
          precise bearing the way the relay's single Earth dish does. */}
      <TaperedMast
        from={[PSAT_BUS_W / 2 - 0.1, PSAT_BUS_H / 2 - 0.1, PSAT_BUS_D / 2 - 0.05]}
        to={[PSAT_BUS_W / 2 + 0.14, PSAT_BUS_H / 2 + 0.2, PSAT_BUS_D / 2 + 0.2]}
        r0={0.03}
        r1={0.15}
        color={PATH_FEED}
      />
      <TaperedMast
        from={[-PSAT_BUS_W / 2 + 0.1, -PSAT_BUS_H / 2 + 0.1, -PSAT_BUS_D / 2 + 0.05]}
        to={[-PSAT_BUS_W / 2 - 0.12, -PSAT_BUS_H / 2 - 0.16, -PSAT_BUS_D / 2 - 0.2]}
        r0={0.03}
        r1={0.15}
        color={PATH_FEED}
      />

      {/* NASA's laser retroreflector — passive, so no cabling, just a small
          mirrored panel on the Moon-facing side alongside the S-band link it
          rides with. */}
      <mesh position={[0.45, -PSAT_BUS_H / 2 - 0.03, -PSAT_BUS_D / 2 - 0.02]}>
        <cylinderGeometry args={[0.09, 0.09, 0.02, 12]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.2} metalness={0.7} />
      </mesh>

      {/* GNSS weak-signal receiver and radiation monitor, the two hosted
          payloads that ride to orbit on the relay's own housekeeping. */}
      <mesh position={[-0.4, PSAT_BUS_H / 2 + 0.08, -0.25]}>
        <boxGeometry args={[0.22, 0.14, 0.2]} />
        <meshStandardMaterial color={SAT_TRIM} roughness={0.55} metalness={0.4} />
      </mesh>

      {/* A monoprop thruster, not the relay's apogee engine — Blue Ghost
          delivers Pathfinder to its target orbit, so onboard propulsion only
          has to cover stationkeeping over an 8-year service life. */}
      <mesh
        position={[0.35, -PSAT_BUS_H / 2 - 0.1, 0.35]}
        rotation={[0.35, 0, -0.25]}
      >
        <cylinderGeometry args={[0.045, 0.02, 0.14, 8]} />
        <meshStandardMaterial color={METAL} roughness={0.45} metalness={0.65} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Crescent Space's Parsec — the third orbiter on this map, and the smallest.
// Lockheed builds Parsec on Curio, the deep-space smallsat bus that already
// flew NASA's Lunar Trailblazer and Janus: stock hardware, not a purpose-built
// relay, which is the entire pitch — Crescent sells lunar comms and PNT "the
// way you buy launch," off a commodity platform, and starts the network with
// TWO satellites (Lockheed's own figure) rather than one precursor or an
// operational three-bird fleet. Proportions below track Lockheed's published
// Curio "Medium" reference (a 24 x 28 x 24 in ESPA keep-in envelope) and its
// own renders of the comms/nav configuration.
// ---------------------------------------------------------------------------

// Wingtip to wingtip — measured off the geometry below, same convention as
// every other satellite here.
export const PARSEC_SPAN_M = 2.99
const PSEC_M = UNIT_MAX_DIM / PARSEC_SPAN_M
export const PARSEC_SCALE = (PARSEC_SPAN_M * M_TO_UNITS) / UNIT_MAX_DIM

// Curio's gold MLI bus, brighter and warmer than either satellite above — the
// one color cue that says "commodity smallsat" before a single antenna reads.
const PSEC_GOLD = '#c9a13e'
const PSEC_GOLD_SEAM = '#8a6a26'

// Curio Medium's ESPA keep-in envelope (Lockheed's own figure): 24 x 28 x 24
// inch, i.e. roughly 0.61 x 0.71 x 0.61 m. Far smaller than either satellite
// above — the whole Parsec strategy is many cheap nodes, not one big bus.
const PSEC_BUS_W = 0.61
const PSEC_BUS_D = 0.61
const PSEC_BUS_H = 0.71

// Curio's solar array is modular — "2, 4, or 6 panels per wing" per Lockheed's
// own user guide — and every published render shows an uneven pair, three
// panels one side and two the other, rather than a matched set. Modelled off
// that render rather than the round modular numbers, since it's what the
// dataset's own source material actually shows.
const PSEC_PANEL_L = 0.42
const PSEC_PANEL_H = 0.5
const PSEC_YOKE = 0.14

// Two dishes of nearly equal size, not one big and one small — because
// Parsec sells communications and navigation as EQUAL products, unlike the
// relay above (all Earth) or Pathfinder (all Moon). One closes the Earth
// link home; the other ranges to Crescent's other nodes, which is how a
// multi-satellite network derives position and timing without a ground dish
// pinning every fix.
const PSEC_DISH_D = 0.46
const PSEC_DISH_THETA = 0.88
const PSEC_DISH_R = PSEC_DISH_D / 2 / Math.sin(PSEC_DISH_THETA)
const PSEC_DISH_DEPTH = PSEC_DISH_R * (1 - Math.cos(PSEC_DISH_THETA))
const PSEC_DISH_FOCUS = PSEC_DISH_R / 2

// One dish, authored pointing local +Z at its own gimbal. Reused twice below
// with different mounts rather than parameterized by role — the geometry is
// identical, only the aim differs.
function ParsecDish({ accent }: { accent: string }) {
  return (
    <group>
      <mesh position={[0, 0, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.055, 0.14, 12]} />
        <meshStandardMaterial color={SAT_TRIM} roughness={0.5} metalness={0.5} />
      </mesh>
      {/* Reflector, sunk so its vertex sits at the gimbal */}
      <mesh position={[0, 0, PSEC_DISH_R]} rotation={[-Math.PI / 2, 0, 0]}>
        <sphereGeometry
          args={[PSEC_DISH_R, 22, 12, 0, Math.PI * 2, 0, PSEC_DISH_THETA]}
        />
        <meshStandardMaterial
          color={SAT_REFLECT}
          side={THREE.DoubleSide}
          roughness={0.3}
          metalness={0.3}
        />
      </mesh>
      <mesh position={[0, 0, PSEC_DISH_DEPTH]}>
        <torusGeometry args={[PSEC_DISH_D / 2, 0.022, 8, 28]} />
        <meshStandardMaterial color={SAT_TRIM} roughness={0.45} metalness={0.5} />
      </mesh>
      {/* Feed on its tripod, at the focus */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        return (
          <Strut
            key={i}
            from={[
              Math.cos(a) * PSEC_DISH_D * 0.42,
              Math.sin(a) * PSEC_DISH_D * 0.42,
              PSEC_DISH_DEPTH * 0.7,
            ]}
            to={[0, 0, PSEC_DISH_FOCUS]}
            r={0.016}
            color={SAT_TRIM}
          />
        )
      })}
      <mesh position={[0, 0, PSEC_DISH_FOCUS + 0.045]}>
        <cylinderGeometry args={[0.04, 0.055, 0.09, 10]} />
        <meshStandardMaterial color={SAT_FOIL} roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Boresight marker in the operator's colour */}
      <mesh position={[0, 0, PSEC_DISH_FOCUS + 0.11]}>
        <sphereGeometry args={[0.028, 8, 8]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.4}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// One wing: a yoke off the bus and `count` panels along it. Curio's modular
// array in miniature — see PSEC_PANEL_L above for why the two wings differ.
function ParsecWing({ side, count }: { side: 1 | -1; count: number }) {
  const root = PSEC_BUS_W / 2 + PSEC_YOKE
  return (
    <group scale={[side, 1, 1]}>
      <mesh position={[PSEC_BUS_W / 2 + PSEC_YOKE / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, PSEC_PANEL_H * 0.6, 8]} />
        <meshStandardMaterial color={SAT_TRIM} roughness={0.5} metalness={0.5} />
      </mesh>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} position={[root + PSEC_PANEL_L * (i + 0.5), 0, 0]}>
          <mesh position={[0, 0, 0.025]}>
            <boxGeometry args={[PSEC_PANEL_L, PSEC_PANEL_H, 0.035]} />
            <meshStandardMaterial color={PANEL} roughness={0.4} metalness={0.18} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[0.03, PSEC_PANEL_H - 0.08, 0.012]} />
            <meshStandardMaterial color={SAT_FOIL} roughness={0.5} metalness={0.4} />
          </mesh>
          {i > 0 && (
            <mesh position={[-PSEC_PANEL_L / 2, 0, 0.02]}>
              <cylinderGeometry args={[0.018, 0.018, PSEC_PANEL_H * 0.7, 8]} />
              <meshStandardMaterial color={SAT_TRIM} roughness={0.5} metalness={0.5} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

// The bus, and the PNT broadcast panel that is Parsec's one truly distinct
// piece of hardware: a flat phased array rather than a dish, because a
// navigation signal has to illuminate a wide patch of sky and ground at once
// — the opposite requirement from a pointed comms link.
function ParsecBus({ accent }: { accent: string }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[PSEC_BUS_W, PSEC_BUS_H, PSEC_BUS_D]} />
        <meshStandardMaterial color={PSEC_GOLD} roughness={0.55} metalness={0.3} />
      </mesh>
      {/* Foil creases — a gold blanket this saturated is a block of colour
          without them */}
      {[-0.18, 0.18].map((y) => (
        <mesh key={y} position={[0, y, PSEC_BUS_D / 2 + 0.002]}>
          <boxGeometry args={[PSEC_BUS_W - 0.05, 0.02, 0.004]} />
          <meshStandardMaterial color={PSEC_GOLD_SEAM} roughness={0.6} metalness={0.25} />
        </mesh>
      ))}
      {/* PNT phased array: a grid of small radiating elements standing proud
          of a flat backing panel, on the face the two dishes leave clear. */}
      <group position={[0, 0.05, -PSEC_BUS_D / 2 - 0.02]}>
        <mesh>
          <boxGeometry args={[PSEC_BUS_W - 0.08, PSEC_BUS_H - 0.14, 0.02]} />
          <meshStandardMaterial color={HULL_DARK} roughness={0.5} metalness={0.35} />
        </mesh>
        {[-1, 0, 1].map((cx) =>
          [-1, 0, 1].map((cy) => (
            <mesh
              key={`${cx}:${cy}`}
              position={[cx * 0.15, 0.05 + cy * 0.14, -0.025]}
            >
              <boxGeometry args={[0.09, 0.09, 0.025]} />
              <meshStandardMaterial color={PATH_FEED} roughness={0.4} metalness={0.3} />
            </mesh>
          ))
        )}
      </group>
      {/* Star-tracker cluster on the top deck */}
      <mesh position={[0.15, PSEC_BUS_H / 2 + 0.06, -0.1]} rotation={[0.25, 0.4, 0]}>
        <boxGeometry args={[0.16, 0.12, 0.16]} />
        <meshStandardMaterial color={SAT_TRIM} roughness={0.55} metalness={0.45} />
      </mesh>
      {/* Omni patch, the fallback link while the dishes are still slewing */}
      <mesh position={[-0.2, PSEC_BUS_H / 2 + 0.02, 0.15]}>
        <cylinderGeometry args={[0.045, 0.045, 0.03, 10]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.1}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// Crescent's Parsec node — authored about the bus centre like every other
// satellite here, for the same reason: there is no ground under it to seat on.
export function Parsec({ accent }: { accent: string }) {
  return (
    <group scale={PSEC_M}>
      <ParsecBus accent={accent} />
      <ParsecWing side={1} count={3} />
      <ParsecWing side={-1} count={2} />

      {/* Earth link — the same physics every south-pole-facing dish on this
          map shares (see SAT_DISH_EL above): Earth sits within a few degrees
          of the horizon, so the boresight is tipped up off horizontal, not
          aimed at zenith. Mounted off the +Z corner and yawed clear of the
          panels' axis so the reflector is never seen face-on. */}
      <group
        position={[PSEC_BUS_W / 2 + 0.02, 0.12, PSEC_BUS_D / 2 + 0.02]}
        rotation={[-SAT_DISH_EL, 0.55, 0]}
      >
        <ParsecDish accent={accent} />
      </group>

      {/* Cross-link / ranging — aimed generally along the constellation
          rather than at one solved bearing, the same reasoning as the
          relay's crosslink dish above: with more than one node in view,
          which specific node is behind the eye at any moment isn't fixed,
          only that one usually is. */}
      <group
        position={[-PSEC_BUS_W / 2 - 0.02, -0.1, PSEC_BUS_D / 2 + 0.02]}
        rotation={[0.3, -2.1, 0]}
      >
        <ParsecDish accent={accent} />
      </group>
    </group>
  )
}

// Which model, scale and span a flying project uses — keyed by project id,
// exactly like PROJECT_MODEL for ground installations. SkyLayer looks these up
// per station instead of assuming every satellite is the relay above.
export const SKY_SAT_MODEL: Record<string, ComponentType<{ accent: string }>> = {
  'im-near-space-network': RelaySat,
  'esa-lunar-pathfinder': Pathfinder,
  'crescent-parsec': Parsec,
}
export const SKY_SAT_SCALE: Record<string, number> = {
  'im-near-space-network': RELAY_SCALE,
  'esa-lunar-pathfinder': PATHFINDER_SCALE,
  'crescent-parsec': PARSEC_SCALE,
}
export const SKY_SAT_SPAN_M: Record<string, number> = {
  'im-near-space-network': RELAY_SPAN_M,
  'esa-lunar-pathfinder': PATHFINDER_SPAN_M,
  'crescent-parsec': PARSEC_SPAN_M,
}

// ---------------------------------------------------------------------------
// Landing-pad construction site
// ---------------------------------------------------------------------------

// Local units per METER inside the construction site. The site is authored in
// real meters and scaled by this, which exactly cancels the model-size
// normalization — so a 2.6 m hopper really is 2.6 m beside the astronaut, and
// every part stays in proportion to every other.
const SITE_M = UNIT_MAX_DIM / (TYPE_SIZE_M.construction ?? 14)

// Sintered regolith is dark and glassy, so a printed deck reads nearly black
// against the pale dust around it. That contrast is what makes the paved area
// legible as finished work instead of a bright patch of ground — and it is why
// the old site, a pale disc barely lighter than the terrain, looked less like
// pavement than like a shallow depression scooped out of the Moon.
const PAVER = '#4b4842'
const PAVER_FRESH = '#332f2a' // the course still cooling under the print head

// Stable per-tile jitter. Math.random() here would reshuffle the deck on every
// render.
function tileNoise(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// The printed deck: interlocking pavers laid course by course from the far
// edge toward the printer, the near course left part-finished. A pad mid-print
// says "construction site" far more directly than any amount of signage.
const DECK_COLS = 5
const DECK_ROWS = 5
const DECK_PITCH = 1.5
const DECK_TILE = 1.34
const DECK_LAID = 22 // of 25 — four full courses plus two tiles of the fifth
const DECK_Y = 0.12 // apron deck height

function PrintedDeck() {
  const tiles = useMemo(() => {
    const out: {
      key: number
      x: number
      z: number
      h: number
      yaw: number
      fresh: boolean
    }[] = []
    const x0 = -((DECK_COLS - 1) * DECK_PITCH) / 2
    const z0 = -((DECK_ROWS - 1) * DECK_PITCH) / 2
    for (let r = 0; r < DECK_ROWS; r++) {
      for (let c = 0; c < DECK_COLS; c++) {
        const i = r * DECK_COLS + c
        if (i >= DECK_LAID) continue
        // Courses alternate half a tile, like real interlocking pavers.
        const stagger = (r % 2) * DECK_PITCH * 0.5 - DECK_PITCH * 0.25
        out.push({
          key: i,
          x: x0 + c * DECK_PITCH + stagger,
          z: z0 + r * DECK_PITCH,
          // Hand-laid, not milled: slight height and yaw scatter catches the
          // low sun and keeps the deck from reading as one printed rectangle.
          h: 0.18 + tileNoise(i) * 0.06,
          yaw: (tileNoise(i + 91) - 0.5) * 0.07,
          fresh: i >= DECK_LAID - 2,
        })
      }
    }
    return out
  }, [])

  return (
    <group>
      {tiles.map((t) => (
        <mesh
          key={t.key}
          position={[t.x, DECK_Y + t.h / 2, t.z]}
          rotation={[0, t.yaw, 0]}
        >
          <boxGeometry args={[DECK_TILE, t.h, DECK_TILE]} />
          <meshStandardMaterial
            color={t.fresh ? PAVER_FRESH : PAVER}
            roughness={0.82}
          />
        </mesh>
      ))}
    </group>
  )
}

// How far the boom slews either side of centre while it works. ±25° carries
// the nozzle 2.8 m across X, which is the gap left in the near course, on an
// arc that bulges 0.48 m in Z — well inside the 1.34 m width of a paver, so
// the head stays over the course it is laying. Being a yaw about the mast's own
// vertical axis, it leaves every height in the boom untouched: the nozzle holds
// its standoff over the deck at the ends of the pass exactly as at the middle.
const SLEW_RAD = 0.436
// Seconds for one pass out and back, which puts the nozzle at about 0.26 m/s.
// That is a believable traverse rate for a machine extruding a bead of sintered
// regolith, and slow enough to read as deliberate work — a printer whipping
// back and forth reads as a mechanism being played at the wrong speed, which
// makes the whole site look like a toy.
const SLEW_PERIOD_S = 22
// Gantry geometry, at module scope because the boom is its own component now
// and both halves of the machine have to agree on where they meet.
const MAST_TOP = 7.2
const MAST_Z = 6.4
// The boom hinges at the mast head. Everything that swings hangs off this
// point; nothing that holds the mast up does.
const SLEW_PIVOT_Z = MAST_Z - 0.2
// Mid-slew the head sits directly over the next paver in the unfinished course
// (DECK_LAID leaves the near course short by three tiles), so the machine is
// demonstrably working on the gap rather than hovering over finished deck.
const PRINT_HEAD: [number, number, number] = [-0.4, 3.3, 2.9]

// The swinging half of the printer: the boom, the head on the end of it, and
// the bead of fresh regolith under the nozzle. Split out from the machine's
// fixed structure so the whole assembly can be slewed by its parent group.
function PrintBoom({
  accent,
  nozzleRef,
}: {
  accent: string
  nozzleRef: RefObject<THREE.MeshStandardMaterial>
}) {
  const head = PRINT_HEAD
  return (
    <group>
      {/* Boom reaching out over the course being laid */}
      {[-0.7, 0.7].map((x) => (
        <Strut
          key={x}
          from={[x, MAST_TOP, SLEW_PIVOT_Z]}
          to={[head[0] + x * 0.5, head[1] + 0.2, head[2]]}
          r={0.09}
        />
      ))}
      {[0, 1, 2].map((i) => {
        const t0 = 0.2 + i * 0.26
        const t1 = t0 + 0.26
        const rail = (t: number, x: number): [number, number, number] => [
          x * (1 - t) + (head[0] + x * 0.5) * t,
          MAST_TOP * (1 - t) + (head[1] + 0.2) * t,
          SLEW_PIVOT_Z * (1 - t) + head[2] * t,
        ]
        return (
          <Strut
            key={i}
            from={rail(t0, i % 2 ? 0.7 : -0.7)}
            to={rail(t1, i % 2 ? -0.7 : 0.7)}
            r={0.045}
          />
        )
      })}

      {/* Print head on its vertical axis, nozzle just off the deck */}
      <mesh position={head}>
        <boxGeometry args={[1.1, 0.75, 1.0]} />
        <meshStandardMaterial color={HULL} roughness={0.5} metalness={0.3} />
      </mesh>
      <Strut
        from={[head[0], head[1] - 0.3, head[2]]}
        to={[head[0], 0.85, head[2]]}
        r={0.11}
        color={DARK}
      />
      <mesh position={[head[0], 0.68, head[2]]}>
        <cylinderGeometry args={[0.24, 0.11, 0.34, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Working light at the nozzle */}
      <mesh position={[head[0], 0.5, head[2]]}>
        <sphereGeometry args={[0.13, 10, 10]} />
        <meshStandardMaterial
          ref={nozzleRef}
          color={accent}
          emissive={accent}
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </mesh>
      {/* The bead it is laying right now */}
      <mesh position={[head[0], DECK_Y + 0.07, head[2]]}>
        <boxGeometry args={[1.5, 0.14, 0.6]} />
        <meshStandardMaterial color={PAVER_FRESH} roughness={0.7} />
      </mesh>
    </group>
  )
}

// The hero: a regolith-printing gantry straddling the unfinished edge, feeding
// from a hopper through a boom-mounted head. Deliberately generic construction
// plant — not a model of any company's proprietary machine.
function PrinterGantry({ accent }: { accent: string }) {
  const boomRef = useRef<THREE.Group>(null)
  const nozzleRef = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    const phase = (clock.getElapsedTime() / SLEW_PERIOD_S) * Math.PI * 2
    // A sine rather than a sawtooth: the boom has mass, so it has to slow into
    // each reversal and build out of it again. A linear traverse that snapped
    // back at the end of the pass would read as a looping animation.
    const slew = Math.sin(phase) * SLEW_RAD
    const boom = boomRef.current
    if (boom) {
      // Swing about the mast head rather than the site origin. A rotation R
      // about a pivot p is R applied at the origin plus an offset of p - Rp,
      // which for a yaw about p = (0, 0, z) comes out as below — cheaper than
      // nesting a second group just to move the hinge, and it lets the boom's
      // parts stay written in the site's own coordinates.
      boom.rotation.y = slew
      boom.position.set(
        -SLEW_PIVOT_Z * Math.sin(slew),
        0,
        SLEW_PIVOT_Z * (1 - Math.cos(slew))
      )
    }
    // The nozzle is fusing regolith, so its glow breathes with the feed
    // instead of sitting at one brightness like a running light.
    if (nozzleRef.current) {
      nozzleRef.current.emissiveIntensity = 2.2 + Math.sin(phase * 9) * 0.55
    }
  })

  const feet: [number, number][] = [
    [-2.7, 4.6],
    [2.7, 4.6],
    [-2.7, 7.8],
    [2.7, 7.8],
  ]
  return (
    <group>
      {feet.map(([x, z]) => (
        <group key={`${x}:${z}`}>
          {/* Broad pads: ground pressure matters on unconsolidated regolith. */}
          <mesh position={[x, 0.09, z]}>
            <cylinderGeometry args={[0.52, 0.6, 0.18, 12]} />
            <meshStandardMaterial color={HULL_DARK} roughness={0.7} />
          </mesh>
          {/* The rear legs stand off the graded apron, on ground the site
              hasn't touched yet. Each pad is jacked on a pile that runs well
              below grade, so relief out there can neither swallow the foot nor
              leave it hanging. */}
          <mesh position={[x, -0.75, z]}>
            <cylinderGeometry args={[0.3, 0.34, 1.8, 10]} />
            <meshStandardMaterial color={METAL} metalness={0.4} roughness={0.7} />
          </mesh>
          <Strut
            from={[x, 0.18, z]}
            to={[x * 0.52, 2.5, MAST_Z + (z - MAST_Z) * 0.35]}
            r={0.13}
          />
        </group>
      ))}

      {/* Chassis + feedstock hopper */}
      <mesh position={[0, 3.0, MAST_Z]}>
        <boxGeometry args={[3.4, 1.0, 2.6]} />
        <meshStandardMaterial color={HULL} roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 4.4, MAST_Z + 0.1]}>
        <cylinderGeometry args={[1.25, 0.8, 1.9, 12]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.75} />
      </mesh>

      {/* Lattice mast: two rails zig-zag braced. The mast leans, so the braces
          interpolate along it rather than standing at a fixed depth. */}
      {[-0.85, 0.85].map((x) => (
        <Strut
          key={x}
          from={[x, 3.4, MAST_Z - 0.6]}
          to={[x, MAST_TOP, SLEW_PIVOT_Z]}
          r={0.1}
        />
      ))}
      {[0, 1, 2, 3].map((i) => {
        const y0 = 3.6 + i * 0.9
        const y1 = y0 + 0.9
        const railZ = (y: number) =>
          MAST_Z - 0.6 + ((y - 3.4) / (MAST_TOP - 3.4)) * 0.4
        return (
          <Strut
            key={i}
            from={[i % 2 ? 0.85 : -0.85, y0, railZ(y0)]}
            to={[i % 2 ? -0.85 : 0.85, y1, railZ(y1)]}
            r={0.05}
          />
        )
      })}

      {/* Back-stay: the boom has to be held up by something. Anchored to the
          chassis, so it braces the mast and does not slew with the boom. */}
      <Strut
        from={[0, MAST_TOP - 0.1, SLEW_PIVOT_Z]}
        to={[0, 3.4, MAST_Z + 1.3]}
        r={0.06}
      />

      <group ref={boomRef}>
        <PrintBoom accent={accent} nozzleRef={nozzleRef} />
      </group>
    </group>
  )
}

// A landing pad being printed: a graded apron, a part-finished deck of
// sintered pavers, the printer at work on the near edge, staged feedstock,
// perimeter beacons, and a suited figure for scale.
function ConstructionSite({ accent }: { accent: string }) {
  return (
    <group scale={SITE_M}>
      {/* Graded apron. Like the landing pad, it flares down well below the
          seat point so the uphill side never cuts through it and the downhill
          side never hovers — the flat disc it replaces did both, which is what
          made the site look half-swallowed by the ground. */}
      <mesh position={[0, DECK_Y - 1.6, 0]}>
        <cylinderGeometry args={[5.6, 6.9, 3.2, 56]} />
        <meshStandardMaterial color={PAD_SURFACE} roughness={0.98} />
      </mesh>

      <PrintedDeck />
      <PrinterGantry accent={accent} />

      {/* Staged feedstock: stacked pallets of printed blanks */}
      {[
        [-3.7, 2.4, 0.3],
        [-4.0, 0.7, -0.4],
      ].map(([x, z, yaw]) => (
        <group key={`${x}:${z}`} position={[x, DECK_Y, z]} rotation={[0, yaw, 0]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0.11 + i * 0.24, 0]}>
              <boxGeometry args={[1.5, 0.22, 1.1]} />
              <meshStandardMaterial color={PAVER} roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Perimeter beacons, clear of the printer's approach */}
      {[-2.5, -1.7, 2.6].map((a) => {
        const x = Math.cos(a) * 5.2
        const z = Math.sin(a) * 5.2
        return (
          <group key={a} position={[x, 0, z]}>
            <mesh position={[0, 0.62, 0]}>
              <cylinderGeometry args={[0.06, 0.09, 1.24, 6]} />
              <meshStandardMaterial color={METAL} metalness={0.4} />
            </mesh>
            <mesh position={[0, 1.36, 0]}>
              <sphereGeometry args={[0.16, 10, 10]} />
              <meshStandardMaterial
                color={accent}
                emissive={accent}
                emissiveIntensity={1.8}
                toneMapped={false}
              />
            </mesh>
          </group>
        )
      })}

      {/* Suited figure, patrolling the near apron — the only unambiguous
          scale cue on an airless plain, and now one that reads as staff
          walking the print job rather than a mannequin parked for a photo. */}
      <group position={[0, DECK_Y, 0]}>
        <PatrollingAstronaut center={[3.0, 1.8]} radius={1.5} seed={1} accent={accent} />
      </group>

      {/* Raw feedstock — this is a regolith printer, so unlike every other
          site's resupply pallets, the pile here IS the product's input —
          stockpiled just past the deck's own 3.75 m half-extent, and a haul
          cart for moving it, both on the open back apron clear of the
          staged-blank pallets (upper-left) and the astronaut's loop
          (upper-right). */}
      <group position={[0, DECK_Y, 0]}>
        <group position={[0.5, 0, -4.6]}>
          <TailingsPile size={2.2} seed={1} />
        </group>
        <group position={[-3.0, 0, -3.2]} rotation={[0, 2.1, 0]}>
          <UtilityCart />
        </group>
        {/* A survey tripod staking out where the NEXT pour goes, and a
            pallet of finished tile stock waiting to be laid — an active
            print job has work staged both behind it (the tripod) and ahead
            of it (the pallet), not just its own feedstock. */}
        <group position={[3.4, 0, -3.6]}>
          <SurveyTripod seed={1} />
        </group>
        <group position={[-0.6, 0, -4.4]} rotation={[0, -0.5, 0]}>
          <BrickPallet seed={1} />
        </group>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Lunar mass driver (concept study, no developer assigned)
// ---------------------------------------------------------------------------

// Local units per METER, and now genuinely 1:1 — the model is authored in
// meters and TYPE_SIZE_M.mass_driver is its true length, so nothing here is
// multiplied by a fudge factor on the way out. (It used to be: a 70 m
// schematic blown up 1.5x, because 70 m of track read as under-scale for the
// base's capstone. The answer to that was never a scale factor; it was more
// track.)
//
// Still a NEAR SEGMENT, and unavoidably so. A reluctance launcher able to
// reach lunar escape velocity runs for kilometers — the source study's own
// half-metre-bore design comes out "over 7 km long" — so what caps this model
// is not the patch (16 km would hold 7 km of track) but the GROUND: the base
// sits on the ridge crest and every run off it descends, and a level guideway
// pays for descent in leg height. 600 m is as far as the flattest available
// heading stays level under legs a builder would recognise; see trackplan.
const MASS_DRIVER_M = UNIT_MAX_DIM / (TYPE_SIZE_M.mass_driver ?? TRACK_LENGTH_M)

// --- The guideway, in cross-section (meters) --------------------------------
// A spine beam carrying a continuous row of stator modules, each a square cell
// with a recessed window, under a capping rail. This is the reference
// animation's own build-up, and it is also why the beam reads as machinery
// rather than a girder: the repeat is at MD_MODULE_M, so the eye gets a scale
// ruler laid along the whole run.
const MD_SPINE_W = 2.2 // across the track
const MD_SPINE_H = 1.15 // spine depth, deck underside to module seat
const MD_MODULE_M = 3.0 // module pitch along the track
const MD_MODULE_GAP = 0.34 // dark joint between neighbouring modules
const MD_MODULE_W = 3.06 // module outer width, wider than the spine
const MD_MODULE_H = 1.52
const MD_WINDOW_INSET = 0.42 // how far the recessed cell sits inside its frame
const MD_RAIL_H = 0.2 // capping rail on top of the module row
const MD_RAIL_W = 3.24
const MD_BORE_R = 0.55 // bore radius — the source study's own figure

// --- The trestle bents -----------------------------------------------------
// An A-frame per bay: two splayed legs meeting under a pier cap, tied across at
// MD_TIE_FRAC of their height. The splay itself (and so which way up the bent
// is) comes from trackplan's bentLegs, as the two points each leg spans.
const MD_LEG_T = 0.52 // leg thickness along the track
const MD_LEG_W = 0.9 // leg width across it
const MD_TIE_FRAC = 0.42 // height up the bent that the cross tie sits at
const MD_TIE_T = 0.3
const MD_CAP_W = 3.4 // pier cap: the saddle the spine bears on
const MD_CAP_H = 0.76
const MD_CAP_D = 1.34
const MD_CHAMFER_H = 0.34 // the cap's tapered underside

// Merges a pile of boxes into one geometry.
//
// 600 m of trestle is 41 bents and 200 stator modules — about 600 boxes. As
// separate meshes that is 600 draw calls for one asset, on a page that already
// carries a 2 M-triangle terrain patch; merged it is five. They can be merged
// because they never move relative to each other and share one material, which
// is exactly the case merging is for.
function mergedBoxes(
  boxes: {
    size: [number, number, number]
    pos: [number, number, number]
    rot?: [number, number, number]
  }[]
): THREE.BufferGeometry {
  const parts = boxes.map((b) => {
    const g = new THREE.BoxGeometry(...b.size)
    const m = new THREE.Matrix4()
    if (b.rot) m.makeRotationFromEuler(new THREE.Euler(...b.rot))
    // setPosition writes the translation column only, so the rotation above
    // survives: this is rotate-then-translate, which is what a member placed
    // at a midpoint and leaned over needs.
    m.setPosition(b.pos[0], b.pos[1], b.pos[2])
    g.applyMatrix4(m)
    return g
  })
  const merged = mergeGeometries(parts, false)
  parts.forEach((g) => g.dispose())
  return merged ?? new THREE.BufferGeometry()
}

// Solar field feeding the capacitor bank beside the breach house. The source
// study's governing constraint is PEAK power, not total energy — the whole
// argument for a flywheel/capacitor bank is that it can accumulate slowly off
// a field this size and discharge in the fraction of a second a shot takes.
//
// Each panel's rack tilt (MD_PANEL_TILT) swings its LOW edge forward and its
// HIGH edge up and back from the group's own pivot point — the pivot itself
// is just a hinge line in space, not a physical support, so without a frame
// under those two edges the panel reads as floating with nothing holding it
// up (which is exactly what it did before this frame existed). A real
// fixed ground-mount array solves that with two rows of legs sized to the
// edge they sit under — short ones at the low front edge, tall ones at the
// high back edge — plus a rail tying each row's two legs together, which is
// what MD_PANEL_FRONT_Y/Z and MD_PANEL_BACK_Y/Z below are: those two edges'
// own positions, worked out once from the tilt so the legs can be planted
// exactly under them rather than guessed.
//
// The field stands on the LOT, at the model's own origin height, and its legs
// reach y = 0 — the ground under the breach works. It used to be nested inside
// a platform lift and reaching down through it, which is what made the panels
// float twice over; there is no platform now. Everything at the breach end
// stands on real ground, and only the guideway is up in the air.
const MD_PANEL_TILT = -0.55
const MD_PANEL_HALF_W = 1.13
const MD_PANEL_HALF_H = 1.33
const MD_PANEL_FRONT_Y = -MD_PANEL_HALF_H * Math.cos(MD_PANEL_TILT)
const MD_PANEL_FRONT_Z = -MD_PANEL_HALF_H * Math.sin(MD_PANEL_TILT)
const MD_PANEL_BACK_Y = MD_PANEL_HALF_H * Math.cos(MD_PANEL_TILT)
const MD_PANEL_BACK_Z = MD_PANEL_HALF_H * Math.sin(MD_PANEL_TILT)

function MassDriverSolarField({ originX }: { originX: number }) {
  const groundY = 0
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => {
        const x = originX + (i - 2) * 2.3
        const pivotY = 1.5
        const pivotZ = -6.5
        const frontEdgeY = pivotY + MD_PANEL_FRONT_Y
        const frontZ = pivotZ + MD_PANEL_FRONT_Z
        const backEdgeY = pivotY + MD_PANEL_BACK_Y
        const backZ = pivotZ + MD_PANEL_BACK_Z
        const frontLegH = frontEdgeY - groundY
        const frontLegY = (frontEdgeY + groundY) / 2
        const backLegH = backEdgeY - groundY
        const backLegY = (backEdgeY + groundY) / 2
        return (
          <group key={x}>
            <group position={[x, pivotY, pivotZ]} rotation={[MD_PANEL_TILT, 0, 0]}>
              <mesh position={[0, 0, -0.05]}>
                <boxGeometry args={[2.26, 2.66, 0.05]} />
                <meshStandardMaterial color={PANEL_EDGE} metalness={0.4} roughness={0.5} />
              </mesh>
              <mesh>
                <boxGeometry args={[2.1, 2.5, 0.08]} />
                <meshStandardMaterial color={PANEL} metalness={0.12} roughness={0.46} />
              </mesh>
            </group>
            {[-1, 1].map((s) => (
              <group key={s}>
                <mesh position={[x + s * MD_PANEL_HALF_W, frontLegY, frontZ]}>
                  <cylinderGeometry args={[0.05, 0.06, frontLegH, 8]} />
                  <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} />
                </mesh>
                <mesh position={[x + s * MD_PANEL_HALF_W, backLegY, backZ]}>
                  <cylinderGeometry args={[0.05, 0.06, backLegH, 8]} />
                  <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} />
                </mesh>
              </group>
            ))}
            <Strut
              from={[x - MD_PANEL_HALF_W, frontEdgeY, frontZ]}
              to={[x + MD_PANEL_HALF_W, frontEdgeY, frontZ]}
              r={0.045}
              color={METAL}
            />
            <Strut
              from={[x - MD_PANEL_HALF_W, backEdgeY, backZ]}
              to={[x + MD_PANEL_HALF_W, backEdgeY, backZ]}
              r={0.045}
              color={METAL}
            />
          </group>
        )
      })}
    </>
  )
}

// The whole row of A-frame bents, as three merged geometries: the legs and
// their cross ties, the pier caps, and the caps' tapered undersides.
//
// `groundM[i]` is the ground under bent `i` relative to the model's origin (the
// ground under the LOT), so it is mostly negative — the run descends. Each bent
// is therefore a different height, and that is the entire reason this is
// computed from sampled terrain rather than authored: a level deck over falling
// ground is what a trestle IS. Authoring one leg length and repeating it would
// bury the near bents or hang the far ones in the air, which is the failure
// this model had at 100 m and could not survive at 600 m.
function useTrestle(groundM: number[], deckY: number) {
  return useMemo(() => {
    const stations = trackBentStations()
    const legs: Parameters<typeof mergedBoxes>[0] = []
    const caps: Parameters<typeof mergedBoxes>[0] = []
    const chamfers: Parameters<typeof mergedBoxes>[0] = []

    stations.forEach((x, i) => {
      const footY = groundM[i] ?? 0
      const topY = deckY - MD_CAP_H
      const h = topY - footY
      if (h <= 0.5) return // ground at or above the deck: no bent to build
      const pair = bentLegs(x, footY, topY)
      for (const leg of pair) {
        const dy = leg.head[1] - leg.foot[1]
        const dz = leg.head[2] - leg.foot[2]
        legs.push({
          size: [MD_LEG_T, Math.hypot(dy, dz), MD_LEG_W],
          pos: [
            x,
            (leg.foot[1] + leg.head[1]) / 2,
            (leg.foot[2] + leg.head[2]) / 2,
          ],
          // A box's local +Y is its length, and a rotation of φ about the track
          // axis sends that to (0, cosφ, sinφ) — so the lean is whatever angle
          // carries +Y onto foot→head. Read off the endpoints rather than
          // constructed, so there is no sign here to get backwards.
          rot: [Math.atan2(dz, dy), 0, 0],
        })
      }
      // Cross tie, spanning the legs wherever they happen to be at its height.
      // Interpolated between the same two endpoints, so it tracks the splay
      // instead of assuming it.
      const [, right] = pair
      const tieHalf =
        right.foot[2] + MD_TIE_FRAC * (right.head[2] - right.foot[2])
      legs.push({
        size: [MD_TIE_T, MD_TIE_T, tieHalf * 2],
        pos: [x, footY + MD_TIE_FRAC * h, 0],
      })
      caps.push({
        size: [MD_CAP_D, MD_CAP_H, MD_CAP_W],
        pos: [x, deckY - MD_CAP_H / 2, 0],
      })
      chamfers.push({
        size: [MD_CAP_D * 0.78, MD_CHAMFER_H, MD_CAP_W * 0.6],
        pos: [x, topY - MD_CHAMFER_H / 2, 0],
      })
    })

    return {
      legs: mergedBoxes(legs),
      caps: mergedBoxes(caps),
      chamfers: mergedBoxes(chamfers),
    }
  }, [groundM, deckY])
}

// The stator modules: a square cell every MD_MODULE_M along the run, each a
// frame with a recessed window. Two merged geometries, frames and windows.
function useStatorModules(deckY: number) {
  return useMemo(() => {
    const n = Math.floor(TRACK_LENGTH_M / MD_MODULE_M)
    const frames: Parameters<typeof mergedBoxes>[0] = []
    const windows: Parameters<typeof mergedBoxes>[0] = []
    const y = deckY + MD_SPINE_H + MD_MODULE_H / 2
    for (let i = 0; i < n; i++) {
      const x = i * MD_MODULE_M + MD_MODULE_M / 2
      frames.push({
        size: [MD_MODULE_M - MD_MODULE_GAP, MD_MODULE_H, MD_MODULE_W],
        pos: [x, y, 0],
      })
      // The recess reads as the cell's window from any angle that matters,
      // because it is inset on all four sides of the frame's own face.
      windows.push({
        size: [
          MD_MODULE_M - MD_MODULE_GAP - MD_WINDOW_INSET,
          MD_MODULE_H - MD_WINDOW_INSET,
          MD_MODULE_W + 0.06,
        ],
        pos: [x, y, 0],
      })
    }
    return { frames: mergedBoxes(frames), windows: mergedBoxes(windows) }
  }, [deckY])
}

function MassDriver({
  accent,
  trackGround,
}: {
  accent: string
  // Ground under each trestle bent, in meters relative to this model's origin.
  // Handed down from MarkerLayer, which owns the terrain sampler. Undefined
  // until the height map decodes, in which case the run is treated as flat.
  trackGround?: number[]
}) {
  const groundM = useMemo(
    () => trackGround ?? trackBentStations().map(() => 0),
    [trackGround]
  )
  const deckY = trackDeckY(groundM)
  const trestle = useTrestle(groundM, deckY)
  const modules = useStatorModules(deckY)

  // The breach works sit BEHIND the launch line, on the lot, on real ground.
  const breachX = -6.2

  return (
    <group scale={MASS_DRIVER_M}>
      {/* --- The trestle ------------------------------------------------- */}
      <mesh geometry={trestle.legs} castShadow receiveShadow>
        <meshStandardMaterial color={HULL} roughness={0.62} metalness={0.16} />
      </mesh>
      <mesh geometry={trestle.caps} castShadow receiveShadow>
        <meshStandardMaterial color={PAD_SLAB_ALT} roughness={0.9} />
      </mesh>
      <mesh geometry={trestle.chamfers} castShadow receiveShadow>
        <meshStandardMaterial color={HULL_DARK} roughness={0.85} />
      </mesh>

      {/* --- The guideway ------------------------------------------------
          One continuous spine, then the module row on top of it, then the
          capping rail. Continuous members are single long boxes rather than
          per-bay pieces: there is nothing to be gained by chopping up a beam
          that is straight and unbroken for 600 m. */}
      <mesh
        position={[TRACK_LENGTH_M / 2, deckY + MD_SPINE_H / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[TRACK_LENGTH_M, MD_SPINE_H, MD_SPINE_W]} />
        <meshStandardMaterial color={PAD_WALL} roughness={0.86} />
      </mesh>
      <mesh geometry={modules.frames} castShadow receiveShadow>
        <meshStandardMaterial color={HULL} roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh geometry={modules.windows}>
        <meshStandardMaterial color={DARK} roughness={0.7} metalness={0.35} />
      </mesh>
      <mesh
        position={[
          TRACK_LENGTH_M / 2,
          deckY + MD_SPINE_H + MD_MODULE_H + MD_RAIL_H / 2,
          0,
        ]}
        castShadow
      >
        <boxGeometry args={[TRACK_LENGTH_M, MD_RAIL_H, MD_RAIL_W]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.5} metalness={0.4} />
      </mesh>
      {/* The bore itself, run as a continuous dark slot down the module row's
          centreline so the cells read as openings on a barrel rather than
          decoration stuck to a beam. */}
      <mesh
        position={[
          TRACK_LENGTH_M / 2,
          deckY + MD_SPINE_H + MD_MODULE_H / 2,
          0,
        ]}
      >
        <boxGeometry
          args={[TRACK_LENGTH_M + 0.4, MD_BORE_R * 2, MD_BORE_R * 2]}
        />
        <meshStandardMaterial color={DARK} roughness={0.45} metalness={0.5} />
      </mesh>

      {/* --- Muzzle ------------------------------------------------------
          The release end, flared and ringed. Also the one place the accent
          colour goes: it is what the eye is meant to follow the run out to. */}
      <group
        position={[TRACK_LENGTH_M, deckY + MD_SPINE_H + MD_MODULE_H / 2, 0]}
      >
        <mesh castShadow>
          <boxGeometry args={[2.6, MD_MODULE_H + 0.5, MD_MODULE_W + 0.5]} />
          <meshStandardMaterial
            color={HULL_DARK}
            roughness={0.5}
            metalness={0.35}
          />
        </mesh>
        <mesh position={[1.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[MD_BORE_R + 0.3, 0.16, 8, 24]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.9}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* --- Breach works, on the lot ------------------------------------- */}
      <group position={[breachX, 0, 0]}>
        <mesh position={[0, 2.0, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.4, 4.0, 5.2]} />
          <meshStandardMaterial color={HULL} roughness={0.7} />
        </mesh>
        <mesh position={[0, 4.0, 0]} castShadow>
          <boxGeometry args={[4.6, 0.16, 5.4]} />
          <meshStandardMaterial color={HULL_DARK} roughness={0.75} />
        </mesh>
        {/* Capacitor/flywheel racks — the "accumulate slowly, discharge
            quickly" hardware that has to survive the launcher's peak power,
            not its average. */}
        {[-1.6, 0, 1.6].map((z) => (
          <mesh key={z} position={[2.9, 0.9, z]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 1.8, 12]} />
            <meshStandardMaterial color={METAL} metalness={0.55} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 4.5, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 1.0, 6]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
        <mesh position={[0, 5.05, 0]}>
          <sphereGeometry args={[0.16, 10, 10]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.5}
            toneMapped={false}
          />
        </mesh>
      </group>
      <MassDriverSolarField originX={breachX} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Artemis Base Camp
// ---------------------------------------------------------------------------

// Local units per METER, as in the other true-size installations. 38 m dome
// to dome across the connector spine — the camp's own real size, not the
// generic habitat default (see TYPE_SIZE_M), since `CrewedBase` is reached
// by an explicit PROJECT_MODEL entry rather than the type-level fallback.
const CAMP_M = UNIT_MAX_DIM / 38

// The glazing is nearly clear on purpose. What should read at distance is the
// lattice holding it up and the crop beds behind it, not a tinted shell.
const GLAZING = '#c6dde8'
const CROP = '#4f8f42'
const CROP_DARK = '#2f6531'
const BED = '#3a342b'

const DOME_R = 6.0
const DOME_X = 12.0 // dome centers, either side of the node
const DOME_SPRING = 1.2 // springing line: where the glass leaves the curb
const DOME_MERIDIANS = 9
const DOME_LATITUDES = [24, 48, 72]

// The planting floor sits proud of the curb. Coplanar surfaces are what put
// black speckles across the first version's soil: the curb's top cap and the
// soil disc were both at exactly DOME_SPRING, so the depth test picked between
// them per-pixel.
const FLOOR_TOP = DOME_SPRING + 0.4
const PLANT_R = DOME_R * 0.86

// Shared across every plant in both domes: one blob geometry stretched and
// spun per instance is what keeps a lush dome from costing dozens of buffers.
const LEAF_GEO = new THREE.IcosahedronGeometry(0.5, 1)
const TRUNK_GEO = new THREE.CylinderGeometry(0.07, 0.12, 1, 6)
const LEAF_MATS = [
  new THREE.MeshStandardMaterial({ color: CROP, roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: '#3f7c39', roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: CROP_DARK, roughness: 0.92 }),
]
const TRUNK_MAT = new THREE.MeshStandardMaterial({
  color: '#5b4a35',
  roughness: 0.95,
})

type Plant = {
  key: number
  x: number
  z: number
  h: number
  w: number
  tree: boolean
  n: number
}

// A jittered grid of ground cover with a few small trees standing out of it.
// `entrySign` is the side the connector runs in from — nothing is planted where
// the module would grow through it.
function domePlanting(entrySign: number): Plant[] {
  const out: Plant[] = []
  const cells = 6
  const pitch = (PLANT_R * 2) / cells
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const i = r * cells + c
      const x = -PLANT_R + pitch * (c + 0.5) + (tileNoise(i) - 0.5) * pitch * 0.8
      const z =
        -PLANT_R + pitch * (r + 0.5) + (tileNoise(i + 137) - 0.5) * pitch * 0.8
      const d = Math.hypot(x, z)
      // Inside the glazing, clear of the central mast.
      if (d > PLANT_R - 0.4 || d < 1.2) continue
      if (entrySign * x > 3.0 && Math.abs(z) < 2.6) continue
      const n = tileNoise(i + 401)
      const tree = n > 0.74
      // Headroom above the raised floor, so nothing grows through the glass.
      const head = Math.sqrt(Math.max(DOME_R * DOME_R - d * d, 0.25))
      out.push({
        key: i,
        x,
        z,
        h: tree
          ? Math.min(2.3 + n * 1.8, (head - 1.2) / 1.3)
          : 0.7 + tileNoise(i + 55) * 0.8,
        w: tree
          ? 1.5 + tileNoise(i + 77) * 0.9
          : 1.0 + tileNoise(i + 91) * 1.0,
        tree,
        n,
      })
    }
  }
  return out
}

function DomePlanting({ entrySign }: { entrySign: number }) {
  const plants = useMemo(() => domePlanting(entrySign), [entrySign])
  return (
    <group position={[0, FLOOR_TOP, 0]}>
      {plants.map((p) =>
        p.tree ? (
          <group
            key={p.key}
            position={[p.x, 0, p.z]}
            rotation={[0, p.n * Math.PI * 2, 0]}
          >
            <mesh
              geometry={TRUNK_GEO}
              material={TRUNK_MAT}
              position={[0, p.h * 0.35, 0]}
              scale={[1, p.h * 0.72, 1]}
            />
            <mesh
              geometry={LEAF_GEO}
              material={LEAF_MATS[0]}
              position={[0, p.h * 0.72, 0]}
              scale={[p.w, p.h * 0.52, p.w]}
            />
            <mesh
              geometry={LEAF_GEO}
              material={LEAF_MATS[1]}
              position={[p.w * 0.2, p.h * 0.97, -p.w * 0.14]}
              scale={[p.w * 0.68, p.h * 0.34, p.w * 0.68]}
            />
          </group>
        ) : (
          <mesh
            key={p.key}
            geometry={LEAF_GEO}
            material={LEAF_MATS[p.n > 0.4 ? 1 : 2]}
            // Sunk slightly, so the clump grows out of the soil rather than
            // resting on it like a dropped ball.
            position={[p.x, p.h * 0.4, p.z]}
            rotation={[p.n * 1.2, p.n * Math.PI * 2, p.n * 0.8]}
            scale={[p.w, p.h, p.w * 0.86]}
          />
        )
      )}
    </group>
  )
}

// An agricultural dome: glazing on a white lattice over a planted floor,
// anchored to a curb inside a graded berm. The pair of these is what makes the
// camp read as somewhere people live rather than a cluster of parked equipment.
function GreenhouseDome({ entrySign }: { entrySign: number }) {
  return (
    <group>
      {/* Graded berm. Flares well below the seat point so the uphill side
          never cuts through the curb and the downhill side never hovers. */}
      <mesh position={[0, -1.25, 0]}>
        <cylinderGeometry args={[DOME_R * 1.06, DOME_R * 1.34, 2.8, 48]} />
        <meshStandardMaterial color={PAD_SURFACE} roughness={0.98} />
      </mesh>
      <mesh position={[0, DOME_SPRING / 2 - 0.1, 0]}>
        <cylinderGeometry args={[DOME_R, DOME_R * 1.03, DOME_SPRING + 0.2, 48]} />
        <meshStandardMaterial color={HULL} roughness={0.72} metalness={0.12} />
      </mesh>

      {/* Growing floor: a raised bed of soil, standing proud of the curb so no
          two surfaces share a plane. */}
      <mesh position={[0, FLOOR_TOP - 0.35, 0]}>
        <cylinderGeometry args={[DOME_R * 0.95, DOME_R * 0.95, 0.7, 40]} />
        <meshStandardMaterial color={BED} roughness={0.96} />
      </mesh>
      <DomePlanting entrySign={entrySign} />

      {/* Central mast the lattice is stayed from */}
      <mesh position={[0, DOME_SPRING + DOME_R / 2, 0]}>
        <cylinderGeometry args={[0.14, 0.2, DOME_R, 8]} />
        <meshStandardMaterial color={HULL} roughness={0.6} metalness={0.2} />
      </mesh>

      {/* Glazing. Transparent, which is also what keeps the shadow pass from
          dropping a solid disc of shade under a dome you can see through. */}
      <mesh position={[0, DOME_SPRING, 0]}>
        <sphereGeometry args={[DOME_R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={GLAZING}
          transparent
          opacity={0.2}
          roughness={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Meridians. A half-torus in the XY plane is already a meridian standing
          on the springing line, so spinning it about Y builds the whole cage. */}
      {Array.from({ length: DOME_MERIDIANS }, (_, i) => (
        <mesh
          key={i}
          position={[0, DOME_SPRING, 0]}
          rotation={[0, (i * Math.PI) / DOME_MERIDIANS, 0]}
        >
          <torusGeometry args={[DOME_R + 0.02, 0.075, 5, 32, Math.PI]} />
          <meshStandardMaterial color={HULL} roughness={0.6} metalness={0.15} />
        </mesh>
      ))}
      {DOME_LATITUDES.map((deg) => {
        const p = (deg * Math.PI) / 180
        return (
          <mesh
            key={deg}
            position={[0, DOME_SPRING + Math.sin(p) * DOME_R, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[Math.cos(p) * DOME_R + 0.02, 0.06, 5, 40]} />
            <meshStandardMaterial color={HULL} roughness={0.6} metalness={0.15} />
          </mesh>
        )
      })}
      {/* Crown fitting where the meridians meet */}
      <mesh position={[0, DOME_SPRING + DOME_R - 0.12, 0]}>
        <cylinderGeometry args={[0.5, 0.68, 0.45, 12]} />
        <meshStandardMaterial color={HULL} roughness={0.6} metalness={0.2} />
      </mesh>
    </group>
  )
}

const SPINE_R = 2.1
const SPINE_X0 = 2.6 // where the connector leaves the node
const SPINE_X1 = 8.4 // far enough to run inside the dome glazing
const SPINE_Y = SPINE_R + 0.55

// A pressurized connector from the central node out into a dome, with
// body-mounted PV wrapped over its upper face.
function SpineModule({ sign }: { sign: number }) {
  const len = SPINE_X1 - SPINE_X0
  const at = (t: number) => sign * (SPINE_X0 + len * t)
  return (
    <group>
      <mesh position={[at(0.5), SPINE_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[SPINE_R, SPINE_R, len, 24]} />
        <meshStandardMaterial color={HULL} roughness={0.72} metalness={0.15} />
      </mesh>
      {/* Domed cap on the node end; the far end runs on inside the glazing. */}
      <mesh
        position={[at(0), SPINE_Y, 0]}
        rotation={[0, 0, (sign * Math.PI) / 2]}
      >
        <sphereGeometry args={[SPINE_R, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={HULL} roughness={0.72} metalness={0.15} />
      </mesh>
      {/* Cradles. A module this size is landed and set down, not buried. */}
      {[0.3, 0.75].map((t) => (
        <mesh key={t} position={[at(t), 0.3, 0]}>
          <boxGeometry args={[1.1, 0.6, SPINE_R * 1.9]} />
          <meshStandardMaterial color={HULL_DARK} roughness={0.82} />
        </mesh>
      ))}
      {/* Body-mounted PV, wrapped over the top of the hull. Stood well off the
          skin: at 6 cm the panels and the hull were close enough for the depth
          test to flicker between them, which is what made them fizz. */}
      {[0.28, 0.72].map((t) => (
        <mesh
          key={t}
          position={[at(t), SPINE_Y, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry
            args={[
              SPINE_R + 0.18,
              SPINE_R + 0.18,
              len * 0.36,
              32,
              1,
              true,
              Math.PI / 2 - 0.8,
              1.6,
            ]}
          />
          {/* Matte, like the ISRU field: a glossy dark curve under a hard sun
              is nothing but specular aliasing. */}
          <meshStandardMaterial
            color={PANEL}
            metalness={0.1}
            roughness={0.62}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {/* Hull bands, in the gaps between panels rather than through them. */}
      {[0.02, 0.5, 0.98].map((t) => (
        <mesh key={t} position={[at(t), SPINE_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[SPINE_R + 0.04, 0.06, 6, 24]} />
          <meshStandardMaterial color={HULL_DARK} metalness={0.3} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

const NODE_R = 3.0
const NODE_H = 5.6

// The core: the airlock and traffic node everything else docks to, with the
// camp's high-gain link on top.
function CentralNode({ accent }: { accent: string }) {
  return (
    <group>
      <mesh position={[0, -0.9, 0]}>
        <cylinderGeometry args={[NODE_R * 1.04, NODE_R * 1.3, 2.4, 36]} />
        <meshStandardMaterial color={PAD_SURFACE} roughness={0.98} />
      </mesh>
      <mesh position={[0, NODE_H / 2, 0]}>
        <cylinderGeometry args={[NODE_R, NODE_R, NODE_H, 36]} />
        <meshStandardMaterial color={HULL} roughness={0.72} metalness={0.15} />
      </mesh>
      <mesh position={[0, NODE_H, 0]}>
        <sphereGeometry args={[NODE_R, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={HULL} roughness={0.72} metalness={0.15} />
      </mesh>
      {/* Lit ports — with the sun this low, the only warm light in the camp */}
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2
        return (
          <mesh
            key={i}
            position={[
              Math.cos(a) * (NODE_R + 0.02),
              NODE_H * 0.62,
              Math.sin(a) * (NODE_R + 0.02),
            ]}
            rotation={[0, Math.PI / 2 - a, 0]}
          >
            <planeGeometry args={[0.66, 0.5]} />
            <meshStandardMaterial
              color={WINDOW}
              emissive={WINDOW}
              emissiveIntensity={1.3}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        )
      })}
      <mesh position={[0, NODE_H + 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[NODE_R + 0.04, 0.1, 6, 36]} />
        <meshStandardMaterial color={HULL_DARK} metalness={0.3} roughness={0.6} />
      </mesh>
      {/* High-gain dish on a short mast above the dome cap */}
      <mesh position={[0, NODE_H + NODE_R + 0.4, 0]}>
        <cylinderGeometry args={[0.16, 0.22, 1.0, 8]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh
        position={[0, NODE_H + NODE_R + 1.4, 0.2]}
        rotation={[Math.PI / 3.2, 0, 0]}
      >
        <sphereGeometry args={[1.5, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2.3]} />
        <meshStandardMaterial
          color={HULL}
          side={THREE.DoubleSide}
          roughness={0.5}
          metalness={0.2}
        />
      </mesh>
      <mesh position={[0, NODE_H + NODE_R + 2.5, 0]}>
        <sphereGeometry args={[0.2, 10, 10]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={2.0}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

const HAB_R = 6.2
const HAB_RIBS = 16

// The foundation surface habitat: a ribbed pressure shell banked into a berm,
// entered through a tunnel that angles down to grade. Shielding mass is the
// reason every serious surface-habitat concept looks like this.
function HabitatDome() {
  const hatch = HAB_R + 3.4
  return (
    <group>
      <mesh position={[0, -1.3, 0]}>
        <cylinderGeometry args={[HAB_R * 1.08, HAB_R * 1.38, 3.0, 48]} />
        <meshStandardMaterial color={PAD_SURFACE} roughness={0.98} />
      </mesh>
      {/* Shell a shade darker than the ribs, so the segmentation reads at
          distance instead of flattening into one white blob. */}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[HAB_R, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.7} metalness={0.12} />
      </mesh>
      {Array.from({ length: HAB_RIBS }, (_, i) => (
        <mesh
          key={i}
          position={[0, 0.3, 0]}
          rotation={[0, (i * Math.PI) / HAB_RIBS, 0]}
        >
          <torusGeometry args={[HAB_R + 0.04, 0.13, 5, 30, Math.PI]} />
          <meshStandardMaterial color={HULL} roughness={0.6} metalness={0.18} />
        </mesh>
      ))}
      <mesh position={[0, 0.3 + HAB_R - 0.12, 0]}>
        <cylinderGeometry args={[1.05, 1.35, 0.5, 20]} />
        <meshStandardMaterial color={HULL} roughness={0.6} metalness={0.2} />
      </mesh>

      {/* Airlock tunnel down to grade, its hatch end capped, with a ramp out */}
      <Strut
        from={[0, 3.6, HAB_R * 0.7]}
        to={[0, 1.6, hatch]}
        r={1.35}
        color={HULL}
        seg={16}
      />
      <mesh position={[0, 1.6, hatch]}>
        <sphereGeometry args={[1.35, 20, 14]} />
        <meshStandardMaterial color={HULL} roughness={0.7} metalness={0.15} />
      </mesh>
      <mesh position={[0, 1.6, hatch + 1.3]}>
        <circleGeometry args={[0.85, 20]} />
        <meshStandardMaterial color={DARK} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.62, hatch + 2.4]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[2.4, 0.18, 3.4]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.82} />
      </mesh>
    </group>
  )
}

// The camp's power: a fixed PV farm on the rim, tilted to catch a sun that
// never climbs far above the horizon here.
function CampPvFarm() {
  return (
    <group>
      {[-2.7, 0, 2.7].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[0, 1.55, 0]} rotation={[-0.62, 0, 0]}>
            <boxGeometry args={[7.0, 0.12, 2.3]} />
            <meshStandardMaterial color={PANEL} metalness={0.16} roughness={0.48} />
          </mesh>
          {[-3.0, 0, 3.0].map((x) => (
            <mesh key={x} position={[x, 0.75, 0]}>
              <cylinderGeometry args={[0.09, 0.11, 1.5, 6]} />
              <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// Artemis Base Camp: a central node with pressurized connectors running out to
// two agricultural domes, the foundation habitat bermed in behind, a PV farm on
// the rim, and mobility parked on the apron.
function CrewedBase({ accent }: { accent: string }) {
  return (
    <group scale={CAMP_M}>
      <CentralNode accent={accent} />
      <SpineModule sign={-1} />
      <SpineModule sign={1} />

      {/* Staggered rather than mirrored: two identical domes squared off either
          side of the node read as a diagram, not a place that grew. */}
      <group position={[-DOME_X, 0, -1.0]}>
        <GreenhouseDome entrySign={1} />
      </group>
      <group position={[DOME_X, 0, 1.5]}>
        <GreenhouseDome entrySign={-1} />
      </group>

      {/* Habitat set back behind the spine, turned so its airlock opens away
          from the connectors rather than into them. */}
      <group position={[-2.0, 0, -13.5]} rotation={[0, -Math.PI / 2, 0]}>
        <HabitatDome />
      </group>

      {/* Turned about-face from the rest of the camp so the panel faces look
          out over the rim rather than back into the domes. */}
      <group position={[15.5, 0, -10.5]} rotation={[0, Math.PI - 0.22, 0]}>
        <CampPvFarm />
      </group>

      {/* Crew mobility on the apron: the LTV currently leading the rover race.
          MoonRacer is authored against its own 4.6 m size, so it needs the
          inverse of that scale to land back in the camp's meters. */}
      <group
        position={[4.2, 0, 8.0]}
        rotation={[0, -0.5, 0]}
        scale={1 / RACER_M}
      >
        <MoonRacer accent={accent} />
      </group>

      {/* Perimeter beacons marking the apron edge */}
      {[
        [-7.0, 6.4],
        [7.6, 6.4],
        [-9.5, -8.0],
      ].map(([x, z]) => (
        <group key={`${x}:${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.85, 0]}>
            <cylinderGeometry args={[0.07, 0.11, 1.7, 6]} />
            <meshStandardMaterial color={METAL} metalness={0.4} roughness={0.55} />
          </mesh>
          <mesh position={[0, 1.86, 0]}>
            <sphereGeometry args={[0.17, 10, 10]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={1.8}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* Suited figures, each patrolling its own patch of the apron — the
          only unambiguous scale cue on an airless plain, and now ones that
          walk the camp instead of standing frozen for a photo. */}
      <PatrollingAstronaut center={[1.2, 8.4]} radius={2.6} seed={0} accent={accent} />
      <PatrollingAstronaut center={[-5.6, 4.6]} radius={2.2} seed={2} accent={accent} />

      {/* A camp this size runs a standing resupply backlog: a haul cart and
          a couple of pallets, parked clear of both patrol loops and the
          domes at DOME_X = +/-12. */}
      <group position={[9.0, 0, -2.0]} rotation={[0, -1.2, 0]}>
        <UtilityCart />
      </group>
      <group position={[-2.0, 0, -8.5]} rotation={[0, 0.5, 0]}>
        <CargoPallet hard seed={9} />
      </group>
      <group position={[-3.4, 0, -8.9]} rotation={[0, -0.3, 0]}>
        <CargoPallet seed={10} />
      </group>
      {/* The rest of that backlog: a staged crate cluster in mixed sizes
          rather than one more repeated pallet, plus the junction box the
          camp's own power/comms runs actually terminate in. */}
      <group position={[8.4, 0, -6.6]}>
        <CrateCluster count={4} seed={9} spread={1.6} />
      </group>
      <group position={[6.0, 0, -8.0]} rotation={[0, 1.4, 0]}>
        <JunctionBox />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// International Lunar Research Station (ILRS) — CNSA / Roscosmos
// ---------------------------------------------------------------------------

// Local units per METER, as in the other true-size installations.
const ILRS_M = UNIT_MAX_DIM / (PROJECT_SIZE_M['ilrs'] ?? 20)

// Gold MLI over the mast's fan and the modules' end caps — the finish every
// Chang'e lander and Chinese lunar orbiter flies, and the strongest visual
// cue that separates this cluster from Artemis's white/aluminum hulls next
// door on the same lot.
const ILRS_GOLD = '#c9a227'
const ILRS_GOLD_DARK = '#7d6014'
// A single red band per module — the one color note both partners' flags
// share, kept to a stripe rather than a flag so it reads as livery.
const ILRS_RED = '#c8102e'
const ILRS_HULL = '#e6e4de'

const ILRS_MAST_H = 6.4
const ILRS_HUB_R = 0.6
const ILRS_BLADE_LEN = 5.6
const ILRS_BLADES = 6

// The shared power/comms mast. Public CNSA/Roscosmos renders consistently
// show one central tower with panels radiating outward like a fan rather than
// wings on any one spacecraft — ILRS's power plant is site infrastructure the
// modules plug into, built up over several separate landings, not a bus each
// module carries its own array on. The blades tilt up off horizontal rather
// than lying in the fan's own plane: the sun never climbs far at this
// latitude (SUN_DIR in MoonGlobe.tsx), so a flat radial fan foreshortens to a
// line from the camera's habitual angle, and standing each blade up is what a
// real polar array would do regardless.
function IlrsMast({ accent }: { accent: string }) {
  return (
    <group>
      {/* Footing, set below grade like every other planted mast on this map */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[ILRS_HUB_R * 1.7, ILRS_HUB_R * 2.2, 1.0, 16]} />
        <meshStandardMaterial color={PAD_SURFACE} roughness={0.98} />
      </mesh>
      <mesh position={[0, ILRS_MAST_H / 2, 0]}>
        <cylinderGeometry
          args={[ILRS_HUB_R, ILRS_HUB_R * 1.25, ILRS_MAST_H, 12]}
        />
        <meshStandardMaterial color={ILRS_HULL} roughness={0.5} metalness={0.35} />
      </mesh>
      {/* Hull bands, echoing the module livery so the mast reads as the same
          program rather than borrowed hardware. */}
      {[0.25, 0.55, 0.85].map((t) => (
        <mesh key={t} position={[0, ILRS_MAST_H * t, 0]}>
          <torusGeometry args={[ILRS_HUB_R * 1.1, 0.05, 6, 24]} />
          <meshStandardMaterial color={ILRS_RED} roughness={0.5} />
        </mesh>
      ))}

      {/* The fan: trapezoidal blades, wider at the tip than the root the way a
          folded-and-deployed rigid array is, spun evenly round the mast head
          and tilted up toward the sun's habitual bearing. */}
      {Array.from({ length: ILRS_BLADES }, (_, i) => {
        const a = (i / ILRS_BLADES) * Math.PI * 2
        return (
          <group
            key={i}
            position={[0, ILRS_MAST_H * 0.78, 0]}
            rotation={[0, a, 0]}
          >
            <group
              position={[ILRS_HUB_R + ILRS_BLADE_LEN / 2, 0, 0]}
              rotation={[0, 0, -0.45]}
            >
              <mesh>
                <boxGeometry args={[ILRS_BLADE_LEN, 0.08, 2.0]} />
                <meshStandardMaterial
                  color={ILRS_GOLD}
                  metalness={0.3}
                  roughness={0.4}
                />
              </mesh>
              {/* Cell-string lines, stood proud so they don't strobe flush
                  against the panel face. */}
              {[-0.65, 0, 0.65].map((z) => (
                <mesh key={z} position={[0, 0.045, z]}>
                  <boxGeometry args={[ILRS_BLADE_LEN * 0.97, 0.01, 0.03]} />
                  <meshStandardMaterial color={ILRS_GOLD_DARK} />
                </mesh>
              ))}
              {/* Root spar back to the hub */}
              <mesh position={[-ILRS_BLADE_LEN / 2 + 0.4, -0.06, 0]}>
                <boxGeometry args={[0.8, 0.1, 0.3]} />
                <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} />
              </mesh>
            </group>
          </group>
        )
      })}

      {/* Earth link, tipped up the way a polar station's has to be (see
          CommsPnt/TerminalDish above) — mounted below the fan so the blades
          never sweep through its boresight. */}
      <group position={[0, ILRS_MAST_H * 0.42, ILRS_HUB_R + 0.5]} rotation={[-0.62, 0, 0]}>
        <mesh>
          <sphereGeometry args={[0.9, 28, 14, 0, Math.PI * 2, 0, Math.PI / 4.2]} />
          <meshStandardMaterial color={ILRS_HULL} side={THREE.DoubleSide} roughness={0.34} metalness={0.3} />
        </mesh>
        {[0, 1, 2].map((i) => {
          const fa = (i / 3) * Math.PI * 2
          return (
            <Strut
              key={i}
              from={[Math.cos(fa) * 0.28, 0.02, Math.sin(fa) * 0.28]}
              to={[0, 0.62, 0]}
              r={0.03}
              color={METAL}
            />
          )
        })}
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color={DARK} metalness={0.4} roughness={0.5} />
        </mesh>
      </group>

      {/* Beacon at the mast head */}
      <mesh position={[0, ILRS_MAST_H + 0.4, 0]}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={2.0}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

const ILRS_MOD_R = 0.85
const ILRS_MOD_LEN = 3.6
// Ring the five ILRS-1 through -5 modules stand on. Tighter than the mast's
// own 6.2 m fan radius on purpose — the public renders consistently cluster
// the modules directly under the power/comms tower they plug into, not out
// past its reach.
const ILRS_MOD_RING_R = 4.7
const ILRS_MODS = 5

// One pressurized module: landed and shored on its own feet rather than
// bermed into the regolith. Unlike Artemis's foundation habitat next door,
// nothing here is buried — the extended model is still five separate landed
// pressure vessels wired and walked between, not one delivered structure.
function IlrsModule() {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, ILRS_MOD_R, 0]}>
        <cylinderGeometry args={[ILRS_MOD_R, ILRS_MOD_R, ILRS_MOD_LEN, 22]} />
        <meshStandardMaterial color={ILRS_HULL} roughness={0.55} metalness={0.2} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[(s * ILRS_MOD_LEN) / 2, ILRS_MOD_R, 0]}
          rotation={[0, 0, (s * Math.PI) / 2]}
        >
          <sphereGeometry args={[ILRS_MOD_R, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={ILRS_GOLD} roughness={0.45} metalness={0.3} />
        </mesh>
      ))}
      {/* Livery band, stood proud of the hull so it doesn't strobe */}
      <mesh position={[0, ILRS_MOD_R + 0.01, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[ILRS_MOD_R + 0.02, ILRS_MOD_R + 0.02, 0.5, 22]} />
        <meshStandardMaterial color={ILRS_RED} roughness={0.5} />
      </mesh>
      {/* Feet — shored, not buried */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * ILRS_MOD_LEN * 0.32, ILRS_MOD_R * 0.32, 0]}
        >
          <boxGeometry args={[0.85, ILRS_MOD_R * 0.64, ILRS_MOD_R * 1.9]} />
          <meshStandardMaterial color={HULL_DARK} roughness={0.85} />
        </mesh>
      ))}
      {/* One lit port per module, the only warm light in the cluster this
          deep into lunar night. */}
      <mesh
        position={[0, ILRS_MOD_R * 1.35, ILRS_MOD_R * 0.96]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.2, 16]} />
        <meshStandardMaterial
          color={WINDOW}
          emissive={WINDOW}
          emissiveIntensity={1.3}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

const ILRS_LDR_LEG = 1.5

// A just-landed cargo stack off to one side — Chang'e-8/Luna-28-class delivery
// hardware, gold-foiled like the modules it feeds. Even the extended model
// keeps one on the apron: ILRS grows by accretion, module by module, rather
// than arriving built, so there is always something mid-unload.
function IlrsCargoLander() {
  const legs = [0, 1, 2, 3]
  return (
    <group>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.85, 1.0, 1.3, 12]} />
        <meshStandardMaterial color={ILRS_GOLD} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.85, 0]}>
        <cylinderGeometry args={[0.55, 0.7, 0.5, 12]} />
        <meshStandardMaterial color={ILRS_HULL} roughness={0.5} metalness={0.25} />
      </mesh>
      {legs.map((i) => {
        const a = (i / legs.length) * Math.PI * 2 + Math.PI / 4
        const x = Math.cos(a) * ILRS_LDR_LEG
        const z = Math.sin(a) * ILRS_LDR_LEG
        return (
          <group key={i}>
            <Strut from={[Math.cos(a) * 0.7, 0.9, Math.sin(a) * 0.7]} to={[x, 0.1, z]} r={0.07} color={METAL} />
            <mesh position={[x, 0.06, z]}>
              <cylinderGeometry args={[0.28, 0.32, 0.12, 10]} />
              <meshStandardMaterial color={DARK} roughness={0.6} metalness={0.3} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// A raised causeway between two adjacent modules on the ring, on support
// posts rather than buried — the concrete difference between five separate
// landings and a linked base. Public renders of the 2040s "extended model"
// show the station's modules connected rather than standing as an
// archipelago the way the 2035 basic-model concepts do (see
// PROJECT_SIZE_M['ilrs']), and a walkway is the cheapest way to say that
// without inventing pressurized-tunnel geometry neither program has
// published.
function IlrsCauseway({
  a,
  b,
}: {
  a: [number, number]
  b: [number, number]
}) {
  const y = ILRS_MOD_R * 0.85
  const from: [number, number, number] = [a[0], y, a[1]]
  const to: [number, number, number] = [b[0], y, b[1]]
  const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  return (
    <group>
      <Strut from={from} to={to} r={0.34} color={ILRS_HULL} seg={10} />
      {[0.22, 0.78].map((t) => {
        const x = from[0] + (to[0] - from[0]) * t
        const z = from[2] + (to[2] - from[2]) * t
        return (
          <mesh key={t} position={[x, y * 0.5, z]}>
            <cylinderGeometry args={[0.09, 0.13, y, 8]} />
            <meshStandardMaterial color={METAL} metalness={0.45} roughness={0.55} />
          </mesh>
        )
      })}
      {/* A little sag-relief footing under the midspan, so the walkway reads
          as resting on the regolith rather than a line drawn over it. */}
      <mesh position={[mid[0], 0.02, mid[1]]}>
        <cylinderGeometry args={[0.4, 0.5, 0.08, 12]} />
        <meshStandardMaterial color={PAD_SURFACE} roughness={0.98} />
      </mesh>
    </group>
  )
}

const ILRS_COMMS_H = 5.4
const ILRS_COMMS_DISH_R = 1.5

// A second, independent Earth link on its own footing, off away from the
// power mast's fan. Redundant comms — rather than the whole station
// depending on one dish — is one of the concrete, visible differences the
// "considerable scale, stable operation" extended model (see
// PROJECT_SIZE_M['ilrs']) makes over the single-mast basic model, and giving
// it its own silhouette (a plain guyed mast, not a fan) keeps it from
// reading as a second copy of IlrsMast.
function IlrsCommsTower() {
  return (
    <group>
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.45, 0.62, 0.7, 12]} />
        <meshStandardMaterial color={PAD_SURFACE} roughness={0.98} />
      </mesh>
      <mesh position={[0, ILRS_COMMS_H / 2, 0]}>
        <cylinderGeometry args={[0.15, 0.21, ILRS_COMMS_H, 10]} />
        <meshStandardMaterial color={ILRS_HULL} roughness={0.5} metalness={0.3} />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.35
        return (
          <Strut
            key={i}
            from={[0, ILRS_COMMS_H * 0.66, 0]}
            to={[Math.cos(a) * 2.5, 0.04, Math.sin(a) * 2.5]}
            r={0.025}
            color={METAL}
          />
        )
      })}
      <group position={[0, ILRS_COMMS_H * 0.86, 0.12]} rotation={[-0.6, 0, 0]}>
        <mesh>
          <sphereGeometry
            args={[ILRS_COMMS_DISH_R, 26, 14, 0, Math.PI * 2, 0, Math.PI / 4]}
          />
          <meshStandardMaterial
            color={ILRS_HULL}
            side={THREE.DoubleSide}
            roughness={0.32}
            metalness={0.32}
          />
        </mesh>
        {[0, 1, 2].map((i) => {
          const fa = (i / 3) * Math.PI * 2
          return (
            <Strut
              key={i}
              from={[Math.cos(fa) * 0.36, 0.03, Math.sin(fa) * 0.36]}
              to={[0, 0.95, 0]}
              r={0.032}
              color={METAL}
            />
          )
        })}
        <mesh position={[0, 0.95, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color={DARK} metalness={0.4} roughness={0.5} />
        </mesh>
      </group>
      <mesh position={[0, ILRS_COMMS_H + 0.15, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial
          color={ILRS_RED}
          emissive={ILRS_RED}
          emissiveIntensity={1.8}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// Ground-mounted PV rows, gold to match the mast fan's own MLI rather than
// Artemis's blue cells (see CampPvFarm) — the extended model's second power
// source. The basic model ran everything off the one mast fan; a fixed field
// on its own footing is the visible sign the station now generates more than
// a single tower can carry.
function IlrsPvFarm() {
  return (
    <group>
      {[-2.6, 0, 2.6].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[0, 1.3, 0]} rotation={[-0.62, 0, 0]}>
            <boxGeometry args={[5.6, 0.11, 1.9]} />
            <meshStandardMaterial color={ILRS_GOLD} metalness={0.26} roughness={0.42} />
          </mesh>
          {[-2.3, 0, 2.3].map((x) => (
            <mesh key={x} position={[x, 0.62, 0]}>
              <cylinderGeometry args={[0.08, 0.1, 1.25, 6]} />
              <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ILRS: the shared power/comms mast at the center with five modules linked by
// causeways under its fan, a second comms tower and a ground PV field on
// their own footings further out, and a cargo stack still mid-unload. This is
// the "extended model" the public CNSA/Roscosmos roadmap has under
// construction through the 2040s (see PROJECT_SIZE_M['ilrs']) — a
// considerable-scale, stably-operating station — rather than the single-mast
// 2035 basic model the site started as, which is what makes it a real second
// competitor for the habitat district rather than a construction footnote next to
// Artemis Base Camp.
function ILRSBase({ accent }: { accent: string }) {
  const modAngles = Array.from(
    { length: ILRS_MODS },
    (_, i) => (i / ILRS_MODS) * Math.PI * 2 + 0.3
  )
  const modPositions: [number, number][] = modAngles.map((a) => [
    Math.cos(a) * ILRS_MOD_RING_R,
    Math.sin(a) * ILRS_MOD_RING_R,
  ])
  return (
    <group scale={ILRS_M}>
      <IlrsMast accent={accent} />

      {modPositions.map((p, i) => (
        <group
          key={i}
          position={[p[0], 0, p[1]]}
          rotation={[0, -modAngles[i] + Math.PI / 2, 0]}
        >
          <IlrsModule />
        </group>
      ))}

      {modPositions.map((p, i) => (
        <IlrsCauseway key={i} a={p} b={modPositions[(i + 1) % modPositions.length]} />
      ))}

      <group position={[8.1, 0, -4.9]} rotation={[0, 0.55, 0]}>
        <IlrsCargoLander />
        {/* Touchdown mark — this lander sits directly on graded regolith,
            not a paved LandingPad, so it gets the un-paved version. */}
        <ScorchMark r={2.0} />
        {/* A pallet off-loaded from this specific delivery, clear of the
            1.5 m leg spread (see ILRS_LDR_LEG) — "always something
            mid-unload" is the whole point of keeping a cargo lander here. */}
        <group position={[2.3, 0, 0.9]} rotation={[0, -0.6, 0]}>
          <CargoPallet seed={11} />
        </group>
      </group>
      <group position={[-6.7, 0, 6.0]} rotation={[0, -1.3, 0]}>
        <IlrsCargoLander />
        <ScorchMark r={2.0} />
        {/* This lander's own unload: a staged crate cluster rather than the
            first lander's single pallet, so the station reads as two
            deliveries in different states of being broken down. */}
        <group position={[-2.1, 0, 1.1]}>
          <CrateCluster count={4} seed={11} spread={1.5} />
        </group>
      </group>

      <group position={[-7.4, 0, -3.9]} rotation={[0, 1.1, 0]}>
        <IlrsCommsTower />
        <group position={[1.8, 0, -0.6]}>
          <JunctionBox />
        </group>
      </group>

      <group position={[3.0, 0, 7.9]} rotation={[0, -0.35, 0]}>
        <IlrsPvFarm />
      </group>

      {/* Suited figures, patrolling the courtyard the causeways ring — the
          same scale cue the rest of the colony uses, now walking it. */}
      <PatrollingAstronaut center={[1.6, 2.1]} radius={1.8} seed={3} accent={accent} />
      <PatrollingAstronaut center={[-2.6, -3.4]} radius={1.8} seed={4} accent={accent} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Moon RACER LTV — Intuitive Machines
// ---------------------------------------------------------------------------

// Local units per METER, as in the other true-size installations.
const RACER_M = UNIT_MAX_DIM / (PROJECT_SIZE_M['im-moon-racer'] ?? 4.6)

const RACER_BODY = '#eef1f5' // the white deck and seat shells
const RACER_BLUE = '#1a4fa0' // Intuitive Machines blue
const RACER_TRIM = '#1c1f24' // fenders, cage, instrument panel
const TIRE = '#141619'

const WHEEL_R = 0.45
const WHEEL_W = 0.34
const WHEEL_X = 1.5
const WHEEL_Z = 1.02
const DECK_TOP = 0.68 // the flat deck the crew rides on and cargo bolts to

// Airless spoked wheels. No pressurized tire survives a lunar night, so every
// LTV bid runs a mechanical one — which is why the hub reads through the tread
// instead of being hidden behind a sidewall.
function RacerWheel({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, WHEEL_R, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, WHEEL_W, 20]} />
        <meshStandardMaterial color={TIRE} roughness={0.92} />
      </mesh>
      {/* Spoke plate on the outboard face — the group's local +Y is the axle,
          so the offset has to follow which side of the vehicle this is. */}
      <mesh position={[0, Math.sign(z) * (WHEEL_W / 2 + 0.004), 0]}>
        <cylinderGeometry args={[WHEEL_R * 0.76, WHEEL_R * 0.76, 0.02, 20]} />
        <meshStandardMaterial color="#2c3038" roughness={0.85} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.15, 0.15, WHEEL_W + 0.07, 12]} />
        <meshStandardMaterial color={RACER_BLUE} metalness={0.35} roughness={0.5} />
      </mesh>
    </group>
  )
}

// Deep fenders over every wheel — the most recognizable thing about the
// vehicle from any angle, and the reason regolith thrown by one wheel doesn't
// land on the crew.
function RacerFender({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, WHEEL_R + 0.02, z]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry
        args={[
          WHEEL_R + 0.13,
          WHEEL_R + 0.13,
          WHEEL_W + 0.14,
          20,
          1,
          true,
          Math.PI / 2,
          Math.PI,
        ]}
      />
      <meshStandardMaterial
        color={RACER_TRIM}
        roughness={0.8}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// Intuitive Machines' LTV Services bid: an open buggy — no cabin, crew ride
// suited — on four airless wheels, with an instrument arch over the seats and
// a deployable array standing off the back deck.
function MoonRacer({ accent }: { accent: string }) {
  const corners: [number, number][] = [
    [WHEEL_X, WHEEL_Z],
    [WHEEL_X, -WHEEL_Z],
    [-WHEEL_X, WHEEL_Z],
    [-WHEEL_X, -WHEEL_Z],
  ]
  return (
    <group scale={RACER_M}>
      {corners.map(([x, z]) => (
        <group key={`${x}:${z}`}>
          <RacerWheel x={x} z={z} />
          <RacerFender x={x} z={z} />
          {/* Axle out to the hub */}
          <Strut
            from={[x, WHEEL_R, Math.sign(z) * 0.72]}
            to={[x, WHEEL_R, z]}
            r={0.07}
            color={RACER_BLUE}
          />
        </group>
      ))}

      {/* Frame rails under the deck */}
      {[-1, 1].map((s) => (
        <Strut
          key={s}
          from={[-1.95, 0.46, s * 0.78]}
          to={[1.95, 0.46, s * 0.78]}
          r={0.06}
          color={RACER_BLUE}
        />
      ))}

      {/* Flat deck with the blue centerline down it */}
      <mesh position={[0, DECK_TOP - 0.08, 0]}>
        <boxGeometry args={[4.2, 0.16, 1.7]} />
        <meshStandardMaterial color={RACER_BODY} roughness={0.55} metalness={0.1} />
      </mesh>
      <mesh position={[0, DECK_TOP + 0.015, 0]}>
        <boxGeometry args={[4.16, 0.03, 0.42]} />
        <meshStandardMaterial color={RACER_BLUE} roughness={0.5} metalness={0.15} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, DECK_TOP + 0.04, s * 0.82]}>
          <boxGeometry args={[4.2, 0.1, 0.1]} />
          <meshStandardMaterial color={RACER_BLUE} roughness={0.5} metalness={0.2} />
        </mesh>
      ))}

      {/* Two open seats side by side, with the suit interface plate behind */}
      {[-1, 1].map((s) => (
        <group key={s} position={[-0.15, DECK_TOP, s * 0.45]}>
          <mesh position={[0, 0.13, 0]}>
            <boxGeometry args={[0.6, 0.14, 0.56]} />
            <meshStandardMaterial color={RACER_BODY} roughness={0.6} />
          </mesh>
          <mesh position={[-0.32, 0.5, 0]}>
            <boxGeometry args={[0.14, 0.72, 0.56]} />
            <meshStandardMaterial color={RACER_BODY} roughness={0.6} />
          </mesh>
          <mesh position={[-0.23, 0.5, 0]}>
            <boxGeometry args={[0.05, 0.5, 0.38]} />
            <meshStandardMaterial color={RACER_BLUE} roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Roll cage splaying up to a rectangular roof frame over the crew */}
      {(
        [
          [0.72, 0.88, 0.1, 1.0],
          [0.72, -0.88, 0.1, -1.0],
          [-0.95, 0.88, -0.5, 1.0],
          [-0.95, -0.88, -0.5, -1.0],
        ] as [number, number, number, number][]
      ).map(([x0, z0, x1, z1]) => (
        <Strut
          key={`${x0}:${z0}`}
          from={[x0, DECK_TOP, z0]}
          to={[x1, 2.15, z1]}
          r={0.05}
          color={RACER_TRIM}
        />
      ))}
      {[0.1, -0.5].map((x) => (
        <Strut
          key={x}
          from={[x, 2.15, -1.0]}
          to={[x, 2.15, 1.0]}
          r={0.055}
          color={RACER_TRIM}
        />
      ))}
      {[-1, 1].map((s) => (
        <Strut
          key={s}
          from={[0.1, 2.15, s * 1.0]}
          to={[-0.5, 2.15, s * 1.0]}
          r={0.05}
          color={RACER_TRIM}
        />
      ))}

      {/* Instrument slab across the front of the arch, leaning back over the
          crew the way it does on the demo vehicle */}
      <mesh position={[0.1, 2.2, 0]} rotation={[0, 0, 0.22]}>
        <boxGeometry args={[0.1, 0.52, 2.0]} />
        <meshStandardMaterial color={RACER_TRIM} roughness={0.7} metalness={0.15} />
      </mesh>
      <mesh position={[0.17, 2.18, 0]}>
        <boxGeometry args={[0.12, 0.34, 0.46]} />
        <meshStandardMaterial color={RACER_BLUE} roughness={0.5} metalness={0.2} />
      </mesh>
      {[-0.11, 0.11].map((z) => (
        <mesh key={z} position={[0.24, 2.22, z]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.17, 0.2]} />
          <meshStandardMaterial
            color={WINDOW}
            emissive={WINDOW}
            emissiveIntensity={1.1}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* Camera pods on the roof rail */}
      {[-0.6, 0.6].map((z) => (
        <mesh key={z} position={[0.1, 2.32, z]}>
          <boxGeometry args={[0.2, 0.22, 0.26]} />
          <meshStandardMaterial color={RACER_TRIM} roughness={0.6} metalness={0.2} />
        </mesh>
      ))}
      {/* Avionics pods slung under the arch */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[0.05, 2.0, s * 0.78]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.13, 0.13, 0.36, 12]} />
          <meshStandardMaterial color={RACER_BODY} roughness={0.55} />
        </mesh>
      ))}
      {/* Corner beacons */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0.1, 2.15, s * 1.0]}>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.36, 8]} />
            <meshStandardMaterial color={RACER_BODY} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <sphereGeometry args={[0.09, 10, 10]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={2.0}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
      {/* High-gain dish behind the arch */}
      <mesh position={[-0.5, 2.28, 0.55]}>
        <cylinderGeometry args={[0.03, 0.04, 0.24, 6]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[-0.5, 2.42, 0.55]} rotation={[Math.PI / 3, 0, 0]}>
        <sphereGeometry args={[0.24, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
        <meshStandardMaterial
          color={RACER_BODY}
          side={THREE.DoubleSide}
          roughness={0.5}
          metalness={0.2}
        />
      </mesh>

      {/* Deployable array standing off the back deck. Steeply raked: at the
          pole the sun never climbs far, so a near-upright panel is the one that
          catches it. */}
      <group position={[-1.75, 1.42, 0]} rotation={[0, 0, 0.34]}>
        <mesh>
          <boxGeometry args={[0.07, 1.45, 2.05]} />
          <meshStandardMaterial color={RACER_TRIM} roughness={0.6} metalness={0.2} />
        </mesh>
        {[-0.34, 0.34].map((y) =>
          [-0.66, 0, 0.66].map((z) => (
            <mesh key={`${y}:${z}`} position={[0.05, y, z]} rotation={[0, 0, 0]}>
              <boxGeometry args={[0.02, 0.6, 0.58]} />
              <meshStandardMaterial color={PANEL} metalness={0.12} roughness={0.6} />
            </mesh>
          ))
        )}
      </group>
      {[-1, 1].map((s) => (
        <Strut
          key={s}
          from={[-1.9, DECK_TOP, s * 0.7]}
          to={[-1.66, 1.3, s * 0.9]}
          r={0.045}
          color={RACER_TRIM}
        />
      ))}

      {/* Stowage and the sampling arm on the back deck */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[-1.2, DECK_TOP + 0.2, s * 0.62]}>
          <boxGeometry args={[0.62, 0.4, 0.42]} />
          <meshStandardMaterial color={RACER_TRIM} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[-1.2, DECK_TOP + 0.1, 0]}>
        <cylinderGeometry args={[0.14, 0.17, 0.2, 12]} />
        <meshStandardMaterial color={RACER_TRIM} metalness={0.4} roughness={0.6} />
      </mesh>
      <Strut
        from={[-1.2, DECK_TOP + 0.18, 0]}
        to={[-1.55, 1.62, 0]}
        r={0.07}
        color={RACER_BODY}
      />
      <Strut
        from={[-1.55, 1.62, 0]}
        to={[-1.05, 1.22, 0.36]}
        r={0.055}
        color={RACER_BODY}
      />
      <mesh position={[-1.0, 1.17, 0.41]}>
        <boxGeometry args={[0.15, 0.14, 0.18]} />
        <meshStandardMaterial color={RACER_BLUE} metalness={0.3} roughness={0.5} />
      </mesh>

      {/* Front bumper and work lights */}
      <Strut
        from={[2.12, 0.42, -0.8]}
        to={[2.12, 0.42, 0.8]}
        r={0.05}
        color={RACER_TRIM}
      />
      {[-1, 1].map((s) => (
        <Strut
          key={s}
          from={[2.12, 0.42, s * 0.8]}
          to={[1.72, 0.56, s * 0.84]}
          r={0.045}
          color={RACER_TRIM}
        />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[2.08, 0.66, s * 0.5]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.09, 12]} />
          <meshStandardMaterial
            color={WINDOW}
            emissive={WINDOW}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// FLEX Rover — Venturi Astrolab
// ---------------------------------------------------------------------------

// Local units per METER, as in the other true-size installations.
const FLEX_M = UNIT_MAX_DIM / (PROJECT_SIZE_M['astrolab-flex'] ?? 4.2)

const FLEX_BODY = '#d5d8dc' // slab-sided equipment module and fenders
const FLEX_DARK = '#2f333a' // roof deck, light bar, rack framing
const FLEX_GOLD = '#c8952f' // MLI over the payload pallet, and the dish
const FLEX_RIM = '#9aa3ad' // bare metal wheels
const LED = '#eaf2ff' // work lights, cold white rather than cabin-warm

const FLEX_WHEEL_R = 0.52
const FLEX_WHEEL_W = 0.34
const FLEX_DECK = 0.95 // chassis deck the module and pallet sit on
const FLEX_ROOF = 2.12

// Bare spoked wheels, no fender-to-hub bodywork. The spokes are the reason a
// FLEX render is recognizable at a glance, so they are modeled rather than
// implied — but only on the outboard face, which is the only one ever seen.
function FlexWheel({ x, z }: { x: number; z: number }) {
  const face = Math.sign(z) * (FLEX_WHEEL_W / 2 + 0.01)
  return (
    <group position={[x, FLEX_WHEEL_R, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry
          args={[FLEX_WHEEL_R, FLEX_WHEEL_R, FLEX_WHEEL_W, 24, 1, true]}
        />
        <meshStandardMaterial
          color={FLEX_RIM}
          metalness={0.65}
          roughness={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh>
        <cylinderGeometry
          args={[FLEX_WHEEL_R * 0.42, FLEX_WHEEL_R * 0.42, FLEX_WHEEL_W, 16]}
        />
        <meshStandardMaterial color="#7d858f" metalness={0.6} roughness={0.5} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <mesh
            key={i}
            position={[
              Math.cos(a) * FLEX_WHEEL_R * 0.7,
              face,
              Math.sin(a) * FLEX_WHEEL_R * 0.7,
            ]}
            // Skewed off radial, so the spokes rake like the real wheel's
            // curved ones instead of reading as a bicycle hub.
            rotation={[0, -a + 0.35, 0]}
          >
            <boxGeometry args={[FLEX_WHEEL_R * 0.58, 0.02, 0.08]} />
            <meshStandardMaterial
              color="#b9c0c8"
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>
        )
      })}
      <mesh position={[0, face, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.07, 12]} />
        <meshStandardMaterial color={FLEX_BODY} metalness={0.4} roughness={0.5} />
      </mesh>
    </group>
  )
}

function FlexFender({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, FLEX_WHEEL_R + 0.03, z]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry
        args={[
          FLEX_WHEEL_R + 0.11,
          FLEX_WHEEL_R + 0.11,
          FLEX_WHEEL_W + 0.16,
          20,
          1,
          true,
          Math.PI * 0.62,
          Math.PI * 0.76,
        ]}
      />
      <meshStandardMaterial
        color={FLEX_BODY}
        roughness={0.6}
        metalness={0.15}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// Venturi Astrolab's FLEX: a flatbed built around swapping payloads, with the
// equipment module forward, a gold-blanketed pallet on the open bed behind it,
// and the manipulator that loads and unloads it.
function FlexRover({ accent }: { accent: string }) {
  const corners: [number, number][] = [
    [1.35, 1.15],
    [1.35, -1.15],
    [-1.35, 1.15],
    [-1.35, -1.15],
  ]
  return (
    <group scale={FLEX_M}>
      {corners.map(([x, z]) => (
        <group key={`${x}:${z}`}>
          <FlexWheel x={x} z={z} />
          <FlexFender x={x} z={z} />
          {/* Trailing arm out to the hub */}
          <Strut
            from={[x * 0.6, FLEX_DECK - 0.24, Math.sign(z) * 0.6]}
            to={[x, FLEX_WHEEL_R, z * 0.86]}
            r={0.075}
            color={FLEX_BODY}
          />
        </group>
      ))}

      <mesh position={[0, FLEX_DECK - 0.11, 0]}>
        <boxGeometry args={[3.5, 0.22, 1.75]} />
        <meshStandardMaterial color="#8e959d" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* Forward equipment module. An eight-sided prism scaled to a rectangle
          gives the chamfered vertical corners for one mesh, where a box plus
          bevel strips would take five. */}
      <mesh
        position={[1.02, (FLEX_DECK + FLEX_ROOF) / 2, 0]}
        rotation={[0, Math.PI / 8, 0]}
        scale={[1, 1, 1.1]}
      >
        <cylinderGeometry args={[0.98, 0.98, FLEX_ROOF - FLEX_DECK, 8]} />
        <meshStandardMaterial color={FLEX_BODY} roughness={0.55} metalness={0.18} />
      </mesh>
      {/* Radiator band low on the module. Stood 7 cm proud rather than skimmed
          over the skin: parallel faces a centimeter apart are a depth-test coin
          flip, and it reads as bolted-on hardware at this distance anyway. */}
      <mesh position={[1.02, FLEX_DECK + 0.2, 0]} rotation={[0, Math.PI / 8, 0]} scale={[1, 1, 1.1]}>
        <cylinderGeometry args={[1.05, 1.05, 0.22, 8, 1, true]} />
        <meshStandardMaterial
          color={FLEX_DARK}
          roughness={0.6}
          metalness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Payload pallet: gold MLI in a gridded rack. Carrying this is the whole
          point of the vehicle, so it is loaded rather than empty. */}
      <group position={[-0.72, FLEX_DECK + 0.52, 0]}>
        <mesh>
          <boxGeometry args={[1.42, 1.0, 1.62]} />
          <meshStandardMaterial color={FLEX_GOLD} metalness={0.75} roughness={0.34} />
        </mesh>
        {[-0.33, 0.33].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <boxGeometry args={[1.46, 0.07, 1.66]} />
            <meshStandardMaterial color={FLEX_DARK} roughness={0.7} metalness={0.3} />
          </mesh>
        ))}
        {[-0.47, 0, 0.47].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <boxGeometry args={[0.07, 1.04, 1.66]} />
            <meshStandardMaterial color={FLEX_DARK} roughness={0.7} metalness={0.3} />
          </mesh>
        ))}
      </group>

      {/* Roof deck, cantilevered back over the pallet on two posts */}
      <mesh position={[0.4, FLEX_ROOF + 0.05, 0]}>
        <boxGeometry args={[3.1, 0.1, 2.0]} />
        <meshStandardMaterial color={FLEX_DARK} roughness={0.65} metalness={0.25} />
      </mesh>
      {[-1, 1].map((s) => (
        <Strut
          key={s}
          from={[-1.05, FLEX_DECK, s * 0.86]}
          to={[-1.05, FLEX_ROOF, s * 0.86]}
          r={0.05}
          color={FLEX_DARK}
        />
      ))}

      {/* Light bar across the leading edge */}
      <mesh position={[1.86, FLEX_ROOF + 0.2, 0]}>
        <boxGeometry args={[0.2, 0.28, 1.86]} />
        <meshStandardMaterial color={FLEX_DARK} roughness={0.6} metalness={0.3} />
      </mesh>
      {[-0.72, -0.43, -0.14, 0.14, 0.43, 0.72].map((z) => (
        <mesh
          key={z}
          position={[1.97, FLEX_ROOF + 0.2, z]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <planeGeometry args={[0.2, 0.17]} />
          <meshStandardMaterial
            color={LED}
            emissive={LED}
            emissiveIntensity={1.9}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Shallow gold dish on a stub mast behind the roof */}
      <mesh position={[-0.35, FLEX_ROOF + 0.32, 0.25]}>
        <cylinderGeometry args={[0.05, 0.06, 0.44, 8]} />
        <meshStandardMaterial color={METAL} metalness={0.55} roughness={0.45} />
      </mesh>
      <mesh
        position={[-0.35, FLEX_ROOF + 0.58, 0.25]}
        rotation={[0.7, 0, 0.35]}
      >
        <sphereGeometry args={[0.44, 20, 8, 0, Math.PI * 2, 0, Math.PI / 7]} />
        <meshStandardMaterial
          color={FLEX_GOLD}
          metalness={0.7}
          roughness={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[-0.35, FLEX_ROOF + 0.62, 0.25]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.8}
          toneMapped={false}
        />
      </mesh>

      {/* Manipulator, caught mid-place. A stowed arm would hide the one thing
          that distinguishes this rover from a flatbed. */}
      <mesh position={[-1.15, FLEX_DECK + 0.18, 0.86]}>
        <cylinderGeometry args={[0.17, 0.2, 0.36, 12]} />
        <meshStandardMaterial color={FLEX_BODY} metalness={0.35} roughness={0.55} />
      </mesh>
      <Strut
        from={[-1.15, FLEX_DECK + 0.3, 0.86]}
        to={[-1.55, 1.95, 1.32]}
        r={0.085}
        color={FLEX_BODY}
        seg={10}
      />
      <Strut
        from={[-1.55, 1.95, 1.32]}
        to={[-1.2, 1.08, 1.74]}
        r={0.07}
        color={FLEX_BODY}
        seg={10}
      />
      <Strut
        from={[-1.2, 1.08, 1.74]}
        to={[-1.12, 0.6, 1.82]}
        r={0.055}
        color={FLEX_BODY}
        seg={8}
      />
      <mesh position={[-1.1, 0.52, 1.84]}>
        <boxGeometry args={[0.2, 0.14, 0.2]} />
        <meshStandardMaterial color={FLEX_DARK} metalness={0.4} roughness={0.5} />
      </mesh>

      {/* The payload being set down. Its base runs below grade so a couple of
          centimeters of relief two meters off the wheels can't float it. */}
      <mesh position={[-1.1, 0.22, 1.86]}>
        <boxGeometry args={[0.44, 0.44, 0.44]} />
        <meshStandardMaterial color="#aab6c0" metalness={0.3} roughness={0.45} />
      </mesh>
      <mesh position={[-1.1, 0.45, 1.86]}>
        <boxGeometry args={[0.36, 0.03, 0.36]} />
        <meshStandardMaterial color={PANEL} metalness={0.2} roughness={0.5} />
      </mesh>
      <mesh position={[-1.1, -0.1, 1.86]}>
        <boxGeometry args={[0.52, 0.28, 0.52]} />
        <meshStandardMaterial color={FLEX_DARK} roughness={0.75} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Lunar Voyager LTV — Lunar Outpost / Lunar Dawn
// ---------------------------------------------------------------------------

// Local units per METER, as in the other true-size installations.
const VOY_M = UNIT_MAX_DIM / (PROJECT_SIZE_M['lunar-outpost-lunar-dawn'] ?? 4.4)

const VOY_HULL = '#4a4f57' // gunmetal bodywork
const VOY_HULL_DARK = '#2b2f35' // recessed side channel, roll structure
const VOY_CHROME = '#c9ced5' // polished fender flares
const VOY_CAGE = '#b8bec6' // the latticed cargo container
const VOY_TIRE = '#17191c'

const VOY_WHEEL_R = 0.55
const VOY_WHEEL_W = 0.4
const VOY_DECK = 1.29 // top of the rear cargo bed

// Chunky knobbed wheels on dark rims. Shoulder rings rather than individual
// lugs: forty tread blocks would cost more than the rest of the truck and read
// as one dark band anyway.
function VoyagerWheel({ x, z }: { x: number; z: number }) {
  const face = Math.sign(z) * (VOY_WHEEL_W / 2 + 0.01)
  return (
    <group position={[x, VOY_WHEEL_R, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[VOY_WHEEL_R, VOY_WHEEL_R, VOY_WHEEL_W, 22]} />
        <meshStandardMaterial color={VOY_TIRE} roughness={0.94} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, (s * VOY_WHEEL_W) / 2.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[VOY_WHEEL_R - 0.03, 0.055, 6, 22]} />
          <meshStandardMaterial color="#212429" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, face, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.05, 14]} />
        <meshStandardMaterial color="#31363d" metalness={0.5} roughness={0.55} />
      </mesh>
      <mesh position={[0, face + 0.02, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.06, 10]} />
        <meshStandardMaterial color={VOY_CHROME} metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  )
}

// Polished flares, the loudest thing on the vehicle. Metalness this high needs
// the scene's environment map to read as chrome rather than black.
function VoyagerFender({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, VOY_WHEEL_R, z]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry
        args={[
          VOY_WHEEL_R + 0.13,
          VOY_WHEEL_R + 0.13,
          VOY_WHEEL_W + 0.22,
          22,
          1,
          true,
          Math.PI * 0.54,
          Math.PI * 0.92,
        ]}
      />
      <meshStandardMaterial
        color={VOY_CHROME}
        metalness={0.9}
        roughness={0.16}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// Lunar Outpost's Lunar Dawn entry: of the three LTV bids this is the one
// shaped like a pickup — crew cab forward under a raked screen, open bed aft
// carrying a latticed cargo container.
function VoyagerRover({ accent }: { accent: string }) {
  const corners: [number, number][] = [
    [1.45, 1.1],
    [1.45, -1.1],
    [-1.45, 1.1],
    [-1.45, -1.1],
  ]
  return (
    <group scale={VOY_M}>
      {corners.map(([x, z]) => (
        <group key={`${x}:${z}`}>
          <VoyagerWheel x={x} z={z} />
          <VoyagerFender x={x} z={z} />
          <Strut
            from={[x * 0.58, 0.66, Math.sign(z) * 0.6]}
            to={[x, VOY_WHEEL_R, z * 0.84]}
            r={0.08}
            color={VOY_HULL_DARK}
          />
        </group>
      ))}

      {/* Lower hull, riding high between the wheels */}
      <mesh position={[-0.05, 0.86, 0]}>
        <boxGeometry args={[3.8, 0.62, 1.82]} />
        <meshStandardMaterial color={VOY_HULL} roughness={0.5} metalness={0.45} />
      </mesh>
      {/* Recessed side channel. The back face is buried inside the hull, so
          nothing here shares a plane with the bodywork. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[-0.1, 0.94, s * 0.93]}>
            <boxGeometry args={[2.5, 0.26, 0.06]} />
            <meshStandardMaterial color={VOY_HULL_DARK} roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh position={[-0.1, 0.76, s * 0.93]}>
            <boxGeometry args={[2.5, 0.05, 0.06]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={0.5}
              roughness={0.5}
            />
          </mesh>
        </group>
      ))}

      {/* Crew cab: hood, raked screen, roof, and the pillars between them */}
      <mesh position={[1.0, 1.53, 0]}>
        <boxGeometry args={[1.05, 0.72, 1.72]} />
        <meshStandardMaterial color={VOY_HULL} roughness={0.5} metalness={0.45} />
      </mesh>
      <mesh position={[1.7, 1.24, 0]}>
        <boxGeometry args={[0.62, 0.16, 1.74]} />
        <meshStandardMaterial color={VOY_HULL} roughness={0.5} metalness={0.45} />
      </mesh>
      <mesh position={[1.48, 1.6, 0]} rotation={[0, 0, 0.45]}>
        <boxGeometry args={[0.07, 0.8, 1.62]} />
        <meshStandardMaterial
          color="#1b2027"
          roughness={0.18}
          metalness={0.5}
        />
      </mesh>
      <mesh position={[0.92, 1.96, 0]}>
        <boxGeometry args={[1.1, 0.1, 1.74]} />
        <meshStandardMaterial color={VOY_HULL} roughness={0.5} metalness={0.45} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Strut
            from={[1.66, 1.3, s * 0.8]}
            to={[1.38, 1.94, s * 0.82]}
            r={0.045}
            color={VOY_HULL_DARK}
          />
          <Strut
            from={[0.48, 1.17, s * 0.82]}
            to={[0.46, 1.94, s * 0.82]}
            r={0.05}
            color={VOY_HULL_DARK}
          />
        </group>
      ))}
      {/* Two suited crew stations under the roof */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0.98, 1.17, s * 0.42]}>
          <mesh position={[0, 0.12, 0]}>
            <boxGeometry args={[0.5, 0.12, 0.48]} />
            <meshStandardMaterial color={VOY_HULL_DARK} roughness={0.7} />
          </mesh>
          <mesh position={[-0.26, 0.42, 0]}>
            <boxGeometry args={[0.12, 0.6, 0.48]} />
            <meshStandardMaterial color={VOY_HULL_DARK} roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Open cargo bed */}
      <mesh position={[-0.85, VOY_DECK - 0.06, 0]}>
        <boxGeometry args={[2.2, 0.12, 1.8]} />
        <meshStandardMaterial color={VOY_HULL} roughness={0.55} metalness={0.4} />
      </mesh>

      {/* Latticed cargo container. Wrapping the bands and mullions all the way
          around costs the same as caging one face and reads from every angle. */}
      <group position={[-1.0, VOY_DECK + 0.45, 0]}>
        <mesh>
          <boxGeometry args={[1.5, 0.9, 1.5]} />
          <meshStandardMaterial color={VOY_CAGE} metalness={0.55} roughness={0.42} />
        </mesh>
        {[-0.3, 0.3].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <boxGeometry args={[1.55, 0.06, 1.55]} />
            <meshStandardMaterial color="#8a9199" metalness={0.5} roughness={0.5} />
          </mesh>
        ))}
        {[-0.48, 0, 0.48].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <boxGeometry args={[0.06, 0.94, 1.55]} />
            <meshStandardMaterial color="#8a9199" metalness={0.5} roughness={0.5} />
          </mesh>
        ))}
        {([[-0.72, -0.72], [-0.72, 0.72], [0.72, -0.72], [0.72, 0.72]] as [
          number,
          number
        ][]).map(([x, z]) => (
          <mesh key={`${x}:${z}`} position={[x, 0, z]}>
            <boxGeometry args={[0.09, 0.98, 0.09]} />
            <meshStandardMaterial color="#8a9199" metalness={0.5} roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* Antenna arm over the nose */}
      <mesh position={[1.5, 2.28, 0.6]}>
        <cylinderGeometry args={[0.04, 0.05, 0.68, 8]} />
        <meshStandardMaterial color={METAL} metalness={0.55} roughness={0.45} />
      </mesh>
      <mesh position={[1.56, 2.63, 0.6]}>
        <boxGeometry args={[0.44, 0.07, 0.12]} />
        <meshStandardMaterial color={VOY_CAGE} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[1.5, 2.72, 0.6]}>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={2.0}
          toneMapped={false}
        />
      </mesh>

      {/* Bumper and headlights */}
      <mesh position={[1.95, 0.9, 0]}>
        <boxGeometry args={[0.18, 0.3, 1.72]} />
        <meshStandardMaterial color={VOY_HULL_DARK} roughness={0.6} metalness={0.4} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[2.05, 1.12, s * 0.6]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <planeGeometry args={[0.36, 0.14]} />
          <meshStandardMaterial
            color={LED}
            emissive={LED}
            emissiveIntensity={1.8}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function GenericStructure({ accent }: { accent: string }) {
  return (
    <group>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
        <meshStandardMaterial color={HULL} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Multi-Purpose Habitat — Thales Alenia Space / ASI
// ---------------------------------------------------------------------------

// Local units per METER, as in the other true-size installations.
const MPH_M = UNIT_MAX_DIM / (TYPE_SIZE_M.habitat ?? 11)

const MPH_MLI = '#e4e7ec' // outer blanket, a shade warmer than bare hull
const MPH_SHADE = '#b9bec7' // undersides and shadowed panels
const MPH_TRIM = '#5d636d' // frames, rails, hatch surrounds
const MPH_RAD = '#f2f4f7' // radiator faces, the brightest thing on the module
const MPH_GOLD = '#b08c2e' // MLI over the antenna feeds

const MPH_R = 2.05 // pressure shell radius
const MPH_BARREL = 5.0 // barrel length between the end caps
const MPH_Y = 2.75 // shell centreline above grade
const MPH_X = -1.4 // barrel centre, biased aft to leave room for the airlock
const MPH_FWD = MPH_X + MPH_BARREL / 2 // where the forward cap starts
const MPH_AFT = MPH_X - MPH_BARREL / 2
const MPH_LOCK_X = 3.4 // airlock tower centre
const MPH_LOCK_R = 1.2

// Where the shell surface is at a given height, on the flank. Several fittings
// have to sit ON the hull rather than at a fixed offset from the barrel radius,
// and the flank curves away fast below the centreline — an inch of algebra here
// is what keeps a tank cradle or a painted stripe from floating off the side.
const mphFlankZ = (y: number) => Math.sqrt(MPH_R ** 2 - (y - MPH_Y) ** 2)

// The array stands UPRIGHT on a turntable and the radiators lie FLAT, which is
// the arrangement 89°S forces on you. The sun circles the horizon a couple of
// degrees up and never climbs, so a panel laid flat collects almost nothing
// while an upright one tracks the sun through the whole lunation by turning
// about the vertical alone. That leaves the cold zenith unused, which is
// precisely what a radiator wants. It is also why an array standing four
// meters over the wings never shades them: a shadow thrown by a horizon sun
// goes sideways, not down.
const MPH_ARRAY_X = -1.8
const MPH_ARRAY_FOOT = 5.56 // panel underside, overlapping the mast head
const MPH_ARRAY_W = 2.3
const MPH_ARRAY_H = 3.9
const MPH_ARRAY_YAW = 0.45 // raked off the view axis so it reads as a plane

const MPH_RAD_Y = 4.3 // wing roots, tucked into the shoulder
const MPH_RAD_ROOT = 1.3
const MPH_RAD_SPAN = 2.0
const MPH_RAD_LEN = 4.6
const MPH_RAD_DROOP = 0.1

// Consumables and power ride the flank AWAY from the road. The side a crew
// works from carries the viewports, the handrail and the hatch; the far side
// carries the tanks, the batteries and the control boxes. Every pressurized
// module ever flown is laid out this way, and for the obvious reason.
const MPH_SVC = -1 // which flank that is
const MPH_TANK_Y = 1.55
const MPH_TANK_R = 0.4
const MPH_TANK_Z = MPH_SVC * (mphFlankZ(MPH_TANK_Y) + MPH_TANK_R + 0.06)
const MPH_TANK_X = [-3.4, -1.6, 0.2]

// The module arrives complete and gets set down on its own gear, so it stands
// on legs rather than a graded deck. Footpads run well below grade for the same
// reason the printer gantry's do: the shell is rigid and the ground is not, and
// a pad resolved exactly at zero lifts clear of any hollow it lands over.
function HabitatLeg({ x, z }: { x: number; z: number }) {
  const s = Math.sign(z)
  return (
    <group>
      <Strut from={[x, 0.85, s * 0.95]} to={[x, -0.45, s * 1.62]} r={0.11} color={MPH_TRIM} />
      <Strut from={[x, 0.62, s * 1.5]} to={[x, -0.1, s * 1.62]} r={0.06} color={MPH_TRIM} />
      <mesh position={[x, -0.25, s * 1.62]}>
        <cylinderGeometry args={[0.42, 0.34, 0.9, 14]} />
        <meshStandardMaterial color={MPH_SHADE} roughness={0.85} metalness={0.2} />
      </mesh>
    </group>
  )
}

// Housekeeping power, and the first thing you see: nine square meters of cell
// standing four meters over the roof on a turntable.
function HabitatArray() {
  const cols = 4
  return (
    <group position={[MPH_ARRAY_X, 0, 0]}>
      {/* Turntable and mast. The roof falls away 8 cm across the turntable's
          own width, so it seats by its RIM rather than its centre — set flush
          at the crown and the far edge lifts off the shell. */}
      <mesh position={[0, 4.82, 0]}>
        <cylinderGeometry args={[0.5, 0.58, 0.24, 20]} />
        <meshStandardMaterial color={MPH_TRIM} roughness={0.5} metalness={0.45} />
      </mesh>
      <mesh position={[0, 5.25, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.64, 14]} />
        <meshStandardMaterial color={MPH_SHADE} roughness={0.55} metalness={0.4} />
      </mesh>

      <group position={[0, MPH_ARRAY_FOOT, 0]} rotation={[0, MPH_ARRAY_YAW, 0]}>
        <mesh position={[0, MPH_ARRAY_H / 2, 0]}>
          <boxGeometry args={[MPH_ARRAY_W, MPH_ARRAY_H, 0.06]} />
          <meshStandardMaterial color={PANEL} roughness={0.42} metalness={0.16} />
        </mesh>
        {/* Cell columns, standing proud of the face for the same reason the
            shell seams do: coplanar detail strobes as the camera moves. */}
        {Array.from({ length: cols - 1 }, (_, i) => (
          <mesh
            key={i}
            position={[
              MPH_ARRAY_W * ((i + 1) / cols - 0.5),
              MPH_ARRAY_H / 2,
              0.045,
            ]}
          >
            <boxGeometry args={[0.05, MPH_ARRAY_H - 0.12, 0.03]} />
            <meshStandardMaterial
              color={PANEL_EDGE}
              roughness={0.5}
              metalness={0.3}
            />
          </mesh>
        ))}
        {[0.05, MPH_ARRAY_H - 0.05].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <boxGeometry args={[MPH_ARRAY_W + 0.06, 0.1, 0.1]} />
            <meshStandardMaterial
              color={MPH_SHADE}
              roughness={0.5}
              metalness={0.4}
            />
          </mesh>
        ))}
        {/* Two stays to the turntable rim. In a sixth of a gravity with no wind
            to speak of, this is all a panel that size needs — which is why it
            can stand on a mast a third of a meter thick. */}
        {[-1, 1].map((s) => (
          <Strut
            key={s}
            from={[s * (MPH_ARRAY_W / 2 - 0.15), 0.06, 0]}
            to={[s * 0.46, -0.63, 0]}
            r={0.05}
            color={MPH_TRIM}
          />
        ))}
      </group>
    </group>
  )
}

// One O2 or N2 bottle on its cradle, braced up and inboard to the shell.
function HabitatTank({ x }: { x: number }) {
  return (
    <group>
      <group position={[x, MPH_TANK_Y, MPH_TANK_Z]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[MPH_TANK_R, MPH_TANK_R, 1.7, 18]} />
          <meshStandardMaterial
            color={MPH_SHADE}
            roughness={0.45}
            metalness={0.5}
          />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[s * 0.85, 0, 0]}
            rotation={[0, 0, (-s * Math.PI) / 2]}
          >
            <sphereGeometry args={[MPH_TANK_R, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial
              color={MPH_SHADE}
              roughness={0.45}
              metalness={0.5}
            />
          </mesh>
        ))}
        {[-0.55, 0.55].map((dx) => (
          <mesh key={dx} position={[dx, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[MPH_TANK_R + 0.03, 0.045, 8, 18]} />
            <meshStandardMaterial
              color={MPH_TRIM}
              roughness={0.5}
              metalness={0.45}
            />
          </mesh>
        ))}
      </group>
      <Strut
        from={[x, MPH_TANK_Y - MPH_TANK_R + 0.06, MPH_TANK_Z]}
        to={[x, 1.9, MPH_SVC * (mphFlankZ(1.9) - 0.3)]}
        r={0.055}
        color={MPH_TRIM}
      />
    </group>
  )
}

// Italy's contribution to Artemis: a rigid pressurized module delivered ready
// to live in, with its own power, thermal, and airlock, and a berthing port at
// the aft cap so a second element can be added later.
//
// It is a STANDING module, not a vehicle, and the difference is the point of
// the habitat race — the Lunar Cruiser in the next lot does the same job on
// wheels. So the subsystems are the ones a module carries and a rover cannot:
// an upright tracking array, radiator wings out over the roof, a bottled-gas
// bank and a battery box on the service flank, and a berthing port waiting on
// hardware that has not launched yet.
function Habitat({ accent }: { accent: string }) {
  return (
    <group scale={MPH_M}>
      {[-3.3, -0.2].map((x) =>
        [-1, 1].map((s) => <HabitatLeg key={`${x}:${s}`} x={x} z={s * 1.45} />)
      )}
      <HabitatLeg x={MPH_LOCK_X} z={-1.05} />
      <HabitatLeg x={MPH_LOCK_X} z={1.05} />

      {/* Pressure shell */}
      <mesh position={[MPH_X, MPH_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[MPH_R, MPH_R, MPH_BARREL, 32]} />
        <meshStandardMaterial color={MPH_MLI} roughness={0.72} metalness={0.14} />
      </mesh>
      {/* End caps. The sign matters and is easy to get backwards: a hemisphere
          is built about +Y, and Rz(+PI/2) carries +Y to -X, so `s` has to be
          negated to dome the FORWARD cap forward. Get it wrong and both caps
          turn inward, where they sit invisible inside a barrel of the same
          radius — the module reads as a flat-ended can and the berthing port,
          placed off where the aft cap ought to bulge to, floats 2 m clear of
          the hull. */}
      {[
        [MPH_FWD, 1],
        [MPH_AFT, -1],
      ].map(([x, s]) => (
        <mesh key={s} position={[x, MPH_Y, 0]} rotation={[0, 0, (-s * Math.PI) / 2]}>
          <sphereGeometry args={[MPH_R, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={MPH_MLI} roughness={0.72} metalness={0.14} />
        </mesh>
      ))}
      {/* Blanket seams. Standing proud of the shell rather than flush with it,
          which is what keeps them from strobing as the camera moves. */}
      {[-3.1, -1.9, -0.7, 0.5].map((x) => (
        <mesh key={x} position={[x, MPH_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[MPH_R + 0.03, 0.045, 8, 32]} />
          <meshStandardMaterial color={MPH_SHADE} roughness={0.62} metalness={0.28} />
        </mesh>
      ))}
      {/* Berthing port on the aft cap — the module is meant to grow. */}
      <mesh position={[MPH_AFT - MPH_R - 0.18, MPH_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.72, 0.72, 0.36, 20]} />
        <meshStandardMaterial color={MPH_TRIM} roughness={0.5} metalness={0.5} />
      </mesh>

      {/* Viewports and the rail crews clip to, on the side that faces the yard */}
      {[-2.7, -1.3, 0.1].map((x) => (
        <group key={x}>
          <mesh position={[x, MPH_Y + 0.35, MPH_R + 0.02]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.27, 0.27, 0.1, 18]} />
            <meshStandardMaterial color={MPH_TRIM} roughness={0.5} metalness={0.5} />
          </mesh>
          <mesh position={[x, MPH_Y + 0.35, MPH_R + 0.09]}>
            <cylinderGeometry args={[0.2, 0.2, 0.03, 18]} />
            <meshStandardMaterial
              color={WINDOW}
              emissive={WINDOW}
              emissiveIntensity={1.1}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
      <Strut
        from={[MPH_AFT + 0.2, MPH_Y - 0.9, MPH_R + 0.16]}
        to={[MPH_FWD - 0.2, MPH_Y - 0.9, MPH_R + 0.16]}
        r={0.05}
        color={MPH_TRIM}
      />

      {/* Radiator wings, lying flat off the shoulders where they see the cold
          zenith and never the horizon sun (see MPH_RAD_Y) */}
      {[-1, 1].map((s) => (
        <group
          key={s}
          position={[MPH_X, MPH_RAD_Y, s * MPH_RAD_ROOT]}
          rotation={[s * MPH_RAD_DROOP, 0, 0]}
        >
          <mesh position={[0, 0, (s * MPH_RAD_SPAN) / 2]}>
            <boxGeometry args={[MPH_RAD_LEN, 0.07, MPH_RAD_SPAN]} />
            <meshStandardMaterial color={MPH_RAD} roughness={0.42} metalness={0.24} />
          </mesh>
          {/* Flow tubes across the face */}
          {Array.from({ length: 8 }, (_, i) => (
            <mesh
              key={i}
              position={[
                MPH_RAD_LEN * (i / 7 - 0.5) * 0.86,
                0.055,
                (s * MPH_RAD_SPAN) / 2,
              ]}
            >
              <boxGeometry args={[0.05, 0.04, MPH_RAD_SPAN - 0.14]} />
              <meshStandardMaterial color={MPH_SHADE} roughness={0.5} metalness={0.3} />
            </mesh>
          ))}
          {/* Root header. The coolant has to reach the wing somehow, and this
              is the part that says so. */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.13, 0.13, MPH_RAD_LEN - 0.5, 12]} />
            <meshStandardMaterial color={MPH_TRIM} roughness={0.5} metalness={0.45} />
          </mesh>
        </group>
      ))}

      <HabitatArray />

      {/* High-gain dish, up on a relay rather than out at Earth: from 89°S the
          Earth sits within a few degrees of the horizon and spends part of each
          month behind it, which is the whole reason polar comms goes through an
          orbiter. */}
      <group position={[0.7, 4.66, 0.35]}>
        <mesh position={[0, 0.34, 0]}>
          <cylinderGeometry args={[0.11, 0.14, 0.7, 12]} />
          <meshStandardMaterial color={MPH_TRIM} roughness={0.5} metalness={0.5} />
        </mesh>
        <group position={[0, 0.76, 0]} rotation={[0.75, 0.4, 0]}>
          <mesh rotation={[Math.PI, 0, 0]}>
            <sphereGeometry args={[0.44, 20, 12, 0, Math.PI * 2, 0, 1.0]} />
            <meshStandardMaterial
              color={MPH_MLI}
              roughness={0.45}
              metalness={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>
          <Strut from={[0, 0.04, 0]} to={[0, 0.4, 0]} r={0.028} color={MPH_GOLD} />
          <mesh position={[0, 0.44, 0]}>
            <sphereGeometry args={[0.075, 10, 8]} />
            <meshStandardMaterial color={MPH_GOLD} roughness={0.4} metalness={0.6} />
          </mesh>
        </group>
      </group>

      {/* Omni whip, for the hours the dish is off target */}
      <mesh position={[-3.1, 4.9, -0.3]}>
        <cylinderGeometry args={[0.13, 0.16, 0.26, 12]} />
        <meshStandardMaterial color={MPH_TRIM} roughness={0.55} metalness={0.45} />
      </mesh>
      <mesh position={[-3.1, 5.58, -0.3]}>
        <cylinderGeometry args={[0.035, 0.045, 1.15, 8]} />
        <meshStandardMaterial color={MPH_GOLD} roughness={0.45} metalness={0.55} />
      </mesh>

      {/* Airlock tower, hatch facing the road */}
      <mesh position={[MPH_LOCK_X, 1.95, 0]}>
        <cylinderGeometry args={[MPH_LOCK_R, MPH_LOCK_R, 2.9, 24]} />
        <meshStandardMaterial color={MPH_MLI} roughness={0.72} metalness={0.14} />
      </mesh>
      <mesh position={[MPH_LOCK_X, 3.4, 0]}>
        <sphereGeometry args={[MPH_LOCK_R, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={MPH_MLI} roughness={0.72} metalness={0.14} />
      </mesh>
      {/* EVA door: a round hatch with its own port. The collar is a DEEP
          cylinder buried most of the way into the tower, not a disc laid on it
          — a flat frame tangent to a curved wall stands off it at the rim, and
          sinking the collar is what puts the frame's face flush at the centre
          and lets the wall come up to meet the rest of it. */}
      <mesh
        position={[MPH_LOCK_X, 1.68, MPH_LOCK_R - 0.25]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.64, 0.64, 0.5, 24]} />
        <meshStandardMaterial color={MPH_TRIM} roughness={0.55} metalness={0.42} />
      </mesh>
      <mesh
        position={[MPH_LOCK_X, 1.68, MPH_LOCK_R + 0.04]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.55, 0.55, 0.06, 24]} />
        <meshStandardMaterial color={DARK} roughness={0.6} metalness={0.35} />
      </mesh>
      <mesh
        position={[MPH_LOCK_X, 1.78, MPH_LOCK_R + 0.09]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.17, 0.17, 0.04, 18]} />
        <meshStandardMaterial
          color={WINDOW}
          emissive={WINDOW}
          emissiveIntensity={1.1}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[MPH_LOCK_X - 0.3, 1.5, MPH_LOCK_R + 0.11]}>
        <boxGeometry args={[0.34, 0.07, 0.07]} />
        <meshStandardMaterial color={MPH_SHADE} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Ramp down to the regolith, sunk at the foot so it never floats. The
          rotation is POSITIVE: about +X, the far end of a deck laid along +Z
          rises, so a negative angle tips the ramp the wrong way — buried at the
          sill and floating most of a meter up at the foot, which is also the
          reverse of the way the handrail beside it runs. */}
      <mesh position={[MPH_LOCK_X, 0.42, MPH_LOCK_R + 1.35]} rotation={[0.36, 0, 0]}>
        <boxGeometry args={[1.25, 0.1, 2.6]} />
        <meshStandardMaterial color={MPH_SHADE} roughness={0.85} metalness={0.2} />
      </mesh>
      {[-1, 1].map((s) => (
        <Strut
          key={s}
          from={[MPH_LOCK_X + s * 0.62, 1.35, MPH_LOCK_R + 0.2]}
          to={[MPH_LOCK_X + s * 0.62, 0.5, MPH_LOCK_R + 2.5]}
          r={0.045}
          color={MPH_TRIM}
        />
      ))}

      {/* Consumables, on a cradle rail down the service flank */}
      <mesh
        position={[MPH_X - 0.2, MPH_TANK_Y - MPH_TANK_R - 0.06, MPH_TANK_Z]}
      >
        <boxGeometry args={[6.3, 0.14, 0.5]} />
        <meshStandardMaterial color={MPH_TRIM} roughness={0.55} metalness={0.42} />
      </mesh>
      {MPH_TANK_X.map((x) => (
        <HabitatTank key={x} x={x} />
      ))}

      {/* Batteries, slung under the same flank, clear of the landing legs */}
      {[-2.5, -1.0].map((x) => (
        <mesh key={x} position={[x, 0.86, MPH_SVC * 0.8]}>
          <boxGeometry args={[1.2, 0.6, 0.95]} />
          <meshStandardMaterial color={MPH_SHADE} roughness={0.6} metalness={0.35} />
        </mesh>
      ))}

      {/* Battery and array power control, forward where the harness runs from
          the turntable and the cells are shortest */}
      <group position={[0.75, 2.62, MPH_SVC * 2.2]}>
        <mesh>
          <boxGeometry args={[1.7, 1.1, 0.72]} />
          <meshStandardMaterial color={MPH_MLI} roughness={0.6} metalness={0.3} />
        </mesh>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} position={[-0.6 + i * 0.3, 0, MPH_SVC * 0.41]}>
            <boxGeometry args={[0.06, 0.9, 0.1]} />
            <meshStandardMaterial color={MPH_SHADE} roughness={0.5} metalness={0.4} />
          </mesh>
        ))}
      </group>

      {/* Operator's stripe and the two lights that mark the hatch after dark.
          The stripe sits on the flank at its own height, not at a fixed offset
          from the barrel radius: down here the shell has curved 65 cm inboard,
          and R - 0.55 left the stripe hanging 7 cm off the side of it. */}
      <mesh position={[MPH_X, MPH_Y - 1.5, mphFlankZ(MPH_Y - 1.5) + 0.01]}>
        <boxGeometry args={[3.4, 0.16, 0.06]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.55}
          toneMapped={false}
          roughness={0.5}
        />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[MPH_LOCK_X + s * 0.85, 2.75, MPH_LOCK_R * 0.7]}>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.5}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* A crew member at the foot of the ramp, beyond where it lands */}
      <PatrollingAstronaut
        center={[MPH_LOCK_X, MPH_LOCK_R + 3.6]}
        radius={1.2}
        seed={7}
        accent={accent}
      />

      {/* Resupply staged off to the side of the ramp, clear of both it and
          the crew member's own patrol loop. */}
      <group position={[MPH_LOCK_X + 2.3, 0, MPH_LOCK_R + 1.2]} rotation={[0, -0.8, 0]}>
        <CargoPallet seed={7} />
      </group>
      {/* A framed water tank standing off the hull's own rail, clear of the
          patrol loop and the ramp — a crewed module needs somewhere its
          water actually lives, not just a resupply pallet. */}
      <group position={[MPH_AFT - 1.6, 0, -(MPH_R + 1.6)]}>
        <FramedTank seed={7} />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// LIFE Habitat — Sierra Space
// ---------------------------------------------------------------------------

// Local units per METER, as in the other true-size installations.
const LIFE_M = UNIT_MAX_DIM / (PROJECT_SIZE_M['sierra-space-life'] ?? 12)

const LIFE_SOFT = '#eceadf' // woven softgoods: warmer and duller than metal
const LIFE_STRAP = '#b0aa9a' // the webbing that takes the hoop load
const LIFE_CORE = '#d9dde3' // rigid bulkheads and the vestibule
const LIFE_TRIM = '#4a505a' // frames, steps, handrails
const LIFE_CRADLE = '#8d9299' // the saddles it settles into

// An INFLATABLE, and the whole model is built to say so. Two features carry it:
// the BULK — 8.3 m across where the MPH two lots over is 4.1, for something that
// launched folded inside the same shroud — and the QUILTING, the row of bulges
// where pressure pushes the fabric out between the webbing straps that take the
// hoop load. Every flown inflatable looks like this, and nothing rigid does.
const LIFE_R_BULGE = 4.15 // shell at mid-bay, where the pressure wins
const LIFE_R_STRAP = 3.9 // shell at a strap, where the webbing cinches it in
const LIFE_CORE_R = 2.2 // rigid bulkhead radius, where the softgoods land
const LIFE_BARREL = 5.0 // quilted section, bay one to bay four
const LIFE_DOME = 1.6 // axial depth of each end dome
const LIFE_BAYS = 4
const LIFE_Y = 4.4 // axis height, which leaves the belly 25 cm off the regolith
const LIFE_X = -0.8 // softgoods centre, biased aft to leave room for the airlock
const LIFE_END = LIFE_BARREL / 2 + LIFE_DOME // dome tip, either side of centre

// The vestibule hangs DOWN and forward off the bulkhead, rather than reaching
// straight out at axis height. On a hull this fat the axis is 4.4 m up, and a
// door up there needs a stair as long as the habitat; canting the airlock down
// puts the sill at 1 m and costs three steps.
const LIFE_VEST_X = 5.1
const LIFE_VEST_Y = 1.5
const LIFE_VEST_R = 1.05

// Radiators ride on STANDOFFS clear of the shell, not against it. A flat panel
// laid on a quilted hull has nothing straight to sit on — it would bury itself
// in the bulges and lift off the cinches — and radiators want to be off the
// insulation anyway.
const LIFE_RAD_EL = 0.87 // elevation of the shoulder they sit over, radians
const LIFE_RAD_R = 4.55

// The shell as a profile revolved about the axis: a dome, four quilted bays,
// then the dome mirrored. Doing it as one lathe rather than a stack of barrels
// is what makes the bulges continuous — a seam between two cylinders reads as a
// seam no matter how well the radii match.
const LIFE_PROFILE = (() => {
  const pts: THREE.Vector2[] = []
  const domeSteps = 9
  const domeR = (u: number) =>
    LIFE_CORE_R + (LIFE_R_STRAP - LIFE_CORE_R) * Math.sin(u)
  for (let i = 0; i < domeSteps; i++) {
    const u = (i / domeSteps) * (Math.PI / 2)
    pts.push(
      new THREE.Vector2(domeR(u), -LIFE_BARREL / 2 - LIFE_DOME * Math.cos(u))
    )
  }
  const barrelSteps = LIFE_BAYS * 10
  for (let i = 0; i <= barrelSteps; i++) {
    const t = i / barrelSteps
    // Cinched at every strap, fullest at mid-bay.
    const swell = 0.5 - 0.5 * Math.cos(t * LIFE_BAYS * Math.PI * 2)
    pts.push(
      new THREE.Vector2(
        LIFE_R_STRAP + (LIFE_R_BULGE - LIFE_R_STRAP) * swell,
        (t - 0.5) * LIFE_BARREL
      )
    )
  }
  for (let i = 1; i <= domeSteps; i++) {
    const u = (Math.PI / 2) * (1 - i / domeSteps)
    pts.push(
      new THREE.Vector2(domeR(u), LIFE_BARREL / 2 + LIFE_DOME * Math.cos(u))
    )
  }
  return pts
})()

// A rigid end: the ring the fabric is clamped to, and the plate closing it.
// The forward ring carries the operator's colour, because it is the only band on
// the habitat that runs over rigid structure — you do not paint an ID onto a
// pressure shell that has to fold into a fairing.
function LifeBulkhead({
  x,
  s,
  ring = LIFE_TRIM,
  glow = 0,
}: {
  x: number
  s: number
  ring?: string
  glow?: number
}) {
  return (
    <group>
      <mesh position={[x + s * 0.2, LIFE_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[LIFE_CORE_R, LIFE_CORE_R, 0.4, 28]} />
        <meshStandardMaterial color={LIFE_CORE} roughness={0.55} metalness={0.35} />
      </mesh>
      {/* Clamp ring, standing proud where the softgoods are captured */}
      <mesh position={[x, LIFE_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[LIFE_CORE_R + 0.04, 0.11, 8, 28]} />
        <meshStandardMaterial
          color={ring}
          emissive={ring}
          emissiveIntensity={glow}
          toneMapped={glow === 0}
          roughness={0.5}
          metalness={0.45}
        />
      </mesh>
    </group>
  )
}

// Sierra's answer to the habitat question: launch it folded and inflate it on
// site, trading launch mass for volume. It is the largest pressurized space on
// the base, and it got there in a smaller box than the MPH did.
function SierraLife({ accent }: { accent: string }) {
  const aft = LIFE_X - LIFE_END
  const fwd = LIFE_X + LIFE_END
  return (
    <group scale={LIFE_M}>
      {/* Cradle saddles. The hull settles into them far enough that they read as
          carrying it, which a plank under a round tank does not — and they are
          sized off the CINCH radius, not the bulge: the middle saddle sits under
          a strap, where the hull rides 25 cm higher than it does at a bay. */}
      {[-2.9, -0.8, 1.3].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.39, 0]}>
            <boxGeometry args={[0.5, 0.78, 2.6]} />
            <meshStandardMaterial
              color={LIFE_CRADLE}
              roughness={0.8}
              metalness={0.22}
            />
          </mesh>
          {/* Footings run below grade, as everywhere else on the base: a pad
              resolved exactly at zero lifts clear of any hollow it lands over. */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[x, -0.1, s * 1.05]}>
              <boxGeometry args={[0.8, 0.5, 0.7]} />
              <meshStandardMaterial
                color={LIFE_CRADLE}
                roughness={0.85}
                metalness={0.18}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Softgoods shell */}
      <mesh position={[LIFE_X, LIFE_Y, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <latheGeometry args={[LIFE_PROFILE, 48]} />
        <meshStandardMaterial color={LIFE_SOFT} roughness={0.9} metalness={0.03} />
      </mesh>

      {/* Hoop straps, one at every cinch */}
      {Array.from({ length: LIFE_BAYS + 1 }, (_, i) => (
        <mesh
          key={i}
          position={[LIFE_X + (i / LIFE_BAYS - 0.5) * LIFE_BARREL, LIFE_Y, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <torusGeometry args={[LIFE_R_STRAP + 0.03, 0.1, 8, 44]} />
          <meshStandardMaterial color={LIFE_STRAP} roughness={0.85} metalness={0.08} />
        </mesh>
      ))}

      <LifeBulkhead x={aft} s={-1} />
      <LifeBulkhead x={fwd} s={1} ring={accent} glow={0.55} />

      {/* Berthing port on the aft bulkhead */}
      <mesh position={[aft - 0.6, LIFE_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.72, 0.72, 0.4, 20]} />
        <meshStandardMaterial color={LIFE_TRIM} roughness={0.5} metalness={0.5} />
      </mesh>

      {/* Radiators on standoffs over both shoulders (see LIFE_RAD_R) */}
      {[-1, 1].map((s) => {
        const y = LIFE_Y + LIFE_RAD_R * Math.sin(LIFE_RAD_EL)
        const z = s * LIFE_RAD_R * Math.cos(LIFE_RAD_EL)
        const footY = LIFE_Y + (LIFE_R_STRAP + 0.05) * Math.sin(LIFE_RAD_EL)
        const footZ = s * (LIFE_R_STRAP + 0.05) * Math.cos(LIFE_RAD_EL)
        return (
          <group key={s}>
            <group position={[LIFE_X, y, z]} rotation={[s * (Math.PI / 2 - LIFE_RAD_EL), 0, 0]}>
              <mesh>
                <boxGeometry args={[3.4, 0.07, 1.4]} />
                <meshStandardMaterial color={MPH_RAD} roughness={0.42} metalness={0.24} />
              </mesh>
              {Array.from({ length: 6 }, (_, i) => (
                <mesh key={i} position={[3.4 * (i / 5 - 0.5) * 0.84, 0.055, 0]}>
                  <boxGeometry args={[0.05, 0.04, 1.28]} />
                  <meshStandardMaterial color={LIFE_STRAP} roughness={0.5} metalness={0.3} />
                </mesh>
              ))}
            </group>
            {[-1.3, 1.3].map((dx) => (
              <Strut
                key={dx}
                from={[LIFE_X + dx, y, z]}
                to={[LIFE_X + dx, footY, footZ]}
                r={0.06}
                color={LIFE_TRIM}
              />
            ))}
          </group>
        )
      })}

      {/* Vestibule, canted down off the forward bulkhead (see LIFE_VEST_X) */}
      <Strut
        from={[fwd + 0.1, 3.2, 0]}
        to={[LIFE_VEST_X, LIFE_VEST_Y, 0]}
        r={LIFE_VEST_R}
        color={LIFE_CORE}
        seg={22}
      />
      <mesh position={[LIFE_VEST_X, LIFE_VEST_Y, 0]}>
        <sphereGeometry args={[LIFE_VEST_R, 24, 16]} />
        <meshStandardMaterial color={LIFE_CORE} roughness={0.55} metalness={0.35} />
      </mesh>

      {/* Hatch, sunk into the dome the way the MPH's is sunk into its tower */}
      <mesh
        position={[LIFE_VEST_X, LIFE_VEST_Y, LIFE_VEST_R - 0.15]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.5, 0.5, 0.4, 22]} />
        <meshStandardMaterial color={LIFE_TRIM} roughness={0.55} metalness={0.42} />
      </mesh>
      <mesh
        position={[LIFE_VEST_X, LIFE_VEST_Y, LIFE_VEST_R + 0.08]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.42, 0.42, 0.06, 22]} />
        <meshStandardMaterial color={DARK} roughness={0.6} metalness={0.35} />
      </mesh>
      <mesh
        position={[LIFE_VEST_X, LIFE_VEST_Y + 0.09, LIFE_VEST_R + 0.12]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.13, 0.13, 0.04, 16]} />
        <meshStandardMaterial
          color={WINDOW}
          emissive={WINDOW}
          emissiveIntensity={1.1}
          toneMapped={false}
        />
      </mesh>

      {/* Three steps to grade, and the rails beside them */}
      {Array.from({ length: 3 }, (_, i) => (
        <mesh
          key={i}
          position={[LIFE_VEST_X, 0.98 - i * 0.33, 1.5 + i * 0.5]}
        >
          <boxGeometry args={[1.3, 0.09, i === 0 ? 0.7 : 0.6]} />
          <meshStandardMaterial color={LIFE_CRADLE} roughness={0.82} metalness={0.2} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <Strut
          key={s}
          from={[LIFE_VEST_X + s * 0.6, 1.86, 1.3]}
          to={[LIFE_VEST_X + s * 0.6, 0.98, 2.85]}
          r={0.05}
          color={LIFE_TRIM}
        />
      ))}

      {/* Grid feed. Unlike the MPH this one does not land with an array — the
          softgoods buy volume, not power, and it is plugged into the base. */}
      <mesh position={[aft - 0.35, 0.45, -1.5]}>
        <boxGeometry args={[0.9, 0.9, 0.7]} />
        <meshStandardMaterial color={LIFE_TRIM} roughness={0.6} metalness={0.4} />
      </mesh>
      <Strut
        from={[aft - 0.35, 0.85, -1.5]}
        to={[aft + 0.15, 2.9, -1.1]}
        r={0.08}
        color={LIFE_STRAP}
      />

      {/* The two lights that mark the hatch after dark, set INTO the dome — at
          this radius a light placed on the tube's flank instead hangs 14 cm off
          a surface that curves away underneath it. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[LIFE_VEST_X + s * 0.56, 1.96, 0.72]}>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.5}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Lunar Cruiser — JAXA / Toyota pressurized rover
// ---------------------------------------------------------------------------

const CRUISER_M = UNIT_MAX_DIM / (PROJECT_SIZE_M['jaxa-lunar-cruiser'] ?? 6.6)

const CRU_BODY = '#eceff3' // white bodywork
const CRU_SHADE = '#aeb4bd' // lower body, wheel arches
const CRU_TRIM = '#3c424b' // frames, roof rack, hatch surrounds
const CRU_GLASS = '#16222f' // the big raked screens

const CRU_WHEEL_R = 0.72
const CRU_WHEEL_W = 0.52
const CRU_FLOOR = 1.32 // cabin floor
const CRU_ROOF = 3.34

function CruiserWheel({ x, z }: { x: number; z: number }) {
  const face = Math.sign(z) * (CRU_WHEEL_W / 2 + 0.015)
  return (
    <group position={[x, CRU_WHEEL_R, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[CRU_WHEEL_R, CRU_WHEEL_R, CRU_WHEEL_W, 20]} />
        <meshStandardMaterial color="#20242a" roughness={0.93} />
      </mesh>
      {/* Wire-mesh look: a pair of shoulder rings instead of a tread pattern,
          which at this size would cost more than the cabin and read as a band. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, (s * CRU_WHEEL_W) / 2.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[CRU_WHEEL_R - 0.04, 0.05, 6, 20]} />
          <meshStandardMaterial color="#2b3037" roughness={0.88} metalness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, face, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.05, 14]} />
        <meshStandardMaterial color={CRU_SHADE} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, face + 0.03, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.07, 10]} />
        <meshStandardMaterial color={CRU_TRIM} metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  )
}

// Japan's contribution to Artemis and the first thing crews will actually live
// in: a pressurized rover carrying two people unsuited for about a month, with
// suitports at the back so they can step outside without cycling the cabin.
function CruiserRover({ accent }: { accent: string }) {
  const axles = [-2.05, 0, 2.05]
  return (
    <group scale={CRUISER_M}>
      {axles.map((x) =>
        [-1, 1].map((s) => (
          <group key={`${x}:${s}`}>
            <CruiserWheel x={x} z={s * 1.62} />
            {/* Arch over each wheel, wide enough to clear it in travel */}
            <mesh position={[x, CRU_WHEEL_R, s * 1.62]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry
                args={[
                  CRU_WHEEL_R + 0.14,
                  CRU_WHEEL_R + 0.14,
                  CRU_WHEEL_W + 0.2,
                  20,
                  1,
                  true,
                  Math.PI * 0.56,
                  Math.PI * 0.88,
                ]}
              />
              <meshStandardMaterial
                color={CRU_SHADE}
                roughness={0.55}
                metalness={0.3}
                side={THREE.DoubleSide}
              />
            </mesh>
            <Strut
              from={[x, 1.18, s * 0.95]}
              to={[x, CRU_WHEEL_R + 0.1, s * 1.42]}
              r={0.09}
              color={CRU_TRIM}
            />
          </group>
        ))
      )}

      {/* Chassis deck */}
      <mesh position={[0, 1.12, 0]}>
        <boxGeometry args={[5.0, 0.34, 2.5]} />
        <meshStandardMaterial color={CRU_TRIM} roughness={0.6} metalness={0.4} />
      </mesh>

      {/* Cabin. Two boxes rather than one: the lower body is inset and darker,
          so the greenhouse above it reads as glazing on a shoulder line instead
          of a single slab. */}
      <mesh position={[-0.1, CRU_FLOOR + 0.5, 0]}>
        <boxGeometry args={[4.7, 1.0, 2.64]} />
        <meshStandardMaterial color={CRU_SHADE} roughness={0.55} metalness={0.28} />
      </mesh>
      <mesh position={[-0.1, CRU_FLOOR + 1.5, 0]}>
        <boxGeometry args={[4.62, 1.02, 2.56]} />
        <meshStandardMaterial color={CRU_BODY} roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[-0.1, CRU_ROOF, 0]}>
        <boxGeometry args={[4.74, 0.16, 2.7]} />
        <meshStandardMaterial color={CRU_BODY} roughness={0.5} metalness={0.2} />
      </mesh>

      {/* The signature of the thing: a wraparound screen across the front */}
      <mesh position={[2.28, CRU_FLOOR + 1.48, 0]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.1, 1.16, 2.36]} />
        <meshStandardMaterial
          color={CRU_GLASS}
          roughness={0.14}
          metalness={0.55}
          envMapIntensity={1.5}
        />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[1.7, CRU_FLOOR + 1.48, s * 1.24]}>
          <boxGeometry args={[1.1, 1.0, 0.1]} />
          <meshStandardMaterial
            color={CRU_GLASS}
            roughness={0.14}
            metalness={0.55}
            envMapIntensity={1.5}
          />
        </mesh>
      ))}
      {[-0.55, 0.6].map((x) =>
        [-1, 1].map((s) => (
          <mesh key={`${x}:${s}`} position={[x, CRU_FLOOR + 1.5, s * 1.24]}>
            <boxGeometry args={[0.72, 0.7, 0.1]} />
            <meshStandardMaterial
              color={CRU_GLASS}
              roughness={0.16}
              metalness={0.5}
              envMapIntensity={1.4}
            />
          </mesh>
        ))
      )}
      {/* Pillars between the panes, so the glazing reads as separate windows */}
      {[1.15, 0.05, -1.15].map((x) =>
        [-1, 1].map((s) => (
          <mesh key={`${x}:${s}`} position={[x, CRU_FLOOR + 1.5, s * 1.3]}>
            <boxGeometry args={[0.11, 1.04, 0.05]} />
            <meshStandardMaterial color={CRU_TRIM} roughness={0.5} metalness={0.4} />
          </mesh>
        ))
      )}

      {/* Suitports aft: crews back into the suits and leave them outside */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[-2.46, CRU_FLOOR + 0.72, s * 0.66]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.5, 0.5, 0.16, 20]} />
            <meshStandardMaterial color={CRU_TRIM} roughness={0.5} metalness={0.45} />
          </mesh>
          <mesh position={[-2.55, CRU_FLOOR + 0.72, s * 0.66]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.4, 0.4, 0.07, 20]} />
            <meshStandardMaterial color={HULL_DARK} roughness={0.6} metalness={0.3} />
          </mesh>
        </group>
      ))}
      <Strut from={[-2.62, 0.3, 0]} to={[-2.62, CRU_FLOOR + 0.4, 0]} r={0.05} color={CRU_TRIM} />

      {/* Roof: array, dish, and the light bar over the screen */}
      {[-1.35, -0.15, 1.05].map((x) => (
        <mesh key={x} position={[x, CRU_ROOF + 0.15, 0]}>
          <boxGeometry args={[1.02, 0.06, 2.3]} />
          <meshStandardMaterial color={PANEL} roughness={0.44} metalness={0.12} />
        </mesh>
      ))}
      <mesh position={[-1.9, CRU_ROOF + 0.34, 0.78]} rotation={[0.5, 0, 0]}>
        <sphereGeometry args={[0.44, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
        <meshStandardMaterial
          color={HULL}
          side={THREE.DoubleSide}
          roughness={0.4}
          metalness={0.35}
        />
      </mesh>
      <Strut from={[-1.9, CRU_ROOF + 0.1, 0.78]} to={[-1.9, CRU_ROOF + 0.34, 0.78]} r={0.05} />
      <mesh position={[2.1, CRU_ROOF + 0.16, 0]}>
        <boxGeometry args={[0.32, 0.18, 1.9]} />
        <meshStandardMaterial color={CRU_TRIM} roughness={0.5} metalness={0.4} />
      </mesh>
      {[-0.66, 0, 0.66].map((z) => (
        <mesh key={z} position={[2.24, CRU_ROOF + 0.16, z]}>
          <sphereGeometry args={[0.11, 10, 10]} />
          <meshStandardMaterial
            color="#fff6de"
            emissive="#fff6de"
            emissiveIntensity={2.1}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Bumper and the operator's stripe down the flank */}
      <Strut from={[2.62, 0.98, -1.28]} to={[2.62, 0.98, 1.28]} r={0.1} color={CRU_TRIM} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[-0.1, CRU_FLOOR + 0.98, s * 1.33]}>
          <boxGeometry args={[4.5, 0.1, 0.04]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.5}
            toneMapped={false}
            roughness={0.5}
          />
        </mesh>
      ))}
      <mesh position={[-2.6, CRU_ROOF + 0.3, 0]}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.8}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Comms & navigation ground terminal
// ---------------------------------------------------------------------------

const TERM_M = UNIT_MAX_DIM / (TYPE_SIZE_M.comms_pnt ?? 15)

const TERM_DISH = '#e8ebf0'
const TERM_TRIM = '#5a616b'
const TERM_SHELTER = '#dfe3e9'

const TERM_DISH_X = -4.2
const TERM_DISH_R = 2.7
const TERM_PIVOT = 3.1 // elevation axis height

// A steerable dish on an alt-az mount. The reflector is a shallow spherical cap
// rather than a true paraboloid — at this scale the sag difference is under a
// centimetre, and a cap costs one geometry instead of a lathe.
function TerminalDish({ accent }: { accent: string }) {
  return (
    <group position={[TERM_DISH_X, 0, 0]}>
      {/* Pedestal truss down to four pads, set below grade so the mount stays
          planted on ground that isn't flat. */}
      {[
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].map(([sx, sz]) => (
        <group key={`${sx}:${sz}`}>
          <Strut
            from={[sx * 0.42, TERM_PIVOT - 0.9, sz * 0.42]}
            to={[sx * 1.35, -0.4, sz * 1.35]}
            r={0.11}
            color={TERM_TRIM}
          />
          <mesh position={[sx * 1.35, -0.2, sz * 1.35]}>
            <cylinderGeometry args={[0.4, 0.32, 0.8, 12]} />
            <meshStandardMaterial color={HULL_DARK} roughness={0.85} metalness={0.2} />
          </mesh>
        </group>
      ))}
      {[
        [-1, 1],
        [1, -1],
      ].map(([sx, sz]) => (
        <Strut
          key={`${sx}:${sz}`}
          from={[sx * 1.2, 0.55, sz * 1.2]}
          to={[-sx * 1.2, 0.55, -sz * 1.2]}
          r={0.055}
          color={TERM_TRIM}
        />
      ))}

      {/* Azimuth drum and the yoke the reflector hangs in */}
      <mesh position={[0, TERM_PIVOT - 1.15, 0]}>
        <cylinderGeometry args={[0.62, 0.72, 0.9, 18]} />
        <meshStandardMaterial color={TERM_TRIM} roughness={0.5} metalness={0.5} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, TERM_PIVOT - 0.35, s * 0.78]}>
          <boxGeometry args={[0.34, 1.1, 0.22]} />
          <meshStandardMaterial color={TERM_TRIM} roughness={0.5} metalness={0.5} />
        </mesh>
      ))}

      {/* Reflector, tipped up at the sky the way a polar station's has to be —
          Earth sits on the horizon from here and never moves. */}
      <group position={[0, TERM_PIVOT, 0]} rotation={[-0.62, 0, 0]}>
        <mesh>
          <sphereGeometry
            args={[TERM_DISH_R * 1.55, 40, 20, 0, Math.PI * 2, 0, Math.PI / 4.4]}
          />
          <meshStandardMaterial
            color={TERM_DISH}
            side={THREE.DoubleSide}
            roughness={0.34}
            metalness={0.34}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.92, 0]}>
          <torusGeometry args={[TERM_DISH_R * 0.99, 0.07, 8, 48]} />
          <meshStandardMaterial color={TERM_TRIM} roughness={0.5} metalness={0.5} />
        </mesh>
        {/* Backing ribs, so the dish has structure when seen from behind */}
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI
          return (
            <Strut
              key={i}
              from={[Math.cos(a) * TERM_DISH_R * 0.95, 0.55, Math.sin(a) * TERM_DISH_R * 0.95]}
              to={[-Math.cos(a) * TERM_DISH_R * 0.95, 0.55, -Math.sin(a) * TERM_DISH_R * 0.95]}
              r={0.05}
              color={HULL_DARK}
            />
          )
        })}
        {/* Feed on its tripod at the focus */}
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2
          return (
            <Strut
              key={i}
              from={[Math.cos(a) * TERM_DISH_R * 0.8, 0.86, Math.sin(a) * TERM_DISH_R * 0.8]}
              to={[0, 2.5, 0]}
              r={0.045}
              color={HULL_DARK}
            />
          )
        })}
        <mesh position={[0, 2.42, 0]}>
          <cylinderGeometry args={[0.24, 0.3, 0.5, 14]} />
          <meshStandardMaterial color={TERM_TRIM} roughness={0.45} metalness={0.55} />
        </mesh>
        <mesh position={[0, 2.14, 0]}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  )
}

// The ground segment for whichever relay service wins: a steerable high-gain
// dish for the link home, a lattice mast carrying the surface network's
// omnis and a laser head, and a shelter of avionics between them.
function CommsPnt({ accent }: { accent: string }) {
  return (
    <group scale={TERM_M}>
      <TerminalDish accent={accent} />

      {/* Lattice mast. The surface radios live up here, clear of the structures
          that would otherwise cut the horizon. */}
      <group position={[0.4, 0, -0.6]}>
        {[
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ].map(([sx, sz]) => (
          <Strut
            key={`${sx}:${sz}`}
            from={[sx * 0.52, -0.3, sz * 0.52]}
            to={[sx * 0.16, 6.0, sz * 0.16]}
            r={0.055}
            color={TERM_TRIM}
          />
        ))}
        {[0.9, 2.0, 3.1, 4.2, 5.3].map((y) => {
          const t = 0.52 - (y / 6.0) * 0.36
          return (
            <group key={y}>
              {[
                [-1, -1, 1, -1],
                [1, -1, 1, 1],
                [1, 1, -1, 1],
                [-1, 1, -1, -1],
              ].map(([ax, az, bx, bz], i) => (
                <Strut
                  key={i}
                  from={[ax * t, y, az * t]}
                  to={[bx * t, y, bz * t]}
                  r={0.035}
                  color={TERM_TRIM}
                />
              ))}
            </group>
          )
        })}
        {/* Omni whips and the optical head */}
        {[-1, 1].map((s) => (
          <Strut
            key={s}
            from={[s * 0.16, 6.0, 0]}
            to={[s * 0.5, 7.0, 0]}
            r={0.028}
            color={HULL_DARK}
          />
        ))}
        <mesh position={[0, 6.28, 0]}>
          <boxGeometry args={[0.42, 0.42, 0.42]} />
          <meshStandardMaterial color={TERM_TRIM} roughness={0.45} metalness={0.55} />
        </mesh>
        <mesh position={[0, 6.28, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.14, 14]} />
          <meshStandardMaterial
            color="#7fe3ff"
            emissive="#7fe3ff"
            emissiveIntensity={1.8}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Avionics shelter, radiator on the shaded face */}
      <group position={[3.1, 0, 0.5]}>
        <mesh position={[0, 1.0, 0]}>
          <boxGeometry args={[3.0, 1.8, 2.2]} />
          <meshStandardMaterial color={TERM_SHELTER} roughness={0.6} metalness={0.22} />
        </mesh>
        <mesh position={[0, 1.96, 0]}>
          <boxGeometry args={[3.15, 0.14, 2.35]} />
          <meshStandardMaterial color={HULL_DARK} roughness={0.55} metalness={0.3} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[-1.25 + i * 0.36, 1.05, -1.14]}>
            <boxGeometry args={[0.1, 1.4, 0.09]} />
            <meshStandardMaterial color={MPH_RAD} roughness={0.42} metalness={0.28} />
          </mesh>
        ))}
        <mesh position={[0, 0.85, 1.12]}>
          <boxGeometry args={[0.85, 1.3, 0.08]} />
          <meshStandardMaterial color={TERM_TRIM} roughness={0.5} metalness={0.45} />
        </mesh>
        <mesh position={[-1.05, 1.72, 1.12]}>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
        {/* Skids, sunk like every other foot on the base */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, -0.05, s * 0.85]}>
            <boxGeometry args={[3.1, 0.5, 0.28]} />
            <meshStandardMaterial color={TERM_TRIM} roughness={0.7} metalness={0.3} />
          </mesh>
        ))}
      </group>

      {/* Array on the sunward side */}
      <group position={[6.0, 0, -0.4]}>
        {[-1, 1].map((s) => (
          <Strut
            key={s}
            from={[0.55, 0.0, s * 1.4]}
            to={[-0.5, 1.25, s * 1.4]}
            r={0.06}
            color={TERM_TRIM}
          />
        ))}
        <mesh position={[0, 0.85, 0]} rotation={[0, 0, 0.78]}>
          <boxGeometry args={[1.7, 0.07, 3.3]} />
          <meshStandardMaterial color={PANEL} roughness={0.44} metalness={0.12} />
        </mesh>
        {Array.from({ length: 3 }, (_, i) => (
          <mesh key={i} position={[0, 0.85, -0.85 + i * 0.85]} rotation={[0, 0, 0.78]}>
            <boxGeometry args={[1.72, 0.075, 0.04]} />
            <meshStandardMaterial color={HULL_DARK} roughness={0.5} metalness={0.4} />
          </mesh>
        ))}
      </group>

      {/* Cable tray from the shelter out to the mount */}
      <Strut
        from={[1.9, 0.28, 0.3]}
        to={[TERM_DISH_X + 1.2, 0.28, 0.3]}
        r={0.07}
        color={HULL_DARK}
      />

      {/* Perimeter markers, as on every other worked plot here */}
      {[
        [-7.0, 3.0],
        [7.2, 2.6],
        [-6.0, -3.2],
        [6.6, -2.8],
      ].map(([x, z]) => (
        <group key={`${x}:${z}`}>
          <Strut from={[x, -0.2, z]} to={[x, 0.75, z]} r={0.045} color={TERM_TRIM} />
          <mesh position={[x, 0.84, z]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* Tech doing rounds along the fence line, clear of the mast and shelter */}
      <PatrollingAstronaut center={[-5.0, -2.3]} radius={1.3} seed={8} accent={accent} />

      {/* A reel of network cable behind the shelter (clear of its cable tray,
          which runs out the front at z=0.3) and a spares pallet on the open
          side away from the tech's own rounds. */}
      <group position={[4.0, 0, -2.0]}>
        <CableReel />
      </group>
      <group position={[-2.0, 0, 3.2]} rotation={[0, 1.4, 0]}>
        <CargoPallet hard seed={8} />
      </group>
      {/* A long equipment case for spare antenna elements — the shape
          instrument/antenna shipments actually take, not another cube — and
          the junction box the shelter's own feed terminates in. */}
      <group position={[3.4, 0, 2.6]} rotation={[0, 0.3, 0]}>
        <CargoCrate variant="case" seed={8} />
      </group>
      <group position={[-4.0, 0, 0.6]}>
        <JunctionBox />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// IM Near Space Network ground terminal
// ---------------------------------------------------------------------------

// Dish rim to the far corner of the equipment box — see
// PROJECT_SIZE_M['im-near-space-network']. IM's real hardware is the relay
// constellation itself (RelaySat, ×3 stations, flying via SKY_STATIONS); the
// south-pole side of the service is a single sealed avionics package with its
// own dish on top, the kind of self-contained CLPS-class payload that rides
// down as one unit rather than an agency building out a mast-and-shelter
// site. Smaller than the generic CommsPnt lot Nokia still stands on, bigger
// than ESA's and Crescent's minimal customer terminals — IM operates the
// network rather than merely subscribing to one.
const RTM_M = UNIT_MAX_DIM / (PROJECT_SIZE_M['im-near-space-network'] ?? 3.4)

// Aluminized MLI over the box — the finish on almost every flown avionics
// package, and a deliberately different material story from the comms
// district's other three: Nokia's lattice mast is bare structure, ESA's and
// Crescent's masts are painted composite, this is the one thing in the
// district that reads as "just landed and still wrapped."
const RTM_FOIL = '#c9ccd2'
const RTM_FOIL_SEAM = '#8d919a'
const RTM_TRIM = '#33373f'
const RTM_DISH = '#eceef2'
// Intuitive Machines' brand orange — one stenciled placard on the box rather
// than a paint job, the same restraint every operator mark on this map gets.
const RTM_ORANGE = '#F97316'

const RTM_BOX_L = 1.7
const RTM_BOX_W = 1.05
const RTM_BOX_H = 0.82
const RTM_PALLET_H = 0.16
const RTM_DISH_R = 0.82

// The equipment box: a foil-wrapped avionics package on a flight pallet, feet
// still on it rather than bolted down — this unit is meant to read as
// delivered hardware, not a built site.
function RelayTermBox({ accent }: { accent: string }) {
  return (
    <group>
      {/* Pallet and its tie-down feet, sunk slightly like every other footing
          on this map. */}
      <mesh position={[0, RTM_PALLET_H / 2, 0]}>
        <boxGeometry args={[RTM_BOX_L + 0.18, RTM_PALLET_H, RTM_BOX_W + 0.18]} />
        <meshStandardMaterial color={RTM_TRIM} roughness={0.6} metalness={0.4} />
      </mesh>
      {[
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].map(([sx, sz]) => (
        <mesh
          key={`${sx}:${sz}`}
          position={[
            (sx * (RTM_BOX_L - 0.1)) / 2,
            -0.05,
            (sz * (RTM_BOX_W - 0.1)) / 2,
          ]}
        >
          <cylinderGeometry args={[0.08, 0.1, 0.22, 10]} />
          <meshStandardMaterial color={RTM_TRIM} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}

      {/* The box itself, foil over a plain rectangular volume */}
      <mesh position={[0, RTM_PALLET_H + RTM_BOX_H / 2, 0]}>
        <boxGeometry args={[RTM_BOX_L, RTM_BOX_H, RTM_BOX_W]} />
        <meshStandardMaterial color={RTM_FOIL} roughness={0.55} metalness={0.3} />
      </mesh>
      {/* Seam tape, stood proud so it doesn't strobe against the foil */}
      {[-0.5, 0, 0.5].map((t) => (
        <mesh
          key={t}
          position={[
            RTM_BOX_L * t,
            RTM_PALLET_H + RTM_BOX_H / 2,
            0,
          ]}
        >
          <boxGeometry args={[0.04, RTM_BOX_H + 0.01, RTM_BOX_W + 0.01]} />
          <meshStandardMaterial color={RTM_FOIL_SEAM} roughness={0.6} metalness={0.2} />
        </mesh>
      ))}

      {/* Connector face: a dark plate, two cable stubs, and the three status
          lights the reference hardware always carries. */}
      <mesh
        position={[RTM_BOX_L * 0.36, RTM_PALLET_H + RTM_BOX_H * 0.62, RTM_BOX_W / 2 + 0.005]}
      >
        <boxGeometry args={[0.5, 0.34, 0.02]} />
        <meshStandardMaterial color={RTM_TRIM} roughness={0.5} metalness={0.5} />
      </mesh>
      {[-1, 1].map((s) => (
        <Strut
          key={s}
          from={[RTM_BOX_L * 0.36 + s * 0.12, RTM_PALLET_H + RTM_BOX_H * 0.55, RTM_BOX_W / 2 + 0.02]}
          to={[RTM_BOX_L * 0.36 + s * 0.12, RTM_PALLET_H + RTM_BOX_H * 0.3, RTM_BOX_W / 2 + 0.3]}
          r={0.025}
          color={RTM_TRIM}
        />
      ))}
      {[-1, 0, 1].map((s, i) => (
        <mesh
          key={s}
          position={[
            RTM_BOX_L * 0.2 + s * 0.09,
            RTM_PALLET_H + RTM_BOX_H * 0.78,
            RTM_BOX_W / 2 + 0.01,
          ]}
        >
          <circleGeometry args={[0.025, 10]} />
          <meshStandardMaterial
            color={i === 1 ? accent : RTM_ORANGE}
            emissive={i === 1 ? accent : RTM_ORANGE}
            emissiveIntensity={1.6}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Operator's placard, the one brand note on the box */}
      <mesh
        position={[-RTM_BOX_L * 0.28, RTM_PALLET_H + RTM_BOX_H * 0.5, RTM_BOX_W / 2 + 0.01]}
      >
        <planeGeometry args={[0.4, 0.16]} />
        <meshStandardMaterial color={RTM_ORANGE} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// A single steerable dish on a short gimbal mounted directly to the box top —
// the whole point of a sealed package is that nothing about it is built up
// from the ground the way TerminalDish's pedestal truss is.
function RelayTermDish({ accent }: { accent: string }) {
  const baseY = RTM_PALLET_H + RTM_BOX_H
  return (
    <group position={[-RTM_BOX_L * 0.12, baseY, 0]}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.2, 14]} />
        <meshStandardMaterial color={RTM_TRIM} roughness={0.5} metalness={0.5} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.32, s * 0.15]}>
          <boxGeometry args={[0.1, 0.32, 0.08]} />
          <meshStandardMaterial color={RTM_TRIM} roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      {/* Reflector, tipped up the way a polar station's has to be (see
          TerminalDish above) */}
      <group position={[0, 0.42, 0]} rotation={[-0.62, 0, 0]}>
        <mesh>
          <sphereGeometry
            args={[RTM_DISH_R * 1.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 4.4]}
          />
          <meshStandardMaterial
            color={RTM_DISH}
            side={THREE.DoubleSide}
            roughness={0.32}
            metalness={0.32}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.28, 0]}>
          <torusGeometry args={[RTM_DISH_R * 0.98, 0.03, 6, 36]} />
          <meshStandardMaterial color={RTM_TRIM} roughness={0.5} metalness={0.5} />
        </mesh>
        {/* Feed, integrated on a single stalk rather than a tripod — this
            reflector is a fraction of TerminalDish's size, and three struts at
            this scale would be thinner than they are long. */}
        <Strut from={[0, 0.16, 0]} to={[0, 0.72, 0]} r={0.025} color={RTM_TRIM} />
        <mesh position={[0, 0.74, 0]}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  )
}

// IM's ground segment: one foil-wrapped avionics package on a flight pallet
// with its own dish gimballed straight onto the lid — a delivered unit, not a
// built site, because the constellation (RelaySat) is where IM's actual
// infrastructure is.
function RelayGroundTerminal({ accent }: { accent: string }) {
  return (
    <group scale={RTM_M}>
      <RelayTermBox accent={accent} />
      <RelayTermDish accent={accent} />

      {/* Perimeter markers, as on every other worked plot here */}
      {[
        [-1.2, 0.9],
        [1.3, 0.85],
        [-1.0, -0.95],
      ].map(([x, z]) => (
        <group key={`${x}:${z}`}>
          <Strut from={[x, -0.15, z]} to={[x, 0.4, z]} r={0.025} color={RTM_TRIM} />
          <mesh position={[x, 0.46, z]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// ESA Moonlight ground terminal
// ---------------------------------------------------------------------------

// Mast foot to the antenna head — see PROJECT_SIZE_M['esa-lunar-pathfinder'].
// Deliberately the smallest lot in the comms district: Moonlight is sold as a
// SERVICE off a relay in orbit, and the "ground segment" a customer mission
// actually needs is the small UHF/S-band user terminal SSTL ship with the
// subscription — not an agency-built site the way the other three comms bids
// stand up. That absence is the argument this model makes.
const PATH_TERM_M =
  UNIT_MAX_DIM / (PROJECT_SIZE_M['esa-lunar-pathfinder'] ?? 2.6)

const PATH_TERM_HEAD_H = 1.9 // mast foot to the antenna head

function PathfinderTerminal({ accent }: { accent: string }) {
  return (
    <group scale={PATH_TERM_M}>
      {/* Guy anchors, driven in below grade like every other footing here */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.3
        const x = Math.cos(a) * 1.0
        const z = Math.sin(a) * 1.0
        return (
          <group key={i}>
            <Strut
              from={[x, -0.06, z]}
              to={[0, PATH_TERM_HEAD_H * 0.55, 0]}
              r={0.018}
              color={TERM_TRIM}
            />
            <mesh position={[x, -0.03, z]}>
              <cylinderGeometry args={[0.08, 0.1, 0.1, 8]} />
              <meshStandardMaterial color={HULL_DARK} roughness={0.85} metalness={0.15} />
            </mesh>
          </group>
        )
      })}

      {/* Mast */}
      <Strut
        from={[0, -0.05, 0]}
        to={[0, PATH_TERM_HEAD_H, 0]}
        r={0.045}
        color={TERM_TRIM}
      />

      {/* Avionics box at the foot — the one box a customer mission actually
          flies to use the service. */}
      <mesh position={[0.32, 0.24, -0.08]}>
        <boxGeometry args={[0.46, 0.48, 0.36]} />
        <meshStandardMaterial color={TERM_SHELTER} roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0.32, 0.01, -0.08]}>
        <boxGeometry args={[0.5, 0.05, 0.4]} />
        <meshStandardMaterial color={TERM_TRIM} roughness={0.7} metalness={0.3} />
      </mesh>

      {/* Fixed panel — standing upright across the sun's bearing, the same
          rule every array on this base follows at 89°S. */}
      <group position={[0.32, 0.64, -0.08]} rotation={[0, 0, -0.16]}>
        <Strut from={[0, -0.4, 0]} to={[0, 0.4, 0]} r={0.02} color={TERM_TRIM} />
        <mesh>
          <boxGeometry args={[0.5, 0.8, 0.04]} />
          <meshStandardMaterial color={PANEL} roughness={0.44} metalness={0.12} />
        </mesh>
        <mesh position={[0, 0, 0.025]}>
          <boxGeometry args={[0.52, 0.03, 0.012]} />
          <meshStandardMaterial color={PANEL_EDGE} roughness={0.5} metalness={0.4} />
        </mesh>
      </group>

      {/* Antenna head — a small helix under a radome, echoing the back-fire
          helix Pathfinder itself flies. Tipped closer to zenith than the
          Earth-facing dishes elsewhere in this district: the frozen orbit's
          long dwell keeps Pathfinder nearly overhead the pole rather than
          sitting near the horizon the way Earth does. */}
      <group position={[0, PATH_TERM_HEAD_H, 0]} rotation={[-0.35, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.065, 0.08, 0.22, 10]} />
          <meshStandardMaterial color={TERM_TRIM} roughness={0.5} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <sphereGeometry args={[0.075, 12, 10]} />
          <meshStandardMaterial color={TERM_SHELTER} roughness={0.4} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0.27, 0]}>
          <sphereGeometry args={[0.032, 8, 8]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Crescent Parsec ground terminal
// ---------------------------------------------------------------------------

// Case foot to the solar panel's top corner — see
// PROJECT_SIZE_M['crescent-parsec']. The smallest MODEL in the district by
// raw size (2.0 m vs. ESA's 2.6 m), rebuilt as a sealed case on point feet
// rather than a bare mast: ground support equipment for a commodity smallsat
// network photographs as one avionics box with hinged doors and a connector
// face, a solar panel racked up steeply on its own bracket to catch the low
// polar sun, and a small sensor head — not a shelter or a dish mast. Its
// ground FOOTPRINT (see FOOTPRINT_FRACTION below) is actually bigger than
// ESA's mast footprint despite the smaller model, because a squat case with
// a panel racked out behind it covers more ground than one point-mast does —
// ESA keeps the smallest-footprint lot in the district, Crescent the
// smallest model. The patch antenna is still fixed to a stub with no gimbal
// at all: a GPS-style receiver doesn't track one satellite, it just needs a
// clear view of the sky, which is the entire argument for starting the
// network at two nodes rather than one. Sized up 2.5x from the first pass at
// this case (which measured a true 0.79 m and all but disappeared next to
// the astronaut companion and its neighboring lots) — proportions unchanged,
// just a bigger case.
const PSEC_TERM_M = UNIT_MAX_DIM / (PROJECT_SIZE_M['crescent-parsec'] ?? 2.0)

const PSEC_CASE_L = 1.4
const PSEC_CASE_W = 1.0
const PSEC_CASE_H = 0.9
const PSEC_FOOT_H = 0.225

function ParsecTerminal({ accent }: { accent: string }) {
  const caseY0 = PSEC_FOOT_H
  const caseY1 = PSEC_FOOT_H + PSEC_CASE_H
  const caseMidY = (caseY0 + caseY1) / 2
  return (
    <group scale={PSEC_TERM_M}>
      {/* Point feet, sunk below grade like every other footing here */}
      {[
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].map(([sx, sz]) => (
        <mesh
          key={`${sx}:${sz}`}
          position={[
            (sx * (PSEC_CASE_L - 0.2)) / 2,
            PSEC_FOOT_H / 2 - 0.075,
            (sz * (PSEC_CASE_W - 0.2)) / 2,
          ]}
        >
          <coneGeometry args={[0.1, PSEC_FOOT_H + 0.15, 8]} />
          <meshStandardMaterial color={TERM_TRIM} roughness={0.75} metalness={0.25} />
        </mesh>
      ))}

      {/* The sealed case itself */}
      <mesh position={[0, caseMidY, 0]}>
        <boxGeometry args={[PSEC_CASE_L, PSEC_CASE_H, PSEC_CASE_W]} />
        <meshStandardMaterial color={TERM_SHELTER} roughness={0.55} metalness={0.25} />
      </mesh>
      {/* Door seam and hinge knuckles on the front face */}
      <mesh position={[0, caseMidY, PSEC_CASE_W / 2 + 0.01]}>
        <boxGeometry args={[0.03, PSEC_CASE_H - 0.075, 0.02]} />
        <meshStandardMaterial color={TERM_TRIM} roughness={0.6} metalness={0.3} />
      </mesh>
      {[-1, 1].map((s) =>
        [-0.275, 0.275].map((dy) => (
          <mesh
            key={`${s}:${dy}`}
            position={[s * (PSEC_CASE_L / 2 - 0.025), caseMidY + dy, PSEC_CASE_W / 2 + 0.015]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.035, 0.035, 0.075, 8]} />
            <meshStandardMaterial color={TERM_TRIM} roughness={0.5} metalness={0.4} />
          </mesh>
        ))
      )}

      {/* Connector face: a dark plate, a row of port studs, and Curio's own
          gold blanket colour on the placard — the one cue that ties the
          ground hardware back to the same product line as the satellites
          overhead. */}
      <mesh
        position={[-PSEC_CASE_L * 0.22, caseY0 + 0.2, PSEC_CASE_W / 2 + 0.0125]}
      >
        <boxGeometry args={[0.5, 0.25, 0.025]} />
        <meshStandardMaterial color={TERM_TRIM} roughness={0.55} metalness={0.35} />
      </mesh>
      {[-0.1875, -0.0625, 0.0625, 0.1875].map((dx) => (
        <mesh
          key={dx}
          position={[
            -PSEC_CASE_L * 0.22 + dx,
            caseY0 + 0.2,
            PSEC_CASE_W / 2 + 0.035,
          ]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.0225, 0.0225, 0.03, 8]} />
          <meshStandardMaterial color={HULL_DARK} roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
      <mesh position={[PSEC_CASE_L * 0.2, caseY0 + 0.2, PSEC_CASE_W / 2 + 0.0125]}>
        <planeGeometry args={[0.3, 0.125]} />
        <meshStandardMaterial color={PSEC_GOLD} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Solar panel, racked up steeply off a bracket at the case's rear edge
          rather than lying flat — the same "stand upright across the sun's
          bearing" rule Pathfinder's fixed panel follows, just on a case
          instead of a mast. */}
      <group position={[0, caseY1, -PSEC_CASE_W * 0.3]} rotation={[-1.15, 0, 0]}>
        <mesh position={[0, 0.075, 0]}>
          <cylinderGeometry args={[0.0625, 0.075, 0.15, 10]} />
          <meshStandardMaterial color={TERM_TRIM} roughness={0.5} metalness={0.5} />
        </mesh>
        <group position={[0, 0.65, 0]}>
          <mesh>
            <boxGeometry args={[0.85, 1.15, 0.05]} />
            <meshStandardMaterial color={PANEL} roughness={0.44} metalness={0.12} />
          </mesh>
          {[-1, 0, 1].map((i) => (
            <mesh key={i} position={[i * 0.25, 0, 0.03]}>
              <boxGeometry args={[0.03, 1.15, 0.015]} />
              <meshStandardMaterial color={PANEL_EDGE} roughness={0.5} metalness={0.4} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Sensor head — a small camera/star-tracker on its own post, forward
          of the panel where it keeps a clear view */}
      <group position={[PSEC_CASE_L * 0.18, caseY1 + 0.05, PSEC_CASE_W * 0.12]}>
        <Strut from={[0, -0.05, 0]} to={[0, 0.15, 0]} r={0.045} color={TERM_TRIM} />
        <mesh position={[0, 0.25, 0]} rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.25, 10]} />
          <meshStandardMaterial color={TERM_SHELTER} roughness={0.45} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.325, 0.1125]} rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.035, 10]} />
          <meshStandardMaterial color={HULL_DARK} roughness={0.3} metalness={0.5} />
        </mesh>
      </group>

      {/* Fixed patch under a small radome — no gimbal, unlike every steerable
          dish elsewhere in this district. It only ever has to look up. */}
      <group position={[-PSEC_CASE_L * 0.12, caseY1 + 0.025, -PSEC_CASE_W * 0.02]}>
        <mesh position={[0, 0.075, 0]}>
          <sphereGeometry args={[0.125, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={PATH_FEED} roughness={0.4} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0.1875, 0]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Buried habitats — cut-and-cover vaults under a regolith cover
// ---------------------------------------------------------------------------
//
// Two competitors in the core race end up under the surface rather than on it;
// lib/lunar-atlas/subplan.ts holds which, why, and every dimension used here.
// This is the geometry, and it is really three models stacked on one plot:
//
//   ABOVE GRADE  the cover mound, an airlock head house part-way down its
//                inward flank, and the radiator wall, PV and vent stacks that
//                a buried habitat CANNOT bury — a radiator needs cold sky and
//                an array needs the sun, so the thermal and power hardware
//                stays up while only the pressure shell goes down. This is the
//                part that is always on screen, and it is the click target.
//   THE VAULT    liner, floor, ribs and work lighting, drawn DOUBLE-SIDED so
//                the same geometry reads from inside on the cutaway view (see
//                subViewFraming) and from outside for anything that gets under
//                the terrain another way.
//   THE MODULE   the competitor's own pressure shell, on its cradles, with the
//                radiators and arrays stripped off it and moved to the crest.
//
// Nothing has to be hidden or toggled to make this work. From above, the mound
// is solid opaque geometry covering the whole vault in plan, so it occludes
// everything under it the same way a hill occludes a valley; from below, the
// terrain cap and the roads are front-sided and cull away on their own. The
// only concession anywhere in the scene is the camera floor, which stands down
// while a cutaway is open (see CAMERA_CLEARANCE in MoonGlobe).

const VAULT_LINER = '#8b8780' // cast-regolith intrados, lamp-lit
const VAULT_RIB = '#767b85' // the hoop frame the liner was cast over
const VAULT_DECK = '#9b978d' // laid floor slab
const VAULT_WALK = '#87837a' // the traffic strip worn down the middle of it
const VAULT_LAMP = '#ffe4bd' // work lighting
const COVER = '#a29c92' // heaped, graded cover regolith

// Fill the vault's own lamps throw onto everything in it. The interior sits in
// the mound's shadow — which is correct, and is why it needs this at all: the
// scene's fill is nearly nothing (see the airless-fill note in MoonGlobe), so
// without a lit look every surface down here renders as a black hole. Applied
// as emissive rather than as real lights on purpose: point lights are global to
// the renderer, and two vaults' worth of them would be paid for by every lit
// material in the scene, forever, to light two rooms nobody is usually in.
const VAULT_FILL = '#ffd9a8'
const VAULT_FILL_I = 0.17
const VAULT_FILL_DEEP_I = 0.1 // further from the lamps: the floor, the far end

// How far the cover's skirt is bedded BELOW grade, in meters. A skirt that
// stops exactly at grade is coplanar with the ground it stands on, which is the
// z-fight this avoids; a third of a meter of it buried is invisible.
const COVER_BED_M = 0.35

// Liner thickness in meters. Mirrors LINER_M in subplan, which is where the
// packing side of the same number lives.
const LINER_T = 0.5

// The cover's height above grade at a plan position, in meters. Both the mound
// geometry and everything standing on it read their height from this one
// function, so a head house cannot end up floating over its own berm.
//
// The shape is a graded ridge, not a dome: full crest height directly over the
// liner, straight flanks falling at the angle of repose, and both ends tapering
// over the same batter run. `k` is how much of full height this station carries.
function moundRise(g: VaultGeometry, x: number, z: number): number {
  const k = Math.max(
    0,
    Math.min(1, (g.moundHalfLengthM - Math.abs(x)) / g.batterM)
  )
  if (k <= 0) return 0
  const crestHalfZ = (g.moundHalfWidthM - g.batterM) * k
  const toeHalfZ = g.moundHalfWidthM * k
  const az = Math.abs(z)
  if (az <= crestHalfZ) return g.crestM * k
  if (az >= toeHalfZ) return 0
  return g.crestM * k * (1 - (az - crestHalfZ) / (toeHalfZ - crestHalfZ))
}

// Stations along the axis, and samples across it. The across-samples are given
// in SHOULDER units — 0 is the crest line, 1 the shoulder where the flank
// breaks, 2 the toe — and cluster toward the shoulder, which is the only crease
// in the profile and the one place a coarse sample reads as a facet. The last
// sample is past the toe: it carries the skirt that tucks the rim under grade.
const MOUND_NX = 72
const MOUND_SKIRT = 2.06
const MOUND_ACROSS = (() => {
  const half = [
    0, 0.34, 0.68, 0.88, 1, 1.2, 1.45, 1.7, 1.86, 1.96, 2, MOUND_SKIRT,
  ]
  return [...half.slice(1).reverse().map((u) => -u), ...half]
})()

// The cover, as one mesh. Built rather than assembled from primitives because
// the toe outline has to be exactly the plan shape moundRise describes: a
// rectangular sheet of ground-height geometry would lie coplanar with the ground
// wherever the mound isn't, which is the same z-fight COVER_BED_M avoids at the
// skirt.
function coverMoundGeometry(g: VaultGeometry): THREE.BufferGeometry {
  // Fraction of the toe half-width the flat crest reaches. Constant along the
  // whole ridge — both crest and toe scale with the same `k` — which is what
  // lets one normalized sample list serve every station.
  const c = (g.moundHalfWidthM - g.batterM) / g.moundHalfWidthM
  // Shoulder units to a signed fraction of the toe half-width. Folded through
  // |u| so both halves come off the same curve: taking `u` straight put every
  // negative sample on the crest branch, which left the far flank a squashed
  // copy of the near one with its toe hanging out past the plan outline.
  const us = MOUND_ACROSS.map((u) => {
    const au = Math.abs(u)
    return Math.sign(u) * (au <= 1 ? au * c : c + (au - 1) * (1 - c))
  })

  const nz = us.length
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const base = new THREE.Color(COVER)

  for (let i = 0; i <= MOUND_NX; i++) {
    const x = -g.moundHalfLengthM + (2 * g.moundHalfLengthM * i) / MOUND_NX
    const k = Math.max(
      0,
      Math.min(1, (g.moundHalfLengthM - Math.abs(x)) / g.batterM)
    )
    const toe = g.moundHalfWidthM * k
    const rise = g.crestM * k
    for (let j = 0; j < nz; j++) {
      const v = us[j]
      const av = Math.abs(v)
      // The profile meets grade exactly at the toe; the one sample beyond it
      // carries the rim down under the ground, so the mound's edge is never
      // coplanar with the ground it stands on.
      const y =
        av > 1 ? -COVER_BED_M : rise * (av <= c ? 1 : (1 - av) / (1 - c))
      pos.push(x, y, v * toe)
      // Placed in LIFTS, and a compacted berm shows it: a faint horizontal
      // banding on the flanks, plus per-vertex grain so the surface doesn't
      // read as one moulded shell.
      const lift = Math.sin(y * 7.4) * 0.028
      const grain = (hash1(i * 131 + j * 17) - 0.5) * 0.075
      const m = 1 + lift + grain
      col.push(base.r * m, base.g * m, base.b * m)
    }
  }

  // Wound counter-clockwise seen from ABOVE, which is where this is looked at
  // from. Wound the other way the cover was a hole in the ground: every face
  // culled from every viewpoint outside it, so the crest hardware stood on bare
  // regolith and the vault showed through the berm that is meant to hide it.
  for (let i = 0; i < MOUND_NX; i++) {
    for (let j = 0; j < nz - 1; j++) {
      const a = i * nz + j
      const b = a + nz
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

function CoverMound({ g }: { g: VaultGeometry }) {
  const geo = useMemo(() => coverMoundGeometry(g), [g])
  return (
    <mesh geometry={geo}>
      {/* White base colour: the tone rides on the vertex colours instead, so
          SurfaceAnchor's dust and wear passes still have material.color to
          themselves and compose over the banding rather than erasing it. */}
      <meshStandardMaterial
        color="#ffffff"
        vertexColors
        roughness={0.96}
        metalness={0.02}
      />
    </mesh>
  )
}

// The structure: floor, side walls, barrel, end walls, ribs and lighting.
function VaultShell({ g }: { g: VaultGeometry }) {
  const floor = -g.floorDepthM
  const spring = floor + g.wallM // where the arch springs from
  const r = g.spanM / 2
  const halfL = g.lengthM / 2
  // Ribs at a spacing that lands whole: a hoop frame is built to a module, and
  // an odd stub bay at one end is the tell that it wasn't.
  const bays = Math.max(4, Math.round(g.lengthM / 2.5))
  return (
    <group>
      {/* Floor slab. Front-sided — it is only ever seen from above, standing
          in the vault — and bedded so its edges disappear into the walls. */}
      <mesh position={[0, floor - 0.18, 0]}>
        <boxGeometry args={[g.lengthM + 0.4, 0.36, g.spanM + 0.4]} />
        <meshStandardMaterial
          color={VAULT_DECK}
          roughness={0.92}
          metalness={0.04}
          emissive={VAULT_FILL}
          emissiveIntensity={VAULT_FILL_DEEP_I}
        />
      </mesh>

      {/* The traffic strip: a laid walkway down the axis, one shade darker
          where boots and a cart have polished it. */}
      <mesh position={[0.4, floor + 0.02, 0]}>
        <boxGeometry args={[g.lengthM - 1.2, 0.04, 1.9]} />
        <meshStandardMaterial
          color={VAULT_WALK}
          roughness={0.78}
          metalness={0.05}
          emissive={VAULT_FILL}
          emissiveIntensity={VAULT_FILL_DEEP_I}
        />
      </mesh>

      {/* Side walls, floor to springing */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, floor + g.wallM / 2, s * (r + LINER_T / 2)]}>
          <boxGeometry args={[g.lengthM, g.wallM, LINER_T]} />
          <meshStandardMaterial
            color={VAULT_LINER}
            roughness={0.9}
            metalness={0.03}
            side={THREE.DoubleSide}
            emissive={VAULT_FILL}
            emissiveIntensity={VAULT_FILL_I}
          />
        </mesh>
      ))}

      {/* The barrel. thetaStart PI over a PI arc, with the lathe's own
          rotation, is what puts the open half UP rather than sideways. */}
      <mesh position={[0, spring, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry
          args={[r, r, g.lengthM, 44, 1, true, Math.PI, Math.PI]}
        />
        <meshStandardMaterial
          color={VAULT_LINER}
          roughness={0.9}
          metalness={0.03}
          side={THREE.DoubleSide}
          emissive={VAULT_FILL}
          emissiveIntensity={VAULT_FILL_I}
        />
      </mesh>

      {/* End walls, as the vault's own section: a panel to the springing line
          with a half-disc closing the arch over it. Squaring them off instead
          would put corners outside the barrel, which is invisible from the
          surface and obvious from inside. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * halfL, 0, 0]}>
          <mesh
            position={[0, floor + g.wallM / 2, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <planeGeometry args={[g.spanM, g.wallM]} />
            <meshStandardMaterial
              color={VAULT_LINER}
              roughness={0.92}
              metalness={0.03}
              side={THREE.DoubleSide}
              emissive={VAULT_FILL}
              emissiveIntensity={VAULT_FILL_DEEP_I}
            />
          </mesh>
          <mesh position={[0, spring, 0]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[r, 40, 0, Math.PI]} />
            <meshStandardMaterial
              color={VAULT_LINER}
              roughness={0.92}
              metalness={0.03}
              side={THREE.DoubleSide}
              emissive={VAULT_FILL}
              emissiveIntensity={VAULT_FILL_DEEP_I}
            />
          </mesh>
        </group>
      ))}

      {/* Hoop frame: a half-torus across the vault at every bay, on legs down
          the side walls. Rotated a quarter turn about Y so the hoop's own
          plane lies across the axis and its arc covers the upper half. */}
      {Array.from({ length: bays + 1 }, (_, i) => {
        const x = -halfL + (g.lengthM * i) / bays
        return (
          <group key={i}>
            <mesh position={[x, spring, 0]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[r + 0.05, 0.11, 7, 30, Math.PI]} />
              <meshStandardMaterial
                color={VAULT_RIB}
                roughness={0.55}
                metalness={0.5}
                emissive={VAULT_FILL}
                emissiveIntensity={VAULT_FILL_I}
              />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh
                key={s}
                position={[x, floor + g.wallM / 2, s * (r + 0.05)]}
              >
                <boxGeometry args={[0.2, g.wallM, 0.2]} />
                <meshStandardMaterial
                  color={VAULT_RIB}
                  roughness={0.55}
                  metalness={0.5}
                  emissive={VAULT_FILL}
                  emissiveIntensity={VAULT_FILL_I}
                />
              </mesh>
            ))}
          </group>
        )
      })}

      {/* Work lighting, on the springing line either side. These are the only
          things in the vault bright enough to bloom, which is what sells the
          rest of the interior as lit by them. */}
      {[-1, 1].map((s) =>
        Array.from({ length: bays }, (_, i) => (
          <mesh
            key={`${s}:${i}`}
            position={[
              -halfL + g.lengthM * ((i + 0.5) / bays),
              spring + 0.12,
              s * (r - 0.22),
            ]}
          >
            <boxGeometry args={[g.lengthM / bays - 0.9, 0.09, 0.16]} />
            <meshStandardMaterial
              color={VAULT_LAMP}
              emissive={VAULT_LAMP}
              emissiveIntensity={2.1}
              toneMapped={false}
            />
          </mesh>
        ))
      )}
    </group>
  )
}

// What makes it a room rather than a pipe: cable tray, ducting, the hatch
// through the end wall to the shaft, stowage, and a work bench.
function VaultFitOut({ g, accent }: { g: VaultGeometry; accent: string }) {
  const floor = -g.floorDepthM
  const spring = floor + g.wallM
  const r = g.spanM / 2
  const halfL = g.lengthM / 2
  // The service bay: everything between the inward end wall and the module.
  const bayEnd = g.moduleOffsetM - 5.6
  return (
    <group>
      {/* Cable tray and a duct run along one haunch, the whole length */}
      {[
        { z: r - 0.35, y: spring + 0.55, w: 0.34, h: 0.16, c: VAULT_RIB },
        { z: -(r - 0.4), y: spring + 0.75, w: 0.42, h: 0.42, c: HULL_DARK },
      ].map((run, i) => (
        <mesh key={i} position={[0.2, run.y, run.z]}>
          <boxGeometry args={[g.lengthM - 1, run.h, run.w]} />
          <meshStandardMaterial
            color={run.c}
            roughness={0.6}
            metalness={0.4}
            emissive={VAULT_FILL}
            emissiveIntensity={VAULT_FILL_I}
          />
        </mesh>
      ))}

      {/* Hatch through the inward end wall. The shaft is on the far side of
          it, which is the whole reason the access is here and not a hole in the
          barrel: a shaft dropped through the crown would need the arch opened
          around it, and an opening is the one thing a surface of revolution
          cannot have without cutting the geometry apart. */}
      <group position={[-halfL + 0.08, floor + 1.15, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.12, 1.12, 0.16, 28]} />
          <meshStandardMaterial
            color={VAULT_RIB}
            roughness={0.5}
            metalness={0.55}
            emissive={VAULT_FILL}
            emissiveIntensity={VAULT_FILL_I}
          />
        </mesh>
        <mesh position={[0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.98, 0.98, 0.12, 26]} />
          <meshStandardMaterial
            color={MPH_TRIM}
            roughness={0.42}
            metalness={0.5}
            emissive={VAULT_FILL}
            emissiveIntensity={VAULT_FILL_I}
          />
        </mesh>
        {/* Hatch status light, in the operator's colour */}
        <mesh position={[0.24, 0.72, 0.55]}>
          <sphereGeometry args={[0.075, 10, 10]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.7}
            toneMapped={false}
          />
        </mesh>
        {/* Grab rails either side of the sill */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0.3, 0, s * 1.32]}>
            <boxGeometry args={[0.08, 1.9, 0.08]} />
            <meshStandardMaterial color={MPH_TRIM} roughness={0.5} metalness={0.45} />
          </mesh>
        ))}
      </group>

      {/* Service bay: stowage against the wall and a bench. Deliberately not
          centred on the walkway — a corridor a cart has to use stays clear. */}
      <group position={[-halfL + 2.6, floor, 0]}>
        {[
          { x: 0.2, z: r - 1.1, v: 'medium' as const, s: 3 },
          { x: 1.7, z: r - 1.0, v: 'small' as const, s: 7 },
          { x: 1.75, z: r - 1.9, v: 'small' as const, s: 11 },
          { x: 0.4, z: -(r - 1.2), v: 'large' as const, s: 5 },
        ].map((c, i) => (
          <group key={i} position={[c.x, 0, c.z]}>
            <CargoCrate variant={c.v} seed={c.s} />
          </group>
        ))}
        {/* Bench along the far wall, with a lit panel over it */}
        <mesh position={[2.9, 0.86, -(r - 0.85)]}>
          <boxGeometry args={[2.4, 0.09, 0.8]} />
          <meshStandardMaterial
            color={VAULT_RIB}
            roughness={0.55}
            metalness={0.45}
            emissive={VAULT_FILL}
            emissiveIntensity={VAULT_FILL_I}
          />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[2.9 + s * 1.05, 0.42, -(r - 0.85)]}>
            <boxGeometry args={[0.1, 0.84, 0.7]} />
            <meshStandardMaterial color={VAULT_RIB} roughness={0.6} metalness={0.4} />
          </mesh>
        ))}
        <mesh position={[2.9, 1.62, -(r - 0.55)]} rotation={[0.6, 0, 0]}>
          <boxGeometry args={[1.5, 0.5, 0.04]} />
          <meshStandardMaterial
            color={PANEL}
            emissive="#7fb2ff"
            emissiveIntensity={0.9}
            toneMapped={false}
            roughness={0.3}
          />
        </mesh>
      </group>

      {/* Somebody in it. This is the one thing the cutaway needs more than any
          other detail: a vault is an unreadable tube until there is a 1.85 m
          person standing on its floor, and then it is a room with a known size.
          Parked on the walkway between the hatch and the module, which is the
          only part of the floor the shot looks straight down. */}
      <group position={[0, floor, 0]}>
        <PatrollingAstronaut
          center={[-halfL + 4.6, 0]}
          radius={1.3}
          seed={19}
          accent={accent}
        />
      </group>

      {/* The plant the bay exists for: a thermal/ECLSS skid piped up into the
          cover, which is where a buried habitat's heat has to go. */}
      <group position={[bayEnd - 1.4, floor, -(r - 1.5)]}>
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[1.9, 1.9, 1.4]} />
          <meshStandardMaterial
            color={HULL_DARK}
            roughness={0.5}
            metalness={0.45}
            emissive={VAULT_FILL}
            emissiveIntensity={VAULT_FILL_I}
          />
        </mesh>
        {[-0.55, 0.55].map((dz) => (
          <mesh key={dz} position={[0.3, 1.9 + (spring - floor) * 0.5, dz]}>
            <cylinderGeometry args={[0.17, 0.17, spring - floor + 0.9, 12]} />
            <meshStandardMaterial color={METAL} roughness={0.45} metalness={0.6} />
          </mesh>
        ))}
        <mesh position={[0, 1.98, 0]}>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.5}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  )
}

// The shaft, and the head house on top of it. Both sit at the inward end,
// beyond the vault's end wall, so neither has to open the barrel.
//
// Placed by moundRise rather than at a chosen height: the head house stands on
// the cover's own inward flank, which is where a graded ridge actually gives
// you somewhere to put a door.
function VaultAccess({ g, accent }: { g: VaultGeometry; accent: string }) {
  const x = -(g.lengthM / 2 + 2)
  const grade = moundRise(g, x, 0)
  const floor = -g.floorDepthM
  const R = 1.5 // shaft bore
  return (
    <group position={[x, 0, 0]}>
      {/* Shaft, from the head house sill down to the vault floor. Double-sided
          so the bore reads from inside as well as out. */}
      <mesh position={[0, (grade + floor) / 2, 0]}>
        <cylinderGeometry args={[R, R, grade - floor, 26, 1, true]} />
        <meshStandardMaterial
          color={VAULT_LINER}
          roughness={0.9}
          metalness={0.04}
          side={THREE.DoubleSide}
          emissive={VAULT_FILL}
          emissiveIntensity={VAULT_FILL_DEEP_I}
        />
      </mesh>

      {/* Ladder down the bore, with a rest platform half way */}
      {Array.from(
        { length: Math.max(2, Math.round((grade - floor) / 0.32)) },
        (_, i) => (
          <mesh key={i} position={[0, floor + 0.3 + i * 0.32, -R + 0.34]}>
            <boxGeometry args={[0.78, 0.045, 0.045]} />
            <meshStandardMaterial color={MPH_TRIM} roughness={0.5} metalness={0.5} />
          </mesh>
        )
      )}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * 0.4, (grade + floor) / 2, -R + 0.34]}
        >
          <boxGeometry args={[0.06, grade - floor - 0.4, 0.06]} />
          <meshStandardMaterial color={MPH_TRIM} roughness={0.5} metalness={0.5} />
        </mesh>
      ))}

      {/* Head house: the airlock, and the only pressurized thing on this plot
          standing in the sun. */}
      <group position={[0, grade, 0]}>
        <mesh position={[0, 1.45, 0]}>
          <boxGeometry args={[3.3, 2.9, 3.3]} />
          <meshStandardMaterial color={HULL} roughness={0.55} metalness={0.22} />
        </mesh>
        {/* Benched pad. The shaft has to land clear of the vault's end wall,
            which puts the head house out on the cover's END TAPER — most of a
            crest's worth of berm against its inboard wall, bare regolith a
            couple of meters outboard. So it gets cut-and-fill rather than a
            fillet: the pad is retained down to below grade on the low side and
            buried by the berm on the high one, which is why the building reads
            as set INTO the cover from uphill and standing on it from the stair.
            A shallow fillet spanned neither and floated over the low corner. */}
        <mesh position={[0, -(grade + 0.8) / 2, 0]}>
          <boxGeometry args={[4.3, grade + 0.8, 4.3]} />
          <meshStandardMaterial color={COVER} roughness={0.95} metalness={0.02} />
        </mesh>
        {/* Kerb round the bench, which is what retains it */}
        <mesh position={[0, -0.12, 0]}>
          <boxGeometry args={[4.62, 0.24, 4.62]} />
          <meshStandardMaterial color={PAD_SLAB} roughness={0.9} metalness={0.05} />
        </mesh>
        {/* Roof: a shallow cap plus its own thin shield layer */}
        <mesh position={[0, 3.02, 0]}>
          <boxGeometry args={[3.6, 0.26, 3.6]} />
          <meshStandardMaterial color={HULL_DARK} roughness={0.6} metalness={0.3} />
        </mesh>
        {/* Outer hatch, facing away from the mound */}
        <group position={[-1.68, 1.15, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[0.95, 0.95, 0.14, 26]} />
            <meshStandardMaterial color={MPH_TRIM} roughness={0.45} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.78, 0.78, 0.1, 24]} />
            <meshStandardMaterial color={HULL_DARK} roughness={0.4} metalness={0.45} />
          </mesh>
        </group>
        {/* Operator band, a light over the door, and a whip antenna */}
        <mesh position={[0, 2.72, 0]}>
          <boxGeometry args={[3.36, 0.2, 3.36]} />
          <meshStandardMaterial color={accent} roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[-1.74, 2.2, 0]}>
          <sphereGeometry args={[0.11, 10, 10]} />
          <meshStandardMaterial
            color={VAULT_LAMP}
            emissive={VAULT_LAMP}
            emissiveIntensity={2.3}
            toneMapped={false}
          />
        </mesh>
        <Strut from={[1.3, 3.1, 1.3]} to={[1.3, 6.4, 1.3]} r={0.05} color={METAL} />
        <mesh position={[1.3, 6.5, 1.3]}>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Stair down the flank to grade. Steep, because the flank is at the
          angle of repose and a ramp gentle enough to drive would run half a
          district; crew climb, cargo goes down the shaft on the hoist. */}
      {Array.from({ length: 8 }, (_, i) => {
        const t = (i + 1) / 8
        return (
          <mesh
            key={i}
            position={[-2.1 - t * 2.6, grade * (1 - t) - 0.1, 0]}
          >
            <boxGeometry args={[0.42, 0.16, 1.7]} />
            <meshStandardMaterial color={PAD_SLAB} roughness={0.9} metalness={0.03} />
          </mesh>
        )
      })}
      {[-1, 1].map((s) => (
        <Strut
          key={s}
          from={[-2.2, grade + 0.9, s * 0.9]}
          to={[-4.8, 0.85, s * 0.9]}
          r={0.045}
          color={MPH_TRIM}
        />
      ))}
    </group>
  )
}

// What cannot go under: heat rejection, power, and the stacks that connect the
// two to what is buried. All of it stands on the crest, which is both the best
// sky a buried plot has and the shortest run to the plant below.
function CrestWorks({ g, accent }: { g: VaultGeometry; accent: string }) {
  const radX = -(g.lengthM / 2) * 0.34
  const pvX = g.lengthM * 0.3
  return (
    <group>
      {/* Radiator wall. Vertical and edge-on to the sun's bearing, exactly as
          every surface radiator on this base is, for the same reason: at 89°S
          the sun circles the horizon and a panel lying flat bakes. */}
      {[-1, 1].map((s) => (
        <group
          key={s}
          position={[radX + s * 1.5, moundRise(g, radX + s * 1.5, 0), 0]}
        >
          <mesh position={[0, 1.95, 0]}>
            <boxGeometry args={[0.1, 3.5, 6.4]} />
            <meshStandardMaterial
              color={HULL}
              roughness={0.34}
              metalness={0.55}
              side={THREE.DoubleSide}
            />
          </mesh>
          {[-1, 1].map((e) => (
            <mesh key={e} position={[0, 1.95, e * 3.25]}>
              <boxGeometry args={[0.22, 3.7, 0.16]} />
              <meshStandardMaterial color={METAL} roughness={0.5} metalness={0.55} />
            </mesh>
          ))}
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.9, 0.4, 6.6]} />
            <meshStandardMaterial color={VAULT_RIB} roughness={0.6} metalness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Thermal/ECLSS stacks, over the plant below */}
      {[-1.4, 1.4].map((dz) => {
        const x = radX + 4.2
        return (
          <group key={dz} position={[x, moundRise(g, x, dz), dz]}>
            <mesh position={[0, 0.85, 0]}>
              <cylinderGeometry args={[0.34, 0.42, 1.7, 14]} />
              <meshStandardMaterial color={HULL_DARK} roughness={0.5} metalness={0.45} />
            </mesh>
            <mesh position={[0, 1.78, 0]}>
              <cylinderGeometry args={[0.46, 0.34, 0.2, 14]} />
              <meshStandardMaterial color={METAL} roughness={0.45} metalness={0.6} />
            </mesh>
          </group>
        )
      })}

      {/* PV over the far end of the cover */}
      {[-1, 1].map((s) => {
        const z = s * 3.1
        return (
          <group key={s} position={[pvX, moundRise(g, pvX, z), z]}>
            <Strut from={[0, 0, 0]} to={[0, 1.5, 0]} r={0.08} color={METAL} />
            <mesh position={[0, 1.9, 0]} rotation={[0, 0, 1.15]}>
              <boxGeometry args={[0.05, 5.2, 2.1]} />
              <meshStandardMaterial
                color={PANEL}
                roughness={0.28}
                metalness={0.42}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh position={[0, 1.62, 0]}>
              <boxGeometry args={[0.34, 0.3, 0.34]} />
              <meshStandardMaterial color={VAULT_RIB} roughness={0.55} metalness={0.45} />
            </mesh>
          </group>
        )
      })}

      {/* Survey monument on the crest — the mark the cover's thickness is
          checked against, and the only thing up here that isn't hardware. */}
      {(() => {
        const x = g.lengthM * 0.06
        const z = g.moundHalfWidthM * 0.42
        return (
          <group position={[x, moundRise(g, x, z), z]}>
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.07, 0.09, 1, 8]} />
              <meshStandardMaterial color={HULL_DARK} roughness={0.6} metalness={0.3} />
            </mesh>
            <mesh position={[0, 1.06, 0]}>
              <boxGeometry args={[0.34, 0.16, 0.05]} />
              <meshStandardMaterial
                color={accent}
                emissive={accent}
                emissiveIntensity={0.5}
                roughness={0.5}
              />
            </mesh>
          </group>
        )
      })()}

      {/* Surplus spoil: what came out of the hole and didn't go back over it,
          windrowed along the outward flank where the haulers left it. */}
      {[0, 1, 2].map((i) => {
        const x = g.moundHalfLengthM * (0.34 + i * 0.2)
        const z = -g.moundHalfWidthM * 0.72
        const rr = 1.5 - i * 0.22
        return (
          <mesh key={i} position={[x, moundRise(g, x, z) + rr * 0.1, z]}>
            <sphereGeometry args={[rr, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial
              color={COVER}
              roughness={0.97}
              metalness={0.02}
            />
          </mesh>
        )
      })}
    </group>
  )
}

// Thales' MPH as it sits in a vault. Built from the SAME dimensions the surface
// model is (MPH_R, MPH_BARREL, MPH_Y, MPH_LOCK_X — see the Habitat component,
// which is the MPH): a buried article that read as a different diameter or a
// different length would look like a different program's module, and the whole
// argument of this race is that no two bids look alike.
//
// What is deliberately absent is everything the surface model deploys INTO the
// sky — the tracking array, the radiator wings over the roof, the antennas. A
// radiator four meters under regolith rejects heat to the regolith, which is
// the one thing it must not do, so that hardware is re-erected on the crest
// (see CrestWorks) and the shell down here is just the shell.
function MphVaultModule({ g, accent }: { g: VaultGeometry; accent: string }) {
  const base = -g.floorDepthM
  return (
    // Turned to face the service bay. Both modules here are authored with their
    // hatch end on local +X — that is where the road was when they stood on the
    // surface — and in a vault the road is the shaft at the INWARD end, so the
    // whole module comes about rather than its door being re-cut on the far side.
    <group position={[g.moduleOffsetM, base, 0]} rotation={[0, Math.PI, 0]}>
      {/* Still on its own landing legs: it arrived on them, and a module set
          down in a trench is not re-cradled afterwards. */}
      {[-3.3, -0.2].map((x) =>
        [-1, 1].map((s) => <HabitatLeg key={`${x}:${s}`} x={x} z={s * 1.45} />)
      )}
      <HabitatLeg x={MPH_LOCK_X} z={-1.05} />
      <HabitatLeg x={MPH_LOCK_X} z={1.05} />

      {/* Pressure shell and its end caps. The cap sign is the same trap the
          surface model documents: Rz(+PI/2) carries +Y to -X, so the forward
          cap needs the NEGATED sign to dome forward. */}
      <mesh position={[MPH_X, MPH_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[MPH_R, MPH_R, MPH_BARREL, 32]} />
        <meshStandardMaterial
          color={MPH_MLI}
          roughness={0.72}
          metalness={0.14}
          emissive={VAULT_FILL}
          emissiveIntensity={VAULT_FILL_I}
        />
      </mesh>
      {[
        [MPH_FWD, 1],
        [MPH_AFT, -1],
      ].map(([x, s]) => (
        <mesh
          key={x}
          position={[x, MPH_Y, 0]}
          rotation={[0, 0, -s * (Math.PI / 2)]}
        >
          <sphereGeometry args={[MPH_R, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={MPH_MLI}
            roughness={0.72}
            metalness={0.14}
            emissive={VAULT_FILL}
            emissiveIntensity={VAULT_FILL_I}
          />
        </mesh>
      ))}

      {/* Ring frames over the barrel */}
      {[-3.1, -1.4, 0.3].map((x) => (
        <mesh key={x} position={[x, MPH_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[MPH_R + 0.06, MPH_R + 0.06, 0.14, 32]} />
          <meshStandardMaterial color={MPH_TRIM} roughness={0.55} metalness={0.42} />
        </mesh>
      ))}

      {/* Operator band on the forward ring — the same one the surface model
          carries, and the only paint on the pressure shell. */}
      <mesh position={[MPH_FWD - 0.35, MPH_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[MPH_R + 0.08, MPH_R + 0.08, 0.28, 32]} />
        <meshStandardMaterial color={accent} roughness={0.5} metalness={0.3} />
      </mesh>

      {/* Airlock tower. Above ground it is the EVA door; down here it is the
          way through to the shaft, so its hatch faces the service bay. */}
      <mesh position={[MPH_LOCK_X, 1.95, 0]}>
        <cylinderGeometry args={[MPH_LOCK_R, MPH_LOCK_R, 2.9, 24]} />
        <meshStandardMaterial
          color={MPH_MLI}
          roughness={0.72}
          metalness={0.14}
          emissive={VAULT_FILL}
          emissiveIntensity={VAULT_FILL_I}
        />
      </mesh>
      <mesh position={[MPH_LOCK_X, 3.4, 0]}>
        <sphereGeometry args={[MPH_LOCK_R, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={MPH_MLI}
          roughness={0.72}
          metalness={0.14}
          emissive={VAULT_FILL}
          emissiveIntensity={VAULT_FILL_I}
        />
      </mesh>

      {/* Berthing port on the aft cap, still waiting on the element that was
          always meant to dock to it */}
      <mesh
        position={[MPH_AFT - MPH_R - 0.22, MPH_Y, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.92, 0.92, 0.44, 24]} />
        <meshStandardMaterial color={MPH_SHADE} roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh
        position={[MPH_AFT - MPH_R - 0.46, MPH_Y, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[1.06, 1.06, 0.14, 24]} />
        <meshStandardMaterial color={MPH_TRIM} roughness={0.45} metalness={0.5} />
      </mesh>

      {/* Gangway from the airlock sill down to the vault's walkway */}
      <mesh position={[MPH_LOCK_X + MPH_LOCK_R + 0.85, 1.42, 0]}>
        <boxGeometry args={[1.6, 0.1, 1.3]} />
        <meshStandardMaterial color={MPH_SHADE} roughness={0.7} metalness={0.25} />
      </mesh>
      {[-1, 1].map((s) => (
        <Strut
          key={s}
          from={[MPH_LOCK_X + MPH_LOCK_R + 0.05, 2.32, s * 0.62]}
          to={[MPH_LOCK_X + MPH_LOCK_R + 2.6, 2.32, s * 0.62]}
          r={0.04}
          color={MPH_TRIM}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[MPH_LOCK_X + MPH_LOCK_R + 1.8 + i * 0.34, 1.2 - i * 0.34, 0]}
        >
          <boxGeometry args={[0.36, 0.09, 1.2]} />
          <meshStandardMaterial color={MPH_SHADE} roughness={0.8} metalness={0.2} />
        </mesh>
      ))}

      {/* Lit ports. A buried module has no view out, and these look into the
          vault instead — the crew's window is onto their own hall. */}
      {[-2.6, -0.9].map((x) => (
        <mesh
          key={x}
          position={[x, MPH_Y + 0.55, mphFlankZ(MPH_Y + 0.55) - 0.06]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.3, 0.3, 0.12, 18]} />
          <meshStandardMaterial
            color={WINDOW}
            emissive={WINDOW}
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Handrails along the crown */}
      {[-3.6, -2.1, -0.6, 0.9].map((x) => (
        <Strut
          key={x}
          from={[x, MPH_Y + MPH_R + 0.04, -0.4]}
          to={[x, MPH_Y + MPH_R + 0.04, 0.4]}
          r={0.035}
          color={MPH_TRIM}
        />
      ))}
    </group>
  )
}

// Sierra's LIFE in its vault. The shell is the SAME lathe profile the surface
// model uses (LIFE_PROFILE) — the quilting between the cinch straps is the one
// feature that says "inflatable", and re-drawing it looser here would make the
// buried article read as a different program's hardware. What is deliberately
// absent is the standoff radiators: those are on the crest now.
function LifeVaultModule({ g, accent }: { g: VaultGeometry; accent: string }) {
  const base = -g.floorDepthM
  return (
    // Turned about, for the same reason the MPH is: the vestibule is authored
    // on local +X where the road used to be, and in a vault the way out is the
    // shaft behind the inward end wall.
    <group position={[g.moduleOffsetM, base, 0]} rotation={[0, Math.PI, 0]}>
      {/* Saddles, sized off the CINCH radius like the surface model's */}
      {[-2.9, -0.8, 1.3].map((x) => (
        <mesh key={x} position={[x, 0.39, 0]}>
          <boxGeometry args={[0.5, 0.78, 2.6]} />
          <meshStandardMaterial color={LIFE_CRADLE} roughness={0.85} metalness={0.18} />
        </mesh>
      ))}

      {/* Softgoods shell */}
      <mesh position={[LIFE_X, LIFE_Y, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <latheGeometry args={[LIFE_PROFILE, 48]} />
        <meshStandardMaterial
          color={LIFE_SOFT}
          roughness={0.9}
          metalness={0.03}
          emissive={VAULT_FILL}
          emissiveIntensity={VAULT_FILL_I}
        />
      </mesh>

      {/* Hoop straps at every cinch */}
      {Array.from({ length: LIFE_BAYS + 1 }, (_, i) => (
        <mesh
          key={i}
          position={[LIFE_X + (i / LIFE_BAYS - 0.5) * LIFE_BARREL, LIFE_Y, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <torusGeometry args={[LIFE_R_STRAP + 0.03, 0.1, 8, 44]} />
          <meshStandardMaterial
            color={LIFE_STRAP}
            roughness={0.85}
            metalness={0.08}
            emissive={VAULT_FILL}
            emissiveIntensity={VAULT_FILL_DEEP_I}
          />
        </mesh>
      ))}

      {/* Rigid ends, forward one carrying the operator's colour */}
      <LifeBulkhead x={LIFE_X - LIFE_END} s={-1} />
      <LifeBulkhead x={LIFE_X + LIFE_END} s={1} ring={accent} />

      {/* Vestibule, canted down off the forward bulkhead onto the walkway —
          the same solution the surface model uses for a hull this fat. */}
      <group position={[LIFE_X + LIFE_VEST_X, LIFE_VEST_Y, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[LIFE_VEST_R, LIFE_VEST_R, 1.8, 22]} />
          <meshStandardMaterial
            color={LIFE_CORE}
            roughness={0.5}
            metalness={0.35}
            emissive={VAULT_FILL}
            emissiveIntensity={VAULT_FILL_I}
          />
        </mesh>
        <mesh position={[0.98, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[LIFE_VEST_R + 0.16, LIFE_VEST_R + 0.16, 0.16, 22]} />
          <meshStandardMaterial color={LIFE_TRIM} roughness={0.45} metalness={0.45} />
        </mesh>
        {/* Steps down to the deck */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[1.15 + i * 0.34, -0.55 - i * 0.34, 0]}>
            <boxGeometry args={[0.36, 0.08, 1.1]} />
            <meshStandardMaterial color={LIFE_TRIM} roughness={0.55} metalness={0.35} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// The per-project pressure shell inside the vault. Only the two buried
// competitors appear here; anything else buried later needs its own entry,
// because the whole reason this race is worth drawing is that no two answers
// to "what is a first habitat" look alike (see PROJECT_MODEL).
function VaultModule({
  project,
  g,
  accent,
}: {
  project: Project
  g: VaultGeometry
  accent: string
}) {
  if (project.id === 'sierra-space-life')
    return <LifeVaultModule g={g} accent={accent} />
  return <MphVaultModule g={g} accent={accent} />
}

// A buried habitat, assembled. Authored entirely in METERS: the outer group
// cancels the model-size normalization the same way every true-size model here
// does, so a 2.9 m head house really is 2.9 m beside a 1.85 m astronaut.
//
// The long axis is local +X, which SurfaceAnchor puts on the world bearing
// vaultAxis hands it — NOT on the camera-facing heading every other ground
// model uses. The cutaway camera has to stand at a known end of a known axis,
// and a heading solved against the home viewpoint is not a bearing subplan can
// predict (see vaultAxis).
function BuriedHabitat({
  project,
  accent,
}: {
  project: Project
  accent: string
}) {
  const g = buriedVault(project.id)
  if (!g) return null
  return (
    <group scale={UNIT_MAX_DIM / projectSizeM(project)}>
      <CoverMound g={g} />
      <VaultShell g={g} />
      <VaultFitOut g={g} accent={accent} />
      <VaultModule project={project} g={g} accent={accent} />
      <VaultAccess g={g} accent={accent} />
      <CrestWorks g={g} accent={accent} />
    </group>
  )
}

// Company-specific builds, keyed by project. A named competitor's hardware
// should look like theirs; the per-type model below is the stand-in for
// everyone else in that category.
const PROJECT_MODEL: Record<string, ComponentType<{ accent: string }>> = {
  'im-moon-racer': MoonRacer,
  'astrolab-flex': FlexRover,
  'lunar-outpost-lunar-dawn': VoyagerRover,
  // Each habitat bid needs its own model, because the race is an argument about
  // what a first habitat even is and no two answers look remotely alike: Thales
  // send a rigid metal module, Sierra send fabric that inflates to twice the
  // diameter, Japan send a vehicle. Two of them are here and the generic
  // `habitat` model is the third — the MPH. Sharing one model between any pair
  // of them loses the whole point of the district, which is what happened while
  // Thales and Sierra were both drawing the module.
  'jaxa-lunar-cruiser': CruiserRover,
  'sierra-space-life': SierraLife,
  // Two of the three Fission Surface Power bids have their own model, and the
  // generic `power` model is the third — the Westinghouse eVinci. None of them
  // can stand in for another: the whole reason to show a fission field is that
  // these are three different answers to rejecting heat with no air to do it in,
  // and the answer is the part you can see from across the district.
  'lockheed-fission-surface-power': LockheedFsp,
  'ix-fission-surface-power': IxFsp,
  // ESA's ground lot: a minimal customer user terminal rather than the
  // dish-mast-shelter network the other three comms bids stand up (see
  // PathfinderTerminal). Pathfinder itself flies as a satellite, rendered by
  // SkyLayer via SKY_STATIONS — this is only the ground half of the story.
  'esa-lunar-pathfinder': PathfinderTerminal,
  // Crescent's ground lot, smaller again than ESA's: see ParsecTerminal.
  // Parsec itself flies as two satellites via SKY_STATIONS/SkyLayer.
  'crescent-parsec': ParsecTerminal,
  // IM's ground lot: a single sealed avionics package with its dish
  // gimballed onto the lid, not the generic CommsPnt mast-shelter-array site
  // Nokia still stands on. RelaySat flies via SKY_STATIONS/SkyLayer.
  'im-near-space-network': RelayGroundTerminal,
  // The habitat race's two flagship sustained-presence programs. Both need
  // an explicit entry now that `crewed_base` and `habitat` are one type —
  // the generic `Habitat` model (a single pressurized module) is the wrong
  // fallback for either of these, so neither can be reached by the
  // type-level switch below the way a project with no model of its own is.
  'nasa-artemis-base-camp': CrewedBase,
  ilrs: ILRSBase,
  // ISRU district: a packaged skid plant instead of IsruPlant's own
  // field-plus-tower installation. `blue-origin-blue-alchemist` keeps the
  // generic model — IsruPlant's photovoltaic field IS Blue Alchemist's own
  // premise (see the comment on PvField).
  'sierra-space-carbothermal': SierraCarbothermal,
  // ISRU district's third bid: one riveted crucible instead of a stack or a
  // field. See LunarResourcesMre.
  'lunar-resources-mre': LunarResourcesMre,
  // The crewed-lander race's second competitor, replacing the InSight-lander
  // stand-in. See BlueMoonMk2. `spacex-starship-hls` keeps its GLB.
  'blue-origin-blue-moon-mk2': BlueMoonMk2,
}

export function ProceduralModel({
  project,
  accent,
  trackGround,
}: {
  project: Project
  accent: string
  // Only the mass driver uses this: the ground under each of its trestle bents.
  // See MassDriver.
  trackGround?: number[]
}) {
  const Custom = PROJECT_MODEL[project.id]
  if (Custom) return <Custom accent={accent} />
  switch (project.type) {
    case 'habitat':
      return <Habitat accent={accent} />
    case 'lander':
      return <Lander accent={accent} />
    case 'rover':
      return <Rover accent={accent} />
    case 'isru_plant':
      return <IsruPlant accent={accent} />
    case 'power':
      return <Power accent={accent} />
    case 'comms_pnt':
      return <CommsPnt accent={accent} />
    case 'orbital':
      return <RelaySat accent={accent} />
    case 'construction':
      return <ConstructionSite accent={accent} />
    case 'mass_driver':
      return <MassDriver accent={accent} trackGround={trackGround} />
    case 'other':
    default:
      return <GenericStructure accent={accent} />
  }
}

// Normalizes a loaded GLB: applies any authoring rotation, then centers it
// horizontally and seats it on the ground (min.y = 0), then fits it to a target
// height in local model space. Rendered only when a modelURI exists.
function GLBModel({
  url,
  transform,
  fitHeight = 1.7,
}: {
  url: string
  transform?: ModelTransform
  fitHeight?: number
}) {
  const { scene } = useGLTF(url, DRACO_PATH)
  const object = useMemo(() => {
    const inner = scene.clone(true)
    inner.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
        // scene.clone() shares materials with every other clone of the same
        // GLB, so a per-instance change — the district dim below, for one —
        // would be fought over by every project that happens to use this file.
        // Give each instance its own.
        m.material = Array.isArray(m.material)
          ? m.material.map((mat) => mat.clone())
          : m.material.clone()
        // Some source GLBs (e.g. the single-mesh MMSEV) ship a bounding
        // sphere that, once seated + scaled tiny on the globe, makes three's
        // frustum test flicker the mesh in and out as the camera moves.
        // Recompute the bounds and opt this mesh out of culling — there are
        // only ever a couple of models on screen, so the cost is negligible.
        m.frustumCulled = false
        m.geometry?.computeBoundingSphere?.()
        m.geometry?.computeBoundingBox?.()
      }
    })
    if (transform?.rotationEuler) {
      inner.rotation.set(
        transform.rotationEuler[0],
        transform.rotationEuler[1],
        transform.rotationEuler[2]
      )
    }
    inner.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(inner)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    // Center on X/Z and seat the lowest point on the ground plane.
    inner.position.x -= center.x
    inner.position.z -= center.z
    inner.position.y -= box.min.y

    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const fit = transform?.scaleToMeters ?? fitHeight / maxDim

    const wrapper = new THREE.Group()
    wrapper.add(inner)
    wrapper.scale.setScalar(fit)
    if (transform?.originOffset) {
      wrapper.position.add(new THREE.Vector3(...transform.originOffset))
    }
    return wrapper
  }, [scene, transform, fitHeight])

  return <primitive object={object} />
}

// A little astronaut patrolling beside a crewed base, for scale and life.
// Local units on a 10 m crewed base are ~5.9 m each, so 0.31 units is a
// suited astronaut's ~1.85 m.
function AstronautCompanion({ accent }: { accent: string }) {
  return <PatrollingAstronaut center={[0.9, 0.7]} radius={0.6} fitHeight={0.31} accent={accent} />
}

// Pointer travel beyond this between down and up is a globe drag, not a click.
const CLICK_DRAG_TOLERANCE_PX = 8

// ---------------------------------------------------------------------------
// Dust on the hardware
// ---------------------------------------------------------------------------
//
// Lunar dust gets on everything, and it gets on the bottom of everything
// first. It is electrostatically charged, jagged, and thrown by every wheel,
// boot and thruster on the surface, with no atmosphere to slow it and no
// weather to wash it off — so it arrives, sticks, and stays. Apollo hardware is
// the whole argument: the LRV came home with its fenders and lower body the
// colour of the ground it drove over while its upper surfaces stayed the colour
// they were painted, and every LM's descent stage wore the same gradient. Clean
// hardware, uniformly the colour of its own paint from the ground up, is one of
// the loudest tells that a surface render was assembled rather than used.
//
// So every lit surface on the base is blended toward the regolith by how low it
// sits. Measured in REAL METERS off local grade and not as a fraction of the
// model, because that's how the physics works: dust is thrown to about the same
// height whether the thing standing in it is a 2 m rover or a 105 m guideway,
// so a rover ends up dusty nearly all over and the guideway ends up dusty only
// around the feet of its legs. A fraction-of-model rule would have got the
// rover right and painted the guideway's roof.
const DUST = new THREE.Color('#9b948a')
// How far up the dust reaches. Generous for footfall alone; this is a working
// site with vehicles running laps of it and landers coming in.
const DUST_HEIGHT_M = 2.2
// ...and how much of that is the splash zone, coated as heavily as it gets. A
// falloff that starts thinning from the ground up leaves the one band that
// should be unambiguously filthy — tracks, feet, skirts, the bottom of a leg —
// at two thirds strength, which is the height at which the whole effect stops
// being legible at any distance.
const DUST_FULL_M = 0.6
// Blend at grade. Deliberately short of a full coat — this is hardware in
// service, not hardware abandoned, and past about a third the underlying
// material stops reading as itself at all.
const DUST_MAX = 0.3
// Vertical extent, in meters, below which a mesh is taken to be a marking ON
// the ground rather than a surface standing on it — a pit floor, a painted
// lane, a decal. Dust settling on top of the ground is just the ground, and
// tinting these washes out albedos that were chosen to read as dark holes.
const DUST_FLAT_M = 0.03
// Height, in meters, below which a mesh is taken to be INSIDE something rather
// than standing on the regolith, and so exempt from the gradient entirely — the
// buried habitats' vaults and the modules in them. A metre of margin, because
// surface models routinely bed a skirt or a footpad slightly into the ground
// and those are still standing on it.
const DUST_BURIED_M = -1

const DUST_BOX = new THREE.Box3()
const DUST_MAT = new THREE.Matrix4()
const DUST_WANT = new THREE.Color()

// ---------------------------------------------------------------------------
// Per-instance weathering
// ---------------------------------------------------------------------------
//
// The base fields real duplicates: three fission plants of one design, a row of
// identical printed pads, a scatter of the same boulder and the same street
// light over and over. Duplicated hardware is correct — you would build a
// second reactor to the first one's drawings — but duplicated WEAR is not.
// Two units off the same line have been on the surface different lengths of
// time, taken different amounts of dust, and been scuffed by different work,
// and it is that variation the eye uses to read a row of things as several
// objects rather than one object copied. Without it, identical models tile:
// the repeat becomes the most visible thing in the frame.
//
// So every anchored instance shifts its own materials a little, off a seed
// taken from the one thing guaranteed unique and stable per instance — where
// it stands. No plumbing, no props to thread through a dozen call sites, and a
// given unit looks the same on every reload because its site never moves.
const WEATHER_ROUGH = 0.07 // ± roughness, on a 0-1 scale
const WEATHER_VALUE = 0.05 // ± brightness, as a fraction

// Stable, well-mixed and cheap, from a point on the unit sphere. Multipliers
// are the usual irrationals — the point is only that the three axes don't
// alias against each other for directions this close together (every site on
// this base is within a few hundred meters, so the inputs agree to five
// decimals and a weak hash would hand neighbours the same number).
function siteSeed(dir: Vec3): number {
  const s =
    Math.sin(dir[0] * 12.9898 + dir[1] * 78.233 + dir[2] * 37.719) * 43758.5453
  return s - Math.floor(s)
}

// Anchors any model on the globe: seats it at the sampled terrain radius
// along `dir`, orients its +Y to the local surface normal, and makes the
// whole thing a drag-tolerant click/hover target. Shared by per-project
// models and the generic tech-tree site models.
export function SurfaceAnchor({
  dir,
  surfaceRadius,
  scale = (10 * M_TO_UNITS) / UNIT_MAX_DIM,
  frontAz = 0,
  turn = 0,
  noseAlong,
  dim = 1,
  castShadows = true,
  interactive = true,
  onClick,
  onHoverChange,
  children,
}: {
  dir: Vec3 // unit surface direction (declustered)
  // Displaced terrain radius at this direction — seats the model on the
  // rendered ground. Falls back to the analytic-sphere constant.
  surfaceRadius?: number
  // World scale for the whole installation (model + pad). Defaults to a
  // 10 m installation; use projectScale() for a project's true size.
  scale?: number
  // Local azimuth of the model's presentation side; see MODEL_FRONT_AZ.
  frontAz?: number
  // Radians this site is turned off the base's common heading; see BASE_PLAN.
  turn?: number
  // World-space direction of travel, for hardware that is driving rather than
  // parked. Supersedes `frontAz`/`turn`: see headingYaw.
  noseAlong?: Vec3
  // Fraction of full opacity, for taking a whole district down while another
  // race is the subject. 1 leaves every material exactly as authored.
  dim?: number
  // Whether this model may cast a shadow. The sun's shadow camera is a ±400 m
  // orthographic box on the colony (see SHADOW_EXTENT), which is sized for
  // hardware standing on the ground; a caster hundreds of meters UP lands near
  // that edge, and the relay constellation straddles it — two of its three
  // stations inside, one 402 m out. Half a constellation casting shadows and
  // half not is worse than none of it doing so.
  castShadows?: boolean
  // False for base-wide scenery with nothing to select — a boulder, a
  // street light — so it never raycasts a pointer cursor or swallows a
  // click meant for the ground/Moon mesh behind it. Every competitor's own
  // model leaves this at the default so it stays a click/hover target.
  interactive?: boolean
  onClick?: () => void
  onHoverChange?: (hovered: boolean) => void
  children: ReactNode
}) {
  const { position, quaternion } = useMemo(() => {
    const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize()
    // Align the model's up with the local surface normal. The leftover yaw
    // from setFromUnitVectors is arbitrary (it depends on where the site sits
    // on the sphere), which left every asset on a random heading — hence the
    // explicit facing correction below.
    const q = new THREE.Quaternion().setFromUnitVectors(MODEL_UP, d)
    const pos = d.clone().multiplyScalar(surfaceRadius ?? SURFACE)
    q.multiply(
      new THREE.Quaternion().setFromAxisAngle(
        MODEL_UP,
        noseAlong ? headingYaw(q, noseAlong) : facingYaw(q, frontAz, turn)
      )
    )
    return { position: pos, quaternion: q }
  }, [dir, surfaceRadius, frontAz, turn, noseAlong])

  // Cast shadows are what actually anchor hardware to the regolith, but three
  // stores the flag per object, so it has to be pushed down the subtree. No
  // dependency list: GLB children mount later (through Suspense), and this is
  // a handful of meshes. The district dim rides along on the same traversal for
  // that same reason — a model that streams in while another race is open has
  // to arrive already dimmed.
  const groupRef = useRef<THREE.Group>(null)
  useEffect(() => {
    const root = groupRef.current
    if (!root) return
    // Forced, rather than trusting whatever the render loop last left behind:
    // this effect runs at commit, and a mesh mounting for the first time (or
    // streaming in out of a GLB's Suspense) has its position set but its world
    // matrix still stale. The dust pass below reads a mesh's height through
    // those matrices, so a stale one bakes the wrong amount of dust onto a
    // material — and since nothing re-renders afterwards, it would stay wrong.
    root.updateWorldMatrix(true, true)
    // Meters, in this model's own local units — the anchor's `scale` is world
    // units per local unit and M_TO_UNITS is world units per meter.
    const localPerM = M_TO_UNITS / scale
    // This unit's own wear, held for its whole subtree so the instance reads as
    // one object that has had one life — not as parts weathered independently.
    const wear = siteSeed(dir)
    const wearRough = (wear - 0.5) * 2 * WEATHER_ROUGH
    const wearValue = 1 + (siteSeed([dir[1], dir[2], dir[0]]) - 0.5) * 2 * WEATHER_VALUE

    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mat = m.material as THREE.Material | undefined
      // Remember what the material asked for before any dim was applied, so
      // full strength means *its* opacity and not a flat 1 — glazing and
      // decals are authored translucent. This has to be recorded before the
      // shadow flags below, which ask whether the material is glazing: once a
      // dim is in effect every material looks translucent, and reading the live
      // opacity would have a dimmed hull stop casting a shadow.
      if (mat && mat.userData.dimBaseOpacity === undefined) {
        mat.userData.dimBaseOpacity = mat.opacity
        mat.userData.dimBaseTransparent = mat.transparent
      }

      // Unlit meshes can neither receive shadows nor be shaded, so having
      // them cast would drop hard silhouettes with no lighting to justify
      // them (thin marker rings, decals).
      const unlit = mat?.type === 'MeshBasicMaterial'
      // Glazing must not cast either. A shadow map is binary — it has no
      // notion of opacity — so a greenhouse dome you can see straight through
      // would black out the ground beneath it exactly like a solid one.
      const glazing =
        !!mat?.userData.dimBaseTransparent && mat.userData.dimBaseOpacity < 0.9
      m.castShadow = castShadows && !unlit && !glazing
      m.receiveShadow = !unlit

      if (!mat) return

      // Dust, thickest at grade and thinning with height (see DUST_HEIGHT_M).
      // Recomputed from a remembered base colour every pass rather than applied
      // once, for the same reason the dim above is: it has to be idempotent, so
      // that a pass which ran before this mesh's transform settled is corrected
      // by the next one instead of leaving a permanent mistake.
      const tint = mat as THREE.MeshStandardMaterial
      const emissive = tint.emissive
        ? tint.emissive.r + tint.emissive.g + tint.emissive.b
        : 0
      if (!unlit && tint.color && emissive < 0.3 && m.geometry) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
        const bb = m.geometry.boundingBox
        // The mesh's own box in the MODEL's frame, which is the frame local
        // height is measured in — a geometry-space box would put a flat
        // ground decal's degenerate axis wherever that geometry happens to
        // be authored rather than vertically.
        DUST_MAT.copy(root.matrixWorld).invert().multiply(m.matrixWorld)
        if (bb) DUST_BOX.copy(bb).applyMatrix4(DUST_MAT)
        // Meters above the model's own grade.
        const centreY = bb
          ? (DUST_BOX.min.y + DUST_BOX.max.y) / 2 / localPerM
          : 0
        // Below grade the gradient has nothing to measure. Dust here is a
        // statement about height above the REGOLITH SURFACE — thrown up by
        // boots and wheels and settling back — and a vault liner seven meters
        // down is not low on that surface, it is inside something. Left at its
        // authored colour instead, because otherwise a buried habitat's whole
        // interior clamps to full dust and renders as one uniform brown, which
        // is the opposite of the point. The threshold is a metre rather than
        // zero because plenty of surface models bed a skirt or a foot slightly
        // into the ground, and those are still standing on it.
        if (bb && centreY >= DUST_BURIED_M) {
          if (!mat.userData.dustBaseColor)
            mat.userData.dustBaseColor = tint.color.clone()
          const flat = DUST_BOX.max.y - DUST_BOX.min.y < DUST_FLAT_M * localPerM
          const t = Math.min(
            1,
            Math.max(0, (centreY - DUST_FULL_M) / (DUST_HEIGHT_M - DUST_FULL_M))
          )
          const w = flat ? 0 : DUST_MAX * (1 - t) * (1 - t)
          // Dust first, then this unit's own wear over the top of it — the
          // order matters: wear is a property of THIS unit's surface, so it has
          // to modulate what that surface actually looks like now, coating and
          // all, rather than being blended away under a coat of dust.
          DUST_WANT.copy(mat.userData.dustBaseColor)
            .lerp(DUST, w)
            .multiplyScalar(wearValue)
          if (!tint.color.equals(DUST_WANT)) tint.color.copy(DUST_WANT)

          if (tint.roughness !== undefined) {
            if (mat.userData.wearBaseRough === undefined)
              mat.userData.wearBaseRough = tint.roughness
            // Rougher low down as well as browner: the same abrasive that
            // discolours a surface also frosts it. Clamped short of a perfect
            // mirror at one end and of total diffusion at the other, both of
            // which read as a material error rather than as wear.
            const rough = Math.min(
              1,
              Math.max(
                0.04,
                mat.userData.wearBaseRough + wearRough + w * 0.25
              )
            )
            if (tint.roughness !== rough) tint.roughness = rough
          }
        }
      }

      const want = mat.userData.dimBaseOpacity * dim
      // Guarded: writing `transparent` unconditionally would bump the material
      // version every render and force a shader recompile.
      if (mat.opacity !== want) mat.opacity = want
      const wantTransparent = mat.userData.dimBaseTransparent || dim < 1
      if (mat.transparent !== wantTransparent) mat.transparent = wantTransparent
      // depthWrite is left ON while dimmed. A dimmed model with depth writing
      // reads as faded; one without it reads as an x-ray of its own internals,
      // because every part behind the hull shows through.
    })
  })

  return (
    <group
      ref={groupRef}
      position={position}
      quaternion={quaternion}
      scale={scale}
      onClick={
        interactive
          ? (e) => {
              // Stop here so the Moon mesh behind the model doesn't also
              // receive the click and immediately deselect.
              e.stopPropagation()
              if (e.delta <= CLICK_DRAG_TOLERANCE_PX) onClick?.()
            }
          : undefined
      }
      onPointerOver={
        interactive
          ? (e) => {
              e.stopPropagation()
              onHoverChange?.(true)
              document.body.style.cursor = 'pointer'
            }
          : undefined
      }
      onPointerOut={
        interactive
          ? (e) => {
              e.stopPropagation()
              onHoverChange?.(false)
              document.body.style.cursor = 'auto'
            }
          : undefined
      }
    >
      {children}
    </group>
  )
}

type ProjectModelProps = {
  project: Project
  dir: Vec3 // unit surface direction (declustered)
  accent: string
  surfaceRadius?: number
  // Radians this SITE is turned off the base's common heading. It comes from
  // the site's plan entry rather than the project's type, because a site can
  // host a cross-category race — the hardware standing there still has to face
  // the way the plan says that plot faces.
  turn?: number
  // World-space direction this site's hardware is driving, if it is under way
  // rather than parked on its plot. Supersedes `turn`.
  noseAlong?: Vec3
  // Fraction of full opacity — 1 unless another race is the subject and this
  // project's district is being held back.
  dim?: number
  // The model itself is a click/hover target, same as its marker pin — when
  // zoomed in, the installation is the obvious thing to click.
  onSelect?: (id: string) => void
  onHover?: (id: string | null) => void
  // Ground under each of the mass driver's trestle bents, in meters relative to
  // its seat. Sampled by MarkerLayer, which is the layer that holds the terrain
  // sampler; unused by every other project. See MassDriver.
  trackGround?: number[]
}

export default function ProjectModel({
  project,
  dir,
  accent,
  surfaceRadius,
  turn,
  noseAlong,
  dim,
  onSelect,
  onHover,
  trackGround,
}: ProjectModelProps) {
  const isBase = project.type === 'habitat'
  const frontAz =
    (project.modelURI ? MODEL_FRONT_AZ[project.modelURI] : undefined) ?? 0
  const buried = buriedVault(project.id)

  return (
    <SurfaceAnchor
      dir={dir}
      surfaceRadius={surfaceRadius}
      scale={projectScale(project)}
      turn={turn}
      // A buried habitat's axis is handed down from the layout (see vaultAxis),
      // because the cutaway camera has to stand at a known end of it. Everything
      // else keeps the camera-facing heading, and a driving competitor's travel
      // direction still wins over both.
      noseAlong={noseAlong}
      dim={dim}
      frontAz={frontAz}
      onClick={() => onSelect?.(project.id)}
      onHoverChange={(h) => onHover?.(h ? project.id : null)}
    >
      {buried ? (
        <BuriedHabitat project={project} accent={accent} />
      ) : project.modelURI ? (
        <Suspense
          fallback={
            <ProceduralModel
              project={project}
              accent={accent}
              trackGround={trackGround}
            />
          }
        >
          {/* Landers touch down on a prepared pad; everything else stands
              directly on the regolith (GLBs are seated with their lowest
              point on the ground, so they need no plinth to rest on). */}
          {/* A pad about three vehicle diameters across. The old 1.15 put a
              70 m deck under a 9 m ship, which pushed the landing zone —
              and with it the whole northern half of the plan — a pad radius
              further out than it had any reason to be. */}
          {project.type === 'lander' && (
            <LandingPad
              r={0.85}
              yaw={frontAz + PAD_CUT_OFFSET}
              accent={accent}
            />
          )}
          <GLBModel url={project.modelURI} transform={project.modelTransform} />
          {isBase && <AstronautCompanion accent={accent} />}
        </Suspense>
      ) : (
        <ProceduralModel
          project={project}
          accent={accent}
          trackGround={trackGround}
        />
      )}
    </SurfaceAnchor>
  )
}

// Warm the cache so drilling into a project shows its model immediately.
;[
  '/moonbase/models/perseverance-rover.glb',
  '/moonbase/models/viking-lander.glb',
  '/moonbase/models/starship-hls.glb',
].forEach((u) => useGLTF.preload(u, DRACO_PATH))
