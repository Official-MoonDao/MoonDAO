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
import {
  ComponentType,
  ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import * as THREE from 'three'
import { HOME_CAM } from '@/lib/lunar-atlas/homeview'
import { M_TO_UNITS } from '@/lib/lunar-atlas/southpole'
import { GLOBE_RADIUS } from '@/lib/lunar-atlas/textures'
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
  // The full camp, dome to dome across the connector spine. CAMP_M below
  // inverts this exact number, so the camp is authored in real meters.
  crewed_base: 38,
  habitat: 9,
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
  orbital: 20,
}
const PROJECT_SIZE_M: Record<string, number> = {
  'spacex-starship-hls': 52, // Ship upper stage ~50 m + gear
  'blue-origin-blue-moon-mk1': 8,
  'blue-origin-blue-moon-mk2': 16,
  'nasa-artemis-iii': 12, // crewed HLS touchdown stack
  // Bumper to array, roughly LTV class. RACER_M inverts this exact number, so
  // the rover is authored in real meters.
  'im-moon-racer': 4.6,
  // Light bar to rear wheel — Astrolab pitch FLEX as Jeep-sized. FLEX_M
  // inverts this exact number.
  'astrolab-flex': 4.2,
  // Bumper to tailgate. The longest of the three LTV bids, and it looks it —
  // cab forward, cargo aft. VOY_M inverts this exact number.
  'lunar-outpost-lunar-dawn': 4.4,
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
  const f = GRADED_DECK_FRACTION[project.type]
  return f === undefined ? null : projectSizeM(project) * f
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
  // X 6.4 m ≈ Z 6.4 m — radially symmetric, any bearing reads the same.
  '/moonbase/models/apollo-lunar-module.glb': 0,
  // X 6.1 > Z 2.8: solar wings span the view.
  '/moonbase/models/insight-lander.glb': 0,
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

// The yaw (about the model's own up axis) that turns `frontAz` toward the
// home viewpoint. Models hold this heading as the user orbits — ground
// installations shouldn't pivot to track the camera — so the base always
// looks deliberately arranged from the angle it is first seen at.
function facingYaw(
  anchorPos: THREE.Vector3,
  alignedToSurface: THREE.Quaternion,
  frontAz: number
) {
  const toCam = new THREE.Vector3(...HOME_CAM)
    .sub(anchorPos)
    .applyQuaternion(alignedToSurface.clone().invert())
  return Math.atan2(toCam.x, toCam.z) - frontAz
}

const ASTRONAUT_URI = '/moonbase/models/astronaut.glb'
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

// Only LANDERS get a pad — every other installation sits directly on the
// regolith (a pedestal under a rover or reactor read as a plinth in a museum,
// not equipment on the Moon). A landing pad is real infrastructure though:
// a graded deck with a flared skirt that grades down into the terrain (the
// lander seats on the highest ground under its footprint, so on a slope the
// downhill side would otherwise hover) ringed by a short blast wall.
function LandingPad({
  r = 1.2,
  wallHeight = 0.09,
}: {
  r?: number
  wallHeight?: number
}) {
  const wallR = r * 0.98
  return (
    <group>
      {/* Graded deck + skirt. The skirt grades down into the regolith so the
          downhill side never hovers. */}
      <mesh position={[0, 0.01 - 0.24, 0]}>
        <cylinderGeometry args={[r, r * 1.34, 0.5, 48]} />
        <meshStandardMaterial color={PAD_SURFACE} roughness={0.98} />
      </mesh>
      {/* Short perimeter blast wall. Open-ended and double-sided so the
          inside face shows too — the camera often looks down into the pad. */}
      <mesh position={[0, 0.02 + wallHeight / 2, 0]}>
        <cylinderGeometry args={[wallR, wallR, wallHeight, 48, 1, true]} />
        <meshStandardMaterial
          color={PAD_WALL}
          roughness={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Capped top edge, so the wall reads as built rather than as a ring of
          paper seen edge-on. */}
      <mesh
        position={[0, 0.02 + wallHeight, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[wallR, r * 0.014, 6, 48]} />
        <meshStandardMaterial color={PAD_WALL} roughness={0.9} />
      </mesh>
    </group>
  )
}

// A ring of lit windows around a cylindrical module.
function Windows({
  radius,
  y,
  count = 8,
}: {
  radius: number
  y: number
  count?: number
}) {
  const items = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2
    return (
      <mesh key={i} position={[Math.cos(a) * radius, y, Math.sin(a) * radius]} rotation={[0, -a, 0]}>
        <planeGeometry args={[0.06, 0.05]} />
        <meshStandardMaterial
          color={WINDOW}
          emissive={WINDOW}
          emissiveIntensity={1.4}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    )
  })
  return <group>{items}</group>
}

// A detailed solar array: tilted panels on a mast, with a grid of cells.
function SolarArray({
  wings = 2,
  accent,
}: {
  wings?: number
  accent: string
}) {
  return (
    <group>
      {/* mast */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} />
      </mesh>
      {Array.from({ length: wings }, (_, w) => {
        const side = w % 2 === 0 ? 1 : -1
        return (
          <group key={w} position={[side * 0.34, 0.42, 0]} rotation={[0.35, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.6, 0.02, 0.42]} />
              <meshStandardMaterial color={PANEL} metalness={0.3} roughness={0.35} />
            </mesh>
            {/* cell grid */}
            {Array.from({ length: 3 }, (_, i) =>
              Array.from({ length: 2 }, (_, j) => (
                <mesh
                  key={`${i}-${j}`}
                  position={[-0.2 + i * 0.2, 0.012, -0.11 + j * 0.22]}
                >
                  <boxGeometry args={[0.17, 0.006, 0.19]} />
                  <meshStandardMaterial
                    color={PANEL_EDGE}
                    emissive={PANEL_EDGE}
                    emissiveIntensity={0.25}
                    metalness={0.2}
                    roughness={0.3}
                  />
                </mesh>
              ))
            )}
          </group>
        )
      })}
      <mesh position={[0, 0.52, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
    </group>
  )
}

function DishAntenna({ accent, scale = 1 }: { accent: string; scale?: number }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.6, 8]} />
        <meshStandardMaterial color={METAL} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.62, 0.02]} rotation={[Math.PI / 3.2, 0, 0]}>
        <sphereGeometry args={[0.26, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.3]} />
        <meshStandardMaterial color={HULL} side={THREE.DoubleSide} roughness={0.5} metalness={0.2} />
      </mesh>
      {/* feed */}
      <mesh position={[0, 0.64, 0.16]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
    </group>
  )
}

// A pressurized module: horizontal cylinder + domed caps + windows + airlock.
function Module({
  length = 1.1,
  radius = 0.32,
  accent,
}: {
  length?: number
  radius?: number
  accent: string
}) {
  return (
    <group>
      <mesh position={[0, radius, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius, radius, length, 20]} />
        <meshStandardMaterial color={HULL} roughness={0.75} metalness={0.15} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh
          key={s}
          position={[(s * length) / 2, radius, 0]}
          rotation={[0, 0, (s * Math.PI) / 2]}
        >
          <sphereGeometry args={[radius, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={HULL} roughness={0.75} metalness={0.15} />
        </mesh>
      ))}
      {/* structural bands */}
      {[-0.28, 0, 0.28].map((x) => (
        <mesh key={x} position={[x, radius, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[radius + 0.005, 0.012, 8, 24]} />
          <meshStandardMaterial color={HULL_DARK} metalness={0.3} roughness={0.6} />
        </mesh>
      ))}
      <Windows radius={radius + 0.005} y={radius + 0.05} count={6} />
      {/* airlock hatch */}
      <mesh position={[0, radius * 0.7, radius + 0.01]}>
        <circleGeometry args={[0.09, 16]} />
        <meshStandardMaterial color={DARK} metalness={0.4} roughness={0.5} />
      </mesh>
    </group>
  )
}

function Habitat({ accent }: { accent: string }) {
  return (
    <group>
      <Module length={1.0} radius={0.34} accent={accent} />
      <group position={[0, 0, 0.75]} scale={0.7}>
        <SolarArray wings={2} accent={accent} />
      </group>
    </group>
  )
}

function Lander({ accent }: { accent: string }) {
  const legs = [0, 1, 2, 3]
  return (
    <group>
      <LandingPad r={1.1} />
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
    </group>
  )
}

function CommsPnt({ accent }: { accent: string }) {
  return <DishAntenna accent={accent} scale={1.4} />
}

function OrbitalRelay({ accent }: { accent: string }) {
  return (
    <group>
      {/* core */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color={HULL} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* solar wings */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.7, 0.5, 0]}>
          <boxGeometry args={[0.7, 0.02, 0.4]} />
          <meshStandardMaterial color={PANEL} metalness={0.3} roughness={0.35} />
        </mesh>
      ))}
      <group position={[0, 0.2, 0]} scale={0.7}>
        <DishAntenna accent={accent} />
      </group>
    </group>
  )
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

// The hero: a regolith-printing gantry straddling the unfinished edge, feeding
// from a hopper through a boom-mounted head. Deliberately generic construction
// plant — not a model of any company's proprietary machine.
function PrinterGantry({ accent }: { accent: string }) {
  const feet: [number, number][] = [
    [-2.7, 4.6],
    [2.7, 4.6],
    [-2.7, 7.8],
    [2.7, 7.8],
  ]
  const mastTop = 7.2
  const mastZ = 6.4
  // Directly over the next paver in the unfinished course (DECK_LAID leaves
  // the near course short by three tiles), so the machine is demonstrably
  // working on the gap rather than hovering over finished deck.
  const head: [number, number, number] = [-0.4, 3.3, 2.9]
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
            to={[x * 0.52, 2.5, mastZ + (z - mastZ) * 0.35]}
            r={0.13}
          />
        </group>
      ))}

      {/* Chassis + feedstock hopper */}
      <mesh position={[0, 3.0, mastZ]}>
        <boxGeometry args={[3.4, 1.0, 2.6]} />
        <meshStandardMaterial color={HULL} roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 4.4, mastZ + 0.1]}>
        <cylinderGeometry args={[1.25, 0.8, 1.9, 12]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.75} />
      </mesh>

      {/* Lattice mast: two rails zig-zag braced. The mast leans, so the braces
          interpolate along it rather than standing at a fixed depth. */}
      {[-0.85, 0.85].map((x) => (
        <Strut
          key={x}
          from={[x, 3.4, mastZ - 0.6]}
          to={[x, mastTop, mastZ - 0.2]}
          r={0.1}
        />
      ))}
      {[0, 1, 2, 3].map((i) => {
        const y0 = 3.6 + i * 0.9
        const y1 = y0 + 0.9
        const railZ = (y: number) =>
          mastZ - 0.6 + ((y - 3.4) / (mastTop - 3.4)) * 0.4
        return (
          <Strut
            key={i}
            from={[i % 2 ? 0.85 : -0.85, y0, railZ(y0)]}
            to={[i % 2 ? -0.85 : 0.85, y1, railZ(y1)]}
            r={0.05}
          />
        )
      })}

      {/* Boom reaching out over the course being laid */}
      {[-0.7, 0.7].map((x) => (
        <Strut
          key={x}
          from={[x, mastTop, mastZ - 0.2]}
          to={[head[0] + x * 0.5, head[1] + 0.2, head[2]]}
          r={0.09}
        />
      ))}
      {[0, 1, 2].map((i) => {
        const t0 = 0.2 + i * 0.26
        const t1 = t0 + 0.26
        const rail = (t: number, x: number): [number, number, number] => [
          x * (1 - t) + (head[0] + x * 0.5) * t,
          mastTop * (1 - t) + (head[1] + 0.2) * t,
          (mastZ - 0.2) * (1 - t) + head[2] * t,
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
      {/* Back-stay: the boom has to be held up by something. */}
      <Strut
        from={[0, mastTop - 0.1, mastZ - 0.2]}
        to={[0, 3.4, mastZ + 1.3]}
        r={0.06}
      />

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

      {/* Suited figure — the only unambiguous scale cue on an airless plain */}
      <Suspense fallback={null}>
        <group position={[3.5, DECK_Y, 2.3]} rotation={[0, -2.2, 0]}>
          <GLBModel url={ASTRONAUT_URI} fitHeight={1.85} />
        </group>
      </Suspense>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Artemis Base Camp
// ---------------------------------------------------------------------------

// Local units per METER, as in the other true-size installations.
const CAMP_M = UNIT_MAX_DIM / (TYPE_SIZE_M.crewed_base ?? 38)

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

      <group position={[15.5, 0, -10.5]} rotation={[0, -0.22, 0]}>
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

      {/* Suited figures — the only unambiguous scale cue on an airless plain */}
      <Suspense fallback={null}>
        <group position={[1.2, 0, 8.4]} rotation={[0, -1.9, 0]}>
          <GLBModel url={ASTRONAUT_URI} fitHeight={1.85} />
        </group>
        <group position={[-5.6, 0, 4.6]} rotation={[0, 0.7, 0]}>
          <GLBModel url={ASTRONAUT_URI} fitHeight={1.85} />
        </group>
      </Suspense>
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

// Company-specific builds, keyed by project. A named competitor's hardware
// should look like theirs; the per-type model below is the stand-in for
// everyone else in that category.
const PROJECT_MODEL: Record<string, ComponentType<{ accent: string }>> = {
  'im-moon-racer': MoonRacer,
  'astrolab-flex': FlexRover,
  'lunar-outpost-lunar-dawn': VoyagerRover,
}

export function ProceduralModel({
  project,
  accent,
}: {
  project: Project
  accent: string
}) {
  const Custom = PROJECT_MODEL[project.id]
  if (Custom) return <Custom accent={accent} />
  switch (project.type) {
    case 'crewed_base':
      return <CrewedBase accent={accent} />
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
      return <OrbitalRelay accent={accent} />
    case 'construction':
      return <ConstructionSite accent={accent} />
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

// A little astronaut standing beside a crewed base, for scale and life.
// Local units on a 10 m crewed base are ~5.9 m each, so 0.31 units is a
// suited astronaut's ~1.85 m.
function AstronautCompanion() {
  return (
    <Suspense fallback={null}>
      <group position={[0.9, 0, 0.7]} rotation={[0, -0.7, 0]}>
        <GLBModel url={ASTRONAUT_URI} fitHeight={0.31} />
      </group>
    </Suspense>
  )
}

// Pointer travel beyond this between down and up is a globe drag, not a click.
const CLICK_DRAG_TOLERANCE_PX = 8

// Anchors any model on the globe: seats it at the sampled terrain radius
// along `dir`, orients its +Y to the local surface normal, and makes the
// whole thing a drag-tolerant click/hover target. Shared by per-project
// models and the generic tech-tree site models.
export function SurfaceAnchor({
  dir,
  surfaceRadius,
  scale = (10 * M_TO_UNITS) / UNIT_MAX_DIM,
  frontAz = 0,
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
        facingYaw(pos, q, frontAz)
      )
    )
    return { position: pos, quaternion: q }
  }, [dir, surfaceRadius, frontAz])

  // Cast shadows are what actually anchor hardware to the regolith, but three
  // stores the flag per object, so it has to be pushed down the subtree. No
  // dependency list: GLB children mount later (through Suspense), and this is
  // a handful of meshes.
  const groupRef = useRef<THREE.Group>(null)
  useEffect(() => {
    groupRef.current?.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mat = m.material as THREE.Material | undefined
      // Unlit meshes can neither receive shadows nor be shaded, so having
      // them cast would drop hard silhouettes with no lighting to justify
      // them (thin marker rings, decals).
      const unlit = mat?.type === 'MeshBasicMaterial'
      // Glazing must not cast either. A shadow map is binary — it has no
      // notion of opacity — so a greenhouse dome you can see straight through
      // would black out the ground beneath it exactly like a solid one.
      const glazing = !!mat?.transparent && (mat as THREE.MeshStandardMaterial).opacity < 0.9
      m.castShadow = !unlit && !glazing
      m.receiveShadow = !unlit
    })
  })

  return (
    <group
      ref={groupRef}
      position={position}
      quaternion={quaternion}
      scale={scale}
      onClick={(e) => {
        // Stop here so the Moon mesh behind the model doesn't also receive
        // the click and immediately deselect.
        e.stopPropagation()
        if (e.delta <= CLICK_DRAG_TOLERANCE_PX) onClick?.()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        onHoverChange?.(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        onHoverChange?.(false)
        document.body.style.cursor = 'auto'
      }}
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
  // The model itself is a click/hover target, same as its marker pin — when
  // zoomed in, the installation is the obvious thing to click.
  onSelect?: (id: string) => void
  onHover?: (id: string | null) => void
}

export default function ProjectModel({
  project,
  dir,
  accent,
  surfaceRadius,
  onSelect,
  onHover,
}: ProjectModelProps) {
  const isBase = project.type === 'crewed_base' || project.type === 'habitat'

  return (
    <SurfaceAnchor
      dir={dir}
      surfaceRadius={surfaceRadius}
      scale={projectScale(project)}
      frontAz={
        (project.modelURI ? MODEL_FRONT_AZ[project.modelURI] : undefined) ?? 0
      }
      onClick={() => onSelect?.(project.id)}
      onHoverChange={(h) => onHover?.(h ? project.id : null)}
    >
      {project.modelURI ? (
        <Suspense
          fallback={<ProceduralModel project={project} accent={accent} />}
        >
          {/* Landers touch down on a prepared pad; everything else stands
              directly on the regolith (GLBs are seated with their lowest
              point on the ground, so they need no plinth to rest on). */}
          {project.type === 'lander' && <LandingPad r={1.15} />}
          <GLBModel url={project.modelURI} transform={project.modelTransform} />
          {isBase && <AstronautCompanion />}
        </Suspense>
      ) : (
        <ProceduralModel project={project} accent={accent} />
      )}
    </SurfaceAnchor>
  )
}

// Warm the cache so drilling into a project shows its model immediately.
;[
  '/moonbase/models/apollo-lunar-module.glb',
  '/moonbase/models/perseverance-rover.glb',
  '/moonbase/models/viking-lander.glb',
  '/moonbase/models/insight-lander.glb',
  '/moonbase/models/starship-hls.glb',
  ASTRONAUT_URI,
].forEach((u) => useGLTF.preload(u, DRACO_PATH))
