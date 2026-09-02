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
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  drillInFraming,
  MOON_RADIUS_M,
  orbitUpVector,
  skyViewFraming,
  subViewFraming,
  surfaceNormal,
  surfaceViewFraming,
  vector3ToLatLon,
} from '@/lib/lunar-atlas/geo'
import type { Vec3 } from '@/lib/lunar-atlas/geo'
import { HOME_CAM as HOME_CAM_M, HOME_TARGET as HOME_TARGET_M } from '@/lib/lunar-atlas/homeview'
import type { TechTree } from '@/lib/lunar-atlas/selectors'
import {
  CAP_CENTER_HEIGHT_M,
  M_TO_UNITS,
  capCenterDirection,
  capCenterLatLon,
  capLocalDirection,
  heightToRadius,
} from '@/lib/lunar-atlas/southpole'
import {
  SUN_ANGULAR_RADIUS_RAD,
  SUN_COLOR,
  SUN_DIR as SUN_DIR_ARR,
  SUN_INTENSITY,
} from '@/lib/lunar-atlas/sun'
import { GLOBE_RADIUS } from '@/lib/lunar-atlas/textures'
import type { Organization, Project, ProjectType } from '@/lib/lunar-atlas/types'
import BaseRoads from './BaseRoads'
import EarthGlobe from './EarthGlobe'
import GroundDisturbance from './GroundDisturbance'
import MarkerLayer, { ColonyLayout, MarkerStyle, siteOpacity } from './MarkerLayer'
import SkyLayer from './SkyLayer'
import SouthPoleTerrain from './SouthPoleTerrain'
import { buildLunarEnvironmentTexture } from './lunarEnvironment'
import useTerrainSampler, { RadiusAt } from './useTerrainSampler'

export type GlobeFocus = {
  lat: number
  lon: number
  // Camera altitude above the surface for orbit views, as a fraction of the
  // sphere radius (metersAboveGround / MOON_RADIUS_M). The whole 16 km patch
  // reads at ~8 km altitude (~0.0046); a single site at ~500 m (~0.0003).
  distanceRadii?: number
  // 'orbit' (default) looks down from above; 'surface' does a cinematic low
  // pan to a from-the-ground vantage looking across at the model; 'sky' frames
  // a subject that is off the ground entirely (see skyViewFraming); 'sub' drops
  // the eye BELOW grade into a buried habitat's vault (see subViewFraming).
  view?: 'orbit' | 'surface' | 'sky' | 'sub'
  // Meters above the base datum of the thing being looked at. Only 'sky' uses
  // it — every other framing takes its subject to be on the ground.
  heightM?: number
  // The cutaway framing, for 'sub' only: how far below local grade the subject
  // and the eye sit, how far back along the vault's axis the eye stands, and
  // which way that axis runs (degrees CCW from east, the district convention).
  // All of it is derived from the vault itself by vaultGeometry, so the camera
  // lands inside the structure the model layer drew rather than near it.
  sub?: {
    subjectDepthM: number
    eyeDepthM: number
    standoffM: number
    axisBearingDeg: number
  }
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
  // Strips every beacon, tether and floating name out of the scene, leaving
  // only what would physically be there. See MarkerLayerProps.
  cinematic?: boolean
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
// Enforced every frame except while a cutaway view is open, which is under the
// terrain deliberately; see the floor in CameraRig's frame loop.
const CAMERA_CLEARANCE = 3 * M_TO_UNITS

// Far plane. Generous rather than tuned: with a conventional depth buffer (see
// the Canvas' gl props for why it is not a logarithmic one) precision is set by
// the NEAR plane and the distance to what is being looked at, and is flat in
// `far` once far greatly exceeds both. So this only has to be far enough to hold
// the Moon, and nothing is bought by trimming it.
const FULL_FAR = GLOBE_RADIUS * 40

// Three-quarter "hero" framing for a single site (fractions of the sphere
// radius = meters / MOON_RADIUS_M): the eye ~30 m up and ~75 m back, looking
// down at ~22° so the installation's form reads — not a top-down birdseye,
// not a horizon-height squint. targetLift aims at mid-model.
const SURFACE_VIEW_OPTS = {
  eyeHeight: 30 / MOON_RADIUS_M,
  standoff: 75 / MOON_RADIUS_M,
  targetLift: 10 / MOON_RADIUS_M,
}

// Framing for the relay constellation, the one subject that is not on the
// ground. The eye rises 170 m over the satellite and stands off 150 m outward,
// which is a 227 m slant range: at that distance a 20 m spacecraft covers an
// eighth of the frame height, its two companions read behind it at half and a
// third of that, and the colony sits below all three. Backing off far enough to
// hold satellite and colony in a single wide shot instead makes the satellite a
// dozen pixels, which is why this framing exists at all.
const SKY_VIEW_OPTS = {
  rise: 170 / MOON_RADIUS_M,
  standoff: 150 / MOON_RADIUS_M,
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
        focus.view === 'sub' && focus.sub
          ? subViewFraming(
              focus.lat,
              focus.lon,
              surfaceR - focus.sub.eyeDepthM * M_TO_UNITS,
              surfaceR - focus.sub.subjectDepthM * M_TO_UNITS,
              // Back along the vault's axis, which puts the eye at the inward
              // service-bay end looking out over the module (see vaultAxis).
              capLocalDirection(focus.sub.axisBearingDeg + 180, 0).map(
                (c) => c * focus.sub!.standoffM * M_TO_UNITS
              ) as [number, number, number]
            )
          : focus.view === 'sky'
          ? skyViewFraming(
              focus.lat,
              focus.lon,
              heightToRadius(CAP_CENTER_HEIGHT_M + (focus.heightM ?? 0)),
              // Look back over the settlement, so it fills the background
              // behind the spacecraft rather than the empty ridge beyond it.
              capCenterDirection(),
              SKY_VIEW_OPTS
            )
          : focus.view === 'surface'
          ? surfaceViewFraming(focus.lat, focus.lon, surfaceR, {
              ...SURFACE_VIEW_OPTS,
              // Close in from whichever side the camera is already on, so a
              // site click zooms straight in rather than orbiting around to
              // the subject's back.
              approachFrom: [camera.position.x, camera.position.y, camera.position.z],
            })
          : drillInFraming(
              focus.lat,
              focus.lon,
              surfaceR,
              focus.distanceRadii ?? 1500 / MOON_RADIUS_M
            )
      // Pans onto a subject glide in slowly for a cinematic feel, whether that
      // subject is on the ground, over it or under it; orbit moves snappier.
      easeBase.current =
        focus.view === 'surface' || focus.view === 'sky' || focus.view === 'sub' ? 0.05 : 0.0022
      desiredPos.current.set(position[0], position[1], position[2])
      desiredTarget.current.set(target[0], target[1], target[2])
      // Surface, sky and cutaway views roll the camera so "up" is the local
      // outward normal — otherwise the view is upside down at the pole. Orbit
      // views use a pole-safe up (raw world-Y is parallel to the view axis when
      // looking straight down at the pole).
      if (focus.view === 'surface' || focus.view === 'sky' || focus.view === 'sub') {
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
    //
    // Suspended for the one framing that is under the terrain ON PURPOSE. It has
    // to stay suspended for as long as that view is open and not merely while
    // the flight into it is running: re-arming on arrival would yank the eye
    // out of the vault the instant it got there, and re-arming when the user
    // takes the controls would do the same the instant they looked around. The
    // consequence is that there is no floor at all while a cutaway is open,
    // which is the right trade — the whole point of the view is to be beneath
    // the ground, and deselecting restores the clamp on the way home.
    if (focus?.view !== 'sub') {
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
    const feel = Math.sqrt(THREE.MathUtils.clamp(pivotDist / (2000 * M_TO_UNITS), 0, 1))
    controls.rotateSpeed = THREE.MathUtils.lerp(0.3, 2.2, feel)
    controls.zoomSpeed = THREE.MathUtils.lerp(0.5, 1.2, feel)

    // Once the camera pulls well away from a drill-in pivot, glide the pivot
    // back to the ridge center. Without this, zooming out from a site leaves
    // the patch hanging half off-screen, orbiting a surface point the user
    // can no longer even see.
    if (!animating.current && curTarget.distanceToSquared(HOME_TARGET) > (1 * M_TO_UNITS) ** 2) {
      // Altitude above the base's ground level, in meters.
      const altM = (camera.position.length() - HOME_TARGET.length()) / M_TO_UNITS
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
      const full = new THREE.Quaternion().setFromUnitVectors(curUp, desiredUp.current)
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

// Direction from the Moon's center toward the sun. Derived in lib/sun.ts from
// the bake script's own azimuth and elevation, so a cast shadow can never fall
// a different way than the terrain's baked hillshade — which would read as
// fake instantly. At the ridge this works out to a 44.46° sun at bearing 50°.
const SUN_DIR = new THREE.Vector3(...SUN_DIR_ARR)

// The shadow-casting light is parked 2 km up the sun vector and aimed at the
// base, rather than out at the real sun: a directional light's shadow map
// spans its orthographic frustum, so keeping that frustum tight on the
// settlement is what buys resolution. 400 m of frustum across a 4096 map is
// ~10 cm per texel — fine enough for a rover's shadow to read as its own
// silhouette. Ground outside the frustum is simply unshadowed, which is
// correct here: the terrain's own large-scale shadows are already baked in.
const SHADOW_LIGHT_DIST = 2000 * M_TO_UNITS
const SHADOW_EXTENT = 400 * M_TO_UNITS

// Lunar shadows are HARD, and this is the arithmetic that says so rather than
// a preference. The sun subtends 0.533° from the Moon (SUN_ANGULAR_RADIUS_RAD),
// so a penumbra widens by 2·tan(0.2664°) = 9.3 MILLIMETRES for every metre an
// occluder stands off what it is shadowing. This shadow map spans 800 m across
// 4096 texels — 19.5 cm per texel — so even the 52 m Starship casts a penumbra
// only about a texel wide at its own tip, and everything smaller casts one that
// is entirely sub-texel.
//
// A PCSS pass (drei's SoftShadows) was the obvious move here and is the wrong
// one: contact-hardening soft shadows exist to portray a penumbra that this
// scene, uniquely, does not have. It would only invent softness the Moon has
// none of, for a real per-frame cost. What the shadow edge actually needs is
// antialiasing of a hard step, which is what PCFSoftShadowMap does — its fixed
// filter works out to roughly a texel, i.e. about the penumbra of a 20 m
// standoff, so the one place it errs it errs toward the truth.
const SUN_PENUMBRA_PER_M = 2 * Math.tan(SUN_ANGULAR_RADIUS_RAD)

// Offset along the surface normal to kill shadow acne on the terrain's sloped
// cells. It buys that at the cost of sliding the shadow laterally by the same
// distance, and at 0.35 m — nearly two shadow texels — that slide was visible
// as a gap under every footpad: the classic detached, pasted-on-a-photo look
// the shadow catcher exists to prevent. 12 cm is still over half a texel of
// bias, which the 15.6 m polygon pitch of the terrain has ample slope margin
// for, and it puts contact shadows back against the things casting them.
const SHADOW_NORMAL_BIAS = 0.12 * M_TO_UNITS

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
        intensity={SUN_INTENSITY}
        color={SUN_COLOR}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={SHADOW_LIGHT_DIST * 0.6}
        shadow-camera-far={SHADOW_LIGHT_DIST * 1.6}
        shadow-normalBias={SHADOW_NORMAL_BIAS}
      />
      {/* No hemisphere light and no ambient light, on purpose.
          
          There is no atmosphere here, so there is no sky to scatter anything:
          the ONLY thing filling a lunar shadow is light bounced off the
          regolith around it, and that arrives from BELOW, warm-grey, at about
          4% of the sun. A hemisphere light says the opposite — a blue glow
          from overhead — and it is what made every shadowed face read as a
          plastic toy under a softbox, because it lit the one hemisphere that
          in reality has nothing in it at all.
          
          That bounce is now carried by the regolith environment map, which
          gets it directionally right for free: a downward-facing panel is lit
          by the ground it faces and an upward-facing one goes almost black.
          See LunarEnvironment below. */}
    </>
  )
}

// The indirect half of the lighting, and the only fill in the scene.
//
// Two jobs at once, which is why one texture can replace both a studio
// environment map and a hemisphere light. It gives fully metallic surfaces
// (Starship's stainless, gold MLI, a polished dish web) something true to
// reflect, since under punctual lights alone they render near-black. And its
// lower hemisphere IS the regolith bounce, so it fills shadows from the right
// direction, in the right colour, at the right strength.
//
// Because its radiances are derived from SUN_INTENSITY rather than dialled in
// (see lunarEnvironment.ts), the intensity here is 1 and means it: this is
// what the surroundings are actually as bright as, not a taste knob.
//
// Terrain is unaffected — it is an unlit MeshBasicMaterial.
function LunarEnvironment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const src = buildLunarEnvironmentTexture()
    const env = pmrem.fromEquirectangular(src).texture
    scene.environment = env
    scene.environmentIntensity = 1
    src.dispose()
    pmrem.dispose()
    return () => {
      scene.environment = null
      env.dispose()
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
  cinematic,
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
    for (const t of trees ?? []) byCategory.set(t.category, siteOpacity(t, getProjectStyle))
    return byCategory
  }, [trees, getProjectStyle])
  // The built environment — graded roads, the hardstand, street lighting, the
  // roadside cargo, the parked excavators, the vault dig — is the work of the
  // surface construction fleet, so it arrives when that fleet does and not when
  // the first lander touches down. Keying it to the loudest district on the
  // ridge (which is what this did) put a lit street grid around a single dead
  // 2024 lander, because one achieved landing was enough to build the whole
  // town. Falls back to that behaviour only when a filter has taken the
  // construction race off the map entirely, so filtering cannot delete the
  // roads under everything else.
  const basePresence = useMemo(() => {
    const construction = sitePresence.get('construction')
    if (construction != null) return construction
    return Math.max(0, ...Array.from(sitePresence.values()))
  }, [sitePresence])
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

  // Clear a pending wheel-idle timeout so unmount during zoom cannot setState.
  useEffect(() => {
    return () => {
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
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
      // PCF-soft rather than the default hard PCF: see SUN_PENUMBRA_PER_M for
      // why this is an antialiasing choice and not a softness one.
      shadows="soft"
      camera={{
        position: [DEFAULT_CAM.x, DEFAULT_CAM.y, DEFAULT_CAM.z],
        up: [HOME_UP.x, HOME_UP.y, HOME_UP.z],
        fov: 42,
        // 1 m near plane: the camera can stand right next to a rover.
        near: 1 * M_TO_UNITS,
        far: FULL_FAR,
      }}
      gl={{
        antialias: true,
        // The tone curve that actually runs is the <ToneMapping> effect at the
        // end of the EffectComposer, NOT this — @react-three/postprocessing
        // forces gl.toneMapping to NoToneMapping for as long as its composer is
        // mounted. This scene asked for ACES here for a long time and never got
        // it: the image went to the screen as a raw linear-to-sRGB conversion
        // that clipped flat at white, which is most of why the regolith read as
        // grey plastic. Setting it anyway keeps the renderer honest if the
        // composer is ever removed, and it must stay equal to the effect's mode.
        toneMapping: THREE.AgXToneMapping,
        // Read by the effect: three's tonemapping shader chunk declares
        // toneMappingExposure, and the renderer uploads it regardless of which
        // curve is selected.
        //
        // Solved rather than dialled. The terrain is an unlit material, so the
        // only thing between its baked albedo and the screen is this curve, and
        // that bake was authored to look right with no curve at all — sunlit
        // regolith sat at sRGB 163. Running three's own AgX at 1.05 lands it on
        // sRGB 163 again, so the ground is left exactly where its author put it
        // and every bit of what the curve buys is spent at the two ends: four
        // full stops of headroom above the regolith before anything approaches
        // white (+4 stops is still only sRGB 245, and nothing in the frame
        // clips), and a toe that still separates -6 stops from black. That is
        // the whole point on a world with a 0.5° sun and no atmosphere, where
        // a sunlit panel and the shadow beside it are three orders of magnitude
        // apart and neither end may be thrown away.
        toneMappingExposure: 1.05,
        // A LOGARITHMIC depth buffer is the obvious choice for a scene that
        // spans orbit to millimeters, and it was used here, and it was the
        // wrong call — it is the direct cause of the shimmer that has been
        // chased around this scene with lift hacks (the pit halo, the plaza
        // hardstand, the excavator) and of vault interiors that boiled.
        //
        // Three computes log depth as log2(1.0 + gl_Position.w). One scene unit
        // here is 868 km, so `w` eight meters from the eye is 9.2e-6, and that
        // `1.0 +` drops the whole number into float32's mantissa next to 1.0,
        // where the steps are 1.2e-7. Depth therefore quantises to between 3 and
        // 9 cm everywhere the camera actually goes, and no near/far tuning
        // touches it: the precision is gone in the vertex shader, before the far
        // plane is consulted.
        //
        // A conventional 1/z buffer has no such term and concentrates precision
        // near the eye, which is exactly where this scene needs it: about 4
        // microns at 8 m, 0.6 mm at 100 m, 1 cm at the base overview. It pays
        // for that at the horizon — meters of slop out at the cap's 16 km rim —
        // which costs nothing, because there is no coplanar geometry out there
        // to fight, only a convex sphere and a terrain patch two kilometers
        // clear of it.
      }}
      onPointerMissed={(e) => {
        const down = pointerDownAt.current
        const moved = down ? Math.hypot(e.clientX - down.x, e.clientY - down.y) : 0
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
      <LunarEnvironment />
      <EarthGlobe />

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

      <BaseRoads radiusAt={radiusAt} presence={basePresence} siteOpacity={sitePresence} />

      {/* Churned ground under the hardware. After the roads so a stain blends
          over a road's own crust where the two meet — a machine tracks dust
          onto the pavement it works off, not the other way round. */}
      {trees && layout && (
        <GroundDisturbance
          trees={trees}
          layout={layout}
          radiusAt={radiusAt}
          siteOpacity={sitePresence}
        />
      )}

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
          cinematic={cinematic}
          infraPresence={basePresence}
        />
      )}

      {/* The orbital competitors, which have stations rather than plots and so
          need no layout table. */}
      {trees && organizations && (
        <SkyLayer
          trees={trees}
          organizations={organizations}
          selectedTreeCategory={selectedTreeCategory}
          selectedProject={selectedProject}
          getProjectStyle={getProjectStyle}
          onSelectProject={onSelectProject}
          onHoverTree={onHoverTree}
          cinematic={cinematic}
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
          patch — past that there is nothing more to see.

          The vault cutaway has to be let closer than that, and the floor is not
          a preference there but a wall. Its eye stands two meters inside the end
          wall looking down a twenty-meter room, which is barely eight meters
          from what it is aimed at — so a 12 m floor did not merely feel tight,
          it pushed the camera a meter clear THROUGH the liner every frame and
          filled the screen with the inside of the end wall. Underground the only
          real limit is the near plane. */}
      <TrackballControls
        ref={controlsRef}
        makeDefault
        noPan
        rotateSpeed={2.2}
        zoomSpeed={1.2}
        dynamicDampingFactor={0.12}
        minDistance={(focus?.view === 'sub' ? 1.5 : 12) * M_TO_UNITS}
        maxDistance={40000 * M_TO_UNITS}
        target={[HOME_TARGET.x, HOME_TARGET.y, HOME_TARGET.z]}
      />

      {/* Bloom on linear HDR, then the tone curve. Every note about the chain
          has to live out here rather than between the effects: EffectComposer
          types its children as JSX.Element, so a JSX comment in there is a
          type error, not a comment.

          THERE IS NO AMBIENT OCCLUSION PASS, and not for want of trying. AO
          would matter more on the Moon than almost anywhere — it approximates
          how much of the INDIRECT light a point can see, and indirect here is
          one thing only, regolith bounce at about 4% of the sun arriving from
          below, so a crevice or the underside of a hull is not merely darker
          than its surroundings but close to black. All three of the available
          passes were wired up and measured, and all three failed:

            - N8AO renders an entirely black frame. Even in its AO-only debug
              mode (renderMode 1) the pass emits nothing.
            - postprocessing's SSAO, on a NormalPass, renders — and does
              nothing. Pushed from intensity 22 to 90 it moved the mean frame
              luminance by 0.5 of 255.
            - SMAA (not AO, but the same class of depth-consuming pass) spams
              GL_INVALID_OPERATION on every frame.

          The common cause is this scene's depth range, and it is not fixable
          from here. Screen-space occlusion reconstructs view position from the
          depth buffer, and the near plane is one METRE while the far plane is
          past the Moon — a ratio of about 7e10. Beyond a few metres from the
          eye every surface lands in the same handful of depth codes, so there
          are no depth GRADIENTS left for an occlusion kernel to read. That
          near plane is not negotiable (the camera has to be able to stand next
          to a rover, and see the vault comments), and the long argument in the
          Canvas gl props explains why a logarithmic buffer, which would fix
          the range, is worse here for other reasons.

          Some of what AO would have bought is recovered anyway, by accident of
          getting the fill right: the regolith environment is bright below and
          black above, so a surface that faces the ground is lit and one that
          faces the sky is not. Orientation now does much of the work that
          screen-space occlusion would have done by geometry. */}
      <EffectComposer>
        <Bloom
          // High threshold keeps bloom off the sunlit regolith (which read as
          // a hazy video-game glow) and reserves it for emissive beacons.
          intensity={0.3}
          luminanceThreshold={0.9}
          luminanceSmoothing={0.85}
          mipmapBlur
        />
        <ToneMapping
          // AgX rather than ACES. ACES was written to make film look like film:
          // it skews bright warm surfaces orange as they climb and saturates
          // hard into the clip, which on a scene whose entire subject is
          // neutral grey soil under a white sun is a colour cast applied to the
          // one thing that must not have one. AgX desaturates toward white on
          // the way up instead, the way a real sensor does, and holds a far
          // longer shoulder — which is what a world with a 0.5° sun, no
          // atmosphere and a black sky needs, since the range between a sunlit
          // panel and the shadow beside it is enormous and neither end should
          // clip.
          mode={ToneMappingMode.AGX}
        />
      </EffectComposer>
    </Canvas>
  )
}
