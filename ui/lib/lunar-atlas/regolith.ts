// How lunar regolith actually scatters light.
//
// Regolith is the least Lambertian common surface in the solar system, and the
// difference is not subtle: it is why a full moon is more than twice as bright
// as a half moon rather than exactly twice, and why the full moon reads as a
// flat disc instead of a shaded ball. Two terms carry almost all of that.
//
// SHADOW HIDING (the opposition surge). Regolith is a deep, open, porous pile
// of grains, so it is full of tiny shadows. Every one of those shadows is
// hidden behind the grain that casts it, which means that as the viewer moves
// toward the light, the shadows disappear behind their own grains and the
// surface brightens sharply. At exact opposition none of them are visible at
// all. Hapke's approximation is B(g) = 1 + B0 / (1 + tan(g/2)/h), where g is
// the phase angle (sun-surface-viewer) and B0/h are the amplitude and angular
// width of the surge. This is a VIEW-DEPENDENT term, which is precisely why a
// baked hillshade could never contain it — a bake has no viewer — and one of the
// reasons the terrain stopped being one.
//
// LOMMEL-SEELIGER (no limb darkening). A single-scattering, semi-infinite
// particulate layer reflects mu0/(mu0+mu) rather than Lambert's mu0, so it
// brightens toward grazing view angles by exactly enough to cancel the
// foreshortening that darkens a Lambertian limb. On the ground it is why the
// lunar horizon reads as a bright band rather than fading off.
//
// Both are now applied to the terrain, through the full Hapke BRDF at the
// bottom of this file. That is a reversal of what this comment used to say,
// and the reason is worth recording because it looks like a contradiction.
//
// The old objection was that Lommel-Seeliger "diverges as the view goes
// grazing", which is true of the shape it takes as a CORRECTION FACTOR applied
// on top of an existing Lambertian bake: dividing a Lambert lobe by (mu0+mu)
// leaves a 1/(mu0+mu) that runs away as both cosines go to zero, and grazing
// is where this scene's camera lives. But that divergence is an artifact of
// the factorization, not of the physics. In the real BRDF the term appears as
// mu0/(mu0+mu), which is bounded above by 1 for every geometry there is — it
// cannot exceed unity no matter how grazing the view gets. Evaluating the BRDF
// directly instead of patching a bake therefore gets the bright horizon band
// for free and cannot blow out.

// Normal albedo of south-polar highland regolith. The Moon is a genuinely dark
// object — closer to worn asphalt than to the white it reads as against a black
// sky — and getting this wrong is what makes a lunar render look like plaster.
export const REGOLITH_ALBEDO = 0.12

// Hapke shadow-hiding parameters. Near the published lunar fits (Helfenstein &
// Veverka put B0 around 1.0 and h around 0.07 for both mare and highland
// units); B0 is pulled a little under 1 because some of the real surge is
// coherent backscatter, which this single term is not trying to model.
export const OPPOSITION_B0 = 0.9
export const OPPOSITION_H = 0.07

// Phase angle, in degrees, at which the surge is defined to be neutral.
//
// The surge multiplies brightness by between 1.0 and 1.9 and is never less
// than 1, so applying it raw would brighten the entire terrain and throw away
// the exposure this scene is already tuned around. Normalizing at a reference
// angle makes it a RELATIVE effect: the ground brightens where the surge is
// stronger than the reference and dims where it is weaker, with the reference
// framing left exactly as it was.
//
// 85° is not a taste call. Sampled across the home framing — ridge centre, both
// ends of the spine, the near and far edges of the colony — the phase angle
// runs 68° to 99° with a mean of 84.7°, so the load-in shot is left untouched
// to within 2% and the surge only shows up once the user tumbles the camera
// down-sun, which is the one place it belongs.
export const PHASE_REF_DEG = 85

// B(g) with g in radians.
export function oppositionSurge(gRad: number): number {
  return 1 + OPPOSITION_B0 / (1 + Math.tan(0.5 * gRad) / OPPOSITION_H)
}

// B(g) normalized to 1 at PHASE_REF_DEG — what a renderer should actually
// multiply by. Runs from 1.79 at exact opposition down to 0.94 looking
// straight into the sun.
export function normalizedSurge(gRad: number): number {
  return oppositionSurge(gRad) / oppositionSurge((PHASE_REF_DEG * Math.PI) / 180)
}

// ---------------------------------------------------------------------------
// The full Hapke BRDF
//
// Everything above is one term of a scattering law; this is the law. It is what
// the terrain is shaded with now that shading is computed per pixel rather than
// baked, and it is deliberately the textbook form rather than a lookalike:
//
//   r(mu0, mu, g) = w/(4 pi) * mu0/(mu0 + mu)
//                   * [ (1 + B(g)) p(g) + H(mu0) H(mu) - 1 ]
//
// with mu0 = cos(incidence), mu = cos(emergence), g = phase angle. Term by
// term: w/(4 pi) is the scattering strength, mu0/(mu0 + mu) is Lommel-Seeliger,
// (1 + B(g)) is the opposition surge already defined above, p(g) is the
// single-particle phase function, and H(mu0)H(mu) - 1 is Hapke's isotropic
// multiple-scattering correction (the "- 1" removes the single-scattering part
// that p(g) already counted).
//
// Macroscopic roughness (Hapke's theta-bar) IS modelled, below. This file used
// to say it was not, on the grounds that its main visible effect — darkening at
// high phase — was small next to the two terms above. That was true as far as it
// went and it missed the thing that actually mattered.
//
// A BRDF with no roughness term has a hard domain edge: it is defined for
// surfaces that face the eye and undefined for surfaces that do not, so the code
// returned zero at mu <= 0. For a real surface that edge is unreachable, because
// anything you can see faces you. It is very reachable here, because the normal
// that gets lit is sampled from a TEXTURE and the silhouette comes from a much
// coarser mesh, so the two disagree freely. Looking along a ridge 5 km out from
// 300 m up, the sightline sits ~3.4 deg above the ground; every patch tilted more
// than that away from the eye — which on a 10-20 deg ridge flank is most of it —
// fell off the edge and dropped to the 6% bounce fill in one pixel. It rendered
// as large black areas with terrain-shaped borders, all over the far field.
//
// Roughness is the term that removes the edge, and it removes it by describing
// what is physically there rather than by clamping. Below the scale the normal
// resolves, the ground is a distribution of tilted facets; at a grazing view you
// see the ones tilted toward you, and they are lit. Hapke's 1984 correction is
// the bookkeeping for exactly that: it replaces the cosines with EFFECTIVE
// cosines averaged over the visible, illuminated facets, and multiplies by a
// shadowing function S for the ones hidden behind each other. mu_e stays strictly
// positive all the way to a 90 deg emergence, so grazing terrain lands on a
// roughness floor instead of falling off a cliff.
//
// Two things come free with it, both of which were separately wrong before:
//   - The TERMINATOR stops being a step. S goes to zero as the incidence angle
//     approaches 90 deg, so the sunset line fades over a few degrees the way a
//     rough surface actually does, rather than switching off.
//   - The scene stops needing the mu <= 0 guard to mean anything physical. It is
//     still there, but it is now a domain assertion rather than the thing
//     deciding what half the far field looks like.
//
// The GLSL mirror of this lives in HAPKE_GLSL at the bottom. It exists so the
// shader and these functions are read as one thing; if you change one, change
// the other, and the tests that pin the TypeScript are the specification.
// ---------------------------------------------------------------------------

// Single-particle phase function asymmetry, single-term Henyey-Greenstein.
//
// NEGATIVE means backscattering under the convention used by hgPhase below, and
// regolith is strongly backscattering — this is the second reason (after the
// opposition surge) that a full moon is so much brighter than a half moon.
// -0.29 sits in the middle of the published lunar range.
export const HG_ASYMMETRY = -0.29

// Single-scattering albedo: the probability that a photon hitting one grain
// survives it. This is NOT the same quantity as REGOLITH_ALBEDO, which is the
// normal albedo of the whole surface — a bulk optical property that emerges
// from w after single and multiple scattering are summed over the layer.
//
// So it is not independently dialled. It is the w that makes the BRDF above
// reproduce REGOLITH_ALBEDO exactly at normal incidence and zero phase, solved
// numerically; `hapkeNormalAlbedo` recovers 0.12 from it and a test asserts
// that round trip. Change REGOLITH_ALBEDO and this must be re-solved, which is
// what that test is there to catch.
//
// And change MACRO_ROUGHNESS_DEG and it must be re-solved too, which is what it
// was for the roughness term: straight down at zero phase the shadowing function
// is exactly 1, but both effective cosines come back as chi rather than 1, so the
// multiple-scattering term drops a little and w has to rise to compensate. It
// moved from 0.191559 to 0.191923 — 0.2%, which is small precisely because the
// calibration geometry is the one place roughness does almost nothing.
export const SINGLE_SCATTERING_ALBEDO = 0.191923

// Single-term Henyey-Greenstein, in the planetary-photometry convention where
// g is the PHASE angle (0 = looking straight down-sun, at full moon) and a
// negative asymmetry parameter backscatters.
export function hgPhase(gRad: number, xi = HG_ASYMMETRY): number {
  const d = 1 + 2 * xi * Math.cos(gRad) + xi * xi
  return (1 - xi * xi) / (d * Math.sqrt(d))
}

// Hapke's analytic approximation to Chandrasekhar's H-function, which is what
// carries multiple scattering between grains. Exact to about a percent, and one
// square root instead of an integral equation.
export function chandrasekharH(mu: number, w = SINGLE_SCATTERING_ALBEDO): number {
  return (1 + 2 * mu) / (1 + 2 * mu * Math.sqrt(1 - w))
}

// ---------------------------------------------------------------------------
// Macroscopic roughness (Hapke 1984)
//
// theta-bar is the mean slope angle of the facets BELOW the scale the shading
// normal resolves. It is not a texture and not a fudge: given it, the model
// integrates over which facets a given (sun, eye) pair can see and light, and
// returns three numbers — an effective incidence cosine, an effective emergence
// cosine, and the fraction S of the surface that is neither self-shadowed nor
// self-masked. Feed those to the BRDF in place of the raw cosines.
//
// The equations are the textbook ones (Hapke, Theory of Reflectance and
// Emittance Spectroscopy, 2nd ed., eqs. 12.45-12.55), transcribed rather than
// re-derived, because a lookalike here is worth about a factor of two at the
// grazing geometry this scene lives at.
// ---------------------------------------------------------------------------

// Mean slope angle of lunar regolith at the scale where NOTHING below a
// kilometre is resolved — the value photometric fits to disc-resolved imagery
// return, since from lunar orbit every crater under a pixel is "roughness".
// Helfenstein & Veverka (1987) and Hapke's own lunar fits both land near 20 deg.
//
// This is the value for a surface whose relief is not DRAWN, which is every
// regolith material in this scene except the terrain: roads, spoil, rubble. The
// terrain is the exception because it draws most of that 20 deg explicitly, and
// roughness that is drawn must not also be modelled or the ground is rough twice.
// What the terrain gets per pixel is residualRoughness, below.
export const MACRO_ROUGHNESS_DEG = 20
export const MACRO_ROUGHNESS_RAD = (MACRO_ROUGHNESS_DEG * Math.PI) / 180

// The floor under residualRoughness: roughness below the finest thing any map in
// this scene reaches, which is a few millimetres of soil at the near plane.
//
// Small, and it has to be small, because the scene's explicit relief has already
// spent the whole lunar budget. Measured: the DEM's own 10 m posts run an RMS
// slope of 0.248 over the patch and the four detail octaves add 0.30, which in
// quadrature is 0.389 — tan(21.3 deg), already a shade past the published 20 deg
// this ridge is rougher than average for. So there is no room here for a large
// number, and a test pins that sum.
//
// Its real job is not photometric anyway, it is that THETA-BAR MUST NEVER BE
// ZERO. At zero the correction collapses to the identity, mu_e goes back to being
// the raw cosine, and the grazing cliff this whole module exists to remove comes
// straight back on near ground where every octave is resolved.
export const MICRO_ROUGHNESS_DEG = 5
export const MICRO_ROUGHNESS_RAD = (MICRO_ROUGHNESS_DEG * Math.PI) / 180

// Angles are held off 0 and 90 deg because both ends of the range put a cotangent
// through the roof. The clamp is a ten-thousandth of a radian — a thousandth of a
// degree — which is four orders of magnitude finer than anything this model
// resolves, so it costs nothing and keeps exp(-inf) and inf/inf out of the GPU.
const ANGLE_EPS = 1e-4

// theta-bar for one pixel, given the slope variance its normal FAILED to carry.
//
// The whole scheme in one line: roughness the texture describes is drawn, and
// roughness the texture lost to mip filtering is modelled, so the total stays put
// as the camera pulls back. Up close, where every octave is resolved, `lost` is
// near zero and this returns the millimetre floor; at 5 km, where the detail tile
// has averaged to a flat grey and the DEM is not far behind it, `lost` is nearly
// the whole variance of both and this climbs to 21.7 deg — which is the published
// lunar figure, arrived at from the other end.
//
// Getting this wrong in either direction has a visible cost, which is why it is
// not just set to 20 deg everywhere. Too low in the far field and the grazing
// cliff comes back, because there is nothing left to keep mu_e off zero. Too high
// in the near field and the craterlets the detail octaves exist to draw get a
// statistical haze laid over the top of them, washing out exactly the contrast
// they were added for.
//
// tan(theta-bar) is taken as the RMS slope. For a Gaussian facet distribution the
// two agree to better than 10% over this range, which is inside the spread of the
// published lunar fits and far inside what anyone can see.
export function residualRoughness(lostSlopeVariance: number): number {
  const floor = Math.tan(MICRO_ROUGHNESS_RAD)
  return Math.atan(Math.sqrt(floor * floor + Math.max(0, lostSlopeVariance)))
}

// Azimuth between the plane of incidence and the plane of emergence, recovered
// from the three angles a renderer actually has. Undefined when either ray is
// along the normal — the two planes coincide — and zero is the right answer
// there, since every psi-weighted term below is multiplied by a sine that has
// already vanished.
export function azimuthFromPhase(mu0: number, mu: number, gRad: number): number {
  const sinI = Math.sqrt(Math.max(0, 1 - mu0 * mu0))
  const sinE = Math.sqrt(Math.max(0, 1 - mu * mu))
  const denom = sinI * sinE
  if (denom < 1e-6) return 0
  return Math.acos(Math.max(-1, Math.min(1, (Math.cos(gRad) - mu0 * mu) / denom)))
}

export type RoughGeometry = {
  // Effective cosines: the incidence and emergence cosines averaged over the
  // facets that are actually visible and actually lit. Both strictly positive
  // for any i and e below 90 deg, which is the property the far field needs.
  mu0e: number
  mue: number
  // Fraction of the surface that is neither shadowed nor masked. Goes to zero at
  // the terminator, which is what makes it smooth.
  shadow: number
}

// Hapke's roughness correction. i, e and psi in radians.
export function hapkeRoughness(
  iRad: number,
  eRad: number,
  psiRad: number,
  thetaBarRad: number
): RoughGeometry {
  if (thetaBarRad <= 0) {
    return { mu0e: Math.cos(iRad), mue: Math.cos(eRad), shadow: 1 }
  }

  const lim = (x: number) => Math.min(Math.max(x, ANGLE_EPS), Math.PI / 2 - ANGLE_EPS)
  const i = lim(iRad)
  const e = lim(eRad)
  const psi = Math.min(Math.max(psiRad, 0), Math.PI)

  const t = Math.tan(thetaBarRad)
  const chi = 1 / Math.sqrt(1 + Math.PI * t * t)
  const cotT = 1 / t

  const cot = (x: number) => 1 / Math.tan(x)
  const e1 = (x: number) => Math.exp((-2 / Math.PI) * cotT * cot(x))
  const e2 = (x: number) => Math.exp((-1 / Math.PI) * cotT * cotT * cot(x) * cot(x))
  // The effective cosine a facet distribution presents when the other ray is
  // along the normal. It is what S divides by, so that a smooth surface — where
  // eta collapses to the plain cosine — leaves S exactly 1.
  const eta = (x: number) => chi * (Math.cos(x) + Math.sin(x) * t * (e2(x) / (2 - e1(x))))

  const mu0 = Math.cos(i)
  const mu = Math.cos(e)
  const cosPsi = Math.cos(psi)
  const halfPsiSq = Math.sin(psi / 2) ** 2
  // Weights the mutual-shadowing term by how far the two rays are out of plane:
  // 1 when they share a plane and 0 when they oppose, where a facet lit on one
  // side and viewed from the other cannot be both.
  const f = Math.exp(-2 * Math.tan(Math.min(psi / 2, Math.PI / 2 - ANGLE_EPS)))

  const etaI = eta(i)
  const etaE = eta(e)

  let mu0e: number
  let mue: number
  let shadow: number

  // The two branches are the same algebra with the roles of the rays swapped:
  // whichever of the two is closer to grazing is the one whose facets do the
  // occluding, so it is the one whose E-functions carry the leading term.
  if (e >= i) {
    const d = 2 - e1(e) - (psi / Math.PI) * e1(i)
    mu0e = chi * (mu0 + Math.sin(i) * t * ((cosPsi * e2(e) + halfPsiSq * e2(i)) / d))
    mue = chi * (mu + Math.sin(e) * t * ((e2(e) - halfPsiSq * e2(i)) / d))
    shadow = ((mue / etaE) * (mu0 / etaI) * chi) / (1 - f + f * chi * (mu0 / etaI))
  } else {
    const d = 2 - e1(i) - (psi / Math.PI) * e1(e)
    mu0e = chi * (mu0 + Math.sin(i) * t * ((e2(i) - halfPsiSq * e2(e)) / d))
    mue = chi * (mu + Math.sin(e) * t * ((cosPsi * e2(i) + halfPsiSq * e2(e)) / d))
    shadow = ((mue / etaE) * (mu0 / etaI) * chi) / (1 - f + f * chi * (mu / etaE))
  }

  // S is the fraction of the surface that is neither shadowed nor masked, so it
  // cannot exceed 1. The analytic form above is a fit to an integral rather than
  // the integral, and it overshoots by up to ~3% as the emergence angle closes on
  // 90 deg; capping it is the cheapest way to keep a FRACTION from being greater
  // than one. The cap is a genuine no-op everywhere it should be — at psi = 0 with
  // e >= i the expression is identically 1, which is also the case that says
  // "everything the eye can see from here is lit", and a test pins it.
  return { mu0e: Math.max(mu0e, 1e-6), mue: Math.max(mue, 1e-6), shadow: Math.min(shadow, 1) }
}

// Bidirectional reflectance, per steradian. Multiply by the irradiance measured
// PERPENDICULAR TO THE BEAM (not by the irradiance on the surface) to get
// radiance: the cosine falloff is already inside, carried by mu0/(mu0 + mu).
//
// Returns 0 for geometry facing away from the sun or away from the eye. That
// guard is now a statement about the model's DOMAIN rather than a description of
// the terminator: roughness already takes the lit side smoothly to zero as the
// incidence angle approaches 90 deg, so a caller that reaches mu0 <= 0 is asking
// about the far side of a surface, and a caller that reaches mu <= 0 is holding a
// shading normal that disagrees with its own silhouette. The second is a real
// situation in a normal-mapped renderer, and it is the CALLER's job to clamp its
// normal into the visible hemisphere first — see hapkeDirectPatch.
export function hapkeReflectance(
  mu0: number,
  mu: number,
  gRad: number,
  w = SINGLE_SCATTERING_ALBEDO,
  thetaBarRad = MACRO_ROUGHNESS_RAD
): number {
  if (mu0 <= 0 || mu <= 0) return 0
  const { mu0e, mue, shadow } = hapkeRoughness(
    Math.acos(Math.min(1, mu0)),
    Math.acos(Math.min(1, mu)),
    azimuthFromPhase(mu0, mu, gRad),
    thetaBarRad
  )
  const multi = chandrasekharH(mu0e, w) * chandrasekharH(mue, w) - 1
  const single = oppositionSurge(gRad) * hgPhase(gRad)
  return (w / (4 * Math.PI)) * (mu0e / (mu0e + mue)) * (single + multi) * shadow
}

// Normal albedo the BRDF actually produces: the radiance factor (I/F) straight
// down onto flat ground at zero phase, which is pi * r / mu0 at mu0 = mu = 1.
// This is the bridge between w and REGOLITH_ALBEDO, and the reason w is not a
// free parameter.
export function hapkeNormalAlbedo(w = SINGLE_SCATTERING_ALBEDO): number {
  return Math.PI * hapkeReflectance(1, 1, 0, w)
}

// ---------------------------------------------------------------------------
// Derived scene radiances
//
// Functions of the sun rather than constants, for two reasons. It keeps this
// module free of scene imports, so the BRDF stays independently testable; and it
// is what a moving sun will need, since both quantities scale with elevation.
// ---------------------------------------------------------------------------

// Radiance of flat sunlit ground, viewed head-on, at a given sun elevation.
//
// The one thing to know about this function is that it is roughly a QUARTER of
// what the Lambertian shorthand albedo * E / pi gives at this scene's phase
// angles. That is not a small discrepancy to absorb silently: anything derived as
// "about as bright as the ground" and built on the Lambertian form comes out 4x
// too bright, which has now happened three times in this codebase — in the
// environment map, in the shadow fill below, and in the graded road surfaces. Use
// this, not the shorthand.
export function litGroundRadiance(
  sunIntensity: number,
  sunElevDeg: number,
  phaseDeg = PHASE_REF_DEG
): number {
  const mu0 = Math.sin((sunElevDeg * Math.PI) / 180)
  return sunIntensity * hapkeReflectance(mu0, 1, (phaseDeg * Math.PI) / 180)
}

// The light left in a lunar shadow, as radiance.
//
// There is no atmosphere, so nothing fills a shadow except sunlight that already
// bounced off regolith nearby: the ground's own radiance, times the fraction of
// its sky that is filled by lit ground, times its own albedo on the way back out.
// It lands near 6% of the lit ground.
//
// skyFraction is the crude part, and deliberately the only crude part — a single
// number standing in for how much lit ground a point can actually see. Phase 2
// replaces it with real per-texel sky visibility from a horizon map. Until then
// every shadow is equally deep, which is too bright in narrow crevices and too
// dark under overhangs.
export function shadowFillRadiance(litRadiance: number, skyFraction = 0.5): number {
  return litRadiance * REGOLITH_ALBEDO * skyFraction
}

// The same law as GLSL, for the terrain shader. Kept as a string beside the
// TypeScript rather than in the component so there is exactly one place to look
// when the two are compared, and so the constants below cannot drift from the
// exported ones — they are interpolated from them.
export const HAPKE_GLSL = /* glsl */ `
  const float HAPKE_W = ${SINGLE_SCATTERING_ALBEDO};
  const float HAPKE_XI = ${HG_ASYMMETRY};
  const float HAPKE_B0 = ${OPPOSITION_B0};
  const float HAPKE_H = ${OPPOSITION_H};
  const float HAPKE_GAMMA = ${Math.sqrt(1 - SINGLE_SCATTERING_ALBEDO)};
  const float HAPKE_ANGLE_EPS = ${ANGLE_EPS};
  const float HAPKE_MACRO_ROUGHNESS = ${MACRO_ROUGHNESS_RAD};
  const float HAPKE_MICRO_TAN = ${Math.tan(MICRO_ROUGHNESS_RAD)};

  // Mean facet slope below the scale this fragment's normal resolves.
  //
  // A global with a default rather than a parameter, for the same reason
  // regolithDirectOcclusion is one: every regolith material has to be able to take
  // the BRDF without also taking the terrain's normal machinery. The default is the
  // fully-unresolved lunar value, which is the right answer for any surface whose
  // sub-metre relief is not drawn — i.e. everything except the terrain, which
  // overwrites this per pixel.
  float regolithThetaBar = HAPKE_MACRO_ROUGHNESS;

  float hgPhase(float cosG) {
    float d = 1.0 + 2.0 * HAPKE_XI * cosG + HAPKE_XI * HAPKE_XI;
    return (1.0 - HAPKE_XI * HAPKE_XI) / (d * sqrt(max(d, 1e-6)));
  }

  float chandrasekharH(float mu) {
    return (1.0 + 2.0 * mu) / (1.0 + 2.0 * mu * HAPKE_GAMMA);
  }

  // theta-bar from the slope variance the shading normal failed to carry. Mirrors
  // residualRoughness in regolith.ts; see there for why the total is a budget.
  float regolithResidualRoughness(float lostSlopeVariance) {
    return atan(sqrt(HAPKE_MICRO_TAN * HAPKE_MICRO_TAN + max(0.0, lostSlopeVariance)));
  }

  // Hapke's macroscopic roughness correction, eqs. 12.45-12.55. Returns the
  // effective cosines and the shadowing/masking fraction. See regolith.ts for what
  // each piece is; this is a transcription of the same equations and the unit tests
  // pin the TypeScript as the specification for both.
  void hapkeRoughness(
    float iRad, float eRad, float psi, float thetaBar,
    out float mu0e, out float mue, out float s
  ) {
    float i = clamp(iRad, HAPKE_ANGLE_EPS, ${Math.PI / 2} - HAPKE_ANGLE_EPS);
    float e = clamp(eRad, HAPKE_ANGLE_EPS, ${Math.PI / 2} - HAPKE_ANGLE_EPS);
    psi = clamp(psi, 0.0, ${Math.PI});

    float t = tan(thetaBar);
    float chi = inversesqrt(1.0 + ${Math.PI} * t * t);
    float cotT = 1.0 / t;

    float ci = cotT / tan(i);
    float ce = cotT / tan(e);
    float e1i = exp(${-2 / Math.PI} * ci);
    float e1e = exp(${-2 / Math.PI} * ce);
    float e2i = exp(${-1 / Math.PI} * ci * ci);
    float e2e = exp(${-1 / Math.PI} * ce * ce);

    float mu0 = cos(i);
    float mu = cos(e);
    float etaI = chi * (mu0 + sin(i) * t * (e2i / (2.0 - e1i)));
    float etaE = chi * (mu + sin(e) * t * (e2e / (2.0 - e1e)));

    float cosPsi = cos(psi);
    float halfPsiSq = sin(0.5 * psi) * sin(0.5 * psi);
    float f = exp(-2.0 * tan(min(0.5 * psi, ${Math.PI / 2} - HAPKE_ANGLE_EPS)));

    if (e >= i) {
      float d = 2.0 - e1e - (psi * ${1 / Math.PI}) * e1i;
      mu0e = chi * (mu0 + sin(i) * t * ((cosPsi * e2e + halfPsiSq * e2i) / d));
      mue = chi * (mu + sin(e) * t * ((e2e - halfPsiSq * e2i) / d));
      s = (mue / etaE) * (mu0 / etaI) * chi / (1.0 - f + f * chi * (mu0 / etaI));
    } else {
      float d = 2.0 - e1i - (psi * ${1 / Math.PI}) * e1e;
      mu0e = chi * (mu0 + sin(i) * t * ((e2i - halfPsiSq * e2e) / d));
      mue = chi * (mu + sin(e) * t * ((cosPsi * e2i + halfPsiSq * e2e) / d));
      s = (mue / etaE) * (mu0 / etaI) * chi / (1.0 - f + f * chi * (mu / etaE));
    }

    mu0e = max(mu0e, 1e-6);
    mue = max(mue, 1e-6);
    // A fraction of the surface cannot exceed 1; see hapkeRoughness in regolith.ts.
    s = min(s, 1.0);
  }

  // cosG is dot(toSun, toEye); gRad is passed in too because the surge needs
  // tan(g/2) and recovering it from the cosine costs an acos anyway.
  float hapkeReflectance(float mu0, float mu, float cosG, float gRad, float thetaBar) {
    if (mu0 <= 0.0 || mu <= 0.0) return 0.0;

    // Azimuth between the planes of incidence and emergence. Zero when either ray
    // is along the normal, where the two planes coincide and every term it weights
    // has already been multiplied by a vanishing sine.
    float sinI = sqrt(max(0.0, 1.0 - mu0 * mu0));
    float sinE = sqrt(max(0.0, 1.0 - mu * mu));
    float denom = sinI * sinE;
    float psi = denom < 1e-6
      ? 0.0
      : acos(clamp((cos(gRad) - mu0 * mu) / denom, -1.0, 1.0));

    float mu0e, mue, s;
    hapkeRoughness(acos(min(mu0, 1.0)), acos(min(mu, 1.0)), psi, thetaBar, mu0e, mue, s);

    // Held off exact opposition, where tan(g/2) overflows. The surge is
    // asymptotically 1 there anyway, so the clamp costs nothing visible and
    // keeps drivers that turn inf into NaN from punching black pixels.
    float surge = 1.0 + HAPKE_B0 / (1.0 + tan(0.5 * min(gRad, 3.14)) / HAPKE_H);
    float multi = chandrasekharH(mu0e) * chandrasekharH(mue) - 1.0;
    return (HAPKE_W / (4.0 * ${Math.PI})) * (mu0e / (mu0e + mue))
      * (surge * hgPhase(cosG) + multi) * s;
  }
`
