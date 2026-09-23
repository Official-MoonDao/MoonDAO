// The orbital layer for Moon Base Zero.
//
// MarkerLayer stands every competitor on its own lot. This does the same job
// for the competitors whose hardware never touches the ground — Intuitive
// Machines' relay constellation, ESA's Lunar Pathfinder, and Crescent's
// Parsec — by stationing them overhead instead, each in its own real shape
// via SKY_SAT_MODEL. Where the stations are, and why the altitude is the
// single portrayal in an otherwise true-scale scene, is documented in
// lib/lunar-atlas/skyplan.
//
// A satellite still belongs to its capability race in every other respect: it
// appears and fades on the timeline with the rest of the comms field, dims when
// another race is opened, and selects the same project when clicked. It simply
// has no plot, no beacon and no shadow.

import { Html } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import {
  SKY_STATIONS,
  stationDirection,
  stationRadius,
  type SkyStation,
} from '@/lib/lunar-atlas/skyplan'
import { orgColor } from '@/lib/lunar-atlas/display'
import { M_TO_UNITS, capCenterDirection, capOffsetLatLon } from '@/lib/lunar-atlas/southpole'
import { latLonToVector3, type Vec3 } from '@/lib/lunar-atlas/geo'
import type { TechTree } from '@/lib/lunar-atlas/selectors'
import type { Organization, Project, ProjectType } from '@/lib/lunar-atlas/types'
import {
  RELAY_SCALE,
  RELAY_SPAN_M,
  RelaySat,
  SKY_SAT_MODEL,
  SKY_SAT_SCALE,
  SKY_SAT_SPAN_M,
  SurfaceAnchor,
} from './ProjectModel'
import { DIM_FACTOR, MODEL_PRESENCE, type MarkerStyle } from './MarkerLayer'

// The map patch's tangent frame, fixed for the life of the app. Taken at the
// ridge centre rather than per station: the stations are all within 400 m of it,
// over which the frame turns by less than a hundredth of a degree.
const CAP_UP = new THREE.Vector3(...capCenterDirection()).normalize()
const CAP_EAST = (() => {
  const ll = capOffsetLatLon(100, 0)
  return new THREE.Vector3(...latLonToVector3(ll.lat, ll.lon, 1))
    .projectOnPlane(CAP_UP)
    .normalize()
})()
const CAP_NORTH = new THREE.Vector3().crossVectors(CAP_UP, CAP_EAST).normalize()

// World direction of a compass bearing, in degrees CCW from east.
function bearingVector(deg: number): Vec3 {
  const b = (deg * Math.PI) / 180
  const v = CAP_EAST.clone()
    .multiplyScalar(Math.cos(b))
    .addScaledVector(CAP_NORTH, Math.sin(b))
  return [v.x, v.y, v.z]
}

function Satellite({
  station,
  project,
  accent,
  dim,
  named,
  onSelect,
  onHover,
}: {
  station: SkyStation
  project: Project
  accent: string
  dim: number
  // Whether to hang the project's name off it, as the district lots do while
  // their race is open.
  named: boolean
  onSelect?: () => void
  onHover?: (hovered: boolean) => void
}) {
  // Each flying project renders its own real shape (see SKY_SAT_MODEL); the
  // relay is the fallback only because it was the first one this layer ever
  // drew, not because it's a default any other program should resemble.
  const Model = SKY_SAT_MODEL[project.id] ?? RelaySat
  const scale = SKY_SAT_SCALE[project.id] ?? RELAY_SCALE
  const spanM = SKY_SAT_SPAN_M[project.id] ?? RELAY_SPAN_M

  const { dir, radius, labelAt, wingsAlong } = useMemo(() => {
    const d = stationDirection(station)
    const r = stationRadius(station)
    const nd = new THREE.Vector3(...d).normalize()
    return {
      dir: d,
      radius: r,
      // Clear of the wings, so a name never sits inside the spacecraft.
      labelAt: nd.clone().multiplyScalar(r + spanM * 0.7 * M_TO_UNITS),
      wingsAlong: bearingVector(station.wingBearingDeg),
    }
  }, [station, spanM])

  return (
    <>
      <SurfaceAnchor
        dir={dir}
        surfaceRadius={radius}
        scale={scale}
        // The wing AXIS is the model's +X, so pointing the "nose" along a
        // bearing is what sets the array's attitude. facingYaw would instead
        // swing the whole spacecraft to present itself to the home camera,
        // which is the right rule for a building and the wrong one for a solar
        // array: these have to answer to the sun.
        noseAlong={wingsAlong}
        dim={dim}
        castShadows={false}
        onClick={onSelect}
        onHoverChange={onHover}
      >
        <Model accent={accent} />
      </SurfaceAnchor>

      {named && (
        <Html
          position={labelAt}
          center
          zIndexRange={[20, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="whitespace-nowrap rounded border border-white/10 bg-black/55 px-1.5 py-0.5 text-center text-[9px] font-medium leading-tight text-white/70 shadow-md backdrop-blur-sm">
            {project.name}
          </div>
        </Html>
      )}
    </>
  )
}

export default function SkyLayer({
  trees,
  organizations,
  selectedTreeCategory,
  selectedProject,
  getProjectStyle,
  onSelectProject,
  onHoverTree,
  cinematic,
}: {
  trees: TechTree[]
  organizations: Organization[]
  selectedTreeCategory?: ProjectType | null
  selectedProject?: Project | null
  getProjectStyle?: (project: Project) => MarkerStyle
  onSelectProject?: (projectId: string) => void
  onHoverTree?: (category: ProjectType | null) => void
  // See MarkerLayerProps. The spacecraft keep flying; their names come off.
  cinematic?: boolean
}) {
  const orgMap = useMemo(() => {
    const m = new Map<string, Organization>()
    for (const o of organizations) m.set(o.id, o)
    return m
  }, [organizations])

  // The flying members of whatever races survived the org filter, each with the
  // category it competes in — a satellite dims and lights up with its race like
  // any lot in the city.
  const flying = useMemo(() => {
    const out: { project: Project; category: ProjectType }[] = []
    for (const tree of trees) {
      for (const project of tree.projects) {
        if (SKY_STATIONS[project.id]) out.push({ project, category: tree.category })
      }
    }
    return out
  }, [trees])

  const raceOpen = Boolean(selectedTreeCategory)

  return (
    <group>
      {flying.map(({ project, category }) => {
        const style = getProjectStyle?.(project) ?? { opacity: 1, visible: true }
        // Below the presence threshold the program has not flown yet at this
        // year on the scrubber. On the ground a district's beacon still marks
        // the lot; in the sky there is nothing to mark, so it simply is not up.
        if (!style.visible || style.opacity <= MODEL_PRESENCE) return null
        const isOpen = selectedTreeCategory === category
        return (
          <group key={project.id}>
            {SKY_STATIONS[project.id].map((station, i) => (
              <Satellite
                key={i}
                station={station}
                project={project}
                accent={orgColor(orgMap.get(project.orgId))}
                dim={raceOpen && !isOpen ? DIM_FACTOR : 1}
                // Only the primary carries the label. Three copies of one name
                // stacked up the sky is not three pieces of information.
                named={
                  !cinematic &&
                  i === 0 &&
                  (isOpen || selectedProject?.id === project.id)
                }
                onSelect={() => onSelectProject?.(project.id)}
                onHover={(h) => onHoverTree?.(h ? category : null)}
              />
            ))}
          </group>
        )
      })}
    </group>
  )
}
