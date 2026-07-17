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
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { GLOBE_RADIUS } from '@/lib/lunar-atlas/textures'
import type { ModelTransform, Project, ProjectType } from '@/lib/lunar-atlas/types'
import type { Vec3 } from '@/lib/lunar-atlas/geo'

const SURFACE = GLOBE_RADIUS * 1.004
// Local model space is ~unit-scale; this maps it onto the globe. Fixed size —
// models don't grow on selection; clicking simply zooms the camera in.
const MODEL_SCALE = GLOBE_RADIUS * 0.045

const ASTRONAUT_URI = '/lunar-atlas/models/astronaut.glb'
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
// Compacted/graded site regolith: read as slightly darker and warmer than the
// surrounding LROC-gray terrain — a worked surface, not a brown disc.
const REGOLITH = '#5c5a55'

// A cleared-regolith pad that visually seats an installation on the terrain.
// Skirted foundation, not a flat disc: the rendered ground under a footprint
// this size curves away and undulates by more than a rover wheel's height, so
// a flat disc reads as hovering. The apron's flared sides drop well below the
// sampled ground and swallow every gap; the buried excess is invisible.
function Pad({ r = 1.2 }: { r?: number }) {
  return (
    <mesh position={[0, 0.01 - 0.155, 0]}>
      <cylinderGeometry args={[r, r * 1.1, 0.31, 40]} />
      <meshStandardMaterial color={REGOLITH} roughness={1} metalness={0} />
    </mesh>
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

function CrewedBase({ accent }: { accent: string }) {
  return (
    <group>
      <Pad r={1.5} />
      {/* two habitat modules in an L, joined by a node */}
      <group position={[-0.55, 0, -0.1]}>
        <Module length={1.1} radius={0.32} accent={accent} />
      </group>
      <group position={[0.5, 0, 0.35]} rotation={[0, Math.PI / 2.5, 0]}>
        <Module length={0.9} radius={0.28} accent={accent} />
      </group>
      {/* connecting node */}
      <mesh position={[0.0, 0.3, 0.1]}>
        <sphereGeometry args={[0.26, 18, 14]} />
        <meshStandardMaterial color={HULL} roughness={0.75} metalness={0.15} />
      </mesh>
      {/* connecting tube */}
      <mesh position={[-0.05, 0.22, 0.0]} rotation={[0, 0.5, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.7, 12]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.7} />
      </mesh>
      {/* solar farm to one side */}
      <group position={[-1.0, 0, 0.7]} scale={0.85}>
        <SolarArray wings={2} accent={accent} />
      </group>
      {/* comms */}
      <group position={[0.95, 0, -0.55]} scale={0.8}>
        <DishAntenna accent={accent} />
      </group>
      {/* small rover parked nearby */}
      <group position={[0.35, 0, 0.95]} scale={0.5} rotation={[0, -0.6, 0]}>
        <RoverBody accent={accent} />
      </group>
    </group>
  )
}

function Habitat({ accent }: { accent: string }) {
  return (
    <group>
      <Pad r={1.0} />
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
      <Pad r={1.1} />
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
  return (
    <group>
      <Pad r={0.9} />
      <RoverBody accent={accent} />
    </group>
  )
}

function IsruPlant({ accent }: { accent: string }) {
  return (
    <group>
      <Pad r={1.1} />
      {/* main reactor tank */}
      <mesh position={[-0.35, 0.55, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 1.0, 16]} />
        <meshStandardMaterial color={HULL} roughness={0.55} metalness={0.35} />
      </mesh>
      <mesh position={[-0.35, 1.08, 0]}>
        <sphereGeometry args={[0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={HULL} roughness={0.55} metalness={0.35} />
      </mesh>
      {/* secondary tanks */}
      {[0.35, 0.62].map((x, i) => (
        <mesh key={i} position={[x, 0.4 + i * 0.05, i % 2 ? 0.2 : -0.2]}>
          <cylinderGeometry args={[0.16, 0.16, 0.6, 12]} />
          <meshStandardMaterial color={HULL_DARK} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {/* piping */}
      <mesh position={[0.0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.15, 0.28, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
        <meshStandardMaterial color={METAL} metalness={0.4} />
      </mesh>
      <mesh position={[-0.35, 1.42, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Power({ accent }: { accent: string }) {
  return (
    <group>
      <Pad r={1.1} />
      {/* reactor drum + shielding */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.24, 0.28, 0.5, 12]} />
        <meshStandardMaterial color={HULL_DARK} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* central truss tower */}
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 1.1, 8]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.5} />
      </mesh>
      {/* radiator fins fanned out */}
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.35, 0.95, Math.sin(a) * 0.35]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.5, 0.7, 0.015]} />
            <meshStandardMaterial color="#cfd3da" metalness={0.2} roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
        )
      })}
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
    </group>
  )
}

function CommsPnt({ accent }: { accent: string }) {
  return (
    <group>
      <Pad r={0.9} />
      <DishAntenna accent={accent} scale={1.4} />
    </group>
  )
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

// A landing-pad construction site: hardened sintered pad, berm ring with an
// approach gap, edge beacons, and a construction robot at work. Used for the
// landing-pad race competitors — deliberately generic infrastructure, not a
// fake render of any company's proprietary hardware.
function ConstructionSite({ accent }: { accent: string }) {
  const bermMounds = 9
  const beacons = 4
  return (
    <group>
      <Pad r={1.5} />
      {/* hardened (sintered) pad surface — darker and smoother than regolith */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 48]} />
        <meshStandardMaterial color="#565b66" roughness={0.45} metalness={0.15} />
      </mesh>
      {/* pad edge marking ring */}
      <mesh position={[0, 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.78, 0.84, 48]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.5}
          roughness={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* berm ring: regolith mounds with a gap left for the approach road */}
      {Array.from({ length: bermMounds }, (_, i) => {
        const a = (i / bermMounds) * Math.PI * 1.65 + Math.PI * 0.2
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 1.25, 0.05, Math.sin(a) * 1.25]}
            rotation={[0, -a, 0]}
            scale={[0.34, 0.13, 0.16]}
          >
            <sphereGeometry args={[1, 10, 7]} />
            <meshStandardMaterial color={REGOLITH} roughness={1} metalness={0} />
          </mesh>
        )
      })}
      {/* approach road through the berm gap */}
      <mesh position={[1.05, 0.008, -0.32]} rotation={[-Math.PI / 2, 0, 0.3]}>
        <planeGeometry args={[0.9, 0.34]} />
        <meshStandardMaterial color="#4c5058" roughness={0.6} metalness={0.1} />
      </mesh>
      {/* perimeter beacons */}
      {Array.from({ length: beacons }, (_, i) => {
        const a = (i / beacons) * Math.PI * 2 + Math.PI / 4
        const x = Math.cos(a) * 0.95
        const z = Math.sin(a) * 0.95
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 0.09, 0]}>
              <cylinderGeometry args={[0.015, 0.02, 0.18, 6]} />
              <meshStandardMaterial color={METAL} metalness={0.4} />
            </mesh>
            <mesh position={[0, 0.2, 0]}>
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshStandardMaterial
                color={accent}
                emissive={accent}
                emissiveIntensity={1.6}
                toneMapped={false}
              />
            </mesh>
          </group>
        )
      })}
      {/* construction robot working the pad edge */}
      <group position={[0.55, 0, 0.75]} scale={0.45} rotation={[0, -1.1, 0]}>
        <RoverBody accent={accent} />
      </group>
    </group>
  )
}

function GenericStructure({ accent }: { accent: string }) {
  return (
    <group>
      <Pad r={0.9} />
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

function ProceduralModel({ type, accent }: { type: ProjectType; accent: string }) {
  switch (type) {
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
function AstronautCompanion() {
  return (
    <Suspense fallback={null}>
      <group position={[0.9, 0, 0.7]} rotation={[0, -0.7, 0]}>
        <GLBModel url={ASTRONAUT_URI} fitHeight={0.55} />
      </group>
    </Suspense>
  )
}

// Pointer travel beyond this between down and up is a globe drag, not a click.
const CLICK_DRAG_TOLERANCE_PX = 8

type ProjectModelProps = {
  project: Project
  dir: Vec3 // unit surface direction (declustered)
  accent: string
  // Displaced terrain radius at this direction — seats the model on the
  // rendered ground. Falls back to the analytic-sphere constant.
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
  const { position, quaternion } = useMemo(() => {
    const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      d
    )
    return {
      position: d.multiplyScalar(surfaceRadius ?? SURFACE),
      quaternion: q,
    }
  }, [dir, surfaceRadius])

  const isBase = project.type === 'crewed_base' || project.type === 'habitat'

  return (
    <group
      position={position}
      quaternion={quaternion}
      scale={MODEL_SCALE}
      onClick={(e) => {
        // Stop here so the Moon mesh behind the model doesn't also receive
        // the click and immediately deselect.
        e.stopPropagation()
        if (e.delta <= CLICK_DRAG_TOLERANCE_PX) onSelect?.(project.id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        onHover?.(project.id)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        onHover?.(null)
        document.body.style.cursor = 'auto'
      }}
    >
      {project.modelURI ? (
        <Suspense
          fallback={<ProceduralModel type={project.type} accent={accent} />}
        >
          {/* GLBs ship without a ground plane — give surface assets the same
              skirted site pad so they visually bed into the terrain. */}
          {project.type !== 'orbital' && <Pad r={1.15} />}
          <GLBModel url={project.modelURI} transform={project.modelTransform} />
          {isBase && <AstronautCompanion />}
        </Suspense>
      ) : (
        <ProceduralModel type={project.type} accent={accent} />
      )}
    </group>
  )
}

// Warm the cache so drilling into a project shows its model immediately.
;[
  '/lunar-atlas/models/habitat-demo-unit.glb',
  '/lunar-atlas/models/apollo-lunar-module.glb',
  '/lunar-atlas/models/perseverance-rover.glb',
  '/lunar-atlas/models/viking-lander.glb',
  '/lunar-atlas/models/rassor.glb',
  ASTRONAUT_URI,
].forEach((u) => useGLTF.preload(u, DRACO_PATH))
