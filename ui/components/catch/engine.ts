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
import { ARMS, PAD1, PAD2, SHIP, towerCentre } from '@/lib/catch/layout'
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
import { buildShip, type ShipModel } from './ship'
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
  setEngine?: (on: boolean) => void
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
const INTRO_T = 5.4
const FLOP_END = 2.6
const FLOP_SPEED = 58
/** Where on the opening the start screen is frozen: just after the flip. */
const IDLE_T = 4.9

export class CatchEngine {
  autopilot = false

  private renderer: THREE.WebGLRenderer
  private composer: EffectComposer | null = null
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(50, 1, 1.5, 90000)
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
  private ring!: THREE.Mesh
  private beam!: THREE.Mesh
  private flash = new THREE.PointLight(0xffb066, 0, 900, 1.4)
  private scorch!: THREE.Mesh
  /** Things that go off after the main blast. */
  private secondaries: { at: number; id: StructureId; done: boolean }[] = []
  private burning: { id: StructureId; until: number; next: number }[] = []
  private detached: THREE.Object3D[] = []
  private armDroop = 0
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
    this.scene.environmentIntensity = 0.75
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
    this.fx = new Effects(this.bag)
    this.scene.add(this.fx.mesh, this.flash)
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
    this.sun.intensity = 4.6 * s.sunStrength
    this.sun.castShadow = true
    const sh = this.sun.shadow
    const size = this.mobile ? 2048 : 4096
    sh.mapSize.set(size, size)
    sh.camera.left = -210
    sh.camera.right = 210
    sh.camera.top = 210
    sh.camera.bottom = -210
    sh.camera.near = 50
    sh.camera.far = 1400
    sh.bias = -0.0004
    sh.normalBias = 0.12
    // The shadow box sits on the pad: that is where shadows are read.
    const tc = towerCentre(PAD1)
    const f = v3().set(tc.x - 20, 60, tc.z)
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
    this.ring.position.set(PAD1.x + 3, PAD1.railY + 0.6, PAD1.z)
    const beamGeo = new THREE.CylinderGeometry(0.12, 0.12, 260, 8, 1, true)
    const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 0.9), transparent: true, opacity: 0.2, depthWrite: false, fog: false })
    this.beam = new THREE.Mesh(beamGeo, beamMat)
    this.beam.position.set(PAD1.x + 3, PAD1.railY + 130, PAD1.z)
    this.scene.add(this.ring, this.beam)

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
    this.armDroop = 0
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
    this.altMarks = [200, 100, 50, 20].filter((a) => a < mode.startAltitude - PAD1.railY)
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
    this.say('Ship is subsonic and belly-down. Stand by for the flip.', 'info')
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
    const lean = rad(this.mode.startPitchDeg)
    let phi: number
    if (t < FLOP_END) phi = -Math.PI / 2 + Math.sin(t * 2.3) * 0.03
    else if (t < FLOP_END + 1.7) phi = -Math.PI / 2 + (Math.PI / 2 + lean + 0.16) * smooth((t - FLOP_END) / 1.7)
    else phi = lean + 0.16 * (1 - smooth((t - FLOP_END - 1.7) / (T - FLOP_END - 1.7)))
    const roll = Math.sin(t * 1.7 + 1) * 0.02 * (1 - smooth((t - FLOP_END) / 1.2))
    qA.setFromAxisAngle(Z_AXIS, phi)
    qB.setFromAxisAngle(X_AXIS, roll)
    qA.multiply(qB)
    this.placeShip(x, y, s.pz, qA)
    this.plumePower = smooth((t - FLOP_END - 0.15) / 0.5)
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
  private setFlaps(spread: number) {
    const f = this.ship.flaps
    const fold = (1 - spread) * 0.9
    f.ar.rotation.y = -fold
    f.al.rotation.y = Math.PI + fold
    f.fr.rotation.y = rad(20) - fold * 0.8 + 0.5 * (1 - spread)
    f.fl.rotation.y = Math.PI - rad(20) + fold * 0.8 - 0.5 * (1 - spread)
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
      if (this.phaseT > FLOP_END && !this.saidFlip) {
        this.saidFlip = true
        this.say('Flip. Engines relit.', 'info')
      }
      if (this.phaseT >= INTRO_T) {
        this.phase = 'flying'
        this.phaseT = 0
        this.say(this.mode.coaching ? 'You have the ship. Hold BURN to slow down.' : 'Pro approach. You have the ship and the arms.', 'warn')
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
      this.audio.setEngine?.(sim.burning)
      this.plumePower += ((sim.burning ? 1 : 0) - this.plumePower) * Math.min(1, dt * 14)
      if (!sim.outcome) this.flightCallouts()
      if (!this.exploded) this.syncShip()
    }

    this.syncArms(dt)
    this.updateEffects(dt * Math.max(this.timeScale, 0.3))
    this.updateCamera(dt)
    this.updateHud(dt)

    // Plume, glow and the light the engines throw.
    const p = this.exploded ? 0 : this.plumePower
    this.ship.plumeMat.uniforms.uTime.value = this.clock
    this.ship.plumeMat.uniforms.uPower.value = p
    this.ship.plume.visible = p > 0.02
    this.ship.engineGlow.emissiveIntensity = 2.6 * p
    this.ship.light.intensity = 2500 * p
    this.ground.time.value = this.clock
    if (this.flash.intensity > 1) this.flash.intensity *= Math.pow(0.0006, dt)
    else this.flash.intensity = 0
    const blink = this.clock % 1.8 < 0.3
    for (const b of this.base.beacons) b.visible = blink
    const guide = this.phase === 'flying' || this.phase === 'intro'
    ;(this.ring.material as THREE.MeshBasicMaterial).opacity = guide ? 0.55 + 0.3 * Math.sin(this.clock * 4) : 0
    ;(this.beam.material as THREE.MeshBasicMaterial).opacity = guide ? 0.2 : 0

    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }

  private syncShip() {
    const s = this.sim
    qA.set(s.qx, s.qy, s.qz, s.qw)
    this.placeShip(s.px, s.py, s.pz, qA)
    this.setFlaps(0)
  }

  private syncArms(dt: number) {
    const s = this.sim
    const p = this.base.pad1
    // The pad group is turned so its right-hand arm is the north one.
    p.armR.rotation.y = -s.armN
    p.armL.rotation.y = s.armS
    if (this.armDroop > 0) {
      // A wrecked arm sags on its pivot.
      this.armDroop = Math.min(1, this.armDroop + dt * 0.7)
      p.armL.rotation.x = -0.5 * smooth(this.armDroop)
      p.armR.rotation.x = -0.16 * smooth(this.armDroop)
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
    this.audio.setEngine?.(false)
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
      this.say(this.result.closingSpeed < 3 ? 'Catch. The tower has the ship.' : 'Caught. That one rang the tower.', 'good')
      this.endLook.set(PAD1.x + 6, PAD1.railY - 8, PAD1.z)
      // Sunlit side of the ship, with the Gulf behind the tower.
      this.endAngle = Math.PI + (this.sunDir.z >= 0 ? -0.75 : 0.75)
      this.endDist = 132
    } else if (o === 'splashdown') {
      this.syncShip()
      this.audio.splash?.()
      this.fx.splash(s.px, s.pz, 1.4)
      this.say('Splashdown. Soft, wet, and nowhere near the tower.', 'warn')
      this.endLook.set(s.px, 16, s.pz)
      this.endAngle = Math.PI + 0.5
      this.endDist = 130
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

  /** Break the ship up where it is: fireball, thrown parts, and whatever the blast reached. */
  private explode() {
    const s = this.sim
    const r = this.result!
    this.syncShip()
    this.exploded = true
    this.slowUntil = this.clock + 1.3
    this.shake = 5
    const sea = r.cause === 'sea'
    const bx = s.px
    const by = Math.max(4, s.py - COM_Y * 0.5)
    const bz = s.pz
    const size = r.outcome === 'ditched' ? 0.7 : 0.8 + 0.6 * r.fuelLeft
    this.fx.fireball(bx, by, bz, size * 1.25)
    if (sea) this.fx.splash(bx, bz, 2)
    this.audio.explosion?.(size)
    this.flash.position.set(bx, by + 20, bz)
    this.flash.intensity = 3e5
    if (!sea && by < 60) {
      this.scorch.position.set(bx, 0.3, bz)
      this.scorch.scale.set(150 * size, 1, 150 * size)
      this.scorch.visible = true
    }
    // The ship comes apart into its real pieces.
    const g = this.ship.group
    g.updateMatrixWorld(true)
    this.ship.plume.visible = false
    this.ship.light.intensity = 0
    const rnd = () => Math.random()
    for (const part of this.ship.parts) {
      part.getWorldPosition(scratchA)
      part.getWorldQuaternion(qA)
      const radius = part.name.startsWith('hull') ? 5 : part.name === 'engines' ? 3 : 2
      this.scene.add(part)
      part.position.copy(scratchA)
      part.quaternion.copy(qA)
      this.detached.push(part)
      const out = scratchB.set(rnd() - 0.5, 0, rnd() - 0.5).normalize()
      const sp = 14 + rnd() * 30
      this.fx.debris.push({
        obj: part,
        v: new THREE.Vector3(s.vx * 0.3 + out.x * sp, 14 + rnd() * 30, s.vz * 0.3 + out.z * sp),
        w: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(3),
        r: radius,
        rest: false,
        trail: 0,
        wet: false,
      })
    }
    g.visible = false
    // Whatever the blast reached goes up in turn.
    let delay = 0.35
    for (const id of r.damage) {
      this.secondaries.push({ at: this.clock + delay, id, done: false })
      delay += 0.35 + Math.random() * 0.4
    }
    this.say(this.crashLine(r), 'bad')
    this.endLook.set(bx, Math.min(60, by + 25), bz)
    // Pull back the way the camera already was, swung a little to one side.
    this.endAngle = Math.atan2(this.camera.position.z - bz, this.camera.position.x - bx) + 0.5
    this.endDist = 270
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
      if (x.id === 'arms' || x.id === 'tower') this.armDroop = Math.max(this.armDroop, 0.01)
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
    const portrait = this.camera.aspect < 1
    // How far out the ship still is: wide on the way in, tight and to one side at the arms.
    const far = Math.min(1, Math.hypot(mid.x - PAD1.x, mid.z - PAD1.z) / 380)
    const close = 1 - Math.min(1, Math.max(0, (mid.y - PAD1.railY - 10) / 120))
    const back = (74 + 46 * far) * (portrait ? 1.45 : 1) * this.camZoom
    const pitch = Math.max(-0.2, Math.min(1.4, 0.2 + 0.1 * far + 0.1 * close + this.camPitch))
    // Swing a little to the south as it closes on the arms, so the gap to the tower reads.
    const yaw = this.camYaw + 0.34 * close * (1 - far)
    const cy = Math.cos(yaw)
    const sy = Math.sin(yaw)
    const want = scratchB.set(mid.x - Math.cos(pitch) * cy * back, mid.y + Math.sin(pitch) * back, mid.z + Math.cos(pitch) * sy * back)
    if (want.y < 6) want.y = 6
    // Look past the ship toward the arms, so the tower stays in frame.
    const look = scratchC.set(PAD1.x + 8, PAD1.railY, PAD1.z).sub(mid).multiplyScalar(0.22 + 0.2 * far)
    if (look.length() > 90) look.setLength(90)
    look.add(mid)
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
      // Start screen: the ship large on the left, the tower and its arms beyond, the Gulf behind them.
      const mid = this.shipMid(scratchA)
      const sweep = Math.sin(this.clock * 0.1)
      const portrait = cam.aspect < 1
      if (portrait) this.camPos.set(mid.x - 150 + sweep * 4, mid.y + 44, mid.z + 52)
      else this.camPos.set(mid.x - 112 + sweep * 4, mid.y + 26 + Math.sin(this.clock * 0.07) * 1.5, mid.z + 70)
      this.camLook.set(mid.x + 300, mid.y - 150, mid.z - 46)
    } else if (this.phase === 'intro') {
      // Open on a low side view of the fall, then swing in behind for the hand-over.
      const mid = this.shipMid(scratchA).clone()
      const u = smooth((this.phaseT - 1.6) / (INTRO_T - 1.9))
      const portrait = cam.aspect < 1
      const side = v3().set(mid.x - 58, mid.y - 22, mid.z + (portrait ? 110 : 84))
      this.chase(1, true)
      this.camPos.lerpVectors(side, this.camPos, u)
      this.camLook.lerpVectors(mid, this.camLook, u)
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
        const wait = this.exploded ? 3.4 : 1.4
        if (u >= 1 && this.phaseT > T + wait && !this.endFired) {
          this.endFired = true
          this.phase = 'result'
          this.phaseT = 0
          if (this.result) this.cb.onEnd(this.result)
        }
      } else {
        const angle = this.endAngle + Math.sin(this.phaseT * 0.1) * 0.35 + this.camYaw
        this.placeEnd(this.camPos, angle)
        this.camLook.copy(this.endLook)
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
    h.dist = Math.hypot(px - (PAD1.x + 3), pz - PAD1.z)
    h.tilt = flying ? tiltDeg(s) : 0
    h.burning = flying ? s.burning : this.plumePower > 0.5
    h.armsClosing = s.armsClosing
    // Marker on the catch point.
    scratchA.set(PAD1.x + 3, PAD1.railY, PAD1.z).project(this.camera)
    h.tOnScreen = scratchA.z < 1 && Math.abs(scratchA.x) < 0.94 && Math.abs(scratchA.y) < 0.9
    h.tx = Math.max(0.04, Math.min(0.96, scratchA.x * 0.5 + 0.5))
    h.ty = Math.max(0.06, Math.min(0.94, -scratchA.y * 0.5 + 0.5))
    // One line of coaching, the most urgent thing first.
    h.prompt = ''
    h.promptTone = 'info'
    if (flying && !s.outcome) {
      const need = (s.vy * s.vy) / (2 * (s.mode.engineAccel - 9.81))
      if (s.vy < -6 && h.above - need < 25 && !s.burning) {
        h.prompt = 'BURN NOW'
        h.promptTone = 'warn'
      } else if (s.mode.coaching) {
        if (h.hspeed > 12 && h.dist < 170) {
          h.prompt = 'Tilt back and BURN to brake'
          h.promptTone = 'warn'
        } else if (h.dist > 12 && h.above < 30) h.prompt = 'Line up over the ring before you come down'
        else if (h.dist <= 12 && h.above > 12 && h.hspeed < 4) h.prompt = 'Lower it between the arms'
        else if (h.dist <= 12 && h.above <= 12 && h.above > 0) h.prompt = 'Easy. Let the pins settle on the rails'
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
const Z_AXIS = new THREE.Vector3(0, 0, 1)
/** Body frame to model frame: a quarter turn about the hull axis. */
const MODEL_TURN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
const windTmp = { x: 0, z: 0 }
