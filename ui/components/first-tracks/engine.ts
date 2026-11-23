/**
 * First Tracks engine: plain three.js, one class. Owns the scene, the camera,
 * the fixed-step sim loop with its signal delay, the tracks, the HUD canvases
 * and the orbiter photo. The React shell (FirstTracksGame.tsx) owns screens
 * and input and never holds three.js objects in state.
 *
 * Time works like this. The sim runs at 60 Hz in step with the wall clock.
 * Each step takes the player's input as given now; the sim applies it `uplink`
 * seconds later. Every step's pose is kept, and the scene draws the pose from
 * `downlink` seconds ago: the picture is always old. Toasts, tracks and the
 * imaged count follow the picture, not the truth.
 */
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { createDriver, type Driver, type DriverKind } from '@/lib/first-tracks/autopilot'
import { MODES, type ModeConfig } from '@/lib/first-tracks/modes'
import { comboPoints, PLAN_MAX_METRES, PLAN_MAX_POINTS, planMetres, PlanRun, stopTarget, type Pt } from '@/lib/first-tracks/plan'
import { MAX_TAPE_STEPS, recordTape, tapeToBase64 } from '@/lib/first-tracks/replay'
import { KIND_POINTS, scoreRun, type RunResult } from '@/lib/first-tracks/scoring'
import { BATTERY, clockLeft, createSim, DT, ghostOf, holdSteps, PRIZE_METRES, STEP_HZ, stepSim, toInput, windowSecondsFor, type Sim } from '@/lib/first-tracks/sim'
import { BODY, CLEAR, DECK, DECK_Y, FINDS, HALF_L, HALF_W, HOLD_SECONDS, inRect, LANDER_CENTER_Z, RAMP_FOOT, smooth, TARGET_RING, WHEEL_R, WORLD, type Site, type TargetKind } from '@/lib/first-tracks/site'
import { mulberry32 } from '@/lib/touchdown/mission'
import { makeEnvMap, regolithTextures, type Bag } from '@/components/touchdown/models'
import { buildMoonBase, type BaseModel } from '@/components/touchdown/moonbase'
import { drawLink, drawMinimap, KIND_CSS, type LinkCommand } from './hud2d'
import { buildEgressLander, buildGhost, buildRover, rockGeometry, type EgressLander, type RoverModel } from './models'

export type Phase = 'idle' | 'play' | 'done'

export type HudState = {
  phase: Phase
  /** Seconds on the clock. */
  clock: number
  /** The clock runs only once the rover is off the lander. */
  clockRunning: boolean
  /** Fully off the lander, as the picture shows it. */
  off: boolean
  metres: number
  imaged: number
  /** 0..1 */
  battery: number
  sink: number
  /** 0..1 progress of the hold on a target, and what the instrument is doing. */
  hold: number
  holdLabel: string
  hint: string
  /** Moon Base Zero's label, in fractions of the canvas, and whether it is in view. */
  baseX: number
  baseY: number
  baseOn: boolean
  /** Plot-and-send: null in the joystick modes. */
  plan: PlanHud | null
}

export type PlanHud = {
  /** Waypoints plotted and not yet sent, and the path's length. */
  points: number
  metres: number
  /** How many of them are science stops: waypoints inside a target's ring. */
  stops: number
  /** The ground can be tapped: the rover is off the lander and idle. */
  canPlot: boolean
  /** 'transit' while the uplink is on its way, 'driving' while the rover follows it. */
  state: 'idle' | 'transit' | 'driving'
  sends: number
  sendSeconds: number
  /** Why the rover is being carried off its line right now, if it is. */
  slip: '' | 'soft' | 'slope'
  /** Metres between where the rover is and where its odometry says it is. */
  drift: number
}

/** What each kind of target is, in the words the HUD and the photo use. */
export const KIND_COLOR: Record<TargetKind, number> = { image: 0x8fd3ff, rock: 0xffbf5e, ice: 0xd9b8ff }
const KIND_TAG: Record<TargetKind, string> = { image: 'IMAGE', rock: 'ROCK', ice: 'ICE' }
const KIND_SITE: Record<TargetKind, string> = { image: 'imaging', rock: 'boulder', ice: 'ice' }
/** How near the rover has to come to a target to read how strong its signal is, m. */
const CLUE_RANGE = 12
const KIND_DONE: Record<TargetKind, string> = { image: 'Regolith imaged', rock: 'Boulder spectrum taken', ice: 'Ice core drilled' }
const KIND_HOLD: Record<TargetKind, string> = { image: 'Imaging · hold still', rock: 'Reading the boulder · hold still', ice: 'Drilling for ice · hold still' }
const KIND_HINT: Record<TargetKind, string> = {
  image: 'Regolith imaging: stop inside the ring and hold still',
  rock: 'Boulder spectrum: park beside the boulder, inside the ring, and hold still',
  ice: 'Ice prospecting: stop on the crater floor, inside the ring, and hold still',
}

export type Callout = { text: string; tone: 'info' | 'warn' | 'good' | 'bad' }

export type EngineCallbacks = {
  onHud: (h: HudState) => void
  onCallout: (c: Callout) => void
  onEnd: (result: RunResult) => void
}

export interface FirstTracksAudio {
  drive(speed: number, strain: number): void
  cue(kind: 'send' | 'bump' | 'jolt' | 'imaged' | 'egress' | 'ten' | 'bad' | 'good' | 'tick'): void
  stopAll(): void
}

/** Floats kept per sim step, so the scene can draw any past moment. */
const STRIDE = 12
const H_X = 0
const H_Y = 1
const H_Z = 2
const H_H = 3
const H_PITCH = 4
const H_ROLL = 5
const H_WHEEL = 6
/** Grains of thrown regolith alive at once. */
const DUST_N = 1600
const H_ODO = 7
const H_OFF = 8
const H_SINK = 9
const H_ENERGY = 10
const H_HOLD = 11

const RATIO_STEPS = [2, 1.5, 1.25, 1, 0.85, 0.75]
const MAX_TRACK_QUADS = 14000
const v3 = () => new THREE.Vector3()
const scratch = new THREE.Vector3()

/** Something that throws a long shadow at low sun: where it stands, how tall and how wide. */
type Caster = { x: number; z: number; h: number; w: number }

type Pose = { x: number; y: number; z: number; h: number; pitch: number; roll: number; wheel: number; odo: number; off: boolean; sink: number; energy: number; hold: number }

export class FirstTracksEngine {
  private renderer: THREE.WebGLRenderer
  private composer: EffectComposer | null = null
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(58, 1, 0.25, 60000)
  private sunLight = new THREE.DirectionalLight(0xfff1dc, 8.5)
  private sunDir = v3()
  private skyGroup = new THREE.Group()
  private sunSprites: THREE.Object3D[] = []
  private env: THREE.Texture
  private bag: Bag = []
  private modelBag: Bag = []
  private disposed = false
  private mobile: boolean
  private shadowHalf: number

  private lander!: EgressLander
  private rover!: RoverModel
  private ghost!: RoverModel
  private logo: THREE.Texture | null = null
  private beacons: { group: THREE.Group; ring: THREE.Mesh; beam: THREE.Mesh; fill: THREE.Mesh; tag: THREE.Sprite; kind: TargetKind; shown: boolean; /** After the run: a rich find, called out for the next attempt. */ reveal: boolean }[] = []
  /** What the rover's instruments have read of each target from a distance: 0 nothing yet, 1 a weak signal, 2 a strong one. */
  private scanned: number[] = []
  private tagTex: Record<TargetKind, THREE.Texture> | null = null
  private clueTex: Record<TargetKind, THREE.Texture[]> | null = null
  private richTex: THREE.Texture[] = []
  private ribbon: THREE.Mesh | null = null
  private ribbonMat: THREE.MeshBasicMaterial | null = null
  private decals: THREE.InstancedMesh | null = null
  private baseDecals: THREE.InstancedMesh | null = null
  private decalGeo: THREE.BufferGeometry | null = null
  private decalMat: THREE.Material | null = null
  private base: BaseModel | null = null
  private baseBag: Bag = []
  private flag: THREE.Texture | null = null
  private decalUniforms = { uCentre: { value: new THREE.Vector2() }, uRadius: { value: 30 } }

  // Tracks: four strips of quads, one behind each wheel.
  private trackGeo = new THREE.BufferGeometry()
  private trackPos = new Float32Array(MAX_TRACK_QUADS * 12)
  private trackUv = new Float32Array(MAX_TRACK_QUADS * 8)
  private trackQuads = 0
  private trackPrev: Float32Array | null = null
  private trackLen = 0
  private trackAt = { x: 0, z: 0 }
  private trail: number[] = []
  private tenShown: [number, number] | null = null

  // Run state.
  phase: Phase = 'idle'
  mode: ModeConfig = MODES.easy
  private sim: Sim | null = null
  private hist = new Float32Array((MAX_TAPE_STEPS + 2) * STRIDE)
  private tape: number[] = []
  // Plot-and-send: the draft path, the plan being driven, and how many were sent.
  private planPts: Pt[] = []
  private planRun: PlanRun | null = null
  private planFrom: Pt = { x: 0, z: 0 }
  private sends = 0
  /** 1 while loose patches are tinted (plot-and-send), else 0. */
  private softTint = { value: 1 }
  // Regolith thrown up by the wheels: no air, so every grain flies a clean arc and lands.
  private dustPos = new Float32Array(DUST_N * 3)
  private dustVel = new Float32Array(DUST_N * 3)
  private dustFloor = new Float32Array(DUST_N)
  private dustLive = new Uint8Array(DUST_N)
  private dustNext = 0
  private dustDue = [0, 0, 0, 0]
  private dustPts: THREE.Points | null = null
  private dustPrev: [number, number, number] | null = null
  /** Beacon tag pictures: the game's, and plot-and-send's. */
  /** Jobs finished before the plan in flight was sent; combo points so far; the best single uplink. */
  private jobsAtSend = 0
  private combo = 0
  private comboBest = 0
  private comboNote = ''
  private planLine: THREE.Mesh | null = null
  private planMat: THREE.MeshBasicMaterial | null = null
  private planDots: THREE.Mesh[] = []
  private wall = 0
  private inTh = 0
  private inSt = 0
  private sentTh = 0
  private sentSt = 0
  private commands: LinkCommand[] = []
  private eventCursor = 0
  private shownImaged: boolean[] = []
  private pose: Pose = { x: 0, y: DECK_Y, z: 0.55, h: 0, pitch: 0, roll: 0, wheel: 0, odo: 0, off: false, sink: 0, energy: 0, hold: 0 }
  private tipT = 0
  private tipSign = 1
  private tipPitch = false
  private tipDir = { x: 0, z: 0 }
  private result: RunResult | null = null
  private orbiterShot: HTMLCanvasElement | null = null
  private shot: HTMLCanvasElement | null = null
  private driver: Driver | null = null
  private hudAcc = 0
  private lastHint = ''
  private holdLabel = ''

  // Camera.
  private camPos = new THREE.Vector3(9, 5, 9)
  private camLook = new THREE.Vector3(0, 1, 2)
  private camBlend = 0
  private idleT = 0
  private endT = 0
  // The player's own framing: drag to orbit, scroll or pinch to zoom, double-click to reset.
  private orbitYaw = 0
  private orbitPitch = 0
  private zoomBy = 1
  private shake = 0
  /** The finished run's tracks, for the pull-back view: centre and half-extent, m. */
  private span = { x: 0, z: 0, r: 12 }

  // Frame pacing.
  private raf = 0
  private last = 0
  private baseRatio: number
  private ratioCap: number
  private ratioTooSlow = Infinity
  private winMs = 0
  private winFrames = 0
  private goodWindows = 0
  private settleMs = 1500

  minimap: HTMLCanvasElement | null = null
  link: HTMLCanvasElement | null = null

  constructor(
    private canvas: HTMLCanvasElement,
    private site: Site,
    private cb: EngineCallbacks,
    private audio: FirstTracksAudio | null,
    opts: { mobile: boolean; bloom?: boolean }
  ) {
    this.mobile = opts.mobile
    this.shadowHalf = opts.mobile ? 24 : 34
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false })
    this.baseRatio = Math.min(window.devicePixelRatio || 1, opts.mobile ? 1.5 : 2)
    this.ratioCap = this.baseRatio
    this.renderer.setPixelRatio(this.baseRatio)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15
    this.renderer.shadowMap.enabled = true
    // Hard-edged shadows: right for a vacuum, and far cheaper than the soft filter.
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.scene.background = new THREE.Color(0x000000)

    this.setSun(MODES.easy)
    this.env = makeEnvMap(this.renderer, [this.sunDir.x, this.sunDir.y, this.sunDir.z], this.bag)
    this.planFarField()
    this.buildLights()
    this.buildTerrain()
    this.buildRocks()
    this.buildSky()
    this.buildBase()
    this.buildBeacons()
    this.buildTracks()
    this.buildModels()
    this.loadTextures()
    if (!opts.mobile && opts.bloom !== false) this.buildComposer()
    this.placeSun()
    this.resetRun(MODES.easy)
    this.resize()
  }

  private track<T extends { dispose: () => void }>(x: T): T {
    this.bag.push(x)
    return x
  }

  // ---------------------------------------------------------------------------
  // Scene construction
  // ---------------------------------------------------------------------------

  /** The day's sun, lifted by the mode's bonus: Easy gets shorter shadows. */
  private setSun(mode: ModeConfig) {
    const el = ((this.site.sunElevation + mode.sunBonusDeg) * Math.PI) / 180
    const az = this.site.sunAzimuth
    this.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
  }

  private buildComposer() {
    try {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
      const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 })
      const composer = new EffectComposer(this.renderer, target)
      composer.addPass(new RenderPass(this.scene, this.camera))
      // Only genuinely hot pixels bloom: the sun and glints off foil.
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.6, 3.6))
      composer.addPass(new OutputPass())
      this.composer = composer
      this.bag.push(target)
    } catch {
      this.composer = null
    }
  }

  private buildLights() {
    this.sunLight.castShadow = true
    const s = this.sunLight.shadow
    const size = this.mobile ? 2048 : 4096
    s.mapSize.set(size, size)
    // A short depth range and almost no bias. At a sun this low any offset
    // moves a shadow's start a long way along the ground, and a rock whose
    // shadow starts a hand's width behind it looks as if it is floating. Back
    // faces cast the shadows (three's default), so lit faces need no bias.
    s.camera.near = 10
    s.camera.far = 250
    s.bias = -0.00006
    s.normalBias = 0.004
    this.fitShadow(this.shadowHalf)
    this.scene.add(this.sunLight, this.sunLight.target)
    // Bounce off the sunlit ground plus earthshine: enough to read shapes in
    // shadow, no more. Vacuum shadows are hard and deep.
    this.scene.add(new THREE.HemisphereLight(0x7b7a76, 0x55504a, 0.6))
    const earthshine = new THREE.DirectionalLight(0x9db8ff, 0.14)
    earthshine.position.set(0.1, 0.5, 1)
    this.scene.add(earthshine)
  }

  /** +1 when the sun stands on the +x side of the ramp, -1 on the other. */
  private sunSide(): number {
    return this.site.sunAzimuth < 0 ? -1 : 1
  }

  private fitShadow(half: number) {
    const c = this.sunLight.shadow.camera
    c.left = -half
    c.right = half
    c.top = half
    c.bottom = -half
    c.updateProjectionMatrix()
  }

  /** Where Moon Base Zero stands, out on the horizon. */
  private basePos = { x: 0, y: 0, z: 0 }
  private baseLevel = 0
  /** Craters beyond the play area: a scatter of every size, so the plain out to the horizon is not bare. */
  private farCraters: { x: number; z: number; r: number }[] = []

  /** Lay out everything beyond the play area. Looks only: none of it is in the sim. */
  private planFarField() {
    const site = this.site
    // The base stands a little to one side of Earth as seen from the lander, 600 m off.
    const side = this.sunSide()
    const fx = -side * 0.766
    const fz = -0.642
    const turn = 0.34
    const dx = fx * Math.cos(turn) + -fz * Math.sin(turn)
    const dz = fz * Math.cos(turn) + fx * Math.sin(turn)
    this.basePos.x = dx * 600
    this.basePos.z = dz * 600
    const rng = mulberry32(site.seed ^ 0xfa4)
    const clearOfBase = (x: number, z: number, r: number) => Math.hypot(x - this.basePos.x, z - this.basePos.z) > 250 + r * 1.9
    // A few very large, old ones.
    for (let i = 0; i < 14; i++) {
      const a = rng() * Math.PI * 2
      const d = 130 + Math.pow(rng(), 1.4) * 2200
      const r = 25 + rng() * 0.11 * d + rng() * 30
      const x = Math.sin(a) * d
      const z = Math.cos(a) * d
      if (clearOfBase(x, z, r)) this.farCraters.push({ x, z, r })
    }
    // And many ordinary ones, larger with distance so the far mesh can still hold their rims.
    for (let i = 0; i < 190; i++) {
      const a = rng() * Math.PI * 2
      const d = 64 + Math.pow(rng(), 1.5) * 950
      const r = Math.min(42, Math.max(2.6, d / 42) * (0.6 + rng() * 1.9))
      const x = Math.sin(a) * d
      const z = Math.cos(a) * d
      if (d - r * 1.9 < 57 || !clearOfBase(x, z, r)) continue
      this.farCraters.push({ x, z, r })
    }
    this.baseLevel = this.rawFar(this.basePos.x, this.basePos.z)
    this.basePos.y = this.baseLevel
  }

  private rawFar(x: number, z: number): number {
    const site = this.site
    const d = Math.hypot(x, z)
    let h = site.ground(x, z)
    const far = smooth(90, 440, d)
    h += far * (22 * site.noise(x / 760 + 3, z / 760 - 5) + 7 * site.noise(x / 210 - 9, z / 210 + 2))
    for (const c of this.farCraters) {
      const ex = x - c.x
      const ez = z - c.z
      const reach = c.r * 1.8
      if (ex > reach || ex < -reach || ez > reach || ez < -reach) continue
      const q = Math.hypot(ex, ez) / c.r
      if (q > 1.8) continue
      h += q < 1 ? 0.2 * c.r * (q * q - 1) + 0.05 * c.r : 0.05 * c.r * Math.pow(1 - ((q - 1) / 0.8) ** 2, 3)
    }
    // The Moon is small: the ground falls away quickly toward the horizon.
    return h - (d * d) / (2 * 1737400) - 0.06 * (1 - smooth(86, 130, d))
  }

  /** Terrain beyond the play area: rolling ground and craters out to the horizon, graded level under Moon Base Zero. */
  private farHeight = (x: number, z: number): number => {
    const h = this.rawFar(x, z)
    const b = Math.hypot(x - this.basePos.x, z - this.basePos.z)
    if (b > 340) return h
    return this.baseLevel + (h - this.baseLevel) * smooth(210, 340, b)
  }

  /**
   * Regolith material, after Touchdown's: albedo and relief sampled at two
   * scales so the ground is sharp at the wheels and does not tile at range,
   * with the relief as a true world-space slope so the low sun rakes across
   * it. Soft patches (aSoft) are smoother and a little darker.
   */
  private regolithMaterial(): THREE.MeshStandardMaterial {
    const size = this.mobile ? 512 : 1024
    const { albedo, bump } = regolithTextures(this.site.seed, size, this.bag)
    const aniso = Math.min(this.mobile ? 4 : 16, this.renderer.capabilities.getMaxAnisotropy())
    albedo.anisotropy = aniso
    bump.anisotropy = aniso
    const mat = this.track(new THREE.MeshStandardMaterial({ vertexColors: true, map: albedo, roughness: 1, metalness: 0 }))
    const texel = 1 / size
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uRelief = { value: bump }
      shader.uniforms.uTexel = { value: texel }
      shader.uniforms.uSoftTint = this.softTint
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', 'attribute float aSoft;\nvarying float vSoft;\n#include <common>')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSoft = aSoft;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `varying float vSoft;
uniform sampler2D uRelief;
uniform float uTexel;
uniform float uSoftTint;
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
float rMid = smoothstep(14.0, 70.0, rDist);
float rFar = smoothstep(300.0, 1800.0, rDist);
vec4 rNear = texture2D(map, vMapUv);
vec4 rMidC = texture2D(map, vMapUv * 0.0833);
vec4 rFarC = texture2D(map, vMapUv * 0.0069);
vec4 sampledDiffuseColor = mix(rNear * (0.55 + 0.75 * rMidC.g), rMidC * (0.55 + 0.75 * rFarC.g), rMid);
sampledDiffuseColor = mix(sampledDiffuseColor, rFarC, rFar);
// Soft regolith is finer: less speckle.
sampledDiffuseColor = mix(sampledDiffuseColor, vec4(vec3(0.76), 1.0), vSoft * 0.55);
// Plot-and-send: loose patches are a darker grey so a path can be plotted round them.
sampledDiffuseColor.rgb *= mix(1.0, 0.58, smoothstep(0.06, 0.4, vSoft) * uSoftTint);
diffuseColor *= sampledDiffuseColor;`
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
{
  vec2 g = reliefSlope(vMapUv, 0.05, 6.0) * (1.0 - rMid) * (1.0 - 0.8 * vSoft)
         + reliefSlope(vMapUv * 0.0833, 0.8, 72.0) * (1.0 - rFar) * (1.0 - 0.5 * vSoft)
         + reliefSlope(vMapUv * 0.0069, 12.0, 870.0) * rFar;
  vec3 wx = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  vec3 wz = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
  normal = normalize(normal - g.x * wx - g.y * wz);
}`
        )
    }
    return mat
  }

  private buildTerrain() {
    const site = this.site
    const mat = this.regolithMaterial()
    const everyCrater = [...site.craters, ...this.farCraters]
    const shade = (x: number, z: number, soft: number, detail: boolean): number => {
      // Tone: broad mottling, fresh crater rims and ejecta a touch brighter, bowls and soft ground darker.
      let c = 0.235 + 0.02 * site.noise(x / 9.7 + 9, z / 9.7) + 0.012 * site.noise(x / 2.3, z / 2.3 + 3)
      for (const k of detail ? site.craters : everyCrater) {
        const ex = x - k.x
        const ez = z - k.z
        const reach = k.r * 2.2
        if (ex > reach || ex < -reach || ez > reach || ez < -reach) continue
        const d = Math.hypot(ex, ez) / k.r
        if (d > 2.2) continue
        c += d < 1 ? -0.022 * (1 - d * d) : 0.03 * Math.pow(Math.max(0, 1 - (d - 1) / 1.2), 2) * (0.6 + 0.4 * site.noise(x * 1.3, z * 1.3))
      }
      return c * (1 - 0.13 * soft)
    }
    const build = (geo: THREE.BufferGeometry, height: (x: number, z: number) => number, detail: boolean) => {
      const pos = geo.attributes.position as THREE.BufferAttribute
      const col = new Float32Array(pos.count * 3)
      const soft = new Float32Array(pos.count)
      const uv = new Float32Array(pos.count * 2)
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const z = pos.getZ(i)
        pos.setY(i, height(x, z))
        const s = detail ? site.softAt(x, z) : 0
        const c = shade(x, z, s, detail)
        soft[i] = s
        col[i * 3] = c * 1.03
        col[i * 3 + 1] = c
        col[i * 3 + 2] = c * 0.95
        uv[i * 2] = x / 6
        uv[i * 2 + 1] = z / 6
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
      geo.setAttribute('aSoft', new THREE.BufferAttribute(soft, 1))
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
      geo.computeVertexNormals()
      const mesh = new THREE.Mesh(this.track(geo), mat)
      mesh.receiveShadow = true
      this.scene.add(mesh)
      return mesh
    }
    // The play area: fine enough for crater rims to hold an edge.
    const seg = this.mobile ? 300 : 440
    const near = new THREE.PlaneGeometry(120, 120, seg, seg)
    near.rotateX(-Math.PI / 2)
    const nearMesh = build(near, site.ground, true)
    nearMesh.castShadow = true
    // Out to the horizon: rings that widen with distance.
    const rings = this.mobile ? 90 : 160
    const around = this.mobile ? 128 : 224
    const far = new THREE.PlaneGeometry(1, 1, around, rings)
    const fp = far.attributes.position as THREE.BufferAttribute
    for (let j = 0; j <= rings; j++) {
      const r = 52 * Math.pow(9000 / 52, j / rings)
      for (let i = 0; i <= around; i++) {
        const a = (i / around) * Math.PI * 2
        fp.setXYZ(j * (around + 1) + i, Math.sin(a) * r, 0, Math.cos(a) * r)
      }
    }
    build(far, this.farHeight, false)
  }

  private buildRocks() {
    const site = this.site
    const rng = mulberry32(site.seed ^ 0x5151)
    const mat = this.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 }))
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s3 = v3()
    const p3 = v3()
    const color = new THREE.Color()
    const variants = 3
    const pebbles = this.mobile ? 1600 : 4200
    // Three shapes, so no two neighbours match.
    const buckets: { x: number; y: number; z: number; sx: number; sy: number; sz: number; rot: number; tilt: number; g: number }[][] = [[], [], []]
    site.rocks.forEach((r, i) => {
      const tall = r.h > CLEAR
      buckets[i % variants].push({
        x: r.x,
        // Sit the rock a little into the ground: buried, not placed.
        y: r.y + r.h * 0.42,
        z: r.z,
        sx: r.r,
        sy: r.h * 0.62,
        sz: r.r * r.sq,
        rot: r.rot,
        tilt: tall ? 0.25 : 0.6,
        g: 0.13 + rng() * 0.07,
      })
    })
    // Pebbles are for looks only: a coarse shape, and no shadow pass.
    const grit: (typeof buckets)[number] = []
    for (let k = 0; k < pebbles; k++) {
      const a = rng() * Math.PI * 2
      const d = 2 + Math.pow(rng(), 0.7) * 70
      const x = Math.sin(a) * d
      const z = Math.cos(a) * d
      if (inRect(DECK, x, z, 0.4) || inRect(BODY, x, z, 0.2)) continue
      const r = 0.015 + Math.pow(rng(), 3) * 0.05
      grit.push({ x, y: site.ground(x, z) + r * 0.3, z, sx: r, sy: r * 0.7, sz: r, rot: rng() * 6.28, tilt: 1, g: 0.14 + rng() * 0.08 })
    }
    // Rocks too small to feel join the pebbles.
    for (const list of buckets) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].sx < 0.12) grit.push(list.splice(i, 1)[0])
      }
    }
    buckets.push(grit)
    // Boulders beyond the play area, thickest round the far craters: never
    // reached, but the plain out to the horizon should not be swept clean.
    const afar: (typeof buckets)[number] = []
    const farCount = this.mobile ? 500 : 1300
    for (let k = 0; k < farCount; k++) {
      let x: number
      let z: number
      const crater = rng() < 0.4 ? this.farCraters[Math.floor(rng() * this.farCraters.length)] : null
      const a = rng() * Math.PI * 2
      if (crater && crater.r < 30) {
        const d = crater.r * (0.9 + rng() * 0.8)
        x = crater.x + Math.sin(a) * d
        z = crater.z + Math.cos(a) * d
      } else {
        const d = 58 + Math.pow(rng(), 1.3) * 400
        x = Math.sin(a) * d
        z = Math.cos(a) * d
      }
      const d0 = Math.hypot(x, z)
      const r = (0.28 + Math.pow(rng(), 2.4) * 1.5) * (1 + d0 / 260)
      if (d0 < 57 || Math.hypot(x - this.basePos.x, z - this.basePos.z) < 240) continue
      const h = r * (0.55 + rng() * 0.35)
      afar.push({ x, y: this.farHeight(x, z) + h * 0.3, z, sx: r, sy: h, sz: r * (0.75 + rng() * 0.4), rot: rng() * 6.28, tilt: 0.3, g: 0.13 + rng() * 0.07 })
    }
    buckets.push(afar)
    buckets.forEach((list, v) => {
      const isGrit = list === grit || list === afar
      const mesh = new THREE.InstancedMesh(rockGeometry(list === afar ? 1 : isGrit ? 0 : this.mobile ? 1 : 2, site.seed ^ (0x33 + v * 97), this.bag), mat, list.length)
      list.forEach((r, i) => {
        e.set((rng() - 0.5) * r.tilt, r.rot, (rng() - 0.5) * r.tilt)
        q.setFromEuler(e)
        m.compose(p3.set(r.x, r.y, r.z), q, s3.set(r.sx, r.sy, r.sz))
        mesh.setMatrixAt(i, m)
        mesh.setColorAt(i, color.setRGB(r.g * 1.03, r.g, r.g * 0.95))
      })
      mesh.castShadow = !isGrit
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      this.scene.add(mesh)
      this.bag.push(mesh)
    })

    // Far rocks are beyond the shadow map: give them a stretched decal so the
    // low sun still gives them away. Decals fade out where the real shadows are.
    const sgeo = this.track(new THREE.PlaneGeometry(1, 1))
    sgeo.rotateX(-Math.PI / 2)
    sgeo.translate(0, 0, 0.5)
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
    const dmat = this.track(
      new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: alpha, transparent: true, opacity: 0.86, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    )
    dmat.onBeforeCompile = (shader) => {
      shader.uniforms.uCentre = this.decalUniforms.uCentre
      shader.uniforms.uRadius = this.decalUniforms.uRadius
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', 'varying vec2 vWorldXZ;\n#include <common>')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldXZ = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xz;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', 'varying vec2 vWorldXZ;\nuniform vec2 uCentre;\nuniform float uRadius;\n#include <common>')
        .replace(
          '#include <alphamap_fragment>',
          '#include <alphamap_fragment>\n// Inside the shadow map real shadows do the work; decals take over in a ring just within its edge.\ndiffuseColor.a *= smoothstep(uRadius * 0.82, uRadius * 0.94, length(vWorldXZ - uCentre));'
        )
    }
    const tall: Caster[] = site.rocks.filter((r) => r.h > 0.12).map((r) => ({ x: r.x, z: r.z, h: r.h * 0.9, w: r.r * 1.8 }))
    for (const r of afar) tall.push({ x: r.x, z: r.z, h: r.sy * 1.3, w: r.sx * 1.8 })
    this.decalGeo = sgeo
    this.decalMat = dmat
    this.decals = this.decalSet(tall)
    this.scene.add(this.decals)
  }

  /** A set of stretched shadow decals, one per caster. Laid along the sun by layDecals. */
  private decalSet(casters: Caster[]): THREE.InstancedMesh {
    const set = new THREE.InstancedMesh(this.decalGeo!, this.decalMat!, Math.max(1, casters.length))
    set.count = casters.length
    set.frustumCulled = false
    set.renderOrder = 1
    set.userData.casters = casters
    this.bag.push(set)
    return set
  }

  /** Lay every shadow decal along the current sun direction. */
  private layDecals() {
    const site = this.site
    const m = new THREE.Matrix4()
    const flat = Math.hypot(this.sunDir.x, this.sunDir.z)
    const dx = -this.sunDir.x / flat
    const dz = -this.sunDir.z / flat
    const tanE = this.sunDir.y / flat
    const a = v3()
    const b = v3()
    const c = v3()
    for (const set of [this.decals, this.baseDecals]) {
      if (!set) continue
      const casters = set.userData.casters as Caster[]
      // Inside the play area the sim's own ground is exact; beyond it, the far field's.
      casters.forEach((r, i) => {
        const ground = Math.hypot(r.x, r.z) < 56 ? site.ground : this.farHeight
        const len = Math.min(60, r.h / tanE) + r.w * 0.28
        const y0 = ground(r.x, r.z) + 0.03
        const y1 = ground(r.x + dx * len, r.z + dz * len) + 0.03
        a.set(dx * len, y1 - y0, dz * len)
        const span = a.length()
        a.normalize()
        b.set(-dz, 0, dx)
        c.crossVectors(a, b).normalize()
        m.makeBasis(b.multiplyScalar(r.w), c, a.multiplyScalar(span))
        m.setPosition(r.x, y0, r.z)
        set.setMatrixAt(i, m)
      })
      set.instanceMatrix.needsUpdate = true
    }
  }

  /** Moon Base Zero, out on the horizon: Touchdown's town, seen from the other side of the plain. */
  private buildBase() {
    if (this.base) {
      this.scene.remove(this.base.group)
      for (const d of this.baseBag) d.dispose()
      this.baseBag = []
    }
    this.base = buildMoonBase(this.basePos, this.sunSide(), this.env, this.farHeight, this.flag, this.site.seed, this.baseBag)
    if (this.baseDecals) this.base.group.remove(this.baseDecals)
    this.baseDecals = this.decalSet(this.base.shadows.map((sh) => ({ x: sh.x, z: sh.z, h: sh.h, w: sh.w })))
    this.scene.add(this.base.group, this.baseDecals)
    this.layDecals()
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
    const rng = mulberry32(this.site.seed ^ 0x31337)
    const count = this.mobile ? 1400 : 3200
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const R = 40000
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
    const stars = new THREE.Points(geo, this.track(new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, depthWrite: false, toneMapped: false })))
    stars.frustumCulled = false
    this.skyGroup.add(stars)

    // Earth: low over the horizon behind the lander, on the side away from
    // the sun, so the start screen has the lander, the rover and Earth in one
    // frame. About 2.5x its true size, because this is a postcard.
    const er = 2300
    const earth = new THREE.Mesh(this.track(new THREE.SphereGeometry(er, 64, 40)), this.track(new THREE.MeshStandardMaterial({ color: 0x2a5cab, roughness: 0.75, metalness: 0 })))
    earth.name = 'earth'
    earth.position.set(-this.sunSide() * 0.74, 0.17, -0.62).normalize().multiplyScalar(36000)
    earth.rotation.set(0.35, 2.2, 0.2)
    const earthMat = earth.material as THREE.MeshStandardMaterial
    earthMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float earthRim = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
totalEmissiveRadiance += vec3(0.16, 0.42, 1.0) * (pow(earthRim, 2.2) * 0.9 + pow(earthRim, 7.0) * 1.6);`
      )
    }
    this.skyGroup.add(earth)

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
    glare.scale.setScalar(13000)
    const disc = new THREE.Mesh(this.track(new THREE.CircleGeometry(350, 32)), this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(30, 28, 24), toneMapped: false, depthWrite: false })))
    this.sunSprites = [glare, disc]
    this.skyGroup.add(glare, disc)
    this.scene.add(this.skyGroup)
  }

  /** Point the light, the sun in the sky and the rock decals along the current sun direction. */
  private placeSun() {
    const p = this.sunDir.clone().multiplyScalar(38000)
    for (const s of this.sunSprites) {
      s.position.copy(p)
      if ((s as THREE.Mesh).isMesh) s.lookAt(0, 0, 0)
    }
    this.layDecals()
  }

  private buildBeacons() {
    const site = this.site
    const ringMat = (color: number, opacity: number) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
    const drape = (inner: number, outer: number, cx: number, cz: number) => {
      const n = 72
      const geo = new THREE.BufferGeometry()
      const pos = new Float32Array((n + 1) * 2 * 3)
      const idx: number[] = []
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2
        for (let k = 0; k < 2; k++) {
          const r = k ? outer : inner
          const x = Math.sin(a) * r
          const z = Math.cos(a) * r
          pos.set([x, site.ground(cx + x, cz + z) - site.ground(cx, cz) + 0.05, z], (i * 2 + k) * 3)
        }
        if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geo.setIndex(idx)
      return this.track(geo)
    }
    const beamGeo = this.track(new THREE.CylinderGeometry(0.07, 0.16, 12, 12, 1, true))
    beamGeo.translate(0, 6, 0)
    // A small tag over each beacon: what the job is and its base points. What the site holds is hidden until the job is done.
    const tagTexture = (kind: TargetKind | null, right: string, rightCol = '#fff', left = '') => {
      const edge = kind ? KIND_CSS[kind] : rightCol
      const c = document.createElement('canvas')
      c.width = 256
      c.height = 72
      const g = c.getContext('2d')!
      g.fillStyle = 'rgba(6,9,16,0.78)'
      g.beginPath()
      g.roundRect(2, 2, 252, 68, 14)
      g.fill()
      g.strokeStyle = edge
      g.lineWidth = 3
      g.stroke()
      g.fillStyle = edge
      g.font = `800 ${/\d/.test(right) ? 34 : 28}px "Archivo", "Lato", system-ui, sans-serif`
      g.textBaseline = 'middle'
      g.fillText(kind ? KIND_TAG[kind] : left, 18, 38)
      g.fillStyle = rightCol
      g.textAlign = 'right'
      g.font = `800 ${/\d/.test(right) ? 30 : 23}px "Lato", system-ui, sans-serif`
      g.fillText(right, 238, 38)
      const t = this.track(new THREE.CanvasTexture(c))
      t.colorSpace = THREE.SRGBColorSpace
      return t
    }
    const each = <T,>(make: (kind: TargetKind) => T) => ({ image: make('image'), rock: make('rock'), ice: make('ice') })
    // Far off: the job and its base points. What the site holds is hidden.
    const tags = each((kind) => tagTexture(kind, `${KIND_POINTS[kind]} \u00d7 ?`))
    // Within instrument range: a weak or a strong signal. Poor and fair finds read weak, good and rich read strong.
    this.clueTex = each((kind) => [tagTexture(kind, 'WEAK', '#ff9c8f'), tagTexture(kind, 'STRONG', '#86e3a8')])
    // After the run: where the rich finds were.
    this.richTex = [tagTexture(null, 'MISSED', '#ffd24a', 'RICH'), tagTexture(null, 'FOUND', '#86e3a8', 'RICH')]
    this.tagTex = tags
    site.targets.forEach((t) => {
      const group = new THREE.Group()
      group.position.set(t.x, site.ground(t.x, t.z), t.z)
      const col = KIND_COLOR[t.kind]
      const ring = new THREE.Mesh(drape(TARGET_RING - 0.16, TARGET_RING, t.x, t.z), this.track(ringMat(col, 0.85)))
      const fill = new THREE.Mesh(drape(0.02, 0.22, t.x, t.z), this.track(ringMat(col, 0.7)))
      const beam = new THREE.Mesh(beamGeo, this.track(ringMat(col, 0.2)))
      const tag = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: tags[t.kind], depthTest: false, depthWrite: false, sizeAttenuation: false, transparent: true, toneMapped: false })))
      tag.scale.set(0.115, 0.0323, 1)
      tag.position.y = 3.1
      tag.renderOrder = 4
      // Rings draw before the rover so they never show over its wheels.
      ring.renderOrder = -1
      fill.renderOrder = -1
      beam.renderOrder = 2
      group.add(ring, fill, beam, tag)
      this.scene.add(group)
      this.beacons.push({ group, ring, beam, fill, tag, kind: t.kind, shown: false, reveal: false })
    })
  }

  private buildTracks() {
    const idx = new Uint32Array(MAX_TRACK_QUADS * 6)
    for (let q = 0; q < MAX_TRACK_QUADS; q++) idx.set([q * 4, q * 4 + 2, q * 4 + 1, q * 4 + 1, q * 4 + 2, q * 4 + 3], q * 6)
    this.trackGeo.setAttribute('position', new THREE.BufferAttribute(this.trackPos, 3))
    this.trackGeo.setAttribute('uv', new THREE.BufferAttribute(this.trackUv, 2))
    this.trackGeo.setIndex(new THREE.BufferAttribute(idx, 1))
    this.trackGeo.setDrawRange(0, 0)
    this.bag.push(this.trackGeo)
    // The rut: pressed, darker regolith with the grousers' bars across it and a crisp edge.
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const g = c.getContext('2d')!
    g.clearRect(0, 0, 64, 64)
    g.fillStyle = 'rgba(0,0,0,0.74)'
    g.fillRect(4, 0, 56, 64)
    g.fillStyle = 'rgba(0,0,0,0.5)'
    for (let y = 0; y < 64; y += 16) g.fillRect(4, y, 56, 7)
    g.fillStyle = 'rgba(0,0,0,0.6)'
    g.fillRect(4, 0, 5, 64)
    g.fillRect(55, 0, 5, 64)
    const tex = this.track(new THREE.CanvasTexture(c))
    tex.wrapT = THREE.RepeatWrapping
    tex.anisotropy = 8
    const mat = this.track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, toneMapped: false }))
    const mesh = new THREE.Mesh(this.trackGeo, mat)
    mesh.frustumCulled = false
    mesh.renderOrder = 0
    this.scene.add(mesh)
  }

  private buildModels() {
    for (const d of this.modelBag) d.dispose()
    this.modelBag = []
    if (this.lander) this.scene.remove(this.lander.group)
    if (this.rover) this.scene.remove(this.rover.group)
    if (this.ghost) this.scene.remove(this.ghost.group)
    this.lander = buildEgressLander(this.env, this.logo, this.site.seed, this.modelBag)
    this.rover = buildRover(this.env, this.logo, this.site.seed, this.modelBag)
    this.ghost = buildGhost(this.modelBag)
    this.ghost.group.visible = false
    this.scene.add(this.lander.group, this.rover.group, this.ghost.group)
    // New materials compile on their first frames: do not judge the frame rate by them.
    this.settleMs = Math.max(this.settleMs, 2500)
    this.winMs = 0
    this.winFrames = 0
  }

  /** The MoonDAO mark and the photographic Earth arrive after first paint; the game never waits on them. */
  private loadTextures() {
    const loader = new THREE.TextureLoader()
    loader.load(
      '/touchdown/moondao-mark.png',
      (t) => {
        if (this.disposed) {
          t.dispose()
          return
        }
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 8
        this.bag.push(t)
        this.logo = t
        this.buildModels()
      },
      undefined,
      () => {}
    )
    loader.load(
      '/flat-moondao-flag.png',
      (t) => {
        if (this.disposed) {
          t.dispose()
          return
        }
        t.colorSpace = THREE.SRGBColorSpace
        this.bag.push(t)
        this.flag = t
        this.buildBase()
      },
      undefined,
      () => {}
    )
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

  // ---------------------------------------------------------------------------
  // Run control
  // ---------------------------------------------------------------------------

  private resetRun(mode: ModeConfig) {
    this.mode = mode
    this.sim = createSim(this.site, mode)
    this.tape = []
    this.planPts = []
    this.planRun = null
    this.sends = 0
    this.jobsAtSend = 0
    this.combo = 0
    this.comboBest = 0
    this.drawPlan()
    this.wall = 0
    this.inTh = 0
    this.inSt = 0
    this.sentTh = 0
    this.sentSt = 0
    this.commands = []
    this.eventCursor = 0
    this.shownImaged = this.site.targets.map(() => false)
    this.tipT = 0
    this.result = null
    this.orbiterShot = null
    this.shot = null
    this.trackQuads = 0
    this.trackPrev = null
    this.trackLen = 0
    this.trail = []
    this.tenShown = null
    this.trackGeo.setDrawRange(0, 0)
    this.camBlend = 0
    this.endT = 0
    this.shake = 0
    this.resetCamera()
    if (this.ribbon) this.ribbon.visible = false
    this.fitShadow(this.shadowHalf)
    this.decalUniforms.uRadius.value = this.shadowHalf
    this.lastHint = ''
    this.record(0)
    this.samplePose(0)
    for (const b of this.beacons) this.setBeacon(b, false)
    this.scanned = this.site.targets.map(() => 0)
    this.ghost.group.visible = false
  }

  private setBeacon(b: FirstTracksEngine['beacons'][number], done: boolean) {
    b.shown = done
    b.tag.visible = !done
    if (!done) {
      b.reveal = false
      if (this.tagTex) (b.tag.material as THREE.SpriteMaterial).map = this.tagTex[b.kind]
      ;(b.beam.material as THREE.MeshBasicMaterial).color.set(KIND_COLOR[b.kind])
    }
    const col = done ? 0x86e3a8 : KIND_COLOR[b.kind]
    ;(b.ring.material as THREE.MeshBasicMaterial).color.set(col)
    ;(b.ring.material as THREE.MeshBasicMaterial).opacity = done ? 0.45 : 0.85
    ;(b.fill.material as THREE.MeshBasicMaterial).color.set(col)
    b.beam.visible = !done
  }

  /** Start a run. The ramp is down and the rover is parked across the deck. */
  start(mode: ModeConfig, autopilot?: DriverKind) {
    this.setSun(mode)
    this.placeSun()
    this.resetRun(mode)
    this.driver = autopilot ? createDriver(autopilot, this.site, mode) : null
    this.phase = 'play'
    this.settleMs = 800
    if (mode.plan) {
      // The rover drives itself off the lander. The clock starts with the player's first uplink.
      this.driver = null
      this.planFrom = { x: this.sim!.x, z: this.sim!.z }
      this.planRun = new PlanRun(this.sim!, [{ x: 0, z: 2.1 }, { x: RAMP_FOOT[0], z: RAMP_FOOT[1] }], 0)
      this.cb.onCallout({ text: 'Rover is driving off the lander. The clock starts with your first uplink.', tone: 'info' })
    } else this.cb.onCallout({ text: `Turn to face the ramp. Commands take ${mode.uplink.toFixed(1)} s to arrive.`, tone: 'info' })
    this.emitHud(true)
  }

  /** Back to the start screen's idle view. */
  toIdle() {
    this.resetRun(this.mode)
    this.phase = 'idle'
    this.audio?.stopAll()
    this.emitHud(true)
  }

  /** Drag: turn the camera round its subject and tilt it. Radians. */
  orbit(dyaw: number, dpitch: number) {
    this.orbitYaw += dyaw
    this.orbitPitch = Math.max(-0.42, Math.min(0.95, this.orbitPitch + dpitch))
  }

  /** Scroll or pinch: above 1 pulls back, below 1 closes in. */
  zoom(factor: number) {
    this.zoomBy = Math.max(0.45, Math.min(3.2, this.zoomBy * factor))
  }

  resetCamera() {
    this.orbitYaw = 0
    // Plotting wants to see the ground ahead: start higher and further back.
    this.orbitPitch = this.mode.plan ? 0.2 : 0
    this.zoomBy = this.mode.plan ? 1.6 : 1
  }

  // ---------------------------------------------------------------------------
  // Plot-and-send
  // ---------------------------------------------------------------------------

  private canPlot(): boolean {
    const sim = this.sim
    return !!sim && !!this.mode.plan && this.phase === 'play' && !this.planRun && !sim.outcome && sim.off
  }

  /** The way down the ramp, which every plan sent from the deck starts with. */
  private rampPts(): Pt[] {
    return this.sim!.off ? [] : [{ x: 0, z: 2.1 }, { x: RAMP_FOOT[0], z: RAMP_FOOT[1] }]
  }

  /** Where a tap on the canvas meets the ground, or null if it meets the sky. */
  private pickGround(clientX: number, clientY: number): Pt | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    const ray = new THREE.Raycaster()
    ray.setFromCamera(ndc, this.camera)
    const o = ray.ray.origin
    const d = ray.ray.direction
    let prev = 0
    for (let t = 0.5; t < 260; t += 0.25) {
      const x = o.x + d.x * t
      const z = o.z + d.z * t
      if (o.y + d.y * t <= this.site.ground(x, z)) {
        // Close in on the crossing between the last two samples.
        let a = prev
        let b = t
        for (let i = 0; i < 12; i++) {
          const m = (a + b) / 2
          if (o.y + d.y * m <= this.site.ground(o.x + d.x * m, o.z + d.z * m)) b = m
          else a = m
        }
        return { x: o.x + d.x * b, z: o.z + d.z * b }
      }
      prev = t
    }
    return null
  }

  /** A tap on the scene: add a waypoint there. Returns whether one was added. */
  planTap(clientX: number, clientY: number): boolean {
    if (!this.canPlot()) return false
    const sim = this.sim!
    const p = this.pickGround(clientX, clientY)
    if (!p || Math.abs(p.x) > WORLD - 1 || Math.abs(p.z) > WORLD - 1) return false
    if (inRect(DECK, p.x, p.z, 0.9) || inRect(BODY, p.x, p.z, 0.9) || (sim.off && Math.abs(p.x) < 1.7 && p.z > DECK.z1 && p.z < RAMP_FOOT[1] - 0.6)) {
      this.cb.onCallout({ text: 'Plot on open ground, clear of the lander.', tone: 'warn' })
      return false
    }
    if (this.planPts.length >= PLAN_MAX_POINTS) {
      this.cb.onCallout({ text: `One uplink carries ${PLAN_MAX_POINTS} waypoints. Send these first.`, tone: 'warn' })
      return false
    }
    if (planMetres(sim.x, sim.z, [...this.rampPts(), ...this.planPts, p]) > PLAN_MAX_METRES) {
      this.cb.onCallout({ text: `Too far for one uplink (${PLAN_MAX_METRES} m). Send, then plot the rest.`, tone: 'warn' })
      return false
    }
    this.planPts.push(p)
    this.audio?.cue('tick')
    const job = stopTarget(this.site, p, sim.imaged)
    if (job >= 0) this.cb.onCallout({ text: `Science stop: the rover will halt here for the ${KIND_TAG[this.site.targets[job].kind].toLowerCase()} job, then carry on.`, tone: 'good' })
    this.drawPlan()
    this.emitHud(true)
    return true
  }

  planUndo() {
    if (!this.canPlot() || !this.planPts.length) return
    this.planPts.pop()
    this.drawPlan()
    this.emitHud(true)
  }

  /** Uplink the plotted path. The clock runs from here until the rover stops. */
  planSend() {
    if (!this.canPlot() || !this.planPts.length) return
    const sim = this.sim!
    this.planFrom = { x: sim.x, z: sim.z }
    this.planRun = new PlanRun(sim, [...this.rampPts(), ...this.planPts], Math.round(this.mode.plan!.sendSeconds * STEP_HZ))
    this.planPts = []
    this.sends++
    this.jobsAtSend = sim.legs.length
    this.wall = sim.steps * DT
    this.audio?.cue('send')
    this.drawPlan()
    this.emitHud(true)
  }

  /** Bank the combo for the uplink that has just finished. Returns its points. */
  private closeUplink(): number {
    const jobs = this.sim!.legs.length - this.jobsAtSend
    const pts = this.sends > 0 ? comboPoints(jobs) : 0
    this.combo += pts
    if (jobs > this.comboBest) this.comboBest = jobs
    return pts
  }

  /** The plotted path as a ribbon on the ground, with a ring at each waypoint. */
  private drawPlan() {
    if (this.planLine) {
      this.scene.remove(this.planLine)
      this.planLine.geometry.dispose()
      this.planLine = null
    }
    const sim = this.sim
    const run = this.planRun
    const pts = run ? run.pts : this.planPts.length ? [...this.rampPts(), ...this.planPts] : []
    for (let i = 0; i < this.planDots.length; i++) this.planDots[i].visible = false
    if (!sim || !pts.length || this.phase !== 'play') return
    if (!this.planMat) this.planMat = this.track(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false }))
    // Blue while it is a draft, amber once it has been sent.
    this.planMat.color.copy(run ? new THREE.Color(2.4, 1.5, 0.35) : new THREE.Color(0.5, 1.7, 2.6))
    const from = run ? this.planFrom : { x: sim.x, z: sim.z }
    const line: number[] = []
    let ax = from.x
    let az = from.z
    for (const p of pts) {
      const n = Math.max(1, Math.ceil(Math.hypot(p.x - ax, p.z - az) / 0.3))
      for (let i = line.length ? 1 : 0; i <= n; i++) line.push(ax + ((p.x - ax) * i) / n, az + ((p.z - az) * i) / n)
      ax = p.x
      az = p.z
    }
    const n = line.length / 2
    const pos = new Float32Array(n * 6)
    const idx: number[] = []
    const half = 0.07
    for (let i = 0; i < n; i++) {
      const x = line[i * 2]
      const z = line[i * 2 + 1]
      const a = Math.max(0, i - 1)
      const b = Math.min(n - 1, i + 1)
      const dx = line[b * 2] - line[a * 2]
      const dz = line[b * 2 + 1] - line[a * 2 + 1]
      const l = Math.hypot(dx, dz) || 1
      const px = (-dz / l) * half
      const pz = (dx / l) * half
      const y = this.site.ground(x, z) + 0.06
      pos.set([x + px, y, z + pz, x - px, y, z - pz], i * 6)
      // Dashes: every other stretch is left out.
      if (i < n - 1 && i % 2 === 0) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setIndex(idx)
    this.planLine = new THREE.Mesh(geo, this.planMat)
    this.planLine.frustumCulled = false
    this.planLine.renderOrder = 3
    this.scene.add(this.planLine)
    for (let i = 0; i < pts.length; i++) {
      let dot = this.planDots[i]
      if (!dot) {
        dot = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.3, 24), this.planMat)
        dot.rotation.x = -Math.PI / 2
        dot.renderOrder = 3
        dot.frustumCulled = false
        this.planDots[i] = dot
        this.scene.add(dot)
      }
      dot.visible = true
      // A science stop is drawn larger than a waypoint the rover only passes through.
      dot.scale.setScalar(stopTarget(this.site, pts[i], sim.imaged) >= 0 ? 1.9 : 1)
      dot.position.set(pts[i].x, this.site.ground(pts[i].x, pts[i].z) + 0.07, pts[i].z)
    }
  }

  /** Throttle and steer, -1..1. */
  setControl(th: number, st: number) {
    this.inTh = toInput(th)
    this.inSt = toInput(st)
  }

  /** The finished run's input tape, base64, for score verification. */
  tapeBase64(): string {
    return tapeToBase64(this.tape)
  }

  getResult(): RunResult | null {
    return this.result
  }

  /** The orbiter photo of the finished run. */
  getPhoto(): HTMLCanvasElement | null {
    return this.orbiterShot
  }

  /** A photo of the scene exactly as the player has framed it, at up to `maxDim` on its long side. */
  photo(maxDim = 1600): HTMLCanvasElement {
    const size = this.renderer.getSize(new THREE.Vector2())
    const aspect = size.x / size.y
    const w = aspect >= 1 ? maxDim : Math.round(maxDim * aspect)
    const h = aspect >= 1 ? Math.round(maxDim / aspect) : maxDim
    const r = this.renderer
    const cam = this.camera
    const ratio = r.getPixelRatio()
    // The tags are HUD, not scene.
    const tags = this.beacons.map((b) => b.tag)
    const was = tags.map((t) => t.visible)
    tags.forEach((t) => (t.visible = false))
    r.setPixelRatio(1)
    r.setSize(w, h, false)
    cam.aspect = w / h
    cam.updateProjectionMatrix()
    r.setRenderTarget(null)
    r.clear()
    r.render(this.scene, cam)
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    out.getContext('2d')!.drawImage(this.canvas, 0, 0, w, h)
    tags.forEach((t, i) => (t.visible = was[i]))
    r.setPixelRatio(ratio)
    r.setSize(size.x, size.y, false)
    this.resize()
    if (this.composer) this.composer.render()
    else r.render(this.scene, cam)
    return out
  }

  /** The 3D view of the finished drive, 1200x675: the picture on the share card. */
  getShot(): HTMLCanvasElement | null {
    return this.shot
  }

  /** For the dev hook and headless screenshots. */
  debugState() {
    const s = this.sim
    return { phase: this.phase, outcome: s?.outcome ?? null, steps: s?.steps ?? 0, x: s?.x, z: s?.z, h: s?.h, v: s?.v, off: s?.off, imaged: s?.legs.length, score: this.result?.score ?? null, ratio: this.renderer.getPixelRatio() }
  }

  private record(step: number) {
    const s = this.sim!
    const o = step * STRIDE
    const h = this.hist
    h[o + H_X] = s.x
    h[o + H_Y] = s.y
    h[o + H_Z] = s.z
    h[o + H_H] = s.h
    h[o + H_PITCH] = s.pitchTan
    h[o + H_ROLL] = s.rollTan
    h[o + H_WHEEL] = s.wheel
    h[o + H_ODO] = s.odo
    h[o + H_OFF] = s.off ? 1 : 0
    h[o + H_SINK] = s.sink
    h[o + H_ENERGY] = s.energy
    let hold = 0
    for (let i = 0; i < s.hold.length; i++) {
      const f = s.hold[i] / holdSteps(this.site.targets[i].kind)
      if (f > hold) hold = f
    }
    h[o + H_HOLD] = hold
  }

  /** The pose `t` seconds into the run, interpolated between steps. */
  private samplePose(t: number) {
    const s = this.sim!
    const f = Math.max(0, Math.min(s.steps, t * STEP_HZ))
    const i = Math.min(s.steps, Math.floor(f))
    const j = Math.min(s.steps, i + 1)
    const k = f - i
    const h = this.hist
    const a = i * STRIDE
    const b = j * STRIDE
    const L = (c: number) => h[a + c] + (h[b + c] - h[a + c]) * k
    const p = this.pose
    p.x = L(H_X)
    p.y = L(H_Y)
    p.z = L(H_Z)
    p.h = L(H_H)
    p.pitch = Math.atan(L(H_PITCH))
    p.roll = Math.atan(L(H_ROLL))
    p.wheel = L(H_WHEEL)
    p.odo = L(H_ODO)
    p.off = h[a + H_OFF] > 0.5
    p.sink = L(H_SINK)
    p.energy = L(H_ENERGY)
    p.hold = h[a + H_HOLD]
  }

  // ---------------------------------------------------------------------------
  // Frame loop
  // ---------------------------------------------------------------------------

  run() {
    this.last = performance.now()
    const loop = (now: number) => {
      if (this.disposed) return
      this.raf = requestAnimationFrame(loop)
      const gap = now - this.last
      this.last = now
      this.pace(gap)
      this.frame(Math.min(0.1, Math.max(0, gap / 1000)))
    }
    this.raf = requestAnimationFrame(loop)
  }

  /** Step the game by hand: for headless screenshots and background tabs. */
  advance(seconds: number) {
    const n = Math.ceil(seconds * 60)
    for (let i = 0; i < n; i++) this.frame(1 / 60, i < n - 1)
  }

  private pace(gap: number) {
    // A hidden tab, a shader compile, a texture upload or a resize is a hitch, not the machine's pace.
    if (gap > 90 || gap <= 0) return
    if (this.settleMs > 0) {
      this.settleMs -= gap
      return
    }
    this.winMs += gap
    this.winFrames++
    if (this.winMs < 1500) return
    const avg = this.winMs / this.winFrames
    this.winMs = 0
    this.winFrames = 0
    const now = this.renderer.getPixelRatio()
    const floor = Math.min(this.baseRatio, this.mobile ? 1 : 0.75)
    if (avg > 21 && now > floor + 0.01) {
      const want = now * Math.sqrt(15.5 / avg)
      let to = floor
      for (const r of RATIO_STEPS) {
        if (r < now - 0.01 && r <= want && r >= floor) {
          to = r
          break
        }
      }
      this.ratioTooSlow = now
      this.ratioCap = to
      this.goodWindows = 0
      this.resize()
    } else if (avg < 18 && this.ratioCap < this.ratioTooSlow) {
      if (++this.goodWindows < 6) return
      this.goodWindows = 0
      const up = [...RATIO_STEPS].reverse().find((r) => r > this.ratioCap + 0.01)
      if (up === undefined || up >= this.ratioTooSlow - 0.01) return
      this.ratioCap = up
      this.resize()
    } else this.goodWindows = 0
  }

  private frame(dt: number, skipRender = false) {
    const sim = this.sim!
    this.updateDust(dt)
    if (this.phase === 'play') {
      // Plot-and-send: time waits for the first uplink. After that it never stops.
      const plan = !!this.mode.plan
      const live = !plan || !!this.planRun || this.sends > 0
      if (live || sim.outcome) this.wall += dt
      else this.wall = sim.steps * DT
      // Step the sim up to the wall clock, feeding it the input as given now.
      while (!sim.outcome && live && (sim.steps + 1) * DT <= this.wall + 1e-9 && sim.steps < MAX_TAPE_STEPS) {
        let th = this.inTh
        let st = this.inSt
        if (this.driver) [th, st] = this.driver.input(sim)
        if (plan) {
          th = 0
          st = 0
        }
        const run = plan ? this.planRun : null
        if (run) {
          const cmd = run.input(sim)
          if (!cmd) {
            // The rover has stopped and waits for the next plan. The clock does not.
            this.planRun = null
            this.drawPlan()
            const drift = Math.hypot(run.bx - sim.x, run.bz - sim.z)
            if (this.sends === 0) {
              // The drive off the lander is free: the whole window is still there for the first uplink.
              sim.clockStart = sim.steps
              sim.windowEnd = sim.steps + windowSecondsFor(this.site, this.mode) * STEP_HZ
              this.cb.onCallout({ text: 'Plot a path, then Send. The clock starts with your first uplink.', tone: 'info' })
            } else if (run.ended === 'bogged') this.comboNote = 'Stopped: the wheels were digging in, so the rover backed out. Plot round the loose patch.'
            else if (run.ended !== 'blocked' && drift >= 0.5) this.comboNote = `Stopped ${drift.toFixed(1)} m off your line: the wheels slipped in loose regolith.`
            const combo = this.closeUplink()
            // Shown after this frame's event toasts, so the last job's toast does not replace it.
            if (combo > 0) this.comboNote = `${sim.legs.length - this.jobsAtSend} jobs in one uplink: +${combo}`
            else if (run.ended === 'blocked') this.cb.onCallout({ text: `Hazard stop: the rover hit something. \u2212${this.mode.hitSeconds} s. Plot round it.`, tone: 'warn' })
            this.emitHud(true)
          } else [th, st] = cmd
        }
        if (th !== this.sentTh || st !== this.sentSt || (sim.steps % 15 === 0 && (th !== 0 || st !== 0))) {
          if (th !== this.sentTh || st !== this.sentSt) this.audio?.cue('send')
          this.sentTh = th
          this.sentSt = st
          this.commands.push({ step: sim.steps, th: th / 127, st: st / 127 })
          if (this.commands.length > 120) this.commands.splice(0, 40)
        }
        stepSim(sim, th, st)
        recordTape(this.tape, 1, th, st)
        this.record(sim.steps)
      }
      const shown = this.wall - this.mode.downlink
      this.samplePose(shown)
      this.showEvents(shown)
      if (this.comboNote) {
        this.cb.onCallout({ text: this.comboNote, tone: this.comboNote.startsWith('Stopped') ? 'warn' : 'good' })
        this.comboNote = ''
      }
      this.updateGhost()
      this.depositTracks()
      const ended = !!sim.outcome && shown >= sim.endStep * DT
      if (ended && (sim.outcome === 'tipped' || sim.outcome === 'fell')) {
        if (this.tipT === 0) {
          // Which way it goes over: toward its low side, or nose or tail first on a steep pitch.
          const p = this.pose
          const fx = Math.sin(p.h)
          const fz = Math.cos(p.h)
          this.tipPitch = Math.abs(p.pitch) > Math.abs(p.roll)
          const lean = this.tipPitch ? p.pitch : p.roll
          this.tipSign = Math.abs(lean) > 0.02 ? Math.sign(lean) : 1
          // Roll positive is right side up, so it falls to its left; pitch positive is nose up, so it falls back.
          this.tipDir = this.tipPitch ? { x: -fx * this.tipSign, z: -fz * this.tipSign } : { x: fz * this.tipSign, z: -fx * this.tipSign }
        }
        this.tipT += dt
      }
      this.audio?.drive(ended ? 0 : Math.abs(sim.v), sim.sink)
      if (sim.outcome && shown >= sim.endStep * DT + (sim.outcome === 'tipped' || sim.outcome === 'fell' ? 1.6 : 0.9)) this.finish()
    } else if (this.phase === 'idle') {
      this.idleT += dt
    } else this.endT += dt

    this.poseRover()
    this.updateCamera(dt)
    this.updateBeacons()
    // The shadow map follows the rover; decals take over beyond it.
    // On the result screen the camera pulls back over the whole drive, and the shadows go with it.
    const fx = this.phase === 'idle' ? 0 : this.phase === 'done' ? this.span.x : this.pose.x
    const fz = this.phase === 'idle' ? 1 : this.phase === 'done' ? this.span.z : this.pose.z
    this.sunLight.target.position.set(fx, 0, fz)
    this.sunLight.position.copy(this.sunLight.target.position).addScaledVector(this.sunDir, 120)
    this.decalUniforms.uCentre.value.set(fx, fz)
    this.skyGroup.position.copy(this.camera.position)

    if (this.base) {
      const blink = Math.floor((this.idleT + this.wall + this.endT) * 1.6) % 2 === 0
      for (const b of this.base.beacons) b.visible = blink
    }
    this.hudAcc += dt
    if (this.hudAcc >= 0.045) {
      this.hudAcc = 0
      this.emitHud(false)
    }
    if (skipRender) return
    this.drawInstruments()
    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }

  /** Toasts follow the picture: an event shows when the frame it happened in arrives. */
  private showEvents(shown: number) {
    const sim = this.sim!
    const m = this.mode
    while (this.eventCursor < sim.events.length && sim.events[this.eventCursor].step * DT <= shown) {
      const e = sim.events[this.eventCursor++]
      switch (e.kind) {
        case 'bump-lander':
          this.cb.onCallout({ text: sim.off ? `Bumped the lander \u00b7 \u2212${m.hitSeconds} s` : 'Bumped the lander', tone: 'warn' })
          this.audio?.cue('bump')
          break
        case 'bump-rock':
        case 'bump-boulder':
          this.cb.onCallout({ text: (e.kind === 'bump-boulder' ? 'Hit a boulder' : 'Hit a rock') + ` \u00b7 \u2212${m.hitSeconds} s`, tone: 'warn' })
          this.audio?.cue('bump')
          break
        case 'jolt':
          this.shake = Math.min(1, this.shake + 0.6)
          this.audio?.cue('jolt')
          break
        case 'egress':
          if (!m.plan) this.cb.onCallout({ text: 'Clear of the lander. The clock is running.', tone: 'info' })
          this.audio?.cue('egress')
          break
        case 'imaged': {
          const i = e.target ?? 0
          this.shownImaged[i] = true
          this.setBeacon(this.beacons[i], true)
          {
            const t = this.site.targets[i]
            const find = FINDS[t.find]
            this.cb.onCallout({ text: `${KIND_DONE[t.kind]} \u00b7 ${find.label} \u00d7${find.factor}`, tone: find.factor < 1 ? 'warn' : 'good' })
          }
          this.audio?.cue('imaged')
          break
        }
        case 'ten':
          this.tenShown = sim.tenAt
          this.cb.onCallout({ text: `${PRIZE_METRES} m. First tracks!`, tone: 'good' })
          this.audio?.cue('ten')
          break
        case 'end': {
          const text: Record<string, [string, Callout['tone']]> = {
            fell: ['Off the edge of the lander', 'bad'],
            tipped: ['Tipped over', 'bad'],
            stuck: ['Stuck. The wheels dug in.', 'bad'],
            flat: ['Battery flat. The rover is asleep.', 'bad'],
            complete: ['Every job done!', 'good'],
            window: ['Comms window closed', 'info'],
            parked: ['Comms window closed', 'info'],
          }
          const [t, tone] = text[sim.outcome ?? 'window']
          this.cb.onCallout({ text: t, tone })
          this.audio?.cue(tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : 'tick')
          break
        }
      }
    }
  }

  private updateGhost() {
    const sim = this.sim!
    if (!this.mode.ghost || sim.outcome) {
      this.ghost.group.visible = false
      return
    }
    const g = ghostOf(sim)
    this.ghost.group.visible = true
    this.ghost.group.position.set(g.x, g.y, g.z)
    this.ghost.group.rotation.set(-Math.atan(g.pitchTan), g.h, -Math.atan(g.rollTan))
  }

  private poseRover() {
    const p = this.pose
    const r = this.rover
    let y = p.y - p.sink * 0.13
    let roll = p.roll
    let pitch = p.pitch
    let x = p.x
    let z = p.z
    if (this.tipT > 0) {
      // Over it goes: a quarter turn and a bit toward its low side, coming to
      // rest on the regolith clear of whatever it fell from.
      const k = Math.min(1, this.tipT / 0.9)
      const e = k * k * (3 - 2 * k)
      if (this.tipPitch) pitch += this.tipSign * e * 1.5
      else roll += this.tipSign * e * 1.7
      const slide = (p.off ? 0.35 : 1.25) * e
      x += this.tipDir.x * slide
      z += this.tipDir.z * slide
      const ground = this.site.ground(x, z)
      y = y + (ground + 0.32 - y) * e
    }
    r.group.position.set(x, y, z)
    r.group.rotation.set(-pitch, p.h, -roll)
    // Turning swings the two sides opposite ways: in a pivot turn one side rolls forward and the other back.
    const swing = (p.h * HALF_W) / WHEEL_R
    for (let i = 0; i < r.wheels.length; i++) r.wheels[i].rotation.x = p.wheel + (r.wheels[i].position.x > 0 ? -swing : swing)
  }

  private updateBeacons() {
    const t = this.idleT + this.wall + this.endT
    const pulse = 0.75 + 0.25 * Math.sin(t * 3)
    const cam = this.camera.position
    this.beacons.forEach((b, i) => {
      if (b.reveal) {
        // A rich find, shown after the run: a steady gold beam and its tag.
        ;(b.beam.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.15 * pulse
        ;(b.tag.material as THREE.SpriteMaterial).opacity = 1
        return
      }
      if (b.shown) return
      // Instrument range: the first time the rover comes this near, it reads how strong the signal is.
      if (this.phase === 'play' && this.pose.off && !this.scanned[i] && Math.hypot(this.pose.x - b.group.position.x, this.pose.z - b.group.position.z) < CLUE_RANGE) {
        const strong = this.site.targets[i].find >= 2
        this.scanned[i] = strong ? 2 : 1
        if (this.clueTex) (b.tag.material as THREE.SpriteMaterial).map = this.clueTex[b.kind][strong ? 1 : 0]
        if (strong) this.cb.onCallout({ text: `Strong signal from the ${KIND_SITE[b.kind]} site nearby`, tone: 'info' })
      }
      ;(b.ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.3 * pulse
      // A beam the camera is standing next to would fill the screen: thin it out up close.
      const d = Math.hypot(cam.x - b.group.position.x, cam.z - b.group.position.z)
      // And one the rover is standing in would be drawn across it: fade it out as the rover arrives.
      const near = Math.hypot(this.pose.x - b.group.position.x, this.pose.z - b.group.position.z)
      ;(b.beam.material as THREE.MeshBasicMaterial).opacity = (this.scanned[i] === 2 ? 0.4 : this.scanned[i] === 1 ? 0.12 : 0.22) * smooth(4.5, 13, d) * smooth(1.2, 3.5, near)
      ;(b.tag.material as THREE.SpriteMaterial).opacity = this.phase === 'play' ? smooth(3, 7, d) * (1 - smooth(48, 70, d)) : 0
    })
  }

  /** What is carrying the rover off its plotted line right now, and how far off it has been carried. */
  private slipNote(): { slip: '' | 'soft' | 'slope'; drift: number } {
    const sim = this.sim!
    const run = this.planRun
    if (!run || run.inTransit || !sim.off || this.sends === 0) return { slip: '', drift: 0 }
    const moving = Math.abs(sim.v) > 0.1
    const slip = !moving ? '' : this.site.softAt(sim.x, sim.z) > 0.15 ? 'soft' : Math.abs(sim.rollTan) > 0.05 ? 'slope' : ''
    return { slip, drift: Math.hypot(run.bx - sim.x, run.bz - sim.z) }
  }

  /** Regolith off the wheels: more of it in loose ground, and from whichever way each wheel is turning. */
  private updateDust(dt: number) {
    if (!this.dustPts) {
      this.dustPos.fill(-999)
      const geo = this.track(new THREE.BufferGeometry())
      geo.setAttribute('position', new THREE.BufferAttribute(this.dustPos, 3))
      // A soft round grain rather than a square point.
      const c = document.createElement('canvas')
      c.width = c.height = 32
      const g = c.getContext('2d')!
      const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.5, 'rgba(255,255,255,0.55)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 32, 32)
      const map = this.track(new THREE.CanvasTexture(c))
      const mat = this.track(new THREE.PointsMaterial({ color: 0xb6b6b6, map, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false }))
      this.dustPts = new THREE.Points(geo, mat)
      this.dustPts.frustumCulled = false
      this.scene.add(this.dustPts)
    }
    const p = this.pose
    const prev = this.dustPrev
    this.dustPrev = [p.x, p.z, p.h]
    if (dt <= 0 || dt > 0.2) return
    const pos = this.dustPos
    const vel = this.dustVel
    if (prev && this.phase === 'play' && p.off && this.tipT === 0) {
      const fx = Math.sin(p.h)
      const fz = Math.cos(p.h)
      const rx = -fz
      const rz = fx
      const along = ((p.x - prev[0]) * fx + (p.z - prev[1]) * fz) / dt
      const yaw = (p.h - prev[2]) / dt
      const loose = 1 + 3 * this.site.softAt(p.x, p.z)
      let w = 0
      for (const a of [HALF_L, -HALF_L]) {
        for (const b of [HALF_W, -HALF_W]) {
          // This wheel's own speed over the ground: the rover's, plus its swing in a turn.
          const ws = along + yaw * b
          const fast = Math.abs(ws)
          if (fast > 0.08 && fast < 6) this.dustDue[w] += Math.min(260, fast * 75 * loose) * dt
          while (this.dustDue[w] >= 1) {
            this.dustDue[w]--
            const i = this.dustNext
            this.dustNext = (i + 1) % DUST_N
            const x = p.x + fx * a + rx * b + (Math.random() - 0.5) * 0.12
            const z = p.z + fz * a + rz * b + (Math.random() - 0.5) * 0.12
            const y = this.site.ground(x, z)
            // Thrown back from the way the wheel is turning, and a little out to the side.
            const back = -Math.sign(ws) * (0.25 + Math.random() * 0.7) * Math.min(1.6, fast + 0.4)
            const out = (Math.random() - 0.5) * 0.5 + Math.sign(b) * 0.15
            pos[i * 3] = x
            pos[i * 3 + 1] = y + 0.04
            pos[i * 3 + 2] = z
            vel[i * 3] = fx * back + rx * out
            vel[i * 3 + 1] = (0.45 + Math.random() * 1.0) * Math.sqrt(loose) * 0.8
            vel[i * 3 + 2] = fz * back + rz * out
            this.dustFloor[i] = y - 0.03
            this.dustLive[i] = 1
          }
          w++
        }
      }
    }
    // Lunar gravity, no drag.
    for (let i = 0; i < DUST_N; i++) {
      if (!this.dustLive[i]) continue
      const o = i * 3
      vel[o + 1] -= 1.62 * dt
      pos[o] += vel[o] * dt
      pos[o + 1] += vel[o + 1] * dt
      pos[o + 2] += vel[o + 2] * dt
      if (pos[o + 1] < this.dustFloor[i]) {
        this.dustLive[i] = 0
        pos[o + 1] = -999
      }
    }
    this.dustPts.geometry.attributes.position.needsUpdate = true
  }

  /** Lay a quad behind each wheel as the picture shows the rover moving. */
  private depositTracks() {
    const p = this.pose
    if (!p.off || this.tipT > 0) return
    const fx = Math.sin(p.h)
    const fz = Math.cos(p.h)
    const rx = -fz
    const rz = fx
    const cur = new Float32Array(8)
    let k = 0
    for (const [a, b] of [
      [HALF_L, HALF_W],
      [HALF_L, -HALF_W],
      [-HALF_L, HALF_W],
      [-HALF_L, -HALF_W],
    ]) {
      cur[k++] = p.x + fx * a + rx * b
      cur[k++] = p.z + fz * a + rz * b
    }
    if (!this.trackPrev) {
      this.trackPrev = cur
      this.trackAt = { x: p.x, z: p.z }
      this.trail.push(p.x, p.z)
      return
    }
    // Wheels sweep arcs in a pivot turn, so measure the furthest any wheel has moved.
    let moved = 0
    for (let i = 0; i < 8; i += 2) moved = Math.max(moved, Math.hypot(cur[i] - this.trackPrev[i], cur[i + 1] - this.trackPrev[i + 1]))
    if (moved < 0.09) return
    const half = 0.075
    const v0 = this.trackLen / 0.32
    this.trackLen += moved
    const v1 = this.trackLen / 0.32
    for (let i = 0; i < 8 && this.trackQuads < MAX_TRACK_QUADS; i += 2) {
      const ax = this.trackPrev[i]
      const az = this.trackPrev[i + 1]
      const bx = cur[i]
      const bz = cur[i + 1]
      const dx = bx - ax
      const dz = bz - az
      const l = Math.hypot(dx, dz)
      if (l < 0.01) continue
      const px = (-dz / l) * half
      const pz = (dx / l) * half
      // Extend each quad a hair so consecutive ones overlap at corners.
      const ex = (dx / l) * 0.02
      const ez = (dz / l) * 0.02
      const g = this.site.ground
      const o = this.trackQuads * 12
      const lift = 0.022
      this.trackPos.set(
        [
          ax - ex + px, g(ax + px, az + pz) + lift, az - ez + pz,
          ax - ex - px, g(ax - px, az - pz) + lift, az - ez - pz,
          bx + ex + px, g(bx + px, bz + pz) + lift, bz + ez + pz,
          bx + ex - px, g(bx - px, bz - pz) + lift, bz + ez - pz,
        ],
        o
      )
      this.trackUv.set([0, v0, 1, v0, 0, v1, 1, v1], this.trackQuads * 8)
      this.trackQuads++
    }
    this.trackPrev = cur
    if (Math.hypot(p.x - this.trackAt.x, p.z - this.trackAt.z) > 0.4) {
      this.trackAt = { x: p.x, z: p.z }
      this.trail.push(p.x, p.z)
    }
    ;(this.trackGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(this.trackGeo.attributes.uv as THREE.BufferAttribute).needsUpdate = true
    this.trackGeo.setDrawRange(0, this.trackQuads * 6)
  }

  /** Where the pull-back camera stands to take in the whole drive, with the horizon and Earth beyond it. */
  private overview(yawOffset: number, pitchOffset: number, zoom: number, tall: number, pos: THREE.Vector3, look: THREE.Vector3) {
    const sp = this.span
    // Stand opposite Earth, so it hangs over the far horizon.
    const side = this.sunSide()
    const a = Math.atan2(side * 0.74, 0.62) + yawOffset
    const h = Math.max(7, sp.r * 0.6) * zoom * (1 + tall * 0.6)
    const el = Math.max(0.12, Math.min(1.35, 0.5 + pitchOffset))
    const d = sp.r * 0.85 + (h / Math.tan(el)) * 0.6
    pos.set(sp.x + Math.sin(a) * d, this.site.ground(sp.x, sp.z) + h, sp.z + Math.cos(a) * d)
    // Aim past the middle of the tracks, low enough that the horizon sits in the upper part of the frame.
    const reach = sp.r * (0.25 + tall * 0.2)
    look.set(sp.x - Math.sin(a) * reach, this.site.ground(sp.x, sp.z) - tall * h * 0.9, sp.z - Math.cos(a) * reach)
  }

  private updateCamera(dt: number) {
    const p = this.pose
    const cam = this.camera
    const tall = cam.aspect < 1 ? 1 : 0
    const k = 1 - Math.exp(-dt * 3.2)
    if (this.phase === 'idle') {
      // Hero view from the front quarter: the rover on the lowered bay door, the
      // ramp down to the regolith, the open bay and the lander behind. The camera
      // stands on the sunny side, so the lander is lit and its shadow falls away.
      const a = this.sunSide() * (1.05 + Math.sin(this.idleT * 0.11) * 0.3) + this.orbitYaw
      // Never closer than the lander's own footprint: the camera stays outside the hull.
      const r = Math.max(6.6, (9.4 + tall * 4.5) * this.zoomBy)
      this.camPos.set(Math.sin(a) * r, 2.9 + tall * 1.4 + this.orbitPitch * 6, 0.4 + Math.cos(a) * r)
      this.camLook.set(0, 1.5, -0.6)
      // The start card covers the right of a wide screen and the bottom of a
      // tall one: aim off the lander so it sits in the open part of the frame.
      if (tall) this.camLook.y -= 1.9
      else {
        const dx = this.camLook.x - this.camPos.x
        const dz = this.camLook.z - this.camPos.z
        const l = Math.hypot(dx, dz) || 1
        const shift = Math.min(2.3, Math.max(0, (cam.aspect - 1) * 2.6))
        this.camLook.x += (-dz / l) * shift
        this.camLook.z += (dx / l) * shift
      }
    } else if (this.phase === 'play') {
      const fx = Math.sin(p.h)
      const fz = Math.cos(p.h)
      // Chase: over the rover's shoulder, wherever the player has swung and zoomed it.
      const yaw = p.h + Math.PI + this.orbitYaw
      const el = Math.max(0.1, Math.min(1.45, 0.48 + this.orbitPitch))
      const dist = (4.85 + tall * 1.7) * this.zoomBy
      const want = v3().set(p.x + Math.sin(yaw) * Math.cos(el) * dist, p.y + 0.1 + Math.sin(el) * dist, p.z + Math.cos(yaw) * Math.cos(el) * dist)
      // Look ahead of the rover when behind it, at the rover itself from the side or the front.
      const ahead = 2.8 * Math.max(0, Math.cos(this.orbitYaw)) * Math.min(1, 1.6 / this.zoomBy)
      const look = v3().set(p.x + fx * ahead, p.y + 0.45, p.z + fz * ahead)
      // On the lander: a fixed view from above with the ramp pointing up the
      // screen (zoom still works). Off it: ease round behind the rover's shoulder.
      if (p.off) this.camBlend = Math.min(1, this.camBlend + dt / 1.8)
      const b = smooth(0, 1, this.camBlend)
      want.lerp(v3().set(0, 0.6 + (6.6 + tall * 1.2) * this.zoomBy, 0.3 + tall * 0.2), 1 - b)
      look.lerp(v3().set(0, 0.5, 1.45 - tall * 0.1), 1 - b)
      this.camPos.lerp(want, this.wall < 0.05 ? 1 : k)
      this.camLook.lerp(look, this.wall < 0.05 ? 1 : k)
      if (this.shake > 0.001) {
        this.shake *= Math.exp(-dt * 9)
        this.camPos.y += Math.sin(this.wall * 71) * 0.035 * this.shake
      }
    } else {
      // Result screen: pull back over the whole drive and drift slowly round it.
      const want = v3()
      const look = v3()
      this.overview(this.orbitYaw + this.endT * 0.025, this.orbitPitch, this.zoomBy, tall, want, look)
      this.camPos.lerp(want, k * 0.6)
      this.camLook.lerp(look, k * 0.6)
    }
    // Never under the ground or inside the lander.
    const floor = this.farHeight(this.camPos.x, this.camPos.z) + 0.7
    if (this.camPos.y < floor) this.camPos.y = floor
    if (this.phase !== 'done' && (inRect(BODY, this.camPos.x, this.camPos.z, 0.6) || inRect(DECK, this.camPos.x, this.camPos.z, 0.3))) this.camPos.y = Math.max(this.camPos.y, DECK_Y + 4.6)
    cam.position.copy(this.camPos)
    cam.lookAt(this.camLook)
  }

  private hintFor(): string {
    const p = this.pose
    const m = this.mode
    if (this.phase !== 'play') return ''
    if (m.plan && !p.off) return 'The rover drives itself off the lander.'
    if (m.plan && !p.off) return ''
    if (!p.off) return 'Turn to face the ramp. The tray is only 1.6 m wide, and the clock starts when you are off the lander.'
    if (p.sink > 0.35) return 'Sinking! Drive straight, or reverse out.'
    this.holdLabel = ''
    for (let i = 0; i < this.site.targets.length; i++) {
      if (this.shownImaged[i]) continue
      const t = this.site.targets[i]
      if (Math.hypot(p.x - t.x, p.z - t.z) < TARGET_RING + 0.6) {
        this.holdLabel = KIND_HOLD[t.kind]
        return m.plan ? '' : `${KIND_HINT[t.kind]} for ${HOLD_SECONDS[t.kind]} s`
      }
    }
    return ''
  }

  private emitHud(force: boolean) {
    const sim = this.sim!
    const p = this.pose
    const hint = this.hintFor()
    this.lastHint = hint
    let imaged = 0
    for (const d of this.shownImaged) if (d) imaged++
    this.cb.onHud({
      phase: this.phase,
      clock: clockLeft(sim),
      clockRunning: sim.off && !sim.outcome,
      off: p.off,
      metres: p.off ? p.odo : 0,
      imaged,
      battery: Math.max(0, 1 - p.energy / BATTERY),
      sink: p.sink,
      hold: Math.min(1, p.hold),
      holdLabel: this.holdLabel,
      hint,
      baseX: (scratch.set(this.basePos.x, this.basePos.y + 34, this.basePos.z).project(this.camera).x + 1) / 2,
      baseY: (1 - scratch.y) / 2,
      baseOn: scratch.z < 1 && Math.abs(scratch.x) < 0.97 && scratch.y < 0.97 && scratch.y > -0.9,
      plan: this.mode.plan
        ? {
            points: this.planPts.length,
            stops: new Set(this.planPts.map((p) => stopTarget(this.site, p, sim.imaged)).filter((i) => i >= 0)).size,
            metres: planMetres(sim.x, sim.z, [...this.rampPts(), ...this.planPts]),
            canPlot: this.canPlot(),
            state: !this.planRun ? 'idle' : this.planRun.inTransit ? 'transit' : 'driving',
            sends: this.sends,
            sendSeconds: this.mode.plan.sendSeconds,
            ...this.slipNote(),
          }
        : null,
    })
    void force
  }

  private drawInstruments() {
    if (this.phase !== 'play') return
    const sim = this.sim!
    if (this.minimap) drawMinimap(this.minimap, this.site, this.pose, this.shownImaged, this.trail, this.scanned)
    if (this.link) {
      const frac = Math.min(1, Math.max(0, (this.wall - sim.steps * DT) / DT))
      drawLink(this.link, { commands: this.commands, step: sim.steps, frac, delaySteps: sim.delay, downSteps: Math.round(this.mode.downlink * STEP_HZ), live: !sim.outcome })
    }
  }

  private finish() {
    const sim = this.sim!
    this.phase = 'done'
    this.ghost.group.visible = false
    this.result = scoreRun(sim)
    // Show where the rich finds were, found or not: the reason to drive the site again.
    this.site.targets.forEach((t, i) => {
      if (t.find !== 3) return
      const b = this.beacons[i]
      b.reveal = true
      b.tag.visible = true
      ;(b.tag.material as THREE.SpriteMaterial).map = this.richTex[sim.imaged[i] ? 1 : 0]
      b.beam.visible = true
      ;(b.beam.material as THREE.MeshBasicMaterial).color.set(sim.imaged[i] ? 0x86e3a8 : 0xffd24a)
      // Set here as well as in the frame loop: the share image is rendered before the next frame.
      ;(b.beam.material as THREE.MeshBasicMaterial).opacity = 0.45
      ;(b.tag.material as THREE.SpriteMaterial).opacity = 1
    })
    if (this.mode.plan) {
      // A run can end mid-plan (the last job, the window closing): bank that uplink too.
      if (this.planRun) {
        this.closeUplink()
        this.jobsAtSend = sim.legs.length
        this.planRun = null
      }
      this.result.uplink = { sends: this.sends, best: this.comboBest, bonus: this.combo }
      this.result.score += this.combo
    }
    this.audio?.stopAll()
    this.resetCamera()
    this.measureSpan()
    try {
      this.orbiterShot = this.orbiterPhoto()
    } catch {
      this.orbiterShot = null
    }
    // From here on the shadows cover the whole drive, and the traverse is drawn over the tracks.
    const half = Math.max(this.shadowHalf, this.span.r + 14)
    this.fitShadow(half)
    this.decalUniforms.uRadius.value = half
    this.buildRibbon()
    try {
      this.shot = this.shareShot()
    } catch {
      this.shot = null
    }
    this.emitHud(true)
    this.cb.onEnd(this.result)
  }

  // ---------------------------------------------------------------------------
  // The finished drive
  // ---------------------------------------------------------------------------

  /** Centre and half-extent of everything the pull-back view should hold: the lander and all the tracks. */
  private measureSpan() {
    const sim = this.sim!
    let x0 = -3
    let x1 = 3
    let z0 = LANDER_CENTER_Z - 2
    let z1 = 4
    const grow = (x: number, z: number) => {
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      z0 = Math.min(z0, z)
      z1 = Math.max(z1, z)
    }
    for (let i = 0; i < this.trail.length; i += 2) grow(this.trail[i], this.trail[i + 1])
    if (sim.off) grow(sim.x, sim.z)
    this.span = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, r: Math.max(9, Math.hypot(x1 - x0, z1 - z0) / 2) }
  }

  /**
   * The traverse, drawn as a bright line over the tracks for the pull-back
   * view and the share image. Real tracks are grey on grey from any distance;
   * this is the line a mission's traverse map would draw.
   */
  private buildRibbon() {
    if (this.ribbon) {
      this.scene.remove(this.ribbon)
      this.ribbon.geometry.dispose()
      this.ribbon = null
    }
    const n = this.trail.length / 2
    if (n < 2) return
    const half = Math.max(0.2, this.span.r * 0.016)
    const pos = new Float32Array(n * 2 * 3)
    const idx: number[] = []
    for (let i = 0; i < n; i++) {
      const x = this.trail[i * 2]
      const z = this.trail[i * 2 + 1]
      const a = Math.max(0, i - 1)
      const b = Math.min(n - 1, i + 1)
      const dx = this.trail[b * 2] - this.trail[a * 2]
      const dz = this.trail[b * 2 + 1] - this.trail[a * 2 + 1]
      const l = Math.hypot(dx, dz) || 1
      const px = (-dz / l) * half
      const pz = (dx / l) * half
      pos.set([x + px, this.site.ground(x + px, z + pz) + 0.12, z + pz, x - px, this.site.ground(x - px, z - pz) + 0.12, z - pz], i * 6)
      if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setIndex(idx)
    if (!this.ribbonMat) {
      this.ribbonMat = this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.7, 0.4), transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }))
    }
    this.ribbon = new THREE.Mesh(geo, this.ribbonMat)
    this.ribbon.frustumCulled = false
    this.ribbon.renderOrder = 2
    this.scene.add(this.ribbon)
  }

  /**
   * The share image: the whole drive in 3D from above and behind, with the
   * horizon and Earth beyond it, the traverse picked out, and each finished
   * job's ring lit. Rendered once at 1200x675, then the live view is restored.
   */
  private shareShot(): HTMLCanvasElement {
    const W = 1200
    const H = 675
    const r = this.renderer
    const cam = this.camera
    const ratio = r.getPixelRatio()
    const size = r.getSize(new THREE.Vector2())
    const keep = { pos: cam.position.clone(), quat: cam.quaternion.clone(), fov: cam.fov, aspect: cam.aspect }
    const hide: THREE.Object3D[] = [this.ghost.group]
    for (const b of this.beacons) {
      // The rich finds stay in the picture, found or missed: they are the reason to drive it again.
      if (b.reveal) continue
      hide.push(b.tag)
      if (!b.shown) hide.push(b.group)
    }
    const was = hide.map((o) => o.visible)
    hide.forEach((o) => (o.visible = false))
    const pos = v3()
    const look = v3()
    this.overview(0, 0, 1, 0, pos, look)
    // Tip the view up a little from the live one, so Earth clears the top of the frame.
    look.y += pos.distanceTo(look) * 0.055
    r.setPixelRatio(1)
    r.setSize(W, H, false)
    cam.aspect = W / H
    cam.fov = 52
    cam.updateProjectionMatrix()
    cam.position.copy(pos)
    cam.lookAt(look)
    this.skyGroup.position.copy(pos)
    this.sunLight.target.position.set(this.span.x, 0, this.span.z)
    this.sunLight.position.copy(this.sunLight.target.position).addScaledVector(this.sunDir, 120)
    this.sunLight.target.updateMatrixWorld()
    this.decalUniforms.uCentre.value.set(this.span.x, this.span.z)
    r.setRenderTarget(null)
    r.clear()
    r.render(this.scene, cam)
    const out = document.createElement('canvas')
    out.width = W
    out.height = H
    out.getContext('2d')!.drawImage(this.canvas, 0, 0, W, H)
    hide.forEach((o, i) => (o.visible = was[i]))
    r.setPixelRatio(ratio)
    r.setSize(size.x, size.y, false)
    cam.position.copy(keep.pos)
    cam.quaternion.copy(keep.quat)
    cam.fov = keep.fov
    cam.aspect = keep.aspect
    cam.updateProjectionMatrix()
    this.resize()
    return out
  }

  /**
   * A top-down photo of the site, in the style of an orbiter's narrow-angle
   * camera: greyscale, hard contrast, a little grain, with the lander, the
   * tracks, the 10 m point and the imaged targets called out, and a scale bar.
   * This is the independent check the real prize asks for, and the share image.
   */
  private orbiterPhoto(): HTMLCanvasElement {
    const sim = this.sim!
    const S = this.mobile ? 768 : 1024
    let x0 = -4.5
    let x1 = 4.5
    let z0 = -5.5
    let z1 = 7
    const grow = (x: number, z: number) => {
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      z0 = Math.min(z0, z)
      z1 = Math.max(z1, z)
    }
    for (let i = 0; i < this.trail.length; i += 2) grow(this.trail[i], this.trail[i + 1])
    grow(sim.x, sim.z)
    const side = Math.max(30, Math.max(x1 - x0, z1 - z0) + 12)
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2

    const cam = new THREE.OrthographicCamera(-side / 2, side / 2, side / 2, -side / 2, 1, 600)
    cam.up.set(0, 0, 1)
    cam.position.set(cx, 300, cz)
    cam.lookAt(cx, 0, cz)
    const hide: THREE.Object3D[] = [this.ghost.group, this.skyGroup, ...this.beacons.map((b) => b.group)]
    if (this.decals) hide.push(this.decals)
    if (this.baseDecals) hide.push(this.baseDecals)
    if (this.ribbon) hide.push(this.ribbon)
    const was = hide.map((o) => o.visible)
    hide.forEach((o) => (o.visible = false))
    // Shadows over the whole frame, not just round the rover.
    this.fitShadow(side * 0.75)
    this.sunLight.target.position.set(cx, 0, cz)
    this.sunLight.position.copy(this.sunLight.target.position).addScaledVector(this.sunDir, 120)
    this.sunLight.target.updateMatrixWorld()
        const rt = new THREE.WebGLRenderTarget(S, S, { samples: 4 })
    const r = this.renderer
    r.setRenderTarget(rt)
    r.clear()
    r.render(this.scene, cam)
    const buf = new Uint8Array(S * S * 4)
    r.readRenderTargetPixels(rt, 0, 0, S, S, buf)
    r.setRenderTarget(null)
    rt.dispose()
    this.fitShadow(this.shadowHalf)
    hide.forEach((o, i) => (o.visible = was[i]))

    const cv = document.createElement('canvas')
    cv.width = cv.height = S
    const g = cv.getContext('2d')!
    const img = g.createImageData(S, S)
    const grain = mulberry32(this.site.seed ^ 3)
    // Linear render target to display grey: gamma, then a hard photographic curve.
    let sum = 0
    const lum = new Float32Array(S * S)
    for (let i = 0; i < S * S; i++) {
      const l = Math.pow((0.3 * buf[i * 4] + 0.59 * buf[i * 4 + 1] + 0.11 * buf[i * 4 + 2]) / 255, 1 / 2.2)
      lum[i] = l
      sum += l
    }
    const mean = sum / (S * S) || 0.2
    for (let y = 0; y < S; y++) {
      // A faint line-to-line gain wobble, as a pushbroom camera has.
      const line = 1 + (grain() - 0.5) * 0.035
      for (let x = 0; x < S; x++) {
        const si = (S - 1 - y) * S + x
        let l = ((lum[si] / mean) * 0.46 - 0.46) * 1.55 + 0.47
        l = l * line + (grain() - 0.5) * 0.07
        const c = Math.max(0, Math.min(255, l * 255))
        const di = (y * S + x) * 4
        img.data[di] = img.data[di + 1] = img.data[di + 2] = c
        img.data[di + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)

    const k = S / 1024
    const ppm = S / side
    const px = (x: number, z: number): [number, number] => [(0.5 + (cx - x) / side) * S, (0.5 - (z - cz) / side) * S]
    const mono = '"IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace'
    g.textBaseline = 'alphabetic'
    g.lineWidth = Math.max(1.5, 2 * k)
    const call = (x: number, z: number, label: string, col: string, half = 20) => {
      const [u, v] = px(x, z)
      const s = half * k
      g.strokeStyle = col
      // Corner ticks, not a full box: the subject stays visible.
      const t = s * 0.45
      g.beginPath()
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        g.moveTo(u + sx * s, v + sy * (s - t))
        g.lineTo(u + sx * s, v + sy * s)
        g.lineTo(u + sx * (s - t), v + sy * s)
      }
      g.stroke()
      g.font = `600 ${Math.round(17 * k)}px ${mono}`
      const w = g.measureText(label).width
      const lx = u + s + 6 * k + w > S - 8 ? u - s - 6 * k - w : u + s + 6 * k
      g.fillStyle = 'rgba(0,0,0,0.6)'
      g.fillRect(lx - 3 * k, v - 13 * k, w + 6 * k, 19 * k)
      g.fillStyle = col
      g.fillText(label, lx, v + 2 * k)
    }
    call(0, LANDER_CENTER_Z + 1.2, 'LANDER', '#ffffff', Math.max(20, 3.6 * ppm))
    this.site.targets.forEach((t, i) => {
      const rich = t.find === 3
      if (sim.imaged[i]) call(t.x, t.z, rich ? `${KIND_TAG[t.kind]} \u00b7 RICH \u00d72.5` : KIND_TAG[t.kind], '#86e3a8', 14)
      else if (rich) {
        // A rich find the rover never reached: marked where it is, or on the frame's edge with how far off it lies.
        const [u, v] = px(t.x, t.z)
        const m = 34 * k
        if (u >= m && u <= S - m && v >= 60 * k && v <= S - m) call(t.x, t.z, 'RICH FIND \u00b7 MISSED', '#ffd24a', 14)
        else {
          const eu = Math.max(m, Math.min(S - m, u))
          const ev = Math.max(64 * k, Math.min(S - 70 * k, v))
          const off = Math.round(Math.hypot(u - eu, v - ev) / ppm)
          const a = Math.atan2(v - ev, u - eu)
          g.fillStyle = '#ffd24a'
          g.beginPath()
          g.moveTo(eu + Math.cos(a) * 14 * k, ev + Math.sin(a) * 14 * k)
          g.lineTo(eu + Math.cos(a + 2.5) * 10 * k, ev + Math.sin(a + 2.5) * 10 * k)
          g.lineTo(eu + Math.cos(a - 2.5) * 10 * k, ev + Math.sin(a - 2.5) * 10 * k)
          g.closePath()
          g.fill()
          const label = `RICH FIND ${off} m`
          g.font = `600 ${Math.round(17 * k)}px ${mono}`
          const w = g.measureText(label).width
          const lx = Math.max(8 * k, Math.min(S - w - 8 * k, eu - Math.cos(a) * (20 * k + w / 2) - w / 2))
          const ly = Math.max(64 * k, Math.min(S - 70 * k, ev - Math.sin(a) * 26 * k + 6 * k))
          g.fillStyle = 'rgba(0,0,0,0.6)'
          g.fillRect(lx - 3 * k, ly - 15 * k, w + 6 * k, 19 * k)
          g.fillStyle = '#ffd24a'
          g.fillText(label, lx, ly)
        }
      }
    })
    if (sim.tenAt) call(sim.tenAt[0], sim.tenAt[1], '10 m', '#ffbf5e', 12)
    if (sim.off) call(sim.x, sim.z, 'ROVER', '#8fd3ff', 16)

    // Header and scale bar.
    g.fillStyle = 'rgba(0,0,0,0.62)'
    g.fillRect(0, 0, S, 44 * k)
    g.fillStyle = '#fff'
    g.font = `600 ${Math.round(19 * k)}px ${mono}`
    g.fillText(`ORBITER PASS · LUNAR ROVER · SITE #${this.site.mission}`, 16 * k, 29 * k)
    const bar = side > 70 ? 20 : 10
    const bw = bar * ppm
    g.fillStyle = 'rgba(0,0,0,0.62)'
    g.fillRect(12 * k, S - 56 * k, bw + 28 * k, 44 * k)
    g.fillStyle = '#fff'
    g.fillRect(26 * k, S - 26 * k, bw, 4 * k)
    g.fillRect(26 * k, S - 32 * k, 2 * k, 10 * k)
    g.fillRect(26 * k + bw - 2 * k, S - 32 * k, 2 * k, 10 * k)
    g.font = `600 ${Math.round(16 * k)}px ${mono}`
    g.fillText(`${bar} m`, 26 * k, S - 36 * k)
    return cv
  }

  // ---------------------------------------------------------------------------

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    const ratio = Math.min(this.baseRatio, this.ratioCap)
    if (Math.abs(ratio - this.renderer.getPixelRatio()) > 0.01) this.renderer.setPixelRatio(ratio)
    this.renderer.setSize(w, h, false)
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio())
      this.composer.setSize(w, h)
    }
    this.camera.aspect = w / h
    this.camera.fov = w < h ? 70 : 56
    this.camera.updateProjectionMatrix()
    this.settleMs = Math.max(this.settleMs, 600)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.audio?.stopAll()
    for (const d of this.bag) d.dispose()
    for (const d of this.modelBag) d.dispose()
    for (const d of this.baseBag) d.dispose()
    this.composer?.dispose()
    this.renderer.dispose()
  }
}
