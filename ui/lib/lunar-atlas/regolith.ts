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
// Macroscopic roughness (Hapke's theta-bar) is NOT modelled. On a real polar
// slope it matters, but it costs a shadowing/tilt integral per pixel and its
// main visible effect — darkening at high phase — is small next to the two
// terms that are here. Worth revisiting only if the render is ever compared to
// photometry rather than to imagery.
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
export const SINGLE_SCATTERING_ALBEDO = 0.191559

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

// Bidirectional reflectance, per steradian. Multiply by the irradiance measured
// PERPENDICULAR TO THE BEAM (not by the irradiance on the surface) to get
// radiance: the cosine falloff is already inside, carried by mu0/(mu0 + mu).
//
// Returns 0 for geometry facing away from the sun or away from the eye, so
// callers do not have to guard the terminator themselves.
export function hapkeReflectance(
  mu0: number,
  mu: number,
  gRad: number,
  w = SINGLE_SCATTERING_ALBEDO
): number {
  if (mu0 <= 0 || mu <= 0) return 0
  const multi = chandrasekharH(mu0, w) * chandrasekharH(mu, w) - 1
  const single = oppositionSurge(gRad) * hgPhase(gRad)
  return ((w / (4 * Math.PI)) * (mu0 / (mu0 + mu)) * (single + multi))
}

// Normal albedo the BRDF actually produces: the radiance factor (I/F) straight
// down onto flat ground at zero phase, which is pi * r / mu0 at mu0 = mu = 1.
// This is the bridge between w and REGOLITH_ALBEDO, and the reason w is not a
// free parameter.
export function hapkeNormalAlbedo(w = SINGLE_SCATTERING_ALBEDO): number {
  return Math.PI * hapkeReflectance(1, 1, 0, w)
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

  float hgPhase(float cosG) {
    float d = 1.0 + 2.0 * HAPKE_XI * cosG + HAPKE_XI * HAPKE_XI;
    return (1.0 - HAPKE_XI * HAPKE_XI) / (d * sqrt(max(d, 1e-6)));
  }

  float chandrasekharH(float mu) {
    return (1.0 + 2.0 * mu) / (1.0 + 2.0 * mu * HAPKE_GAMMA);
  }

  // cosG is dot(toSun, toEye); gRad is passed in too because the surge needs
  // tan(g/2) and recovering it from the cosine costs an acos anyway.
  float hapkeReflectance(float mu0, float mu, float cosG, float gRad) {
    if (mu0 <= 0.0 || mu <= 0.0) return 0.0;
    // Held off exact opposition, where tan(g/2) overflows. The surge is
    // asymptotically 1 there anyway, so the clamp costs nothing visible and
    // keeps drivers that turn inf into NaN from punching black pixels.
    float surge = 1.0 + HAPKE_B0 / (1.0 + tan(0.5 * min(gRad, 3.14)) / HAPKE_H);
    float multi = chandrasekharH(mu0) * chandrasekharH(mu) - 1.0;
    return (HAPKE_W / (4.0 * ${Math.PI})) * (mu0 / (mu0 + mu))
      * (surge * hgPhase(cosG) + multi);
  }
`
