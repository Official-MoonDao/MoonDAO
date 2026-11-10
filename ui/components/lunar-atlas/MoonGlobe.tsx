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
import { TrackballControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  drillInFraming,
  heroFraming,
  heroMinDistanceM,
  MOON_RADIUS_M,
  orbitUpVector,
  skyViewFraming,
  subViewFraming,
  surfaceNormal,
  surfaceViewFraming,
  vector3ToLatLon,
} from '@/lib/lunar-atlas/geo'
import type { Vec3 } from '@/lib/lunar-atlas/geo'
import {
  HOME_CAM as HOME_CAM_M,
  HOME_GROUND as HOME_GROUND_M,
  HOME_TARGET as HOME_TARGET_M,
} from '@/lib/lunar-atlas/homeview'
import { settlementPresence, type TechTree } from '@/lib/lunar-atlas/selectors'
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
  SUN_LOCAL_ELEV_DEG,
  DESIGN_EXPOSURE,
  exposureFor,
} from '@/lib/lunar-atlas/sun'
import {
  localElevationDeg,
  trueSunDirection,
  type SunPhase,
} from '@/lib/lunar-atlas/sunpath'
import { GLOBE_RADIUS } from '@/lib/lunar-atlas/textures'
import type { Organization, Project, ProjectType } from '@/lib/lunar-atlas/types'
import BaseRoads from './BaseRoads'
import useFrameBudget from './useFrameBudget'
import { setRegolithSun } from './regolithOcclusion'
import EarthGlobe from './EarthGlobe'
import GroundDisturbance from './GroundDisturbance'
import MarkerLayer, { ColonyLayout, MarkerStyle, siteOpacity } from './MarkerLayer'
import RockField from './RockField'
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
  // How big the subject IS, for 'surface' only. Absent means "assume the 10 m
  // installation the hero framing was written for", which is what a district
  // is — a district's framing has to hold a whole roster, not one machine.
  // Set it when flying to a single competitor, so a shoebox is framed like a
  // shoebox. See heroFraming.
  subjectM?: number
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
  selectedRaceId?: string | null
  // Competitor picked from a race panel — its plot is called out by name.
  selectedProject?: Project | null
  hoveredRaceId?: string | null
  // Competitors that stay lit while a race with no district of its own is
  // open. See litProjectIds in pages/moonbase.
  litProjectIds?: Set<string>
  onSelectTree?: (raceId: string) => void
  onSelectProject?: (projectId: string) => void
  onHoverTree?: (raceId: string | null) => void
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
  // A moment in the lunar year, or undefined for the sun the base was DESIGNED
  // around — a 44.46° sun that exists to make the layout legible and does not exist
  // on the Moon, where this ridge never sees one above ~2.1°. See lib/sun.ts for why
  // that choice was made and sunpath.ts for what the real sun does instead.
  //
  // A prop rather than a control inside the canvas, and undefined rather than a
  // boolean plus a default, for the same reason: this component should not hold an
  // opinion about which sun is being looked at. The page owns the scrubber, the
  // default is byte-for-byte the scene that shipped, and true-sun mode is
  // unreachable unless something explicitly asks for it.
  sunPhase?: SunPhase
  // False for a backdrop the page scrolls over: no trackball, no click or
  // hover handling, and the canvas lets every pointer and wheel event through
  // to the document. The camera is then driven by `focus` alone.
  interactive?: boolean
  // Stretches every camera transition by this factor (1 = default speed).
  glide?: number
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
// The colony centre on the ground. The home camera aims ABOVE this (see
// homeview), so anything that has to be centred on the base itself — the sun's
// shadow frustum — takes this rather than the camera's target.
const HOME_GROUND = new THREE.Vector3(...HOME_GROUND_M)
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
  glide,
}: {
  focus: GlobeFocus
  controlsRef: React.MutableRefObject<any>
  userInteracting: boolean
  onAnimatingChange: (animating: boolean) => void
  glide: number
  // Rendered terrain radius lookup — framings and the camera floor work
  // against the real ground height, not the analytic sphere.
  radiusAt?: RadiusAt | null
}) {
  const { camera } = useThree()
  const desiredPos = useRef(DEFAULT_CAM.clone())
  const desiredTarget = useRef(HOME_TARGET.clone())
  const desiredUp = useRef(HOME_UP.clone())
  // The look-at point when there is no TrackballControls to hold one.
  const ownTarget = useRef(HOME_TARGET.clone())
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
              ...heroFraming(focus.subjectM),
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
    const curTarget = (controls?.target ?? ownTarget.current) as THREE.Vector3

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
    if (controls) {
      const pivotDist = camera.position.distanceTo(curTarget)
      const feel = Math.sqrt(THREE.MathUtils.clamp(pivotDist / (2000 * M_TO_UNITS), 0, 1))
      controls.rotateSpeed = THREE.MathUtils.lerp(0.3, 2.2, feel)
      controls.zoomSpeed = THREE.MathUtils.lerp(0.5, 1.2, feel)
    }

    // Once the camera pulls well away from a drill-in pivot, glide the pivot
    // back to the ridge center. Without this, zooming out from a site leaves
    // the patch hanging half off-screen, orbiting a surface point the user
    // can no longer even see.
    if (!animating.current && curTarget.distanceToSquared(HOME_TARGET) > (1 * M_TO_UNITS) ** 2) {
      // Altitude above the base's ground level, in meters.
      const altM = (camera.position.length() - HOME_GROUND.length()) / M_TO_UNITS
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

      const t = 1 - Math.pow(easeBase.current, delta / glide) // frame-rate-independent easing
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
      if (controls) controls.update()
      else camera.lookAt(curTarget)

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

// Direction from the Moon's center toward the sun, defined once in lib/sun.ts so
// that the light, the ground, and the environment the metal reflects cannot
// disagree about where it is. At the ridge this works out to a 44.46° sun at
// bearing 50°.
const SUN_DIR = new THREE.Vector3(...SUN_DIR_ARR)

// The shadow-casting light is parked 2 km up the sun vector and aimed at
// whatever the camera is looking at, rather than out at the real sun: a
// directional light's shadow map spans its orthographic frustum, so keeping
// that frustum tight on what is in frame is what buys resolution.
//
// The frustum FOLLOWS THE CAMERA, and it used to be fixed. A fixed ±400 m box on
// the colony is 19.5 cm per texel, which is fine from the overview and useless
// from where this scene is actually judged: standing beside a rover, the shadow
// that should pin its wheel to the soil was two texels of grey smear, and a
// half-metre rock had no shadow at all. That missing contact shadow is most of
// why hardware and rocks read as floating above the ground.
//
// So the box is sized to the camera's distance from its subject — SHADOW_REACH
// times that, between the two limits below. At the overview it is the box it
// always was; ten metres off a lander it is ±100 m across the same 4096 texels,
// 4.9 cm each, and a footpad casts a footpad-shaped shadow. Ground outside the
// box is simply unshadowed, which is the same trade the fixed box made, just
// moved to where the camera is not looking.
const SHADOW_LIGHT_DIST = 2000 * M_TO_UNITS
const SHADOW_MAP_SIZE = 4096
const SHADOW_EXTENT_MAX = 400 * M_TO_UNITS
const SHADOW_EXTENT_MIN = 100 * M_TO_UNITS
const SHADOW_REACH = 2
// The box resizes in 19% steps rather than continuously. Every resize re-rasterises
// every shadow edge against a new texel grid, so a continuously fitted box makes
// the whole frame's shadows crawl for as long as the camera is dollying.
const SHADOW_EXTENT_STEP = Math.pow(2, 0.25)

// Lunar shadows are HARD, and this is the arithmetic that says so rather than
// a preference. The sun subtends 0.533° from the Moon (SUN_ANGULAR_RADIUS_RAD),
// so a penumbra widens by 2·tan(0.2664°) = 9.3 MILLIMETRES for every metre an
// occluder stands off what it is shadowing. This shadow map's texels run from
// 4.9 cm (close in) to 19.5 cm (the overview), so the 52 m Starship casts a
// penumbra a texel wide at its own tip from far off and a few texels wide from
// beside it, and nearly everything smaller casts one that is sub-texel.
//
// A PCSS pass (drei's SoftShadows) was the obvious move here and is the wrong
// one: contact-hardening soft shadows exist to portray a penumbra that this
// scene, uniquely, does not have. It would only invent softness the Moon has
// none of, for a real per-frame cost. What the shadow edge actually needs is
// antialiasing of a hard step, which is what PCFSoftShadowMap does — its fixed
// filter works out to roughly a texel, i.e. the penumbra of a 5 to 20 m
// standoff, so the one place it errs it errs toward the truth.
const SUN_PENUMBRA_PER_M = 2 * Math.tan(SUN_ANGULAR_RADIUS_RAD)

// Offset along the surface normal to kill shadow acne on the terrain's sloped
// cells. It buys that at the cost of sliding the shadow laterally by the same
// distance, so it is quoted in SHADOW TEXELS rather than in metres: acne is a
// texel-sized artifact, and a bias that does not shrink with the texel leaves a
// gap under every footpad the moment the map gets sharp enough to show one —
// the detached, pasted-on-a-photo look the shadows exist to prevent. 0.6 of a
// texel is what the old fixed 12 cm was against its 19.5 cm texels.
const SHADOW_NORMAL_BIAS_TEXELS = 0.6

// The ceiling on the grazing-sun scaling below, also in texels. Three texels of
// lateral slide is the point past which a footpad's shadow visibly leaves the
// footpad. See the derivation at its use site.
const SHADOW_NORMAL_BIAS_MAX_TEXELS = 3

// The scene's sun, and now genuinely the only one. It shades the installations,
// casts their shadows, and lights the ground: SouthPoleTerrain evaluates the
// regolith BRDF against this light per pixel rather than displaying a hillshade
// baked from a private copy of its direction, which also retired the separate
// pass that used to exist only to catch shadows on the terrain.
// Where the sun is, resolved once. Undefined phase means the design sun, and then this
// is exactly SUN_DIR and the scene that shipped.
//
// Hoisted out of Sun because the SKY needs the elevation too — a backdrop and a light
// that disagree about the sun is the kind of inconsistency nothing catches, and it
// already bit once (see screenAnchoredScale). One resolution, one source.
type ResolvedSun = { dir: THREE.Vector3; elevationDeg: number }

function useResolvedSun(sunPhase?: SunPhase): ResolvedSun {
  return useMemo(() => {
    if (!sunPhase) return { dir: SUN_DIR, elevationDeg: SUN_LOCAL_ELEV_DEG }
    const v = trueSunDirection(sunPhase)
    return { dir: new THREE.Vector3(...v), elevationDeg: localElevationDeg(v) }
  }, [sunPhase])
}

function Sun({ dir, elevationDeg }: ResolvedSun) {
  const lightRef = useRef<THREE.DirectionalLight>(null)
  // A directional light aims at its `target` object, which must be in the
  // scene for its world matrix to update.
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.copy(HOME_GROUND)
    return o
  }, [])

  // Everything the ground needs from the sun, in one call, because the shading and
  // the skyline test have to be looking at the same sun — a light moved without the
  // occlusion uniforms following would put shadows at yesterday's azimuth, which is
  // invisible in a still frame and obvious the moment it is scrubbed.
  //
  // Exposure travels with it for the reason in sun.ts: it opens up as the sun drops,
  // anchored to the highlights so a grazing sun reads as sidelight rather than as
  // chalky noon. Set on the renderer rather than the effect because @r3f/postprocessing
  // takes over gl.toneMapping but the AgX chunk still reads gl.toneMappingExposure.
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    setRegolithSun([dir.x, dir.y, dir.z], elevationDeg)
    gl.toneMappingExposure = exposureFor(elevationDeg)
  }, [dir, elevationDeg, gl])

  // Shadow-map bias in texels, and the one number that genuinely cannot stay fixed
  // across a sun this low.
  //
  // Acne is a depth-quantisation artifact whose size is the light-space texel
  // footprint projected onto the receiver: a ground plane at grazing incidence spans
  // texel/tan(elevation) of depth within ONE texel, so the bias that is ample at 44°
  // is 1/19th of what 2° needs, and the ground stripes itself. Paying it in full is
  // not an option either — normalBias slides the shadow laterally by exactly its own
  // value, so texels of it detach every footpad from its own shadow.
  //
  // So it is capped, and the cap is the honest half of this: past about 12° the bias
  // needed exceeds what the shadow can afford, and the artifact is accepted rather
  // than traded for peter-panning. It is the right trade here specifically because
  // at those elevations the shadow map is no longer doing the important work — the
  // skyline field is, at terrain scale, and it has no depth buffer to quantise.
  // Ratios against the design sun, so the design sun is exactly 1.0x by construction.
  const biasTexels = useMemo(() => {
    const design = Math.sin((SUN_LOCAL_ELEV_DEG * Math.PI) / 180)
    const graze = Math.max(Math.sin((elevationDeg * Math.PI) / 180), 0.02)
    return Math.min(
      (SHADOW_NORMAL_BIAS_TEXELS * design) / graze,
      SHADOW_NORMAL_BIAS_MAX_TEXELS
    )
  }, [elevationDeg])

  // Two axes square to the sun, fixed for as long as the sun is. The shadow box is
  // snapped to whole texels along them, so a camera move slides the box across the
  // ground without re-rasterising any edge that was already drawn.
  const basis = useMemo(() => {
    const right = new THREE.Vector3().crossVectors(HOME_UP, dir).normalize()
    const up = new THREE.Vector3().crossVectors(dir, right).normalize()
    return { right, up }
  }, [dir])

  // Camera-relative shadow lookups. See PRECISE_SHADOW_VERTEX_PATCH for the half of
  // this that lives in the shaders, and for why it exists: a world position here
  // is a float32 of magnitude 2, which resolves 21 cm, and no shadow map can be
  // sharper than the coordinates it is looked up with.
  //
  // three rebuilds shadow.matrix (world -> shadow clip) inside every render, so the
  // override has to ride on updateMatrices rather than be written once. Appending a
  // translation to the camera makes the same matrix accept positions RELATIVE to
  // the camera; the product is formed in doubles, and what reaches the GPU is a
  // matrix whose offsets are metres rather than lunar radii.
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    const light = lightRef.current
    if (!light) return
    const shadow = light.shadow
    const base = shadow.updateMatrices
    const eye = new THREE.Vector3()
    const shift = new THREE.Matrix4()
    shadow.updateMatrices = function (l: THREE.Light) {
      base.call(this, l)
      eye.setFromMatrixPosition(camera.matrixWorld)
      this.matrix.multiply(shift.makeTranslation(eye.x, eye.y, eye.z))
    }
    return () => {
      shadow.updateMatrices = base
    }
  }, [camera])

  const controls = useThree((s) => s.controls) as { target?: THREE.Vector3 } | null
  const fit = useRef({ extent: 0, focus: new THREE.Vector3(), centre: new THREE.Vector3() })
  useFrame(({ camera: cam }) => {
    const light = lightRef.current
    if (!light) return
    const f = fit.current
    // What the camera is looking at: the trackball's pivot when there is one, and
    // otherwise the point the same distance down the view axis as the colony is.
    if (controls?.target) f.focus.copy(controls.target)
    else {
      cam.getWorldDirection(f.focus)
      f.focus.multiplyScalar(cam.position.distanceTo(HOME_GROUND)).add(cam.position)
    }
    const want = THREE.MathUtils.clamp(
      cam.position.distanceTo(f.focus) * SHADOW_REACH,
      SHADOW_EXTENT_MIN,
      SHADOW_EXTENT_MAX
    )
    // Hysteresis of one step, so a camera hovering on a boundary cannot flip the
    // box back and forth every frame.
    if (f.extent === 0 || want > f.extent * SHADOW_EXTENT_STEP || want < f.extent / SHADOW_EXTENT_STEP) {
      const steps = Math.round(Math.log(want / SHADOW_EXTENT_MAX) / Math.log(SHADOW_EXTENT_STEP))
      f.extent = THREE.MathUtils.clamp(
        SHADOW_EXTENT_MAX * Math.pow(SHADOW_EXTENT_STEP, steps),
        SHADOW_EXTENT_MIN,
        SHADOW_EXTENT_MAX
      )
      const sc = light.shadow.camera
      sc.left = sc.bottom = -f.extent
      sc.right = sc.top = f.extent
      sc.updateProjectionMatrix()
    }
    const texel = (2 * f.extent) / SHADOW_MAP_SIZE
    light.shadow.normalBias = biasTexels * texel

    // Centred on the ground under the focus rather than on the focus itself: the
    // home framing aims 69 m above the deck, and hanging the box off that would
    // slide every shadow off the hardware casting it.
    f.centre
      .copy(f.focus)
      .setLength(HOME_GROUND.length())
    const along = f.centre.dot(dir)
    const sx = Math.round(f.centre.dot(basis.right) / texel) * texel
    const sy = Math.round(f.centre.dot(basis.up) / texel) * texel
    f.centre
      .set(0, 0, 0)
      .addScaledVector(basis.right, sx)
      .addScaledVector(basis.up, sy)
      .addScaledVector(dir, along)
    target.position.copy(f.centre)
    target.updateMatrixWorld()
    light.position.copy(f.centre).addScaledVector(dir, SHADOW_LIGHT_DIST)
    light.updateMatrixWorld()
  })

  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={lightRef}
        target={target}
        intensity={SUN_INTENSITY}
        color={SUN_COLOR}
        castShadow
        shadow-mapSize-width={SHADOW_MAP_SIZE}
        shadow-mapSize-height={SHADOW_MAP_SIZE}
        shadow-camera-near={SHADOW_LIGHT_DIST * 0.6}
        shadow-camera-far={SHADOW_LIGHT_DIST * 1.6}
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

// The starfield.
//
// Worth saying what the STRICTLY correct answer would be, because this is not it: a
// camera exposed for sunlit regolith records no stars at all. That is why every Apollo
// surface photograph has a completely empty black sky, and it is the most-argued-about
// fact in all of lunar photography. Physically, these should vanish the moment the
// ground is properly exposed.
//
// They are kept because they are load-bearing for something else — this same camera
// pulls back to orbit, where a starless void reads as a broken render rather than as an
// airless one. So they are kept at the threshold of visibility, the way a long
// exposure from the surface would just begin to pick them up, and built to look like
// a sky rather than like a particle effect:
//
//   - POINTS, a pixel or two across. The previous field was drei's Stars, whose
//     sprites scale with distance and came out as several-pixel discs — six
//     thousand evenly bright dots, which is what a game skybox looks like.
//   - A MAGNITUDE DISTRIBUTION. Real star counts rise about 2.5x per magnitude, so
//     for every bright star there are dozens at the limit of sight. Brightness here
//     is drawn from that law; a handful carry the sky and the rest are dust.
//   - A galactic plane. A third of the field is concentrated toward one great
//     circle, because a uniformly random sky has no structure and the real one does.
//
// Brightness is authored as a SCREEN value and divided by the exposure, so the stars
// hold still while the exposure opens up under a low sun (see screenAnchoredScale).
const STAR_COUNT = 5200
// Linear screen brightness of the brightest star, after exposure and before the tone
// curve. Mid-grey is 0.18: the brightest handful sit just above it and the faint
// majority sit two to five stops below.
const STAR_PEAK = 0.3
// Magnitudes spanned, brightest to faintest.
const STAR_MAG_SPAN = 5.5
const GALACTIC_POLE = new THREE.Vector3(0.48, 0.62, -0.62).normalize()

function buildStarfield(): THREE.BufferGeometry {
  // Deterministic, so the sky is the same sky on every load.
  let seed = 20260101
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0x100000000
  }
  const positions = new Float32Array(STAR_COUNT * 3)
  const colors = new Float32Array(STAR_COUNT * 3)
  const sizes = new Float32Array(STAR_COUNT)
  const v = new THREE.Vector3()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  // Any two axes square to the galactic pole.
  a.crossVectors(GALACTIC_POLE, new THREE.Vector3(0, 1, 0)).normalize()
  b.crossVectors(GALACTIC_POLE, a).normalize()
  const tint = new THREE.Color()
  for (let i = 0; i < STAR_COUNT; i++) {
    if (rand() < 0.36) {
      // Toward the plane: a Gaussian in galactic latitude, ~9° wide.
      const lon = rand() * Math.PI * 2
      const g = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(rand() * Math.PI * 2)
      const lat = g * 0.16
      v.copy(a)
        .multiplyScalar(Math.cos(lon) * Math.cos(lat))
        .addScaledVector(b, Math.sin(lon) * Math.cos(lat))
        .addScaledVector(GALACTIC_POLE, Math.sin(lat))
    } else {
      const z = rand() * 2 - 1
      const t = rand() * Math.PI * 2
      const r = Math.sqrt(1 - z * z)
      v.set(r * Math.cos(t), z, r * Math.sin(t))
    }
    v.multiplyScalar(GLOBE_RADIUS * 18)
    positions.set([v.x, v.y, v.z], i * 3)

    // Counts go as 10^(0.4 m): invert that CDF so most stars land at the faint end.
    const k = Math.pow(10, 0.4 * STAR_MAG_SPAN)
    const mag = Math.log10(1 + rand() * (k - 1)) / 0.4
    const flux = Math.pow(10, -0.4 * (STAR_MAG_SPAN - mag))
    // Star colour by temperature, mostly near white: a few blue-white, a few orange.
    const temp = rand()
    if (temp < 0.14) tint.setRGB(0.78, 0.86, 1)
    else if (temp > 0.86) tint.setRGB(1, 0.84, 0.68)
    else tint.setRGB(1, 0.97, 0.93)
    // Brightness beyond what one pixel can carry goes into size instead, as it does
    // on a sensor: the brightest stars are two pixels across, not brighter pixels.
    const brightness = Math.pow(flux, 0.8)
    colors.set([tint.r * brightness, tint.g * brightness, tint.b * brightness], i * 3)
    sizes[i] = 1 + 1.4 * Math.pow(flux, 0.5)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
  return geo
}

const STAR_VERTEX = /* glsl */ `
attribute float size;
attribute vec3 color;
uniform float pixelRatio;
varying vec3 vColor;
void main() {
  vColor = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * pixelRatio;
}`

const STAR_FRAGMENT = /* glsl */ `
uniform float gain;
varying vec3 vColor;
void main() {
  // A soft-edged disc, so a star lands on the pixel grid as a star and not a square.
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.35, 1.0, d);
  gl_FragColor = vec4(vColor * gain * a, 1.0);
}`

function Starfield({ elevationDeg }: { elevationDeg: number }) {
  const geometry = useMemo(buildStarfield, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  const dpr = useThree((s) => s.viewport.dpr)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: STAR_VERTEX,
        fragmentShader: STAR_FRAGMENT,
        uniforms: { gain: { value: 1 }, pixelRatio: { value: 1 } },
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    []
  )
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => {
    material.uniforms.gain.value = STAR_PEAK / exposureFor(elevationDeg)
    material.uniforms.pixelRatio.value = dpr
  }, [material, elevationDeg, dpr])
  return <points geometry={geometry} material={material} frustumCulled={false} raycast={NO_RAYCAST} />
}

const NO_RAYCAST = () => {}

// The sky, which on an airless world is simply the absence of one: black, and
// exactly black. It used to be a very dark blue, authored to keep the frame from
// reading as a dead region of the page, and any colour at all in the backdrop turns
// navy as soon as the exposure opens — the most unphysical thing a lunar frame can
// contain, since the one thing everybody knows about that sky is that it is black.
function SkyBackdrop() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.background = new THREE.Color(0, 0, 0)
    return () => {
      scene.background = null
    }
  }, [scene])
  return null
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
// The terrain does not read this map — three only applies scene.environment to
// physical materials, and the ground is a patched Lambert. It does not need to:
// the environment's ground half is generated by calling the same BRDF the
// terrain shades with, so the plain a dish reflects and the plain it stands on
// are the same plain.
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
  selectedRaceId,
  selectedProject,
  hoveredRaceId,
  litProjectIds,
  onSelectTree,
  onSelectProject,
  onHoverTree,
  getProjectStyle,
  layout,
  onBackgroundClick,
  cinematic,
  sunPhase,
  interactive = true,
  glide = 1,
  children,
}: MoonGlobeProps) {
  const controlsRef = useRef<any>(null)
  // Resolved once here so the light, the sky and the starfield are all reading the same
  // sun. See useResolvedSun.
  const sun = useResolvedSun(sunPhase)
  // CPU-side copy of the height maps so markers, models, and the camera sit
  // on the terrain the GPU actually renders.
  const radiusAt = useTerrainSampler()
  // How far along the timeline each site is, so the groundworks arrive with the
  // hardware rather than lying on an empty plain years early — and so no spur
  // is graded out to a plot nobody has broken ground on yet.
  const sitePresence = useMemo(() => {
    const byRace = new Map<string, number>()
    for (const t of trees ?? []) byRace.set(t.raceId, siteOpacity(t, getProjectStyle))
    return byRace
  }, [trees, getProjectStyle])
  // The branch roads belong to the base PLAN, so each one serves a district —
  // a hardware type — and not a race. Translate through the district's actual
  // occupant. Keying the roads by race id instead left every branch looking up
  // a name the plan has never used, which reads as zero and ungrades the whole
  // network down to the bare spine.
  const branchPresence = useMemo(() => {
    const byType = new Map<string, number>()
    for (const [type, raceId] of layout?.districtOwner ?? []) {
      byType.set(type, sitePresence.get(raceId) ?? 0)
    }
    return byType
  }, [layout, sitePresence])
  // The built environment — graded roads, street lighting, the
  // roadside cargo, the parked excavators, the vault dig — is the work of the
  // surface construction fleet, so it arrives when that fleet does and not when
  // the first lander touches down. Keying it to the loudest district on the
  // ridge put a lit street grid around a single dead 2024 lander, because one
  // achieved landing was enough to build the whole town. Presence is keyed by
  // race id, so the fleet is the construction race, not the hardware-type
  // string. Falls back to the loudest site only when a filter has taken the
  // construction race off the map entirely, so filtering cannot delete the
  // roads under everything else.
  const basePresence = useMemo(
    () => settlementPresence(trees ?? [], sitePresence),
    [trees, sitePresence]
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

  // Nothing on this map moves faster than a walk, so the scene does not need a
  // frame for every one the display can scan out. See useFrameBudget for the
  // rates, and for why `demand` is not the answer to a scene that is never idle.
  const budget = useFrameBudget(userInteracting || isAnimating)

  return (
    <Canvas
      frameloop="never"
      onCreated={budget.onCreated}
      dpr={budget.dpr}
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
        // OFF, and this is not a quality decision — it is the removal of an
        // antialiasing pass that never touched a single edge in this scene.
        //
        // `antialias` multisamples the DEFAULT framebuffer, i.e. the one the
        // canvas presents from. Every pixel of geometry here is rasterised into
        // the EffectComposer's own render target instead, and the only thing
        // ever drawn into the default framebuffer is the composer's final
        // fullscreen triangle — which has no interior edges to alias. So this
        // was buying a multisampled copy of the whole drawing buffer, and a
        // resolve of it every frame, to smooth the two diagonals of a triangle
        // that covers the screen. The real edge antialiasing is, and always was,
        // the composer's `multisampling` below.
        antialias: false,
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
        // curve is selected. The value, and the argument for it, are in
        // lib/lunar-atlas/sun.ts: it is a camera setting, chosen for the ground,
        // and exposureFor() opens up from it as the sun drops.
        toneMappingExposure: DESIGN_EXPOSURE,
        // A LOGARITHMIC depth buffer is the obvious choice for a scene that
        // spans orbit to millimeters, and it was used here, and it was the
        // wrong call — it is the direct cause of the shimmer that has been
        // chased around this scene with lift hacks (the pit halo, the
        // excavator) and of vault interiors that boiled.
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
      style={interactive ? undefined : { pointerEvents: 'none' }}
      onPointerMissed={
        interactive
          ? (e) => {
              const down = pointerDownAt.current
              const moved = down ? Math.hypot(e.clientX - down.x, e.clientY - down.y) : 0
              if (moved <= CLICK_DRAG_TOLERANCE_PX) onBackgroundClick?.()
            }
          : undefined
      }
      onPointerDown={
        interactive
          ? (e) => {
              setUserInteracting(true)
              pointerDownAt.current = { x: e.clientX, y: e.clientY }
            }
          : undefined
      }
      onWheel={interactive ? handleWheel : undefined}
    >
      <SkyBackdrop />

      <Sun {...sun} />
      <LunarEnvironment />
      <EarthGlobe />

      <Starfield elevationDeg={sun.elevationDeg} />

      <SouthPoleTerrain onReady={onReady} onSurfaceClick={onBackgroundClick} />

      <RockField radiusAt={radiusAt} />

      <BaseRoads radiusAt={radiusAt} presence={basePresence} siteOpacity={branchPresence} />

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
          selectedRaceId={selectedRaceId}
          selectedProject={selectedProject}
          hoveredRaceId={hoveredRaceId}
          litProjectIds={litProjectIds}
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
          selectedRaceId={selectedRaceId}
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
        glide={glide}
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
      {interactive && (
        <TrackballControls
          ref={controlsRef}
          makeDefault
          noPan
          rotateSpeed={2.2}
          zoomSpeed={1.2}
          dynamicDampingFactor={0.12}
          minDistance={
            (focus?.view === 'sub'
              ? 1.5
              : focus?.view === 'surface'
              ? heroMinDistanceM(focus.subjectM)
              : 12) * M_TO_UNITS
          }
          maxDistance={40000 * M_TO_UNITS}
          target={[HOME_TARGET.x, HOME_TARGET.y, HOME_TARGET.z]}
        />
      )}

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
          screen-space occlusion would have done by geometry.

          AFTER the tone curve come the two things a lens and a sensor add to any
          photograph, and whose total absence is one of the ways a render
          announces itself: a little light fall-off toward the corners, and grain.
          Both are applied in display space, where a camera applies them, and
          both are kept at the level where they are felt rather than seen. */}
      <EffectComposer
        // 4 rather than the library's default of 8, and stated rather than
        // inherited because this is now the scene's ONLY edge antialiasing (see
        // the gl props for why the context's own is off).
        //
        // Each sample is a full RGBA half-float copy of the whole drawing
        // buffer, resolved every frame, so halving the count halves that. Much
        // of the time it will already have been halved for us — WebGL2 clamps
        // to MAX_SAMPLES, which is 4 on a good deal of hardware including
        // Apple's — which is the other half of the argument for writing it
        // down: 8 was never what most of these machines were running anyway.
        multisampling={4}
      >
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
        <Vignette offset={0.32} darkness={0.42} />
        <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.28} />
      </EffectComposer>
    </Canvas>
  )
}
