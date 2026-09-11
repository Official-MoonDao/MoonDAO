// The GLSL surgery that turns three's stock materials into regolith ones.
//
// Two consumers, for one reason. Every surface in this scene that is made of
// lunar soil has to use the SAME reflectance law, or the ones that don't will be
// wrong by a factor that depends on the sun — and at the polar phase angles this
// scene lives at, that factor is about four. It is not a subtle mismatch: a
// Lambertian surface and a Hapke surface of identical albedo differ by 4x here,
// so roads authored to look like the ground read as poured concrete beside it.
// The terrain got the treatment first; the graded surfaces are the same material
// in the world and now get the same treatment in the shader.
//
// This lives apart from the components for one reason: it is the most dangerous
// code in the scene and the only way to test it is headlessly.
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
import { HORIZON_AZIMUTHS } from './horizon'

export type ShaderPatch = {
  // Named so the throw says which one, since the anchors are long.
  label: string
  find: string | RegExp
  insert: string
}

// ---------------------------------------------------------------------------
// The two patches every regolith surface needs, as factories
//
// Parameterised over three's material struct because the anchor and the struct
// differ per material class — Lambert declares LambertMaterial in
// lights_lambert_pars_fragment, Standard declares PhysicalMaterial in
// lights_physical_pars_fragment — while the body is identical. Written once so
// the terrain and the graded surfaces cannot drift apart, which is the entire
// failure this module now exists to prevent.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Occlusion by terrain the shadow map cannot reach
//
// A shadow map covers the hundred metres around the camera. At the sun this scene
// is heading for — 2° at most, see sunpath.ts — 57% of the patch is in the shadow
// of terrain up to 8 km away, and none of that is in any shadow map. The skyline
// field in horizon.ts answers it instead: the sun is blocked exactly when it sits
// below the skyline in its own compass direction, which is one lookup.
//
// SHARED, and that is the point of putting it here rather than in the terrain. The
// ground, the roads across it and the spoil beside them are all in or out of the
// same shadow, and a road still lit inside a shadowed valley is the single most
// conspicuous thing this could get wrong. Both material classes read the same
// function.
//
// SAFE TO LAND AHEAD OF THE SUN THAT NEEDS IT. The comparison is in tangents, and
// tan(44.46°) is 0.98 against a measured maximum skyline tangent of 0.51 across the
// whole patch, so at the design sun this evaluates to "lit" everywhere and is a
// provable no-op. It only starts doing anything when the sun comes down.
// ---------------------------------------------------------------------------

// Bins packed four to an RGBA texture, so the shader can read all of them with a
// fixed number of fetches. The alternative — one array texture, or an atlas — needs
// either a dynamically indexed sampler or a hand-rolled bilinear with a per-tile
// inset, and this scene's terrain is one draw call that can afford four fetches.
const HORIZON_TEXTURES = Math.ceil(HORIZON_AZIMUTHS / 4)

// Weights that pick the two skyline bins either side of the sun's azimuth and lerp
// between them. Written as a tent over every channel rather than an index, because
// GLSL ES cannot index a sampler with a varying value: each channel gets a weight
// that is zero unless the sun is within one bin of it, so the dot products below
// come out as a plain linear interpolation.
const horizonWeightGlsl = () => {
  const lines: string[] = []
  for (let t = 0; t < HORIZON_TEXTURES; t++) {
    const comps = [0, 1, 2, 3].map((c) => `hzTent(a, ${(t * 4 + c).toFixed(1)})`)
    lines.push(`  vec4 w${t} = vec4(${comps.join(', ')});`)
  }
  return lines.join('\n')
}

const horizonSampleGlsl = () =>
  Array.from(
    { length: HORIZON_TEXTURES },
    (_, t) => `  float h${t} = dot(texture2D(horizonMap${t}, uv), w${t});`
  ).join('\n')

const horizonSumGlsl = () =>
  Array.from({ length: HORIZON_TEXTURES }, (_, t) => `h${t}`).join(' + ')

export const REGOLITH_OCCLUSION_GLSL = `
varying vec3 vRegolithWorldPos;
${Array.from({ length: HORIZON_TEXTURES }, (_, t) => `uniform sampler2D horizonMap${t};`).join('\n')}
uniform sampler2D skyViewMap;
uniform vec3 sunWorldDir;
uniform vec3 patchOrigin;
uniform vec3 patchEast;
uniform vec3 patchNorth;
uniform float patchInvExtent;
uniform float sunDiscTan;

// Set before the light loop and read inside the BRDF. Defaulting to "fully lit,
// fully open" matters: any material that does not call regolithApplyOcclusion
// behaves exactly as it did before these patches existed.
float regolithDirectOcclusion = 1.0;
float regolithSkyView = 1.0;

float hzTent(float a, float i) {
  float d = abs(a - i);
  d = min(d, ${HORIZON_AZIMUTHS.toFixed(1)} - d);
  return max(0.0, 1.0 - d);
}

// Patch UV from a world position, for surfaces that do not already have one.
// A linear map onto the patch's tangent frame: the stereographic scale factor
// varies by 3e-5 over this patch and the tangent plane departs from the sphere by
// 18 m at the rim, both far inside one 62.5 m skyline texel.
vec2 regolithPatchUv(vec3 worldPos) {
  vec3 d = worldPos - patchOrigin;
  return vec2(dot(d, patchEast), dot(d, patchNorth)) * patchInvExtent + 0.5;
}

void regolithApplyOcclusion(vec2 uv, vec3 worldPos) {
  vec3 up = normalize(worldPos);
  vec3 ex = normalize(patchEast - up * dot(patchEast, up));
  vec3 ey = cross(up, ex);

  // The sun in this fragment's own local frame. Per-fragment rather than a single
  // number for the patch, because "up" turns through 0.5° across 16 km and that is
  // a quarter of the sun's whole elevation.
  float sunUp = dot(sunWorldDir, up);
  vec2 sunFlat = vec2(dot(sunWorldDir, ex), dot(sunWorldDir, ey));
  float sunTan = sunUp / max(length(sunFlat), 1e-6);
  float az = atan(sunFlat.y, sunFlat.x);
  float a = az * ${(HORIZON_AZIMUTHS / (2 * Math.PI)).toFixed(8)};
  a = mod(a, ${HORIZON_AZIMUTHS.toFixed(1)});

${horizonWeightGlsl()}
${horizonSampleGlsl()}
  float horizonTan = ${horizonSumGlsl()};

  // Not a step. The sun is a disc 0.53° across, so a terminator 8 km out is
  // genuinely soft — and it is soft by an amount this scene can compute rather than
  // choose, which is the same argument the shadow-map softness in MoonGlobe makes.
  regolithDirectOcclusion = smoothstep(horizonTan - sunDiscTan, horizonTan + sunDiscTan, sunTan);
  regolithSkyView = texture2D(skyViewMap, uv).r;
}
`

// Where the occlusion is evaluated. Before three's light loop, so the BRDF can read
// it, and after the normal chunks, so nothing here depends on ordering with them.
export function occlusionPatch(uvExpr: string, worldPosExpr: string): ShaderPatch {
  return {
    label: `evaluate terrain occlusion (${uvExpr})`,
    find: '#include <lights_fragment_begin>',
    insert: `regolithApplyOcclusion(${uvExpr}, ${worldPosExpr});
#include <lights_fragment_begin>`,
  }
}

// Swap a material's direct-light BRDF for the regolith's, keeping everything else
// in three's light loop — directLight.color arrives with the shadow attenuation
// already multiplied in, which is the whole reason for hooking here instead of
// writing a ShaderMaterial from scratch and re-plumbing shadows by hand.
//
// ANCHORED ON THE INCLUDE, and it has to be. onBeforeCompile runs BEFORE three
// resolves #include directives, so at this point the source contains the literal
// line `#include <lights_lambert_pars_fragment>` and NOT the
// `#define RE_Direct RE_Direct_Lambert` that lives inside that chunk. Trying to
// match the #define is the exact silent no-op this module exists to prevent — the
// first draft of this patch did it, and the unit test caught it before it ever
// ran.
//
// So the macro is overridden the only way a macro can be: #undef, then point it
// somewhere else. The chunk still defines its own function, which goes uncalled.
//
// Note there is no cosine and no BRDF_Lambert on the accumulation line. Hapke's r
// is defined against irradiance measured perpendicular to the beam and carries
// the incidence cosine internally, inside mu0/(mu0 + mu), so multiplying by
// directLight.color alone is the dimensionally correct thing — structurally the
// same as Lambert's own dotNL * color * albedo/pi.
export function hapkeDirectPatch(parsChunk: string, materialStruct: string): ShaderPatch {
  return {
    label: `replace RE_Direct with Hapke (${materialStruct})`,
    find: `#include <${parsChunk}>`,
    insert: `#include <${parsChunk}>
#undef RE_Direct
void RE_Direct_Hapke( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ${materialStruct} material, inout ReflectedLight reflectedLight ) {
  float mu0 = dot(geometryNormal, directLight.direction);
  float mu = dot(geometryNormal, geometryViewDir);
  float cosG = clamp(dot(directLight.direction, geometryViewDir), -1.0, 1.0);
  float r = hapkeReflectance(mu0, mu, cosG, acos(cosG));
  // regolithDirectOcclusion is the skyline test; directLight.color already carries
  // the shadow map's attenuation. The two are multiplied because they occlude
  // different things — a habitat's own shadow and a ridge 6 km away — and a point
  // can easily be in both.
  reflectedLight.directDiffuse += directLight.color * regolithDirectOcclusion * r * material.diffuseColor;
}
#define RE_Direct RE_Direct_Hapke`,
  }
}

// The regolith bounce that fills every shadow. Added as radiance rather than as
// an ambient light so it cannot leak into the direct term or get double-counted
// by three's indirect path.
//
// Every regolith surface needs this, not just the terrain: a road with no fill
// would go to pure black in a shadow the ground beside it renders at 6%, which is
// a more conspicuous error than the one it is here to avoid.
//
// Scaled by how much sky the point actually has over it. bounceRadiance is derived
// for OPEN ground — half the hemisphere filled with lit soil — and the factor below
// is 1 at skyView 1, so open ground is unchanged and nothing about the existing
// calibration moves. A closed-in point gets less, bottoming out at half.
//
// The derivation: the fill is the ground's own radiance times the cosine-weighted
// fraction of the hemisphere filled by lit soil. Splitting that into the part from
// sub-resolution roughness, which scales with how much sky is open to light it, and
// the part bounced off visible macro terrain, which scales with how much terrain is
// visible, gives 0.5 * skyView + 0.25 * (1 - skyView) as a fraction of the lit
// ground — and dividing by the 0.5 already inside bounceRadiance leaves this.
//
// HOW MUCH THIS IS WORTH, measured: skyView over the real patch runs from 0.92 to
// 1.0, so the factor spans 0.96 to 1.0 and the effect is under 4% of a term that is
// itself 6% of the lit ground. It is here because it is nearly free and because it
// is the correct shape for when the far-field skirt widens that range, NOT because
// it is doing visible work. Anyone hunting for contact darkening should not expect
// to find it here.
export const BOUNCE_FILL_PATCH: ShaderPatch = {
  label: 'regolith bounce fill',
  find: '#include <lights_fragment_end>',
  insert: `#include <lights_fragment_end>
reflectedLight.indirectDiffuse += bounceRadiance * (0.5 + 0.5 * regolithSkyView) * diffuseColor.rgb;`,
}

// Declarations shared by every regolith fragment shader: the BRDF, the bounce
// uniform, and the skyline occlusion. Callers append whatever else they need.
export function regolithDeclarationsPatch(extra = ''): ShaderPatch {
  return {
    label: 'declare the Hapke functions, the bounce uniform and the occlusion',
    find: '#include <common>',
    insert: `#include <common>
uniform float bounceRadiance;
${extra}${REGOLITH_OCCLUSION_GLSL}${HAPKE_GLSL}`,
  }
}

// A world position in the fragment shader, for the occlusion lookup.
//
// Instancing is handled explicitly because BaseRoads draws its boulders as an
// InstancedMesh, and three applies instanceMatrix inside project_vertex — so
// `transformed` alone is in instance-local space and a rubble field would sample the
// skyline at the origin of the patch instead of at itself. This mirrors three's own
// worldpos_vertex rather than relying on it, since that chunk only declares
// worldPosition under an #if that a future material might not satisfy.
export function worldPosVertexPatches(varying: string): ShaderPatch[] {
  return [
    {
      label: `declare ${varying}`,
      find: '#include <common>',
      insert: `#include <common>\nvarying vec3 ${varying};`,
    },
    {
      label: `compute ${varying}`,
      find: '#include <begin_vertex>',
      insert: `#include <begin_vertex>
{
  vec4 regolithWorld = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    regolithWorld = instanceMatrix * regolithWorld;
  #endif
  ${varying} = (modelMatrix * regolithWorld).xyz;
}`,
    },
  ]
}

// Graded regolith — the road bed and its crust, wheel tracks, blade scuff, spoil
// heaps, and the boulders turned out alongside. These already carry their own
// albedo and normal maps describing the worked surface, so they need none of the
// terrain's normal machinery; they only need to reflect light like soil rather
// than like painted plaster.
//
// Note what dropping RE_Direct_Physical also drops: the GGX specular lobe. That
// is correct rather than a compromise. Regolith has no specular highlight to
// speak of, these materials run at roughness 0.96-1.0 where the lobe is a wide
// dim wash, and the terrain they abut has no specular term at all — so keeping it
// would be the inconsistency.
export const GRADED_SURFACE_FRAGMENT_PATCHES: ShaderPatch[] = [
  regolithDeclarationsPatch(),
  // A road's own UVs run along the road, not across the patch, so its position in
  // the skyline field has to be reconstructed from where it is in the world.
  occlusionPatch('regolithPatchUv(vRegolithWorldPos)', 'vRegolithWorldPos'),
  hapkeDirectPatch('lights_physical_pars_fragment', 'PhysicalMaterial'),
  BOUNCE_FILL_PATCH,
]

// Disturbed regolith — the churn and blast stains in GroundDisturbance. The odd
// one out here, because it is the only surface that is not lit at all.
//
// A stain is not a thing standing on the ground, it is the ground with a different
// albedo, so the material emits a multiplicative FACTOR and lets the blender apply
// it to a surface that has already been shaded. Two consequences worth stating,
// since both look like omissions: there is no BRDF here on purpose, and there must
// not be one — a lit stain would shade against its own smooth geometric normal and
// average away the per-pixel relief it covers. The full argument, including why the
// blend is exact in this pipeline, is in GroundDisturbance.
export const STAIN_FRAGMENT_PATCHES: ShaderPatch[] = [
  {
    // diffuseColor.a arrives as opacity * vertex alpha, so this single mix carries
    // both the stain's radial profile and the timeline's fade-in, and lands on
    // exactly 1.0 — a true no-op — wherever the stain is absent.
    //
    // Alpha is then forced to 1 because this fragment is a factor, not a colour:
    // MultiplyBlending scales the destination's alpha by it too, and a stain has no
    // business eroding the framebuffer's coverage.
    label: 'stain as a multiplicative albedo factor',
    find: '#include <color_fragment>',
    insert: `#include <color_fragment>
diffuseColor = vec4(mix(vec3(1.0), diffuseColor.rgb, diffuseColor.a), 1.0);`,
  },
]

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

// The precision warning in southpole.ts' buildCapGeometry does not bite here. A
// magnitude-2 float32 position is quantised to ~21 cm, which on a 1737 km radius is
// a direction error of 1e-7 radians. It would matter if this were used as a
// POSITION; it is normalized to get the local vertical, and differenced against the
// patch origin at a scale where 21 cm is a thousandth of a skyline texel.
export const TERRAIN_VERTEX_PATCHES: ShaderPatch[] = worldPosVertexPatches('vRegolithWorldPos')

// The graded surfaces need the same world position, for the same skyline lookup.
export const GRADED_SURFACE_VERTEX_PATCHES: ShaderPatch[] =
  worldPosVertexPatches('vRegolithWorldPos')

// ---------------------------------------------------------------------------
// Hardware under the skyline
//
// The landers, habitats, panels and rovers are NOT regolith — they keep their own
// PBR in full, specular lobe and all. But they stand on the same ground under the
// same sun, and until these patches existed they ignored the skyline field
// entirely: a Starship parked inside a kilometre-long terrain shadow rendered in
// full sunlight, because the only shadows it knew about were the shadow map's, and
// the ridge casting on it is kilometres outside the shadow camera. At the design
// sun that is invisible (the skyline shadows 0.00% of the patch); at the real sun
// it made half the hardware glow in the dark.
//
// So this is the minimal intervention: evaluate the same occlusion the terrain
// evaluates, and gate the DIRECT light with it. Multiplying reflectedLight's direct
// terms after the light loop is exactly equivalent to attenuating the light,
// because this scene has exactly one direct light — the no-ambient/no-hemisphere
// decision documented in MoonGlobe is what makes this three-line patch sufficient.
// Indirect (the environment map) is left alone on purpose: it is the regolith
// bounce, and a shadowed lander really is still lit faintly by lit ground nearby.
// Emissive is untouched too, which is what keeps beacon lights alive in shadow.
// ---------------------------------------------------------------------------
export const HARDWARE_OCCLUSION_VERTEX_PATCHES: ShaderPatch[] =
  worldPosVertexPatches('vRegolithWorldPos')

export const HARDWARE_OCCLUSION_FRAGMENT_PATCHES: ShaderPatch[] = [
  {
    label: 'declare the skyline occlusion (hardware)',
    find: '#include <common>',
    insert: `#include <common>
uniform vec3 siteLight;
${REGOLITH_OCCLUSION_GLSL}`,
  },
  // Hardware UVs mean whatever the modeller meant by them, so its position in the
  // skyline field is reconstructed from the world, exactly as the roads do it.
  occlusionPatch('regolithPatchUv(vRegolithWorldPos)', 'vRegolithWorldPos'),
  {
    label: 'gate the direct sun on hardware with the skyline test',
    find: '#include <lights_fragment_end>',
    insert: `#include <lights_fragment_end>
reflectedLight.directDiffuse *= regolithDirectOcclusion;
reflectedLight.directSpecular *= regolithDirectOcclusion;
// The base's own floodlighting, standing in for lighting design we have not
// done. Faded in by exactly what the sun is faded out by, so it is IDENTICALLY
// ZERO wherever the sun reaches — which is everywhere at the design sun, making
// this term provably invisible in the shipped view — and full only inside a
// terrain shadow. Any surface facing any direction gets it, because a lot lit by
// a ring of masts genuinely is flat-lit; giving it a direction would mean
// choosing a fixture position per district, which is the design work this is
// deliberately not pretending to do.
//
// Added to indirect rather than direct so it cannot be re-gated by the skyline
// test it is derived from, and so the shadow map still shades hardware's own
// self-shadowed faces on top of it.
reflectedLight.indirectDiffuse += siteLight * (1.0 - regolithDirectOcclusion) * diffuseColor.rgb;`,
  },
]

export const TERRAIN_FRAGMENT_PATCHES: ShaderPatch[] = [
  regolithDeclarationsPatch(`uniform sampler2D terrainNormalMap;
uniform sampler2D detailSlopeMap;
uniform vec3 mapXDir;
`),
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
  vec3 up = normalize(vRegolithWorldPos);
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
  // vUv is the patch UV exactly, so the terrain never needs the reconstruction the
  // graded surfaces do.
  occlusionPatch('vUv', 'vRegolithWorldPos'),
  hapkeDirectPatch('lights_lambert_pars_fragment', 'LambertMaterial'),
  BOUNCE_FILL_PATCH,
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
          `no longer contains its anchor. See lib/lunar-atlas/regolithShader.ts.`
      )
    }
    out = next
  }
  return out
}
