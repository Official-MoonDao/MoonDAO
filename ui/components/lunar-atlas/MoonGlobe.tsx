// Photorealistic lunar south-pole scene for the Lunar Atlas.
//
// Renders the LOLA-derived polar cap (SouthPoleTerrain) under a single
// grazing "sun" with real-time shadows, a starfield backdrop, and a subtle
// bloom pass. A camera rig animates smooth transitions to any lat/lon on the
// cap. Marker/model overlays are injected as children so this component
// stays presentation-only.
//
// The world is still a sphere mathematically — positions are directions
// scaled by a radius — so all the geo.ts framing/decluster math carries over;
// only the rendered patch is the pole.

import { Stars, TrackballControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  drillInFraming,
  latLonToVector3,
  orbitUpVector,
  surfaceNormal,
  surfaceViewFraming,
  vector3ToLatLon,
} from '@/lib/lunar-atlas/geo'
import { GLOBE_RADIUS } from '@/lib/lunar-atlas/textures'
import type { Vec3 } from '@/lib/lunar-atlas/geo'
import type { TechTree } from '@/lib/lunar-atlas/selectors'
import type {
  Organization,
  Project,
  ProjectType,
} from '@/lib/lunar-atlas/types'
import MarkerLayer, { MarkerStyle } from './MarkerLayer'
import SouthPoleTerrain from './SouthPoleTerrain'
import useTerrainSampler, { RadiusAt } from './useTerrainSampler'

export type GlobeFocus = {
  lat: number
  lon: number
  // Camera altitude above the surface for orbit views, in GLOBE_RADIUS units.
  // The whole south-pole cap reads at ~0.3; a single site at ~0.05.
  distanceRadii?: number
  // 'orbit' (default) looks down from above; 'surface' does a cinematic low
  // pan to a from-the-ground vantage looking across at the model.
  view?: 'orbit' | 'surface'
} | null

export type MoonGlobeProps = {
  focus?: GlobeFocus
  onReady?: () => void
  // Tech-tree site layer: one generic installation per capability category.
  trees?: TechTree[]
  organizations?: Organization[]
  selectedTreeCategory?: ProjectType | null
  // Competitor picked from a race panel — replaces its category's generic
  // site model with the company-specific one.
  selectedProject?: Project | null
  hoveredCategory?: ProjectType | null
  onSelectTree?: (category: ProjectType) => void
  onHoverTree?: (category: ProjectType | null) => void
  getProjectStyle?: (project: Project) => MarkerStyle
  // Declustered site directions keyed by category.
  markerDirs?: Map<string, Vec3>
  // Fired on a genuine click (not a drag-rotation) of the lunar surface or
  // the empty starfield — the page uses it to deselect and zoom back out.
  onBackgroundClick?: () => void
  children?: ReactNode
}

// A pointer that travels farther than this between down and up is a drag
// (camera tumble), not a click — it must never select or deselect anything.
const CLICK_DRAG_TOLERANCE_PX = 8

// Home framing: hover above the pole, offset toward the sunward side so the
// cap reads with its long shadows falling away from the viewer.
const POLE_TARGET = new THREE.Vector3(0, -GLOBE_RADIUS, 0)
const DEFAULT_CAM = POLE_TARGET.clone().add(
  new THREE.Vector3(
    GLOBE_RADIUS * 0.16,
    -GLOBE_RADIUS * 0.30,
    GLOBE_RADIUS * 0.13
  )
)
// "Up" for the home view: the pole-safe orbit up at the pole itself.
const POLE_UP = (() => {
  const u = orbitUpVector(-90, 0)
  return new THREE.Vector3(u[0], u[1], u[2])
})()

// Minimum camera clearance above the local terrain, in scene units.
const CAMERA_CLEARANCE = GLOBE_RADIUS * 0.0015

// Low-angle surface framing tuned to the cap's scale (fractions of
// GLOBE_RADIUS): the eye sits ~2 model-heights up, a short walk back.
const SURFACE_VIEW_OPTS = {
  eyeHeight: 0.010,
  standoff: 0.028,
  targetLift: 0.005,
}

// Animates the camera toward a lat/lon focus (or back to the home framing)
// ONLY while a transition is active. It arcs the view direction and eases the
// distance/target rather than sliding in a straight line. Once it arrives (or
// the moment the user grabs the controls) it fully releases the camera back
// to the TrackballControls, so the user can always freely rotate.
function CameraRig({
  focus,
  controlsRef,
  userInteracting,
  onAnimatingChange,
  radiusAt,
}: {
  focus: GlobeFocus
  controlsRef: React.MutableRefObject<any>
  userInteracting: boolean
  onAnimatingChange: (animating: boolean) => void
  // Rendered terrain radius lookup — framings and the camera floor work
  // against the real ground height, not the analytic sphere.
  radiusAt?: RadiusAt | null
}) {
  const { camera } = useThree()
  const desiredPos = useRef(DEFAULT_CAM.clone())
  const desiredTarget = useRef(POLE_TARGET.clone())
  const desiredUp = useRef(POLE_UP.clone())
  const animating = useRef(false)
  // Per-transition easing base (larger = slower, more cinematic glide).
  const easeBase = useRef(0.0022)

  const setAnimating = (v: boolean) => {
    if (animating.current !== v) {
      animating.current = v
      onAnimatingChange(v)
    }
  }

  // A focus change (including back to null) kicks off a new transition.
  useEffect(() => {
    if (focus) {
      // Seat framings on the rendered terrain; while the height maps are
      // still decoding, fall back to the analytic sphere (the deps re-run
      // this once the sampler arrives, refining the framing in-flight).
      const surfaceR = radiusAt ? radiusAt(focus.lat, focus.lon) : GLOBE_RADIUS
      const { position, target } =
        focus.view === 'surface'
          ? surfaceViewFraming(focus.lat, focus.lon, surfaceR, SURFACE_VIEW_OPTS)
          : drillInFraming(
              focus.lat,
              focus.lon,
              surfaceR,
              focus.distanceRadii ?? 0.3
            )
      // Surface pans glide in slowly for a cinematic feel; orbit moves snappier.
      easeBase.current = focus.view === 'surface' ? 0.05 : 0.0022
      desiredPos.current.set(position[0], position[1], position[2])
      desiredTarget.current.set(target[0], target[1], target[2])
      // Surface view rolls the camera so "up" is the local outward normal —
      // otherwise the view is upside down at the pole. Orbit views use a
      // pole-safe up (raw world-Y is parallel to the view axis when looking
      // straight down at the pole).
      if (focus.view === 'surface') {
        const n = surfaceNormal(focus.lat, focus.lon)
        desiredUp.current.set(n[0], n[1], n[2])
      } else {
        const up = orbitUpVector(focus.lat, focus.lon)
        desiredUp.current.set(up[0], up[1], up[2])
      }
    } else {
      easeBase.current = 0.0022
      desiredPos.current.copy(DEFAULT_CAM)
      desiredTarget.current.copy(POLE_TARGET)
      desiredUp.current.copy(POLE_UP)
    }
    setAnimating(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, radiusAt])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls) return
    const curTarget = controls.target as THREE.Vector3

    // Hard floor: free zooming/tumbling must never put the camera under the
    // terrain. Sample the rendered ground below the camera every frame (a
    // handful of bilinear taps — cheap) and push the camera up if needed.
    {
      const p = camera.position
      const ll = vector3ToLatLon([p.x, p.y, p.z])
      const ground = radiusAt ? radiusAt(ll.lat, ll.lon) : GLOBE_RADIUS
      const floor = ground + CAMERA_CLEARANCE
      if (p.lengthSq() < floor * floor) p.setLength(floor)
    }

    // Proximity-adaptive control feel: a rotate/zoom speed that feels right
    // from the cap overview whips the camera around violently when it is
    // metres off the deck after selecting a site. Scale both with the
    // camera's distance to its pivot so close-in inspection is gentle.
    const pivotDist = camera.position.distanceTo(curTarget)
    const feel = Math.sqrt(
      THREE.MathUtils.clamp(pivotDist / (GLOBE_RADIUS * 0.45), 0, 1)
    )
    controls.rotateSpeed = THREE.MathUtils.lerp(0.3, 2.2, feel)
    controls.zoomSpeed = THREE.MathUtils.lerp(0.5, 1.2, feel)

    // Once the camera pulls well away from a drill-in pivot, glide the pivot
    // back to the pole. Without this, zooming out from a site leaves the cap
    // hanging half off-screen, orbiting a surface point the user can no
    // longer even see.
    if (!animating.current && curTarget.distanceToSquared(POLE_TARGET) > 1e-8) {
      const alt = camera.position.length() - GLOBE_RADIUS
      const recenter = THREE.MathUtils.clamp(
        (alt / (GLOBE_RADIUS * 0.28) - 1) / 0.8,
        0,
        1
      )
      if (recenter > 0) {
        curTarget.lerp(POLE_TARGET, 1 - Math.pow(0.02, delta * recenter))
      }
    }

    if (animating.current) {
      // Let the user interrupt at any time — hand control straight back.
      if (userInteracting) {
        setAnimating(false)
        return
      }

      const t = 1 - Math.pow(easeBase.current, delta) // frame-rate-independent easing
      const curOffset = camera.position.clone().sub(curTarget)
      const dstOffset = desiredPos.current.clone().sub(desiredTarget.current)

      const curLen = curOffset.length()
      const dstLen = dstOffset.length()
      const curDir = curOffset.normalize()
      const dstDir = dstOffset.clone().normalize()

      // Arc the view direction (normalized lerp ~ slerp for per-frame steps),
      // ease the distance, and glide the look-at target.
      const newDir = curDir.lerp(dstDir, t).normalize()
      const newLen = curLen + (dstLen - curLen) * t
      const newTarget = curTarget.clone().lerp(desiredTarget.current, t)

      camera.position.copy(newTarget).add(newDir.multiplyScalar(newLen))
      curTarget.copy(newTarget)
      // Ease the camera roll so "up" matches the destination framing. Rotate the
      // up-vector along a real axis (via a partial quaternion) rather than lerp,
      // so a 180° flip at the pole doesn't pass through a degenerate zero.
      const curUp = camera.up.clone().normalize()
      const full = new THREE.Quaternion().setFromUnitVectors(
        curUp,
        desiredUp.current
      )
      const step = new THREE.Quaternion().slerp(full, t)
      camera.up.copy(curUp).applyQuaternion(step).normalize()
      controls.update()

      const angle = newDir.angleTo(dstDir)
      if (
        angle < 0.01 &&
        Math.abs(newLen - dstLen) < GLOBE_RADIUS * 0.002 &&
        newTarget.distanceTo(desiredTarget.current) < GLOBE_RADIUS * 0.002
      ) {
        setAnimating(false)
      }
      return
    }
    // Idle: the camera holds still. TrackballControls owns free rotation.
  })

  return null
}

// The models' sun. The terrain is UNLIT — its lighting is baked into the
// albedo as hillshade (see build-southpole-assets.py and SouthPoleTerrain) —
// so this light only shades the 3D installations and markers, and it sits
// at the same lat/lon as the baked hillshade sun so model shading and
// terrain shading agree.
function Sun() {
  const dir = useMemo(() => {
    // MUST match SUN_AZ_DEG / SUN_EL_DEG in the bake script (lon = azimuth,
    // |lat| = elevation).
    const v = latLonToVector3(-45, 40, 1)
    return new THREE.Vector3(v[0], v[1], v[2]).multiplyScalar(GLOBE_RADIUS * 3)
  }, [])

  return (
    <>
      <directionalLight position={dir} intensity={2.6} color="#fff6ec" />
      {/* Generous fill: this is a map first. The baked hillshade already
          carries the darkness where it matters. */}
      <hemisphereLight args={['#9aa2b5', '#4a4c52', 0.5]} />
      <ambientLight intensity={0.35} />
    </>
  )
}

export default function MoonGlobe({
  focus = null,
  onReady,
  trees,
  organizations,
  selectedTreeCategory,
  selectedProject,
  hoveredCategory,
  onSelectTree,
  onHoverTree,
  getProjectStyle,
  markerDirs,
  onBackgroundClick,
  children,
}: MoonGlobeProps) {
  const controlsRef = useRef<any>(null)
  // CPU-side copy of the height maps so markers, models, and the camera sit
  // on the terrain the GPU actually renders.
  const radiusAt = useTerrainSampler()
  // Auto-drift pauses whenever the user is interacting or a camera
  // transition is in flight.
  const [userInteracting, setUserInteracting] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const wheelTimer = useRef<ReturnType<typeof setTimeout>>()
  // Where the pointer went down, to tell clicks from drag-rotations in
  // onPointerMissed (which R3F fires for any click that hits no object —
  // including the release at the end of a starfield drag).
  const pointerDownAt = useRef<{ x: number; y: number } | null>(null)

  // Release the "interacting" flag on pointer up anywhere.
  useEffect(() => {
    const onUp = () => setUserInteracting(false)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const handleWheel = () => {
    setUserInteracting(true)
    if (wheelTimer.current) clearTimeout(wheelTimer.current)
    wheelTimer.current = setTimeout(() => setUserInteracting(false), 600)
  }

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{
        position: [DEFAULT_CAM.x, DEFAULT_CAM.y, DEFAULT_CAM.z],
        up: [POLE_UP.x, POLE_UP.y, POLE_UP.z],
        fov: 42,
        near: GLOBE_RADIUS * 0.001,
        far: GLOBE_RADIUS * 40,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      onPointerMissed={(e) => {
        const down = pointerDownAt.current
        const moved = down
          ? Math.hypot(e.clientX - down.x, e.clientY - down.y)
          : 0
        if (moved <= CLICK_DRAG_TOLERANCE_PX) onBackgroundClick?.()
      }}
      onPointerDown={(e) => {
        setUserInteracting(true)
        pointerDownAt.current = { x: e.clientX, y: e.clientY }
      }}
      onWheel={handleWheel}
    >
      <color attach="background" args={['#03040a']} />

      <Sun />

      <Stars
        radius={GLOBE_RADIUS * 14}
        depth={GLOBE_RADIUS * 6}
        count={6000}
        factor={GLOBE_RADIUS * 0.9}
        saturation={0}
        fade
        speed={0.3}
      />

      <SouthPoleTerrain onReady={onReady} onSurfaceClick={onBackgroundClick} />

      {trees && organizations && (
        <MarkerLayer
          trees={trees}
          organizations={organizations}
          selectedTreeCategory={selectedTreeCategory}
          selectedProject={selectedProject}
          hoveredCategory={hoveredCategory}
          onSelectTree={onSelectTree}
          onHoverTree={onHoverTree}
          getProjectStyle={getProjectStyle}
          dirMap={markerDirs}
          radiusAt={radiusAt}
        />
      )}

      {children}

      <CameraRig
        focus={focus}
        controlsRef={controlsRef}
        userInteracting={userInteracting}
        onAnimatingChange={setIsAnimating}
        radiusAt={radiusAt}
      />

      {/* Trackball gives full free tumble around the current pivot. The pivot
          starts at the pole; drill-ins move it to the focused site. */}
      <TrackballControls
        ref={controlsRef}
        makeDefault
        noPan
        rotateSpeed={2.2}
        zoomSpeed={1.2}
        dynamicDampingFactor={0.12}
        minDistance={GLOBE_RADIUS * 0.004}
        maxDistance={GLOBE_RADIUS * 0.8}
        target={[POLE_TARGET.x, POLE_TARGET.y, POLE_TARGET.z]}
      />

      {/* High threshold keeps bloom off the sunlit regolith (which read as a
          hazy video-game glow) and reserves it for emissive marker beacons. */}
      <EffectComposer>
        <Bloom
          intensity={0.3}
          luminanceThreshold={0.9}
          luminanceSmoothing={0.85}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  )
}
