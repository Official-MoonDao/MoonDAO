// High-fidelity react-three-fiber Moon globe for the Lunar Atlas.
//
// Renders a displaced, bump-shaded LROC/LOLA sphere under a single strong "sun"
// with a starfield backdrop and a subtle bloom pass. Textures load
// progressively (2K -> 4K -> 8K on demand) for fast first paint. A camera rig
// animates smooth drill-in to any lat/lon (e.g. the South Pole). Marker/model
// overlays are injected as children so this component stays presentation-only.

import { Stars, TrackballControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import {
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three'
import {
  drillInFraming,
  latLonToVector3,
  surfaceNormal,
  surfaceViewFraming,
} from '@/lib/lunar-atlas/geo'
import {
  COLOR_TIERS,
  DISPLACEMENT_BIAS,
  DISPLACEMENT_SCALE,
  DISPLACEMENT_TIERS,
  GLOBE_RADIUS,
} from '@/lib/lunar-atlas/textures'
import type { Vec3 } from '@/lib/lunar-atlas/geo'
import type { Organization, Project } from '@/lib/lunar-atlas/types'
import MarkerLayer, { MarkerStyle } from './MarkerLayer'
import useTerrainSampler, { RadiusAt } from './useTerrainSampler'

export type GlobeFocus = {
  lat: number
  lon: number
  distanceRadii?: number
  // 'orbit' (default) looks straight down from above; 'surface' does a
  // cinematic low pan to a from-the-ground vantage looking across at the model.
  view?: 'orbit' | 'surface'
} | null

export type MoonGlobeProps = {
  focus?: GlobeFocus
  // When true, upgrades to the 8K color map (used during drill-in).
  highDetail?: boolean
  autoRotate?: boolean
  onReady?: () => void
  // Atlas marker layer.
  projects?: Project[]
  organizations?: Organization[]
  selectedProjectId?: string | null
  hoveredProjectId?: string | null
  onSelectProject?: (id: string) => void
  onHoverProject?: (id: string | null) => void
  getProjectStyle?: (project: Project) => MarkerStyle
  markerDirs?: Map<string, Vec3>
  // Fired on a genuine click (not a drag-rotation) of the lunar surface or
  // the empty starfield — the page uses it to deselect and zoom back out.
  onBackgroundClick?: () => void
  children?: ReactNode
}

const COLOR_URLS = COLOR_TIERS.map((t) => t.color)

const configureColor = (t: THREE.Texture) => {
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16
}
const configureData = (t: THREE.Texture) => {
  t.colorSpace = THREE.LinearSRGBColorSpace
}

// Progressive texture ladder: loads tiers[0..wantedCount) and always shows the
// highest-resolution one that has decoded, never downgrading. Decoded textures
// are cached for the component's lifetime, so raising and lowering
// `wantedCount` (drill-in / drill-out) never re-downloads or re-decodes a
// tier — that used to cause a decode hitch right as the camera pan started.
function useProgressiveTexture(
  tiers: string[],
  wantedCount: number,
  configure: (t: THREE.Texture) => void
): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  const cacheRef = useRef<Map<string, THREE.Texture>>(new Map())
  const bestRef = useRef<number>(-1) // tier index of the displayed texture

  useEffect(() => {
    let cancelled = false
    const loader = new THREE.TextureLoader()

    const promote = (t: THREE.Texture, tierIdx: number) => {
      if (cancelled || tierIdx <= bestRef.current) return
      bestRef.current = tierIdx
      setTex(t)
    }

    tiers.slice(0, wantedCount).forEach((url, i) => {
      const cached = cacheRef.current.get(url)
      if (cached) {
        promote(cached, i)
        return
      }
      loader.load(url, (t) => {
        configure(t)
        t.needsUpdate = true
        cacheRef.current.set(url, t)
        promote(t, i)
      })
    })

    return () => {
      cancelled = true
    }
  }, [tiers, wantedCount, configure])

  // Dispose the whole cache only when the globe unmounts.
  useEffect(() => {
    const cache = cacheRef.current
    return () => {
      cache.forEach((t) => t.dispose())
      cache.clear()
    }
  }, [])

  return tex
}

// A pointer that travels farther than this between down and up is a drag
// (globe rotation), not a click — it must never select or deselect anything.
const CLICK_DRAG_TOLERANCE_PX = 8

function Moon({
  highDetail,
  onReady,
  onSurfaceClick,
}: {
  highDetail: boolean
  onReady?: () => void
  onSurfaceClick?: () => void
}) {
  // 2K color for first paint, 4K settled, 8K only in high-detail (drill-in).
  const color = useProgressiveTexture(
    COLOR_URLS,
    highDetail ? 3 : 2,
    configureColor
  )
  // 2K LOLA relief always; the 4K DEM upgrades it during drill-in.
  const displacement = useProgressiveTexture(
    DISPLACEMENT_TIERS,
    highDetail ? 2 : 1,
    configureData
  )
  const notified = useRef(false)

  useEffect(() => {
    if (color && !notified.current) {
      notified.current = true
      onReady?.()
    }
  }, [color, onReady])

  // Higher tessellation once the geometry can show relief.
  const geometry = useMemo(
    () => new THREE.SphereGeometry(GLOBE_RADIUS, 256, 256),
    []
  )

  if (!color) return null

  // No mesh rotation: THREE.SphereGeometry's UV layout already matches the
  // geo.ts lat/lon convention (seam at ±180°, lon 0 at +X). The previous
  // -90° Y rotation shifted the textures 90° of longitude relative to every
  // marker and camera framing, so pins sat over the wrong terrain.
  return (
    <mesh
      geometry={geometry}
      onClick={(e) => {
        if (e.delta <= CLICK_DRAG_TOLERANCE_PX) onSurfaceClick?.()
      }}
    >
      <meshStandardMaterial
        map={color}
        displacementMap={displacement ?? undefined}
        displacementScale={displacement ? DISPLACEMENT_SCALE : 0}
        displacementBias={displacement ? DISPLACEMENT_BIAS : 0}
        bumpMap={displacement ?? undefined}
        bumpScale={displacement ? 0.45 : 0}
        roughness={1}
        metalness={0}
        color={new THREE.Color('#cfcfcf')}
      />
    </mesh>
  )
}

// Default view faces lon 0 (+X in the geo convention) so the page opens on
// the nearside — Tycho, the maria, Copernicus — like the Moon from Earth.
const DEFAULT_CAM = new THREE.Vector3(GLOBE_RADIUS * 4, GLOBE_RADIUS * 0.6, 0)
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0)
const WORLD_Y = new THREE.Vector3(0, 1, 0)
// The camera must never go below the highest terrain the displacement can
// produce (GLOBE_RADIUS + DISPLACEMENT_SCALE/2 with the centered bias).
const CAMERA_FLOOR = GLOBE_RADIUS + DISPLACEMENT_SCALE / 2 + GLOBE_RADIUS * 0.01

// Animates the camera toward a lat/lon focus (or back to the default framing)
// ONLY while a transition is active. It moves along an orbital arc — slerping
// the view direction and easing the distance/target — rather than sliding in a
// straight line through space. Once it arrives (or the moment the user grabs
// the controls) it fully releases the camera back to OrbitControls, so the user
// can always freely rotate.
function CameraRig({
  focus,
  controlsRef,
  userInteracting,
  spin,
  onAnimatingChange,
  radiusAt,
}: {
  focus: GlobeFocus
  controlsRef: React.MutableRefObject<any>
  userInteracting: boolean
  spin: boolean
  onAnimatingChange: (animating: boolean) => void
  // Displaced terrain radius lookup — surface views frame against the real
  // ground height, not the analytic sphere.
  radiusAt?: RadiusAt | null
}) {
  const { camera } = useThree()
  const desiredPos = useRef(DEFAULT_CAM.clone())
  const desiredTarget = useRef(DEFAULT_TARGET.clone())
  const desiredUp = useRef(WORLD_Y.clone())
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
      // Surface views seat the camera on the displaced terrain; while the DEM
      // is still decoding, fall back to the analytic sphere (the deps re-run
      // this once the sampler arrives, refining the framing in-flight).
      const surfaceR =
        focus.view === 'surface' && radiusAt
          ? radiusAt(focus.lat, focus.lon)
          : GLOBE_RADIUS
      const { position, target } =
        focus.view === 'surface'
          ? surfaceViewFraming(focus.lat, focus.lon, surfaceR)
          : drillInFraming(
              focus.lat,
              focus.lon,
              GLOBE_RADIUS,
              focus.distanceRadii ?? 1.35
            )
      // Surface pans glide in slowly for a cinematic feel; orbit moves snappier.
      easeBase.current = focus.view === 'surface' ? 0.05 : 0.0022
      desiredPos.current.set(position[0], position[1], position[2])
      desiredTarget.current.set(target[0], target[1], target[2])
      // Surface view rolls the camera so "up" is the local outward normal —
      // otherwise the view is upside down at the poles.
      if (focus.view === 'surface') {
        const n = surfaceNormal(focus.lat, focus.lon)
        desiredUp.current.set(n[0], n[1], n[2])
      } else {
        desiredUp.current.copy(WORLD_Y)
      }
    } else {
      easeBase.current = 0.0022
      desiredPos.current.copy(DEFAULT_CAM)
      desiredTarget.current.copy(DEFAULT_TARGET)
      desiredUp.current.copy(WORLD_Y)
    }
    setAnimating(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, radiusAt])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls) return
    const curTarget = controls.target as THREE.Vector3

    // Hard floor: free zooming/tumbling must never put the camera inside the
    // Moon. (TrackballControls' minDistance can't express this — it limits
    // distance to the *target*, which sits on the surface during drill-in.)
    if (camera.position.lengthSq() < CAMERA_FLOOR * CAMERA_FLOOR) {
      camera.position.setLength(CAMERA_FLOOR)
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
      // so a 180° flip at the poles doesn't pass through a degenerate zero.
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
        Math.abs(newLen - dstLen) < GLOBE_RADIUS * 0.01 &&
        newTarget.distanceTo(desiredTarget.current) < GLOBE_RADIUS * 0.01
      ) {
        setAnimating(false)
      }
      return
    }

    // Idle: a gentle spin around the world vertical. TrackballControls reads the
    // camera position at the start of its own update, so nudging it here is
    // preserved and never fights the user's free rotation.
    if (spin) {
      const offset = camera.position.clone().sub(curTarget)
      offset.applyAxisAngle(WORLD_Y, 0.06 * delta)
      camera.position.copy(curTarget).add(offset)
    }
  })

  return null
}

// The sun sits far away along a fixed direction so the terminator stays crisp
// as the user orbits. A dim hemisphere + ambient keep the night side legible
// without washing out the shadow line.
function Sun() {
  const dir = useMemo(() => {
    const v = latLonToVector3(8, -55, 1)
    return new THREE.Vector3(v[0], v[1], v[2]).multiplyScalar(GLOBE_RADIUS * 12)
  }, [])
  return (
    <>
      <directionalLight position={dir} intensity={3.1} color="#fff6ec" />
      {/* Kept dim and desaturated: the lunar night side is earthshine-dark,
          not blue-washed. Just enough for far-side markers to stay legible. */}
      <hemisphereLight args={['#232b3d', '#0a0c12', 0.16]} />
      <ambientLight intensity={0.06} />
    </>
  )
}

export default function MoonGlobe({
  focus = null,
  highDetail = false,
  autoRotate = true,
  onReady,
  projects,
  organizations,
  selectedProjectId,
  hoveredProjectId,
  onSelectProject,
  onHoverProject,
  getProjectStyle,
  markerDirs,
  onBackgroundClick,
  children,
}: MoonGlobeProps) {
  const controlsRef = useRef<any>(null)
  // CPU-side copy of the DEM so markers, models, and the surface camera sit
  // on the displaced terrain the GPU actually renders.
  const radiusAt = useTerrainSampler()
  // Auto-rotate pauses whenever the user is drilled in, interacting, or a
  // camera transition is in flight.
  const [userInteracting, setUserInteracting] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const wheelTimer = useRef<ReturnType<typeof setTimeout>>()
  // Where the pointer went down, to tell clicks from drag-rotations in
  // onPointerMissed (which R3F fires for any click that hits no object —
  // including the release at the end of a starfield drag).
  const pointerDownAt = useRef<{ x: number; y: number } | null>(null)
  const spin = autoRotate && !focus && !userInteracting && !isAnimating

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
      dpr={[1, 1.75]}
      camera={{
        position: [GLOBE_RADIUS * 4, GLOBE_RADIUS * 0.6, 0],
        fov: 42,
        near: 0.01,
        far: GLOBE_RADIUS * 60,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
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
        radius={GLOBE_RADIUS * 30}
        depth={GLOBE_RADIUS * 12}
        count={6000}
        factor={GLOBE_RADIUS * 2}
        saturation={0}
        fade
        speed={0.3}
      />

      <Moon
        highDetail={highDetail}
        onReady={onReady}
        onSurfaceClick={onBackgroundClick}
      />

      {projects && organizations && (
        <MarkerLayer
          projects={projects}
          organizations={organizations}
          selectedProjectId={selectedProjectId}
          hoveredProjectId={hoveredProjectId}
          onSelect={onSelectProject}
          onHover={onHoverProject}
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
        spin={spin}
        onAnimatingChange={setIsAnimating}
        radiusAt={radiusAt}
      />

      {/* Trackball gives full free rotation — flip and tumble the Moon any way. */}
      <TrackballControls
        ref={controlsRef}
        makeDefault
        noPan
        rotateSpeed={3.2}
        zoomSpeed={1.2}
        dynamicDampingFactor={0.12}
        minDistance={GLOBE_RADIUS * 0.06}
        maxDistance={GLOBE_RADIUS * 8}
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
