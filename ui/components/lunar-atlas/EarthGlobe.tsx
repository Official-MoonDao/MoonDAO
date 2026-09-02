// Earth, hanging low over Moon Base Zero.
//
// Every other object in this scene is either true-to-scale hardware standing
// on the ridge (baseplan.ts) or an orbital portrayal that says up front which
// of its numbers are honest and which are a necessary cheat (skyplan.ts). This
// is the same deal, for the one object in the sky that isn't anyone's
// spacecraft.
//
// WHAT'S REAL: the direction. From 89.46°S on the Connecting Ridge, the mean
// sub-Earth point (lat 0, lon 0 in the MOON_ME frame — that IS the frame's own
// definition of "toward Earth") works out to sit almost exactly on the local
// horizon, bearing ~90° (see capLocalDirection in southpole.ts — verified
// against the documented sun figures, which this same construction reproduces
// to within 0.1°). Lunar libration then rocks that point up to ~7.6° above the
// horizon and down to ~8.4° below it over the 27-day cycle, which is the whole
// reason a south-pole base needs relay satellites at all (see skyplan.ts) —
// Earth is only above the horizon part of the time. SAT_DISH_EL (0.14 rad,
// ProjectModel.tsx) already fixed this scene's stance on that libration cycle
// for the relay dishes: it portrays the favorable phase, Earth up and
// reachable. This reuses that exact figure rather than inventing a second,
// disagreeing "where's Earth" fact. The angular SIZE is also real: Earth's
// mean angular diameter as seen from the Moon (~1.9°, about 3.7x the Moon's
// own disc as seen from Earth) is computed from its actual radius and mean
// orbital distance, then reproduced at whatever distance this Earth is
// actually drawn at, so it looks the true size even though it isn't the true
// distance away.
//
// WHAT'S A PORTRAYAL: the distance. The real Earth-Moon distance (~384,400 km)
// is ~5.5x past this Canvas's far clip plane (GLOBE_RADIUS*40) and the star
// shell's own radius, both of which were sized for the ridge scene, not solar
// system distances. Earth is parked well inside both instead — close enough to
// render as a solid disc in front of the stars, far enough that the camera's
// entire local orbit (a few dozen meters, vs. this being tens of thousands of
// km out) produces no perceptible parallax, exactly as a body a third of a
// million km away should behave from a viewpoint that never actually leaves
// the ridge.
//
// The terminator is genuine per-pixel Lambertian shading from this scene's
// existing sun light — not fitted to any real date's Earth-Sun-Moon phase
// angle (that light's own direction is itself a portrayal, chosen for the
// terrain hillshade bake, not real ephemeris), so the crescent it happens to
// show isn't a specific real moment. It is an honest phase of SOME sun
// direction rather than a flat, unlit decal, which is what actually reads as
// a real planet instead of a sticker.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CAP_CENTER_HEIGHT_M,
  capCenterDirection,
  capLocalDirection,
  heightToRadius,
} from '@/lib/lunar-atlas/southpole'
import { GLOBE_RADIUS } from '@/lib/lunar-atlas/textures'
import { SAT_DISH_EL } from './ProjectModel'

const EARTH_RADIUS_M = 6_371_000 // mean radius
const EARTH_MOON_MEAN_DIST_M = 384_400_000
// Half-angle subtended by Earth's disc at mean distance — the real fact this
// whole model exists to preserve, independent of the portrayed distance below.
const EARTH_ANGULAR_RADIUS_RAD = Math.atan(EARTH_RADIUS_M / EARTH_MOON_MEAN_DIST_M)

// Degrees CCW from east — the ridge's own bearing convention (see
// capLocalDirection). ~90° is very close to due "north" underneath this
// near-polar site, which is geometrically required: the equatorial near side
// Earth hangs over is, from 89.46°S, in the direction away from the pole.
const EARTH_BEARING_DEG = 90
// Reuse the relay dishes' own "Earth sits ~8° above horizontal, at the
// favorable point in its libration cycle" fact (see SAT_DISH_EL) rather than
// asserting a second, independently-chosen number for the same real object.
const EARTH_ELEV_DEG = (SAT_DISH_EL * 180) / Math.PI

// Portrayed distance from the ridge, in scene units. Comfortably inside the
// Canvas far plane (GLOBE_RADIUS*40) and the star shell's inner radius
// (GLOBE_RADIUS*14, see MoonGlobe's <Stars>) so Earth always draws solidly in
// front of the starfield with room to spare, never near either clip edge.
const EARTH_DIST_UNITS = GLOBE_RADIUS * 12
// Backed out from the real angular radius so the disc reads at its true
// apparent size from wherever the camera actually sits, despite the distance
// above being fictional.
const EARTH_RENDER_RADIUS = EARTH_DIST_UNITS * Math.tan(EARTH_ANGULAR_RADIUS_RAD)

// A stylized spin, not Earth's real ~24 h rotation (which would be visually
// imperceptible over a normal viewing session): fast enough that continents
// and city lights visibly cross the fixed terminator within a couple of
// minutes of looking at it — the cheapest possible cue that this is a live
// planet and not a skybox decal. Clouds drift a little faster still, the way
// real cloud bands slide relative to the surface underneath them.
const EARTH_SPIN_RAD_PER_S = (Math.PI * 2) / 420
const CLOUD_SPIN_RAD_PER_S = EARTH_SPIN_RAD_PER_S * 1.35

const EARTH_DAY_MAP = '/moonbase/earth/earth-day.jpg'
const EARTH_LIGHTS_MAP = '/moonbase/earth/earth-lights.png'
const EARTH_CLOUDS_MAP = '/moonbase/earth/earth-clouds.png'

// Same manual, non-Suspense texture loader SouthPoleTerrain.tsx uses for the
// terrain's own baked maps: this is a background decoration with no
// meaningful fallback state, so it simply renders nothing until its texture
// arrives rather than pulling in a Suspense boundary for one component.
function useImageTexture(url: string, srgb: boolean): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let cancelled = false
    new THREE.TextureLoader().load(url, (t) => {
      if (cancelled) {
        t.dispose()
        return
      }
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
      t.anisotropy = 8
      setTex(t)
    })
    return () => {
      cancelled = true
    }
  }, [url, srgb])
  useEffect(() => () => tex?.dispose(), [tex])
  return tex
}

// THE DEPTH BUFFER IS USELESS OUT HERE, and every layer below is built around
// that. This Canvas runs a conventional 1/z buffer with a 1 METRE near plane
// (see MoonGlobe's gl props for why both of those are the right call for a
// scene whose subject is hardware you can stand next to). One depth code at
// distance z spans roughly z² / (near · 2²⁴) — and at Earth's 24 units, with
// near at 1 m = 1.15e-6 units, that is about 30 SCENE UNITS. Earth's disc is
// 0.8 units across and the whole prop, halo shell included, is under 1. Every
// fragment of the surface, the cloud shell and the halo shell therefore
// quantises to a single depth value, and which of two coincident codes a given
// triangle lands on is down to float rounding.
//
// That is what made this Earth look like a disco ball: the halo shell's far
// hemisphere passed the depth test against the surface across some patches and
// failed it across others, so the disc came out a mottled patchwork of blown-out
// blue-white (halo won) and near-black ocean (halo lost), in facets the size of
// the sphere's own triangles.
//
// The fix is to stop asking the depth buffer a question it cannot answer.
// NOTHING in this prop writes depth, so no layer is ever tested against another
// one — they composite in a fixed painter's order (surface, cloud, halo, set by
// renderOrder below) the way a background prop with three fixed layers should.
// All three still depth-TEST, against the terrain and the hardware, which are
// metres from the eye and have depth precision to spare, so a ridge or a
// spacecraft in the way still occludes Earth correctly.
//
// Stars are the one thing that used to be occluded by the surface writing depth
// and now are not. 6000 of them over the whole sky, against a disc covering
// 2.8 of 41253 square degrees, works out to less than half a star expected
// anywhere on Earth's disc — and the depth codes were already colliding with
// the star shell at 28–40 units, so this was never reliably working anyway.

// Radius of the halo shell, as a multiple of Earth's own. Its only real job is
// to be wide enough to read: Earth subtends 1.9° in a 42° vertical fov, so the
// disc is only ~36 px tall at 800 px of viewport, and the old 1.06 shell put
// the entire halo inside a single pixel.
const ATMOSPHERE_SCALE = 1.25
// |N·V| at the point where the shell's far hemisphere crosses Earth's own
// silhouette — the horizon of the halo, past which a fragment is hidden behind
// the planet and must contribute nothing. Derived from the scale rather than
// written down so the two cannot drift apart (1.25 makes it exactly 0.6).
const ATMOSPHERE_LIMB_COS = Math.sqrt(1 - 1 / (ATMOSPHERE_SCALE * ATMOSPHERE_SCALE))
// Peak radiance of the halo at the limb. Deliberately under the Bloom pass'
// 0.9 luminance threshold (MoonGlobe) so the rim stays a rim and does not
// bloom into the smear that a too-hot halo makes of a disc this small.
const ATMOSPHERE_STRENGTH = 0.8

// Thin limb glow, additive on a back-faced shell, and NOT a scattering model —
// it is the cosmetic job of an airless-Moon base looking out at a planet that
// does have air, same as before. The one thing it now does that the usual
// three.js "glowing planet" snippet does not is stay OFF the disc.
//
// The snippet's pow(c - N·V, p) is brightest in the MIDDLE of the far
// hemisphere and dimmest at the rim — 4.1 against 0.2 here — which is only ever
// survivable because the planet's own depth normally masks the middle out. It
// cannot be relied on to here (see above), so the falloff is re-anchored to
// Earth's silhouette instead of to the eye: peak at the limb, fading OUTWARD to
// nothing at the shell's edge, and identically zero anywhere that projects
// behind the planet. The glow is then correct whether or not it is depth-tested,
// which is the property this scene actually needs.
const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vViewNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewNormal = normalize(normalMatrix * normal);
    // Per-fragment rather than a fixed (0,0,1): the disc is small enough that
    // it barely matters, but it costs one varying and removes the assumption.
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLimbCos;
  uniform float uStrength;
  varying vec3 vViewNormal;
  varying vec3 vViewDir;
  void main() {
    // Back-faced shell, so the outward normal points away from the eye: this
    // runs from 0 at the shell's own silhouette to 1 directly behind Earth.
    float away = clamp(-dot(normalize(vViewNormal), normalize(vViewDir)), 0.0, 1.0);
    // 0 at the shell's outer edge, 1 exactly at Earth's silhouette, >1 behind
    // the planet. The cutoff needs no smoothing: it falls on the limb itself,
    // where Earth's own disc is already drawn over it.
    float t = away / uLimbCos;
    float halo = pow(clamp(t, 0.0, 1.0), 3.0) * step(t, 1.0);
    gl_FragColor = vec4(uColor * halo * uStrength, 1.0);
  }
`

export default function EarthGlobe() {
  const dayMap = useImageTexture(EARTH_DAY_MAP, true)
  const lightsMap = useImageTexture(EARTH_LIGHTS_MAP, true)
  const cloudsMap = useImageTexture(EARTH_CLOUDS_MAP, true)

  const position = useMemo(() => {
    const dir = capLocalDirection(EARTH_BEARING_DEG, EARTH_ELEV_DEG)
    const up = capCenterDirection()
    // Anchored off the ridge's own surface point (not the Moon's center) so
    // that a camera standing near the ridge — which is where this camera
    // always is, see MoonGlobe's orbit limits — sees Earth along exactly the
    // bearing/elevation computed above, with no offset from the anchor
    // itself being ~2 scene units off from true center at a 24-unit remove.
    const anchorR = heightToRadius(CAP_CENTER_HEIGHT_M)
    return new THREE.Vector3(
      up[0] * anchorR + dir[0] * EARTH_DIST_UNITS,
      up[1] * anchorR + dir[1] * EARTH_DIST_UNITS,
      up[2] * anchorR + dir[2] * EARTH_DIST_UNITS
    )
  }, [])

  const atmosphereUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(0.35, 0.6, 1.0) },
      uLimbCos: { value: ATMOSPHERE_LIMB_COS },
      uStrength: { value: ATMOSPHERE_STRENGTH },
    }),
    []
  )

  const spinRef = useRef<THREE.Group>(null)
  const cloudRef = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (spinRef.current) spinRef.current.rotation.y += delta * EARTH_SPIN_RAD_PER_S
    if (cloudRef.current) cloudRef.current.rotation.y += delta * CLOUD_SPIN_RAD_PER_S
  })

  // Nothing to show until at least the day map is in — a bare gray sphere
  // would read as a bug, not a planet.
  if (!dayMap) return null

  return (
    <group position={position}>
      <group ref={spinRef}>
        <mesh renderOrder={0}>
          <sphereGeometry args={[EARTH_RENDER_RADIUS, 48, 48]} />
          <meshStandardMaterial
            map={dayMap}
            // See the depth note above the atmosphere shader: writing depth
            // here is what let the shells fight the surface for the disc.
            depthWrite={false}
            // City lights on the night face: emissive is unconditional in
            // three.js (it ignores scene lighting entirely), so a modest
            // intensity is invisible against the sunlit face's much brighter
            // diffuse response and only reads on the unlit side — the same
            // trick real Earth-at-night composites rely on.
            emissiveMap={lightsMap ?? undefined}
            emissive={lightsMap ? new THREE.Color('#fff3c4') : undefined}
            emissiveIntensity={lightsMap ? 1.4 : 0}
            roughness={0.85}
            metalness={0}
          />
        </mesh>

        {cloudsMap && (
          <mesh ref={cloudRef} scale={1.008} renderOrder={1}>
            <sphereGeometry args={[EARTH_RENDER_RADIUS, 48, 48]} />
            <meshStandardMaterial
              map={cloudsMap}
              transparent
              depthWrite={false}
              roughness={1}
              metalness={0}
            />
          </mesh>
        )}
      </group>

      <mesh scale={ATMOSPHERE_SCALE} renderOrder={2}>
        <sphereGeometry args={[EARTH_RENDER_RADIUS, 32, 32]} />
        <shaderMaterial
          vertexShader={ATMOSPHERE_VERTEX}
          fragmentShader={ATMOSPHERE_FRAGMENT}
          uniforms={atmosphereUniforms}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}
