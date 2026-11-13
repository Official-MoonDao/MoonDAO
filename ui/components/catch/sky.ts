/**
 * Catch sky: an analytic daytime atmosphere (Preetham-style scattering, the
 * same model as three's Sky example) with ray-marched cumulus, baked ONCE
 * into a cube map. The bake can afford a real march; the game then pays for
 * one textured background and gets a matching reflection map, fog colour and
 * sun colour from the same source.
 */
import * as THREE from 'three'
import type { Bag } from './util'

export type SkyParams = {
  /** Unit vector toward the sun (x east, y up, z south). */
  sunDir: [number, number, number]
  /** 0 (clear) .. 1 (overcast). */
  cover: number
  seed: number
  /** Wind heading the clouds are streaked along, radians. */
  windAngle: number
}

export type BakedSky = {
  background: THREE.CubeTexture
  env: THREE.Texture
  fogColor: THREE.Color
  sunColor: THREE.Color
  /** 0 at the horizon .. 1 overhead: scales direct light. */
  sunStrength: number
}

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSun;
uniform float uCover;
uniform float uSeed;
uniform vec2 uWind;
uniform float uSteps;
uniform float uLightSteps;
uniform float uExposure;

uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunTint;
uniform float uDay;

// A graded sky: deep overhead, pale at the horizon, warm toward a low sun.
vec3 atmosphere(vec3 dir) {
  float h = clamp(dir.y, 0.0, 1.0);
  float t = pow(1.0 - h, 3.4);
  vec3 c = mix(uZenith, uHorizon, t);
  float ct = max(dot(dir, uSun), 0.0);
  c = mix(c, uSunTint, t * (1.0 - uDay) * (0.12 + 0.88 * pow(ct, 2.0)));
  c += uSunTint * (pow(ct, 10.0) * (0.16 + 0.3 * (1.0 - uDay)) + pow(ct, 160.0) * 0.5);
  c += vec3(1.0, 0.96, 0.88) * smoothstep(0.99996, 0.99999, dot(dir, uSun)) * 20.0;
  return c;
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 6; i++) {
    s += a * vnoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.1;
    a *= 0.5;
  }
  return s;
}
float fbm3(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 9.7;
    a *= 0.5;
  }
  return s;
}

const float BASE = 1500.0;
const float THICK = 1500.0;

float density(vec3 p, bool cheap) {
  float h = (p.y - BASE) / THICK;
  if (h < 0.0 || h > 1.0) return 0.0;
  vec2 q = p.xz / 1900.0 + uSeed;
  float n = cheap ? fbm3(q) / 0.875 : fbm(q);
  // Large clear lanes between cloud streets.
  float lanes = vnoise(q * 0.17 + 3.1);
  float shape = n + (lanes - 0.5) * 0.5 - (1.0 - uCover * 0.62) * 0.78;
  // Flat bases, domed tops: tall only where the field is strong.
  shape -= h * h * 0.34 + smoothstep(0.12, 0.0, h) * 0.12;
  if (!cheap) shape -= fbm3(p.xz / 330.0 + p.y / 260.0) * 0.14 * (0.4 + h);
  return clamp(shape * 9.0, 0.0, 1.0);
}

void main() {
  vec3 dir = normalize(vDir);
  vec3 view = vec3(dir.x, max(dir.y, 0.0), dir.z);
  view = normalize(view);
  vec3 sky = atmosphere(view);

  // High thin cirrus, streaked along the wind.
  if (dir.y > 0.02) {
    vec2 cp = dir.xz / dir.y * 9000.0;
    vec2 along = vec2(dot(cp, uWind), dot(cp, vec2(-uWind.y, uWind.x)));
    float ci = fbm(vec2(along.x / 26000.0, along.y / 5200.0) + uSeed * 1.7);
    float wisp = smoothstep(0.55, 0.9, ci) * 0.2 * smoothstep(0.02, 0.2, dir.y);
    sky = mix(sky, mix(uSunTint, vec3(1.0), 0.5 + 0.5 * uDay), wisp);
  }

  if (dir.y > 0.012 && uCover > 0.01) {
    vec3 lit = mix(uSunTint, vec3(1.0, 0.99, 0.97), 0.35 + 0.65 * uDay) * (0.8 + 0.3 * uDay);
    vec3 shade = mix(uHorizon * 0.8, vec3(0.46, 0.52, 0.64), 0.55) * (0.6 + 0.4 * uDay);
    float t0 = BASE / dir.y;
    float t1 = (BASE + THICK) / dir.y;
    float span = min(t1 - t0, 9000.0);
    float dt = span / uSteps;
    float T = 1.0;
    vec3 col = vec3(0.0);
    // Jitter from the ray itself, so the six cube faces agree along their edges.
    float jitter = hash(dir.xz * 917.0 + dir.y * 311.0 + uSeed);
    for (float i = 0.0; i < 64.0; i++) {
      if (i >= uSteps || T < 0.03) break;
      vec3 p = dir * (t0 + (i + jitter) * dt);
      float d = density(p, false);
      if (d > 0.002) {
        float toSun = 0.0;
        for (float j = 1.0; j <= 6.0; j++) {
          if (j > uLightSteps) break;
          toSun += density(p + uSun * j * 130.0, true);
        }
        float h = (p.y - BASE) / THICK;
        float sunT = exp(-toSun * 0.62);
        // Brighter toward the tops, a silver lining toward the sun.
        float forward = pow(max(dot(dir, uSun), 0.0), 6.0);
        vec3 c = mix(shade, lit, sunT * (0.55 + 0.45 * h)) + lit * forward * sunT * 0.5;
        float a = 1.0 - exp(-d * dt * 0.0052);
        col += T * a * c;
        T *= 1.0 - a;
      }
    }
    float far = exp(-t0 / 16000.0) * smoothstep(0.012, 0.07, dir.y);
    sky = mix(sky, col / max(1.0 - T, 0.001), (1.0 - T) * far);
  }

  // A touch of warm haze right at the horizon so sea and sky meet softly.
  // Below the horizon the reflection map sees ground, not more sky: it is
  // what keeps bare steel from reflecting white all the way down.
  // Sunlit sand and scrub inland (west, -x), the Gulf to seaward (east, +x).
  vec3 land = vec3(0.34, 0.30, 0.23);
  vec3 gulf = vec3(0.10, 0.19, 0.24);
  vec3 ground = mix(land, gulf, smoothstep(-0.15, 0.45, dir.x)) * (0.4 + 0.6 * uDay);
  sky = mix(sky, ground, smoothstep(-0.005, -0.09, dir.y));
  gl_FragColor = vec4(sky * uExposure, 1.0);
}`

export function bakeSky(renderer: THREE.WebGLRenderer, p: SkyParams, mobile: boolean, bag: Bag): BakedSky {
  const size = mobile ? 768 : 1536
  const rt = new THREE.WebGLCubeRenderTarget(size, { generateMipmaps: false })
  // sRGB storage: 8 bits are enough for a sky when they are spent perceptually.
  rt.texture.colorSpace = THREE.SRGBColorSpace
  rt.texture.minFilter = THREE.LinearFilter
  rt.texture.magFilter = THREE.LinearFilter
  // Sky colours by sun height: `day` is 0 at the horizon, 1 from about 25 degrees up.
  const day = Math.min(1, Math.max(0, p.sunDir[1] / 0.42))
  const mix3 = (a: number[], b: number[]) => new THREE.Vector3(a[0] + (b[0] - a[0]) * day, a[1] + (b[1] - a[1]) * day, a[2] + (b[2] - a[2]) * day)
  const zenith = mix3([0.1, 0.18, 0.46], [0.055, 0.21, 0.66])
  const horizon = mix3([0.74, 0.62, 0.62], [0.47, 0.66, 0.92])
  const tint = mix3([1.0, 0.52, 0.2], [1.0, 0.93, 0.8])
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uSun: { value: new THREE.Vector3(...p.sunDir).normalize() },
      uCover: { value: p.cover },
      uSeed: { value: (p.seed % 9973) / 97 },
      uWind: { value: new THREE.Vector2(Math.cos(p.windAngle), Math.sin(p.windAngle)) },
      uSteps: { value: mobile ? 34 : 44 },
      uLightSteps: { value: mobile ? 3 : 5 },
      uExposure: { value: 1 },
      uZenith: { value: zenith },
      uHorizon: { value: horizon },
      uSunTint: { value: tint },
      uDay: { value: day },
    },
  })
  const geo = new THREE.SphereGeometry(10, 48, 32)
  const scene = new THREE.Scene()
  scene.add(new THREE.Mesh(geo, mat))
  const cam = new THREE.CubeCamera(0.1, 100, rt)
  const prevTone = renderer.toneMapping
  renderer.toneMapping = THREE.NoToneMapping
  cam.update(renderer, scene)
  renderer.toneMapping = prevTone

  // Fog takes the colour of the western horizon, read back from the bake.
  const px = new Uint8Array(4 * 32)
  const fog = new THREE.Color(0.7, 0.78, 0.86)
  try {
    renderer.readRenderTargetPixels(rt, size / 2 - 16, Math.floor(size * 0.5 + size * 0.006), 32, 1, px, 1)
    let r = 0
    let g = 0
    let b = 0
    for (let i = 0; i < 32; i++) {
      r += px[i * 4]
      g += px[i * 4 + 1]
      b += px[i * 4 + 2]
    }
    if (r + g + b > 0) fog.setRGB(r / 32 / 255, g / 32 / 255, b / 32 / 255, THREE.SRGBColorSpace)
  } catch {}

  const pmrem = new THREE.PMREMGenerator(renderer)
  const envRT = pmrem.fromCubemap(rt.texture)
  pmrem.dispose()
  geo.dispose()
  mat.dispose()
  bag.push(rt, envRT)

  const el = Math.max(0, p.sunDir[1])
  // Low sun is warm and weaker; high sun is near white.
  const warm = Math.pow(1 - Math.min(1, el / 0.55), 1.6)
  const sunColor = new THREE.Color(1, 0.96 - 0.3 * warm, 0.9 - 0.52 * warm)
  return {
    background: rt.texture,
    env: envRT.texture,
    fogColor: fog,
    sunColor,
    sunStrength: Math.min(1, 0.5 + el * 1.25),
  }
}
