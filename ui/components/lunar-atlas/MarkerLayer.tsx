// Tech-tree site layer for the Lunar Atlas globe.
//
// The surface shows ONE site per capability category (landers, surface
// construction, ISRU, …) — a generic installation model plus a beacon pin —
// rather than one marker per company. Clicking a site opens that tech tree's
// prediction-market/race view; picking a competitor there swaps the generic
// model for that company's specific model (e.g. lander site → Blue Moon MK2)
// and recolors the beacon with the org's brand color. Pins on the far side of
// the Moon fade out; beacons recede as the camera closes in so the models read.

import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MOON_RADIUS_M, vector3ToLatLon, Vec3 } from '@/lib/lunar-atlas/geo'
import { PROJECT_TYPE_LABEL, orgColor } from '@/lib/lunar-atlas/display'
import { M_TO_UNITS } from '@/lib/lunar-atlas/southpole'
import { GLOBE_RADIUS } from '@/lib/lunar-atlas/textures'
import type { TechTree } from '@/lib/lunar-atlas/selectors'
import type {
  Organization,
  Project,
  ProjectType,
} from '@/lib/lunar-atlas/types'
import ProjectModel, { gradedDeckRadiusM, projectSizeM } from './ProjectModel'
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
// in REAL METERS — the base is true-to-scale on the 16 km ridge patch.
const SEAT_LIFT = 0.5 * M_TO_UNITS // clears z-fighting with the terrain
// Pins are sized to the model they mark: the reticle floats just above the
// asset (a 4.5 m rover gets a ~25 m pin, the 52 m Starship a ~68 m one).
// One fixed height either buried the reticle inside tall models or dwarfed
// the small ones.
const MIN_PIN_HEIGHT_M = 25
const pinHeightUnits = (modelSizeM: number) =>
  Math.max(MIN_PIN_HEIGHT_M, modelSizeM * 1.3) * M_TO_UNITS
// Beacon dimensions, in REAL METERS. These are deliberately hairline: at true
// scale the old pin was a 1.4 m-thick opaque rod under a 6 m emissive ball —
// a plastic lollipop the size of a small building, which is what made the
// markers read as toys next to photoreal hardware. A map marker should be
// instrument-like, so the beacon is now a thin billboarded reticle on a
// tether that dissolves toward the ground instead of a solid mast.
const HEAD_RADIUS = 3.4 * M_TO_UNITS
const STEM_RADIUS = 0.16 * M_TO_UNITS
// As the camera closes in, beacons fade so the detailed on-surface models take
// over (findability markers far, physical builds near). The site drill-in
// parks the camera ~75-80 m out, so NEAR sits just above that: a beacon still
// half-opaque at that range hangs over the very model the user clicked to see.
// The home view sits ~140-225 m out, where beacons stay readable as targets.
const FADE_NEAR = 90 * M_TO_UNITS
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
  const headRef = useRef<THREE.Group>(null)
  const stemRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const scaleRef = useRef(1)

  const { base, tip, ndir, seatRadius } = useMemo(() => {
    const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize()
    const sizeM = projectSizeM(displayProject)
    const ll = vector3ToLatLon([d.x, d.y, d.z])
    // A model on a graded deck (a lander's pad, the construction apron) seats
    // on the highest ground under that deck, whose skirt then grades down over
    // the downhill side. Anything else has nothing to hide a gap with, so it
    // seats on the ground directly beneath it: the footprint maximum would
    // lift it by the terrain's relief across the footprint, which is exactly
    // the "slightly floating" look. Bedding an edge a centimeter into regolith
    // is invisible; hovering is not.
    // Until the height maps decode, fall back to the analytic sphere.
    const deckR = gradedDeckRadiusM(displayProject)
    const ground = !radiusAt
      ? GLOBE_RADIUS
      : deckR !== null
      ? footprintSeatRadius(d, radiusAt, deckR)
      : radiusAt(ll.lat, ll.lon)
    const seat = ground + SEAT_LIFT
    const pinH = pinHeightUnits(sizeM)
    return {
      base: d.clone().multiplyScalar(seat),
      tip: d.clone().multiplyScalar(seat + pinH),
      ndir: d,
      // Models seat on the bare ground height; only the stem/dot take the
      // small z-fight lift.
      seatRadius: ground,
    }
  }, [dir, radiusAt, displayProject])

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
