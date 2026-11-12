/**
 * Touchdown render + game loop. Plain three.js, no React: the loop and the
 * physics never wait on a React render. The React shell (TouchdownGame.tsx)
 * feeds input in and receives HUD/callout/end callbacks.
 */
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { botInput } from '@/lib/touchdown/autopilot'
import { mulberry32 } from '@/lib/touchdown/mission'
import type { ModeConfig } from '@/lib/touchdown/modes'
import {
  altitudeAGL,
  createSim,
  distanceToTarget,
  PAD_DROP,
  stepSim,
  SUBSTEP_DT,
  tiltDeg,
  type Sim,
  type SimInput,
} from '@/lib/touchdown/physics'
import { scoreFlight, type FlightResult } from '@/lib/touchdown/scoring'
import {
  CELL,
  FINE_CELL,
  FINE_HALF_CELLS,
  FINE_N,
  GRID_N,
  heightAt,
  MAP_SIZE,
  MOON_RADIUS,
  normalAt,
  sunAt,
  type Terrain,
} from '@/lib/touchdown/terrain'
import type { TouchdownAudio } from './audio'
import { buildLander, makeEnvMap, regolithTextures, type Bag, type LanderModel } from './models'
import { buildMoonBase, type BaseModel } from './moonbase'

export type HudState = {
  alt: number
  vspeed: number
  hspeed: number
  fuel: number
  dist: number
  tilt: number
  burning: boolean
  /** Pad marker in CSS fractions of the canvas; clamped to the edge when off-screen. */
  tx: number
  ty: number
  tOnScreen: boolean
  /** Moon Base Zero label position. */
  bx: number
  by: number
  bOnScreen: boolean
  prompt: string
  promptTone: 'info' | 'warn'
}

export type Callout = { text: string; tone: 'info' | 'warn' | 'good' | 'bad' }

export type EngineCallbacks = {
  onHud: (hud: HudState) => void
  onCallout: (c: Callout) => void
  /** Fires once the end-shot camera has settled. */
  onEnd: (result: FlightResult) => void
}

type Phase = 'idle' | 'flying' | 'ending' | 'result' | 'tobase'
type Debris = { obj: THREE.Object3D; v: THREE.Vector3; w: THREE.Vector3; r: number; rest: boolean }

const HALF = MAP_SIZE / 2
const v3 = () => new THREE.Vector3()

export class TouchdownEngine {
  autopilot = false

  private renderer: THREE.WebGLRenderer
  private composer: EffectComposer | null = null
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(55, 1, 0.4, 140000)
  private sunLight = new THREE.DirectionalLight(0xfff1dc, 8.5)
  private terrain: Terrain
  private sim!: Sim
  private mode!: ModeConfig
  private phase: Phase = 'idle'
  private raf = 0
  private last = 0
  private acc = 0
  private timeScale = 1
  private slowUntil = 0
  private clock = 0
  private phaseT = 0
  private hudT = 0
  private disposed = false
  private mobile: boolean
  private rng = mulberry32(1234567)
  private bag: Bag = []
  private landerBag: Bag = []
  private env!: THREE.Texture
  private logo: THREE.Texture | null = null
  private flag: THREE.Texture | null = null

  // Player control: `want` is what the stick/keys ask for, `stick` is the
  // smoothed value fed to the sim (so a key tap is a small tilt, not a slam).
  private want = { x: 0, y: 0, burn: false, analog: false }
  private stick = { x: 0, y: 0 }
  private simInput: SimInput = { x: 0, y: 0, burn: false }

  private lander!: LanderModel
  private legFold = [0, 0, 0, 0]
  private exploded = false
  private base!: BaseModel
  private beam!: THREE.Mesh
  private impactRing!: THREE.Mesh
  private blast!: THREE.Mesh
  private skyGroup = new THREE.Group()
  private dust!: THREE.LineSegments
  private dustPos!: Float32Array
  private dustCol!: Float32Array
  private dustVel!: Float32Array
  private dustLife!: Float32Array
  private dustMax!: Float32Array
  private dustLit!: Float32Array
  private dustNext = 0
  // Haze: soft sunlit puffs that make up the body of the blast sheet.
  private haze!: THREE.Points
  private hazePos!: Float32Array
  private hazeCol!: Float32Array
  private hazeVel!: Float32Array
  private hazeLife!: Float32Array
  private hazeMax!: Float32Array
  private hazeLit!: Float32Array
  private hazeNext = 0
  private debris: Debris[] = []
  private extras: THREE.Object3D[] = []
  private flash = new THREE.PointLight(0xffc27a, 0, 160, 1.5)

  // Camera
  private camPos = v3()
  private camLook = v3()
  private camYaw = 0
  private camPitch = 0
  private camZoom = 1
  private shake = 0
  private endFrom = v3()
  private endLookFrom = v3()
  private endTo = v3()
  private endLook = v3()
  /** Where the live camera aims: below the subject on portrait, so the subject
   * sits in the top of the screen, clear of the result sheet. */
  private endAim = v3()
  private endAngle = 0
  private endDist = 13
  private result: FlightResult | null = null
  private endFired = false
  private baseDone: (() => void) | null = null

  private hud: HudState = {
    alt: 0,
    vspeed: 0,
    hspeed: 0,
    fuel: 1,
    dist: 0,
    tilt: 0,
    burning: false,
    tx: 0.5,
    ty: 0.5,
    tOnScreen: false,
    bx: 0.5,
    by: 0.5,
    bOnScreen: false,
    prompt: '',
    promptTone: 'info',
  }
  private altMarks: number[] = []
  private fuelMarks: number[] = []
  private alarmAt = -1
  private alarmStage = 0
  private dustCalled = false
  private baseCalled = false
  private runCount = 0
  private quindarOutAt = -1
  private rcsSoundAt = 0

  constructor(
    private canvas: HTMLCanvasElement,
    terrain: Terrain,
    private cb: EngineCallbacks,
    private audio: TouchdownAudio,
    opts: { mobile: boolean }
  ) {
    this.terrain = terrain
    this.mobile = opts.mobile
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.mobile ? 1.5 : 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.scene.background = new THREE.Color(0x000000)

    this.env = makeEnvMap(this.renderer, terrain.sunDir, this.bag)
    this.buildLights()
    this.buildTerrain()
    this.buildRocks()
    this.buildSky()
    this.buildTarget()
    this.buildBase()
    this.buildDust()
    this.lander = buildLander(this.env, null, terrain.seed, this.landerBag)
    this.scene.add(this.lander.group)
    this.loadTextures()
    if (!opts.mobile) this.buildComposer()
    this.resize()
  }

  // ---------------------------------------------------------------------------
  // Scene construction
  // ---------------------------------------------------------------------------

  private track<T extends { dispose: () => void }>(x: T): T {
    this.bag.push(x)
    return x
  }

  private buildComposer() {
    try {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
      const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 })
      const composer = new EffectComposer(this.renderer, target)
      composer.addPass(new RenderPass(this.scene, this.camera))
      // Only genuinely hot pixels bloom: the engine, the sun, base lights.
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.38, 0.6, 3.4))
      composer.addPass(new OutputPass())
      this.composer = composer
      this.bag.push(target)
    } catch {
      this.composer = null
    }
  }

  /** Photographic Earth, the logo and the flag arrive after first paint; the game never waits on them. */
  private loadTextures() {
    const loader = new THREE.TextureLoader()
    const load = (url: string, done: (t: THREE.Texture) => void) =>
      loader.load(
        url,
        (t) => {
          if (this.disposed) {
            t.dispose()
            return
          }
          t.colorSpace = THREE.SRGBColorSpace
          this.bag.push(t)
          done(t)
        },
        undefined,
        () => {}
      )
    load('/touchdown/moondao-mark.png', (t) => {
      this.logo = t
      t.anisotropy = 8
      if (!this.exploded) this.rebuildLander()
    })
    load('/flat-moondao-flag.png', (t) => {
      this.flag = t
      this.scene.remove(this.base.group)
      this.buildBase()
    })
    // Earth: day map and cloud layer composited into ONE texture on one sphere.
    // Two nested spheres 90 km away fight for the same depth and flicker.
    const day = new Image()
    const cloud = new Image()
    let ready = 0
    const compose = () => {
      if (++ready < 2 || this.disposed) return
      const c = document.createElement('canvas')
      c.width = 2048
      c.height = 1024
      const g = c.getContext('2d')
      if (!g) return
      g.drawImage(day, 0, 0, c.width, c.height)
      g.globalAlpha = 0.92
      g.drawImage(cloud, 0, 0, c.width, c.height)
      const tex = this.track(new THREE.CanvasTexture(c))
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 8
      const earth = this.skyGroup.getObjectByName('earth') as THREE.Mesh | undefined
      if (!earth) return
      const m = earth.material as THREE.MeshStandardMaterial
      m.map = tex
      m.color.set(0xffffff)
      m.needsUpdate = true
    }
    day.onload = compose
    cloud.onload = compose
    day.src = '/touchdown/earth-day.jpg'
    cloud.src = '/touchdown/earth-clouds.png'
  }

  private buildLights() {
    const [sx, sy, sz] = this.terrain.sunDir
    this.sunLight.position.set(sx * 160, sy * 160, sz * 160)
    this.sunLight.castShadow = true
    const s = this.sunLight.shadow
    s.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048)
    s.camera.left = -16
    s.camera.right = 16
    s.camera.top = 16
    s.camera.bottom = -16
    s.camera.near = 20
    s.camera.far = 360
    s.bias = -0.0005
    s.normalBias = 0.03
    this.scene.add(this.sunLight, this.sunLight.target)
    // Bounce off the sunlit ground + earthshine: enough to read shapes inside
    // shadows, no more. Vacuum shadows are meant to be hard and deep.
    this.scene.add(new THREE.HemisphereLight(0x6b7894, 0x55504a, 0.8))
    const earthshine = new THREE.DirectionalLight(0x9db8ff, 0.16)
    earthshine.position.set(1, 0.3, -0.3 * Math.sign(sz))
    this.scene.add(earthshine, this.flash)
  }

  /**
   * Shared regolith material. Albedo and relief are sampled at three scales
   * (9 m, 108 m and 1.3 km tiles) and cross-faded by distance, so the ground is
   * sharp at your feet and never shows a repeating grid from altitude. Relief
   * is a true world-space slope from the height texture, so the low sun rakes
   * across it the same at any range. The baked terrain shadow gates direct light.
   */
  private regolithMaterial(): THREE.MeshStandardMaterial {
    const { albedo, bump } = regolithTextures(this.terrain.seed, this.mobile ? 512 : 1024, this.bag)
    const aniso = Math.min(this.mobile ? 4 : 16, this.renderer.capabilities.getMaxAnisotropy())
    albedo.anisotropy = aniso
    bump.anisotropy = aniso
    const mat = this.track(new THREE.MeshStandardMaterial({ vertexColors: true, map: albedo, roughness: 1, metalness: 0 }))
    const texel = 1 / (this.mobile ? 512 : 1024)
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uRelief = { value: bump }
      shader.uniforms.uTexel = { value: texel }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', 'attribute float aSun;\nvarying float vSun;\n#include <common>')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSun = aSun;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `varying float vSun;
uniform sampler2D uRelief;
uniform float uTexel;
vec2 reliefSlope(vec2 uv, float metres, float tile) {
  float hx = texture2D(uRelief, uv + vec2(uTexel, 0.0)).x - texture2D(uRelief, uv - vec2(uTexel, 0.0)).x;
  float hz = texture2D(uRelief, uv + vec2(0.0, uTexel)).x - texture2D(uRelief, uv - vec2(0.0, uTexel)).x;
  return vec2(hx, hz) * (metres / (2.0 * uTexel * tile));
}
#include <common>`
        )
        .replace(
          '#include <map_fragment>',
          `float rDist = length(vViewPosition);
float rMid = smoothstep(35.0, 190.0, rDist);
float rFar = smoothstep(700.0, 3600.0, rDist);
vec4 rNear = texture2D(map, vMapUv);
vec4 rMidC = texture2D(map, vMapUv * 0.0833);
vec4 rFarC = texture2D(map, vMapUv * 0.0069);
// Mid and far tiles carry contrast only; keep the mean brightness steady.
vec4 sampledDiffuseColor = mix(rNear * (0.55 + 0.75 * rMidC.g), rMidC * (0.55 + 0.75 * rFarC.g), rMid);
sampledDiffuseColor = mix(sampledDiffuseColor, rFarC, rFar);
diffuseColor *= sampledDiffuseColor;`
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
{
  vec2 g = reliefSlope(vMapUv, 0.085, 9.0) * (1.0 - rMid)
         + reliefSlope(vMapUv * 0.0833, 1.5, 108.0) * (1.0 - rFar)
         + reliefSlope(vMapUv * 0.0069, 14.0, 1300.0) * rFar;
  vec3 wx = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  vec3 wz = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
  normal = normalize(normal - g.x * wx - g.y * wz);
}`
        )
        .replace(
          '#include <aomap_fragment>',
          '#include <aomap_fragment>\nfloat sunGate = smoothstep(0.0, 1.0, vSun);\nreflectedLight.directDiffuse *= sunGate;\nreflectedLight.directSpecular *= sunGate;'
        )
    }
    return mat
  }

  private gridMesh(args: {
    n: number
    cell: number
    x0: number
    z0: number
    heights: Float32Array
    sun: Float32Array
    mat: THREE.Material
    seed: number
    /** Skip cells in this index box (the fine patch's hole in the coarse mesh). */
    hole?: { i0: number; i1: number; j0: number; j1: number }
  }): THREE.Mesh {
    const { n, cell, x0, z0, heights: h, sun, mat, hole } = args
    const pos = new Float32Array(n * n * 3)
    const nor = new Float32Array(n * n * 3)
    const col = new Float32Array(n * n * 3)
    const uv = new Float32Array(n * n * 2)
    const rng = mulberry32(args.seed)
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i
        const x = x0 + i * cell
        const z = z0 + j * cell
        pos[k * 3] = x
        pos[k * 3 + 1] = h[k]
        pos[k * 3 + 2] = z
        const il = Math.max(0, i - 1)
        const ir = Math.min(n - 1, i + 1)
        const jd = Math.max(0, j - 1)
        const ju = Math.min(n - 1, j + 1)
        const nx = (h[j * n + il] - h[j * n + ir]) / ((ir - il) * cell)
        const nz = (h[jd * n + i] - h[ju * n + i]) / ((ju - jd) * cell)
        const inv = 1 / Math.sqrt(nx * nx + 1 + nz * nz)
        nor[k * 3] = nx * inv
        nor[k * 3 + 1] = inv
        nor[k * 3 + 2] = nz * inv
        // Steeper ground is fresher and brighter; flats are mature and darker.
        const a = 0.34 + (1 - inv) * 0.6 + (rng() - 0.5) * 0.04
        col[k * 3] = a * 1.03
        col[k * 3 + 1] = a
        col[k * 3 + 2] = a * 0.95
        uv[k * 2] = x / 9
        uv[k * 2 + 1] = z / 9
      }
    }
    const idx: number[] = []
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        if (hole && i >= hole.i0 && i < hole.i1 && j >= hole.j0 && j < hole.j1) continue
        const a = j * n + i
        const b = a + 1
        const c = a + n
        const d = c + 1
        // Must match terrain.sampleGrid(): split along the b–c diagonal.
        idx.push(a, c, b, b, c, d)
      }
    }
    const geo = this.track(new THREE.BufferGeometry())
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.setAttribute('aSun', new THREE.BufferAttribute(sun, 1))
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1))
    geo.computeBoundingSphere()
    const mesh = new THREE.Mesh(geo, mat)
    mesh.receiveShadow = true
    return mesh
  }

  private buildTerrain() {
    const t = this.terrain
    const mat = this.regolithMaterial()

    // Coarse flight area with a hole where the fine patch sits.
    const ti = Math.round((t.fineX0 + HALF) / CELL)
    const tj = Math.round((t.fineZ0 + HALF) / CELL)
    this.scene.add(
      this.gridMesh({
        n: GRID_N,
        cell: CELL,
        x0: -HALF,
        z0: -HALF,
        heights: t.heights,
        sun: t.sun,
        mat,
        seed: t.seed ^ 0x77,
        hole: { i0: ti, i1: ti + FINE_HALF_CELLS * 2, j0: tj, j1: tj + FINE_HALF_CELLS * 2 },
      })
    )
    // Fine landing zone.
    this.scene.add(
      this.gridMesh({
        n: FINE_N,
        cell: FINE_CELL,
        x0: t.fineX0,
        z0: t.fineZ0,
        heights: t.fine,
        sun: t.fineSun,
        mat,
        seed: t.seed ^ 0x99,
      })
    )

    // Outer terrain out to the horizon, on a stretched grid, bent over the
    // Moon's curve so the horizon is real.
    const c = t.outerCoords
    const K = c.length
    const pos = new Float32Array(K * K * 3)
    const col = new Float32Array(K * K * 3)
    const uv = new Float32Array(K * K * 2)
    const rng = mulberry32(t.seed ^ 0x4242)
    const edge = HALF - 12
    for (let j = 0; j < K; j++) {
      for (let i = 0; i < K; i++) {
        const k = j * K + i
        const x = c[i]
        const z = c[j]
        const d2 = x * x + z * z
        const underMap = Math.abs(x) <= edge + 0.5 && Math.abs(z) <= edge + 0.5
        pos[k * 3] = x
        pos[k * 3 + 1] =
          t.outerHeights[k] - Math.max(0, d2 - HALF * HALF) / (2 * MOON_RADIUS) - (underMap ? 3 : 0)
        pos[k * 3 + 2] = z
        const a = 0.36 + (rng() - 0.5) * 0.05
        col[k * 3] = a * 1.03
        col[k * 3 + 1] = a
        col[k * 3 + 2] = a * 0.95
        uv[k * 2] = x / 9
        uv[k * 2 + 1] = z / 9
      }
    }
    const idx: number[] = []
    const deep = (a: number, b: number) => Math.max(Math.abs(a), Math.abs(b)) < edge - 250
    for (let j = 0; j < K - 1; j++) {
      for (let i = 0; i < K - 1; i++) {
        // Cells well under the flight area are never seen.
        if (deep(c[i], c[i + 1]) && deep(c[j], c[j + 1])) continue
        const a = j * K + i
        idx.push(a, a + K, a + 1, a + 1, a + K, a + K + 1)
      }
    }
    const geo = this.track(new THREE.BufferGeometry())
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.setAttribute('aSun', new THREE.BufferAttribute(t.outerSun, 1))
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1))
    geo.computeVertexNormals()
    geo.computeBoundingSphere()
    const outer = new THREE.Mesh(geo, mat)
    outer.frustumCulled = false
    this.scene.add(outer)
  }

  /** Matrix for a hard, stretched shadow decal on the ground behind an object of `height` and `width`. */
  private shadowMatrix(x: number, z: number, width: number, height: number, out: THREE.Matrix4): boolean {
    const t = this.terrain
    if (sunAt(t, x, z) < 0.55) return false
    const tanE = Math.tan((t.sunElevationDeg * Math.PI) / 180)
    const dirZ = -Math.sign(t.sunDir[2])
    const len = Math.min(140, height / tanE) + width * 0.5
    const endZ = z + dirZ * len
    const y0 = heightAt(t, x, z) + 0.1
    const y1 = heightAt(t, x, endZ) + 0.1
    scratchA.set(0, y1 - y0, endZ - z)
    const span = scratchA.length()
    scratchA.normalize()
    scratchB.set(1, 0, 0)
    scratchC.crossVectors(scratchA, scratchB).normalize()
    out.makeBasis(scratchB.multiplyScalar(width), scratchC, scratchA.multiplyScalar(span))
    out.setPosition(x, y0, z)
    return true
  }

  private shadowDecals(count: number): THREE.InstancedMesh {
    const sgeo = this.track(new THREE.PlaneGeometry(1, 1))
    sgeo.rotateX(-Math.PI / 2)
    sgeo.translate(0, 0, 0.5) // anchored at the object, extending along +z
    const sc = document.createElement('canvas')
    sc.width = sc.height = 64
    const sg = sc.getContext('2d')!
    sg.fillStyle = '#000'
    sg.fillRect(0, 0, 64, 64)
    sg.fillStyle = '#fff'
    sg.beginPath()
    sg.ellipse(32, 30, 27, 33, 0, 0, Math.PI * 2)
    sg.fill()
    const alpha = this.track(new THREE.CanvasTexture(sc))
    const mesh = new THREE.InstancedMesh(
      sgeo,
      this.track(
        new THREE.MeshBasicMaterial({
          color: 0x000000,
          alphaMap: alpha,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        })
      ),
      Math.max(1, count)
    )
    mesh.frustumCulled = false
    mesh.renderOrder = 1
    this.bag.push(mesh)
    return mesh
  }

  private rockGeometry(detail: number, seed: number): THREE.BufferGeometry {
    const geo = this.track(new THREE.IcosahedronGeometry(1, detail))
    const p = geo.attributes.position
    const rng = mulberry32(seed)
    // A few random planes shave the sphere into facets; small noise roughens it.
    const cuts: [number, number, number, number][] = []
    for (let i = 0; i < 7; i++) {
      const u = rng() * 2 - 1
      const a = rng() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      cuts.push([Math.cos(a) * s, u, Math.sin(a) * s, 0.55 + rng() * 0.35])
    }
    const seen = new Map<string, number>()
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const y = p.getY(i)
      const z = p.getZ(i)
      const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`
      let s = seen.get(key)
      if (s === undefined) {
        s = 1
        for (const [cx, cy, cz, d] of cuts) {
          const along = x * cx + y * cy + z * cz
          if (along > d) s = Math.min(s, d / along)
        }
        s *= 0.9 + rng() * 0.2
        seen.set(key, s)
      }
      p.setXYZ(i, x * s, y * s, z * s)
    }
    geo.computeVertexNormals()
    return geo
  }

  private buildRocks() {
    const t = this.terrain
    const rng = mulberry32(t.seed ^ 0x5151)
    const rockMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 })
    )
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s3 = v3()
    const p3 = v3()
    const color = new THREE.Color()

    // Pebbles: thousands of small stones around the pad, visual only. They are
    // what makes the ground read as ground in the close-up.
    const pebbleCount = this.mobile ? 1400 : 3800
    const total = t.boulderCount + pebbleCount
    const rocks = new THREE.InstancedMesh(this.rockGeometry(this.mobile ? 0 : 1, t.seed ^ 0x33), rockMat, total)
    rocks.receiveShadow = true
    rocks.frustumCulled = false
    const shadows = this.shadowDecals(total)
    let sc = 0
    const put = (index: number, x: number, y: number, z: number, r: number) => {
      e.set(rng() * 6.28, rng() * 6.28, rng() * 6.28)
      q.setFromEuler(e)
      s3.set(r * (0.9 + rng() * 0.3), r * (0.7 + rng() * 0.3), r * (0.9 + rng() * 0.3))
      m.compose(p3.set(x, y, z), q, s3)
      rocks.setMatrixAt(index, m)
      const g = (0.17 + rng() * 0.13) * (0.16 + 0.84 * sunAt(t, x, z))
      rocks.setColorAt(index, color.setRGB(g * 1.03, g, g * 0.95))
      if (this.shadowMatrix(x, z, r * 1.9, r * 1.1, m)) shadows.setMatrixAt(sc++, m)
    }
    for (let b = 0; b < t.boulderCount; b++) {
      put(b, t.boulders[b * 4], t.boulders[b * 4 + 1], t.boulders[b * 4 + 2], t.boulders[b * 4 + 3])
    }
    for (let k = 0; k < pebbleCount; k++) {
      const a = rng() * Math.PI * 2
      const d = 1.5 + Math.pow(rng(), 1.25) * 150
      const x = t.target.x + Math.cos(a) * d
      const z = t.target.z + Math.sin(a) * d
      const r = 0.03 + Math.pow(rng(), 3) * 0.14
      put(t.boulderCount + k, x, heightAt(t, x, z) + r * 0.3, z, r)
    }
    shadows.count = sc
    rocks.instanceMatrix.needsUpdate = true
    shadows.instanceMatrix.needsUpdate = true
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true
    this.scene.add(shadows, rocks)
    this.bag.push(rocks)
  }

  private glowTexture(stops: [number, string][]): THREE.Texture {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    for (const [at, colour] of stops) grad.addColorStop(at, colour)
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    return this.track(new THREE.CanvasTexture(c))
  }

  private buildSky() {
    const rng = mulberry32(this.terrain.seed ^ 0x31337)
    const count = this.mobile ? 1400 : 3200
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const R = 100000
    for (let i = 0; i < count; i++) {
      const u = rng() * 1.1 - 0.1
      const a = rng() * Math.PI * 2
      const s = Math.sqrt(Math.max(0, 1 - u * u))
      pos.set([Math.cos(a) * s * R, u * R, Math.sin(a) * s * R], i * 3)
      const b = 0.2 + Math.pow(rng(), 4) * 1.6
      const tint = rng()
      col.set([b * (0.9 + tint * 0.2), b, b * (1.1 - tint * 0.2)], i * 3)
    }
    const geo = this.track(new THREE.BufferGeometry())
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const stars = new THREE.Points(
      geo,
      this.track(
        new THREE.PointsMaterial({
          size: 1.5,
          sizeAttenuation: false,
          vertexColors: true,
          depthWrite: false,
          toneMapped: false,
        })
      )
    )
    stars.frustumCulled = false
    this.skyGroup.add(stars)

    // Earth: low over the horizon ahead, as it sits from the south pole. About
    // 2.5× its true size, because this is a postcard.
    const side = Math.sign(this.terrain.sunDir[2]) || 1
    const earthPos = new THREE.Vector3(1, 0.13, -0.3 * side).normalize().multiplyScalar(90000)
    const er = 5600
    const earth = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(er, 64, 40)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x2a5cab, roughness: 0.75, metalness: 0 }))
    )
    earth.name = 'earth'
    earth.position.copy(earthPos)
    earth.rotation.set(0.35, 2.2, 0.2)
    // Atmosphere: a soft blue halo behind the disc.
    const halo = new THREE.Sprite(
      this.track(
        new THREE.SpriteMaterial({
          map: this.glowTexture([
            [0, 'rgba(110,170,255,0)'],
            [0.74, 'rgba(110,170,255,0)'],
            [0.8, 'rgba(120,180,255,0.6)'],
            [1, 'rgba(60,110,255,0)'],
          ]),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        })
      )
    )
    halo.position.copy(earthPos).multiplyScalar(1.01)
    halo.scale.setScalar(er * 2.5)
    this.skyGroup.add(halo, earth)

    // The sun: a hot disc with glare, sitting just above the horizon.
    const [sx, sy, sz] = this.terrain.sunDir
    const sunPos = new THREE.Vector3(sx, sy, sz).multiplyScalar(95000)
    const glare = new THREE.Sprite(
      this.track(
        new THREE.SpriteMaterial({
          map: this.glowTexture([
            [0, 'rgba(255,244,220,1)'],
            [0.08, 'rgba(255,240,210,0.55)'],
            [0.3, 'rgba(255,230,190,0.12)'],
            [1, 'rgba(255,230,190,0)'],
          ]),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
          color: new THREE.Color(2.2, 2.0, 1.7),
        })
      )
    )
    glare.position.copy(sunPos)
    glare.scale.setScalar(34000)
    const disc = new THREE.Mesh(
      this.track(new THREE.CircleGeometry(900, 32)),
      this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(30, 28, 24), toneMapped: false }))
    )
    disc.position.copy(sunPos)
    disc.lookAt(0, 0, 0)
    this.skyGroup.add(glare, disc)
    this.scene.add(this.skyGroup)
  }

  private drapedRing(radius: number, width: number, color: THREE.Color, opacity: number): THREE.Mesh {
    const t = this.terrain
    const SEG = 96
    const pos = new Float32Array((SEG + 1) * 6)
    const idx: number[] = []
    for (let s = 0; s <= SEG; s++) {
      const a = (s / SEG) * Math.PI * 2
      for (let k = 0; k < 2; k++) {
        const r = radius + (k ? width : 0)
        const x = t.target.x + Math.cos(a) * r
        const z = t.target.z + Math.sin(a) * r
        pos.set([x, heightAt(t, x, z) + 0.12, z], s * 6 + k * 3)
      }
      if (s < SEG) idx.push(s * 2, s * 2 + 2, s * 2 + 1, s * 2 + 1, s * 2 + 2, s * 2 + 3)
    }
    const geo = this.track(new THREE.BufferGeometry())
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setIndex(idx)
    const mesh = new THREE.Mesh(
      geo,
      this.track(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          polygonOffsetUnits: -4,
          toneMapped: false,
        })
      )
    )
    mesh.renderOrder = 2
    return mesh
  }

  private buildTarget() {
    const t = this.terrain
    const green = new THREE.Color(0.35, 1.5, 0.7)
    this.scene.add(this.drapedRing(4.7, 0.3, green, 0.9))
    this.scene.add(this.drapedRing(19.4, 0.5, new THREE.Color(0.3, 0.75, 1.6), 0.6))
    this.scene.add(this.drapedRing(0, 0.55, green, 0.9))

    // A tall, faint beam so the pad can be found from 900 m out.
    const beam = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.9, 0.9, 900, 12, 1, true)),
      this.track(
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(0.5, 1.6, 0.9),
          transparent: true,
          opacity: 0.2,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        })
      )
    )
    beam.position.set(t.target.x, t.target.y + 450, t.target.z)
    this.beam = beam
    this.scene.add(beam)

    // Where you come down if you do nothing.
    const ring = new THREE.Mesh(
      this.track(new THREE.RingGeometry(2.0, 2.4, 48)),
      this.track(
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(2.4, 1.9, 0.5),
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          depthTest: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        })
      )
    )
    ring.renderOrder = 3
    this.impactRing = ring
    this.scene.add(ring)
  }

  private buildBase() {
    const t = this.terrain
    this.base = buildMoonBase(
      t.base,
      Math.sign(t.sunDir[2]) || 1,
      this.env,
      (x, z) => heightAt(t, x, z),
      this.flag,
      t.seed,
      this.bag
    )
    const decals = this.shadowDecals(this.base.shadows.length)
    const m = new THREE.Matrix4()
    let n = 0
    for (const s of this.base.shadows) {
      if (this.shadowMatrix(s.x, s.z, s.w, s.h, m)) decals.setMatrixAt(n++, m)
    }
    decals.count = n
    decals.instanceMatrix.needsUpdate = true
    this.base.group.add(decals)
    this.scene.add(this.base.group)
    // Give the physics something to hit.
    t.structures = new Float32Array(this.base.colliders)
  }

  private buildDust() {
    const n = this.mobile ? 2800 : 9000
    this.dustPos = new Float32Array(n * 6).fill(-9999)
    this.dustCol = new Float32Array(n * 6)
    this.dustVel = new Float32Array(n * 3)
    this.dustLife = new Float32Array(n)
    this.dustMax = new Float32Array(n)
    this.dustLit = new Float32Array(n)
    const geo = this.track(new THREE.BufferGeometry())
    geo.setAttribute('position', new THREE.BufferAttribute(this.dustPos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(this.dustCol, 3))
    // Each grain is a short streak along its velocity: bright head, dark tail.
    // Additive, so the sheet glows where the sun catches it and vanishes in shadow.
    this.dust = new THREE.LineSegments(
      geo,
      this.track(
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        })
      )
    )
    this.dust.frustumCulled = false
    this.scene.add(this.dust)

    // Haze sheet: fine regolith thrown out almost flat, lit by the low sun. In
    // vacuum it does not billow; it streams outward in a thin bright layer that
    // washes out the ground under the lander, as in the Apollo descent films.
    const hn = this.mobile ? 900 : 2600
    this.hazePos = new Float32Array(hn * 3).fill(-9999)
    this.hazeCol = new Float32Array(hn * 3)
    this.hazeVel = new Float32Array(hn * 3)
    this.hazeLife = new Float32Array(hn)
    this.hazeMax = new Float32Array(hn)
    this.hazeLit = new Float32Array(hn)
    const hgeo = this.track(new THREE.BufferGeometry())
    hgeo.setAttribute('position', new THREE.BufferAttribute(this.hazePos, 3))
    hgeo.setAttribute('color', new THREE.BufferAttribute(this.hazeCol, 3))
    this.haze = new THREE.Points(
      hgeo,
      this.track(
        new THREE.PointsMaterial({
          size: 2.6,
          sizeAttenuation: true,
          map: this.glowTexture([
            [0, 'rgba(255,255,255,0.9)'],
            [0.4, 'rgba(255,255,255,0.35)'],
            [1, 'rgba(255,255,255,0)'],
          ]),
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        })
      )
    )
    this.haze.frustumCulled = false
    this.scene.add(this.haze)

    // The blast sheet itself: a radial-streak disc hugging the ground under the engine.
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    g.translate(128, 128)
    const rng = mulberry32(99)
    for (let i = 0; i < 520; i++) {
      const a = rng() * Math.PI * 2
      const r0 = 6 + rng() * 30
      const r1 = r0 + 20 + rng() * 96
      const grad = g.createLinearGradient(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1)
      grad.addColorStop(0, `rgba(255,248,235,${0.1 + rng() * 0.3})`)
      grad.addColorStop(1, 'rgba(255,248,235,0)')
      g.strokeStyle = grad
      g.lineWidth = 0.6 + rng() * 2.2
      g.beginPath()
      g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
      g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
      g.stroke()
    }
    const tex = this.track(new THREE.CanvasTexture(c))
    this.blast = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(1, 1)),
      this.track(
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
          polygonOffset: true,
          polygonOffsetFactor: -6,
          polygonOffsetUnits: -6,
        })
      )
    )
    this.blast.renderOrder = 4
    this.blast.visible = false
    this.scene.add(this.blast)
  }

  private rebuildLander() {
    this.scene.remove(this.lander.group)
    for (const d of this.landerBag) {
      try {
        d.dispose()
      } catch {}
    }
    this.landerBag = []
    this.lander = buildLander(this.env, this.logo, this.terrain.seed, this.landerBag)
    this.scene.add(this.lander.group)
    this.exploded = false
    if (this.sim) this.syncLander()
  }

  private landerTrack<T extends { dispose: () => void }>(x: T): T {
    this.landerBag.push(x)
    return x
  }

  // ---------------------------------------------------------------------------
  // Flight lifecycle
  // ---------------------------------------------------------------------------

  /** Park a fresh lander at the top of the approach without starting the clock. */
  prepare(mode: ModeConfig, lateral: number) {
    this.mode = mode
    this.sim = createSim(this.terrain, mode, lateral)
    this.phase = 'idle'
    this.result = null
    this.endFired = false
    this.baseDone = null
    this.timeScale = 1
    this.slowUntil = 0
    this.acc = 0
    this.shake = 0
    this.legFold = [0, 0, 0, 0]
    this.stick.x = this.stick.y = 0
    for (const d of this.debris) this.scene.remove(d.obj)
    for (const o of this.extras) this.scene.remove(o)
    this.debris = []
    this.extras = []
    if (this.exploded) this.rebuildLander()
    this.lander.group.visible = true
    this.dustPos.fill(-9999)
    this.hazePos.fill(-9999)
    this.hazeLife.fill(0)
    this.dustLife.fill(0)
    this.flash.intensity = 0
    this.blast.visible = false
    this.altMarks = [300, 200, 100, 50, 20].filter((a) => a < mode.startAltitude)
    this.fuelMarks = [0.5, 0.25, 0.1]
    this.dustCalled = false
    this.baseCalled = false
    this.alarmStage = 0
    // The 1202 shows up on some flights, at a height that keeps you honest.
    this.alarmAt = this.runCount % 3 === 1 ? 120 + this.rng() * 120 : -1
    this.resetCamera()
    this.syncLander()
    this.chaseCamera(1, true)
  }

  start() {
    if (!this.sim || this.phase !== 'idle') return
    this.runCount++
    this.phase = 'flying'
    this.phaseT = 0
    this.resetCamera()
    this.say(
      this.mode.coaching ? 'Touchdown, you are GO for powered descent.' : 'Pro descent. You have the stick.',
      'info'
    )
  }

  run() {
    if (this.raf || this.disposed) return
    this.last = performance.now()
    const tick = (now: number) => {
      if (this.disposed) return
      this.raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      this.frame(dt)
    }
    this.raf = requestAnimationFrame(tick)
  }

  /**
   * Test hook (?autopilot=1): run the loop synchronously. A hidden or
   * background tab throttles requestAnimationFrame, which stalls a bot flight.
   */
  advance(seconds: number) {
    const frames = Math.round(seconds * 60)
    for (let i = 0; i < frames && !this.disposed; i++) this.frame(1 / 60)
  }

  /** Stick + burn from the player. `analog` (touch stick) skips key smoothing. */
  setControl(x: number, y: number, burn: boolean, analog: boolean) {
    this.want.x = x
    this.want.y = y
    this.want.burn = burn
    this.want.analog = analog
  }

  /** Drag to look around. Radians. */
  orbit(dyaw: number, dpitch: number) {
    this.camYaw += dyaw
    this.camPitch = Math.max(-0.6, Math.min(1.1, this.camPitch + dpitch))
  }

  zoom(factor: number) {
    this.camZoom = Math.max(0.45, Math.min(3, this.camZoom * factor))
  }

  resetCamera() {
    this.camYaw = 0
    this.camPitch = 0
    this.camZoom = 1
  }

  /** Glide the camera from the lander over to Moon Base Zero, then call back (to navigate). */
  flyToBase(done: () => void) {
    if (this.phase === 'tobase') return
    this.phase = 'tobase'
    this.phaseT = 0
    this.baseDone = done
    this.endFrom.copy(this.camera.position)
    this.endLookFrom.copy(this.camLook)
  }

  private say(text: string, tone: Callout['tone']) {
    this.audio.radio()
    if (tone === 'bad') this.audio.caution()
    this.quindarOutAt = this.clock + 2.3
    this.cb.onCallout({ text, tone })
  }

  private frame(dt: number) {
    this.clock += dt
    this.phaseT += dt
    const sim = this.sim
    if (!sim) return

    // Slow motion around first contact (and a break-up), easing back out.
    const scaleTo = this.clock < this.slowUntil ? 0.28 : 1
    this.timeScale += (scaleTo - this.timeScale) * Math.min(1, dt * (scaleTo < 1 ? 14 : 2.5))

    if (this.phase === 'flying') {
      if (this.autopilot) {
        botInput(sim, this.simInput)
      } else {
        // Keys ramp in (a tap is a nudge) and snap back; a touch stick is direct.
        for (const k of ['x', 'y'] as const) {
          const target = this.want[k]
          if (this.want.analog) this.stick[k] = target
          else {
            const rising = Math.abs(target) > Math.abs(this.stick[k]) && target * this.stick[k] >= 0
            const d = target - this.stick[k]
            this.stick[k] += Math.sign(d) * Math.min(Math.abs(d), (rising ? 2.4 : 7) * dt)
          }
        }
        // The stick is relative to where the camera is looking.
        const c = Math.cos(this.camYaw)
        const s = Math.sin(this.camYaw)
        this.simInput.y = this.stick.y * c - this.stick.x * s
        this.simInput.x = this.stick.y * s + this.stick.x * c
        this.simInput.burn = this.want.burn
      }
      this.acc += dt * this.timeScale
      let steps = 0
      while (this.acc >= SUBSTEP_DT && steps < 40) {
        stepSim(sim, this.simInput, SUBSTEP_DT)
        this.acc -= SUBSTEP_DT
        steps++
        if (sim.events.length) this.drainEvents()
        if (sim.outcome) break
      }
      if (steps === 40) this.acc = 0
      this.audio.setEngine(sim.burning)
      this.flightCallouts()
    }

    if (this.quindarOutAt > 0 && this.clock > this.quindarOutAt) {
      this.quindarOutAt = -1
      this.audio.quindar(false)
    }
    this.syncLander()
    this.updateDust(dt * this.timeScale)
    this.updateDebris(dt * Math.max(this.timeScale, 0.35))
    this.updateCamera(dt)
    this.updateHud(dt)

    // Keep the shadow frustum and the sky centred on the action.
    const [sx, sy, sz] = this.terrain.sunDir
    const f = this.exploded ? this.endLook : this.lander.group.position
    this.sunLight.target.position.copy(f)
    this.sunLight.position.set(f.x + sx * 180, f.y + sy * 180, f.z + sz * 180)
    this.skyGroup.position.copy(this.camera.position)
    if (this.flash.intensity > 0.01) this.flash.intensity *= Math.pow(0.02, dt)
    else this.flash.intensity = 0
    const blink = this.clock % 1.6 < 0.25
    for (const b of this.base.beacons) b.visible = blink

    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }

  private drainEvents() {
    const sim = this.sim
    for (const ev of sim.events.splice(0)) {
      if (ev.type === 'contact') {
        this.slowUntil = this.clock + 0.75
        this.shake = Math.min(1.4, 0.15 + ev.speed * 0.12)
        this.audio.thud(Math.min(1.2, ev.speed / 5))
        this.burst(sim.px, sim.pz, 80 + ev.speed * 60, 3 + ev.speed * 1.8)
        if (ev.speed < 2.2) this.say('Contact light!', 'good')
        else if (ev.speed < this.mode.legCollapseSpeed) this.say('Contact! That was firm.', 'warn')
      } else if (ev.type === 'legbreak') {
        this.shake = 1.2
        this.slowUntil = this.clock + 0.9
        this.audio.thud(1.3)
        this.say('Gear collapse!', 'bad')
      } else if (ev.type === 'structure') {
        this.shake = Math.max(this.shake, 1 + Math.min(1.2, ev.speed * 0.15))
        this.slowUntil = Math.max(this.slowUntil, this.clock + 0.5)
        this.audio.thud(1.4)
        this.burst(sim.px, sim.pz, 160, 6 + ev.speed)
        this.flash.position.set(sim.px, sim.py, sim.pz)
        this.flash.intensity = 500
        if (sim.baseDamage === 1) this.say('You just hit Moon Base Zero! That is coming off your score.', 'bad')
        else if (sim.baseDamage === 3) this.say('Stop hitting the base!', 'bad')
      } else if (ev.type === 'hull') {
        this.shake = Math.max(this.shake, Math.min(1.2, ev.speed * 0.2))
        this.audio.thud(Math.min(1.4, ev.speed / 4))
        this.burst(sim.px, sim.pz, 60, 3 + ev.speed)
      } else if (ev.type === 'breakup') {
        this.explode()
      } else if (ev.type === 'fuelout') {
        this.audio.alarm()
        this.say('Fuel exhausted. You are a glider now. On the Moon.', 'bad')
      } else if (ev.type === 'done') {
        this.finishFlight()
      }
    }
  }

  private flightCallouts() {
    const sim = this.sim
    if (sim.firstContactT >= 0) return
    const alt = altitudeAGL(sim)
    if (this.altMarks.length && alt < this.altMarks[0]) {
      const mark = this.altMarks.shift()!
      if (mark >= 50) this.say(`${mark} metres.`, 'info')
      else this.say(`${mark} metres. Easy does it.`, 'info')
    }
    if (!this.baseCalled && sim.t > 6) {
      this.baseCalled = true
      this.say('Moon Base Zero in sight. They are watching this one.', 'info')
    }
    if (!this.dustCalled && alt < 9 && sim.burning) {
      this.dustCalled = true
      this.say('Kicking up some dust.', 'info')
    }
    const fuel = sim.fuel / sim.mode.fuelSeconds
    if (this.fuelMarks.length && fuel < this.fuelMarks[0]) {
      const mark = this.fuelMarks.shift()!
      if (mark === 0.5) this.say('Fuel at half.', 'info')
      else if (mark === 0.25) {
        this.audio.alarm()
        this.say('Quarter tank. Start thinking about the ground.', 'warn')
      } else {
        this.audio.alarm()
        this.say('Bingo fuel. Land it now.', 'bad')
      }
    }
    if (this.alarmAt > 0 && this.alarmStage === 0 && alt < this.alarmAt) {
      this.alarmStage = 1
      this.alarmAt = this.clock + 3.2
      this.audio.alarm()
      this.say('PROGRAM ALARM. 1202.', 'warn')
    } else if (this.alarmStage === 1 && this.clock > this.alarmAt) {
      this.alarmStage = 2
      this.say("We're GO on that alarm.", 'good')
    }
  }

  private finishFlight() {
    const sim = this.sim
    this.result = scoreFlight(sim)
    this.audio.setEngine(false)
    this.phase = 'ending'
    this.phaseT = 0
    const o = this.result.outcome
    if (o === 'landed') this.audio.success()
    else if (o === 'hard') this.audio.beep(660, 0.25, 'triangle', 0.08)
    else if (o === 'tipped' || o === 'inverted') this.audio.sadTrombone()

    // End shot: low, close, side-lit, with Earth and the base behind.
    const side = Math.sign(this.terrain.sunDir[2]) || 1
    this.endAngle = Math.atan2(side * 0.62, -0.78)
    const portrait = this.camera.aspect < 1
    this.endDist = (o === 'crashed' ? 15 : 12.5) * (portrait ? 1.45 : 1)
    this.endFrom.copy(this.camera.position)
    this.endLookFrom.copy(this.camLook)
    this.endLook.set(sim.px, Math.max(sim.py, heightAt(this.terrain, sim.px, sim.pz) + 1) - 0.2, sim.pz)
    if (o === 'lost' || o === 'crashed') {
      this.endLook.set(sim.px + 2, heightAt(this.terrain, sim.px, sim.pz) + 0.5, sim.pz)
    }
    this.endAim.copy(this.endLook)
    if (portrait) this.endAim.y -= this.endDist * 0.42
    this.resetCamera()
    this.placeEndCamera(this.endTo, this.endAngle)
  }

  /**
   * Where the live end-shot camera aims. On wide screens the result panel
   * covers the right side, so aim to the right of the subject and it sits in
   * the clear left part of the frame.
   */
  private aimEnd(out: THREE.Vector3, angle: number) {
    out.copy(this.endAim)
    if (this.camera.aspect >= 1) {
      const shift = this.endDist * 0.3
      out.x += Math.sin(angle) * shift
      out.z -= Math.cos(angle) * shift
    }
  }

  private placeEndCamera(out: THREE.Vector3, angle: number, dist = this.endDist) {
    const reach = dist * this.camZoom
    const x = this.endLook.x + Math.cos(angle) * reach
    const z = this.endLook.z + Math.sin(angle) * reach
    const ground = heightAt(this.terrain, x, z)
    const lift = (this.result?.outcome === 'crashed' ? 4.6 : 1.1) + this.camPitch * reach * 0.9
    out.set(x, Math.max(ground + 0.5, this.endLook.y + lift), z)
  }

  // ---------------------------------------------------------------------------
  // Per-frame visuals
  // ---------------------------------------------------------------------------

  private syncLander() {
    const s = this.sim
    const L = this.lander
    if (!this.exploded) {
      L.group.position.set(s.px, s.py, s.pz)
      L.group.quaternion.set(s.qx, s.qy, s.qz, s.qw)
    }
    const burning = s.burning && this.phase === 'flying' && !this.exploded
    L.plume.visible = L.plumeCore.visible = burning
    L.glow.intensity += ((burning ? 60 + Math.random() * 30 : 0) - L.glow.intensity) * 0.4
    if (burning) {
      const f = 0.85 + Math.random() * 0.3
      L.plume.scale.set(f, 0.9 + Math.random() * 0.25, f)
      L.plumeCore.scale.set(1, 0.8 + Math.random() * 0.45, 1)
    }
    if (!this.exploded) {
      for (let i = 0; i < 4; i++) {
        const want = s.padBroken[i] ? 1 : 0
        this.legFold[i] += (want - this.legFold[i]) * 0.3
        const g = L.legs[i]
        g.quaternion.setFromAxisAngle(g.userData.axis, this.legFold[i] * 1.15)
      }
    }
    L.nav.visible = this.clock % 1.4 < 0.7
    // Attitude thrusters: short puffs on the quads that are doing the work.
    const flying = this.phase === 'flying' && !this.exploded && s.firstContactT < 0
    let firing = false
    for (const j of L.jets) {
      // Torque about +x pushes the +z side down (its jet fires up); torque
      // about +z lifts the +x side (its jet fires down).
      const cmd = j.axis === 'z' ? j.side * s.rcsX : -j.side * s.rcsZ
      const on = flying && (j.up ? cmd > 0.22 : cmd < -0.22) && Math.random() > 0.3
      j.mesh.visible = on
      if (on) {
        firing = true
        const k = 0.6 + Math.random() * 0.7
        j.mesh.scale.set(k, 0.5 + Math.min(1.2, Math.abs(cmd)) * (0.6 + Math.random() * 0.5), k)
      }
    }
    if (firing && this.clock > this.rcsSoundAt) {
      this.rcsSoundAt = this.clock + 0.22
      this.audio.rcs()
    }
  }

  private spawnDust(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number) {
    const i = this.dustNext
    this.dustNext = (i + 1) % this.dustLife.length
    this.dustPos.set([x, y, z, x, y, z], i * 6)
    this.dustVel.set([vx, vy, vz], i * 3)
    this.dustLife[i] = life
    this.dustMax[i] = life
    this.dustLit[i] = 0.12 + 0.88 * sunAt(this.terrain, x, z)
  }

  /** A ring of regolith thrown flat along the ground. No air, so no billowing: every grain flies a clean arc. */
  private burst(x: number, z: number, count: number, speed: number) {
    const y = heightAt(this.terrain, x, z) + 0.1
    const n = Math.min(count, this.mobile ? 200 : 700)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const v = speed * (0.35 + Math.random())
      const r = 0.5 + Math.random() * 2.2
      this.spawnDust(
        x + Math.cos(a) * r,
        y,
        z + Math.sin(a) * r,
        Math.cos(a) * v,
        v * (0.04 + Math.random() * 0.3),
        Math.sin(a) * v,
        1.2 + Math.random() * 2.6
      )
    }
  }

  private updateDust(dt: number) {
    const s = this.sim
    let strength = 0
    // Engine plume scouring the surface.
    if (s.burning && this.phase === 'flying' && !this.exploded) {
      const ux = s.m[1]
      const uy = s.m[4]
      const uz = s.m[7]
      if (uy > 0.3) {
        const nozzleY = s.py - 1.4 * uy
        const ground = heightAt(this.terrain, s.px, s.pz)
        const range = (nozzleY - ground) / uy
        if (range < 48) {
          const gx = s.px - ux * range
          const gz = s.pz - uz * range
          const gy = heightAt(this.terrain, gx, gz) + 0.06
          strength = 1 - range / 48
          // Haze first: the sheet is visible well before individual grains are.
          let hz = Math.floor((this.mobile ? 150 : 460) * strength * dt + Math.random())
          while (hz-- > 0) {
            const a = Math.random() * Math.PI * 2
            const v = (10 + Math.random() * 34) * (0.4 + strength * 0.8)
            const r = 0.6 + Math.random() * 2.4
            const i = this.hazeNext
            this.hazeNext = (i + 1) % this.hazeLife.length
            const hx = gx + Math.cos(a) * r
            const hzz = gz + Math.sin(a) * r
            this.hazePos.set([hx, gy + 0.15, hzz], i * 3)
            // Almost flat: a few degrees of elevation at most.
            this.hazeVel.set([Math.cos(a) * v, v * (0.005 + Math.random() * 0.055), Math.sin(a) * v], i * 3)
            this.hazeLife[i] = this.hazeMax[i] = 1.2 + Math.random() * 2.6
            this.hazeLit[i] = (0.1 + 0.9 * sunAt(this.terrain, hx, hzz)) * (0.5 + strength * 0.5)
          }
          const rate = (this.mobile ? 800 : 2600) * strength * strength
          let n = Math.floor(rate * dt + Math.random())
          while (n-- > 0) {
            const a = Math.random() * Math.PI * 2
            const v = (12 + Math.random() * 30) * (0.35 + strength)
            const r = 0.2 + Math.random() * 1.4
            this.spawnDust(
              gx + Math.cos(a) * r,
              gy,
              gz + Math.sin(a) * r,
              Math.cos(a) * v,
              v * (0.015 + Math.random() * Math.random() * 0.16),
              Math.sin(a) * v,
              0.7 + Math.random() * 1.7
            )
          }
          const n3 = [0, 1, 0]
          normalAt(this.terrain, gx, gz, n3)
          this.blast.position.set(gx, gy + 0.05, gz)
          this.blast.quaternion.setFromUnitVectors(Z_AXIS, scratchA.set(n3[0], n3[1], n3[2]))
          this.blast.rotateZ(Math.random() * Math.PI * 2)
          this.blast.scale.setScalar(20 + (1 - strength) * 46)
        }
      }
    }
    const bm = this.blast.material as THREE.MeshBasicMaterial
    bm.opacity += (Math.pow(strength, 1.5) * 0.95 * (0.7 + Math.random() * 0.3) - bm.opacity) * 0.35
    this.blast.visible = bm.opacity > 0.01

    const p = this.dustPos
    const c = this.dustCol
    const vel = this.dustVel
    const life = this.dustLife
    for (let i = 0; i < life.length; i++) {
      if (life[i] <= 0) continue
      life[i] -= dt
      const k = i * 3
      const q = i * 6
      vel[k + 1] -= 1.62 * dt
      p[q] += vel[k] * dt
      p[q + 1] += vel[k + 1] * dt
      p[q + 2] += vel[k + 2] * dt
      if (life[i] <= 0 || (vel[k + 1] < 0 && p[q + 1] < heightAt(this.terrain, p[q], p[q + 2]))) {
        life[i] = 0
        p[q + 1] = p[q + 4] = -9999
        continue
      }
      // Tail trails the head by a fixed slice of time.
      p[q + 3] = p[q] - vel[k] * 0.075
      p[q + 4] = p[q + 1] - vel[k + 1] * 0.075
      p[q + 5] = p[q + 2] - vel[k + 2] * 0.075
      const b = Math.min(1, life[i] / this.dustMax[i] + 0.15) * this.dustLit[i] * 0.6
      c[q] = b
      c[q + 1] = b * 0.96
      c[q + 2] = b * 0.9
      c[q + 3] = c[q + 4] = c[q + 5] = 0
    }
    this.dust.geometry.attributes.position.needsUpdate = true
    this.dust.geometry.attributes.color.needsUpdate = true

    const hp = this.hazePos
    const hc = this.hazeCol
    const hv = this.hazeVel
    const hl = this.hazeLife
    for (let i = 0; i < hl.length; i++) {
      if (hl[i] <= 0) continue
      hl[i] -= dt
      const k = i * 3
      hv[k + 1] -= 1.62 * dt
      hp[k] += hv[k] * dt
      hp[k + 1] += hv[k + 1] * dt
      hp[k + 2] += hv[k + 2] * dt
      if (hl[i] <= 0 || (hv[k + 1] < 0 && hp[k + 1] < heightAt(this.terrain, hp[k], hp[k + 2]) - 0.3)) {
        hl[i] = 0
        hp[k + 1] = -9999
        continue
      }
      // Bright as it leaves the engine, thinning as it spreads.
      const age = hl[i] / this.hazeMax[i]
      const b = age * age * this.hazeLit[i] * 0.2
      hc[k] = b
      hc[k + 1] = b * 0.96
      hc[k + 2] = b * 0.9
    }
    this.haze.geometry.attributes.position.needsUpdate = true
    this.haze.geometry.attributes.color.needsUpdate = true
    this.audio.setDust(this.phase === 'flying' ? strength : 0)
  }

  /** Break-up: the lander's real parts come apart and tumble. */
  private explode() {
    const s = this.sim
    this.exploded = true
    this.audio.crash()
    this.shake = 2.4
    this.slowUntil = this.clock + 1.4
    this.flash.position.set(s.px, s.py + 1, s.pz)
    this.flash.intensity = 2200
    this.burst(s.px, s.pz, 700, 18)
    const L = this.lander
    L.plume.visible = L.plumeCore.visible = false
    L.glow.intensity = 0
    L.group.updateMatrixWorld(true)
    const centre = new THREE.Vector3(s.px, s.py, s.pz)
    const impact = new THREE.Vector3(s.vx, s.vy, s.vz)
    for (const part of L.parts) {
      const world = part.getWorldPosition(new THREE.Vector3())
      this.scene.attach(part)
      const out = world.clone().sub(centre)
      out.y = Math.abs(out.y) * 0.4 + 0.4
      out.normalize()
      const heavy = part.name === 'body' || part.name === 'deck'
      const sp = heavy ? 0.5 + Math.random() * 1.2 : 1.5 + Math.random() * 4.5
      const v = out.multiplyScalar(sp)
      v.x += impact.x * (heavy ? 0.04 : 0.09)
      v.z += impact.z * (heavy ? 0.04 : 0.09)
      v.y = (heavy ? 0.8 : 1.4) + Math.random() * (heavy ? 1.4 : 3.2)
      const w = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(
        heavy ? 3 : 10
      )
      const r = part.name === 'body' ? 0.85 : part.name === 'deck' ? 0.55 : part.name.startsWith('tank') ? 0.5 : 0.22
      this.debris.push({ obj: part, v, w, r, rest: false })
    }
    this.scene.remove(L.group)

    // Foil scraps.
    const scrap = [0xffbf52, 0xd6dae2, 0x17181b].map((c) =>
      this.landerTrack(
        new THREE.MeshStandardMaterial({
          color: c,
          metalness: 1,
          roughness: 0.4,
          envMap: this.env,
          side: THREE.DoubleSide,
        })
      )
    )
    const n = this.mobile ? 14 : 34
    for (let i = 0; i < n; i++) {
      const size = 0.12 + Math.random() * 0.5
      const geo = this.landerTrack(new THREE.PlaneGeometry(size, size * (0.4 + Math.random() * 0.8), 2, 1))
      const gp = geo.attributes.position
      for (let k = 0; k < gp.count; k++) gp.setZ(k, (Math.random() - 0.5) * size * 0.5)
      geo.computeVertexNormals()
      const mesh = new THREE.Mesh(geo, scrap[i % scrap.length])
      mesh.castShadow = true
      mesh.position.set(s.px + (Math.random() - 0.5) * 2, s.py + Math.random() * 1.2, s.pz + (Math.random() - 0.5) * 2)
      const a = Math.random() * Math.PI * 2
      const sp = 2 + Math.random() * 14
      const v = new THREE.Vector3(impact.x * 0.1 + Math.cos(a) * sp * 0.6, 1.5 + Math.random() * 6, impact.z * 0.1 + Math.sin(a) * sp * 0.6)
      const w = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(18)
      this.debris.push({ obj: mesh, v, w, r: 0.04, rest: false })
      this.scene.add(mesh)
    }

    // Scorch mark with ejecta rays: the brand new crater.
    const gy = heightAt(this.terrain, s.px, s.pz)
    const gn = [0, 1, 0]
    normalAt(this.terrain, s.px, s.pz, gn)
    const sc = document.createElement('canvas')
    sc.width = sc.height = 256
    const g = sc.getContext('2d')!
    g.translate(128, 128)
    const core = g.createRadialGradient(0, 0, 0, 0, 0, 60)
    core.addColorStop(0, 'rgba(255,255,255,0.95)')
    core.addColorStop(0.6, 'rgba(255,255,255,0.6)')
    core.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = core
    g.fillRect(-128, -128, 256, 256)
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2
      const len = 50 + Math.random() * 76
      g.strokeStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.4})`
      g.lineWidth = 1 + Math.random() * 5
      g.beginPath()
      g.moveTo(Math.cos(a) * 20, Math.sin(a) * 20)
      g.lineTo(Math.cos(a) * len, Math.sin(a) * len)
      g.stroke()
    }
    const scorch = new THREE.Mesh(
      this.landerTrack(new THREE.PlaneGeometry(26, 26)),
      this.landerTrack(
        new THREE.MeshBasicMaterial({
          color: 0x000000,
          alphaMap: this.landerTrack(new THREE.CanvasTexture(sc)),
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        })
      )
    )
    scorch.position.set(s.px, gy + 0.15, s.pz)
    scorch.quaternion.setFromUnitVectors(Z_AXIS, scratchA.set(gn[0], gn[1], gn[2]))
    scorch.renderOrder = 1
    this.scene.add(scorch)
    this.extras.push(scorch)
  }

  private updateDebris(dt: number) {
    const n = [0, 1, 0]
    for (const d of this.debris) {
      if (d.rest) continue
      d.v.y -= 1.62 * dt
      const p = d.obj.position
      p.addScaledVector(d.v, dt)
      const spin = d.w.length()
      if (spin > 1e-4) d.obj.rotateOnWorldAxis(scratchA.copy(d.w).divideScalar(spin), spin * dt)
      const ground = heightAt(this.terrain, p.x, p.z) + d.r
      if (p.y < ground) {
        p.y = ground
        normalAt(this.terrain, p.x, p.z, n)
        const vn = d.v.x * n[0] + d.v.y * n[1] + d.v.z * n[2]
        if (vn < 0) {
          d.v.x -= 1.22 * vn * n[0]
          d.v.y -= 1.22 * vn * n[1]
          d.v.z -= 1.22 * vn * n[2]
          d.v.multiplyScalar(0.6)
          d.w.multiplyScalar(0.55)
          if (-vn > 2) this.burst(p.x, p.z, 14, 2 + -vn * 0.5)
        }
        if (d.v.lengthSq() < 0.06) d.rest = true
      }
    }
  }

  private chaseCamera(blend: number, snap = false) {
    const s = this.sim
    const alt = Math.max(0, altitudeAGL(s))
    const k = Math.min(1, alt / 380)
    const portrait = this.camera.aspect < 1
    // Near the ground the camera rides higher and looks down, so the pad under
    // the lander is in frame for the last few metres.
    const low = 1 - Math.min(1, alt / 40)
    const back = (15 + 46 * k) * (portrait ? 1.35 : 1)
    const up = 6.5 + 30 * k + 5 * low
    const dist = Math.hypot(back, up) * this.camZoom
    const pitch = Math.max(0.04, Math.min(1.5, Math.atan2(up, back) + this.camPitch))
    const cy = Math.cos(this.camYaw)
    const sy = Math.sin(this.camYaw)
    const want = scratchA.set(
      s.px - Math.cos(pitch) * cy * dist,
      s.py + Math.sin(pitch) * dist,
      s.pz - Math.cos(pitch) * sy * dist
    )
    const ground = heightAt(this.terrain, want.x, want.z) + 2
    if (want.y < ground) want.y = ground
    // Look past the lander toward where the camera is facing, so the pad stays in frame.
    const ahead = 6 + alt * 0.3 - 4 * low
    const look = scratchB.set(s.px + cy * ahead, s.py - 1 - alt * 0.2 - 2 * low, s.pz + sy * ahead)
    if (snap) {
      this.camPos.copy(want)
      this.camLook.copy(look)
    } else {
      this.camPos.lerp(want, blend)
      this.camLook.lerp(look, blend)
    }
  }

  private updateCamera(dt: number) {
    const cam = this.camera
    if (this.phase === 'idle') {
      // Start screen: the lander close in the foreground, the Moon running to
      // the horizon behind it, with the base, the ranges and the Earth in frame.
      const s = this.sim
      const sweep = Math.sin(this.clock * 0.11)
      const portrait = cam.aspect < 1
      this.camPos.set(
        s.px - (portrait ? 30 : 21),
        s.py + 5.5 + Math.sin(this.clock * 0.07) * 1.2,
        s.pz + 11 + sweep * 4
      )
      this.camLook.set(s.px + 400, s.py - 150, s.pz - (40 + sweep * 40))
    } else if (this.phase === 'flying') {
      this.chaseCamera(1 - Math.pow(0.0015, dt))
    } else if (this.phase === 'tobase') {
      const u = Math.min(1, this.phaseT / 2.4)
      const e = u * u * (3 - 2 * u)
      const b = this.terrain.base
      scratchA.set(b.x - 150, b.y + 62, b.z - 70 * (Math.sign(this.terrain.sunDir[2]) || 1))
      this.camPos.lerpVectors(this.endFrom, scratchA, e)
      this.camLook.lerpVectors(this.endLookFrom, scratchB.set(b.x, b.y + 6, b.z), Math.min(1, e * 1.6))
      if (u >= 1 && this.baseDone) {
        const done = this.baseDone
        this.baseDone = null
        done()
      }
    } else {
      // Ending: fly to the end shot, then orbit slowly (drag still turns it).
      const T = 1.5
      const u = Math.min(1, this.phaseT / T)
      const e = u * u * (3 - 2 * u)
      if (this.phase === 'ending') {
        this.camPos.lerpVectors(this.endFrom, this.endTo, e)
        this.aimEnd(scratchC, this.endAngle)
        this.camLook.lerpVectors(this.endLookFrom, scratchC, e)
        if (u >= 1 && this.phaseT > T + 0.35 && !this.endFired) {
          this.endFired = true
          this.phase = 'result'
          this.phaseT = 0
          if (this.result) this.cb.onEnd(this.result)
        }
      } else {
        const angle = this.endAngle + Math.sin(this.phaseT * 0.12) * 0.5 + this.camYaw
        this.placeEndCamera(this.camPos, angle)
        this.aimEnd(this.camLook, angle)
      }
    }
    cam.position.copy(this.camPos)
    if (this.shake > 0.002) {
      const a = this.shake * 0.35
      cam.position.x += (Math.random() - 0.5) * a
      cam.position.y += (Math.random() - 0.5) * a
      cam.position.z += (Math.random() - 0.5) * a
      this.shake *= Math.pow(0.012, dt)
    }
    cam.lookAt(this.camLook)
  }

  private project(x: number, y: number, z: number, margin: number): { x: number; y: number; on: boolean } {
    const p = scratchA.set(x, y, z).project(this.camera)
    const behind = p.z > 1
    let nx = behind ? -p.x : p.x
    let ny = behind ? -p.y : p.y
    const on = !behind && Math.abs(nx) < margin && Math.abs(ny) < margin - 0.04
    if (!on) {
      const m = Math.max(Math.abs(nx) / margin, Math.abs(ny) / (margin - 0.04), 1e-3)
      nx /= m
      ny /= m
    }
    return { x: nx * 0.5 + 0.5, y: -ny * 0.5 + 0.5, on }
  }

  private updateHud(dt: number) {
    const s = this.sim
    const t = this.terrain

    // Projected impact point: where a dead-stick fall ends.
    const alt = altitudeAGL(s)
    const showRing = this.phase === 'flying' && s.firstContactT < 0 && alt > 2
    this.impactRing.visible = showRing
    if (showRing) {
      let ix = s.px
      let iz = s.pz
      for (let it = 0; it < 3; it++) {
        const drop = Math.max(0, s.py - PAD_DROP - heightAt(t, ix, iz))
        const tt = (s.vy + Math.sqrt(s.vy * s.vy + 2 * 1.62 * drop)) / 1.62
        ix = s.px + s.vx * tt
        iz = s.pz + s.vz * tt
      }
      const n = [0, 1, 0]
      normalAt(t, ix, iz, n)
      this.impactRing.position.set(ix, heightAt(t, ix, iz) + 0.3, iz)
      this.impactRing.quaternion.setFromUnitVectors(Z_AXIS, scratchA.set(n[0], n[1], n[2]))
      this.impactRing.scale.setScalar(1 + Math.min(6, alt / 60))
    }
    ;(this.beam.material as THREE.MeshBasicMaterial).opacity =
      this.phase === 'flying' || this.phase === 'idle' ? 0.2 * Math.min(1, Math.max(0, alt - 12) / 120) : 0

    this.hudT += dt
    if (this.hudT < 1 / 20) return
    this.hudT = 0
    const h = this.hud
    h.alt = alt
    h.vspeed = s.vy
    h.hspeed = Math.hypot(s.vx, s.vz)
    h.fuel = s.fuel / s.mode.fuelSeconds
    h.dist = distanceToTarget(s)
    h.tilt = tiltDeg(s)
    h.burning = s.burning

    const pad = this.project(t.target.x, t.target.y + 1, t.target.z, 0.94)
    h.tx = pad.x
    h.ty = pad.y
    h.tOnScreen = pad.on
    const base = this.project(t.base.x, t.base.y + 22, t.base.z, 0.98)
    h.bx = base.x
    h.by = base.y
    h.bOnScreen = base.on

    // Coaching
    h.prompt = ''
    h.promptTone = 'info'
    if (this.phase === 'flying' && s.firstContactT < 0) {
      const fuelLow = h.fuel < 0.15
      if (s.mode.coaching) {
        const dx = t.target.x - s.px
        const closing = s.vx
        const stopDist = (closing * closing) / (2 * 1.1)
        const sinkLimit = 2.5 + alt * 0.11
        if (alt < 70 && -s.vy > sinkLimit) {
          h.prompt = 'TOO FAST — BURN'
          h.promptTone = 'warn'
        } else if (closing > 3 && stopDist > dx + 20) {
          h.prompt = 'TOO FAST — tilt back + burn'
          h.promptTone = 'warn'
        } else if (Math.abs(s.vz) > 3.5) {
          h.prompt = 'DRIFTING'
          h.promptTone = 'warn'
        } else if (alt < 160 && Math.abs(t.target.z - s.pz) > 22) {
          h.prompt = t.target.z > s.pz ? 'Target is to the right' : 'Target is to the left'
        } else if (fuelLow) {
          h.prompt = 'LOW FUEL'
          h.promptTone = 'warn'
        } else if (s.t < 5) {
          h.prompt = 'Tilt back + burn to brake'
        } else if (alt < 12 && h.hspeed < 2) {
          h.prompt = 'Level out. Feather the burn.'
        } else if (dx < -15) {
          h.prompt = 'Overshot — tilt back + burn'
          h.promptTone = 'warn'
        }
      } else if (fuelLow) {
        h.prompt = 'LOW FUEL'
        h.promptTone = 'warn'
      }
    }
    this.cb.onHud(h)
  }

  // ---------------------------------------------------------------------------
  // Host API
  // ---------------------------------------------------------------------------

  /**
   * Render the share-card frame: a fixed 16:9 end shot centred on the lander
   * (or wreck), the same on a phone as on a desktop, whatever the live view is
   * showing. Returns it as a 2D canvas.
   */
  capture(width = 1200, height = 675): HTMLCanvasElement {
    const r = this.renderer
    const cam = this.camera
    const ratio = r.getPixelRatio()
    const size = r.getSize(new THREE.Vector2())
    const savedPos = cam.position.clone()
    const savedQuat = cam.quaternion.clone()
    const ringWas = this.impactRing.visible
    this.impactRing.visible = false

    r.setPixelRatio(1)
    r.setSize(width, height, false)
    cam.aspect = width / height
    cam.fov = 48
    cam.updateProjectionMatrix()
    if (this.phase === 'ending' || this.phase === 'result') {
      const portrait = size.x / size.y < 1
      const dist = this.endDist / (portrait ? 1.45 : 1)
      this.placeEndCamera(cam.position, this.endAngle, dist)
      // Aim a little low so the subject clears the card's bottom text block.
      cam.lookAt(scratchA.copy(this.endLook).setY(this.endLook.y - dist * 0.16))
    }
    this.skyGroup.position.copy(cam.position)
    r.setRenderTarget(null)
    r.clear()
    r.render(this.scene, cam)
    const out = document.createElement('canvas')
    out.width = width
    out.height = height
    out.getContext('2d')!.drawImage(this.canvas, 0, 0, width, height)

    // Restore the live view in the same task, so nothing flickers.
    r.setPixelRatio(ratio)
    r.setSize(size.x, size.y, false)
    this.resize()
    cam.position.copy(savedPos)
    cam.quaternion.copy(savedQuat)
    this.skyGroup.position.copy(cam.position)
    this.impactRing.visible = ringWas
    if (this.composer) this.composer.render()
    else r.render(this.scene, cam)
    return out
  }

  /**
   * Take a photo: the live view exactly as framed (any angle the player has
   * dragged to), at the canvas's own aspect ratio.
   */
  photo(maxDim = 1600): HTMLCanvasElement {
    const r = this.renderer
    const cam = this.camera
    const ratio = r.getPixelRatio()
    const size = r.getSize(new THREE.Vector2())
    const aspect = size.x / size.y
    const w = aspect >= 1 ? maxDim : Math.round(maxDim * aspect)
    const h = aspect >= 1 ? Math.round(maxDim / aspect) : maxDim
    const ringWas = this.impactRing.visible
    this.impactRing.visible = false
    r.setPixelRatio(1)
    r.setSize(w, h, false)
    r.setRenderTarget(null)
    r.clear()
    r.render(this.scene, cam)
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    out.getContext('2d')!.drawImage(this.canvas, 0, 0, w, h)
    r.setPixelRatio(ratio)
    r.setSize(size.x, size.y, false)
    this.resize()
    this.impactRing.visible = ringWas
    if (this.composer) this.composer.render()
    else r.render(this.scene, cam)
    this.audio.shutter()
    return out
  }

  resize() {
    const w = this.canvas.clientWidth || 1
    const h = this.canvas.clientHeight || 1
    this.renderer.setSize(w, h, false)
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio())
      this.composer.setSize(w, h)
    }
    this.camera.aspect = w / h
    // Hold the horizontal field of view on portrait phones.
    this.camera.fov = w / h < 1 ? 74 : 55
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.raf = 0
    for (const d of [...this.bag, ...this.landerBag]) {
      try {
        d.dispose()
      } catch {}
    }
    this.composer?.dispose()
    this.renderer.dispose()
  }
}

const scratchA = new THREE.Vector3()
const scratchB = new THREE.Vector3()
const scratchC = new THREE.Vector3()
const Z_AXIS = new THREE.Vector3(0, 0, 1)
