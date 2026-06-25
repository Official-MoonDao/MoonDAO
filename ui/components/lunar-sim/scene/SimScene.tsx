// react-three-fiber scene for the lunar south-pole simulation.
// Reads engine snapshots (current + next + fractional subTick) and renders the
// terrain, resource deposits, and assets with smooth interpolation. Rendering
// is fully decoupled from the engine: this component never mutates sim state.

import { Canvas } from '@react-three/fiber'
import { Line, OrbitControls, Stars } from '@react-three/drei'
import { useMemo } from 'react'
import type {
  AssetState,
  Scenario,
  WorldSnapshot,
} from '@/lib/lunar-sim/engine/types'
import { createTerrainField, terrainHeight } from '@/lib/lunar-sim/terrain'
import AssetModel from './AssetModel'
import Terrain from './Terrain'

type SimSceneProps = {
  scenario: Scenario
  currentSnapshot?: WorldSnapshot
  nextSnapshot?: WorldSnapshot
  subTick: number
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// ENU (east, north) -> three world (east, up, -north).
function worldPos(
  field: ReturnType<typeof createTerrainField>,
  x: number,
  y: number
): [number, number, number] {
  return [x, terrainHeight(field, x, y), -y]
}

export default function SimScene({
  scenario,
  currentSnapshot,
  nextSnapshot,
  subTick,
}: SimSceneProps) {
  const radius = scenario.aoi.radiusM
  const terrainSize = radius * 2.6
  const field = useMemo(
    () => createTerrainField(scenario.seed, terrainSize),
    [scenario.seed, terrainSize]
  )

  const factory = scenario.assets.find(
    (a) => a.behaviorModule === 'isru_factory_v1'
  )

  const interpolated = useMemo(() => {
    const out: Record<string, { x: number; y: number; state: AssetState }> = {}
    if (!currentSnapshot) return out
    for (const id of Object.keys(currentSnapshot.assets)) {
      const cur = currentSnapshot.assets[id]
      const nxt = nextSnapshot?.assets[id] ?? cur
      out[id] = {
        x: lerp(cur.pos.x, nxt.pos.x, subTick),
        y: lerp(cur.pos.y, nxt.pos.y, subTick),
        state: cur,
      }
    }
    return out
  }, [currentSnapshot, nextSnapshot, subTick])

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{
        position: [radius * 0.8, radius * 0.7, radius * 0.9],
        fov: 50,
        near: 1,
        far: radius * 20,
      }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#05060a']} />
      <fog attach="fog" args={['#05060a', radius * 3, radius * 8]} />

      {/* Grazing south-pole sun: low angle, warm-white, long shadows. */}
      <directionalLight
        position={[-radius * 2.2, radius * 0.28, -radius * 1.1]}
        intensity={2.1}
        color="#fff4e0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-radius * 1.6}
        shadow-camera-right={radius * 1.6}
        shadow-camera-top={radius * 1.6}
        shadow-camera-bottom={-radius * 1.6}
        shadow-camera-near={1}
        shadow-camera-far={radius * 8}
      />
      <hemisphereLight args={['#1b2436', '#000000', 0.25]} />
      <ambientLight intensity={0.08} />

      <Stars radius={radius * 12} depth={radius * 4} count={4000} factor={20} fade />

      <Terrain field={field} size={terrainSize} />

      {/* Resource deposits */}
      {scenario.resources.map((r) => {
        const [x, y, z] = worldPos(field, r.pos.x, r.pos.y)
        return (
          <group key={r.id} position={[x, y + 0.5, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[60, 32]} />
              <meshStandardMaterial color="#3b2f1a" roughness={1} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]}>
              <ringGeometry args={[58, 62, 48]} />
              <meshStandardMaterial
                color="#fbbf24"
                emissive="#f59e0b"
                emissiveIntensity={0.6}
              />
            </mesh>
          </group>
        )
      })}

      {/* Factory comms range ring */}
      {factory && (
        <group position={worldPos(field, factory.pos.x, factory.pos.y)}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]}>
            <ringGeometry
              args={[factory.commsRangeM - 3, factory.commsRangeM, 64]}
            />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0ea5e9"
              emissiveIntensity={0.4}
              transparent
              opacity={0.5}
            />
          </mesh>
        </group>
      )}

      {/* Assets */}
      {scenario.assets.map((asset) => {
        const it = interpolated[asset.id]
        if (!it) return null
        const pos = worldPos(field, it.x, it.y)
        const trading = it.state.phase === 'trading'

        const beam =
          trading && factory
            ? [pos, worldPos(field, factory.pos.x, factory.pos.y)]
            : null

        return (
          <group key={asset.id}>
            <group position={pos}>
              <AssetModel asset={asset} trading={trading} />
            </group>
            {beam && (
              <Line
                points={[
                  [beam[0][0], beam[0][1] + 6, beam[0][2]],
                  [beam[1][0], beam[1][1] + 12, beam[1][2]],
                ]}
                color="#facc15"
                lineWidth={2}
              />
            )}
          </group>
        )
      })}

      <OrbitControls
        makeDefault
        maxPolarAngle={Math.PI / 2.05}
        minDistance={radius * 0.15}
        maxDistance={radius * 6}
        target={[0, 0, 0]}
      />
    </Canvas>
  )
}
