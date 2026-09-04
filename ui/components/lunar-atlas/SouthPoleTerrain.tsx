// Physically lit Connecting Ridge terrain for Moon Base Zero.
//
// A single 16x16 km patch of the Shackleton-de Gerlache connecting ridge
// (PGDA Site01 LOLA DEM, 5 m/px). The ground is shaded by evaluating the
// regolith BRDF per pixel (see lib/lunar-atlas/regolith.ts) against the real
// sun, rather than by displaying a hillshade that was baked at one fixed sun.
//
// WHY THIS IS NOT THE BAKED-HILLSHADE SCENE ANY MORE
//
// It used to be, and the argument for the bake was that dynamic-lighting the
// displaced mesh made every away-facing slope collapse into a flat ambient-grey
// "pond". That was a real failure, but it was misdiagnosed as a lighting
// problem when it was a NORMALS problem: the mesh resolves 15.6 m, the relief
// lives at 5-10 m, so the mesh's own normals had almost none of the terrain in
// them and the bake was carrying all of it as painted light.
//
// The fix is to keep the relief but move it off the geometry. Normals come from
// a texture built at the full height-field resolution (buildNormalField in
// southpole.ts), so shading is per pixel and completely independent of how
// coarse the mesh is. That matters more than it sounds: reaching 5 m/px in
// GEOMETRY would cost 20.5 M triangles and ~550 MB of vertex buffers, which no
// browser tab can hold, while the same relief as a normal map is a few MB and
// leaves the mesh free to drop to CAP_GRID/2 on a phone without changing how
// the ground is lit at all.
//
// What this buys beyond honesty: the sun can move (a bake cannot), shadows are
// real rather than painted, and the terrain no longer needs a second
// shadow-catching pass over the same 2.1 M triangles — a lit material receives
// shadows by itself.
//
// Geometry positions still come from the same decoded height field the CPU
// sampler (useTerrainSampler) reads, so everything seated on the terrain agrees
// with the rendered ground by construction.
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { REGOLITH_ALBEDO } from '@/lib/lunar-atlas/regolith'
import {
  CAP_GRID,
  MAP_X_DIR,
  buildCapGeometry,
  buildNormalField,
  type PolarHeightField,
} from '@/lib/lunar-atlas/southpole'
import {
  TERRAIN_FRAGMENT_PATCHES,
  TERRAIN_VERTEX_PATCHES,
  applyShaderPatches,
} from '@/lib/lunar-atlas/terrainShader'
import { SUN_INTENSITY, SUN_LOCAL_ELEV_DEG } from '@/lib/lunar-atlas/sun'
import { loadInnerField } from './useTerrainSampler'

// A pointer that travels farther than this between down and up is a drag
// (camera tumble), not a click.
const CLICK_DRAG_TOLERANCE_PX = 8

// Regolith is very slightly warm and almost perfectly neutral. This is a TINT,
// not a brightness: how dark the ground is comes from the BRDF's single
// scattering albedo, so this must stay near white or the surface gets darkened
// twice. Same values as lunarEnvironment.ts, for the same reason.
const REGOLITH_TINT = '#fff8ed'

// The light left in a lunar shadow, as scene radiance.
//
// There is no atmosphere, so nothing fills a shadow except sunlight that
// already bounced off regolith somewhere nearby. Derived rather than dialled:
// flat sunlit ground radiates about albedo * sun * mu0 / pi, a shadowed point
// sees roughly half a hemisphere of that ground, and what it sees gets absorbed
// by its own albedo on the way back out. It lands near 5% of the lit ground,
// which is the same order as the 8% the old shadow-catcher pass implied — a
// useful check that the two derivations agree.
//
// Phase 2 replaces this constant with real sky visibility from the horizon map;
// until then every shadow is equally deep, which is wrong in the direction of
// being too bright in narrow crevices and too dark under overhangs.
const SHADOW_BOUNCE_RADIANCE =
  ((REGOLITH_ALBEDO * SUN_INTENSITY * Math.sin((SUN_LOCAL_ELEV_DEG * Math.PI) / 180)) / Math.PI) *
  0.5 *
  REGOLITH_ALBEDO

// The geometry plus the world offset its vertices are relative to (see
// buildCapGeometry — the offset must go on the mesh transform, which three
// keeps in float64, or the ground loses centimeters of precision and jitters).
type CapMesh = { geometry: THREE.BufferGeometry; origin: THREE.Vector3 }

function toBufferGeometry(field: PolarHeightField, grid: number): CapMesh {
  const cap = buildCapGeometry(field, grid)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(cap.positions, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(cap.uvs, 2))
  geo.setIndex(new THREE.BufferAttribute(cap.indices, 1))
  // These vertex normals no longer light anything — the shader replaces `normal`
  // with the per-pixel map-frame normal. They are still needed because three's
  // shadow plumbing offsets its occlusion lookup along the interpolated vertex
  // normal (shadowNormalBias), and because a missing `normal` attribute makes
  // that offset NaN.
  geo.computeVertexNormals()
  return { geometry: geo, origin: new THREE.Vector3(...cap.origin) }
}

// The terrain's own normals, at the height field's full resolution, as a
// two-channel float texture. Half float rather than bytes on purpose: 8 bits
// across [-1, 1] quantises the normal to about 0.45°, and once the sun sits at
// its true polar elevation of ~2° a 0.45° error is a tenth of the incidence
// cosine. Linear filtering is safe here in a way it would NOT be on the packed
// height PNG, whose high/low byte split cannot be interpolated at all.
function toNormalTexture(field: PolarHeightField): THREE.DataTexture {
  const { size, data } = buildNormalField(field)
  const half = new Uint16Array(data.length)
  for (let i = 0; i < data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(data[i])
  const tex = new THREE.DataTexture(half, size, size, THREE.RGFormat, THREE.HalfFloatType)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 16
  tex.needsUpdate = true
  return tex
}

// Tiling regolith detail for close-range terrain, as SLOPES rather than as
// shading. The height field bottoms out at 10 m/px, so the foreground magnifies
// it into smooth plaster — this tile supplies the missing sub-10 m structure.
//
// It used to bake its own hillshade, from its own private copy of the sun
// azimuth, which is exactly the kind of thing that cannot survive a sun that
// moves. Storing the gradient instead means the detail is lit by whatever the
// real sun is doing, and it composes with the terrain correctly: slopes of
// superimposed height fields ADD, so the octaves below are summed with the
// base terrain's gradient before the normal is rebuilt once at the end.
function makeDetailSlopeTile(size = 512): THREE.DataTexture {
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

  // Central differences with wrap-around, in units of height per PIXEL. The
  // shader scales each octave into a real slope; see DETAIL_OCTAVES.
  const data = new Uint16Array(size * size * 2)
  for (let y = 0; y < size; y++) {
    const yp = (y + 1) % size
    const ym = (y - 1 + size) % size
    for (let x = 0; x < size; x++) {
      const xp = (x + 1) % size
      const xm = (x - 1 + size) % size
      const gx = (h[y * size + xp] - h[y * size + xm]) * 0.5
      // Image rows run top-down while the map frame's +Y runs up.
      const gy = (h[ym * size + x] - h[yp * size + x]) * 0.5
      const i2 = (y * size + x) * 2
      data[i2] = THREE.DataUtils.toHalfFloat(gx)
      data[i2 + 1] = THREE.DataUtils.toHalfFloat(gy)
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGFormat, THREE.HalfFloatType)
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
  const [innerGeo, setInnerGeo] = useState<CapMesh | null>(null)
  const [normalTex, setNormalTex] = useState<THREE.DataTexture | null>(null)

  const detail = useMemo(() => makeDetailSlopeTile(), [])
  useEffect(() => () => detail.dispose(), [detail])

  useEffect(() => {
    let cancelled = false
    loadInnerField().then((field) => {
      if (cancelled) return
      setInnerGeo(toBufferGeometry(field, CAP_GRID))
      setNormalTex(toNormalTexture(field))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () => () => {
      innerGeo?.geometry.dispose()
    },
    [innerGeo]
  )
  useEffect(() => () => normalTex?.dispose(), [normalTex])

  const notified = useRef(false)
  useEffect(() => {
    if (innerGeo && normalTex && !notified.current) {
      notified.current = true
      onReady?.()
    }
  }, [innerGeo, normalTex, onReady])

  const onBeforeCompile = useMemo(
    () => (shader: THREE.WebGLProgramParametersWithUniforms) => {
      if (!normalTex) return
      shader.uniforms.terrainNormalMap = { value: normalTex }
      shader.uniforms.detailSlopeMap = { value: detail }
      shader.uniforms.mapXDir = { value: new THREE.Vector3(...MAP_X_DIR) }
      shader.uniforms.bounceRadiance = { value: SHADOW_BOUNCE_RADIANCE }

      // The patches themselves, and the reasoning for each anchor, live in
      // lib/lunar-atlas/terrainShader.ts — they are string surgery on shader
      // source three owns, so they are unit-tested against three's real
      // ShaderLib rather than trusted.
      shader.vertexShader = applyShaderPatches(shader.vertexShader, TERRAIN_VERTEX_PATCHES)
      shader.fragmentShader = applyShaderPatches(shader.fragmentShader, TERRAIN_FRAGMENT_PATCHES)
    },
    [normalTex, detail]
  )

  const handleClick = (e: any) => {
    if (e.delta <= CLICK_DRAG_TOLERANCE_PX) onSurfaceClick?.()
  }

  if (!innerGeo || !normalTex) return null

  return (
    <mesh
      geometry={innerGeo.geometry}
      position={innerGeo.origin}
      onClick={handleClick}
      receiveShadow
    >
      {/* Lambert only for its light loop and its shadow plumbing — RE_Direct is
          replaced above, so nothing Lambertian survives into the image. The
          colour is a TINT and must stay near white: the ground's darkness comes
          from the BRDF's single scattering albedo, and a dark colour here would
          apply it a second time.

          USE_UV is forced because this material has no `map`. Without a texture
          bound to the uv channel three never declares vUv, and the normal and
          detail lookups above would not compile.

          The terrain deliberately does NOT cast. Its own relief is in the normal
          map, not the geometry, so a shadow map rendered from this mesh would
          only know about the 15.6 m mesh and would fight the per-pixel normals.
          Terrain self-shadowing is Phase 2's horizon map. */}
      <meshLambertMaterial
        color={REGOLITH_TINT}
        defines={{ USE_UV: '' }}
        onBeforeCompile={onBeforeCompile}
        // onBeforeCompile changes don't retrigger compilation on their own.
        customProgramCacheKey={() => 'sp-hapke-v1'}
      />
    </mesh>
  )
}
