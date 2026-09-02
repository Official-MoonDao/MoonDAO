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
// width of the surge. This is a VIEW-DEPENDENT term, which is precisely why
// the terrain's baked hillshade cannot contain it — a bake has no viewer.
//
// LOMMEL-SEELIGER (no limb darkening). A single-scattering, semi-infinite
// particulate layer reflects mu0/(mu0+mu) rather than Lambert's mu0, so it
// brightens toward grazing view angles by exactly enough to cancel the
// foreshortening that darkens a Lambertian limb. On the ground it is why the
// lunar horizon reads as a bright band rather than fading off.
//
// Only the first of the two is applied to the rendered terrain, and the
// reason is worth keeping: the Lommel-Seeliger correction to an existing
// Lambertian bake goes as 1/(mu0+mu), which diverges as the view goes grazing
// — and grazing is exactly where this scene's camera spends its time, three
// metres off the deck looking out across a ridge. Applying it there blows the
// distant ground to white, which is the same class of failure as the flat
// ambient "pond" documented at the top of SouthPoleTerrain.tsx. It IS applied
// to the regolith environment map (lunarEnvironment.ts), where mu0 is a
// constant and mu is bounded by construction, so the term cannot run away.

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
// ends of main street, the near and far edges of the colony — the phase angle
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
