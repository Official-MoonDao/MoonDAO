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
import {
  SUN_ANGULAR_RADIUS_RAD,
  SUN_DIR,
  SUN_INTENSITY,
  SUN_LOCAL_ELEV_DEG,
} from '@/lib/lunar-atlas/sun'
import { litGroundRadiance, shadowFillRadiance } from '@/lib/lunar-atlas/regolith'
import {
  HARDWARE_OCCLUSION_FRAGMENT_PATCHES,
  HARDWARE_OCCLUSION_VERTEX_PATCHES,
  applyShaderPatches,
} from '@/lib/lunar-atlas/regolithShader'
import { loadInnerField } from './useTerrainSampler'

const HORIZON_TEXTURES = Math.ceil(HORIZON_AZIMUTHS / 4)

// The colour and strength of the base's own working lights. Cool white, because
// every surface fixture flown or proposed is an LED array — and slightly blue
// against the warm-grey sun, which is what makes a lit lot read as artificially
// lit rather than as underexposed daylight.
const SITE_LIGHT_COLOR = '#cdd8ff'
const SITE_LIGHT_RADIANCE = 0.045

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
    // The fill in every shadow, and now shared rather than computed twice.
    //
    // SouthPoleTerrain and BaseRoads each used to derive this from the same
    // expression, with a comment in each explaining that they had to agree — a road
    // in shadow cannot sit at a different depth from the ground it crosses. Agreeing
    // by duplication is the weakest form of agreeing, and it also could not survive a
    // sun that moves, since the fill scales with the sun's elevation.
    bounceRadiance: { value: 0 },
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
    // The base's own floodlighting on its hardware, applied only where the
    // skyline has taken the sun away (see the hardware patches). Linear radiance
    // in the same units as everything else here: 0.045 against a white hull's
    // ~0.6 albedo lands a shadowed structure near sRGB 55 under the real sun —
    // clearly readable, well under the ~130 the same hull renders in sunlight.
    siteLight: {
      value: new THREE.Color(SITE_LIGHT_COLOR).multiplyScalar(SITE_LIGHT_RADIANCE),
    },
  }
  for (let t = 0; t < HORIZON_TEXTURES; t++) u[`horizonMap${t}`] = { value: LEVEL_SKYLINE }
  return u
}

// ONE SET PER PROCESS, guarded against Fast Refresh — not just one per module.
//
// Every regolith material captures these boxes by reference inside its
// onBeforeCompile closure, and those materials outlive this module: in dev, editing
// anything in the sun's import chain re-evaluates this file while the compiled
// terrain lives on. Without the guard that re-evaluation minted a FRESH set of boxes
// and split the scene's brain — new components dutifully updating uniforms nothing
// reads, old materials frozen on the last sun the dead boxes ever saw. It rendered as
// half the map black under the design sun, with the frozen terrain shadows refusing
// to follow the scrubber. Production cannot hit this (modules evaluate once); the
// guard exists so a hot edit cannot manufacture that bug on a dev's screen either.
const hmr = globalThis as { __moonbaseOcclusionUniforms?: OcclusionUniforms }
const firstEvaluation = !hmr.__moonbaseOcclusionUniforms
export const REGOLITH_OCCLUSION_UNIFORMS = (hmr.__moonbaseOcclusionUniforms ??=
  initialUniforms())

// Start on the design sun, so the initial state is the scene as it ships and
// bounceRadiance is never briefly zero. Only on the FIRST evaluation: a re-evaluation
// while a real sun is up must not yank the survivors' shared boxes back to the design
// sun behind the mounted Sun component's back. (setRegolithSun is a hoisted
// declaration, so this runs after the boxes above exist.)
if (firstEvaluation) setRegolithSun(SUN_DIR, SUN_LOCAL_ELEV_DEG)

// Point the whole scene at a sun. The only mutation any caller needs, and the only
// place the sun's elevation turns into a shadow depth.
//
// Everything here scales with the sun rather than being pinned to it, which is what
// makes a moving sun cost nothing: litGroundRadiance and shadowFillRadiance have been
// functions of elevation since the Hapke work, precisely so this call could exist.
export function setRegolithSun(
  dir: readonly [number, number, number],
  elevationDeg: number
): void {
  ;(REGOLITH_OCCLUSION_UNIFORMS.sunWorldDir.value as THREE.Vector3).set(dir[0], dir[1], dir[2])
  // Below the horizontal there is no lit ground in view to bounce anything, so the
  // fill goes to zero rather than negative. The DIRECT term is still allowed through
  // by the skyline test, which is the case a crest at dawn depends on.
  const lit = elevationDeg > 0 ? litGroundRadiance(SUN_INTENSITY, elevationDeg) : 0
  REGOLITH_OCCLUSION_UNIFORMS.bounceRadiance.value = shadowFillRadiance(lit)
}

// Exposure lives in lib/lunar-atlas/sun.ts — it is a fact about the sun rather than
// about the ground, and keeping it out of a module that imports THREE is what makes it
// testable. MoonGlobe imports it from there directly.

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

// Put a piece of HARDWARE under the skyline: same occlusion the terrain evaluates,
// gating only the direct sun, leaving the material's own PBR/emissive/indirect alone
// (see the patch definitions for the argument). Safe on shared materials — the
// occlusion is computed per fragment from the fragment's own world position, so one
// material serving fifty rovers shades each of them by where it actually stands.
//
// Idempotent via the userData flag, because the traversal that calls this re-runs as
// GLB children stream in, and re-wrapping onBeforeCompile on each pass would stack
// the patches until an anchor missed and threw. Basic/unlit materials are skipped:
// they are markers and decals, not lit hardware.
export function occludeHardwareMaterial(mat: THREE.Material): void {
  if (!(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) return
  if (mat.userData.regolithOccluded) return
  mat.userData.regolithOccluded = true
  const prior = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prior?.(shader, renderer)
    bindOcclusionUniforms(shader.uniforms as OcclusionUniforms)
    shader.vertexShader = applyShaderPatches(
      shader.vertexShader,
      HARDWARE_OCCLUSION_VERTEX_PATCHES
    )
    shader.fragmentShader = applyShaderPatches(
      shader.fragmentShader,
      HARDWARE_OCCLUSION_FRAGMENT_PATCHES
    )
  }
  // The material may already be compiled by the time the traversal reaches it —
  // GLB subtrees mount through Suspense after their anchor's first render.
  mat.needsUpdate = true
}

export const HORIZON_TEXTURE_COUNT = HORIZON_TEXTURES
export const HORIZON_FIELD_SIZE = HORIZON_SIZE
