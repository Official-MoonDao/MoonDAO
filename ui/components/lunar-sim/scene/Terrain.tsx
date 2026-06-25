// Procedurally displaced lunar terrain mesh (MVP stand-in for sampled DEM).
// Builds a grid in the XZ plane and displaces Y using the shared terrain field,
// so asset grounding (which uses the same field) always matches the surface.

import { useMemo } from 'react'
import * as THREE from 'three'
import { TerrainField, terrainHeight } from '@/lib/lunar-sim/terrain'

type TerrainProps = {
  field: TerrainField
  size: number
  segments?: number
}

function buildGeometry(
  field: TerrainField,
  size: number,
  segments: number
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  const half = size / 2
  const cols = segments + 1
  const positions = new Float32Array(cols * cols * 3)
  const uvs = new Float32Array(cols * cols * 2)

  for (let j = 0; j < cols; j++) {
    for (let i = 0; i < cols; i++) {
      const idx = j * cols + i
      const worldX = -half + (i / segments) * size
      const worldZ = -half + (j / segments) * size
      // World Z maps to -north so the scene reads east-right / north-back.
      const enuX = worldX
      const enuY = -worldZ
      const y = terrainHeight(field, enuX, enuY)
      positions[idx * 3 + 0] = worldX
      positions[idx * 3 + 1] = y
      positions[idx * 3 + 2] = worldZ
      uvs[idx * 2 + 0] = i / segments
      uvs[idx * 2 + 1] = j / segments
    }
  }

  const indices: number[] = []
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * cols + i
      const b = j * cols + i + 1
      const c = (j + 1) * cols + i
      const d = (j + 1) * cols + i + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

export default function Terrain({ field, size, segments = 160 }: TerrainProps) {
  const geometry = useMemo(
    () => buildGeometry(field, size, segments),
    [field, size, segments]
  )

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color="#9a9a9a"
        roughness={1}
        metalness={0}
        flatShading={false}
      />
    </mesh>
  )
}
