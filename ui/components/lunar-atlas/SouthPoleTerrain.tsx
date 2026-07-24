// Photorealistic Connecting Ridge terrain for Moon Base Zero.
//
// A single 16x16 km patch of the Shackleton-de Gerlache connecting ridge
// (PGDA Site01 LOLA DEM, 5 m/px) — no whole Moon, no polar cap. Rendered in
// the cartographic style of LROC quickmaps: ALL terrain shading is baked
// into the albedo as hillshade (the DEM's full 5 m/px relief as per-pixel
// light), and the terrain material is UNLIT. Dynamic-lighting the coarser
// displaced mesh on top of the bake made every away-facing slope collapse
// into a flat ambient-gray "pond" — unlit terrain renders exactly the crisp
// baked map, from every camera angle. Only the 3D models and markers are
// dynamically lit (their sun matches the baked hillshade azimuth).
//
// Geometry positions come from the same decoded height field the CPU sampler
// (useTerrainSampler) reads, so everything seated on the terrain agrees with
// the rendered ground by construction.

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  CAP_GRID,
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
  grid: number
): THREE.BufferGeometry {
  const cap = buildCapGeometry(field, grid)
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

// Tiling regolith detail for close-range terrain. The albedo bottoms out at
// 2.5 m/px, so the foreground magnifies it into fuzz — this tile multiplies
// in the missing structure. Plain white noise just reads as MORE fuzz;
// instead the tile is a hillshaded field of small crater bowls + grain, so
// magnified ground has the same cratered character as the baked albedo. It
// is lit from the same azimuth as the baked sun so shading directions agree.
function makeDetailTile(size = 512): THREE.DataTexture {
  // Deterministic LCG so the ground doesn't change between mounts.
  let s = 12345
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }

  // Height field: soft noise + a power-law population of crater bowls with
  // raised rims, painted with wrap-around so the tile is seamless.
  const h = new Float32Array(size * size)
  for (let i = 0; i < h.length; i++) h[i] = (rand() + rand() - 1) * 0.6
  const nCraters = 900
  for (let c = 0; c < nCraters; c++) {
    const cx = rand() * size
    const cy = rand() * size
    const R = 2 + Math.pow(rand(), 2.2) * 22 // px — many small, few large
    const depth = R * (0.12 + rand() * 0.3)
    const pad = Math.ceil(R * 1.4)
    for (let y = Math.floor(cy) - pad; y <= Math.floor(cy) + pad; y++) {
      for (let x = Math.floor(cx) - pad; x <= Math.floor(cx) + pad; x++) {
        const dx = x - cx
        const dy = y - cy
        const r = Math.sqrt(dx * dx + dy * dy) / R
        if (r >= 1.4) continue
        const bowl = r < 1 ? -(1 - r * r) : 0.3 * ((1.4 - r) / 0.4)
        const xi = ((x % size) + size) % size
        const yi = ((y % size) + size) % size
        h[yi * size + xi] += bowl * depth
      }
    }
  }

  // Hillshade with a wrapping gradient. Light azimuth matches SUN_AZ_DEG in
  // the bake script (40°); elevation is kept moderate so bowls shade without
  // going black. Flat ground maps to 128 so the multiply blend is neutral.
  const az = (40 * Math.PI) / 180
  const el = (35 * Math.PI) / 180
  const lx = Math.sin(az) * Math.cos(el)
  const ly = Math.cos(az) * Math.cos(el)
  const lz = Math.sin(el)
  const data = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) {
    const yp = (y + 1) % size
    const ym = (y - 1 + size) % size
    for (let x = 0; x < size; x++) {
      const xp = (x + 1) % size
      const xm = (x - 1 + size) % size
      const gx = (h[y * size + xp] - h[y * size + xm]) * 0.5
      // Rows run top-down while the map frame's +y runs up — flip so the
      // tile's lit sides match the baked albedo's.
      const gy = (h[ym * size + x] - h[yp * size + x]) * 0.5
      const inv = 1 / Math.sqrt(gx * gx + gy * gy + 1)
      const shade = Math.max((-gx * lx + gy * ly + lz) * inv, 0)
      // Flat ground (shade = lz) -> 0.5; softened with a mild gamma.
      const rel = Math.pow(shade / lz, 0.8) * 0.5
      data[y * size + x] = Math.max(0, Math.min(255, Math.round(rel * 255)))
    }
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
  const detail = useMemo(() => makeDetailTile(), [])
  useEffect(() => () => detail.dispose(), [detail])

  useEffect(() => {
    let cancelled = false
    loadInnerField().then((field) => {
      if (cancelled) return
      setInnerGeo(toBufferGeometry(field, CAP_GRID))
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

  // Multiplies octaves of the tiled craterlet shading into the cap's diffuse
  // so magnified close-ups keep structure. Mean is ~1.0 (flat tile = 0.5,
  // blend is 0.76 + 0.48·dn), so the overall tone is preserved.
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
            // The UV square spans 16 km. Tile repeats: x60 = 267 m tiles
            // (craterlets ~1-12 m, the near-field structure the 2.5 m/px
            // albedo can't carry), x250 = 64 m (0.3-3 m craterlets), x800 =
            // 20 m grain, x6400 = 2.5 m soil sparkle for ground-level views.
            float dn = texture2D(detailMap, vMapUv * 60.0).r * 0.3
                     + texture2D(detailMap, vMapUv * 250.0).r * 0.3
                     + texture2D(detailMap, vMapUv * 800.0).r * 0.2
                     + texture2D(detailMap, vMapUv * 6400.0).r * 0.2;
            diffuseColor.rgb *= 0.76 + 0.48 * dn;
            // Radial fade to black: dissolve the square patch's rim into the
            // dark of space so the terrain reads as an expansive field
            // receding into shadow, not a hard-edged floating chunk. rr is
            // 0 at the ridge, 1 at the edge midpoint, ~1.41 at the corners —
            // a long, soft gradient turns the slab into a fading disc.
            float rr = length(vMapUv - 0.5) * 2.0;
            diffuseColor.rgb *= 1.0 - smoothstep(0.82, 1.34, rr);
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
          customProgramCacheKey={() => 'sp-inner-detail-v2'}
        />
      </mesh>
    </group>
  )
}
