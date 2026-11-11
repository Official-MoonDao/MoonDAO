/**
 * Touchdown models, all built from primitives at load: the lander (in
 * separable parts, so a crash throws real lander pieces, not blocks) and a
 * low-poly Moon Base Zero that sits a few hundred metres past the pad.
 */
import * as THREE from 'three'
import { mulberry32 } from '@/lib/touchdown/mission'
import { PAD_DROP } from '@/lib/touchdown/physics'

export type Bag = { dispose: () => void }[]

/** Tileable value-noise height field, 0..1. */
export function tileNoise(size: number, periods: number[], amps: number[], seed: number): Float32Array {
  const rng = mulberry32(seed)
  const out = new Float32Array(size * size)
  let total = 0
  periods.forEach((p, o) => {
    const lat = new Float32Array(p * p)
    for (let i = 0; i < lat.length; i++) lat[i] = rng()
    const amp = amps[o]
    total += amp
    const scale = p / size
    for (let y = 0; y < size; y++) {
      const gy = y * scale
      const iy = Math.floor(gy)
      const fy = gy - iy
      const v = fy * fy * (3 - 2 * fy)
      const y0 = (iy % p) * p
      const y1 = ((iy + 1) % p) * p
      for (let x = 0; x < size; x++) {
        const gx = x * scale
        const ix = Math.floor(gx)
        const fx = gx - ix
        const u = fx * fx * (3 - 2 * fx)
        const x0 = ix % p
        const x1 = (ix + 1) % p
        const a = lat[y0 + x0] + (lat[y0 + x1] - lat[y0 + x0]) * u
        const b = lat[y1 + x0] + (lat[y1 + x1] - lat[y1 + x0]) * u
        out[y * size + x] += (a + (b - a) * v) * amp
      }
    }
  })
  for (let i = 0; i < out.length; i++) out[i] /= total
  return out
}

function grayTexture(data: Float32Array, size: number, map: (h: number) => [number, number, number]): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const img = g.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    const [r, gg, b] = map(data[i])
    img.data[i * 4] = r
    img.data[i * 4 + 1] = gg
    img.data[i * 4 + 2] = b
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

/**
 * Regolith: a height field with grain at several scales, pits and pebbles.
 * Returns an albedo map and a bump map from the same field, so the low sun
 * rakes across real micro-relief instead of a flat blurry texture.
 */
export function regolithTextures(seed: number, size: number, bag: Bag) {
  const h = tileNoise(size, [4, 9, 19, 41, 83, 167], [1, 0.8, 0.62, 0.5, 0.42, 0.36], seed)
  const rng = mulberry32(seed ^ 0x9e37)
  const stamp = (cx: number, cy: number, r: number, f: (d: number) => number) => {
    const R = Math.ceil(r * 1.5)
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy) / r
        if (d > 1.5) continue
        const x = (((cx + dx) % size) + size) % size
        const y = (((cy + dy) % size) + size) % size
        h[y * size + x] += f(d)
      }
    }
  }
  const k = size / 1024
  for (let i = 0; i < 110; i++) {
    const r = (3 + Math.pow(rng(), 3) * 46) * k
    const depth = 0.05 + rng() * 0.1
    stamp(Math.floor(rng() * size), Math.floor(rng() * size), r, (d) =>
      d < 1 ? depth * (d * d - 1) + 0.03 * d * d : 0.03 * Math.exp(-(d - 1) * 6)
    )
  }
  for (let i = 0; i < 900; i++) {
    const r = (1.5 + Math.pow(rng(), 2.5) * 7) * k
    const height = 0.1 + rng() * 0.22
    stamp(Math.floor(rng() * size), Math.floor(rng() * size), r, (d) => (d < 1 ? height * (1 - d * d) : 0))
  }
  const bump = grayTexture(h, size, (v) => {
    const c = Math.max(0, Math.min(255, v * 255))
    return [c, c, c]
  })
  const albedo = grayTexture(h, size, (v) => {
    const c = Math.max(0, Math.min(255, 198 + (v - 0.5) * 95))
    return [c * 1.02, c, c * 0.955]
  })
  albedo.colorSpace = THREE.SRGBColorSpace
  bag.push(bump, albedo)
  return { albedo, bump }
}

/** A tiny reflection environment: black sky, one hot sun, sunlit ground. Gives metal something to reflect. */
export function makeEnvMap(renderer: THREE.WebGLRenderer, sunDir: [number, number, number], bag: Bag): THREE.Texture {
  const env = new THREE.Scene()
  env.background = new THREE.Color(0x000000)
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(9, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.7, 4.2) })
  )
  sun.position.set(sunDir[0] * 100, sunDir[1] * 100 + 6, sunDir[2] * 100)
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(400, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.19, 0.18) })
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -3
  // A soft bright band low on the sun side: the lit terrain out to the horizon.
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(300, 300, 26, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.31, 0.29), side: THREE.BackSide })
  )
  band.position.y = 6
  env.add(sun, ground, band)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const rt = pmrem.fromScene(env, 0.03)
  pmrem.dispose()
  for (const m of [sun, ground, band]) {
    m.geometry.dispose()
    ;(m.material as THREE.Material).dispose()
  }
  bag.push(rt)
  return rt.texture
}

export type LanderModel = {
  group: THREE.Group
  /** Top-level pieces that fly apart on a break-up. */
  parts: THREE.Object3D[]
  legs: THREE.Group[]
  plume: THREE.Mesh
  plumeCore: THREE.Mesh
  nav: THREE.Mesh
  glow: THREE.PointLight
  /** Attitude-thruster puffs. `axis` is the body axis the quad sits on, `side` its sign, `up` whether exhaust goes up. */
  jets: { mesh: THREE.Mesh; axis: 'x' | 'z'; side: number; up: boolean }[]
}

export function buildLander(env: THREE.Texture, logo: THREE.Texture | null, seed: number, bag: Bag): LanderModel {
  const group = new THREE.Group()
  const parts: THREE.Object3D[] = []
  const track = <T extends { dispose: () => void }>(x: T): T => {
    bag.push(x)
    return x
  }

  // Crinkled foil: facet noise as a bump map.
  const crinkle = grayTexture(tileNoise(128, [9, 23, 47], [1, 0.8, 0.5], seed ^ 0xf01), 128, (v) => {
    const c = v * 255
    return [c, c, c]
  })
  crinkle.repeat.set(3, 2)
  track(crinkle)
  const std = (o: THREE.MeshStandardMaterialParameters) =>
    track(new THREE.MeshStandardMaterial({ envMap: env, envMapIntensity: 1, ...o }))
  const foil = std({ color: 0xffbf52, metalness: 1, roughness: 0.44, bumpMap: crinkle, bumpScale: 2.2 })
  const silver = std({ color: 0xd6dae2, metalness: 1, roughness: 0.3, bumpMap: crinkle, bumpScale: 1.2 })
  const white = std({ color: 0xc9cacf, metalness: 0.1, roughness: 0.6 })
  const dark = std({ color: 0x17181b, metalness: 0.75, roughness: 0.45 })
  const strut = std({ color: 0xc4c8d0, metalness: 1, roughness: 0.28 })

  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = group) => {
    const m = new THREE.Mesh(track(geo), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  const part = (name: string) => {
    const g = new THREE.Group()
    g.name = name
    group.add(g)
    parts.push(g)
    return g
  }

  // --- Descent stage: foil-wrapped octagon with a skirt ---------------------------
  const body = part('body')
  mesh(new THREE.CylinderGeometry(1.36, 1.6, 1.42, 8), foil, 0, -0.16, 0, body).rotation.y = Math.PI / 8
  mesh(new THREE.CylinderGeometry(1.62, 1.5, 0.16, 8), silver, 0, -0.93, 0, body).rotation.y = Math.PI / 8
  mesh(new THREE.CylinderGeometry(1.4, 1.38, 0.1, 8), dark, 0, 0.58, 0, body).rotation.y = Math.PI / 8
  // MoonDAO panels on the four faces that look down the main axes.
  if (logo) {
    const img = logo.image as { width: number; height: number } | undefined
    const aspect = img && img.height ? img.width / img.height : 1
    // The logo mark (no wordmark) sits straight on the foil; its own background is transparent.
    const lh = 0.86
    const lw = lh * aspect
    const logoMat = track(
      new THREE.MeshBasicMaterial({ map: logo, transparent: true, depthWrite: false, toneMapped: false })
    )
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      const holder = new THREE.Group()
      holder.rotation.y = -a + Math.PI / 2
      body.add(holder)
      const l = new THREE.Mesh(track(new THREE.PlaneGeometry(lw * 0.92, lh * 0.92)), logoMat)
      l.position.set(0, -0.14, 1.392)
      l.rotation.x = -0.16
      holder.add(l)
    }
  }

  // --- Ascent deck: equipment, dish, panel ----------------------------------------
  const deck = part('deck')
  mesh(new THREE.CylinderGeometry(0.98, 1.28, 0.5, 8), white, 0, 0.88, 0, deck).rotation.y = Math.PI / 8
  mesh(new THREE.BoxGeometry(0.7, 0.34, 0.5), silver, 0.2, 1.28, -0.35, deck)
  mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 6), strut, 0.38, 1.5, 0.24, deck)
  const dish = mesh(new THREE.SphereGeometry(0.44, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.5), white, 0.38, 1.76, 0.24, deck)
  dish.rotation.set(Math.PI * 0.82, 0, 0.3)
  dish.material = std({ color: 0xc9cacf, metalness: 0.2, roughness: 0.5, side: THREE.DoubleSide })
  // Solar panel with a cell grid.
  const pc = document.createElement('canvas')
  pc.width = 128
  pc.height = 64
  const pg = pc.getContext('2d')!
  pg.fillStyle = '#0b1f52'
  pg.fillRect(0, 0, 128, 64)
  pg.strokeStyle = 'rgba(170,190,255,0.55)'
  pg.lineWidth = 1
  for (let x = 0; x <= 128; x += 16) {
    pg.beginPath()
    pg.moveTo(x, 0)
    pg.lineTo(x, 64)
    pg.stroke()
  }
  for (let y = 0; y <= 64; y += 16) {
    pg.beginPath()
    pg.moveTo(0, y)
    pg.lineTo(128, y)
    pg.stroke()
  }
  const ptex = track(new THREE.CanvasTexture(pc))
  ptex.colorSpace = THREE.SRGBColorSpace
  const panel = mesh(
    new THREE.BoxGeometry(1.5, 0.04, 0.9),
    std({ map: ptex, metalness: 0.85, roughness: 0.22 }),
    -0.42,
    1.17,
    -0.1,
    deck
  )
  panel.rotation.z = 0.12
  const nav = mesh(
    new THREE.SphereGeometry(0.06, 8, 6),
    track(new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.4, 0.3), toneMapped: false })),
    -0.72,
    1.2,
    0.62,
    deck
  )
  nav.castShadow = false

  // --- Tanks and RCS quads ---------------------------------------------------------
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const t = part(`tank${i}`)
    t.position.set(Math.cos(a) * 1.22, 0.22, Math.sin(a) * 1.22)
    mesh(new THREE.SphereGeometry(0.5, 20, 14), silver, 0, 0, 0, t)
    mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 24), dark, 0, 0, 0, t).rotation.x = Math.PI / 2
  }
  // Four thruster quads, one per side. Each has an up and a down jet that
  // puff when the attitude control asks for torque.
  const jets: LanderModel['jets'] = []
  const jetMat = track(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.4, 2.6, 3.2),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
  )
  const jetGeo = track(new THREE.ConeGeometry(0.16, 0.95, 10, 1, true))
  jetGeo.translate(0, -0.475, 0) // apex at the nozzle, widening away from it
  for (const axis of ['x', 'z'] as const) {
    for (const s of [1, -1]) {
      const quad = part(`rcs${axis}${s}`)
      quad.position.set(axis === 'x' ? s * 1.48 : 0, 0.78, axis === 'z' ? s * 1.48 : 0)
      const inward = axis === 'x' ? new THREE.Vector3(-s * 0.12, 0, 0) : new THREE.Vector3(0, 0, -s * 0.12)
      mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), dark, inward.x, 0, inward.z, quad)
      for (const up of [true, false]) {
        const nozzle = mesh(new THREE.ConeGeometry(0.055, 0.15, 8, 1, true), strut, 0, up ? 0.14 : -0.14, 0, quad)
        nozzle.rotation.z = up ? Math.PI : 0
        const jet = new THREE.Mesh(jetGeo, jetMat)
        jet.position.set(0, up ? 0.2 : -0.2, 0)
        jet.rotation.z = up ? Math.PI : 0
        jet.visible = false
        quad.add(jet)
        jets.push({ mesh: jet, axis, side: s, up })
      }
    }
  }

  // --- Engine ------------------------------------------------------------------------
  const engine = part('engine')
  engine.position.y = -1.08
  const bell = mesh(new THREE.CylinderGeometry(0.24, 0.6, 0.62, 20, 1, true), dark, 0, 0, 0, engine)
  bell.material = std({ color: 0x2a2b30, metalness: 1, roughness: 0.35, side: THREE.DoubleSide })
  mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12), strut, 0, 0.36, 0, engine)

  // --- Legs: each a group pivoting at the hull, so a collapse can fold it -------------
  const legs: THREE.Group[] = []
  const up = new THREE.Vector3(0, 1, 0)
  const cyl = (from: THREE.Vector3, to: THREE.Vector3, r: number, parent: THREE.Object3D, mat: THREE.Material = strut) => {
    const d = to.clone().sub(from)
    const m = mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), mat, 0, 0, 0, parent)
    m.position.copy(from).addScaledVector(d, 0.5)
    m.quaternion.setFromUnitVectors(up, d.normalize())
  }
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ]) {
    const g = part(`leg${legs.length}`) as THREE.Group
    const pivot = new THREE.Vector3(sx * 1.05, -0.2, sz * 1.05)
    g.position.copy(pivot)
    const foot = new THREE.Vector3(sx * 1.9, -PAD_DROP + 0.07, sz * 1.9).sub(pivot)
    cyl(new THREE.Vector3(0, 0, 0), foot, 0.075, g, foil)
    cyl(new THREE.Vector3(0, 0, 0), foot.clone().multiplyScalar(0.45), 0.1, g, silver)
    cyl(new THREE.Vector3(-sx * 0.12, -0.62, -sz * 0.12), foot.clone().multiplyScalar(0.64), 0.04, g)
    cyl(new THREE.Vector3(-sx * 0.35, -0.3, sz * 0.25), foot.clone().multiplyScalar(0.64), 0.03, g)
    cyl(new THREE.Vector3(sx * 0.25, -0.3, -sz * 0.35), foot.clone().multiplyScalar(0.64), 0.03, g)
    mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.1, 16), foil, foot.x, foot.y - 0.02, foot.z, g)
    mesh(new THREE.SphereGeometry(0.11, 10, 8), strut, foot.x, foot.y + 0.06, foot.z, g)
    g.userData.axis = new THREE.Vector3(sz, 0, -sx).normalize()
    legs.push(g)
  }

  // --- Exhaust: in vacuum it fans out wide and faint -----------------------------------
  const plumeMat = (opacity: number, color: THREE.Color) =>
    track(
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    )
  const pgeo = track(new THREE.ConeGeometry(1.7, 6, 24, 1, true))
  pgeo.translate(0, -3, 0)
  const plume = new THREE.Mesh(pgeo, plumeMat(0.05, new THREE.Color(0.6, 0.78, 1)))
  plume.position.y = -1.36
  const cgeo = track(new THREE.ConeGeometry(0.42, 2.4, 18, 1, true))
  cgeo.translate(0, -1.2, 0)
  const plumeCore = new THREE.Mesh(cgeo, plumeMat(0.55, new THREE.Color(3.2, 2.6, 1.9)))
  plumeCore.position.y = -1.36
  const glow = new THREE.PointLight(0xffd9a8, 0, 34, 1.7)
  glow.position.y = -2.4
  group.add(plume, plumeCore, glow)

  return { group, parts, legs, plume, plumeCore, nav, glow, jets }
}
