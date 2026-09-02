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
  OPPOSITION_B0,
  OPPOSITION_H,
  PHASE_REF_DEG,
  oppositionSurge,
} from '@/lib/lunar-atlas/regolith'
import { CAP_GRID, buildCapGeometry, type PolarHeightField } from '@/lib/lunar-atlas/southpole'
import { SUN_DIR, SUN_MAP_AZ_DEG } from '@/lib/lunar-atlas/sun'
import { SP_ALBEDO_MAP } from '@/lib/lunar-atlas/textures'
import { loadInnerField } from './useTerrainSampler'

// A pointer that travels farther than this between down and up is a drag
// (camera tumble), not a click.
const CLICK_DRAG_TOLERANCE_PX = 8

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
  geo.computeVertexNormals()
  return { geometry: geo, origin: new THREE.Vector3(...cap.origin) }
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

  // Hillshade with a wrapping gradient. Light azimuth is the bake's own
  // map-frame azimuth (SUN_MAP_AZ_DEG), which this file used to repeat as a
  // bare 40 of its own; elevation is kept moderate so bowls shade without
  // going black. Flat ground maps to 128 so the multiply blend is neutral.
  const az = (SUN_MAP_AZ_DEG * Math.PI) / 180
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
  const [innerGeo, setInnerGeo] = useState<CapMesh | null>(null)

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
      innerGeo?.geometry.dispose()
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
  // so magnified close-ups keep structure, then applies the one piece of
  // regolith shading a bake can never hold (see the surge block below). Mean
  // of the detail blend is ~1.0 (flat tile = 0.5, blend is 0.76 + 0.48·dn), so
  // the overall tone is preserved.
  const onBeforeCompile = useMemo(
    () => (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.detailMap = { value: detail }
      shader.uniforms.sunDirection = {
        value: new THREE.Vector3(...SUN_DIR),
      }
      shader.uniforms.surgeRef = {
        value: oppositionSurge((PHASE_REF_DEG * Math.PI) / 180),
      }

      // The phase angle has to be computed in VIEW space, not world space.
      // World positions on this mesh are magnitude ~2 in float32, where a step
      // is 21 cm (the precision argument in southpole.ts' buildCapGeometry) —
      // eight metres from the eye that is a 1.5° error in the view direction,
      // and the surge would boil as the camera moved. The geometry is stored
      // camera-relative with its offset on the mesh transform precisely so
      // that modelViewMatrix · position stays exact, so mvPosition is the one
      // place in this shader where the view vector can be trusted.
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSurgeViewPos;')
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nvSurgeViewPos = mvPosition.xyz;'
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          `#include <map_pars_fragment>
          uniform sampler2D detailMap;
          uniform vec3 sunDirection;
          uniform float surgeRef;
          varying vec3 vSurgeViewPos;`
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

            // The opposition surge — the one thing about regolith that a baked
            // hillshade fundamentally cannot carry, because a bake has no
            // viewer and this term depends only on where the viewer is.
            //
            // Regolith is a deep pile of loose grains, so it is full of tiny
            // shadows, and every one of them hides behind the grain that casts
            // it. Move the eye toward the sun and those shadows disappear
            // behind their own grains, so the ground brightens sharply: it is
            // why a full moon is far more than twice a half moon, and why an
            // Apollo crewman photographed a halo around the shadow of his own
            // head. Hapke's shadow-hiding term, B(g) = 1 + B0/(1 + tan(g/2)/h),
            // with g the sun-surface-viewer phase angle (see regolith.ts).
            //
            // Divided through by its value at PHASE_REF_DEG so this is a
            // RELATIVE effect. B is never below 1, so applying it raw would
            // brighten the whole ridge and throw away the exposure the scene
            // is tuned around; normalized at 85° — the mean phase angle across
            // the home framing — the load-in shot is left within 2% of where it
            // was and the surge only appears once the camera tumbles down-sun,
            // which is exactly where it belongs. The clamp is a backstop for
            // the last fraction of a degree around exact opposition, where the
            // real surge keeps climbing and a bloom threshold is waiting.
            vec3 toEye = normalize(-vSurgeViewPos);
            vec3 toSun = normalize((viewMatrix * vec4(sunDirection, 0.0)).xyz);
            float g = acos(clamp(dot(toSun, toEye), -1.0, 1.0));
            float surge = 1.0 + ${OPPOSITION_B0.toFixed(3)}
              / (1.0 + tan(0.5 * g) / ${OPPOSITION_H.toFixed(3)});
            diffuseColor.rgb *= clamp(surge / surgeRef, 0.85, 1.75);
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
      <mesh geometry={innerGeo.geometry} position={innerGeo.origin} onClick={handleClick}>
        <meshBasicMaterial
          map={albedo}
          onBeforeCompile={onBeforeCompile}
          // onBeforeCompile changes don't retrigger compilation on their own.
          customProgramCacheKey={() => 'sp-inner-detail-v3-surge'}
        />
      </mesh>
      {/* Shadow catcher. An unlit material cannot receive shadows, so the
          installations' cast shadows are drawn as a second, transparent pass
          over the SAME geometry — ShadowMaterial renders nothing except where
          something shadows it. Without this the hardware had no contact
          shadow at all and read as pasted onto a photo.

          The terrain deliberately does NOT cast: its own relief shadows are
          already baked into the albedo, so casting them again would
          double-darken every slope. */}
      <mesh geometry={innerGeo.geometry} position={innerGeo.origin} receiveShadow>
        <shadowMaterial
          transparent
          // What is left in a lunar shadow is regolith bounce and nothing else
          // — about 4% of the sun, computed from albedo 0.12 at a 44.5° solar
          // incidence. Hence 0.92 rather than 0.88: shadows here are deeper
          // than a terrestrial eye expects, because there is no sky to fill
          // them. The residual was also the wrong COLOUR. It was a blue-black,
          // which is the colour of a shadow on Earth, where the fill really is
          // blue sky; the only thing lighting a lunar shadow is warm-grey soil
          // a few metres away, so the floor it settles onto is warm.
          opacity={0.92}
          color="#0d0a06"
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
    </group>
  )
}
