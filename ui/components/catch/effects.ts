/**
 * Fire, smoke, spray and wreckage for Catch. One pool of camera-facing quads
 * drawn in a single call: each particle carries a "heat" that cools from
 * white-hot flame (additive) to dark smoke (ordinary blending), which is what
 * makes a fireball roll upward and turn into a smoke column.
 */
import * as THREE from 'three'
import type { Bag } from './util'

const MAX = 900

type P = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  max: number
  size: number
  grow: number
  /** 1 flame .. 0 smoke; cools at `cool` per second. */
  heat: number
  cool: number
  /** Smoke colour (0 black .. 1 white) and opacity. */
  shade: number
  alpha: number
  drag: number
  rise: number
  gravity: number
  spin: number
}

const VERT = /* glsl */ `
attribute vec3 aCenter;
attribute vec4 aColor;
attribute vec2 aSize;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vUv = uv;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(aCenter, 1.0);
  float c = cos(aSize.y);
  float s = sin(aSize.y);
  vec2 corner = (uv - 0.5) * aSize.x;
  mv.xy += vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);
  gl_Position = projectionMatrix * mv;
}`

const FRAG = /* glsl */ `
uniform sampler2D uPuff;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  float a = texture2D(uPuff, vUv).r;
  // Premultiplied: rgb already carries the flame's glow, alpha only the smoke.
  gl_FragColor = vec4(vColor.rgb * a, vColor.a * a);
}`

export type Debris = { obj: THREE.Object3D; v: THREE.Vector3; w: THREE.Vector3; r: number; rest: boolean; trail: number; wet: boolean }

export class Effects {
  readonly mesh: THREE.Mesh
  readonly debris: Debris[] = []
  private parts: P[] = []
  private center: Float32Array
  private color: Float32Array
  private size: Float32Array
  private geo: THREE.BufferGeometry
  private rngState = 12345

  constructor(bag: Bag) {
    const geo = new THREE.BufferGeometry()
    const uv = new Float32Array(MAX * 8)
    const idx = new Uint16Array(MAX * 6)
    for (let i = 0; i < MAX; i++) {
      uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8)
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6)
    }
    this.center = new Float32Array(MAX * 12)
    this.color = new Float32Array(MAX * 16)
    this.size = new Float32Array(MAX * 8)
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 12), 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.setAttribute('aCenter', new THREE.BufferAttribute(this.center, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 4).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 2).setUsage(THREE.DynamicDrawUsage))
    geo.setIndex(new THREE.BufferAttribute(idx, 1))
    geo.setDrawRange(0, 0)
    this.geo = geo

    // A soft, slightly ragged puff.
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = '#000'
    g.fillRect(0, 0, 128, 128)
    const blob = (x: number, y: number, r: number, a: number) => {
      const grad = g.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, `rgba(255,255,255,${a})`)
      grad.addColorStop(0.5, `rgba(255,255,255,${a * 0.45})`)
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 128, 128)
    }
    g.globalCompositeOperation = 'lighter'
    blob(64, 64, 60, 0.85)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.283
      blob(64 + Math.cos(a) * 26, 64 + Math.sin(a) * 26, 26 + (i % 3) * 5, 0.3)
    }
    const puff = new THREE.CanvasTexture(c)
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uPuff: { value: puff } },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquation: THREE.AddEquation,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 5
    bag.push(geo, mat, puff)
  }

  private rnd(): number {
    this.rngState = (this.rngState * 16807) % 2147483647
    return this.rngState / 2147483647
  }

  private add(p: P) {
    if (this.parts.length >= MAX) this.parts.shift()
    this.parts.push(p)
  }

  clear() {
    this.parts.length = 0
    this.debris.length = 0
    this.geo.setDrawRange(0, 0)
  }

  /** A rolling fireball that becomes a smoke column. `scale` 1 is a full ship's worth. */
  fireball(x: number, y: number, z: number, scale: number) {
    const n = Math.round(120 * Math.min(1.6, scale) + 30)
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * 6.283
      const up = this.rnd()
      const sp = (8 + this.rnd() * 34) * scale
      this.add({
        x: x + (this.rnd() - 0.5) * 10 * scale,
        y: y + this.rnd() * 8 * scale,
        z: z + (this.rnd() - 0.5) * 10 * scale,
        vx: Math.cos(a) * sp * (1 - up * 0.6),
        vy: (6 + up * 30) * scale,
        vz: Math.sin(a) * sp * (1 - up * 0.6),
        life: 0,
        max: 6 + this.rnd() * 7,
        size: (12 + this.rnd() * 18) * scale,
        grow: (10 + this.rnd() * 9) * scale,
        heat: 1,
        cool: 0.28 + this.rnd() * 0.34,
        shade: 0.025 + this.rnd() * 0.06,
        alpha: 0.88,
        drag: 1.1,
        rise: 5 + this.rnd() * 6,
        gravity: 0,
        spin: (this.rnd() - 0.5) * 0.6,
      })
    }
    // Streamers thrown high and wide.
    for (let i = 0; i < 26 * scale; i++) {
      const a = this.rnd() * 6.283
      const sp = (30 + this.rnd() * 55) * scale
      this.add({
        x,
        y: y + 4,
        z,
        vx: Math.cos(a) * sp,
        vy: (25 + this.rnd() * 55) * scale,
        vz: Math.sin(a) * sp,
        life: 0,
        max: 2.2 + this.rnd() * 1.6,
        size: 3 + this.rnd() * 4,
        grow: 3,
        heat: 1,
        cool: 0.5,
        shade: 0.1,
        alpha: 0.5,
        drag: 0.25,
        rise: 0,
        gravity: 9.8,
        spin: 0,
      })
    }
  }

  /** Thick smoke from something that keeps burning. */
  smoke(x: number, y: number, z: number, size: number, hot = 0.25) {
    this.add({
      x: x + (this.rnd() - 0.5) * size * 0.5,
      y,
      z: z + (this.rnd() - 0.5) * size * 0.5,
      vx: (this.rnd() - 0.5) * 3,
      vy: 5 + this.rnd() * 5,
      vz: (this.rnd() - 0.5) * 3,
      life: 0,
      max: 6 + this.rnd() * 4,
      size,
      grow: size * 0.55,
      heat: hot,
      cool: 0.5,
      shade: 0.06 + this.rnd() * 0.08,
      alpha: 0.6,
      drag: 0.4,
      rise: 3,
      gravity: 0,
      spin: (this.rnd() - 0.5) * 0.4,
    })
  }

  /** White water thrown up by something hitting the sea. */
  splash(x: number, z: number, scale: number) {
    for (let i = 0; i < 90; i++) {
      const a = this.rnd() * 6.283
      const sp = (4 + this.rnd() * 22) * scale
      this.add({
        x,
        y: 0.5,
        z,
        vx: Math.cos(a) * sp,
        vy: (12 + this.rnd() * 38) * scale,
        vz: Math.sin(a) * sp,
        life: 0,
        max: 2.5 + this.rnd() * 2,
        size: (4 + this.rnd() * 7) * scale,
        grow: 5 * scale,
        heat: 0,
        cool: 0,
        shade: 0.95,
        alpha: 0.55,
        drag: 0.5,
        rise: 0,
        gravity: 9.8,
        spin: 0,
      })
    }
  }

  /** Exhaust washing over the ground or the sea under a low burn. */
  wash(x: number, z: number, dx: number, dz: number, wet: boolean, strength: number) {
    this.add({
      x: x + dx * 3,
      y: 1 + this.rnd() * 2,
      z: z + dz * 3,
      vx: dx * (16 + this.rnd() * 18),
      vy: 1 + this.rnd() * 5,
      vz: dz * (16 + this.rnd() * 18),
      life: 0,
      max: 1.6 + this.rnd() * 1.4,
      size: 5 + this.rnd() * 5,
      grow: 9,
      heat: wet ? 0 : 0.15 * strength,
      cool: 1,
      shade: wet ? 0.95 : 0.62,
      alpha: 0.28 * strength,
      drag: 1.4,
      rise: 1.5,
      gravity: 0,
      spin: (this.rnd() - 0.5) * 0.5,
    })
  }

  update(dt: number, windX: number, windZ: number, seaAt: (x: number, z: number) => boolean) {
    const parts = this.parts
    let n = 0
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      p.life += dt
      if (p.life >= p.max) continue
      const k = Math.exp(-p.drag * dt)
      p.vx = p.vx * k + windX * (1 - k) * 0.6
      p.vz = p.vz * k + windZ * (1 - k) * 0.6
      p.vy = p.vy * k + (p.rise * (1 - p.heat * 0.3) - p.gravity) * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      if (p.y < 0.3 && p.gravity > 0) {
        p.life = p.max
        continue
      }
      p.heat = Math.max(0, p.heat - p.cool * dt)
      p.size += p.grow * dt * (1 - 0.6 * (p.life / p.max))
      parts[n++] = p
    }
    parts.length = n
    for (let i = 0; i < n; i++) {
      const p = parts[i]
      const u = p.life / p.max
      const fade = Math.min(1, p.life * 6) * (1 - u) * (1 - u * 0.4)
      const h = p.heat
      // Flame: white core cooling through yellow and orange to deep red.
      const fr = 2.6 * h
      const fg = 1.5 * h * h + 0.22 * h
      const fb = 0.75 * h * h * h * h
      const sa = p.alpha * fade * (1 - h * 0.85)
      const s = p.shade
      for (let c = 0; c < 4; c++) {
        const o = i * 4 + c
        this.center[o * 3] = p.x
        this.center[o * 3 + 1] = p.y
        this.center[o * 3 + 2] = p.z
        this.color[o * 4] = fr * fade + s * sa
        this.color[o * 4 + 1] = fg * fade + s * sa
        this.color[o * 4 + 2] = fb * fade + s * sa
        this.color[o * 4 + 3] = sa
        this.size[o * 2] = p.size
        this.size[o * 2 + 1] = p.spin * p.life + i
      }
    }
    this.geo.attributes.aCenter.needsUpdate = true
    this.geo.attributes.aColor.needsUpdate = true
    this.geo.attributes.aSize.needsUpdate = true
    this.geo.setDrawRange(0, n * 6)

    // Wreckage: ballistic, tumbling, trailing fire until it comes to rest.
    for (const d of this.debris) {
      if (d.rest) continue
      d.v.y -= 9.81 * dt
      d.v.multiplyScalar(Math.exp(-0.05 * dt))
      d.obj.position.addScaledVector(d.v, dt)
      d.obj.rotateOnWorldAxis(scratch.copy(d.w).normalize(), d.w.length() * dt)
      d.trail -= dt
      if (d.trail <= 0 && d.obj.position.y > 2) {
        d.trail = 0.05
        this.smoke(d.obj.position.x, d.obj.position.y, d.obj.position.z, d.r * 1.4, 0.9)
      }
      if (d.obj.position.y < d.r * 0.4) {
        d.obj.position.y = d.r * 0.4
        const wet = seaAt(d.obj.position.x, d.obj.position.z)
        if (wet) {
          if (!d.wet && d.v.length() > 8) this.splash(d.obj.position.x, d.obj.position.z, Math.min(1, d.r / 8))
          d.wet = true
          d.v.set(0, 0, 0)
          d.w.multiplyScalar(0)
          d.rest = true
          d.obj.position.y = -d.r * 0.3
        } else if (Math.abs(d.v.y) < 3) {
          d.rest = true
        } else {
          d.v.y *= -0.25
          d.v.x *= 0.6
          d.v.z *= 0.6
          d.w.multiplyScalar(0.5)
        }
      }
    }
  }
}

const scratch = new THREE.Vector3()
