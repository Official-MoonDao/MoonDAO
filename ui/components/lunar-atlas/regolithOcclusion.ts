// The skyline field, on the GPU, shared by every regolith surface in the scene.
//
// horizon.ts computes what each patch of ground can see; regolithShader.ts contains
// the GLSL that reads it. This is the bit in between: it turns the field into
// textures, and it owns the uniform objects that the terrain, the roads, the spoil
// and the rubble all bind.
//
// ONE SET OF UNIFORM OBJECTS, deliberately. three's uniforms are `{ value }` boxes
// held by reference, so handing the SAME box to every material means the sun is
// moved in one assignment and nothing can be left behind on the old one. The
// alternative — a copy per material, updated in a loop — is how a road ends up lit
// by last frame's sun, and that failure is invisible in a still frame.
//
// It also means the field is built once. It costs 148 ms on the real DEM and about
// 2 MB of GPU memory, and the payload is zero because it is derived from the height
// map that was already downloaded.
import * as THREE from 'three'
import {
  HORIZON_AZIMUTHS,
  HORIZON_SIZE,
  buildHorizonField,
  type HorizonField,
} from '@/lib/lunar-atlas/horizon'
import { CAP_EXTENT_M, MAP_X_DIR, M_TO_UNITS, capCenterDirection } from '@/lib/lunar-atlas/southpole'
import { GLOBE_RADIUS } from '@/lib/lunar-atlas/textures'
import { SUN_ANGULAR_RADIUS_RAD, SUN_DIR } from '@/lib/lunar-atlas/sun'
import { loadInnerField } from './useTerrainSampler'

const HORIZON_TEXTURES = Math.ceil(HORIZON_AZIMUTHS / 4)

// ---------------------------------------------------------------------------
// The patch's tangent frame, for surfaces that have to find themselves in the
// field from a world position rather than from a patch UV.
//
// Built from the same MAP_X_DIR the terrain's per-pixel normals use, and with the
// same cross-product convention (north = up x east), so a road and the ground under
// it cannot disagree about which way the field is oriented.
// ---------------------------------------------------------------------------
const patchUp = new THREE.Vector3(...capCenterDirection())
const patchEast = new THREE.Vector3(...MAP_X_DIR)
  .addScaledVector(patchUp, -new THREE.Vector3(...MAP_X_DIR).dot(patchUp))
  .normalize()
const patchNorth = new THREE.Vector3().crossVectors(patchUp, patchEast)
// Radius is nearly irrelevant here: the offset is projected onto two TANGENT
// directions, so a radial error contributes nothing to first order. It is set to the
// globe radius rather than to the ridge's own height for that reason.
const patchOrigin = patchUp.clone().multiplyScalar(GLOBE_RADIUS)

// Stand-ins until the field is built, chosen so the scene before and after the load
// are the same picture. A zero skyline is level, which shadows nothing for any sun
// above the horizontal; a sky view of 1 is open ground, which is what
// bounceRadiance is already calibrated for. Getting either default backwards would
// show up as the ground changing brightness a second after it appears.
function placeholder(value: number, format: THREE.PixelFormat, channels: number) {
  const data = new Uint16Array(channels)
  data.fill(THREE.DataUtils.toHalfFloat(value))
  const tex = new THREE.DataTexture(data, 1, 1, format, THREE.HalfFloatType)
  tex.needsUpdate = true
  return tex
}

const LEVEL_SKYLINE = placeholder(0, THREE.RGBAFormat, 4)
const OPEN_SKY = placeholder(1, THREE.RedFormat, 1)

// ---------------------------------------------------------------------------
// The shared uniforms
// ---------------------------------------------------------------------------
export type OcclusionUniforms = Record<string, THREE.IUniform>

function initialUniforms(): OcclusionUniforms {
  const u: OcclusionUniforms = {
    skyViewMap: { value: OPEN_SKY },
    // The DESIGN sun, so that landing this changes nothing. tan(44.46°) is 0.98
    // against a measured maximum skyline tangent of 0.51 anywhere on the patch, so
    // every fragment resolves to "lit" and the occlusion is a provable no-op until
    // something points this at sunpath.ts.
    sunWorldDir: { value: new THREE.Vector3(...SUN_DIR) },
    patchOrigin: { value: patchOrigin },
    patchEast: { value: patchEast },
    patchNorth: { value: patchNorth },
    patchInvExtent: { value: 1 / (CAP_EXTENT_M * M_TO_UNITS) },
    // Half-width of the terminator, in the same tangent units as the comparison.
    // The sun's own angular radius: at these elevations tan and the angle agree to
    // better than a part in a thousand, so no correction is worth making.
    sunDiscTan: { value: SUN_ANGULAR_RADIUS_RAD },
  }
  for (let t = 0; t < HORIZON_TEXTURES; t++) u[`horizonMap${t}`] = { value: LEVEL_SKYLINE }
  return u
}

export const REGOLITH_OCCLUSION_UNIFORMS = initialUniforms()

// Point the scene at a sun. The only mutation any caller needs: every regolith
// material reads this same box.
export function setOcclusionSun(dir: readonly [number, number, number]): void {
  ;(REGOLITH_OCCLUSION_UNIFORMS.sunWorldDir.value as THREE.Vector3).set(dir[0], dir[1], dir[2])
}

// ---------------------------------------------------------------------------
// Building the textures
// ---------------------------------------------------------------------------

// Bins four to an RGBA texture: texture t, channel c holds azimuth 4t + c. This
// pairing is what lets the shader read all sixteen with a fixed four fetches and no
// dynamically indexed sampler — see REGOLITH_OCCLUSION_GLSL.
//
// Row order is the height field's, row 0 at map north, which is also what the normal
// texture uses. Both are sampled with the same vUv, so they are right or wrong
// together rather than independently.
function toHorizonTextures(field: HorizonField): THREE.DataTexture[] {
  const { size, azimuths, horizonTan } = field
  const out: THREE.DataTexture[] = []
  for (let t = 0; t < HORIZON_TEXTURES; t++) {
    const data = new Uint16Array(size * size * 4)
    for (let p = 0; p < size * size; p++) {
      for (let c = 0; c < 4; c++) {
        const a = t * 4 + c
        const v = a < azimuths ? horizonTan[p * azimuths + a] : 0
        data[p * 4 + c] = THREE.DataUtils.toHalfFloat(v)
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.HalfFloatType)
    // Linear in space so a terminator moves smoothly across the 62.5 m grid instead
    // of stepping texel to texel. NO mipmaps: this is not a colour, it is a
    // threshold, and a mip level would average a ridge away and let the sun through
    // a hill at distance.
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.generateMipmaps = false
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.needsUpdate = true
    out.push(tex)
  }
  return out
}

function toSkyViewTexture(field: HorizonField): THREE.DataTexture {
  const half = new Uint16Array(field.skyView.length)
  for (let i = 0; i < half.length; i++) half[i] = THREE.DataUtils.toHalfFloat(field.skyView[i])
  const tex = new THREE.DataTexture(half, field.size, field.size, THREE.RedFormat, THREE.HalfFloatType)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

let building: Promise<void> | null = null

// Build the field and hand it to the shared uniforms. Idempotent and safe to call
// from every component that needs it — whichever mounts first does the work.
export function primeRegolithOcclusion(): Promise<void> {
  if (building) return building
  building = loadInnerField().then((heights) => {
    const field = buildHorizonField(heights)
    const maps = toHorizonTextures(field)
    maps.forEach((tex, t) => {
      REGOLITH_OCCLUSION_UNIFORMS[`horizonMap${t}`].value = tex
    })
    REGOLITH_OCCLUSION_UNIFORMS.skyViewMap.value = toSkyViewTexture(field)
  })
  return building
}

// Everything the shader needs, ready to merge into a material's uniforms.
export function bindOcclusionUniforms(uniforms: OcclusionUniforms): void {
  for (const [name, box] of Object.entries(REGOLITH_OCCLUSION_UNIFORMS)) uniforms[name] = box
}

export const HORIZON_TEXTURE_COUNT = HORIZON_TEXTURES
export const HORIZON_FIELD_SIZE = HORIZON_SIZE
