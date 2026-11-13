/**
 * The Boca Chica ground and the Gulf, drawn on one surface from the site
 * layout (lib/catch/siteMap.ts): the shoreline, the bays and ponds, tidal flats,
 * salt marsh, scrub-covered lomas, sand and the paved sites. The outlines are
 * rasterised once into two small land-cover masks (a wide one for the region,
 * a fine one round the pads); the shader turns them into ground, breaking
 * every edge up with noise so nothing reads as a polygon. Colour and relief
 * are generated in world space at several scales, so the ground is sharp
 * under the camera and shows no repeating tile from altitude.
 */
import * as THREE from 'three'
import { MAP } from '@/lib/catch/siteMap'
import { tileNoise } from '@/components/touchdown/models'
import type { Bag } from './util'

export type Ground = { group: THREE.Group; time: { value: number } }

const WIDE = { x: -3000, z: -1000, half: 8192, size: 2048 }
const NEAR = { x: -160, z: 20, half: 1024, size: 1024 }

function noiseTexture(seed: number, bag: Bag): THREE.DataTexture {
  const size = 512
  const chans = [0, 1, 2].map((c) => tileNoise(size, [4, 8, 16, 32, 64, 128], [1, 0.7, 0.5, 0.36, 0.26, 0.18], seed + c * 101))
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    for (let c = 0; c < 3; c++) {
      // Stretch contrast: the summed octaves cluster around 0.5.
      data[i * 4 + c] = Math.max(0, Math.min(255, ((chans[c][i] - 0.5) * 2.1 + 0.5) * 255))
    }
    data[i * 4 + 3] = 255
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.generateMipmaps = true
  t.anisotropy = 8
  t.needsUpdate = true
  bag.push(t)
  return t
}

/** Rasterise land cover: mask A = water, tidal flat, scrub; mask B = salt marsh, paved, sand. */
function landMasks(area: typeof WIDE, bag: Bag): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const make = (layers: [number[][][], string][]) => {
    const c = document.createElement('canvas')
    c.width = c.height = area.size
    const g = c.getContext('2d')!
    g.fillStyle = '#000'
    g.fillRect(0, 0, area.size, area.size)
    g.globalCompositeOperation = 'lighter'
    const k = area.size / (area.half * 2)
    // A light blur softens the outlines before the shader roughens them.
    try {
      g.filter = `blur(${Math.max(0.6, 5 * k).toFixed(2)}px)`
    } catch {}
    for (const [polys, color] of layers) {
      g.fillStyle = color
      for (const rings of polys) {
        g.beginPath()
        for (const r of rings) {
          for (let i = 0; i < r.length; i += 2) {
            const px = (r[i] - area.x + area.half) * k
            const py = (r[i + 1] - area.z + area.half) * k
            if (i) g.lineTo(px, py)
            else g.moveTo(px, py)
          }
          g.closePath()
        }
        g.fill('evenodd')
      }
    }
    const t = new THREE.CanvasTexture(c)
    t.flipY = false
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.generateMipmaps = true
    t.anisotropy = 4
    bag.push(t)
    return t
  }
  return [
    make([
      [MAP.water, '#ff0000'],
      [MAP.tidal, '#00ff00'],
      [MAP.scrub, '#0000ff'],
    ]),
    make([
      [MAP.marsh, '#ff0000'],
      [MAP.paved, '#00ff00'],
      [MAP.sand, '#0000ff'],
    ]),
  ]
}

/** Shoreline x for every z, as a 1-D lookup. */
function shoreTexture(bag: Bag): THREE.DataTexture {
  const xs = MAP.shore.x
  const data = new Uint16Array(xs.length)
  for (let i = 0; i < xs.length; i++) data[i] = THREE.DataUtils.toHalfFloat(xs[i])
  const t = new THREE.DataTexture(data, xs.length, 1, THREE.RedFormat, THREE.HalfFloatType)
  t.minFilter = t.magFilter = THREE.LinearFilter
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  t.needsUpdate = true
  bag.push(t)
  return t
}

const FRAG_COMMON = /* glsl */ `
varying vec3 vWp;
uniform sampler2D uNoise;
uniform sampler2D uWideA;
uniform sampler2D uWideB;
uniform sampler2D uNearA;
uniform sampler2D uNearB;
uniform sampler2D uShore;
uniform vec3 uWide;
uniform vec3 uNear;
uniform vec2 uShoreZ;
uniform vec4 uPads[3];
uniform float uTime;
vec2 nSlope(vec2 uv, int ch) {
  float e = 1.0 / 512.0;
  vec4 a = texture2D(uNoise, uv + vec2(e, 0.0)) - texture2D(uNoise, uv - vec2(e, 0.0));
  vec4 b = texture2D(uNoise, uv + vec2(0.0, e)) - texture2D(uNoise, uv - vec2(0.0, e));
  return ch == 0 ? vec2(a.r, b.r) : (ch == 1 ? vec2(a.g, b.g) : vec2(a.b, b.b));
}
vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
float edge(float m, float n, float w) { return smoothstep(0.5 - w, 0.5 + w, m + (n - 0.5) * 0.5); }
`

const FRAG_COLOR = /* glsl */ `
float gDist = length(vViewPosition);
vec2 rp = vWp.xz;
float n1 = texture2D(uNoise, rp / 5200.0).r;
float n2 = texture2D(uNoise, rp / 1100.0 + 0.37).g;
float n3 = texture2D(uNoise, rp / 190.0 + 0.11).b;
// The finer lookups are rotated and bent by a coarser one, so thresholds on
// them never line up into the noise lattice.
vec2 bend = (texture2D(uNoise, rp / 83.0 + 0.21).rg - 0.5) * 16.0;
vec2 rq = mat2(0.8, -0.6, 0.6, 0.8) * (rp + bend);
vec2 rr = mat2(0.6, 0.8, -0.8, 0.6) * (rp + bend * 0.3);
float n4 = texture2D(uNoise, rq / 37.0).r;
float n5 = texture2D(uNoise, rr / 5.3).g;
float n6 = texture2D(uNoise, rq / 1.1).b;
float n7 = texture2D(uNoise, rr / 13.0 + 0.4).b;

// --- Land cover ---------------------------------------------------------
vec2 warp = (vec2(n3, texture2D(uNoise, rp / 190.0 + 0.6).r) - 0.5) * 22.0 + (vec2(n4, n5) - 0.5) * 5.0;
vec2 uvW = (rp + warp - uWide.xy) / uWide.z * 0.5 + 0.5;
vec2 uvN = (rp + warp * 0.35 - uNear.xy) / uNear.z * 0.5 + 0.5;
vec2 eW = abs(uvW - 0.5) * 2.0;
vec2 eN = abs(uvN - 0.5) * 2.0;
float inWide = 1.0 - smoothstep(0.9, 1.0, max(eW.x, eW.y));
float inNear = 1.0 - smoothstep(0.82, 1.0, max(eN.x, eN.y));
vec3 mA = texture2D(uWideA, uvW).rgb;
vec3 mB = texture2D(uWideB, uvW).rgb;
mA = mix(mA, texture2D(uNearA, uvN).rgb, inNear);
mB = mix(mB, texture2D(uNearB, uvN).rgb, inNear);
// Beyond the mapped region the same kind of country carries on, generated.
float pn = n1 * 0.6 + n2 * 0.4;
vec3 procA = vec3(smoothstep(0.40, 0.34, pn), smoothstep(0.52, 0.44, pn), smoothstep(0.60, 0.68, pn));
mA = mix(procA, mA, inWide);
mB *= inWide;
float rough = n4 * 0.55 + n5 * 0.45;
float water = edge(mA.r, rough, 0.10);
float tidal = edge(mA.g, n3 * 0.5 + rough * 0.5, 0.16);
float scrubM = edge(mA.b, n3 * 0.45 + n7 * 0.55, 0.22);
float marsh = edge(mB.r, rough, 0.16);
float paved = edge(mB.g, n4, 0.06);
float sand = edge(mB.b, rough, 0.16);

// --- Shore --------------------------------------------------------------
float sT = clamp((rp.y - uShoreZ.x) / (uShoreZ.y - uShoreZ.x), 0.0, 1.0);
float shoreLine = texture2D(uShore, vec2(sT, 0.5)).r;
float off = rp.x - shoreLine; // metres seaward of the waterline
float swash = sin(uTime * 0.55 + rp.y * 0.021) * 2.2 + (n4 - 0.5) * 5.0;
float sea = smoothstep(-1.0, 1.0, off + swash);
float inland = -off;

// --- Ground colours -----------------------------------------------------
// Coastal prairie: pale sandy soil with dry grass.
vec3 soil = mix(vec3(0.66, 0.59, 0.46), vec3(0.55, 0.50, 0.38), n3);
float tuft = smoothstep(0.42, 0.66, n4 * 0.5 + n5 * 0.5) * (0.35 + 0.65 * n2);
vec3 lc = mix(soil, mix(vec3(0.47, 0.46, 0.27), vec3(0.36, 0.40, 0.22), n5), tuft * 0.75);
// Tidal flats: smooth grey-brown mud, darker where wet, pale salt crust where dry.
float wetFlat = smoothstep(0.50, 0.74, n2 * 0.5 + n3 * 0.3 + n7 * 0.2);
vec3 mud = mix(vec3(0.66, 0.60, 0.50), vec3(0.47, 0.42, 0.35), wetFlat);
mud = mix(mud, vec3(0.78, 0.75, 0.68), smoothstep(0.62, 0.86, n3 * 0.55 + n4 * 0.45) * (1.0 - wetFlat) * 0.5);
mud = mix(mud, vec3(0.36, 0.37, 0.27), smoothstep(0.62, 0.80, n7 * 0.6 + n2 * 0.4) * 0.5); // algal mats
lc = mix(lc, mud, tidal);
// Salt marsh.
lc = mix(lc, mix(vec3(0.34, 0.39, 0.22), vec3(0.45, 0.45, 0.27), n4), marsh * 0.9);
// Scrub on the lomas: dense dark brush, individual bushes resolving close up.
float bush = smoothstep(0.30, 0.62, n5 * 0.65 + n6 * 0.35);
vec3 brush = mix(vec3(0.21, 0.24, 0.15), vec3(0.40, 0.39, 0.26), n4 * 0.35 + n7 * 0.3 + bush * 0.35);
// Thickets with open ground between them, thinning toward the edges.
float thicket = smoothstep(0.36, 0.60, n7 * 0.5 + n4 * 0.3 + n3 * 0.2 + (scrubM - 0.7) * 0.5);
float scrub = scrubM * thicket * (0.6 + 0.4 * mix(bush, 1.0, smoothstep(40.0, 300.0, gDist)));
lc = mix(lc, mix(soil * 0.9, vec3(0.45, 0.44, 0.28), 0.5), scrubM * 0.6);
lc = mix(lc, brush, scrub);
// Loose sand.
lc = mix(lc, vec3(0.84, 0.78, 0.65) * (0.92 + 0.14 * n5), sand);
// The beach: wet sand, a pale berm, then grassed dunes fading into the prairie.
float beach = smoothstep(95.0, 62.0, inland + (n3 - 0.5) * 30.0) * (1.0 - sea);
float dune = smoothstep(250.0, 150.0, inland + (n3 - 0.5) * 60.0) * (1.0 - beach) * (1.0 - sea);
float duneGrass = smoothstep(0.38, 0.66, n7 * 0.5 + n4 * 0.3 + n5 * 0.2);
lc = mix(lc, mix(vec3(0.83, 0.77, 0.63), vec3(0.38, 0.42, 0.24), duneGrass * 0.8), dune * (1.0 - water));
lc = mix(lc, vec3(0.87, 0.82, 0.70) * (0.95 + 0.1 * n5), beach);
float wetSand = smoothstep(16.0, 3.0, inland) * (1.0 - sea);
lc = mix(lc, vec3(0.57, 0.51, 0.42), wetSand);
// Worked ground inside the sites: graded, compacted fill, bare of grass.
vec3 fill = mix(vec3(0.71, 0.65, 0.53), vec3(0.60, 0.55, 0.45), n3 * 0.6 + n4 * 0.4);
fill = mix(fill, fill * 0.84, smoothstep(0.55, 0.75, texture2D(uNoise, rp / 70.0 + 0.2).r) * 0.6);
lc = mix(lc, fill, paved * (1.0 - sea));
// Poured slabs round the mounts, with joints, stains and tyre-worn dust.
float slab = 0.0;
for (int i = 0; i < 3; i++) {
  vec2 pd = abs(rp + (vec2(n3, n4) - 0.5) * 5.0 - uPads[i].xy) - uPads[i].zw;
  slab = max(slab, 1.0 - smoothstep(-2.0, 2.0, max(pd.x, pd.y)));
}
vec2 cell = abs(fract(rp / 9.0) - 0.5);
float joint = smoothstep(0.485, 0.497, max(cell.x, cell.y)) * (1.0 - smoothstep(150.0, 600.0, gDist));
vec3 conc = vec3(0.61, 0.59, 0.55) * (0.82 + 0.2 * texture2D(uNoise, rp / 140.0).g + 0.12 * n4);
conc = mix(conc, conc * 0.8, smoothstep(0.5, 0.8, texture2D(uNoise, rp / 55.0 + 0.5).b) * 0.6);
conc = mix(conc, vec3(0.70, 0.64, 0.53), smoothstep(0.55, 0.8, n3) * 0.35);
conc *= 1.0 - joint * 0.35;
lc = mix(lc, conc, slab * (1.0 - sea));
// Grain near the camera.
lc *= 0.9 + 0.2 * mix(n6, 0.5, smoothstep(8.0, 60.0, gDist));
lc *= 0.93 + 0.14 * mix(n5, 0.5, smoothstep(40.0, 260.0, gDist));

// --- Water --------------------------------------------------------------
// Bays and ponds: shallow, silty, green-brown at the margins.
float still = water * (1.0 - slab) * (1.0 - sea) * (1.0 - paved * 0.0);
vec3 bay = mix(vec3(0.42, 0.45, 0.36), vec3(0.19, 0.33, 0.36), smoothstep(0.55, 1.0, mA.r + (n3 - 0.5) * 0.3));
lc = mix(lc, lc * 0.72, smoothstep(0.25, 0.5, mA.r) * (1.0 - still) * (1.0 - sea) * (1.0 - slab)); // damp margin
lc = mix(lc, bay, still);
// The Gulf: sandy green surf zone, then deeper blue-green offshore.
float sn = texture2D(uNoise, rp / 900.0 + uTime * 0.0006).g;
vec3 sc = mix(vec3(0.52, 0.56, 0.45), vec3(0.20, 0.43, 0.44), smoothstep(0.0, 240.0, off + (sn - 0.5) * 120.0));
sc = mix(sc, vec3(0.06, 0.24, 0.36), smoothstep(180.0, 1500.0, off + (sn - 0.5) * 500.0));
// Breakers: long lines nearly parallel to the beach, broken into runs.
float wob = texture2D(uNoise, vec2(rp.y / 700.0, 0.3)).b;
float ph = off * 0.07 + wob * 2.2 + uTime * 0.5;
float run = smoothstep(0.42, 0.62, texture2D(uNoise, vec2(rp.y / 260.0, floor(ph / 6.2832) * 0.37)).r);
float crest = pow(max(0.0, sin(ph)), 24.0) * smoothstep(125.0, 25.0, off) * run;
float wash = smoothstep(7.0, 0.0, off + swash);
float foam = clamp(crest * 0.9 + wash * 0.85, 0.0, 1.0) * (0.5 + 0.5 * n5) * sea;
vec3 seaCol = mix(sc * 0.72, vec3(0.93), foam);
lc = mix(lc, seaCol, sea);
float wet = max(sea * (1.0 - foam), still);
diffuseColor.rgb = toLinear(lc) * mix(1.0, 0.62, wet);
`

export function buildGround(env: THREE.Texture, seed: number, pads: THREE.Vector4[], bag: Bag): Ground {
  const noise = noiseTexture(seed, bag)
  const [wideA, wideB] = landMasks(WIDE, bag)
  const [nearA, nearB] = landMasks(NEAR, bag)
  const shore = shoreTexture(bag)
  const time = { value: 0 }
  const group = new THREE.Group()

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMap: env, envMapIntensity: 1 })
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uNoise: { value: noise },
      uWideA: { value: wideA },
      uWideB: { value: wideB },
      uNearA: { value: nearA },
      uNearB: { value: nearB },
      uShore: { value: shore },
      uWide: { value: new THREE.Vector3(WIDE.x, WIDE.z, WIDE.half) },
      uNear: { value: new THREE.Vector3(NEAR.x, NEAR.z, NEAR.half) },
      uShoreZ: { value: new THREE.Vector2(MAP.shore.z0, MAP.shore.z1) },
      uPads: { value: pads },
      uTime: time,
    })
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', 'varying vec3 vWp;\n#include <common>')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `${FRAG_COMMON}\n#include <common>`)
      .replace('#include <map_fragment>', FRAG_COLOR)
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.62, tidal * wetFlat * (1.0 - slab));
roughnessFactor = mix(roughnessFactor, 0.15, wet);
roughnessFactor = mix(roughnessFactor, 0.75, foam);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  float nearFade = 1.0 - smoothstep(120.0, 800.0, gDist);
  // Land relief: grain everywhere, hummocks in the dunes, bushes in the scrub.
  vec2 g = nSlope(rp / 29.0, 0) * 1.0 * nearFade;
  g += nSlope(rp / 4.1, 1) * 1.6 * (1.0 - smoothstep(30.0, 200.0, gDist));
  g += nSlope(rp / 60.0, 2) * 5.0 * dune;
  g += (nSlope(rp / 4.1, 1) * 4.5 + nSlope(rp / 29.0, 0) * 3.0) * scrub * (1.0 - smoothstep(200.0, 1500.0, gDist));
  g *= (1.0 - slab * 0.85) * (1.0 - wet);
  // Water: wind ripples on the bays, swell and chop on the Gulf.
  vec2 flow = uTime * vec2(-0.011, 0.004);
  vec2 w = nSlope(rp / 46.0 + flow, 0) * 2.6
         + nSlope(rp / 11.0 - flow * 2.3, 1) * 1.8 * (1.0 - smoothstep(80.0, 700.0, gDist))
         + nSlope(rp / 330.0 + flow * 0.3, 2) * 4.0;
  w *= mix(1.0, 0.15, smoothstep(700.0, 9000.0, gDist));
  g += w * (sea + still * 0.3) * (1.0 - foam);
  vec3 wx = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  vec3 wz = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
  normal = normalize(normal - g.x * wx - g.y * wz);
}`
      )
  }
  bag.push(mat)
  const geo = new THREE.PlaneGeometry(160000, 160000, 1, 1)
  geo.rotateX(-Math.PI / 2)
  bag.push(geo)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  mesh.renderOrder = -2
  mesh.frustumCulled = false
  group.add(mesh)
  return { group, time }
}
