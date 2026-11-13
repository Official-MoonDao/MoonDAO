/**
 * The Starship upper stage, built from primitives in named parts so a miss can
 * throw real pieces. Local frame: y along the hull (base at 0), the tiled belly
 * faces +z, flaps and catch pins sit along +/-x.
 */
import * as THREE from 'three'
import { SHIP } from '@/lib/catch/layout'
import { canvasTexture, type Bag } from './util'

export type ShipModel = {
  group: THREE.Group
  /** Hull halves, flaps, engines: the pieces a break-up separates. */
  parts: THREE.Object3D[]
  flaps: { fl: THREE.Group; fr: THREE.Group; al: THREE.Group; ar: THREE.Group }
  plume: THREE.Mesh
  plumeMat: THREE.ShaderMaterial
  engineGlow: THREE.MeshStandardMaterial
  light: THREE.PointLight
}

function hullProfile(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = []
  const R = SHIP.radius
  const L = SHIP.height - SHIP.noseBase
  const rho = (R * R + L * L) / (2 * R)
  for (let y = 0; y <= SHIP.noseBase; y += 0.75) pts.push(new THREE.Vector2(R, y))
  pts.push(new THREE.Vector2(R, SHIP.noseBase))
  const N = 30
  for (let i = 1; i <= N; i++) {
    const t = (i / N) * L
    // Tangent ogive, blunted at the tip.
    let r = Math.sqrt(Math.max(0, rho * rho - t * t)) + R - rho
    const tipBlend = Math.max(0, (t - (L - 1.6)) / 1.6)
    r = Math.max(0, r - tipBlend * tipBlend * 0.25)
    pts.push(new THREE.Vector2(Math.max(0.001, r), SHIP.noseBase + t - tipBlend * tipBlend * 0.35))
  }
  pts.push(new THREE.Vector2(0.001, SHIP.height - 0.3))
  return pts
}

/**
 * Stainless skin shared by the ship and the booster: ring sections 1.83 m
 * tall with weld seams, sheet-to-sheet tone and finish differences, and a
 * normal map of shallow ripples so reflections wander the way they do on the
 * real welded hull.
 */
export function steelSkin(env: THREE.Texture, bag: Bag, height: number): THREE.MeshStandardMaterial {
  const W = 256
  const H = 2048
  const rings = Math.round(height / 1.83)
  const draw = (rough: boolean) => (g: CanvasRenderingContext2D) => {
    g.fillStyle = rough ? '#404040' : '#c9ccd0'
    g.fillRect(0, 0, W, H)
    let seed = 7
    const rnd = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let r = 0; r < rings; r++) {
      const y0 = (r / rings) * H
      const hgt = H / rings
      const v = rnd()
      if (rough) {
        const c = 34 + v * 58
        g.fillStyle = `rgb(${c},${c},${c})`
      } else {
        const c = 200 + v * 26
        g.fillStyle = `rgb(${c},${c + 2},${c + 5})`
      }
      g.fillRect(0, y0, W, hgt)
      // Sheet joints and faint streaks.
      for (let k = 0; k < 9; k++) {
        const x = rnd() * W
        g.fillStyle = rough ? `rgba(255,255,255,${0.04 + rnd() * 0.1})` : `rgba(60,62,70,${0.03 + rnd() * 0.06})`
        g.fillRect(x, y0, 1 + rnd() * 5, hgt)
      }
      g.fillStyle = rough ? 'rgba(190,190,190,0.85)' : 'rgba(120,122,128,0.55)'
      g.fillRect(0, y0, W, 2.5)
    }
  }
  const map = canvasTexture(W, H, draw(false), bag)
  const roughnessMap = canvasTexture(W, H, draw(true), bag, false)
  // Ripple normal map: smooth low bumps, stretched round the hull, plus a groove at each seam.
  const nw = 128
  const nh = 1024
  const gw = 6
  const gh = 96
  let seed = 23
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const lattice = new Float32Array(gw * gh)
  for (let i = 0; i < lattice.length; i++) lattice[i] = rnd()
  const hAt = (x: number, y: number) => {
    const fx = ((x / nw) * gw + gw) % gw
    const fy = ((y / nh) * gh + gh) % gh
    const ix = Math.floor(fx)
    const iy = Math.floor(fy)
    const ux = fx - ix
    const uy = fy - iy
    const sx = ux * ux * (3 - 2 * ux)
    const sy = uy * uy * (3 - 2 * uy)
    const a = lattice[iy * gw + ix]
    const b = lattice[iy * gw + ((ix + 1) % gw)]
    const c = lattice[((iy + 1) % gh) * gw + ix]
    const d = lattice[((iy + 1) % gh) * gw + ((ix + 1) % gw)]
    const seam = Math.abs((((y / nh) * rings) % 1) - 0.5) > 0.47 ? -0.5 : 0
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy + seam
  }
  const normalMap = canvasTexture(
    nw,
    nh,
    (g) => {
      const img = g.createImageData(nw, nh)
      for (let y = 0; y < nh; y++) {
        for (let x = 0; x < nw; x++) {
          const dx = (hAt(x + 1, y) - hAt(x - 1, y)) * 1.1
          const dy = (hAt(x, y + 1) - hAt(x, y - 1)) * 2.2
          const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1)
          const k = (y * nw + x) * 4
          img.data[k] = (-dx * inv * 0.5 + 0.5) * 255
          img.data[k + 1] = (dy * inv * 0.5 + 0.5) * 255
          img.data[k + 2] = (inv * 0.5 + 0.5) * 255
          img.data[k + 3] = 255
        }
      }
      g.putImageData(img, 0, 0)
    },
    bag,
    false
  )
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map,
    roughnessMap,
    roughness: 0.62,
    metalness: 1,
    normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    envMap: env,
    envMapIntensity: 1.2,
  })
  bag.push(mat)
  return mat
}

function tileTexture(bag: Bag) {
  return canvasTexture(
    512,
    512,
    (g) => {
      g.fillStyle = '#17181a'
      g.fillRect(0, 0, 512, 512)
      // Hex tiles: 16 columns across, tileable.
      const cols = 16
      const w = 512 / cols
      const h = w * 1.1547
      const rows = Math.round(512 / (h * 0.75) / 2) * 2
      const rowH = 512 / rows
      let seed = 11
      const rnd = () => {
        seed = (seed * 16807) % 2147483647
        return seed / 2147483647
      }
      for (let r = -1; r <= rows; r++) {
        for (let c = -1; c <= cols; c++) {
          const cx = (c + (r & 1 ? 0.5 : 0)) * w + w / 2
          const cy = r * rowH + rowH / 2
          const v = 16 + rnd() * 16
          g.fillStyle = rnd() < 0.015 ? '#3a3b3e' : `rgb(${v},${v},${v + 2})`
          g.beginPath()
          for (let k = 0; k < 6; k++) {
            const a = (Math.PI / 3) * k + Math.PI / 6
            const px = cx + Math.cos(a) * w * 0.56
            const py = cy + Math.sin(a) * rowH * 0.645
            if (k) g.lineTo(px, py)
            else g.moveTo(px, py)
          }
          g.closePath()
          g.fill()
          g.strokeStyle = 'rgba(58,60,64,0.9)'
          g.lineWidth = 1.2
          g.stroke()
        }
      }
    },
    bag
  )
}

function flapShape(pts: [number, number][]): THREE.Shape {
  const s = new THREE.Shape()
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  return s
}

const PLUME_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`

const PLUME_FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
uniform float uTime;
uniform float uPower;
void main() {
  float along = clamp(1.0 - vUv.y, 0.0, 1.0); // 0 at the nozzle, 1 at the tail
  float rim = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  float flick = 0.9 + 0.1 * sin(uTime * 61.0 + along * 30.0) * sin(uTime * 37.0);
  // Shock diamonds near the nozzle.
  float diamonds = 0.7 + 0.3 * pow(abs(sin(along * 34.0 - uTime * 3.0)), 3.0) * smoothstep(0.4, 0.0, along);
  // Methane and oxygen in open air: a white-hot root, a long orange flame, a thin red tail.
  vec3 core = vec3(1.0, 0.97, 0.86);
  vec3 mid = vec3(1.0, 0.62, 0.22);
  vec3 tail = vec3(0.95, 0.3, 0.1);
  vec3 c = mix(core, mid, smoothstep(0.02, 0.3, along));
  c = mix(c, tail, smoothstep(0.35, 1.0, along));
  float a = (0.35 + 0.65 * rim) * flick * diamonds * pow(1.0 - along, 1.2) * uPower * 1.5;
  a = clamp(a, 0.0, 1.0);
  gl_FragColor = vec4(c * a * (2.2 + 5.0 * pow(1.0 - along, 6.0)), a);
}`

export function buildShip(env: THREE.Texture, bag: Bag): ShipModel {
  const group = new THREE.Group()
  const parts: THREE.Object3D[] = []
  const track = <T extends { dispose: () => void }>(x: T): T => {
    bag.push(x)
    return x
  }

  const steel = steelSkin(env, bag, SHIP.height)
  const tiles = tileTexture(bag)
  tiles.repeat.set(3, 12)
  const tileMat = track(
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: tiles, roughness: 0.38, metalness: 0.1, envMap: env, envMapIntensity: 1.0 })
  )
  const flapTiles = tiles.clone()
  flapTiles.repeat.set(0.16, 0.16)
  flapTiles.needsUpdate = true
  bag.push(flapTiles)
  const flapTileMat = track(
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: flapTiles, roughness: 0.38, metalness: 0.1, envMap: env, envMapIntensity: 1.0 })
  )
  const flapSteel = track(new THREE.MeshStandardMaterial({ color: 0xb9bdc2, roughness: 0.3, metalness: 1, envMap: env, envMapIntensity: 1.2 }))
  const dark = track(new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.7, metalness: 0.5, envMap: env }))
  const engineGlow = track(
    new THREE.MeshStandardMaterial({
      color: 0x3b3c40,
      roughness: 0.45,
      metalness: 0.9,
      envMap: env,
      emissive: new THREE.Color(1, 0.55, 0.3),
      emissiveIntensity: 0,
      side: THREE.DoubleSide,
    })
  )

  // Hull: the windward half is tiled, the leeward half is bare steel. The
  // tiles wrap slightly past the half-way line, as on the real ship.
  const profile = hullProfile()
  const wrap = 0.16
  const belly = track(new THREE.LatheGeometry(profile, 40, -Math.PI / 2 - wrap, Math.PI + wrap * 2))
  const lee = track(new THREE.LatheGeometry(profile, 40, Math.PI / 2 + wrap, Math.PI - wrap * 2))
  const bellyMesh = new THREE.Mesh(belly, tileMat)
  const leeMesh = new THREE.Mesh(lee, steel)
  bellyMesh.name = 'hull-belly'
  leeMesh.name = 'hull-lee'
  group.add(bellyMesh, leeMesh)
  parts.push(bellyMesh, leeMesh)

  // Leeward raceway and the aft skirt closure.
  const raceway = new THREE.Mesh(track(new THREE.BoxGeometry(0.7, SHIP.noseBase - 4, 0.35)), flapSteel)
  raceway.position.set(0, SHIP.noseBase / 2 + 1, -SHIP.radius - 0.1)
  const closure = new THREE.Mesh(track(new THREE.CircleGeometry(SHIP.radius - 0.05, 40)), dark)
  closure.rotation.x = Math.PI / 2
  closure.position.y = 1.9
  group.add(raceway, closure)

  // Catch pins, one each side under the forward flaps.
  const pinGeo = track(new THREE.CylinderGeometry(0.34, 0.34, 1.7, 14))
  pinGeo.rotateZ(Math.PI / 2)
  for (const s of [-1, 1]) {
    const pin = new THREE.Mesh(pinGeo, flapSteel)
    pin.position.set(s * (SHIP.catchReach - 0.85), SHIP.catchY, -0.6)
    const boss = new THREE.Mesh(track(new THREE.BoxGeometry(0.9, 1.6, 1.5)), flapSteel)
    boss.position.set(s * (SHIP.radius - 0.2), SHIP.catchY, -0.6)
    group.add(pin, boss)
  }

  // Flaps. Each is two thin plates: tiles to windward, steel to leeward.
  const fwdShape = flapShape([
    [1.6, 39.4],
    [7.5, 39.4],
    [7.9, 39.9],
    [7.9, 42.6],
    [6.9, 44.2],
    [3.0, 48.2],
    [1.6, 48.2],
  ])
  const aftShape = flapShape([
    [3.2, 0.8],
    [9.7, 0.8],
    [10.1, 1.4],
    [10.1, 8.6],
    [9.2, 10.4],
    [6.0, 14.6],
    [3.2, 14.6],
  ])
  const makeFlap = (shape: THREE.Shape, angle: number, name: string): THREE.Group => {
    const g = new THREE.Group()
    g.name = name
    const mirrored = Math.cos(angle) < 0
    const front = track(new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false }))
    const back = track(new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false }))
    back.translate(0, 0, -0.22)
    // After the rotation, local +z faces windward on the right flap and leeward on the left.
    const a = new THREE.Mesh(front, mirrored ? flapSteel : flapTileMat)
    const b = new THREE.Mesh(back, mirrored ? flapTileMat : flapSteel)
    g.add(a, b)
    g.rotation.y = angle
    return g
  }
  const lean = (20 * Math.PI) / 180
  const flaps = {
    fr: makeFlap(fwdShape, lean, 'flap-fr'),
    fl: makeFlap(fwdShape, Math.PI - lean, 'flap-fl'),
    ar: makeFlap(aftShape, 0, 'flap-ar'),
    al: makeFlap(aftShape, Math.PI, 'flap-al'),
  }
  for (const f of Object.values(flaps)) {
    group.add(f)
    parts.push(f)
  }

  // Engines: three sea-level Raptors in the centre, three vacuum Raptors around them.
  const bell = (rExit: number, len: number) => {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      pts.push(new THREE.Vector2(0.22 + (rExit - 0.22) * Math.pow(t, 0.62), -t * len))
    }
    return track(new THREE.LatheGeometry(pts, 20))
  }
  const sl = bell(0.65, 1.9)
  const vac = bell(1.2, 2.6)
  const engines = new THREE.Group()
  engines.name = 'engines'
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2
    const e = new THREE.Mesh(sl, engineGlow)
    e.position.set(Math.cos(a) * 0.95, 1.9, Math.sin(a) * 0.95)
    const v = new THREE.Mesh(vac, dark)
    v.position.set(Math.cos(a + Math.PI / 3) * 3.0, 2.3, Math.sin(a + Math.PI / 3) * 3.0)
    engines.add(e, v)
  }
  group.add(engines)
  parts.push(engines)

  // Exhaust: soft additive cones under the centre engines.
  const plumeGeo = track(new THREE.CylinderGeometry(0.66, 2.3, 58, 20, 14, true))
  plumeGeo.translate(0, -29, 0)
  const plumeMat = track(
    new THREE.ShaderMaterial({
      vertexShader: PLUME_VERT,
      fragmentShader: PLUME_FRAG,
      uniforms: { uTime: { value: 0 }, uPower: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  )
  const plume = new THREE.Mesh(plumeGeo, plumeMat)
  plume.position.y = 0.1
  plume.frustumCulled = false
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2
    if (i === 0) plume.position.set(Math.cos(a) * 0.95, 0.1, Math.sin(a) * 0.95)
    else {
      const p = new THREE.Mesh(plumeGeo, plumeMat)
      p.frustumCulled = false
      p.position.set(Math.cos(a) * 0.95 - plume.position.x, 0, Math.sin(a) * 0.95 - plume.position.z)
      plume.add(p)
    }
  }
  group.add(plume)
  const light = new THREE.PointLight(0xffa860, 0, 220, 2)
  light.position.y = -8
  group.add(light)

  group.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && m.material !== plumeMat) {
      m.castShadow = true
      m.receiveShadow = true
    }
  })
  return { group, parts, flaps, plume, plumeMat, engineGlow, light }
}
