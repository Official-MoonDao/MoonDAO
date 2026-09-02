// What the metal on this ridge is standing in, so it has something true to
// reflect.
//
// Every fully metallic PBR surface — Starship's stainless, gold MLI, a dish's
// polished web, glazing — is almost pure specular: under punctual lights alone
// it renders near-black, so it reflects its environment map or it reflects
// nothing. This scene used three's RoomEnvironment for that, which is a
// photographic studio: soft boxes, a bright ceiling, grey walls, light arriving
// from every direction at once. It kept the metal from going black and it was
// the single most unlunar thing in the frame. A studio has no horizon, and a
// horizon is the whole visual signature of an airless world.
//
// So this builds the real thing instead — an equirectangular HDR of what you
// would actually see standing on the connecting ridge:
//
//   - A HARD horizon. No atmosphere means no gradient, no haze, no scattering:
//     brilliant regolith and then, across one pixel, black. On a curved metal
//     surface that knife edge is what says "vacuum" more than anything else in
//     the scene.
//   - Black sky above, at a starlight floor rather than a true zero.
//   - Regolith below at its real radiance, carrying both of the terms that
//     make regolith look like regolith (see regolith.ts): the Lommel-Seeliger
//     limb brightening that turns the horizon into a bright band, and the
//     opposition surge, which puts a genuine heiligenschein glow in the
//     down-sun direction — the same halo Apollo crews photographed around the
//     shadow of their own heads.
//   - Earth, at its real bearing and real angular size, as a small blue glint.
//
// WHAT IS DELIBERATELY NOT IN HERE: the sun. A directional light already gives
// every material its GGX specular highlight, so a sun disc in the environment
// would be a second sun — the same object lighting the same surface twice. The
// environment carries strictly the INDIRECT half of the lighting, which is also
// what makes it the correct thing for the ambient-occlusion pass to be
// modulating.
//
// Radiances are in the renderer's own units, derived from SUN_INTENSITY rather
// than dialled in, so scene.environmentIntensity can sit at 1 and mean it.
import * as THREE from 'three'
import { REGOLITH_ALBEDO, normalizedSurge } from '@/lib/lunar-atlas/regolith'
import { capCenterDirection, capLocalDirection } from '@/lib/lunar-atlas/southpole'
import { SUN_DIR, SUN_INTENSITY, SUN_LOCAL_ELEV_DEG } from '@/lib/lunar-atlas/sun'
// The same Earth the user can see, not a second one that happens to agree
// today: EarthGlobe owns the argument for where it hangs (the sub-Earth point
// sits on the horizon from 89.46°S, and its elevation is the relay dishes' own
// libration figure). Reflections that disagreed with the visible disc would be
// the 40°/50° sun bug over again, in a place nobody would think to look.
import { EARTH_ANGULAR_RADIUS_RAD, EARTH_BEARING_DEG, EARTH_ELEV_DEG } from './EarthGlobe'

// 1024x512 is more than a PMREM needs for the rough mips, but the horizon and
// Earth both live in the sharpest one: at this size a texel is 0.35°, so the
// horizon lands within a third of a degree of true and Earth's 1.9° disc is
// about five texels across instead of a suggestion. It is generated once.
const ENV_W = 1024
const ENV_H = 512

// Integrated starlight and zodiacal light, which is all there is to light a
// face that looks at nothing but sky. It is on the order of 1e-5 of the sunlit
// ground, i.e. nothing; the value here is a floor, an order of magnitude up
// from honest, kept only so that an up-facing shadowed panel lands on a very
// dark colour rather than on exactly zero, where a tone curve has nothing to
// work with and banding starts.
const SKY_RADIANCE = 0.0012

// A hint of blue, because what little light is up there is starlight.
const SKY_TINT: [number, number, number] = [0.72, 0.8, 1.0]

// Regolith is very slightly warm and almost perfectly neutral. Resist the urge
// to make this a colour: lunar soil is grey, and the brown in Apollo surface
// photography is largely film stock.
const REGOLITH_TINT: [number, number, number] = [1.0, 0.972, 0.93]

// A disc of cloud and ocean at Bond albedo ~0.3, lit by the same sun, and then
// halved because at any moment roughly half of what faces the Moon is night.
const EARTH_RADIANCE = (0.3 * SUN_INTENSITY) / Math.PI / 2
const EARTH_TINT: [number, number, number] = [0.62, 0.74, 1.0]

const dot3 = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

// Builds the equirectangular source. Feed it to a PMREMGenerator; it is not
// useful as a texture on its own.
export function buildLunarEnvironmentTexture(): THREE.DataTexture {
  const data = new Float32Array(ENV_W * ENV_H * 4)

  const up = capCenterDirection()
  const earthDir = capLocalDirection(EARTH_BEARING_DEG, EARTH_ELEV_DEG)
  const cosEarth = Math.cos(EARTH_ANGULAR_RADIUS_RAD)

  // Cosine of the sun's incidence on flat ground — constant across the whole
  // ground hemisphere, which is what keeps the Lommel-Seeliger term bounded
  // here when it would run away on real terrain.
  const mu0 = Math.sin((SUN_LOCAL_ELEV_DEG * Math.PI) / 180)
  // Lambertian radiance of that ground, before either regolith term.
  const groundBase = (REGOLITH_ALBEDO * SUN_INTENSITY * mu0) / Math.PI

  // Soften the horizon across a single texel of elevation. A truly hard step
  // would alias into a staircase in the sharpest mip, which reads as a jagged
  // edge on a mirrored surface rather than as a crisp one.
  const horizonSoften = Math.PI / ENV_H

  for (let y = 0; y < ENV_H; y++) {
    // Inverse of three's equirectUv: v runs from -Y at row 0 to +Y at the top.
    const v = (y + 0.5) / ENV_H
    const dy = Math.sin((v - 0.5) * Math.PI)
    const r = Math.sqrt(Math.max(0, 1 - dy * dy))

    for (let x = 0; x < ENV_W; x++) {
      const u = (x + 0.5) / ENV_W
      const phi = (u - 0.5) * Math.PI * 2
      const d = [r * Math.cos(phi), dy, r * Math.sin(phi)] as const

      // sin(local elevation): positive is sky, negative is ground.
      const s = dot3(d, up)
      const elev = Math.asin(Math.max(-1, Math.min(1, s)))

      // Sky.
      let cr = SKY_TINT[0] * SKY_RADIANCE
      let cg = SKY_TINT[1] * SKY_RADIANCE
      let cb = SKY_TINT[2] * SKY_RADIANCE

      if (dot3(d, earthDir) > cosEarth) {
        cr += EARTH_TINT[0] * EARTH_RADIANCE
        cg += EARTH_TINT[1] * EARTH_RADIANCE
        cb += EARTH_TINT[2] * EARTH_RADIANCE
      }

      // Ground, blended in below the horizon.
      const groundMix = THREE.MathUtils.smoothstep(-elev, -horizonSoften, horizonSoften)
      if (groundMix > 0) {
        // Cosine of the view angle off the ground's own normal. At the horizon
        // this goes to zero (grazing); straight down it is one.
        const mu = Math.max(0, -s)
        // Lommel-Seeliger, normalized so that looking straight down is 1.
        // Bounded above by (mu0 + 1)/mu0 = 2.43 at grazing view, which is the
        // bright horizon band and not a divergence.
        const ls = (mu0 + 1) / (mu0 + mu)
        // The opposition surge, measured on the ground patch this texel looks
        // at: the direction back to the eye is -d, and the phase angle is what
        // that makes with the sun. Peaks in the antisolar direction, which is
        // below the horizon here because the sun is 44° up.
        const g = Math.acos(Math.max(-1, Math.min(1, -dot3(d, SUN_DIR))))
        const L = groundBase * ls * normalizedSurge(g)
        cr += groundMix * (REGOLITH_TINT[0] * L - cr)
        cg += groundMix * (REGOLITH_TINT[1] * L - cg)
        cb += groundMix * (REGOLITH_TINT[2] * L - cb)
      }

      const i = (y * ENV_W + x) * 4
      data[i] = cr
      data[i + 1] = cg
      data[i + 2] = cb
      data[i + 3] = 1
    }
  }

  const tex = new THREE.DataTexture(data, ENV_W, ENV_H, THREE.RGBAFormat, THREE.FloatType)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.LinearSRGBColorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}
