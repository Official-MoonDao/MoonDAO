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
  DEFAULT_COLOR,
  DISPLACEMENT_MAP,
  DISPLACEMENT_SCALE,
  FIRST_PAINT_COLOR,
  GLOBE_RADIUS,
  HIGH_DETAIL_COLOR,
} from '@/lib/lunar-atlas/textures'
import type { Vec3 } from '@/lib/lunar-atlas/geo'
import type { Organization, Project } from '@/lib/lunar-atlas/types'
import MarkerLayer, { MarkerStyle } from './MarkerLayer'

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
  // Deselect when clicking empty space on the globe.
  onBackgroundClick?: () => void
  children?: ReactNode
}

// Progressive color texture: start at 2K for instant paint, then swap to 4K,
// then 8K when highDetail is requested. Returns the best-loaded texture.
function useProgressiveColor(highDetail: boolean): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  const loadedRef = useRef<Set<string>>(new Set())
  const bestRef = useRef<number>(-1) // tier index of current texture

  useEffect(() => {
    const loader = new THREE.TextureLoader()
    let cancelled = false

    const tiers = highDetail
      ? [FIRST_PAINT_COLOR, DEFAULT_COLOR, HIGH_DETAIL_COLOR]
      : [FIRST_PAINT_COLOR, DEFAULT_COLOR]

    const apply = (t: THREE.Texture, tierIdx: number) => {
      if (cancelled) return
      // Only upgrade — never downgrade to a lower tier that resolves late.
      if (tierIdx <= bestRef.current) {
        t.dispose()
        return
      }
      bestRef.current = tierIdx
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      t.needsUpdate = true
      setTex((prev) => {
        prev?.dispose()
        return t
      })
    }

    tiers.forEach((url, i) => {
      if (loadedRef.current.has(url) && i <= bestRef.current) return
      loader.load(url, (t) => apply(t, i))
    })

    return () => {
      cancelled = true
    }
  }, [highDetail])

  return tex
}

function useDisplacement(): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let cancelled = false
    const loader = new THREE.TextureLoader()
    loader.load(DISPLACEMENT_MAP, (t) => {
      if (cancelled) {
        t.dispose()
        return
      }
      t.colorSpace = THREE.LinearSRGBColorSpace
      setTex(t)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return tex
}

function Moon({
  highDetail,
  onReady,
}: {
  highDetail: boolean
  onReady?: () => void
}) {
  const color = useProgressiveColor(highDetail)
  const displacement = useDisplacement()
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

  return (
    <mesh geometry={geometry} rotation={[0, -Math.PI / 2, 0]}>
      <meshStandardMaterial
        map={color}
        displacementMap={displacement ?? undefined}
        displacementScale={displacement ? DISPLACEMENT_SCALE : 0}
        bumpMap={displacement ?? undefined}
        bumpScale={displacement ? 0.9 : 0}
        roughness={1}
        metalness={0}
        color={new THREE.Color('#cfcfcf')}
      />
    </mesh>
  )
}

const DEFAULT_CAM = new THREE.Vector3(0, GLOBE_RADIUS * 0.6, GLOBE_RADIUS * 4)
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0)
const WORLD_Y = new THREE.Vector3(0, 1, 0)

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
}: {
  focus: GlobeFocus
  controlsRef: React.MutableRefObject<any>
  userInteracting: boolean
  spin: boolean
  onAnimatingChange: (animating: boolean) => void
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
      const { position, target } =
        focus.view === 'surface'
          ? surfaceViewFraming(focus.lat, focus.lon, GLOBE_RADIUS)
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
  }, [focus])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls) return
    const curTarget = controls.target as THREE.Vector3

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
      <hemisphereLight args={['#2a3550', '#0a0c12', 0.26]} />
      <ambientLight intensity={0.1} />
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
  // Auto-rotate pauses whenever the user is drilled in, interacting, or a
  // camera transition is in flight.
  const [userInteracting, setUserInteracting] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const wheelTimer = useRef<ReturnType<typeof setTimeout>>()
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
      dpr={[1, 2]}
      camera={{
        position: [0, GLOBE_RADIUS * 0.6, GLOBE_RADIUS * 4],
        fov: 42,
        near: 0.01,
        far: GLOBE_RADIUS * 60,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      onPointerMissed={() => onBackgroundClick?.()}
      onPointerDown={() => setUserInteracting(true)}
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

      <Moon highDetail={highDetail} onReady={onReady} />

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
        />
      )}

      {children}

      <CameraRig
        focus={focus}
        controlsRef={controlsRef}
        userInteracting={userInteracting}
        spin={spin}
        onAnimatingChange={setIsAnimating}
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

      <EffectComposer>
        <Bloom
          intensity={0.42}
          luminanceThreshold={0.62}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  )
}
