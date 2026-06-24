// Renders a single asset in the scene. MVP uses primitive geometry keyed by
// behavior/class; the model-upload milestone extends this to load uploaded
// GLB/OBJ/STL via the loader, falling back to these primitives.

import type { AssetPlacement } from '@/lib/lunar-sim/engine/types'

type AssetModelProps = {
  asset: AssetPlacement
  trading?: boolean
}

const COLORS: Record<string, string> = {
  worker_rover_v1: '#34d399',
  lurker_rover_v1: '#f87171',
  isru_factory_v1: '#94a3b8',
}

function Rover({ color, trading }: { color: string; trading?: boolean }) {
  return (
    <group>
      {/* body */}
      <mesh position={[0, 4, 0]} castShadow>
        <boxGeometry args={[12, 4, 8]} />
        <meshStandardMaterial
          color={color}
          roughness={0.6}
          metalness={0.3}
          emissive={trading ? color : '#000000'}
          emissiveIntensity={trading ? 0.6 : 0}
        />
      </mesh>
      {/* mast / antenna */}
      <mesh position={[3, 9, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 6, 8]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* wheels */}
      {[
        [-4, 1.6, 4],
        [4, 1.6, 4],
        [-4, 1.6, -4],
        [4, 1.6, -4],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[1.6, 1.6, 1.4, 12]} />
          <meshStandardMaterial color="#1f2937" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function Factory({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 6, 0]} castShadow>
        <boxGeometry args={[30, 12, 22]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.2} />
      </mesh>
      <mesh position={[10, 20, 0]} castShadow>
        <cylinderGeometry args={[6, 6, 28, 16]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[-10, 16, 6]} castShadow>
        <cylinderGeometry args={[3, 3, 20, 12]} />
        <meshStandardMaterial color="#64748b" roughness={0.7} />
      </mesh>
    </group>
  )
}

export default function AssetModel({ asset, trading }: AssetModelProps) {
  const color = COLORS[asset.behaviorModule] || '#cbd5e1'
  if (asset.behaviorModule === 'isru_factory_v1') {
    return <Factory color={color} />
  }
  return <Rover color={color} trading={trading} />
}
