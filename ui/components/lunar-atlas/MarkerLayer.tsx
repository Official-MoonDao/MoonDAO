// 3D marker layer for the Lunar Atlas globe. Each located project gets a pin
// that rises off the surface with a glowing, organization-colored dot and a
// thin stem. Tightly-packed projects (e.g. the South Pole cluster) are fanned
// out so their markers don't overlap. Pins on the far side of the Moon fade
// out; hovering reveals a compact label; clicking selects the project. Timeline
// state (from the year scrubber) modulates opacity/visibility.

import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  declusterDirections,
  vector3ToLatLon,
  Vec3,
} from '@/lib/lunar-atlas/geo'
import { orgColor } from '@/lib/lunar-atlas/display'
import { GLOBE_RADIUS } from '@/lib/lunar-atlas/textures'
import type { Organization, Project } from '@/lib/lunar-atlas/types'
import ProjectModel from './ProjectModel'
import type { RadiusAt } from './useTerrainSampler'

export type MarkerStyle = { opacity: number; visible: boolean }

type MarkerLayerProps = {
  projects: Project[]
  organizations: Organization[]
  selectedProjectId?: string | null
  hoveredProjectId?: string | null
  onSelect?: (id: string) => void
  onHover?: (id: string | null) => void
  getProjectStyle?: (project: Project) => MarkerStyle
  dirMap?: Map<string, Vec3>
  // Displaced terrain radius lookup so pins/models sit on the rendered ground.
  radiusAt?: RadiusAt | null
}

// Offsets above the local terrain (which the sampler provides per marker).
const SEAT_LIFT = GLOBE_RADIUS * 0.002 // clears z-fighting with the terrain
const PIN_HEIGHT = GLOBE_RADIUS * 0.045 // beacon dot altitude above ground
const DOT_RADIUS = GLOBE_RADIUS * 0.009
// As the camera closes in, dots fade so the detailed on-surface models take
// over (findability beacons far, physical builds near).
const FADE_NEAR = GLOBE_RADIUS * 0.22
const FADE_FAR = GLOBE_RADIUS * 0.62

function Marker({
  project,
  dir,
  color,
  selected,
  hovered,
  style,
  onSelect,
  onHover,
  radiusAt,
}: {
  project: Project
  dir: Vec3
  color: string
  selected: boolean
  hovered: boolean
  style: MarkerStyle
  onSelect?: (id: string) => void
  onHover?: (id: string | null) => void
  radiusAt?: RadiusAt | null
}) {
  const { camera } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const dotRef = useRef<THREE.Mesh>(null)
  const stemRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const scaleRef = useRef(1)

  const { base, tip, ndir, seatRadius } = useMemo(() => {
    const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize()
    // Seat on the displaced terrain at this (declustered) direction; until
    // the DEM decodes, fall back to the analytic sphere.
    const ll = vector3ToLatLon([d.x, d.y, d.z])
    const ground = radiusAt ? radiusAt(ll.lat, ll.lon) : GLOBE_RADIUS
    const seat = ground + SEAT_LIFT
    return {
      base: d.clone().multiplyScalar(seat),
      tip: d.clone().multiplyScalar(seat + PIN_HEIGHT),
      ndir: d,
      // The model sits exactly on the sampled ground — its skirted pad
      // handles footprint-scale terrain variation. Only the stem/dot get the
      // z-fighting lift.
      seatRadius: ground,
    }
  }, [dir, radiusAt])

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

    // Ease dot scale toward its hover/selected target.
    const target = selected ? 1.6 : hovered ? 1.35 : 1
    scaleRef.current += (target - scaleRef.current) * (1 - Math.pow(0.001, delta))
    if (dotRef.current) {
      dotRef.current.scale.setScalar(scaleRef.current)
      const mat = dotRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = beaconOpacity
      mat.emissiveIntensity = (selected ? 2.4 : hovered ? 1.8 : 1.1) * limb
      dotRef.current.visible = beaconOpacity > 0.02
    }
    if (stemRef.current) {
      const smat = stemRef.current.material as THREE.MeshBasicMaterial
      smat.opacity = beaconOpacity * 0.6
      stemRef.current.visible = beaconOpacity > 0.02
    }
    if (ringRef.current) {
      // Selection halo is a *locator* for the selected project — useful from
      // orbit, but up close (surface view) it would fill the screen and sit
      // on top of the model, so it fades out with the same proximity ramp as
      // the beacon dot.
      const haloOpacity = 0.85 * limb * proximity
      ringRef.current.visible = selected && haloOpacity > 0.02
      ringRef.current.lookAt(camera.position)
      const t = performance.now() * 0.003
      const pulse = 1 + Math.sin(t) * 0.1
      ringRef.current.scale.setScalar(pulse)
      const rmat = ringRef.current.material as THREE.MeshBasicMaterial
      rmat.opacity = haloOpacity
    }
  })

  const handleOver = (e: any) => {
    e.stopPropagation()
    onHover?.(project.id)
    document.body.style.cursor = 'pointer'
  }
  const handleOut = (e: any) => {
    e.stopPropagation()
    onHover?.(null)
    document.body.style.cursor = 'auto'
  }

  const stemMid = base.clone().lerp(tip, 0.5)
  const stemLen = base.distanceTo(tip)
  const stemQuat = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ndir.clone().normalize())
    return q
  }, [ndir])

  return (
    <group ref={groupRef}>
      {/* On-surface 3D model (hidden for not-yet-revealed / cancelled items) */}
      {style.opacity > 0.5 && (
        <ProjectModel
          project={project}
          dir={[ndir.x, ndir.y, ndir.z]}
          accent={color}
          onSelect={onSelect}
          onHover={onHover}
          surfaceRadius={seatRadius}
        />
      )}

      {/* Stem */}
      <mesh ref={stemRef} position={stemMid} quaternion={stemQuat}>
        <cylinderGeometry
          args={[GLOBE_RADIUS * 0.0015, GLOBE_RADIUS * 0.0015, stemLen, 6]}
        />
        <meshBasicMaterial color={color} transparent opacity={style.opacity * 0.6} />
      </mesh>

      {/* Selection halo — billboarded, always drawn on top */}
      <mesh ref={ringRef} position={tip} visible={false} renderOrder={10}>
        <ringGeometry args={[DOT_RADIUS * 2.4, DOT_RADIUS * 3.1, 48]} />
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

      {/* Glowing dot */}
      <mesh
        ref={dotRef}
        position={tip}
        onClick={(e) => {
          e.stopPropagation()
          onSelect?.(project.id)
        }}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
      >
        <sphereGeometry args={[DOT_RADIUS, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.1}
          transparent
          opacity={style.opacity}
          toneMapped={false}
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
          <div className="-translate-y-5 whitespace-nowrap rounded border border-white/15 bg-black/75 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white shadow-md backdrop-blur-sm">
            {project.name}
          </div>
        </Html>
      )}
    </group>
  )
}

export default function MarkerLayer({
  projects,
  organizations,
  selectedProjectId,
  hoveredProjectId,
  onSelect,
  onHover,
  getProjectStyle,
  dirMap: providedDirMap,
  radiusAt,
}: MarkerLayerProps) {
  const orgMap = useMemo(() => {
    const m = new Map<string, Organization>()
    for (const o of organizations) m.set(o.id, o)
    return m
  }, [organizations])

  const located = useMemo(() => projects.filter((p) => p.location), [projects])

  // Fan out overlapping markers into readable rings. Prefer a shared map from
  // the page (so camera focus and markers agree) and fall back to computing it.
  const computedDirMap = useMemo(
    () =>
      declusterDirections(
        located.map((p) => ({
          id: p.id,
          lat: p.location!.lat,
          lon: p.location!.lon,
        }))
      ),
    [located]
  )
  const dirMap = providedDirMap ?? computedDirMap

  return (
    <group>
      {located.map((project) => {
        const style = getProjectStyle?.(project) ?? { opacity: 1, visible: true }
        if (!style.visible) return null
        const dir = dirMap.get(project.id)
        if (!dir) return null
        return (
          <Marker
            key={project.id}
            project={project}
            dir={dir}
            color={orgColor(orgMap.get(project.orgId))}
            selected={selectedProjectId === project.id}
            hovered={hoveredProjectId === project.id}
            style={style}
            onSelect={onSelect}
            onHover={onHover}
            radiusAt={radiusAt}
          />
        )
      })}
    </group>
  )
}
