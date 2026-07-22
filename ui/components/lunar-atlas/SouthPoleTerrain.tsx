// Photorealistic lunar south-pole terrain for the Lunar Atlas.
//
// Rendered in the cartographic style of LROC quickmaps: ALL terrain shading
// is baked into the albedo as hillshade (the DEM's full 120 m/px relief as
// per-pixel light), and the terrain materials are UNLIT. Dynamic-lighting
// the coarse displaced mesh (~720 m per vertex) on top of the bake made
// every away-facing slope collapse into a flat ambient-gray "pond" with a
// hard terminator edge — unlit terrain renders exactly the crisp baked map,
// from every camera angle. Only the 3D models and markers are dynamically
// lit (their sun matches the baked hillshade azimuth).
//
// A single south-pole cap over empty space (~369 km square, 512² grid): real
// 16-bit heights, hillshaded albedo, tiled detail grain for close-ups. No
// surrounding whole-Moon context — this is the pole region and nothing else.
//
// Geometry positions come from the same decoded height field the CPU sampler
// (useTerrainSampler) reads, so everything seated on the terrain agrees with
// the rendered ground by construction.

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  INNER_GRID,
  buildCapGeometry,
  type PolarHeightField,
} from '@/lib/lunar-atlas/southpole'
import { SP_ALBEDO_MAP } from '@/lib/lunar-atlas/textures'
import { loadInnerField } from './useTerrainSampler'

// A pointer that travels farther than this between down and up is a drag
// (camera tumble), not a click.
const CLICK_DRAG_TOLERANCE_PX = 8

function toBufferGeometry(
  field: PolarHeightField,
  grid: number,
  depress?: Parameters<typeof buildCapGeometry>[2]
): THREE.BufferGeometry {
  const cap = buildCapGeometry(field, grid, depress)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(cap.positions, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(cap.uvs, 2))
  geo.setIndex(new THREE.BufferAttribute(cap.indices, 1))
  geo.computeVertexNormals()
  return geo
}

function useTexture(url: string, srgb: boolean): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let cancelled = false
    new THREE.TextureLoader().load(url, (t) => {
      if (cancelled) {
        t.dispose()
        return
      }
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
      t.anisotropy = 16
      setTex(t)
    })
    return () => {
      cancelled = true
    }
  }, [url, srgb])
  useEffect(() => () => tex?.dispose(), [tex])
  return tex
}

// Tiling grayscale noise for close-range regolith grain. The DEM bottoms out
// at 120 m/px, so a drill-in view magnifies the albedo ~4x — this multiplies
// in sub-texel variation so the ground reads as soil, not as a blurry photo.
function makeDetailNoise(size = 256): THREE.DataTexture {
  const data = new Uint8Array(size * size)
  // Deterministic LCG so the grain doesn't change between mounts.
  let s = 12345
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
  for (let i = 0; i < data.length; i++) {
    data[i] = 128 + (rand() + rand() - 1) * 90
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

export default function SouthPoleTerrain({
  onReady,
  onSurfaceClick,
}: {
  onReady?: () => void
  onSurfaceClick?: () => void
}) {
  const [innerGeo, setInnerGeo] = useState<THREE.BufferGeometry | null>(null)

  const albedo = useTexture(SP_ALBEDO_MAP, true)
  const detail = useMemo(() => makeDetailNoise(), [])
  useEffect(() => () => detail.dispose(), [detail])

  useEffect(() => {
    let cancelled = false
    loadInnerField().then((field) => {
      if (cancelled) return
      setInnerGeo(toBufferGeometry(field, INNER_GRID))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () => () => {
      innerGeo?.dispose()
    },
    [innerGeo]
  )

  const notified = useRef(false)
  useEffect(() => {
    if (innerGeo && albedo && !notified.current) {
      notified.current = true
      onReady?.()
    }
  }, [innerGeo, albedo, onReady])

  // Multiplies two octaves of tiled grain into the cap's diffuse so magnified
  // close-ups keep texture. Mean is ~1.0, so the overall tone is preserved.
  const onBeforeCompile = useMemo(
    () => (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.detailMap = { value: detail }
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          '#include <map_pars_fragment>\nuniform sampler2D detailMap;'
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          {
            float dn = texture2D(detailMap, vMapUv * 96.0).r * 0.6
                     + texture2D(detailMap, vMapUv * 13.0).r * 0.4;
            diffuseColor.rgb *= 0.86 + 0.28 * dn;
          }`
        )
    },
    [detail]
  )

  const handleClick = (e: any) => {
    if (e.delta <= CLICK_DRAG_TOLERANCE_PX) onSurfaceClick?.()
  }

  if (!innerGeo || !albedo) return null

  return (
    <group>
      {/* Unlit: the albedo IS the final shaded image (see header comment). */}
      <mesh geometry={innerGeo} onClick={handleClick}>
        <meshBasicMaterial
          map={albedo}
          onBeforeCompile={onBeforeCompile}
          // onBeforeCompile changes don't retrigger compilation on their own.
          customProgramCacheKey={() => 'sp-inner-detail'}
        />
      </mesh>
    </group>
  )
}
