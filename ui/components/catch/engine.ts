/**
 * Catch render + game loop. Plain three.js, no React: same split as Touchdown.
 * The loop and the physics never wait on a React render. The React shell
 * (CatchGame.tsx) feeds input in and receives HUD, callout and end callbacks.
 */
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { botInput } from '@/lib/catch/autopilot'
import type { Conditions } from '@/lib/catch/conditions'
import { ARMS, MOUNT, PAD1, PAD2, SHIP, towerCentre } from '@/lib/catch/layout'
import type { ModeConfig } from '@/lib/catch/modes'
import {
  BLAST_POINTS,
  COM_Y,
  createSim,
  pinX,
  pinY,
  pinZ,
  seaAt,
  stepSim,
  SWEET_X,
  SUBSTEP_DT,
  tiltDeg,
  windAt,
  type Sim,
  type SimInput,
  type StructureId,
} from '@/lib/catch/physics'
import { quantise, recordTape, tapeToBase64 } from '@/lib/catch/replay'
import { scoreFlight, type FlightResult } from '@/lib/catch/scoring'
import { Effects } from './effects'
import { buildGround, type Ground } from './ground'
import { buildShip, hullFragments, type ShipModel } from './ship'
import { bakeSky, type BakedSky } from './sky'
import { buildStarbase, type StarbaseModel } from './starbase'
import type { Bag } from './util'

export type HudState = {
  /** m: catch pins above the rails (negative once they are past). */
  above: number
  vspeed: number
  hspeed: number
  fuel: number
  /** m: horizontal distance from the pins to their place between the arms. */
  dist: number
  tilt: number
  burning: boolean
  armsClosing: boolean
  /** Engine throttle, 0..1. */
  throttle: number
  /** m from the sweet spot: along the arms (+ toward the tower) and across them (+ screen right). */
  along: number
  across: number
  /** m/s along and across the arms. */
  vAlong: number
  vAcross: number
  /** Catch-point marker in CSS fractions of the canvas; clamped to the edge when off-screen. */
  tx: number
  ty: number
  tOnScreen: boolean
  prompt: string
  promptTone: 'info' | 'warn'
}

export type Callout = { text: string; tone: 'info' | 'warn' | 'good' | 'bad' }

export type EngineCallbacks = {
  onHud: (hud: HudState) => void
  onCallout: (c: Callout) => void
  /** Fires the moment the flight is decided: hide flight controls. */
  onOver: () => void
  /** Fires once the end-shot camera has settled. */
  onEnd: (result: FlightResult) => void
}

/** Sound hooks; all optional so the engine runs silent. */
export type CatchAudio = {
  /** Called every frame: engine throttle 0..1 and the ship's speed in m/s. */
  setFlight?: (throttle: number, speed: number) => void
  /** The double sonic boom. */
  boom?: () => void
  explosion?: (size: number) => void
  clang?: () => void
  splash?: () => void
  radio?: () => void
}

type Phase = 'idle' | 'intro' | 'flying' | 'ending' | 'result'

const v3 = () => new THREE.Vector3()
const rad = (d: number) => (d * Math.PI) / 180
const smooth = (u: number) => {
  const c = u < 0 ? 0 : u > 1 ? 1 : u
  return c * c * (3 - 2 * c)
}

/** Seconds of the automatic opening: belly-down fall, flip, relight, hand-over. */
const INTRO_T = 2.9
const FLOP_END = 0.7
const FLOP_SPEED = 70
/** Where on the opening the start screen is frozen: belly-down, so pressing play runs straight into the flip. */
const IDLE_T = 0

export class CatchEngine {
  autopilot = false

  private renderer: THREE.WebGLRenderer
  private composer: EffectComposer | null = null
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(50, 1, 4, 80000)
  private sun = new THREE.DirectionalLight(0xffffff, 1)
  private sunDir = v3()
  private sky: BakedSky
  private ground: Ground
  private base: StarbaseModel
  private ship: ShipModel
  private fx: Effects
  private bag: Bag = []
  private raf = 0
  private last = 0
  private acc = 0
  private clock = 0
  private phaseT = 0
  private hudT = 0
  private timeScale = 1
  private slowUntil = 0
  private disposed = false
  private mobile: boolean
  /** Touch device: coaching names the stick, not the arrow keys. */
  touch = false

  private sim!: Sim
  private mode!: ModeConfig
  private phase: Phase = 'idle'
  private want = { x: 0, y: 0, burn: false, arms: false, analog: false }
  private stick = { x: 0, y: 0 }
  private simInput: SimInput = { x: 0, y: 0, burn: false, arms: false }
  private tape: number[] = []
  private result: FlightResult | null = null
  private endFired = false
  private exploded = false
  private plumePower = 0
  private washT = 0
  private steamT = 0
  private hazeT = 0
  private caughtAt = -1
  private ring!: THREE.Mesh
  private beam!: THREE.Mesh
  /** Target circles on the ground and the mount deck, straight under the catch point. */
  private targetRings = new THREE.Group()
  /** Where the ship is heading: a circle on the ground at its predicted arrival point, and a line to it. */
  private plumbRing!: THREE.Mesh
  private plumbLine!: THREE.Line
  private flash = new THREE.PointLight(0xffb066, 0, 900, 1.4)
  private scorch!: THREE.Mesh
  /** Things that go off after the main blast. */
  private secondaries: { at: number; id: StructureId; done: boolean }[] = []
  private burning: { id: StructureId; until: number; next: number }[] = []
  private detached: THREE.Object3D[] = []
  /** How each catch arm fails, chosen afresh for every wreck. */
  private armFx: { sagL: number; sagR: number; yawL: number; yawR: number; offL: boolean; offR: boolean; t: number } | null = null
  /** A ship set down intact has no legs: it stands a moment, then goes over. */
  private topple: { t: number; dx: number; dz: number; boom: boolean; q0: THREE.Quaternion } | null = null
  private endHoldUntil = 0
  private flapTrim = 0
  private flapRoll = 0
  private fragGeos: THREE.BufferGeometry[] = []
  private boosterFall = -1
  private booster: THREE.Object3D | null = null
  private boosterHome = v3()
  private altMarks: number[] = []
  private fuelMarks: number[] = []
  private saidArms = false
  private saidFlip = false

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
  private endAngle = 0
  private endDist = 150
  /** Dev override (?cam=x,y,z,lx,ly,lz): a fixed camera for inspecting models. */
  private fixedCam: number[] | null = null

  private hud: HudState = {
    above: 0,
    vspeed: 0,
    hspeed: 0,
    fuel: 1,
    dist: 0,
    tilt: 0,
    burning: false,
    armsClosing: false,
    throttle: 0,
    along: 0,
    across: 0,
    vAlong: 0,
    vAcross: 0,
    tx: 0.5,
    ty: 0.5,
    tOnScreen: false,
    prompt: '',
    promptTone: 'info',
  }

  constructor(
    private canvas: HTMLCanvasElement,
    private conditions: Conditions,
    private cb: EngineCallbacks,
    private audio: CatchAudio,
    opts: { mobile: boolean; bloom?: boolean }
  ) {
    this.mobile = opts.mobile
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.mobile ? 1.5 : 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const c = conditions
    const el = rad(c.sunElevation)
    const az = rad(c.sunAzimuth)
    this.sunDir.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az))
    this.sky = bakeSky(
      this.renderer,
      { sunDir: [this.sunDir.x, this.sunDir.y, this.sunDir.z], cover: c.cloudCover, seed: c.seed, windAngle: Math.atan2(c.windZ, c.windX) },
      this.mobile,
      this.bag
    )
    this.scene.background = this.sky.background
    this.scene.environment = this.sky.env
    // Sky light well under the sun: shadows stay dark enough to model everything.
    this.scene.environmentIntensity = 0.5
    this.scene.fog = new THREE.FogExp2(this.sky.fogColor, 0.00007)

    this.buildLights()
    // Poured concrete round each mount; the rest of the site is compacted fill.
    const pads = [
      new THREE.Vector4(PAD1.x + 12, PAD1.z, 52, 46),
      new THREE.Vector4(PAD2.x, PAD2.z - 12, 46, 52),
      new THREE.Vector4(1e7, 1e7, 1, 1),
    ]
    this.ground = buildGround(this.sky.env, c.seed, pads, this.bag)
    this.scene.add(this.ground.group)
    this.base = buildStarbase(this.sky.env, this.bag)
    this.scene.add(this.base.group)
    this.booster = this.base.pad2.group.getObjectByName('booster') ?? null
    if (this.booster) this.boosterHome.copy(this.booster.position)
    this.ship = buildShip(this.sky.env, this.bag)
    this.scene.add(this.ship.group)
    this.fx = new Effects(this.bag, this.sky.env)
    this.scene.add(this.fx.mesh, this.fx.tiles, this.flash)
    this.buildGuides()
    if (!opts.mobile && opts.bloom !== false) this.buildComposer()
    this.resize()
  }

  // ---------------------------------------------------------------------------
  // Scene construction
  // ---------------------------------------------------------------------------

  private buildLights() {
    const s = this.sky
    this.sun.color.copy(s.sunColor)
    this.sun.intensity = 5.6 * s.sunStrength
    this.sun.castShadow = true
    const sh = this.sun.shadow
    const size = this.mobile ? 2048 : 4096
    sh.mapSize.set(size, size)
    sh.camera.left = -330
    sh.camera.right = 330
    sh.camera.top = 330
    sh.camera.bottom = -330
    sh.camera.near = 50
    sh.camera.far = 1400
    sh.bias = -0.0004
    sh.normalBias = 0.12
    // The shadow box takes in both pads and the tank farm between them.
    const f = v3().set((PAD1.x + PAD2.x) / 2 + 20, 60, -20)
    this.sun.target.position.copy(f)
    this.sun.position.copy(f).addScaledVector(this.sunDir, 700)
    this.scene.add(this.sun, this.sun.target)

    // The sun itself: a hot disc with a soft glow for the bloom pass to catch.
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.035, 'rgba(255,255,255,1)')
    grad.addColorStop(0.06, 'rgba(255,244,220,0.42)')
    grad.addColorStop(0.3, 'rgba(255,232,200,0.1)')
    grad.addColorStop(1, 'rgba(255,230,200,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: new THREE.Color(7, 6.2, 5).multiply(s.sunColor),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
    const sprite = new THREE.Sprite(mat)
    sprite.position.copy(this.sunDir).multiplyScalar(60000)
    sprite.scale.setScalar(26000)
    this.scene.add(sprite)
    this.bag.push(tex, mat)
  }

  /** The catch marker (a ring at rail height with a faint beam) and the scorch mark a blast leaves. */
  private buildGuides() {
    const ringGeo = new THREE.TorusGeometry(SHIP.radius + 1.4, 0.16, 8, 64)
    ringGeo.rotateX(Math.PI / 2)
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 2.2, 1.4), transparent: true, opacity: 0.85, depthWrite: false, fog: false })
    this.ring = new THREE.Mesh(ringGeo, ringMat)
    this.ring.position.set(SWEET_X, PAD1.railY + 0.6, PAD1.z)
    const beamGeo = new THREE.CylinderGeometry(0.12, 0.12, 260, 8, 1, true)
    const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 0.9), transparent: true, opacity: 0.2, depthWrite: false, fog: false })
    this.beam = new THREE.Mesh(beamGeo, beamMat)
    this.beam.position.set(SWEET_X, PAD1.railY + 130, PAD1.z)
    this.scene.add(this.ring, this.beam)

    // Ground target: circles painted under the catch point, like a landing pad.
    // Line the ship's own ground circle up with them and it is over the arms.
    const flat = (inner: number, outer: number) => {
      const g = new THREE.RingGeometry(inner, outer, 72)
      g.rotateX(-Math.PI / 2)
      this.bag.push(g)
      return g
    }
    const targetMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.9, 1.15), transparent: true, opacity: 0.9, depthWrite: false, fog: false, side: THREE.DoubleSide })
    const fillMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 0.85), transparent: true, opacity: 0.2, depthWrite: false, fog: false, side: THREE.DoubleSide })
    const deck = new THREE.Mesh(flat(4.6, 7.2), targetMat)
    deck.position.set(SWEET_X, MOUNT.top + 0.7, PAD1.z)
    const dot = new THREE.Mesh(flat(0, 1.8), targetMat)
    dot.position.copy(deck.position)
    const outer1 = new THREE.Mesh(flat(21, 25), targetMat)
    outer1.position.set(SWEET_X, 0.7, PAD1.z)
    const outer2 = new THREE.Mesh(flat(40, 44), targetMat)
    outer2.position.set(SWEET_X, 0.7, PAD1.z)
    const wash = new THREE.Mesh(flat(0, 44), fillMat)
    wash.position.set(SWEET_X, 0.6, PAD1.z)
    this.bag.push(fillMat)
    this.targetRings.add(wash, deck, dot, outer1, outer2)
    for (const m of this.targetRings.children) m.renderOrder = 2
    const plumbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 1.0), transparent: true, opacity: 0.95, depthWrite: false, fog: false, side: THREE.DoubleSide })
    this.plumbRing = new THREE.Mesh(flat(4.2, 7.4), plumbMat)
    const plumbFill = new THREE.Mesh(flat(0, 4.2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false, fog: false, side: THREE.DoubleSide }))
    this.bag.push(plumbFill.material as THREE.Material)
    this.plumbRing.add(plumbFill)
    this.plumbRing.renderOrder = 3
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, fog: false })
    this.plumbLine = new THREE.Line(lineGeo, lineMat)
    this.plumbLine.frustumCulled = false
    this.scene.add(this.targetRings, this.plumbRing, this.plumbLine)
    this.bag.push(targetMat, plumbMat, lineGeo, lineMat)

    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, 'rgba(0,0,0,0.95)')
    grad.addColorStop(0.45, 'rgba(10,8,6,0.7)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * 6.283 + Math.sin(i * 12.9) * 0.2
      g.strokeStyle = `rgba(0,0,0,${0.25 + (i % 5) * 0.08})`
      g.lineWidth = 2 + (i % 3)
      g.beginPath()
      g.moveTo(128 + Math.cos(a) * 30, 128 + Math.sin(a) * 30)
      g.lineTo(128 + Math.cos(a) * (80 + ((i * 37) % 48)), 128 + Math.sin(a) * (80 + ((i * 37) % 48)))
      g.stroke()
    }
    const tex = new THREE.CanvasTexture(c)
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })
    this.scorch = new THREE.Mesh(geo, mat)
    this.scorch.visible = false
    this.scorch.renderOrder = 1
    this.scene.add(this.scorch)
    this.bag.push(ringGeo, ringMat, beamGeo, beamMat, tex, geo, mat)
  }

  private buildComposer() {
    try {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
      const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 })
      const composer = new EffectComposer(this.renderer, target)
      composer.addPass(new RenderPass(this.scene, this.camera))
      // Only genuinely hot pixels bloom: the engines, a fireball, the sun, glints off the sea.
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.55, 2.6))
      composer.addPass(new OutputPass())
      this.composer = composer
      this.bag.push(target)
    } catch {
      this.composer = null
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  prepare(mode: ModeConfig) {
    this.mode = mode
    this.sim = createSim(mode, this.conditions)
    this.phase = 'idle'
    this.phaseT = 0
    this.result = null
    this.endFired = false
    this.timeScale = 1
    this.slowUntil = 0
    this.acc = 0
    this.shake = 0
    this.stick.x = this.stick.y = 0
    this.tape = []
    this.plumePower = 0
    this.secondaries = []
    this.burning = []
    this.topple = null
    this.endHoldUntil = 0
    for (const g of this.fragGeos) g.dispose()
    this.fragGeos = []
    // Put back any arm a wreck tore off.
    const p1 = this.base.pad1
    for (const [arm, sx] of [
      [p1.armR, 1],
      [p1.armL, -1],
    ] as const) {
      if (arm.parent !== p1.carriage) p1.carriage.add(arm)
      arm.position.set(sx * ARMS.pivotX, 0, -ARMS.pivotOut)
      arm.rotation.set(0, 0, 0)
      arm.quaternion.identity()
      arm.visible = true
    }
    this.armFx = null
    this.boosterFall = -1
    this.saidArms = false
    this.saidFlip = false
    this.fx.clear()
    for (const d of this.detached) this.scene.remove(d)
    this.detached = []
    if (this.exploded) {
      this.scene.remove(this.ship.group)
      this.ship = buildShip(this.sky.env, this.bag)
      this.scene.add(this.ship.group)
      this.exploded = false
    }
    this.ship.group.visible = true
    this.flash.intensity = 0
    this.scorch.visible = false
    this.ring.visible = true
    this.beam.visible = true
    if (this.booster) {
      this.booster.visible = true
      this.booster.position.copy(this.boosterHome)
      this.booster.rotation.set(0, 0, 0)
    }
    this.base.pad1.armR.rotation.set(0, -ARMS.openAngle, 0)
    this.base.pad1.armL.rotation.set(0, ARMS.openAngle, 0)
    this.altMarks = [400, 200, 100, 50, 20].filter((a) => a < mode.startAltitude - PAD1.railY)
    this.steamT = 0
    this.caughtAt = -1
    this.fuelMarks = [0.5, 0.25, 0.1]
    this.resetCamera()
    this.poseIntro(IDLE_T)
    this.updateCamera(0, true)
  }

  start() {
    if (!this.sim || this.phase !== 'idle') return
    this.phase = 'intro'
    this.phaseT = 0
    this.resetCamera()
    this.say('Belly-down at 250 km/h. Flip.', 'info')
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

  /** The finished flight's input tape, base64, for score verification. */
  tapeBase64(): string {
    return tapeToBase64(this.tape)
  }

  /** Test hook (?autopilot=1): run the loop synchronously. A hidden tab throttles requestAnimationFrame. */
  advance(seconds: number) {
    const frames = Math.round(seconds * 60)
    for (let i = 0; i < frames && !this.disposed; i++) this.frame(1 / 60)
  }

  /** Stick, burn and arms from the player. `analog` (touch stick) skips key smoothing. */
  setControl(x: number, y: number, burn: boolean, arms: boolean, analog: boolean) {
    this.want.x = x
    this.want.y = y
    this.want.burn = burn
    this.want.arms = arms
    this.want.analog = analog
  }

  /** Drag to look around. Radians. */
  orbit(dyaw: number, dpitch: number) {
    this.camYaw += dyaw
    this.camPitch = Math.max(-0.5, Math.min(1.1, this.camPitch + dpitch))
  }

  zoom(factor: number) {
    this.camZoom = Math.max(0.45, Math.min(3, this.camZoom * factor))
  }

  resetCamera() {
    this.camYaw = 0
    this.camPitch = 0
    this.camZoom = 1
  }

  setCamera(values: number[] | null) {
    this.fixedCam = values && values.length === 6 ? values : null
  }

  /**
   * Test hook: end the flight a given way at a given spot, to look at an
   * ending without having to fly into it. Not reachable from the game.
   */
  debugEnd(outcome: 'ditched' | 'splashdown' | 'crashed', x: number, z: number, speed = 3) {
    if (this.phase !== 'flying') return
    const s = this.sim
    s.px = x
    s.pz = z
    s.py = COM_Y + 0.3
    s.vx = outcome === 'crashed' ? speed * 0.4 : 1.2
    s.vy = -speed
    s.vz = 0.4
    s.outcome = outcome
    s.cause = outcome === 'splashdown' ? 'sea' : 'ground'
    s.endVertical = speed
    s.endHorizontal = Math.hypot(s.vx, s.vz)
    if (outcome !== 'splashdown') s.damage = Math.hypot(x, z) < 60 ? ['mount', 'arms'] : []
    this.finishFlight()
  }

  /** Test hook: where the flight stands. */
  state(): { phase: Phase; outcome: string | null; score: number | null } {
    return { phase: this.phase, outcome: this.sim?.outcome ?? null, score: this.result?.score ?? null }
  }

  /** The current frame as a canvas, for the share card. */
  capture(): HTMLCanvasElement {
    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
    const out = document.createElement('canvas')
    out.width = this.canvas.width
    out.height = this.canvas.height
    out.getContext('2d')?.drawImage(this.canvas, 0, 0)
    return out
  }

  private say(text: string, tone: Callout['tone']) {
    this.audio.radio?.()
    this.cb.onCallout({ text, tone })
  }

  // ---------------------------------------------------------------------------
  // The opening: belly-down fall, flip and relight, ending exactly on the
  // state the physics starts from. It is a picture of the ship, not a
  // simulation: nothing in it affects the flight or the score.
  // ---------------------------------------------------------------------------

  private poseIntro(t: number) {
    const s = this.sim
    const T = INTRO_T
    const tb = FLOP_END + 0.2
    const v0y = this.mode.startVerticalSpeed
    const vyAt = (u: number) => (u < tb ? -FLOP_SPEED : -FLOP_SPEED + (v0y + FLOP_SPEED) * ((u - tb) / (T - tb)))
    // Position: integrate the fall back from the hand-over point.
    let y: number
    if (t >= tb) y = s.py - ((vyAt(t) + v0y) / 2) * (T - t)
    else y = s.py - ((-FLOP_SPEED + v0y) / 2) * (T - tb) + FLOP_SPEED * (tb - t)
    const x = s.px - s.vx * (T - t)
    // Attitude: nose toward the tower and belly to the ground, then the flip
    // swings the tail down, overshoots, and settles at the hand-over lean.
    const lean = 0
    let phi: number
    if (t < FLOP_END) phi = -Math.PI / 2 + Math.sin(t * 2.3) * 0.03
    else if (t < FLOP_END + 1.7) phi = -Math.PI / 2 + (Math.PI / 2 + lean + 0.16) * smooth((t - FLOP_END) / 1.7)
    else phi = lean + 0.16 * (1 - smooth((t - FLOP_END - 1.7) / (T - FLOP_END - 1.7)))
    const roll = Math.sin(t * 1.7 + 1) * 0.02 * (1 - smooth((t - FLOP_END) / 1.2))
    qA.setFromAxisAngle(Z_AXIS, phi)
    qB.setFromAxisAngle(X_AXIS, roll)
    qA.multiply(qB)
    this.placeShip(x, y, s.pz, qA)
    this.plumePower = smooth((t - FLOP_END - 0.15) / 0.5) * (t > T - 0.5 ? 1 - 0.55 * smooth((t - (T - 0.5)) / 0.5) : 1)
    // Flaps: spread wide to hold the fall, folding in as the engines take over.
    this.setFlaps(1 - smooth((t - FLOP_END) / 1.4))
  }

  /** Place the ship model from the centre-of-mass position and the body's attitude. */
  private placeShip(x: number, y: number, z: number, q: THREE.Quaternion) {
    const g = this.ship.group
    // Body frame (x belly, z pins) to the model's (z belly, x pins).
    g.quaternion.copy(q).multiply(MODEL_TURN)
    scratchA.set(0, -COM_Y, 0).applyQuaternion(q)
    g.position.set(x + scratchA.x, y + scratchA.y, z + scratchA.z)
  }

  /** 1: flaps fully out for the belly-down fall. 0: tucked in for the landing burn. */
  private setFlaps(spread: number, trimAft = 0, trimFwd = 0, roll = 0) {
    const f = this.ship.flaps
    // Folding swings each flap back about its hinge, toward the leeward side.
    const aft = (1 - spread) * 0.42 + trimAft
    const fwd = (1 - spread) * 0.3 + trimFwd
    f.ar.rotation.y = aft + roll
    f.al.rotation.y = -(aft - roll)
    f.fr.rotation.y = fwd - roll
    f.fl.rotation.y = -(fwd + roll)
  }

  // ---------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------

  private frame(dt: number) {
    this.clock += dt
    this.phaseT += dt
    const sim = this.sim
    if (!sim) return

    const scaleTo = this.clock < this.slowUntil ? 0.3 : 1
    this.timeScale += (scaleTo - this.timeScale) * Math.min(1, dt * (scaleTo < 1 ? 14 : 2.5))

    if (this.phase === 'intro') {
      this.poseIntro(Math.min(INTRO_T, this.phaseT))
      this.audio.setFlight?.(this.plumePower, FLOP_SPEED)
      if (this.phaseT > FLOP_END + 0.9 && !this.saidFlip) {
        // The flip ends tail-first and subsonic: the double boom reaches the ground about now.
        this.saidFlip = true
        this.audio.boom?.()
      }
      if (this.phaseT >= INTRO_T) {
        this.phase = 'flying'
        this.phaseT = 0
        this.say(this.mode.coaching ? 'You have the ship. It is falling: hold BURN to brake.' : 'Pro approach. You have the ship and the arms.', 'warn')
      }
    } else if (this.phase === 'flying') {
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
            this.stick[k] += Math.sign(d) * Math.min(Math.abs(d), (rising ? 2.6 : 7) * dt)
          }
        }
        // The stick is relative to where the camera is looking.
        const c = Math.cos(this.camYaw)
        const s = Math.sin(this.camYaw)
        this.simInput.y = this.stick.y * c - this.stick.x * s
        this.simInput.x = this.stick.y * s + this.stick.x * c
        this.simInput.burn = this.want.burn
        this.simInput.arms = this.want.arms
      }
      // The sim flies on the same quantised stick values the tape stores.
      this.simInput.x = quantise(this.simInput.x)
      this.simInput.y = quantise(this.simInput.y)
      this.acc += dt * this.timeScale
      let steps = 0
      while (this.acc >= SUBSTEP_DT && steps < 24) {
        stepSim(sim, this.simInput, SUBSTEP_DT)
        this.acc -= SUBSTEP_DT
        steps++
        if (sim.events.length) this.drainEvents()
        if (sim.outcome) break
      }
      if (steps === 24) this.acc = 0
      recordTape(this.tape, steps, this.simInput.x, this.simInput.y, this.simInput.burn, this.simInput.arms)
      // Only while it is still flying: the step above may have ended the flight.
      if (this.phase === 'flying') this.audio.setFlight?.(sim.throttle, Math.hypot(sim.vx, sim.vy, sim.vz))
      // Lit even at idle: a short flame that lengthens with the throttle.
      const flame = sim.throttle > 0 ? 0.3 + 0.7 * sim.throttle : 0
      if (this.phase === 'flying') this.plumePower += (flame - this.plumePower) * Math.min(1, dt * 10)
      if (!sim.outcome) this.flightCallouts()
      if (!this.exploded) this.syncShip()
    }

    if (this.phase === 'idle' || this.phase === 'ending' || this.phase === 'result') this.audio.setFlight?.(0, 0)
    this.updateTopple(dt * Math.max(this.timeScale, 0.3))
    this.syncArms(dt)
    this.updateEffects(dt * Math.max(this.timeScale, 0.3))
    this.updateCamera(dt)
    this.updateHud(dt)

    // Plume, glow and the light the engines throw.
    const p = this.exploded ? 0 : this.plumePower
    this.ship.plumeMat.uniforms.uTime.value = this.clock
    this.ship.plumeMat.uniforms.uPower.value = p
    this.ship.plume.visible = p > 0.02
    // Flame length follows the throttle; its direction follows the engine swivel.
    this.ship.plume.scale.set(1, 0.45 + 0.6 * p, 1)
    if (this.phase === 'flying' && !this.exploded) {
      // Body frame (x belly, z pins) to the model's (z belly, x pins); the swing is drawn a little large to read.
      const k = 1.5
      scratchA.set(Math.tan(sim.gz * k), -1, -Math.tan(sim.gx * k)).normalize()
      this.ship.plume.quaternion.setFromUnitVectors(DOWN, scratchA)
    } else this.ship.plume.quaternion.identity()
    this.ship.engineGlow.emissiveIntensity = 2.8 * p
    this.ship.light.intensity = 2500 * p
    this.ground.time.value = this.clock
    if (this.flash.intensity > 1) this.flash.intensity *= Math.pow(0.0006, dt)
    else this.flash.intensity = 0
    const blink = this.clock % 1.8 < 0.3
    for (const b of this.base.beacons) b.visible = blink
    const guide = this.phase === 'flying' || this.phase === 'intro'
    this.targetRings.visible = guide || this.phase === 'idle'
    this.plumbRing.visible = this.plumbLine.visible = this.phase === 'flying' && !this.exploded
    if (this.plumbRing.visible) {
      // Where the ship is heading: the spot on the ground it will be over when
      // it gets down to the arms, if it keeps shedding speed steadily. Put this
      // circle on the green target and hold it there. As the ship slows it
      // closes in on the point straight below.
      const g = this.ship.group.position
      const above = Math.max(0, pinY(sim) - PAD1.railY)
      const t = Math.min(14, above / Math.max(2.5, -sim.vy))
      const ax = g.x + sim.vx * t * 0.5
      const az = g.z + sim.vz * t * 0.5
      const overDeck = Math.abs(ax - PAD1.x) < MOUNT.size / 2 && Math.abs(az - PAD1.z) < MOUNT.size / 2
      const gy = (overDeck ? MOUNT.top : 0) + 0.9
      this.plumbRing.position.set(ax, gy, az)
      const off = Math.hypot(ax - SWEET_X, az - PAD1.z)
      ;(this.plumbRing.material as THREE.MeshBasicMaterial).color.setRGB(off < 3 ? 0.3 : 2.4, off < 3 ? 2.4 : off < 10 ? 1.9 : 1.5, off < 3 ? 1.2 : off < 10 ? 0.25 : 0.2)
      const pos = this.plumbLine.geometry.attributes.position as THREE.BufferAttribute
      pos.setXYZ(0, g.x, g.y, g.z)
      pos.setXYZ(1, ax, gy, az)
      pos.needsUpdate = true
    }
    ;(this.ring.material as THREE.MeshBasicMaterial).opacity = guide ? 0.55 + 0.3 * Math.sin(this.clock * 4) : 0
    ;(this.beam.material as THREE.MeshBasicMaterial).opacity = guide ? 0.2 : 0

    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }

  private syncShip() {
    const s = this.sim
    qA.set(s.qx, s.qy, s.qz, s.qw)
    this.placeShip(s.px, s.py, s.pz, qA)
    // The flaps keep working on the way down: they trim against the steering.
    const live = this.phase === 'flying' ? 1 : 0
    // Small, slow corrections: a few degrees, never a flutter.
    const k = 1 - Math.pow(0.02, 1 / 60)
    this.flapTrim += (0.16 * s.gx * live - this.flapTrim) * k
    this.flapRoll += (0.14 * s.gz * live - this.flapRoll) * k
    this.setFlaps(0, this.flapTrim, -this.flapTrim, this.flapRoll)
  }

  /** Decide how the two catch arms fail this time: sag, swing wide, tear off, or survive. */
  private wreckArms() {
    if (this.armFx) return
    const p = this.base.pad1
    // The south arm is the pad's left-hand one. The arm nearer the impact fares worse.
    const south = this.ship.group.position.z > 0
    const fate = (near: boolean) => {
      const u = Math.random() * (near ? 1 : 1.5)
      return u < 0.28 ? 'off' : u < 0.72 ? 'sag' : u < 1.05 ? 'swing' : 'none'
    }
    let fl = fate(south)
    let fr = fate(!south)
    if (fl === 'none' && fr === 'none') {
      if (south) fl = 'sag'
      else fr = 'sag'
    }
    const sag = (f: string) => (f === 'sag' ? 0.18 + Math.random() * 0.7 : f === 'swing' ? 0.04 + Math.random() * 0.22 : 0)
    const yaw = (f: string) => (f === 'swing' ? (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.5) : (Math.random() - 0.5) * 0.12)
    this.armFx = { sagL: sag(fl), sagR: sag(fr), yawL: yaw(fl), yawR: yaw(fr), offL: fl === 'off', offR: fr === 'off', t: 0 }
    for (const [arm, off] of [
      [p.armL, fl === 'off'],
      [p.armR, fr === 'off'],
    ] as const) {
      if (!off) continue
      // Torn from its pivot: it falls as wreckage.
      this.scene.attach(arm)
      this.fx.debris.push({
        obj: arm,
        v: new THREE.Vector3((Math.random() - 0.5) * 10, 3 + Math.random() * 5, (Math.random() - 0.5) * 10),
        w: new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.4, Math.random() - 0.5).multiplyScalar(0.9),
        r: 3,
        rest: false,
        trail: 0,
        wet: false,
      })
    }
    this.audio.clang?.()
  }

  private syncArms(dt: number) {
    const s = this.sim
    const p = this.base.pad1
    const fx = this.armFx
    let e = 0
    if (fx) {
      fx.t = Math.min(1, fx.t + dt * 0.7)
      e = smooth(fx.t)
    }
    // The pad group is turned so its right-hand arm is the north one.
    if (!fx || !fx.offR) {
      p.armR.rotation.y = -s.armN + (fx ? fx.yawR * e : 0)
      p.armR.rotation.x = fx ? -fx.sagR * e : 0
    }
    if (!fx || !fx.offL) {
      p.armL.rotation.y = s.armS + (fx ? fx.yawL * e : 0)
      p.armL.rotation.x = fx ? -fx.sagL * e : 0
    }
    if (this.boosterFall >= 0 && this.booster) {
      // The booster slips out of the second tower's arms and comes down.
      this.boosterFall += dt
      const t = this.boosterFall
      const room = this.boosterHome.y - 12
      const drop = Math.min(room, 0.5 * 9.81 * t * t)
      this.booster.position.y = this.boosterHome.y - drop
      this.booster.rotation.x = Math.min(0.5, t * 0.12)
      if (drop >= room && this.booster.visible) {
        this.booster.visible = false
        const w = BLAST_POINTS.mount2
        this.fx.fireball(w[0], 10, w[2], 1.3)
        this.audio.explosion?.(1)
        this.shake = Math.max(this.shake, 2.5)
        this.flash.position.set(w[0], 30, w[2])
        this.flash.intensity = 2e5
      }
    }
  }

  private drainEvents() {
    const sim = this.sim
    for (const ev of sim.events.splice(0)) {
      switch (ev.type) {
        case 'armsclosing':
          this.audio.clang?.()
          if (this.mode.autoArms) this.say('Arms closing.', 'info')
          break
        case 'hug':
          break
        case 'missed':
          this.say('Pins are past the rails. No catch on this pass.', 'bad')
          break
        case 'pins':
          this.say(`Too fast: ${ev.speed.toFixed(0)} m/s sheared the catch pins.`, 'bad')
          this.shake = Math.max(this.shake, 1.2)
          break
        case 'fuelout':
          this.say('Propellant depleted.', 'bad')
          break
        case 'done':
          this.finishFlight()
          break
      }
    }
  }

  private flightCallouts() {
    const s = this.sim
    const above = pinY(s) - PAD1.railY
    while (this.altMarks.length && above < this.altMarks[0]) {
      const a = this.altMarks.shift()!
      this.say(`${a} meters above the arms, ${Math.abs(s.vy).toFixed(0)} down.`, 'info')
    }
    const f = s.fuel / s.mode.fuelSeconds
    while (this.fuelMarks.length && f < this.fuelMarks[0]) {
      const m = this.fuelMarks.shift()!
      this.say(m <= 0.1 ? 'Propellant critical.' : `Propellant ${Math.round(m * 100)} percent.`, m <= 0.25 ? 'warn' : 'info')
    }
    if (!s.mode.autoArms && !this.saidArms && above < 26 && !s.armsClosing) {
      this.saidArms = true
      this.say('Close the arms once the aft flaps are through.', 'warn')
    }
  }

  private finishFlight() {
    const s = this.sim
    this.result = scoreFlight(s)
    this.cb.onOver()
    this.phase = 'ending'
    this.phaseT = 0
    this.audio.setFlight?.(0, 0)
    this.plumePower = 0
    this.endFrom.copy(this.camera.position)
    this.endLookFrom.copy(this.camLook)
    this.ring.visible = false
    this.beam.visible = false
    const o = this.result.outcome
    if (o === 'caught') {
      this.syncShip()
      this.audio.clang?.()
      this.shake = Math.max(this.shake, 0.25 + this.result.closingSpeed * 0.12)
      this.slowUntil = this.clock + 0.5
      this.caughtAt = this.clock
      if (this.result.hard) {
        this.shake = Math.max(this.shake, 1.1)
        this.say('The pins missed. It is hanging by its forward flaps.', 'warn')
      } else this.say(this.result.closingSpeed < 3 ? 'Catch. The tower has the ship.' : 'Caught. That one rang the tower.', 'good')
      this.endLook.set(PAD1.x + 6, PAD1.railY - 8, PAD1.z)
      // Sunlit side of the ship, with the Gulf behind the tower.
      this.endAngle = Math.PI + (this.sunDir.z >= 0 ? -0.75 : 0.75)
      this.endDist = 132
    } else if (o === 'splashdown' || o === 'ditched') {
      // Down in one piece, but with no legs to stand on: it goes over.
      this.syncShip()
      const wet = o === 'splashdown'
      if (wet) {
        this.audio.splash?.()
        this.fx.splash(s.px, s.pz, 1.4)
      }
      const hs = Math.hypot(s.vx, s.vz)
      const a = Math.random() * 6.283
      this.topple = {
        // Still sliding when it touched: it goes over sooner.
        t: Math.min(1.6, hs * 0.14),
        dx: hs > 0.6 ? s.vx / hs : Math.cos(a),
        dz: hs > 0.6 ? s.vz / hs : Math.sin(a),
        boom: !wet,
        q0: this.ship.group.quaternion.clone(),
      }
      this.say(wet ? 'Splashdown. Soft, wet, and nowhere near the tower.' : 'Down in one piece. It has no legs.', 'warn')
      this.endLook.set(s.px, 22, s.pz)
      this.endAngle = Math.atan2(this.camera.position.z - s.pz, this.camera.position.x - s.px) + 0.4
      this.endDist = 150
    } else if (o === 'lost') {
      this.say('We have lost the ship.', 'bad')
      this.endLook.set(PAD1.x, PAD1.railY - 20, PAD1.z)
      this.endAngle = Math.PI + 0.6
      this.endDist = 220
    } else {
      this.explode()
    }
    this.placeEnd(this.endTo, this.endAngle)
  }

  /** A ship standing with no legs: it leans, gathers speed and goes over. On land that ends it. */
  private updateTopple(dt: number) {
    const tp = this.topple
    if (!tp) return
    tp.t += dt
    const g = this.ship.group
    const ang = Math.min(Math.PI / 2, 0.012 * Math.exp(2.1 * Math.max(0, tp.t - 0.5)))
    // Tip the top toward (dx, dz): a turn about the horizontal axis square to it.
    qB.setFromAxisAngle(scratchA.set(tp.dz, 0, -tp.dx), ang)
    g.quaternion.copy(qB).multiply(tp.q0)
    if (!tp.boom) g.position.y = Math.max(-2.5, g.position.y - dt * 0.5)
    if (ang >= Math.PI / 2 - 0.001) {
      this.topple = null
      const nx = g.position.x + tp.dx * 30
      const nz = g.position.z + tp.dz * 30
      if (tp.boom) {
        this.shake = Math.max(this.shake, 2)
        this.explode(0.42, false)
      } else {
        this.fx.splash(nx, nz, 2.2)
        this.audio.splash?.()
        this.shake = Math.max(this.shake, 0.8)
        this.endHoldUntil = this.clock + 2
      }
    }
  }

  /**
   * Break the ship up where it is. How hard it hit decides how it goes: a slow
   * crash splits the hull into a few big pieces under a modest fire; a fast
   * one shreds it into plates inside a large fireball.
   */
  private explode(violenceOverride?: number, resync = true) {
    const s = this.sim
    const r = this.result!
    if (resync) this.syncShip()
    this.exploded = true
    const speed = Math.hypot(r.closingSpeed, r.horizontalSpeed)
    const violence = violenceOverride ?? Math.max(0.22, Math.min(1, speed / 50))
    this.slowUntil = this.clock + 0.6 + 0.9 * violence
    this.shake = Math.max(this.shake, 1.5 + 4 * violence)
    this.endHoldUntil = this.clock + 3.4
    const sea = r.cause === 'sea'
    const g = this.ship.group
    g.updateMatrixWorld(true)
    const mid = this.shipMid(scratchC).clone()
    const bx = mid.x
    const by = Math.max(4, mid.y - 6)
    const bz = mid.z
    const size = (0.5 + 0.8 * violence) * (0.8 + 0.4 * r.fuelLeft)
    this.fx.fireball(bx, by, bz, size * 1.25)
    if (sea) this.fx.splash(bx, bz, 2)
    this.audio.explosion?.(size)
    this.flash.position.set(bx, by + 20, bz)
    this.flash.intensity = 3e5 * (0.4 + 0.6 * violence)
    if (!sea && by < 60) {
      this.scorch.position.set(bx, 0.3, bz)
      this.scorch.scale.set(150 * size, 1, 150 * size)
      this.scorch.visible = true
    }
    this.ship.plume.visible = false
    this.ship.light.intensity = 0
    const rnd = () => Math.random()
    const fling = 0.35 + violence
    const throwPiece = (obj: THREE.Object3D, from: THREE.Vector3, radius: number) => {
      // Outward from the hull's axis, and up.
      const out = scratchB.copy(from).sub(mid)
      out.y = 0
      if (out.lengthSq() < 0.01) out.set(rnd() - 0.5, 0, rnd() - 0.5)
      out.normalize().multiplyScalar(0.6).add(scratchA.set(rnd() - 0.5, 0, rnd() - 0.5)).normalize()
      const sp = (5 + rnd() * 30) * fling
      this.fx.debris.push({
        obj,
        v: new THREE.Vector3(s.vx * 0.3 + out.x * sp, (4 + rnd() * 30) * fling, s.vz * 0.3 + out.z * sp),
        w: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(1 + 4 * violence),
        r: radius,
        rest: false,
        trail: 0,
        wet: false,
      })
    }
    // The heat shield does not stay in one piece: it sheds its tiles.
    this.fx.shedTiles(g.matrixWorld, Math.round((this.mobile ? 420 : 1300) * (0.4 + 0.6 * violence)), s.vx * fling, s.vy * 0.3, s.vz * fling)
    // The steel half splits into plates: a few big ones in a slow crash, many in a fast one.
    const bands = violence < 0.35 ? 2 : violence < 0.7 ? 4 : 6
    const slices = violence < 0.35 ? 1 : violence < 0.7 ? 2 : 3
    const plateMat = this.ship.steel.clone()
    plateMat.side = THREE.DoubleSide
    this.bag.push(plateMat)
    g.getWorldQuaternion(qA)
    for (const f of hullFragments(plateMat, bands, slices)) {
      this.fragGeos.push(f.mesh.geometry)
      f.mesh.position.copy(f.center).applyMatrix4(g.matrixWorld)
      f.mesh.quaternion.copy(qA)
      this.scene.add(f.mesh)
      this.detached.push(f.mesh)
      throwPiece(f.mesh, f.mesh.position, 3)
    }
    for (const part of this.ship.parts) {
      if (part.name === 'hull-belly' || part.name === 'hull-lee') {
        part.visible = false
        continue
      }
      part.getWorldPosition(scratchA)
      part.getWorldQuaternion(qB)
      const at = scratchA.clone()
      this.scene.add(part)
      part.position.copy(at)
      part.quaternion.copy(qB)
      this.detached.push(part)
      throwPiece(part, at, part.name === 'engines' ? 3 : 2)
    }
    g.visible = false
    // Whatever the blast reached goes up in turn.
    let delay = 0.35
    for (const id of r.damage) {
      this.secondaries.push({ at: this.clock + delay, id, done: false })
      delay += 0.35 + Math.random() * 0.4
    }
    if (violenceOverride === undefined) this.say(this.crashLine(r), 'bad')
    this.endLook.set(bx, Math.min(60, by + 25), bz)
    // Pull back the way the camera already was, swung a little to one side.
    this.endAngle = Math.atan2(this.camera.position.z - bz, this.camera.position.x - bx) + 0.5
    this.endDist = 190 + 110 * violence
  }

  private crashLine(r: FlightResult): string {
    switch (r.cause) {
      case 'tower':
        return 'Contact with the tower.'
      case 'arms':
        return 'It landed on the arms, not in them.'
      case 'flaps':
        return 'The flaps met the arms.'
      case 'mount':
        return 'Missed the arms. Found the launch mount.'
      case 'tankfarm':
      case 'plant':
        return 'That was the tank farm.'
      case 'tower2':
      case 'booster':
      case 'mount2':
        return 'Wrong tower. That one was busy.'
      case 'sea':
        return 'Hard into the Gulf.'
      case 'hopper':
        return 'It hit the old hopper. The hopper.'
      default:
        return 'Impact.'
    }
  }

  private updateEffects(dt: number) {
    const s = this.sim
    // Secondary blasts and the fires they leave.
    for (let i = 0; i < this.secondaries.length; i++) {
      const x = this.secondaries[i]
      if (x.done || this.clock < x.at) continue
      x.done = true
      const p = BLAST_POINTS[x.id]
      const big = x.id === 'tankfarm' ? 1.5 : x.id === 'booster' ? 0 : x.id === 'highway' ? 0.25 : 0.7
      if (big > 0) {
        const jx = x.id === 'plant' ? (Math.random() - 0.5) * 120 : 0
        this.fx.fireball(p[0] + jx, Math.max(4, p[1] * 0.5), p[2], big)
        this.audio.explosion?.(big)
        this.shake = Math.max(this.shake, 1.5 + big)
        this.flash.position.set(p[0] + jx, p[1] + 20, p[2])
        this.flash.intensity = Math.max(this.flash.intensity, 1.6e5 * big)
      }
      if (x.id === 'arms' || x.id === 'tower') this.wreckArms()
      if ((x.id === 'booster' || x.id === 'tower2') && this.boosterFall < 0) this.boosterFall = 0
      if (x.id === 'tankfarm') {
        // Tanks cook off one after another along the farm.
        for (let k = 1; k <= 4; k++) this.secondaries.push({ at: this.clock + k * 0.55, id: 'plant', done: false })
      }
      if (!this.burning.some((b) => b.id === x.id)) this.burning.push({ id: x.id, until: this.clock + 40, next: 0 })
    }
    for (const b of this.burning) {
      if (this.clock > b.until || this.clock < b.next) continue
      b.next = this.clock + 0.09
      const p = BLAST_POINTS[b.id]
      const spread = b.id === 'tankfarm' ? 90 : b.id === 'plant' ? 60 : 12
      const tall = b.id === 'tower' || b.id === 'tower2'
      this.fx.smoke(p[0] + (Math.random() - 0.5) * spread, Math.max(3, p[1] * (tall ? Math.random() : 0.3)), p[2] + (Math.random() - 0.5) * 20, b.id === 'tankfarm' ? 16 : 9, 0.7)
    }
    // The pad's water deluge flashes to steam as the ship comes in over the
    // mount, and keeps boiling for a few seconds after a catch.
    const mid = this.ship.group.position
    const overPad = !this.exploded && Math.hypot(mid.x - PAD1.x, mid.z - PAD1.z) < 150 && mid.y < 230
    const after = this.caughtAt >= 0 ? this.clock - this.caughtAt : -1
    if ((this.phase === 'flying' && overPad) || (after >= 0 && after < 7)) {
      this.steamT -= dt
      const power = after >= 0 ? Math.max(0, 1 - after / 7) : 0.35 + 0.65 * (1 - Math.min(1, Math.max(0, mid.y - 40) / 190))
      if (this.steamT <= 0) {
        this.steamT = this.mobile ? 0.08 : 0.04
        this.fx.steam(PAD1.x, PAD1.z, power)
        if (!this.mobile) this.fx.steam(PAD1.x, PAD1.z, power)
      }
    }
    // Residual propellant burning off under the engine bay after a catch.
    if (after >= 0 && after < 5 && Math.random() < 0.5) this.fx.flame(mid.x, mid.y + 1, mid.z, 3.5 * (1 - after / 5) + 1)
    // The faint haze the engines leave down the approach.
    if (this.phase === 'flying' && s.burning && !this.exploded) {
      this.hazeT -= dt
      if (this.hazeT <= 0) {
        this.hazeT = 0.07
        this.fx.haze(s.px - s.m[1] * (COM_Y + 50), s.py - s.m[4] * (COM_Y + 50), s.pz - s.m[7] * (COM_Y + 50))
      }
    }
    // Exhaust washing over whatever is under a low burn.
    if (this.phase === 'flying' && s.burning && !this.exploded) {
      const base = s.py - s.m[4] * COM_Y
      if (base < 70) {
        this.washT -= dt
        if (this.washT <= 0) {
          this.washT = 0.03
          const a = Math.random() * 6.283
          const gx = s.px - s.m[1] * (COM_Y + base)
          const gz = s.pz - s.m[7] * (COM_Y + base)
          this.fx.wash(gx, gz, Math.cos(a), Math.sin(a), seaAt(gx, gz), 1 - base / 70)
        }
      }
    }
    windAt(s, 40, windTmp)
    this.fx.update(dt, windTmp.x, windTmp.z, seaAt)
  }

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------

  private shipMid(out: THREE.Vector3): THREE.Vector3 {
    const g = this.ship.group
    return out.set(0, SHIP.height * 0.5, 0).applyQuaternion(g.quaternion).add(g.position)
  }

  private placeEnd(out: THREE.Vector3, angle: number, dist = this.endDist) {
    const portrait = this.camera.aspect < 1
    const d = dist * (portrait ? 1.5 : 1) * this.camZoom
    out.set(this.endLook.x + Math.cos(angle) * d, Math.max(8, this.endLook.y + d * 0.2 + this.camPitch * 60), this.endLook.z + Math.sin(angle) * d)
  }

  private chase(blend: number, snap: boolean) {
    const mid = this.shipMid(scratchA)
    const tanHalf = Math.tan((this.camera.fov * Math.PI) / 360)
    const high = Math.max(0, mid.y - PAD1.railY)
    // Above and behind the ship, looking down its slant at the pad: the ship,
    // the ground under it and the target circles are all in view, the way a
    // lander is flown. It backs off while the ship is high and closes in, and
    // levels out, as the ship comes down to the arms.
    const back = Math.max(130, Math.min(360, 120 + high * 0.34)) * this.camZoom
    const pitch = Math.max(-0.1, Math.min(1.4, 0.34 + 0.3 * Math.min(1, high / 420) + this.camPitch))
    const yaw = this.camYaw + SIDE_YAW
    const cy = Math.cos(yaw)
    const sy = Math.sin(yaw)
    // Aim part-way from the ship toward the pad, but never so far that the ship leaves the frame.
    const look = scratchC.set(SWEET_X, Math.min(PAD1.railY, mid.y) * 0.5, PAD1.z).sub(mid).multiplyScalar(0.5)
    const reach = Math.max(10, back * tanHalf * 0.6 - 30)
    if (look.length() > reach) look.setLength(reach)
    look.add(mid)
    const want = scratchB.set(look.x - Math.cos(pitch) * cy * back, look.y + Math.sin(pitch) * back, look.z + Math.cos(pitch) * sy * back)
    if (want.y < 6) want.y = 6
    if (snap) {
      this.camPos.copy(want)
      this.camLook.copy(look)
    } else {
      this.camPos.lerp(want, blend)
      this.camLook.lerp(look, blend)
    }
  }

  private updateCamera(dt: number, snap = false) {
    const cam = this.camera
    if (this.fixedCam) {
      const c = this.fixedCam
      cam.position.set(c[0], c[1], c[2])
      cam.lookAt(c[3], c[4], c[5])
      return
    }
    if (this.phase === 'idle') {
      // Start screen: belly-down over Starbase, the same shot the flight opens on.
      const mid = this.shipMid(scratchA)
      const portrait = cam.aspect < 1
      const drift = Math.sin(this.clock * 0.25) * 7
      this.camPos.set(mid.x - (portrait ? 96 : 78), mid.y + (portrait ? 78 : 58) + Math.sin(this.clock * 0.17) * 3, mid.z + 34 + drift)
      this.camLook.set(mid.x + 60, mid.y - 110, mid.z - 12)
    } else if (this.phase === 'intro') {
      // Ride above and behind the fall, Starbase spread out far below, then
      // drop in behind the ship for the hand-over.
      const mid = this.shipMid(scratchA).clone()
      const u = smooth((this.phaseT - FLOP_END * 0.5) / (INTRO_T - FLOP_END * 0.5))
      const portrait = cam.aspect < 1
      const drift = Math.sin(this.clock * 0.25) * 7
      const side = v3().set(mid.x - (portrait ? 96 : 78), mid.y + (portrait ? 78 : 58), mid.z + 34 + drift)
      const sideLook = v3().set(mid.x + 60, mid.y - 110, mid.z - 12)
      this.chase(1, true)
      this.camPos.lerpVectors(side, this.camPos, u)
      this.camLook.lerpVectors(sideLook, this.camLook, u)
    } else if (this.phase === 'flying') {
      this.chase(1 - Math.pow(0.002, dt), snap)
    } else {
      // Ending: fly to the end shot, then orbit slowly (drag still turns it).
      const T = 1.7
      const u = Math.min(1, this.phaseT / T)
      const e = smooth(u)
      if (this.phase === 'ending') {
        this.camPos.lerpVectors(this.endFrom, this.endTo, e)
        this.camLook.lerpVectors(this.endLookFrom, this.endLook, e)
        const wait = 1.4
        if (u >= 1 && this.phaseT > T + wait && !this.topple && this.clock > this.endHoldUntil && !this.endFired) {
          this.endFired = true
          this.phase = 'result'
          this.phaseT = 0
          if (this.result) this.cb.onEnd(this.result)
        }
      } else {
        if (this.result?.outcome === 'caught') {
          // The victory lap: swing round the tower to its seaward side, so the
          // booster held in Tower 2 and the factory on the horizon come into view
          // behind the ship.
          const a0 = this.endAngle
          const portrait = this.camera.aspect < 1
          // Far enough round that the tower does not stand in front of the ship.
          const a1 = Math.PI * 2 - (portrait ? 0.75 : 0.95)
          const k = smooth(Math.min(1, Math.max(0, (this.phaseT - 0.4) / (4 + (a1 - a0) * 1.5))))
          const d0 = this.endDist * (portrait ? 1.5 : 1)
          const d1 = portrait ? 330 : 172
          const d = (d0 + (d1 - d0) * k) * this.camZoom
          const ang = a0 + (a1 - a0) * k + Math.sin(this.phaseT * 0.12) * 0.05 * k + this.camYaw
          const y0 = Math.max(8, this.endLook.y + d0 * 0.2)
          const y1 = PAD1.railY + (portrait ? 60 : 30)
          this.camPos.set(this.endLook.x + Math.cos(ang) * d, y0 + (y1 - y0) * k + this.camPitch * 60, this.endLook.z + Math.sin(ang) * d)
          scratchA.set(PAD1.x - 108, PAD1.railY - 26, PAD1.z - (portrait ? 35 : 15))
          this.camLook.lerpVectors(this.endLook, scratchA, k)
        } else {
          const angle = this.endAngle + Math.sin(this.phaseT * 0.1) * 0.35 + this.camYaw
          this.placeEnd(this.camPos, angle)
          this.camLook.copy(this.endLook)
        }
      }
    }
    cam.position.copy(this.camPos)
    if (this.shake > 0.002) {
      const a = this.shake * 0.5
      cam.position.x += (Math.random() - 0.5) * a
      cam.position.y += (Math.random() - 0.5) * a
      cam.position.z += (Math.random() - 0.5) * a
      this.shake *= Math.pow(0.02, dt)
    }
    cam.lookAt(this.camLook)
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  private updateHud(dt: number) {
    this.hudT += dt
    if (this.hudT < 0.05) return
    this.hudT = 0
    const s = this.sim
    const h = this.hud
    const flying = this.phase === 'flying'
    const g = this.ship.group.position
    const px = flying ? pinX(s) : g.x
    const pz = flying ? pinZ(s) : g.z
    h.above = (flying ? pinY(s) : g.y + SHIP.catchY) - PAD1.railY
    h.vspeed = flying ? s.vy : this.phase === 'intro' ? -FLOP_SPEED : s.vy
    h.hspeed = Math.hypot(s.vx, s.vz)
    h.fuel = s.fuel / s.mode.fuelSeconds
    h.dist = Math.hypot(px - SWEET_X, pz - PAD1.z)
    h.tilt = flying ? tiltDeg(s) : 0
    h.burning = flying ? s.burning : this.plumePower > 0.5
    h.armsClosing = s.armsClosing
    h.throttle = flying ? s.throttle : 0
    h.along = px - SWEET_X
    h.across = pz - PAD1.z
    h.vAlong = s.vx
    h.vAcross = s.vz
    // Marker on the catch point.
    scratchA.set(SWEET_X, PAD1.railY, PAD1.z).project(this.camera)
    h.tOnScreen = scratchA.z < 1 && Math.abs(scratchA.x) < 0.94 && Math.abs(scratchA.y) < 0.9
    h.tx = Math.max(0.04, Math.min(0.96, scratchA.x * 0.5 + 0.5))
    h.ty = Math.max(0.06, Math.min(0.94, -scratchA.y * 0.5 + 0.5))
    // One line of coaching, the most urgent thing first.
    h.prompt = ''
    h.promptTone = 'info'
    if (flying && !s.outcome) {
      const net = s.mode.engineAccel * 0.93 - 9.81
      const need = (s.vy * s.vy) / (2 * net)
      const slack = h.above - 4 - need
      const toRing = -h.along
      const stop = (s.vx * s.vx) / (2 * 3)
      const back = this.touch ? 'pull the stick back' : 'hold ↓'
      const fwd = this.touch ? 'push the stick forward' : 'hold ↑'
      if (!s.burning && s.vy < -4 && slack < 20 + 0.5 * -s.vy) {
        h.prompt = 'BURN NOW'
        h.promptTone = 'warn'
      } else if (!s.burning && s.vy < -4 && slack < 150 && s.mode.coaching) {
        h.prompt = 'Falling. Get ready to BURN'
      } else if (s.mode.coaching) {
        if (s.burning && h.above > 70 && s.vy > -7) h.prompt = 'Braked too high: let go and fall'
        else if (s.vx > 3 && toRing < stop + 5 && s.gx > -0.1) {
          h.prompt = `Coming in fast: BURN and ${back} to brake`
          h.promptTone = 'warn'
        } else if (toRing > 9 && s.vx < 4 && h.above < 220) {
          h.prompt = `Short of the tower: BURN and ${fwd}`
          h.promptTone = 'warn'
        } else if (toRing < -5) {
          h.prompt = `Past the ring: BURN and ${back}`
          h.promptTone = 'warn'
        } else if (Math.abs(h.across) > 4 && h.above < 220) {
          h.prompt = h.across > 0 ? 'Off to the right: BURN and steer left' : 'Off to the left: BURN and steer right'
        } else if (h.dist <= 6 && h.above > 14 && h.hspeed < 4) h.prompt = 'Lined up. Let it down between the arms'
        else if (h.dist <= 6 && h.above <= 14 && h.above > 0) h.prompt = 'Easy. Let the pins settle on the rails'
      }
    }
        this.cb.onHud(h)
  }

  resize() {
    const w = this.canvas.clientWidth || 1
    const hgt = this.canvas.clientHeight || 1
    this.renderer.setSize(w, hgt, false)
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio())
      this.composer.setSize(w, hgt)
    }
    this.camera.aspect = w / hgt
    // Hold the horizontal field of view on portrait phones.
    this.camera.fov = w / hgt < 1 ? 70 : 48
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.raf = 0
    for (const d of this.bag) {
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
const qA = new THREE.Quaternion()
const qB = new THREE.Quaternion()
const X_AXIS = new THREE.Vector3(1, 0, 0)
const DOWN = new THREE.Vector3(0, -1, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)
/** Body frame to model frame: a quarter turn about the hull axis. */
const MODEL_TURN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
const windTmp = { x: 0, z: 0 }
/** How far round to the south the chase camera stands (radians). */
const SIDE_YAW = 0.22
