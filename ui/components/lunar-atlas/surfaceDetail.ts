// GPU side of the shared surface noise, and the hook that puts it on hardware.
import * as THREE from 'three'
import {
  GRADED_SURFACE_FRAGMENT_PATCHES,
  GRADED_SURFACE_VERTEX_PATCHES,
  HARDWARE_SHADOW_ONLY_VERTEX_PATCHES,
  HARDWARE_SURFACE_FRAGMENT_PATCHES,
  HARDWARE_SURFACE_VERTEX_PATCHES,
  applyShaderPatches,
} from '@/lib/lunar-atlas/regolithShader'
import { SURFACE_NOISE_SIZE, buildSurfaceNoise } from '@/lib/lunar-atlas/surfaceNoise'
import { bindOcclusionUniforms } from './regolithOcclusion'

// One texture for the process, behind one uniform box, for the reason every shared
// uniform in this scene is a box: materials capture it by reference at compile.
const shared = globalThis as { __moonbaseSurfaceNoise?: { value: THREE.Texture | null } }
export const SURFACE_NOISE_UNIFORM = (shared.__moonbaseSurfaceNoise ??= { value: null })

export function surfaceNoiseUniform(): { value: THREE.Texture | null } {
  if (!SURFACE_NOISE_UNIFORM.value) {
    const tex = new THREE.DataTexture(
      buildSurfaceNoise(),
      SURFACE_NOISE_SIZE,
      SURFACE_NOISE_SIZE,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    )
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.generateMipmaps = true
    tex.anisotropy = 8
    tex.needsUpdate = true
    SURFACE_NOISE_UNIFORM.value = tex
  }
  return SURFACE_NOISE_UNIFORM
}

type Lit = THREE.Material & {
  isMeshStandardMaterial?: boolean
  isMeshLambertMaterial?: boolean
  isMeshPhongMaterial?: boolean
  isMeshToonMaterial?: boolean
}

// Whether a material was authored to BE regolith — a berm, a printed pad, a spoil
// heap, a sandbag — as opposed to something manufactured that happens to be grey.
// Recognised by what it is rather than by a list of names, because the models
// spell it a dozen ways: fully rough, non-metallic, and a warm near-grey of
// middling value. White paint is too bright to qualify, rubber too dark, and
// anything with a real hue too saturated. A material whose tone is not in its
// colour at all (it rides on vertex colours) says so by name.
export const REGOLITH_MATERIAL_NAME = 'regolith'
const SOIL_HSL = { h: 0, s: 0, l: 0 }
function looksLikeSoil(mat: THREE.MeshStandardMaterial): boolean {
  if ((mat.metalness ?? 0) > 0.1 || (mat.roughness ?? 0) < 0.9) return false
  if (mat.transparent || !mat.color) return false
  const e = mat.emissive
  if (e && e.r + e.g + e.b > 0.05) return false
  mat.color.getHSL(SOIL_HSL)
  return SOIL_HSL.s < 0.22 && mat.color.r >= mat.color.b && SOIL_HSL.l > 0.1 && SOIL_HSL.l < 0.6
}

// Gives a piece of hardware what every lit surface on the base needs: shadow
// lookups precise enough to meet its own feet, and then one of two finishes.
//
// Manufactured surfaces keep their PBR and gain a little non-uniformity (see
// HARDWARE_SURFACE_FRAGMENT_PATCHES).
//
// Surfaces made OF the ground are lit as the ground is, by the regolith BRDF.
// This is not a nicety. At the phase angles this base is seen from, regolith
// returns a quarter to an eighth of what a Lambertian surface of the same albedo
// does, so a berm shaded by three's own diffuse lobe — whatever colour it is
// given — stands out against the soil it was bulldozed from as a pale plaster
// wedge, and brightens and darkens with the view in the opposite sense to the
// ground around it. `userData.soilFinish` records the choice for the colour pass
// in SurfaceAnchor, which then treats the colour as a tint on the soil's albedo.
//
// Idempotent via the userData flag, because the traversal that calls this re-runs
// as GLB children stream in, and re-wrapping onBeforeCompile on each pass would
// stack the patches until an anchor missed and threw.
export function finishHardwareMaterial(mat: THREE.Material): void {
  const m = mat as Lit
  const pbr = !!m.isMeshStandardMaterial
  if (!pbr && !m.isMeshLambertMaterial && !m.isMeshPhongMaterial && !m.isMeshToonMaterial) return
  if (mat.userData.hardwareFinished) return
  mat.userData.hardwareFinished = true
  const soil =
    pbr && (mat.name === REGOLITH_MATERIAL_NAME || looksLikeSoil(mat as THREE.MeshStandardMaterial))
  mat.userData.soilFinish = soil

  const prior = mat.onBeforeCompile
  // Read before the hook is replaced: three's default key is the hook's own source.
  const priorKey = mat.customProgramCacheKey.call(mat)
  mat.onBeforeCompile = (shader, renderer) => {
    prior?.call(mat, shader, renderer)
    if (soil) {
      bindOcclusionUniforms(shader.uniforms)
      shader.vertexShader = applyShaderPatches(shader.vertexShader, GRADED_SURFACE_VERTEX_PATCHES)
      shader.fragmentShader = applyShaderPatches(
        shader.fragmentShader,
        GRADED_SURFACE_FRAGMENT_PATCHES
      )
    } else if (pbr) {
      shader.uniforms.surfaceNoiseMap = surfaceNoiseUniform()
      shader.vertexShader = applyShaderPatches(shader.vertexShader, HARDWARE_SURFACE_VERTEX_PATCHES)
      shader.fragmentShader = applyShaderPatches(
        shader.fragmentShader,
        HARDWARE_SURFACE_FRAGMENT_PATCHES
      )
    } else {
      shader.vertexShader = applyShaderPatches(
        shader.vertexShader,
        HARDWARE_SHADOW_ONLY_VERTEX_PATCHES
      )
    }
  }
  // onBeforeCompile is not part of three's program cache key, so the patched and
  // unpatched variants of one material class would otherwise share a program.
  const finish = soil ? 'soil' : pbr ? 'pbr' : 'lit'
  mat.customProgramCacheKey = () => `hw-finish-v2:${finish}:${priorKey}`
  // The material may already be compiled by the time the traversal reaches it —
  // GLB subtrees mount through Suspense after their anchor's first render.
  mat.needsUpdate = true
}
