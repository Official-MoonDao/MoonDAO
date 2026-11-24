// The My Moonbase build plot, in three dimensions.
//
// A standalone scene, not a view of Moon Base Zero: that one is a fixed plan on
// real south-pole terrain, measured in Moon radii. This one is a flat pad the
// visitor lays out themselves, measured in meters, with the plot centre at the
// origin and +Y up. The hardware is the atlas's own models.

import { MapControls, useTexture } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import {
  Suspense,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import * as THREE from 'three'
import { SURFACE_NOISE_SIZE, buildSurfaceNoise } from '@/lib/lunar-atlas/surfaceNoise'
import {
  CELL_M,
  GRID_CELLS,
  PLOT_M,
  ROAD_E,
  ROAD_N,
  ROAD_S,
  ROAD_W,
  canPave,
  canPlace,
  cellAtM,
  cellCenterM,
  cellKey,
  footprintAnchor,
  footprintCenterM,
  hasRoad,
  itemAt,
  parseCellKey,
  roadLinks,
  roadPath,
  type Cell,
  type MoonbaseLayout,
  type PlacedItem,
} from '@/lib/my-moonbase/grid'
import {
  CableReel,
  CrateCluster,
  BrickPallet,
  Excavator,
  ProceduralModel,
  RoverDepotYard,
  RoverGasStation,
  SparePartsPallet,
  StreetLight,
  VerticalSolarArray,
} from '@/components/lunar-atlas/ProjectModel'
import { rockGeometry } from '@/components/lunar-atlas/rocks'
import useFrameBudget from '@/components/lunar-atlas/useFrameBudget'
import type { AssetInfo, BuilderTool, CameraFocus, PendingPlacement } from './assets'

export type BuilderSceneProps = {
  layout: MoonbaseLayout
  tool: BuilderTool
  pending: PendingPlacement | null
  /** First cell of a road being drawn, once it has been picked. */
  roadStart: Cell | null
  selectedId: string | null
  /** Placed assets the visitor no longer backs. Drawn as an empty, locked plot. */
  heldBackIds: ReadonlySet<string>
  assetInfo: (projectId: string) => AssetInfo | undefined
  focus: CameraFocus | null
  onCellClick: (cell: Cell) => void
  onItemClick: (id: string) => void
  onBackgroundClick: () => void
  /** Filled with a function that returns the view as it stands, for the share image. */
  captureRef?: MutableRefObject<FrameCapture | null>
}

export type FrameCapture = () => HTMLCanvasElement | null

// Pointer travel beyond this between down and up is a camera drag, not a click.
const CLICK_DRAG_TOLERANCE_PX = 6

// A low sun, the way the south pole gets it: long shadows, hard edges.
const SUN_DIR = new THREE.Vector3(-0.55, 0.3, 0.78).normalize()
const SUN_ELEV_RAD = Math.asin(SUN_DIR.y)
// Yaw that turns a model's +X toward the sun's compass heading.
const SUN_YAW = Math.atan2(-SUN_DIR.z, SUN_DIR.x)
const EARTH_DIR = new THREE.Vector3(-0.42, 0.2, -0.88).normalize()

const GROUND = '#a3a09c'
const ROAD = '#5f5b57'
const BERM = '#a39d95'
const ACCENT = '#67e8f9'
const OK = '#4ade80'
const BLOCKED = '#f87171'
const LOCKED = '#fbbf24'

// The plot is flat out to here; the surrounding ground only starts to roll
// past it, so nothing placed at the plot edge stands on a slope.
const FLAT_RADIUS_M = (PLOT_M / 2) * Math.SQRT2 + 20
const TERRAIN_SIZE_M = 9000
const TERRAIN_SEGMENTS = 240
const GROUND_TONE_TILE_M = 173
const GROUND_RELIEF_TILE_M = 13

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function valueNoise(x: number, z: number): number {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const fx = x - xi
  const fz = z - zi
  const u = fx * fx * (3 - 2 * fx)
  const v = fz * fz * (3 - 2 * fz)
  const a = hash2(xi, zi)
  const b = hash2(xi + 1, zi)
  const c = hash2(xi, zi + 1)
  const d = hash2(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

// Four octaves, centred on zero.
function fbm(x: number, z: number): number {
  let sum = 0
  let amp = 0.5
  let freq = 1
  for (let i = 0; i < 4; i++) {
    sum += amp * (valueNoise(x * freq, z * freq) - 0.5)
    freq *= 2
    amp *= 0.5
  }
  return sum
}

function terrainHeightM(x: number, z: number): number {
  const r = Math.hypot(x, z)
  const hills = fbm(x / 420 + 7.3, z / 420 - 2.1) * 80
  // Kept low: from the opening view the far rim has to leave sky above it.
  const rim = smoothstep(1500, 3600, r) * (30 + (fbm(x / 600, z / 600) + 0.5) * 170)
  return smoothstep(FLAT_RADIUS_M, FLAT_RADIUS_M + 700, r) * hills + rim
}

function useTerrainGeometry(): THREE.BufferGeometry {
  return useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      TERRAIN_SIZE_M,
      TERRAIN_SIZE_M,
      TERRAIN_SEGMENTS,
      TERRAIN_SEGMENTS
    )
    geo.rotateX(-Math.PI / 2)
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      pos.setY(i, terrainHeightM(x, z))
      // Slow albedo drift, so the tiled grain underneath never reads as a tile.
      const tone = 1 + fbm(x / 110, z / 110) * 0.5
      colors[i * 3] = tone
      colors[i * 3 + 1] = tone
      colors[i * 3 + 2] = tone
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return geo
  }, [])
}

// One grey tile cut from the atlas's shared noise, repeated every `tileM`.
function greyTile(
  noise: Uint8Array,
  tileM: number,
  value: (r: number, g: number, b: number) => number
): THREE.DataTexture {
  const size = SURFACE_NOISE_SIZE
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const v = value(
      noise[i * 4] / 255 - 0.5,
      noise[i * 4 + 1] / 255 - 0.5,
      noise[i * 4 + 2] / 255 - 0.5
    )
    const byte = Math.round(Math.min(1, Math.max(0, v)) * 255)
    data[i * 4] = byte
    data[i * 4 + 1] = byte
    data[i * 4 + 2] = byte
    data[i * 4 + 3] = 255
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(TERRAIN_SIZE_M / tileM, TERRAIN_SIZE_M / tileM)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

// Two tiles at two scales. The tone tile is broad and faint, so its repeat is
// far apart and hard to find. The relief tile is fine grain that only shows up
// close, and averages to flat long before its repeat could be seen.
function useGroundTextures(): { tone: THREE.DataTexture; relief: THREE.DataTexture } {
  return useMemo(() => {
    const noise = buildSurfaceNoise()
    return {
      tone: greyTile(noise, GROUND_TONE_TILE_M, (_r, g, b) => 0.86 + g * 0.22 + b * 0.3),
      relief: greyTile(noise, GROUND_RELIEF_TILE_M, (r, g) => 0.5 + r * 0.6 + g * 0.4),
    }
  }, [])
}

function Terrain() {
  const geometry = useTerrainGeometry()
  const { tone, relief } = useGroundTextures()
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(
    () => () => {
      tone.dispose()
      relief.dispose()
    },
    [tone, relief]
  )
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color={GROUND}
        map={tone}
        bumpMap={relief}
        bumpScale={0.6}
        vertexColors
        roughness={1}
        metalness={0}
      />
    </mesh>
  )
}

function Starfield() {
  const geometry = useMemo(() => {
    const count = 2600
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    let seed = 20261118
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0xffffffff
    }
    for (let i = 0; i < count; i++) {
      // Uniform over the sphere. The half below the horizon is hidden by the
      // ground and costs nothing.
      const y = rand() * 2 - 1
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(1 - y * y)
      positions[i * 3] = Math.cos(a) * r * 20000
      positions[i * 3 + 1] = y * 20000
      positions[i * 3 + 2] = Math.sin(a) * r * 20000
      const brightness = 0.25 + Math.pow(rand(), 3) * 0.75
      colors[i * 3] = brightness
      colors[i * 3 + 1] = brightness
      colors[i * 3 + 2] = brightness * (0.92 + rand() * 0.16)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={1.6}
        sizeAttenuation={false}
        vertexColors
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  )
}

function Earth() {
  const map = useTexture('/moonbase/earth/earth-day.jpg')
  map.colorSpace = THREE.SRGBColorSpace
  return (
    <mesh position={EARTH_DIR.clone().multiplyScalar(18000)} rotation={[0.3, 2.2, 0.2]}>
      <sphereGeometry args={[330, 48, 32]} />
      <meshStandardMaterial map={map} roughness={1} metalness={0} />
    </mesh>
  )
}

// The plot's edge, always drawn, and its cell lines, drawn while building.
function PlotLines({ showGrid }: { showGrid: boolean }) {
  const half = PLOT_M / 2
  const grid = useMemo(() => {
    const points: THREE.Vector3[] = []
    for (let i = 1; i < GRID_CELLS; i++) {
      const at = -half + i * CELL_M
      points.push(new THREE.Vector3(at, 0, -half), new THREE.Vector3(at, 0, half))
      points.push(new THREE.Vector3(-half, 0, at), new THREE.Vector3(half, 0, at))
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [half])
  useEffect(() => () => grid.dispose(), [grid])
  return (
    <group position={[0, 0.05, 0]}>
      {/* A line is one pixel at any distance and vanishes against the regolith
          from the opening view, so the edge is a painted strip with real width. */}
      {[0, 1, 2, 3].map((side) => (
        <mesh
          key={side}
          rotation={[-Math.PI / 2, 0, (side * Math.PI) / 2]}
          position={[
            side === 1 ? -half : side === 3 ? half : 0,
            0,
            side === 0 ? half : side === 2 ? -half : 0,
          ]}
        >
          <planeGeometry args={[PLOT_M + BORDER_W, BORDER_W]} />
          <meshBasicMaterial
            color={ACCENT}
            transparent
            opacity={showGrid ? 0.75 : 0.45}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      <lineSegments geometry={grid} visible={showGrid}>
        <lineBasicMaterial
          color={ACCENT}
          transparent
          opacity={0.32}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  )
}

const BORDER_W = 0.7
const BED_H = 0.1
const BERM_H = 0.26
const BERM_W = 0.5
const MAX_ROAD_TILES = GRID_CELLS * GRID_CELLS
const IDENTITY = new THREE.Quaternion()
const QUARTER_TURN = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  Math.PI / 2
)
const UNIT = new THREE.Vector3(1, 1, 1)

// Graded regolith: a compacted bed one cell wide, with a low berm of pushed
// spoil along every side that does not join another tile. The joins are what
// make a run of tiles read as one road.
function Roads({ roads }: { roads: readonly string[] }) {
  const bedRef = useRef<THREE.InstancedMesh>(null)
  const bermRef = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const bed = bedRef.current
    const berm = bermRef.current
    if (!bed || !berm) return
    const tiles = new Set(roads)
    const matrix = new THREE.Matrix4()
    const at = new THREE.Vector3()
    const edge = CELL_M / 2 - BERM_W / 2
    let beds = 0
    let berms = 0
    for (const key of roads) {
      const cell = parseCellKey(key)
      if (!cell) continue
      const c = cellCenterM(cell)
      bed.setMatrixAt(beds++, matrix.compose(at.set(c.x, BED_H / 2, c.z), IDENTITY, UNIT))
      const links = roadLinks(tiles, cell)
      if (!(links & ROAD_N)) {
        berm.setMatrixAt(
          berms++,
          matrix.compose(at.set(c.x, BERM_H / 2, c.z - edge), IDENTITY, UNIT)
        )
      }
      if (!(links & ROAD_S)) {
        berm.setMatrixAt(
          berms++,
          matrix.compose(at.set(c.x, BERM_H / 2, c.z + edge), IDENTITY, UNIT)
        )
      }
      if (!(links & ROAD_E)) {
        berm.setMatrixAt(
          berms++,
          matrix.compose(at.set(c.x + edge, BERM_H / 2, c.z), QUARTER_TURN, UNIT)
        )
      }
      if (!(links & ROAD_W)) {
        berm.setMatrixAt(
          berms++,
          matrix.compose(at.set(c.x - edge, BERM_H / 2, c.z), QUARTER_TURN, UNIT)
        )
      }
    }
    bed.count = beds
    berm.count = berms
    bed.instanceMatrix.needsUpdate = true
    berm.instanceMatrix.needsUpdate = true
  }, [roads])

  return (
    <>
      <instancedMesh
        ref={bedRef}
        args={[undefined, undefined, MAX_ROAD_TILES]}
        frustumCulled={false}
        receiveShadow
      >
        <boxGeometry args={[CELL_M, BED_H, CELL_M]} />
        <meshStandardMaterial color={ROAD} roughness={0.92} metalness={0} />
      </instancedMesh>
      <instancedMesh
        ref={bermRef}
        args={[undefined, undefined, MAX_ROAD_TILES * 4]}
        frustumCulled={false}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[CELL_M, BERM_H, BERM_W]} />
        <meshStandardMaterial color={BERM} roughness={1} metalness={0} />
      </instancedMesh>
    </>
  )
}

// Cast shadows are what seat hardware on the ground, and three stores the flag
// per mesh, so it is pushed down the subtree. No dependency list: the models
// are static trees, and the parent is memoised, so this runs on mount and when
// the item itself changes.
function Hardware({ scale = 1, children }: { scale?: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useEffect(() => {
    ref.current?.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      const unlit = material?.type === 'MeshBasicMaterial'
      // A shadow map has no notion of opacity, so glazing would black out the
      // ground under it exactly like a solid wall.
      const glazing = !!material?.transparent && material.opacity < 0.9
      mesh.castShadow = !unlit && !glazing
      mesh.receiveShadow = !unlit
    })
  })
  return (
    <group ref={ref} scale={scale}>
      {children}
    </group>
  )
}

function Rock({ acrossM, seed }: { acrossM: number; seed: number }) {
  const geometry = rockGeometry(Math.floor(hash2(seed, 3) * 6))
  return (
    <mesh
      geometry={geometry}
      scale={[acrossM, acrossM * (0.75 + hash2(seed, 5) * 0.4), acrossM]}
      rotation={[0, hash2(seed, 7) * Math.PI * 2, 0]}
    >
      <meshStandardMaterial color="#b3ada5" vertexColors roughness={1} metalness={0} />
    </mesh>
  )
}

function DecorModel({ id, seed }: { id: string; seed: number }) {
  switch (id) {
    case 'street-light':
      return <StreetLight />
    case 'solar-array':
      return (
        // Faces the sun before the visitor's own turn is applied.
        <group rotation={[0, SUN_YAW, 0]}>
          <VerticalSolarArray elevRad={SUN_ELEV_RAD} seed={seed} />
        </group>
      )
    case 'gas-station':
      return <RoverGasStation accent={ACCENT} />
    case 'depot-yard':
      return <RoverDepotYard accent={ACCENT} />
    case 'excavator':
      return <Excavator seed={seed} digging />
    case 'crates':
      return <CrateCluster seed={seed} count={3 + (seed % 2)} spread={1.7} />
    case 'cable-reel':
      return <CableReel />
    case 'spare-parts':
      return <SparePartsPallet seed={seed} />
    case 'bricks':
      return <BrickPallet seed={seed} />
    case 'boulder':
      return <Rock acrossM={1.6 + hash2(seed, 11) * 0.8} seed={seed} />
    case 'boulder-large':
      return <Rock acrossM={3.6 + hash2(seed, 11) * 1.4} seed={seed} />
    default:
      return null
  }
}

const UNIT_SQUARE = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(-0.5, 0, -0.5),
  new THREE.Vector3(0.5, 0, -0.5),
  new THREE.Vector3(0.5, 0, 0.5),
  new THREE.Vector3(-0.5, 0, 0.5),
])

// A flat marker over a footprint: a tinted fill and its outline.
function FootprintMark({
  span,
  color,
  fill = 0.22,
  lift = 0.16,
}: {
  span: number
  color: string
  fill?: number
  lift?: number
}) {
  const edge = span * CELL_M - 0.3
  return (
    <group position={[0, lift, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <planeGeometry args={[edge, edge]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={fill}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <lineLoop geometry={UNIT_SQUARE} scale={[edge, 1, edge]} renderOrder={4}>
        <lineBasicMaterial color={color} transparent opacity={0.95} toneMapped={false} />
      </lineLoop>
    </group>
  )
}

function ItemBody({ item, info }: { item: PlacedItem; info: AssetInfo | undefined }) {
  if (item.kind === 'asset') {
    if (!info) return null
    return (
      <Hardware scale={info.scale}>
        <ProceduralModel project={info.modelProject} accent={info.accent} />
      </Hardware>
    )
  }
  return (
    <Hardware>
      <DecorModel id={item.ref} seed={item.x * 131 + item.z * 17 + 1} />
    </Hardware>
  )
}

const PlacedItemView = memo(function PlacedItemView({
  item,
  info,
  heldBack,
  selected,
  clickable,
  onItemClick,
}: {
  item: PlacedItem
  info: AssetInfo | undefined
  heldBack: boolean
  selected: boolean
  clickable: boolean
  onItemClick: (id: string) => void
}) {
  const centre = footprintCenterM(item.x, item.z, item.span)
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    // While placing or paving, a click on hardware belongs to the ground
    // under it: let it through.
    if (!clickable || e.delta > CLICK_DRAG_TOLERANCE_PX) return
    e.stopPropagation()
    onItemClick(item.id)
  }
  return (
    <group position={[centre.x, 0, centre.z]} onClick={handleClick}>
      {heldBack ? (
        // Just the lot. A name over every one of them buried the plot under
        // labels; selecting the lot names it in the HUD instead.
        <FootprintMark span={item.span} color={LOCKED} fill={0.1} lift={0.1} />
      ) : (
        <group rotation={[0, (item.rot * Math.PI) / 2, 0]}>
          <ItemBody item={item} info={info} />
        </group>
      )}
      {/* The lot is marked and the HUD names it. A name floating over the
          model as well only covered the thing being looked at. */}
      {selected && <FootprintMark span={item.span} color={ACCENT} fill={0.08} />}
    </group>
  )
})

// What the pointer is about to do, drawn on the ground before it is done.
function Preview({
  layout,
  tool,
  pending,
  roadStart,
  hover,
  assetInfo,
}: {
  layout: MoonbaseLayout
  tool: BuilderTool
  pending: PendingPlacement | null
  roadStart: Cell | null
  hover: Cell | null
  assetInfo: (projectId: string) => AssetInfo | undefined
}) {
  if (tool === 'place' && pending && hover) {
    const anchor = footprintAnchor(hover, pending.span)
    const free = canPlace(layout, { ...anchor, span: pending.span }, pending.moveId)
    const centre = footprintCenterM(anchor.x, anchor.z, pending.span)
    const ghost: PlacedItem = {
      id: 'preview',
      kind: pending.kind,
      ref: pending.ref,
      x: anchor.x,
      z: anchor.z,
      span: pending.span,
      rot: pending.rot,
    }
    return (
      <group position={[centre.x, 0, centre.z]}>
        <FootprintMark span={pending.span} color={free ? OK : BLOCKED} />
        <group rotation={[0, (pending.rot * Math.PI) / 2, 0]}>
          <ItemBody
            item={ghost}
            info={pending.kind === 'asset' ? assetInfo(pending.ref) : undefined}
          />
        </group>
      </group>
    )
  }

  if (tool === 'road') {
    const cells = roadStart ? roadPath(roadStart, hover ?? roadStart) : hover ? [hover] : []
    return (
      <>
        {cells.map((cell) => {
          const c = cellCenterM(cell)
          return (
            <group key={cellKey(cell.x, cell.z)} position={[c.x, 0, c.z]}>
              <FootprintMark span={1} color={canPave(layout, cell) ? ACCENT : BLOCKED} />
            </group>
          )
        })}
      </>
    )
  }

  if (tool === 'erase' && hover) {
    const item = itemAt(layout, hover)
    if (item) {
      const c = footprintCenterM(item.x, item.z, item.span)
      return (
        <group position={[c.x, 0, c.z]}>
          <FootprintMark span={item.span} color={BLOCKED} />
        </group>
      )
    }
    if (hasRoad(layout, hover)) {
      const c = cellCenterM(hover)
      return (
        <group position={[c.x, 0, c.z]}>
          <FootprintMark span={1} color={BLOCKED} />
        </group>
      )
    }
  }
  return null
}

const PAN_LIMIT_M = PLOT_M * 0.75

// Holds the pivot near the plot, and flies it to an item on request.
function CameraRig({
  focus,
  onFlyingChange,
}: {
  focus: CameraFocus | null
  onFlyingChange: (flying: boolean) => void
}) {
  const controls = useThree((state) => state.controls) as unknown as {
    target: THREE.Vector3
    update: () => void
  } | null
  const camera = useThree((state) => state.camera)
  const flight = useRef<{
    t: number
    fromTarget: THREE.Vector3
    toTarget: THREE.Vector3
    fromEye: THREE.Vector3
    toEye: THREE.Vector3
  } | null>(null)

  const nonce = focus?.nonce
  useEffect(() => {
    if (!focus || !controls) return
    const fromTarget = controls.target.clone()
    const toTarget = new THREE.Vector3(focus.xM, 0, focus.zM)
    const offset = camera.position.clone().sub(fromTarget).setLength(focus.distM)
    flight.current = {
      t: 0,
      fromTarget,
      toTarget,
      fromEye: camera.position.clone(),
      toEye: toTarget.clone().add(offset),
    }
    onFlyingChange(true)
    // One flight per request. `focus` is read at the moment the nonce changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, controls])

  useFrame((_, delta) => {
    if (!controls) return
    const f = flight.current
    if (f) {
      f.t = Math.min(1, f.t + delta / 0.85)
      const k = f.t * f.t * (3 - 2 * f.t)
      controls.target.lerpVectors(f.fromTarget, f.toTarget, k)
      camera.position.lerpVectors(f.fromEye, f.toEye, k)
      controls.update()
      if (f.t >= 1) {
        flight.current = null
        onFlyingChange(false)
      }
      return
    }
    const target = controls.target
    const x = THREE.MathUtils.clamp(target.x, -PAN_LIMIT_M, PAN_LIMIT_M)
    const z = THREE.MathUtils.clamp(target.z, -PAN_LIMIT_M, PAN_LIMIT_M)
    if (x !== target.x || z !== target.z || target.y !== 0) {
      camera.position.x += x - target.x
      camera.position.z += z - target.z
      camera.position.y -= target.y
      target.set(x, 0, z)
    }
  })
  return null
}

// The drawing buffer is cleared once a frame has been shown, so a copy has to
// be taken in the same task as a render. This draws one and copies it out.
function CaptureHandle({ captureRef }: { captureRef: MutableRefObject<FrameCapture | null> }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  useEffect(() => {
    captureRef.current = () => {
      try {
        gl.render(scene, camera)
        const source = gl.domElement
        if (!source.width || !source.height) return null
        const copy = document.createElement('canvas')
        copy.width = source.width
        copy.height = source.height
        const g = copy.getContext('2d')
        if (!g) return null
        g.drawImage(source, 0, 0)
        return copy
      } catch {
        return null
      }
    }
    return () => {
      captureRef.current = null
    }
  }, [gl, scene, camera, captureRef])
  return null
}

function SceneContents({
  layout,
  tool,
  pending,
  roadStart,
  selectedId,
  heldBackIds,
  assetInfo,
  focus,
  onCellClick,
  onItemClick,
  onBackgroundClick,
  captureRef,
  onFlyingChange,
}: BuilderSceneProps & { onFlyingChange: (flying: boolean) => void }) {
  // Kept in the scene, not the page: the pointer crosses a cell boundary many
  // times a second and the HUD has no use for any of them.
  const [hover, setHover] = useState<Cell | null>(null)
  const handleGroundMove = (e: ThreeEvent<PointerEvent>) => {
    const cell = cellAtM(e.point.x, e.point.z)
    setHover((prev) =>
      prev?.x === cell?.x && prev?.z === cell?.z ? prev : cell
    )
  }
  const handleGroundClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > CLICK_DRAG_TOLERANCE_PX) return
    const cell = cellAtM(e.point.x, e.point.z)
    if (cell) onCellClick(cell)
    else onBackgroundClick()
  }

  const building = tool !== 'select'
  const itemsClickable = tool === 'select' || tool === 'erase'
  // An item being moved rides the pointer, so it is not also drawn where it was.
  const liftedId = tool === 'place' && hover ? pending?.moveId : undefined
  const shadowHalf = PLOT_M / 2 + 40

  return (
    <>
      <color attach="background" args={['#000000']} />
      <directionalLight
        position={SUN_DIR.clone().multiplyScalar(600)}
        intensity={5.2}
        color="#fff8ee"
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.06}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-shadowHalf, shadowHalf, shadowHalf, -shadowHalf, 10, 1400]}
        />
      </directionalLight>
      {/* The only fill on the Moon is the ground itself: bright below, black above. */}
      <hemisphereLight args={['#10131c', '#8d877f', 0.55]} />

      <Starfield />
      <Suspense fallback={null}>
        <Earth />
      </Suspense>
      <Terrain />
      <PlotLines showGrid={building} />
      <Roads roads={layout.roads} />

      {layout.items.map((item) =>
        item.id === liftedId ? null : (
          <PlacedItemView
            key={item.id}
            item={item}
            info={item.kind === 'asset' ? assetInfo(item.ref) : undefined}
            heldBack={heldBackIds.has(item.id)}
            selected={item.id === selectedId}
            clickable={itemsClickable}
            onItemClick={onItemClick}
          />
        )
      )}

      <Preview
        layout={layout}
        tool={tool}
        pending={pending}
        roadStart={roadStart}
        hover={hover}
        assetInfo={assetInfo}
      />

      {/* Takes every pointer event meant for the ground. Flat and two
          triangles, so a pointer move costs one ray test rather than the whole
          terrain mesh. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handleGroundMove}
        onPointerOut={() => setHover(null)}
        onClick={handleGroundClick}
      >
        <planeGeometry args={[TERRAIN_SIZE_M, TERRAIN_SIZE_M]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>

      <CameraRig focus={focus} onFlyingChange={onFlyingChange} />
      {captureRef && <CaptureHandle captureRef={captureRef} />}
      {/* Map controls: drag slides the ground, right-drag turns the view, the
          wheel zooms. Every build action is a click, so dragging is always the
          camera's and the two never fight over the left button. */}
      <MapControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        zoomSpeed={1.1}
        minDistance={10}
        maxDistance={560}
        maxPolarAngle={Math.PI * 0.47}
      />
    </>
  )
}

export default function BuilderScene(props: BuilderSceneProps) {
  const [dragging, setDragging] = useState(false)
  const [flying, setFlying] = useState(false)
  const wheelTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const release = () => setDragging(false)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
    }
  }, [])

  const handleWheel = () => {
    setDragging(true)
    if (wheelTimer.current) clearTimeout(wheelTimer.current)
    wheelTimer.current = setTimeout(() => setDragging(false), 600)
  }

  // Same budget as Moon Base Zero: full rate under the hand, half at rest.
  const budget = useFrameBudget(dragging || flying)

  return (
    <Canvas
      frameloop="never"
      onCreated={budget.onCreated}
      dpr={budget.dpr}
      shadows="soft"
      camera={{ position: [165, 84, 214], fov: 46, near: 0.5, far: 60000 }}
      gl={{
        antialias: true,
        toneMapping: THREE.AgXToneMapping,
        toneMappingExposure: 1,
      }}
      onPointerDown={() => setDragging(true)}
      onWheel={handleWheel}
    >
      <SceneContents {...props} onFlyingChange={setFlying} />
    </Canvas>
  )
}
