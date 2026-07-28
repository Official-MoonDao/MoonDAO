// Photorealistic Connecting Ridge scene for Moon Base Zero.
//
// Renders a 16x16 km LOLA-derived patch of the Shackleton-de Gerlache
// connecting ridge (SouthPoleTerrain) under a single "sun", a starfield
// backdrop, and a subtle bloom pass. The moonbase on it is true-to-scale, so
// every camera constant here is a real distance in meters (via M_TO_UNITS).
// A camera rig animates smooth transitions to any lat/lon on the patch.
// Marker/model overlays are injected as children so this component stays
// presentation-only.
//
// The world is still a sphere mathematically — positions are directions
// scaled by a radius — so all the geo.ts framing math carries over; only the
// rendered patch is the ridge.

import { Stars, TrackballControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
  drillInFraming,
  latLonToVector3,
  MOON_RADIUS_M,
  orbitUpVector,
  surfaceNormal,
  surfaceViewFraming,
  vector3ToLatLon,
} from '@/lib/lunar-atlas/geo'
import {
  HOME_CAM as HOME_CAM_M,
  HOME_TARGET as HOME_TARGET_M,
} from '@/lib/lunar-atlas/homeview'
import { M_TO_UNITS, capCenterLatLon } from '@/lib/lunar-atlas/southpole'
import { GLOBE_RADIUS } from '@/lib/lunar-atlas/textures'
import type { Vec3 } from '@/lib/lunar-atlas/geo'
import type { TechTree } from '@/lib/lunar-atlas/selectors'
import type {
  Organization,
  Project,
  ProjectType,
} from '@/lib/lunar-atlas/types'
import BaseRoads from './BaseRoads'
import MarkerLayer, {
  ColonyLayout,
  MarkerStyle,
  siteOpacity,
} from './MarkerLayer'
import SouthPoleTerrain from './SouthPoleTerrain'
import useTerrainSampler, { RadiusAt } from './useTerrainSampler'

export type GlobeFocus = {
  lat: number
  lon: number
  // Camera altitude above the surface for orbit views, as a fraction of the
  // sphere radius (metersAboveGround / MOON_RADIUS_M). The whole 16 km patch
  // reads at ~8 km altitude (~0.0046); a single site at ~500 m (~0.0003).
  distanceRadii?: number
  // 'orbit' (default) looks down from above; 'surface' does a cinematic low
  // pan to a from-the-ground vantage looking across at the model.
  view?: 'orbit' | 'surface'
} | null

export type MoonGlobeProps = {
  focus?: GlobeFocus
  onReady?: () => void
  // Race district layer: every competitor in every race, on its own plot.
  trees?: TechTree[]
  organizations?: Organization[]
  selectedTreeCategory?: ProjectType | null
  // Competitor picked from a race panel — its plot is called out by name.
  selectedProject?: Project | null
  hoveredCategory?: ProjectType | null
  onSelectTree?: (category: ProjectType) => void
  onSelectProject?: (projectId: string) => void
  onHoverTree?: (category: ProjectType | null) => void
  getProjectStyle?: (project: Project) => MarkerStyle
  // Plot and district positions, shared with the page so the camera and the
  // models cannot disagree on where a competitor stands.
  layout?: ColonyLayout
  // Fired on a genuine click (not a drag-rotation) of the lunar surface or
  // the empty starfield — the page uses it to deselect and zoom back out.
  onBackgroundClick?: () => void
  children?: ReactNode
}

// A pointer that travels farther than this between down and up is a drag
// (camera tumble), not a click — it must never select or deselect anything.
const CLICK_DRAG_TOLERANCE_PX = 8

// Everything below is expressed in REAL METERS via M_TO_UNITS — the base is
// true-to-scale on the ridge, so camera heights and standoffs are literal
// distances (a 900 m standoff is a 900 m walk).

// Home framing (defined in lib/homeview so the model layer can aim each
// asset's presentation side at this same viewpoint).
const HOME_TARGET = new THREE.Vector3(...HOME_TARGET_M)
const DEFAULT_CAM = new THREE.Vector3(...HOME_CAM_M)
// "Up" for the home view: the ridge's outward surface normal, so the ground
// sits at the bottom of frame and space above.
const HOME_UP = (() => {
  const c = capCenterLatLon()
  const n = surfaceNormal(c.lat, c.lon)
  return new THREE.Vector3(n[0], n[1], n[2])
})()

// Minimum camera clearance above the local terrain: 3 m — walking height.
const CAMERA_CLEARANCE = 3 * M_TO_UNITS

// Three-quarter "hero" framing for a single site (fractions of the sphere
// radius = meters / MOON_RADIUS_M): the eye ~30 m up and ~75 m back, looking
// down at ~22° so the installation's form reads — not a top-down birdseye,
// not a horizon-height squint. targetLift aims at mid-model.
const SURFACE_VIEW_OPTS = {
  eyeHeight: 30 / MOON_RADIUS_M,
  standoff: 75 / MOON_RADIUS_M,
  targetLift: 10 / MOON_RADIUS_M,
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
  const desiredTarget = useRef(HOME_TARGET.clone())
  const desiredUp = useRef(HOME_UP.clone())
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
          ? surfaceViewFraming(focus.lat, focus.lon, surfaceR, {
              ...SURFACE_VIEW_OPTS,
              // Close in from whichever side the camera is already on, so a
              // site click zooms straight in rather than orbiting around to
              // the subject's back.
              approachFrom: [
                camera.position.x,
                camera.position.y,
                camera.position.z,
              ],
            })
          : drillInFraming(
              focus.lat,
              focus.lon,
              surfaceR,
              focus.distanceRadii ?? 1500 / MOON_RADIUS_M
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
      desiredTarget.current.copy(HOME_TARGET)
      desiredUp.current.copy(HOME_UP)
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
    // from the base overview whips the camera around violently when it is
    // metres off the deck after selecting a site. Scale both with the
    // camera's distance to its pivot so close-in inspection is gentle.
    const pivotDist = camera.position.distanceTo(curTarget)
    const feel = Math.sqrt(
      THREE.MathUtils.clamp(pivotDist / (2000 * M_TO_UNITS), 0, 1)
    )
    controls.rotateSpeed = THREE.MathUtils.lerp(0.3, 2.2, feel)
    controls.zoomSpeed = THREE.MathUtils.lerp(0.5, 1.2, feel)

    // Once the camera pulls well away from a drill-in pivot, glide the pivot
    // back to the ridge center. Without this, zooming out from a site leaves
    // the patch hanging half off-screen, orbiting a surface point the user
    // can no longer even see.
    if (
      !animating.current &&
      curTarget.distanceToSquared(HOME_TARGET) > (1 * M_TO_UNITS) ** 2
    ) {
      // Altitude above the base's ground level, in meters.
      const altM =
        (camera.position.length() - HOME_TARGET.length()) / M_TO_UNITS
      const recenter = THREE.MathUtils.clamp((altM / 2500 - 1) / 0.8, 0, 1)
      if (recenter > 0) {
        curTarget.lerp(HOME_TARGET, 1 - Math.pow(0.02, delta * recenter))
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
        Math.abs(newLen - dstLen) < 2 * M_TO_UNITS &&
        newTarget.distanceTo(desiredTarget.current) < 2 * M_TO_UNITS
      ) {
        setAnimating(false)
      }
      return
    }
    // Idle: the camera holds still. TrackballControls owns free rotation.
  })

  return null
}

// Direction from the Moon's center toward the sun. MUST match SUN_AZ_DEG /
// SUN_EL_DEG in the bake script (lon = azimuth, |lat| = elevation): cast
// shadows falling a different way than the terrain's baked hillshade would
// read instantly as fake. At the ridge this works out to a ~44.5° sun.
const SUN_DIR = (() => {
  const v = latLonToVector3(-45, 40, 1)
  return new THREE.Vector3(v[0], v[1], v[2]).normalize()
})()

// The shadow-casting light is parked 2 km up the sun vector and aimed at the
// base, rather than out at the real sun: a directional light's shadow map
// spans its orthographic frustum, so keeping that frustum tight on the
// settlement is what buys resolution. 400 m of frustum across a 4096 map is
// ~10 cm per texel — fine enough for a rover's shadow to read as its own
// silhouette. Ground outside the frustum is simply unshadowed, which is
// correct here: the terrain's own large-scale shadows are already baked in.
const SHADOW_LIGHT_DIST = 2000 * M_TO_UNITS
const SHADOW_EXTENT = 400 * M_TO_UNITS

// The models' sun. The terrain is UNLIT — its lighting is baked into the
// albedo as hillshade (see build-southpole-assets.py and SouthPoleTerrain) —
// so this light shades the 3D installations and casts their shadows, while
// SouthPoleTerrain catches those shadows in a separate pass.
function Sun() {
  // A directional light aims at its `target` object, which must be in the
  // scene for its world matrix to update.
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.copy(HOME_TARGET)
    return o
  }, [])
  const lightPos = useMemo(
    () => HOME_TARGET.clone().addScaledVector(SUN_DIR, SHADOW_LIGHT_DIST),
    []
  )

  return (
    <>
      <primitive object={target} />
      <directionalLight
        position={lightPos}
        target={target}
        intensity={3.1}
        color="#fff6ec"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={SHADOW_LIGHT_DIST * 0.6}
        shadow-camera-far={SHADOW_LIGHT_DIST * 1.6}
        // Offset along the surface normal rather than in depth: it kills
        // shadow acne on the terrain's sloped cells without the peter-panning
        // that a plain depth bias causes at contact points.
        shadow-normalBias={0.35 * M_TO_UNITS}
      />
      {/* Airless fill. There is no atmosphere to scatter light on the Moon,
          so a shadowed face is lit only by regolith bounce (albedo ~0.11) and
          starlight — nearly black. The generous fill this used to carry is
          what made the hardware look like plastic toys under a softbox. */}
      <hemisphereLight args={['#8f9bb5', '#413f3a', 0.14]} />
      <ambientLight intensity={0.07} />
    </>
  )
}

// Fully metallic PBR materials (Starship's stainless steel, rover chassis)
// reflect only their environment — under punctual lights alone they render
// near-black. A neutral generated studio environment gives them something to
// reflect; kept subtle so matte surfaces still read as sun-lit regolith
// hardware. Terrain is unaffected (unlit MeshBasicMaterial).
function MetalEnvironment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    // Just enough for stainless and foil to stop reading as black holes —
    // any more and it doubles as ambient fill, flattening the hard lunar
    // light the directional sun and shadows are there to create.
    scene.environmentIntensity = 0.28
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
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
  onSelectProject,
  onHoverTree,
  getProjectStyle,
  layout,
  onBackgroundClick,
  children,
}: MoonGlobeProps) {
  const controlsRef = useRef<any>(null)
  // CPU-side copy of the height maps so markers, models, and the camera sit
  // on the terrain the GPU actually renders.
  const radiusAt = useTerrainSampler()
  // How far along the timeline each site is, so the groundworks arrive with the
  // hardware rather than lying on an empty plain years early — and so no spur
  // is graded out to a plot nobody has broken ground on yet.
  const sitePresence = useMemo(() => {
    const byCategory = new Map<string, number>()
    for (const t of trees ?? [])
      byCategory.set(t.category, siteOpacity(t, getProjectStyle))
    return byCategory
  }, [trees, getProjectStyle])
  const basePresence = useMemo(
    () => Math.max(0, ...Array.from(sitePresence.values())),
    [sitePresence]
  )
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
      shadows
      camera={{
        position: [DEFAULT_CAM.x, DEFAULT_CAM.y, DEFAULT_CAM.z],
        up: [HOME_UP.x, HOME_UP.y, HOME_UP.z],
        fov: 42,
        // 1 m near plane: the camera can stand right next to a rover.
        near: 1 * M_TO_UNITS,
        far: GLOBE_RADIUS * 40,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
        // Wide near/far span at this closer scale — log depth avoids z-fighting
        // between terrain, pads, and models up close.
        logarithmicDepthBuffer: true,
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
      <MetalEnvironment />

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

      <BaseRoads
        radiusAt={radiusAt}
        presence={basePresence}
        siteOpacity={sitePresence}
      />

      {trees && organizations && layout && (
        <MarkerLayer
          trees={trees}
          organizations={organizations}
          layout={layout}
          selectedTreeCategory={selectedTreeCategory}
          selectedProject={selectedProject}
          hoveredCategory={hoveredCategory}
          onSelectTree={onSelectTree}
          onSelectProject={onSelectProject}
          onHoverTree={onHoverTree}
          getProjectStyle={getProjectStyle}
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
          starts at the ridge center; drill-ins move it to the focused site.
          Distances are real: from 12 m off a rover out to 40 km above the
          patch — past that there is nothing more to see. */}
      <TrackballControls
        ref={controlsRef}
        makeDefault
        noPan
        rotateSpeed={2.2}
        zoomSpeed={1.2}
        dynamicDampingFactor={0.12}
        minDistance={12 * M_TO_UNITS}
        maxDistance={40000 * M_TO_UNITS}
        target={[HOME_TARGET.x, HOME_TARGET.y, HOME_TARGET.z]}
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
