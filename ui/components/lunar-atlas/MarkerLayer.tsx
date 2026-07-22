// Tech-tree site layer for the Lunar Atlas globe.
//
// The surface shows ONE site per capability category (landers, surface
// construction, ISRU, …) — a generic installation model plus a beacon pin —
// rather than one marker per company. Clicking a site opens that tech tree's
// prediction-market/race view; picking a competitor there swaps the generic
// model for that company's specific model (e.g. lander site → Blue Moon MK2)
// and recolors the beacon with the org's brand color. Pins on the far side of
// the Moon fade out; dots recede as the camera closes in so the models read.

import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { vector3ToLatLon, Vec3 } from '@/lib/lunar-atlas/geo'
import { PROJECT_TYPE_LABEL, orgColor } from '@/lib/lunar-atlas/display'
import { GLOBE_RADIUS } from '@/lib/lunar-atlas/textures'
import type { TechTree } from '@/lib/lunar-atlas/selectors'
import type {
  Organization,
  Project,
  ProjectType,
} from '@/lib/lunar-atlas/types'
import ProjectModel from './ProjectModel'
import type { RadiusAt } from './useTerrainSampler'

// The competitor a tech-tree site shows by default: the front-runner by market
// odds, or the sole/first member when the race has no odds yet. This is what
// makes each site read as "who's currently winning this capability".
function leadingProject(tree: TechTree): Project | undefined {
  if (tree.projects.length === 0) return undefined
  const odds = tree.goal?.market?.impliedOdds
  if (odds) {
    return [...tree.projects].sort(
      (a, b) => (odds[b.id] ?? -1) - (odds[a.id] ?? -1)
    )[0]
  }
  return tree.projects[0]
}

export type MarkerStyle = { opacity: number; visible: boolean }

type MarkerLayerProps = {
  trees: TechTree[]
  organizations: Organization[]
  selectedTreeCategory?: ProjectType | null
  // Competitor picked from a race panel — its model replaces the generic
  // site asset for its category.
  selectedProject?: Project | null
  hoveredCategory?: ProjectType | null
  onSelectTree?: (category: ProjectType) => void
  onHoverTree?: (category: ProjectType | null) => void
  // Timeline styling per member project; the site aggregates its members.
  getProjectStyle?: (project: Project) => MarkerStyle
  // Declustered site directions keyed by category (shared with the camera).
  dirMap?: Map<string, Vec3>
  // Displaced terrain radius lookup so pins/models sit on the rendered ground.
  radiusAt?: RadiusAt | null
}

// Offsets above the local terrain (which the sampler provides per marker),
// tuned to the south-pole cap's scale (the cap is ~0.42 GLOBE_RADIUS across).
const SEAT_LIFT = GLOBE_RADIUS * 0.0002 // clears z-fighting with the terrain
const PIN_HEIGHT = GLOBE_RADIUS * 0.007 // beacon dot altitude above ground
const DOT_RADIUS = GLOBE_RADIUS * 0.0014
// As the camera closes in, dots fade so the detailed on-surface models take
// over (findability beacons far, physical builds near). The site drill-in
// parks the camera ~0.09 GLOBE_RADIUS from the beacon, which must land well
// past NEAR — an unfaded dot at that range is a screen-filling balloon that
// hides the model it marks. The overview sits at ~0.6, comfortably past FAR.
const FADE_NEAR = GLOBE_RADIUS * 0.055
const FADE_FAR = GLOBE_RADIUS * 0.16
// Angular radius (radians) of a site model's ground footprint. Real polar
// terrain varies by more than a model's height across a footprint this size,
// so a model seated on the *center* height buries its edges on any slope.
const FOOTPRINT_ANG = 0.007

// The highest rendered ground within the footprint around `d` — the model
// seats there and its skirted pad drops to cover the downhill side.
function footprintSeatRadius(d: THREE.Vector3, radiusAt: RadiusAt): number {
  const ll = vector3ToLatLon([d.x, d.y, d.z])
  let seat = radiusAt(ll.lat, ll.lon)
  // Tangent basis at d (d is never at the equator here, but guard anyway).
  const ref =
    Math.abs(d.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)
  const u = new THREE.Vector3().crossVectors(ref, d).normalize()
  const w = new THREE.Vector3().crossVectors(d, u)
  const cosA = Math.cos(FOOTPRINT_ANG)
  const sinA = Math.sin(FOOTPRINT_ANG)
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

function TechTreeSite({
  tree,
  dir,
  color,
  selected,
  hovered,
  style,
  displayProject,
  label,
  onSelect,
  onHover,
  radiusAt,
}: {
  tree: TechTree
  dir: Vec3
  color: string
  selected: boolean
  hovered: boolean
  style: MarkerStyle
  // The project whose model this site renders: the leading company's asset by
  // default, or a specific competitor once one is picked from the race panel.
  displayProject: Project
  label: string
  onSelect?: (category: ProjectType) => void
  onHover?: (category: ProjectType | null) => void
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
    // Seat on the highest rendered ground within the model's footprint (a
    // center-only sample buries the model's uphill edge on any slope); until
    // the height maps decode, fall back to the analytic sphere.
    const ground = radiusAt ? footprintSeatRadius(d, radiusAt) : GLOBE_RADIUS
    const seat = ground + SEAT_LIFT
    return {
      base: d.clone().multiplyScalar(seat),
      tip: d.clone().multiplyScalar(seat + PIN_HEIGHT),
      ndir: d,
      // The model sits on the footprint-max ground — its skirted pad drops
      // to cover the downhill gaps. Only the stem/dot get the z-fight lift.
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
      // Selection halo is a *locator* for the selected site — useful from
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

  const stemMid = base.clone().lerp(tip, 0.5)
  const stemLen = base.distanceTo(tip)
  const stemQuat = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ndir.clone().normalize())
    return q
  }, [ndir])

  const handleHoverChange = (h: boolean) => onHover?.(h ? tree.category : null)

  return (
    <group ref={groupRef}>
      {/* On-surface 3D model: the leading company's asset by default, or the
          picked competitor's model once one is selected from the race panel. */}
      {style.opacity > 0.5 && (
        <ProjectModel
          project={displayProject}
          dir={[ndir.x, ndir.y, ndir.z]}
          accent={color}
          onSelect={() => onSelect?.(tree.category)}
          onHover={(id) => onHover?.(id ? tree.category : null)}
          surfaceRadius={seatRadius}
        />
      )}

      {/* Stem */}
      <mesh ref={stemRef} position={stemMid} quaternion={stemQuat}>
        <cylinderGeometry
          args={[GLOBE_RADIUS * 0.00025, GLOBE_RADIUS * 0.00025, stemLen, 6]}
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
      <mesh ref={dotRef} position={tip}>
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

      {/* Generous invisible hit target around the dot — the beacon itself is
          only a few pixels from orbit, far too small to click reliably. */}
      <mesh
        position={tip}
        onClick={(e) => {
          e.stopPropagation()
          onSelect?.(tree.category)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          handleHoverChange(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          handleHoverChange(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <sphereGeometry args={[DOT_RADIUS * 4.5, 8, 8]} />
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
          <div className="-translate-y-5 whitespace-nowrap rounded border border-white/15 bg-black/75 px-1.5 py-0.5 text-center text-[10px] font-medium leading-tight text-white shadow-md backdrop-blur-sm">
            {label}
          </div>
        </Html>
      )}
    </group>
  )
}

export default function MarkerLayer({
  trees,
  organizations,
  selectedTreeCategory,
  selectedProject,
  hoveredCategory,
  onSelectTree,
  onHoverTree,
  getProjectStyle,
  dirMap,
  radiusAt,
}: MarkerLayerProps) {
  const orgMap = useMemo(() => {
    const m = new Map<string, Organization>()
    for (const o of organizations) m.set(o.id, o)
    return m
  }, [organizations])

  return (
    <group>
      {trees.map((tree) => {
        // A site is as visible as its most-visible member at the current
        // timeline year — it appears when the first member program appears.
        let opacity = 0
        for (const p of tree.projects) {
          const s = getProjectStyle?.(p) ?? { opacity: 1, visible: true }
          if (s.visible) opacity = Math.max(opacity, s.opacity)
        }
        if (opacity <= 0) return null
        const style: MarkerStyle = { opacity, visible: true }

        const dir = dirMap?.get(tree.category)
        if (!dir) return null

        // A competitor picked from the race panel overrides the default; with
        // nothing picked, the site shows the *leading* company's asset (top
        // market odds), not a generic category placeholder. The pick renders
        // at the *focused* site (which may host a cross-category race), not
        // the competitor's own type — so selecting one never jumps sites.
        const picked =
          selectedProject && selectedTreeCategory === tree.category
            ? selectedProject
            : null
        const shown = picked ?? leadingProject(tree)
        if (!shown) return null
        const org = orgMap.get(shown.orgId)
        const color = orgColor(org)
        // A race's roster can span categories (e.g. the power race includes
        // an ISRU plant), so count the goal's competitors, not the tree's
        // same-type members — the label must match the panel it opens.
        const count = tree.goal
          ? tree.goal.projectIds.length
          : tree.projects.length
        const label = picked
          ? picked.name
          : tree.goal && org
          ? `${PROJECT_TYPE_LABEL[tree.category]} · ${org.name} leading`
          : `${PROJECT_TYPE_LABEL[tree.category]} · ${count} ${
              tree.goal ? 'competitor' : 'project'
            }${count === 1 ? '' : 's'}`

        return (
          <TechTreeSite
            key={tree.category}
            tree={tree}
            dir={dir}
            color={color}
            selected={
              selectedTreeCategory === tree.category || Boolean(picked)
            }
            hovered={hoveredCategory === tree.category}
            style={style}
            displayProject={shown}
            label={label}
            onSelect={onSelectTree}
            onHover={onHoverTree}
            radiusAt={radiusAt}
          />
        )
      })}
    </group>
  )
}
