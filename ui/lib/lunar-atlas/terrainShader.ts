// The GLSL surgery that turns three's Lambert material into a regolith one.
//
// This lives apart from SouthPoleTerrain.tsx for one reason: it is the most
// dangerous code in the terrain and the only way to test it is headlessly.
//
// Every patch below is a string replacement against shader source that three
// owns. If an anchor stops matching — a chunk gets renamed, whitespace inside a
// #define changes, three reorders its includes — `String.replace` does not fail.
// It returns the original string, the material compiles perfectly, and the
// ground renders with Lambert's BRDF and the mesh's coarse normals while looking
// superficially fine. That is a silent, plausible wrong answer, which is the
// worst kind, and it would survive every visual review.
//
// So: applyShaderPatches throws when an anchor misses, and a unit test runs
// these patches against three's real ShaderLib source. A three upgrade that
// breaks an anchor turns a test red instead of quietly un-physicalizing the
// Moon.
//
// No three import here — pure strings, so the test is a plain mocha run.
import { HAPKE_GLSL } from './regolith'

export type ShaderPatch = {
  // Named so the throw says which one, since the anchors are long.
  label: string
  find: string | RegExp
  insert: string
}

// Per-octave (uv repeat, slope amplitude) for the tiling detail normal.
//
// The repeats are the four scales the old baked hillshade used: the UV square
// spans 16 km, so x60 is a 267 m tile carrying 1-12 m craterlets, x250 is 64 m,
// x800 is 20 m grain, and x6400 is 2.5 m soil texture for ground-level views.
//
// The amplitudes are SLOPES, and they are solved against a target rather than
// eyeballed. The tile's own height field measures an RMS gradient of 0.72 (its
// heights are in pixel units, so that is already dimensionless), and mature lunar
// regolith runs about 0.26-0.34 RMS at meter scale — 15° to 19°. Weighting the
// octaves 1 : 1 : 0.7 : 0.5 and scaling to hit 0.30 gives the numbers below;
// scripts can re-solve them by measuring the tile if the crater population
// changes.
//
// The first version of these was 0.1 / 0.1 / 0.07 / 0.05, which summed to an RMS
// slope of 0.128 — 7°, less than half of real ground. That is what made the near
// field read as smooth plaster: the DEM genuinely has no information below ~10 m
// (LOLA's grids are interpolated from sparse tracks), so if this tile is too
// shallow there is nothing else to supply foreground texture.
export const DETAIL_OCTAVES: [number, number][] = [
  [60, 0.25],
  [250, 0.25],
  [800, 0.18],
  [6400, 0.13],
]

// Fade the patch rim into the dark of space, so the 16 km square reads as a
// field receding into shadow rather than a hard-edged floating slab. The
// argument is 0 at the ridge, 1 at an edge midpoint, ~1.41 at the corners.
// Phase 4 deletes this in favour of real terrain out to the true horizon.
const RIM_FADE_GLSL = `diffuseColor.rgb *= 1.0 - smoothstep(0.82, 1.34, length(vUv - 0.5) * 2.0);`

export const TERRAIN_VERTEX_PATCHES: ShaderPatch[] = [
  {
    label: 'declare world-position varying',
    find: '#include <common>',
    insert: '#include <common>\nvarying vec3 vTerrainWorldPos;',
  },
  {
    // The precision warning in southpole.ts' buildCapGeometry does not bite
    // here. A magnitude-2 float32 position is quantised to ~21 cm, which on a
    // 1737 km radius is a direction error of 1e-7 radians. It would matter if
    // this were used as a POSITION; it is only ever normalized to get the local
    // vertical.
    label: 'compute world position',
    find: '#include <begin_vertex>',
    insert: '#include <begin_vertex>\nvTerrainWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;',
  },
]

export const TERRAIN_FRAGMENT_PATCHES: ShaderPatch[] = [
  {
    label: 'declare uniforms and the Hapke functions',
    find: '#include <common>',
    insert: `#include <common>
uniform sampler2D terrainNormalMap;
uniform sampler2D detailSlopeMap;
uniform vec3 mapXDir;
uniform float bounceRadiance;
varying vec3 vTerrainWorldPos;
${HAPKE_GLSL}`,
  },
  {
    label: 'rim fade',
    find: '#include <color_fragment>',
    insert: `#include <color_fragment>\n${RIM_FADE_GLSL}`,
  },
  {
    // Injected after normal_fragment_MAPS, not after normal_fragment_begin, so
    // nothing three does later can overwrite the result.
    //
    // The tangent frame is Gram-Schmidted from one constant world axis against
    // the fragment's own local vertical, which carries the sphere's curvature
    // across the patch exactly. Treating the 16 km square as flat would tilt the
    // normal by up to 0.9° at the far corner — under the true 2° polar sun that
    // is most of the incidence cosine.
    label: 'per-pixel terrain normal',
    find: '#include <normal_fragment_maps>',
    insert: `#include <normal_fragment_maps>
{
  vec3 up = normalize(vTerrainWorldPos);
  vec3 ex = normalize(mapXDir - up * dot(mapXDir, up));
  vec3 ey = cross(up, ex);

  vec2 base = texture2D(terrainNormalMap, vUv).xy;
  // Back out the gradient the stored normal came from, so the detail octaves can
  // be ADDED to it. Superimposed height fields add their SLOPES; blending
  // normals instead lets whichever is stronger flatten the other.
  float baseZ = sqrt(max(1.0 - dot(base, base), 1e-6));
  vec2 grad = -base / baseZ;
${DETAIL_OCTAVES.map(
  ([repeat, amp]) =>
    `  grad += texture2D(detailSlopeMap, vUv * ${repeat.toFixed(1)}).xy * ${amp.toFixed(4)};`
).join('\n')}

  float inv = inversesqrt(dot(grad, grad) + 1.0);
  vec3 nWorld = normalize((ex * -grad.x + ey * -grad.y + up) * inv);
  normal = normalize((viewMatrix * vec4(nWorld, 0.0)).xyz);
}`,
  },
  {
    // Swap Lambert's BRDF for the regolith's, keeping everything else in three's
    // light loop — directLight.color arrives with the shadow attenuation already
    // multiplied in, which is the whole reason for hooking here instead of
    // writing a ShaderMaterial from scratch and re-plumbing shadows by hand.
    //
    // ANCHORED ON THE INCLUDE, and it has to be. onBeforeCompile runs BEFORE
    // three resolves #include directives, so at this point the source contains
    // the literal line `#include <lights_lambert_pars_fragment>` and NOT the
    // `#define RE_Direct RE_Direct_Lambert` that lives inside that chunk. Trying
    // to match the #define is the exact silent no-op this module exists to
    // prevent — the first draft of this patch did it, and the unit test caught it
    // before it ever ran.
    //
    // So the macro is overridden the only way a macro can be: #undef, then point
    // it somewhere else. The chunk still defines RE_Direct_Lambert, which simply
    // goes uncalled.
    //
    // Note there is no cosine and no BRDF_Lambert on the accumulation line.
    // Hapke's r is defined against irradiance measured perpendicular to the beam
    // and carries the incidence cosine internally, inside mu0/(mu0 + mu), so
    // multiplying by directLight.color alone is the dimensionally correct thing
    // — structurally the same as Lambert's own dotNL * color * albedo/pi.
    label: 'replace RE_Direct with Hapke',
    find: '#include <lights_lambert_pars_fragment>',
    insert: `#include <lights_lambert_pars_fragment>
#undef RE_Direct
void RE_Direct_Hapke( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
  float mu0 = dot(geometryNormal, directLight.direction);
  float mu = dot(geometryNormal, geometryViewDir);
  float cosG = clamp(dot(directLight.direction, geometryViewDir), -1.0, 1.0);
  float r = hapkeReflectance(mu0, mu, cosG, acos(cosG));
  reflectedLight.directDiffuse += directLight.color * r * material.diffuseColor;
}
#define RE_Direct RE_Direct_Hapke`,
  },
  {
    // The regolith bounce that fills every shadow. Added as radiance rather than
    // as an ambient light so it cannot leak into the direct term or get
    // double-counted by three's indirect path.
    label: 'regolith bounce fill',
    find: '#include <lights_fragment_end>',
    insert: `#include <lights_fragment_end>
reflectedLight.indirectDiffuse += bounceRadiance * diffuseColor.rgb;`,
  },
]

// Applies patches in order, refusing to return a shader that is missing any of
// them. The replacement is passed as a function so that `$&` and friends in the
// GLSL cannot be interpreted as substitution patterns.
export function applyShaderPatches(src: string, patches: ShaderPatch[]): string {
  let out = src
  for (const p of patches) {
    const next = out.replace(p.find as RegExp, () => p.insert)
    if (next === out) {
      throw new Error(
        `terrain shader patch "${p.label}" did not apply — three's shader source ` +
          `no longer contains its anchor. See lib/lunar-atlas/terrainShader.ts.`
      )
    }
    out = next
  }
  return out
}
