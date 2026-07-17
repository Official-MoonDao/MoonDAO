// Region-level markers for capability races (DePrize-shaped shared goals that
// carry a globe anchor). Deliberately NOT another pin: a race is a zone, not a
// point, so it renders as a pulsing boundary ring draped over the terrain —
// closer to a map annotation than to a project marker. Clicking it opens the
// race panel; hovering shows the goal title.

import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLOBE_RADIUS } from '@/lib/lunar-atlas/textures'
import type { SharedGoal } from '@/lib/lunar-atlas/types'
import { latLonToVector3, vector3ToLatLon } from '@/lib/lunar-atlas/geo'
import type { RadiusAt } from './useTerrainSampler'

type RaceMarkerLayerProps = {
  goals: SharedGoal[]
  onSelect?: (goalId: string) => void
  radiusAt?: RadiusAt | null
}

// Zone dimensions as *angular* radii (radians of arc on the globe) — the zone
// is a region on the surface, so its size is an arc, not a flat width.
const ZONE_OUTER_ANG = 0.055
const ZONE_INNER_ANG = 0.048
const SEAT_LIFT = GLOBE_RADIUS * 0.0025
const RACE_COLOR = '#e879f9' // fuchsia — matches the market pills in the panels

// Direction on the unit sphere at angular distance `ang` from `center`, at
// azimuth `azimuth` in the tangent plane spanned by (u, w).
function offsetDir(
  center: THREE.Vector3,
  u: THREE.Vector3,
  w: THREE.Vector3,
  azimuth: number,
  ang: number
): THREE.Vector3 {
  const tangent = u
    .clone()
    .multiplyScalar(Math.cos(azimuth))
    .add(w.clone().multiplyScalar(Math.sin(azimuth)))
  return center
    .clone()
    .multiplyScalar(Math.cos(ang))
    .add(tangent.multiplyScalar(Math.sin(ang)))
    .normalize()
}

// A ring / disc that is draped over the displaced terrain: every vertex is
// seated on the sampled ground height along its own direction, so the zone
// hugs craters and ridges instead of hovering on a flat plane above them
// (which read as "floating" — the exact bug this replaces).
function buildZoneGeometries(
  lat: number,
  lon: number,
  radiusAt: RadiusAt | null | undefined
): { ring: THREE.BufferGeometry; fill: THREE.BufferGeometry } {
  const c = new THREE.Vector3(...latLonToVector3(lat, lon, 1)).normalize()
  const ref =
    Math.abs(c.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)
  const u = new THREE.Vector3().crossVectors(ref, c).normalize()
  const w = new THREE.Vector3().crossVectors(c, u)

  const seat = (d: THREE.Vector3): THREE.Vector3 => {
    const ll = vector3ToLatLon([d.x, d.y, d.z])
    const ground = radiusAt ? radiusAt(ll.lat, ll.lon) : GLOBE_RADIUS
    return d.clone().multiplyScalar(ground + SEAT_LIFT)
  }

  const SEGMENTS = 128

  // Boundary ring: two draped rims, triangulated as a strip.
  const ringPos: number[] = []
  const ringIdx: number[] = []
  for (let i = 0; i <= SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2
    const inner = seat(offsetDir(c, u, w, a, ZONE_INNER_ANG))
    const outer = seat(offsetDir(c, u, w, a, ZONE_OUTER_ANG))
    ringPos.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z)
    if (i < SEGMENTS) {
      const k = i * 2
      ringIdx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2)
    }
  }
  const ring = new THREE.BufferGeometry()
  ring.setAttribute('position', new THREE.Float32BufferAttribute(ringPos, 3))
  ring.setIndex(ringIdx)

  // Faint interior fill (also the click target) — draped with a few radial
  // rings; it's translucent and depth-write-free, so coarse is fine.
  const RADIAL = 4
  const fillPos: number[] = []
  const fillIdx: number[] = []
  for (let r = 0; r <= RADIAL; r++) {
    const ang = (r / RADIAL) * ZONE_OUTER_ANG
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2
      const p = seat(offsetDir(c, u, w, a, ang))
      fillPos.push(p.x, p.y, p.z)
    }
  }
  const row = SEGMENTS + 1
  for (let r = 0; r < RADIAL; r++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const k = r * row + i
      fillIdx.push(k, k + row, k + 1, k + 1, k + row, k + row + 1)
    }
  }
  const fill = new THREE.BufferGeometry()
  fill.setAttribute('position', new THREE.Float32BufferAttribute(fillPos, 3))
  fill.setIndex(fillIdx)

  return { ring, fill }
}

function RaceMarker({
  goal,
  onSelect,
  radiusAt,
}: {
  goal: SharedGoal
  onSelect?: (goalId: string) => void
  radiusAt?: RadiusAt | null
}) {
  const { camera } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const [hovered, setHovered] = useState(false)

  const { ring, fill, ndir, labelPos } = useMemo(() => {
    const { lat, lon } = goal.location!
    const d = new THREE.Vector3(...latLonToVector3(lat, lon, 1)).normalize()
    const ground = radiusAt ? radiusAt(lat, lon) : GLOBE_RADIUS
    const geos = buildZoneGeometries(lat, lon, radiusAt)
    return {
      ...geos,
      ndir: d,
      labelPos: d.clone().multiplyScalar(ground + SEAT_LIFT),
    }
  }, [goal.location, radiusAt])

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    // Backface fade, same convention as project markers.
    const facing = ndir.dot(camera.position.clone().normalize())
    const limb = THREE.MathUtils.clamp((facing + 0.05) / 0.25, 0, 1)
    g.visible = facing > -0.05
    if (ringMatRef.current) {
      // The geometry is draped in world space, so the pulse is opacity, not
      // scale (scaling would lift it off the terrain again).
      const t = performance.now() * 0.0016
      const pulse = 0.85 + Math.sin(t) * 0.15
      ringMatRef.current.opacity = (hovered ? 0.95 : 0.55) * pulse * limb
    }
  })

  const handleOver = (e: any) => {
    e.stopPropagation()
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }
  const handleOut = (e: any) => {
    e.stopPropagation()
    setHovered(false)
    document.body.style.cursor = 'auto'
  }

  return (
    <group ref={groupRef}>
      {/* Zone boundary ring, draped over the terrain */}
      <mesh geometry={ring}>
        <meshBasicMaterial
          ref={ringMatRef}
          color={RACE_COLOR}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* Faint zone fill — also the click/hover target (the thin ring alone
          would be a hostile hit area). */}
      <mesh
        geometry={fill}
        onClick={(e) => {
          e.stopPropagation()
          onSelect?.(goal.id)
        }}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
      >
        <meshBasicMaterial
          color={RACE_COLOR}
          transparent
          opacity={hovered ? 0.14 : 0.06}
          side={THREE.DoubleSide}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* Hover label */}
      {hovered && (
        <Html
          position={labelPos}
          center
          zIndexRange={[30, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="-translate-y-6 whitespace-nowrap rounded border border-fuchsia-300/30 bg-black/80 px-2 py-1 text-center shadow-md backdrop-blur-sm">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-fuchsia-300">
              Capability race
            </div>
            <div className="text-[10px] font-medium leading-tight text-white">
              {goal.title}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

export default function RaceMarkerLayer({
  goals,
  onSelect,
  radiusAt,
}: RaceMarkerLayerProps) {
  const anchored = useMemo(() => goals.filter((g) => g.location), [goals])
  if (anchored.length === 0) return null
  return (
    <group>
      {anchored.map((g) => (
        <RaceMarker
          key={g.id}
          goal={g}
          onSelect={onSelect}
          radiusAt={radiusAt}
        />
      ))}
    </group>
  )
}
