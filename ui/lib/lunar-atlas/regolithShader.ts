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
import { M_TO_UNITS } from './southpole'

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
//
// THE HORIZON CLAMP IS NOT A FUDGE, and it is the line that stopped the far field
// going black, so it is worth being precise about what it fixes. A BRDF is defined
// for surfaces that face the eye. On a real surface that is automatic. Here the
// shading normal comes from a texture at the DEM's resolution while the silhouette
// comes from a 15.6 m mesh, so the normal is perfectly free to point behind a
// surface the mesh says is plainly visible — and at a grazing view most of a ridge
// flank does exactly that. Every one of those fragments used to leave the BRDF's
// domain and return zero, which put large terrain-shaped black areas across the
// distance. Tipping the normal back to just inside the horizon is the standard fix
// for a normal map that has left the visible hemisphere, and it is the honest one:
// what the eye can see there really is facets angled toward it, which is also what
// theta-bar goes on to describe statistically.
export function hapkeDirectPatch(parsChunk: string, materialStruct: string): ShaderPatch {
  return {
    label: `replace RE_Direct with Hapke (${materialStruct})`,
    find: `#include <${parsChunk}>`,
    insert: `#include <${parsChunk}>
#undef RE_Direct
void RE_Direct_Hapke( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ${materialStruct} material, inout ReflectedLight reflectedLight ) {
  // ~0.6 deg of clearance inside the horizon: enough to keep the emergence angle
  // inside the roughness model's domain, small enough that any normal which was
  // already valid is left exactly as it was.
  const float HORIZON_EPS = 0.01;
  vec3 n = geometryNormal;
  float nv = dot(n, geometryViewDir);
  if (nv < HORIZON_EPS) {
    n = normalize(n + geometryViewDir * (HORIZON_EPS - nv));
  }

  float mu0 = dot(n, directLight.direction);
  float mu = dot(n, geometryViewDir);
  float cosG = clamp(dot(directLight.direction, geometryViewDir), -1.0, 1.0);
  float r = hapkeReflectance(mu0, mu, cosG, acos(cosG), regolithThetaBar);
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

// ---------------------------------------------------------------------------
// Shadow lookups that are as sharp as the shadow map
//
// three looks a fragment up in the shadow map by its WORLD position, computed on
// the GPU as modelMatrix * position. This scene's world origin is the centre of the
// Moon and its unit is 868 km, so every position on the base is a float32 of
// magnitude 2 — and a float32 of magnitude 2 resolves 2.4e-7, which is 21 cm of
// ground. Every vertex therefore snaps to a 21 cm lattice before the shadow matrix
// ever sees it. Under the old 19.5 cm shadow texels that was hidden inside the
// blur; it is also why contact shadows never quite met the feet casting them, and
// why a 12 cm normal bias was needed to stop hardware striping itself.
//
// The fix is the usual one for a world this big: never form the big number. The
// model-view matrix is multiplied out on the CPU in doubles, so mvPosition is the
// vertex relative to the CAMERA, accurate to microns. Rotating it back into world
// axes — rotation only, no translation — gives a camera-relative world position
// that is just as accurate, and MoonGlobe's Sun appends the matching translation to
// the light's shadow matrix so that the product comes out identical in exact
// arithmetic. Same shadow, looked up with coordinates that can address it.
//
// Every material that RECEIVES the sun's shadow must carry this patch, because the
// matrix now expects camera-relative input: a material without it samples far
// outside the map and simply renders unshadowed.
// ---------------------------------------------------------------------------
export const PRECISE_SHADOW_VERTEX_PATCH: ShaderPatch = {
  label: 'camera-relative shadow coordinates',
  find: '#include <shadowmap_vertex>',
  insert: `#include <shadowmap_vertex>
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
{
  // v * M is transpose(M) * v, and the transpose of a rotation is its inverse.
  vec3 preciseShadowPos = ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;
  vec3 preciseShadowNormal = inverseTransformDirection( transformedNormal, viewMatrix );
  #pragma unroll_loop_start
  for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
    vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * vec4( preciseShadowPos + preciseShadowNormal * directionalLightShadows[ i ].shadowNormalBias, 1.0 );
  }
  #pragma unroll_loop_end
}
#endif`,
}

// ---------------------------------------------------------------------------
// Surface noise: one small tiling texture, three bands
//
// A render gives itself away by being CLEAN. Every real surface carries variation
// at every scale — soil is patchy, paint chalks and stains, sheet metal is never
// quite flat — and a material that is one colour and one roughness from edge to
// edge reads as plastic no matter how correct its BRDF is. This is the cheapest
// possible answer to that: one RGBA tile of band-limited noise (fine grain in R,
// blotches in G, slow cloud in B), sampled at a few scales by the ground and by the
// hardware. Generated in surfaceNoise.ts; bound as surfaceNoiseMap.
// ---------------------------------------------------------------------------

// Patchiness of the soil itself, as a multiplicative albedo factor centred on 1.
//
// Three scales, because the eye reads ground at three distances: grain underfoot
// (a 2.7 m tile), the mottling of a work site (28 m), and the broad tonal patches
// that keep a kilometre of plain from being one flat value (300 m). The repeats
// are deliberately not multiples of one another or of the slope octaves, so no two
// bands tile in step. Amplitudes are a few percent each — mature regolith is very
// uniform, and more than this starts to read as camouflage.
export const TERRAIN_ALBEDO_BANDS: [number, 'r' | 'g' | 'b', number][] = [
  [5900, 'g', 0.1],
  [570, 'b', 0.09],
  [53, 'b', 0.12],
]

const TERRAIN_ALBEDO_GLSL = `{
  float soil = 1.0;
${TERRAIN_ALBEDO_BANDS.map(
  ([repeat, ch, amp]) =>
    `  soil += (texture2D(surfaceNoiseMap, vUv * ${repeat.toFixed(1)}).${ch} - 0.5) * ${amp.toFixed(3)};`
).join('\n')}
  diffuseColor.rgb *= soil;
}`

// Hardware surface detail. Sampled in the mesh's OWN frame, scaled to metres, so
// the pattern is the same physical size on a rover and on a 50 m tank, rides along
// with anything that moves, and is addressed with small numbers (see the precision
// note on the shadow patch — a world position cannot resolve a paint chip).
// Triplanar, because hand-built primitives have no UVs worth the name.
const HW_UNITS_TO_M = (1 / M_TO_UNITS).toFixed(1)
// Tiles per metre for the two bands: a 0.7 m tile for grain and scuffing, and a
// 6 m one for staining and the slow unevenness of sheet metal.
const HW_FINE_PER_M = (1 / 0.7).toFixed(4)
const HW_BROAD_PER_M = (1 / 6).toFixed(4)

export const HARDWARE_SURFACE_VERTEX_PATCHES: ShaderPatch[] = [
  {
    label: 'declare the hardware detail varyings',
    find: '#include <common>',
    insert: `#include <common>
varying vec3 vHwDetailPos;
varying vec3 vHwDetailNormal;`,
  },
  {
    label: 'hardware detail coordinates, in metres in the mesh frame',
    find: '#include <begin_vertex>',
    insert: `#include <begin_vertex>
vHwDetailPos = transformed * vec3( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ), length( modelMatrix[ 2 ].xyz ) ) * ${HW_UNITS_TO_M};
vHwDetailNormal = objectNormal;`,
  },
  PRECISE_SHADOW_VERTEX_PATCH,
]

// What the detail does to a surface, and how much. All three are small on purpose:
// the aim is that no square metre of hardware is perfectly uniform, not that the
// hardware looks dirty — the dust pass in SurfaceAnchor is what makes it dirty.
//
//   albedo     ±6% in broad blotches, ±3% at hand scale. Chalking, handling,
//              uneven dust.
//   roughness  ±0.14. This is the one that matters most on anything shiny: a
//              highlight that slides across a panel without ever changing width
//              is the signature of a CG surface.
//   normal     a bump of half a millimetre over centimetres and a few millimetres
//              over metres. Sheet metal, blankets and composite skins are never
//              flat, and it is that slight waviness — oil-canning — that breaks a
//              reflection up into something that looks manufactured.
//
// The tile's finest band (R) is deliberately NOT used here. Stood next to a
// panel, its texels are a few millimetres across and magnify into visible
// squares; the blotch band is the finest thing that survives a close camera.
export const HARDWARE_SURFACE_FRAGMENT_PATCHES: ShaderPatch[] = [
  {
    label: 'declare the hardware detail sampler',
    find: '#include <common>',
    insert: `#include <common>
uniform sampler2D surfaceNoiseMap;
varying vec3 vHwDetailPos;
varying vec3 vHwDetailNormal;
vec4 hwTriplanar( vec3 p, vec3 w ) {
  return texture2D( surfaceNoiseMap, p.yz ) * w.x + texture2D( surfaceNoiseMap, p.zx ) * w.y + texture2D( surfaceNoiseMap, p.xy ) * w.z;
}
// Bump from a height's screen-space derivatives (Mikkelsen), written out because
// three only compiles its own copy in when a bumpMap is bound.
vec3 hwBump( vec3 viewPos, vec3 n, float h ) {
  vec3 sx = dFdx( viewPos );
  vec3 sy = dFdy( viewPos );
  vec3 r1 = cross( sy, n );
  vec3 r2 = cross( n, sx );
  float det = dot( sx, r1 );
  vec3 grad = sign( det ) * ( dFdx( h ) * r1 + dFdy( h ) * r2 );
  return normalize( abs( det ) * n - grad );
}`,
  },
  {
    label: 'hardware albedo variation',
    find: '#include <color_fragment>',
    insert: `#include <color_fragment>
vec3 hwWeights = pow( abs( normalize( vHwDetailNormal ) ), vec3( 4.0 ) );
hwWeights /= hwWeights.x + hwWeights.y + hwWeights.z;
vec4 hwFine = hwTriplanar( vHwDetailPos * ${HW_FINE_PER_M}, hwWeights );
vec4 hwBroad = hwTriplanar( vHwDetailPos * ${HW_BROAD_PER_M}, hwWeights );
diffuseColor.rgb *= 1.0 + ( hwBroad.g - 0.5 ) * 0.12 + ( hwFine.g - 0.5 ) * 0.06;`,
  },
  {
    label: 'hardware roughness variation',
    find: '#include <roughnessmap_fragment>',
    insert: `#include <roughnessmap_fragment>
roughnessFactor = clamp( roughnessFactor + ( hwBroad.b - 0.5 ) * 0.2 + ( hwFine.b - 0.5 ) * 0.08, 0.045, 1.0 );`,
  },
  {
    label: 'hardware micro relief',
    find: '#include <normal_fragment_maps>',
    insert: `#include <normal_fragment_maps>
normal = hwBump( - vViewPosition, normal, ( ( hwFine.g - 0.5 ) * 0.0012 + ( hwBroad.b - 0.5 ) * 0.012 ) * ${M_TO_UNITS.toExponential(8)} );`,
  },
]

// Lit materials that are not Standard or Physical (the odd Lambert or Phong part)
// still stand under the same sun and must look the shadow up the same way.
export const HARDWARE_SHADOW_ONLY_VERTEX_PATCHES: ShaderPatch[] = [PRECISE_SHADOW_VERTEX_PATCH]

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
// eyeballed. The tile's own height field measures an RMS gradient of 0.53 (its
// heights are in pixel units, so that is already dimensionless), and mature lunar
// regolith runs about 0.26-0.34 RMS at meter scale — 15° to 19°. The octaves are
// weighted nearly evenly and scaled to sum, in quadrature, to 0.31; a unit test
// re-measures the tile and holds the sum in that range, so a change to the crater
// population cannot quietly flatten or roughen the ground.
//
// The first version of these was 0.1 / 0.1 / 0.07 / 0.05, which summed to an RMS
// slope of 0.128 — 7°, less than half of real ground. That is what made the near
// field read as smooth plaster: the DEM genuinely has no information below ~10 m
// (LOLA's grids are interpolated from sparse tracks), so if this tile is too
// shallow there is nothing else to supply foreground texture.
//
// The fifth octave is the ground at arm's length: a 62 cm tile, so its pits and
// clods run from a few millimetres to a few centimetres. Without it the finest
// relief on the Moon was 10 cm across, and a camera standing at walking height
// saw smooth putty between the craterlets — where every surface photograph shows
// a soil that is gritty all the way down to the grain of the film.
export const DETAIL_OCTAVES: [number, number][] = [
  [60, 0.28],
  [250, 0.28],
  [800, 0.24],
  [6400, 0.26],
  [25600, 0.24],
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
export const TERRAIN_VERTEX_PATCHES: ShaderPatch[] = [
  ...worldPosVertexPatches('vRegolithWorldPos'),
  PRECISE_SHADOW_VERTEX_PATCH,
]

// The graded surfaces need the same world position, for the same skyline lookup.
export const GRADED_SURFACE_VERTEX_PATCHES: ShaderPatch[] = [
  ...worldPosVertexPatches('vRegolithWorldPos'),
  PRECISE_SHADOW_VERTEX_PATCH,
]

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
uniform sampler2D terrainSlopeSqMap;
uniform sampler2D detailSlopeMap;
uniform sampler2D surfaceNoiseMap;
uniform vec3 mapXDir;
`),
  {
    label: 'soil patchiness and rim fade',
    find: '#include <color_fragment>',
    insert: `#include <color_fragment>\n${TERRAIN_ALBEDO_GLSL}\n${RIM_FADE_GLSL}`,
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

  // Slope variance this pixel's normal did NOT carry, accumulated as we go.
  //
  // Every lookup below is a filtered MEAN over the pixel's footprint, so the
  // relief inside the footprint has been averaged out of it — that is what makes
  // distant ground smooth, and it is why the far field had no roughness left to
  // keep it off the BRDF's domain edge. The companion textures hold the MEAN
  // SQUARE of the same field, which mips alongside it, so E[|s|^2] - |E[s]|^2 is
  // the variance that went missing, exactly, at whatever mip the GPU chose. It
  // goes to theta-bar and gets modelled instead of drawn.
  //
  // The base term treats the filtered NORMAL as though it were the filtered
  // GRADIENT, which it is not quite (normalizing and averaging do not commute).
  // The two differ by a few percent at DEM slopes and the result is a roughness
  // angle, so it is well under the spread of the fits theta-bar comes from.
  float lostVariance = max(texture2D(terrainSlopeSqMap, vUv).r - dot(grad, grad), 0.0);
${DETAIL_OCTAVES.map(
  ([repeat, amp]) => {
    const a = amp.toFixed(4)
    return `  {
    vec4 d = texture2D(detailSlopeMap, vUv * ${repeat.toFixed(1)});
    grad += d.xy * ${a};
    lostVariance += ${a} * ${a} * max(d.z - dot(d.xy, d.xy), 0.0);
  }`
  }
).join('\n')}

  regolithThetaBar = regolithResidualRoughness(lostVariance);

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
