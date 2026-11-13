/**
 * Catch game shell: start screen, flight HUD, input and the end-of-flight
 * card. No three.js in React state: the engine owns the scene and the loop,
 * and writes the HUD straight into DOM refs so a flight never re-renders React.
 *
 * The full result layout (leaderboard, share image, the real-race panel) is
 * the next stage; this stage is the flight.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { conditionsFor } from '@/lib/catch/conditions'
import { MODES, type ModeId } from '@/lib/catch/modes'
import { DAMAGE_COST, type FlightResult } from '@/lib/catch/scoring'
import { missionDateLabel, missionNumberFor } from '@/lib/touchdown/mission'
import type { Callout, CatchEngine, HudState } from './engine'

type Screen = 'loading' | 'start' | 'flying' | 'ending' | 'result' | 'error'

const TONE: Record<Callout['tone'], string> = {
  info: 'text-white/85',
  warn: 'text-amber-300',
  good: 'text-emerald-300',
  bad: 'text-rose-300',
}

const STRUCTURE_NAME: Record<string, string> = {
  tower: 'Launch tower',
  arms: 'Catch arms',
  mount: 'Launch mount',
  tankfarm: 'Tank farm',
  tower2: 'Second tower',
  booster: 'The booster next door',
  mount2: 'Second launch mount',
  plant: 'Ground equipment',
  hopper: 'The old hopper',
  highway: 'Highway 4',
}

function headline(r: FlightResult): string {
  switch (r.outcome) {
    case 'caught':
      return r.closingSpeed < 3 ? 'Caught' : 'Caught, firmly'
    case 'splashdown':
      return 'Splashdown'
    case 'ditched':
      return 'Set down. No legs'
    case 'lost':
      return 'Lost the ship'
    default:
      return r.damage.length > 2 ? 'Starbase is on fire' : 'No catch'
  }
}

const fmt = (n: number) => n.toLocaleString('en-US')

export default function CatchGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<CatchEngine | null>(null)
  const [screen, setScreenState] = useState<Screen>('loading')
  const screenRef = useRef<Screen>('loading')
  const setScreen = useCallback((s: Screen) => {
    screenRef.current = s
    setScreenState(s)
  }, [])
  const [mode, setMode] = useState<ModeId>('easy')
  const modeRef = useRef<ModeId>('easy')
  const [isTouch, setIsTouch] = useState(false)
  const [wide, setWide] = useState(true)
  const [callout, setCallout] = useState<Callout | null>(null)
  const calloutTimer = useRef(0)
  const [result, setResult] = useState<FlightResult | null>(null)
  const [burnHint, setBurnHint] = useState(false)
  const burnedRef = useRef(false)
  const [keysFaded, setKeysFaded] = useState(false)
  const keysTimer = useRef(0)
  const [mission] = useState(() => missionNumberFor())
  const [conditions] = useState(() => conditionsFor(missionNumberFor()))

  // HUD refs: written by the engine at 20 Hz without a React render.
  const altRef = useRef<HTMLSpanElement>(null)
  const vsRef = useRef<HTMLSpanElement>(null)
  const hsRef = useRef<HTMLSpanElement>(null)
  const tiltRef = useRef<HTMLSpanElement>(null)
  const distRef = useRef<HTMLSpanElement>(null)
  const fuelRef = useRef<HTMLDivElement>(null)
  const fuelTextRef = useRef<HTMLSpanElement>(null)
  const promptRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<HTMLDivElement>(null)
  const armsRef = useRef<HTMLSpanElement>(null)
  const keyEls = useRef<Record<string, HTMLElement | null>>({})

  const writeHud = useCallback((h: HudState) => {
    const cfg = MODES[modeRef.current]
    if (altRef.current) altRef.current.textContent = Math.abs(h.above) < 100 ? h.above.toFixed(1) : h.above.toFixed(0)
    if (vsRef.current) {
      vsRef.current.textContent = h.vspeed.toFixed(1)
      const sink = -h.vspeed
      const danger = sink > cfg.pinLimit && h.above < 60
      const warn = sink > 3 + Math.max(0, h.above) * 0.2
      vsRef.current.style.color = danger ? '#ff6b6b' : warn ? '#ffd34d' : sink < 3 ? '#7dffb0' : '#fff'
    }
    if (hsRef.current) {
      hsRef.current.textContent = h.hspeed.toFixed(1)
      hsRef.current.style.color = h.above < 30 ? (h.hspeed > 4 ? '#ff6b6b' : h.hspeed > 1.5 ? '#ffd34d' : '#7dffb0') : '#fff'
    }
    if (distRef.current) distRef.current.textContent = h.dist < 100 ? h.dist.toFixed(1) : h.dist.toFixed(0)
    if (tiltRef.current) {
      tiltRef.current.textContent = h.tilt.toFixed(0)
      tiltRef.current.style.color = h.above < 20 && h.tilt > 8 ? '#ffd34d' : '#fff'
    }
    if (fuelRef.current) {
      fuelRef.current.style.transform = `scaleX(${Math.max(0, h.fuel)})`
      fuelRef.current.style.background = h.fuel < 0.15 ? '#ff6b6b' : h.fuel < 0.3 ? '#ffd34d' : '#7dffb0'
    }
    if (fuelTextRef.current) fuelTextRef.current.textContent = `${Math.round(h.fuel * cfg.fuelSeconds)} s`
    if (armsRef.current) {
      armsRef.current.textContent = h.armsClosing ? 'CLOSING' : 'OPEN'
      armsRef.current.style.color = h.armsClosing ? '#7dffb0' : '#fff'
    }
    if (promptRef.current) {
      promptRef.current.textContent = h.prompt
      promptRef.current.style.opacity = h.prompt ? '1' : '0'
      promptRef.current.style.color = h.promptTone === 'warn' ? '#ffd34d' : '#fff'
    }
    if (markerRef.current) {
      markerRef.current.style.left = `${h.tx * 100}%`
      markerRef.current.style.top = `${h.ty * 100}%`
      markerRef.current.dataset.off = h.tOnScreen ? '0' : '1'
      markerRef.current.style.opacity = h.dist < 14 && h.tOnScreen ? '0' : '1'
    }
  }, [])

  // --- Boot ------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
    setIsTouch(coarse)
    let ro: ResizeObserver | undefined
    ;(async () => {
      try {
        const { CatchEngine } = await import('./engine')
        if (cancelled) return
        const params = new URLSearchParams(window.location.search)
        const dev = process.env.NODE_ENV !== 'production'
        const engine = new CatchEngine(
          canvas,
          conditions,
          {
            onHud: writeHud,
            onCallout: (c) => {
              setCallout(c)
              window.clearTimeout(calloutTimer.current)
              calloutTimer.current = window.setTimeout(() => setCallout(null), 3200)
            },
            onOver: () => setScreen('ending'),
            onEnd: (r) => {
              setResult(r)
              setScreen('result')
            },
          },
          {},
          { mobile: coarse || window.innerWidth < 760, bloom: !(dev && params.get('bloom') === '0') }
        )
        engineRef.current = engine
        engine.autopilot = dev && params.get('autopilot') === '1'
        if (dev) {
          const cam = params.get('cam')
          if (cam) engine.setCamera(cam.split(',').map(Number))
          ;(window as any).__catch = engine
        }
        // The start screen is the same view whatever mode is chosen.
        engine.prepare(MODES.easy)
        engine.run()
        ro = new ResizeObserver(() => engine.resize())
        ro.observe(canvas)
        setScreen('start')
      } catch (e) {
        console.error(e)
        if (!cancelled) setScreen('error')
      }
    })()
    return () => {
      cancelled = true
      ro?.disconnect()
      window.clearTimeout(calloutTimer.current)
      window.clearTimeout(keysTimer.current)
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [conditions, setScreen, writeHud])

  const fly = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.prepare(MODES[modeRef.current])
    engine.start()
    setResult(null)
    setCallout(null)
    burnedRef.current = false
    setBurnHint(true)
    setKeysFaded(false)
    window.clearTimeout(keysTimer.current)
    keysTimer.current = window.setTimeout(() => setKeysFaded(true), 12000)
    setScreen('flying')
  }, [setScreen])

  const changeMode = useCallback((m: ModeId) => {
    modeRef.current = m
    setMode(m)
  }, [])

  // --- Input ------------------------------------------------------------------------
  const keys = useRef({ left: false, right: false, up: false, down: false, burn: false, arms: false })
  const touch = useRef({ x: 0, y: 0, burn: false, arms: false })
  const pushInput = useCallback(() => {
    for (const name of ['up', 'down', 'left', 'right', 'burn', 'arms'] as const) {
      const el = keyEls.current[name]
      if (el) el.dataset.on = keys.current[name] ? '1' : '0'
    }
    const engine = engineRef.current
    if (!engine || engine.autopilot) return
    const k = keys.current
    const t = touch.current
    const kx = (k.right ? 1 : 0) - (k.left ? 1 : 0)
    const ky = (k.up ? 1 : 0) - (k.down ? 1 : 0)
    const keyed = kx !== 0 || ky !== 0
    engine.setControl(keyed ? kx : t.x, keyed ? ky : t.y, k.burn || t.burn, k.arms || t.arms, !keyed && (t.x !== 0 || t.y !== 0))
    if ((k.burn || t.burn) && !burnedRef.current && screenRef.current === 'flying') {
      burnedRef.current = true
      setBurnHint(false)
    }
  }, [])

  useEffect(() => {
    const set = (e: KeyboardEvent, down: boolean) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (down && (e.metaKey || e.ctrlKey || e.altKey)) return
      // A focused button must not fire from Space or Enter in the middle of a flight.
      if (el && (el.tagName === 'BUTTON' || el.tagName === 'A') && screenRef.current !== 'flying' && (e.code === 'Space' || e.code === 'Enter')) return
      const k = keys.current
      let handled = true
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          k.left = down
          break
        case 'ArrowRight':
        case 'KeyD':
          k.right = down
          break
        case 'ArrowUp':
        case 'KeyW':
          k.up = down
          break
        case 'ArrowDown':
        case 'KeyS':
          k.down = down
          break
        case 'Space':
          k.burn = down
          if (down && !e.repeat && (screenRef.current === 'start' || screenRef.current === 'result')) fly()
          break
        case 'Enter':
          if (screenRef.current === 'flying') k.arms = down
          else if (down && !e.repeat && (screenRef.current === 'start' || screenRef.current === 'result')) fly()
          else handled = false
          break
        case 'KeyC':
          k.arms = down
          break
        case 'KeyR':
          if (down && !e.repeat && screenRef.current !== 'start' && screenRef.current !== 'loading') fly()
          break
        case 'KeyQ':
          if (down) engineRef.current?.orbit(-0.12, 0)
          break
        case 'KeyE':
          if (down) engineRef.current?.orbit(0.12, 0)
          break
        case 'KeyV':
          if (down && !e.repeat) engineRef.current?.resetCamera()
          break
        default:
          handled = false
      }
      if (handled) e.preventDefault()
      pushInput()
    }
    const down = (e: KeyboardEvent) => set(e, true)
    const up = (e: KeyboardEvent) => set(e, false)
    const clear = () => {
      keys.current = { left: false, right: false, up: false, down: false, burn: false, arms: false }
      touch.current = { x: 0, y: 0, burn: false, arms: false }
      pushInput()
    }
    const onVisibility = () => {
      if (document.hidden) clear()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [fly, pushInput])

  // Drag anywhere on the scene to look around; wheel or pinch to zoom.
  const look = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinch = useRef(0)
  const onLookDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    look.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    pinch.current = 0
  }
  const onLookMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const prev = look.current.get(e.pointerId)
    if (!prev) return
    const engine = engineRef.current
    if (look.current.size >= 2) {
      look.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const [a, b] = [...look.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch.current > 0 && d > 0) engine?.zoom(pinch.current / d)
      pinch.current = d
      return
    }
    engine?.orbit((e.clientX - prev.x) * 0.006, (e.clientY - prev.y) * 0.005)
    prev.x = e.clientX
    prev.y = e.clientY
  }
  const onLookUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    look.current.delete(e.pointerId)
    pinch.current = 0
  }
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      engineRef.current?.zoom(Math.exp(e.deltaY * 0.0012))
    }
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => canvas.removeEventListener('wheel', wheel)
  }, [])

  // Touch stick: appears where the thumb lands, anywhere on the left side.
  const stickRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const stickOrigin = useRef<{ id: number; x: number; y: number } | null>(null)
  const STICK_R = 56
  const onStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickOrigin.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    stickOrigin.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    if (stickRef.current) {
      stickRef.current.style.left = `${e.clientX - rect.left}px`
      stickRef.current.style.top = `${e.clientY - rect.top}px`
      stickRef.current.style.opacity = '1'
    }
  }
  const onStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const o = stickOrigin.current
    if (!o || o.id !== e.pointerId) return
    let dx = (e.clientX - o.x) / STICK_R
    let dy = (e.clientY - o.y) / STICK_R
    const m = Math.hypot(dx, dy)
    if (m > 1) {
      dx /= m
      dy /= m
    }
    touch.current.x = dx
    touch.current.y = -dy
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx * STICK_R}px, ${dy * STICK_R}px)`
    pushInput()
  }
  const onStickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const o = stickOrigin.current
    if (!o || o.id !== e.pointerId) return
    stickOrigin.current = null
    touch.current.x = 0
    touch.current.y = 0
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)'
    if (stickRef.current) stickRef.current.style.opacity = '0.45'
    pushInput()
  }
  const hold = (name: 'burn' | 'arms', on: boolean) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (on) e.currentTarget.setPointerCapture(e.pointerId)
    touch.current[name] = on
    pushInput()
  }
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  // The stick and buttons unmount when a flight ends; a thumb still down never
  // sends its pointer-up, so clear the touch state whenever we are not flying.
  useEffect(() => {
    if (screen === 'flying') return
    stickOrigin.current = null
    touch.current = { x: 0, y: 0, burn: false, arms: false }
    pushInput()
  }, [screen, pushInput])

  const flying = screen === 'flying'
  const pro = mode === 'pro'
  const keyCap =
    "flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-lg text-white/70 backdrop-blur transition data-[on='1']:border-emerald-300 data-[on='1']:bg-emerald-500 data-[on='1']:text-white"

  const modeToggle = (
    <div role="radiogroup" aria-label="Difficulty" className="inline-flex shrink-0 rounded-lg border border-white/15 bg-black/50 p-0.5">
      {(['easy', 'pro'] as ModeId[]).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => changeMode(m)}
          className={`rounded-md px-3 py-2 text-xs font-bold transition ${mode === m ? (m === 'pro' ? 'bg-amber-300 text-black' : 'bg-white text-black') : 'text-white/65'}`}
        >
          {MODES[m].label}
        </button>
      ))}
    </div>
  )

  const good = result?.outcome === 'caught'
  const parts: [string, number, number][] = result
    ? good
      ? [
          ['Catch', result.parts.caught, 250],
          ['Depth', result.parts.depth, 150],
          ['Center', result.parts.center, 100],
          ['Height', result.parts.height, 100],
          ['Soft', result.parts.soft, 250],
          ['Upright', result.parts.upright, 100],
          ['Fuel', result.parts.fuel, 150],
        ]
      : [
          ['Near miss', result.parts.near, 200],
          ['Soft landing', result.parts.water, 120],
        ]
    : []

  return (
    <div className="relative h-[100dvh] w-full select-none overflow-hidden bg-black text-white" style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        aria-label="Catch: a Starship tower catch game"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
        onDoubleClick={() => engineRef.current?.resetCamera()}
      />

      <div className="pointer-events-none absolute bottom-2 right-3 z-10 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
        Daily conditions #{mission} · {missionDateLabel(mission)}
      </div>

      {/* ------------------------------ HUD ------------------------------ */}
      <div className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 ${flying ? 'opacity-100' : 'invisible opacity-0'}`} aria-hidden={!flying}>
        <div className="absolute left-3 top-3 rounded-xl border border-white/10 bg-black/55 px-2.5 py-1.5 font-RobotoMono backdrop-blur-sm sm:px-3 sm:py-2">
          <HudRow label="TO ARMS" unit="m" valueRef={altRef} big />
          <HudRow label="V/S" unit="m/s" valueRef={vsRef} />
          <HudRow label="H/S" unit="m/s" valueRef={hsRef} />
          <HudRow label="TILT" unit="°" valueRef={tiltRef} />
        </div>

        <div className="absolute right-3 top-3 w-36 rounded-xl border border-white/10 bg-black/55 px-2.5 py-1.5 font-RobotoMono backdrop-blur-sm sm:w-48 sm:px-3 sm:py-2">
          <div className="flex items-baseline justify-between text-[10px] tracking-widest text-white/55">
            <span>FUEL</span>
            <span ref={fuelTextRef} className="text-xs text-white">
              {MODES[mode].fuelSeconds} s
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15">
            <div ref={fuelRef} className="h-full w-full origin-left rounded-full bg-emerald-300" />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between sm:mt-2">
            <span className="text-[10px] tracking-widest text-white/55">TO RING</span>
            <span className="text-sm text-white">
              <span ref={distRef}>0</span>
              <span className="ml-1 text-[10px] text-white/55">m</span>
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-[10px] tracking-widest text-white/55">ARMS</span>
            <span ref={armsRef} className="text-xs text-white">
              OPEN
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-[10px] tracking-widest text-white/55">WIND</span>
            <span className="text-xs text-white">
              {conditions.windFrom} {(conditions.windSpeed * MODES[mode].windFactor).toFixed(0)} m/s
            </span>
          </div>
          {pro && <div className="mt-1 text-[10px] tracking-widest text-amber-200/80">PRO</div>}
        </div>

        <div
          ref={promptRef}
          className="absolute left-1/2 top-[19%] max-w-[92%] -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/60 px-3 py-1.5 text-center text-sm font-bold tracking-wide opacity-0 backdrop-blur-sm transition-opacity sm:px-4 sm:py-2 sm:text-xl"
        />

        <div ref={markerRef} data-off="0" className="group absolute -translate-x-1/2 -translate-y-1/2 transition-opacity">
          <div className="h-7 w-7 rounded-full border-2 border-emerald-300/90 group-data-[off='1']:border-dashed group-data-[off='1']:border-amber-300" />
          <div className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-black/55 px-1 text-[10px] font-bold tracking-widest text-emerald-200 group-data-[off='1']:text-amber-200">
            ARMS
          </div>
        </div>
      </div>

      {/* Desktop: the keys, bottom-left, on the start screen and in flight. */}
      {wide && !isTouch && (screen === 'start' || flying) && (
        <div className={`pointer-events-none absolute bottom-5 left-5 z-20 flex items-end gap-5 transition-opacity duration-1000 ${flying && keysFaded ? 'opacity-0' : 'opacity-100'}`} aria-hidden>
          <div className="text-center">
            <div className="grid grid-cols-3 gap-1.5">
              <span />
              <span ref={(el) => void (keyEls.current.up = el)} className={keyCap}>
                ↑
              </span>
              <span />
              <span ref={(el) => void (keyEls.current.left = el)} className={keyCap}>
                ←
              </span>
              <span ref={(el) => void (keyEls.current.down = el)} className={keyCap}>
                ↓
              </span>
              <span ref={(el) => void (keyEls.current.right = el)} className={keyCap}>
                →
              </span>
            </div>
            <p className="mt-1.5 text-[10px] font-bold tracking-[0.3em] text-white/70">TILT</p>
          </div>
          <div className="text-center">
            <span
              ref={(el) => void (keyEls.current.burn = el)}
              className="flex h-11 w-44 items-center justify-center rounded-lg bg-gradient-to-b from-amber-400 to-orange-500 font-RobotoMono text-base font-extrabold tracking-[0.3em] text-white shadow-lg transition data-[on='1']:scale-95 data-[on='1']:brightness-125"
            >
              SPACE
            </span>
            <p className="mt-1.5 text-[10px] font-bold tracking-[0.3em] text-white/70">BURN</p>
          </div>
          {pro && (
            <div className="text-center">
              <span
                ref={(el) => void (keyEls.current.arms = el)}
                className="flex h-11 w-24 items-center justify-center rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-600 font-RobotoMono text-base font-extrabold tracking-[0.2em] text-white shadow-lg transition data-[on='1']:scale-95 data-[on='1']:brightness-125"
              >
                ENTER
              </span>
              <p className="mt-1.5 text-[10px] font-bold tracking-[0.3em] text-white/70">CLOSE ARMS</p>
            </div>
          )}
          <p className="mb-5 hidden rounded-lg bg-black/60 px-3 py-2 text-xs font-semibold leading-relaxed text-white/90 backdrop-blur md:block">
            WASD works too · drag to look
            <br />
            scroll to zoom · R to restart
          </p>
        </div>
      )}

      {/* First thing a desktop player sees in flight: how to fire the engines. */}
      {flying && burnHint && !isTouch && !engineRef.current?.autopilot && (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 z-20 flex justify-center px-4">
          <div className="animate-pulse rounded-2xl border-2 border-amber-300/80 bg-black/75 px-5 py-3 text-center shadow-2xl backdrop-blur">
            <p className="text-lg font-extrabold tracking-wide text-white sm:text-xl">
              Hold <kbd className="mx-1 inline-block rounded-lg border-2 border-white/70 bg-white/15 px-5 py-1 font-RobotoMono text-base sm:text-xl">SPACE</kbd> to fire the engines
            </p>
            <p className="mt-1.5 text-xs font-semibold text-white/75 sm:text-sm">Down arrow leans back to brake · the engines push along the ship</p>
          </div>
        </div>
      )}

      {/* Mission control ticker */}
      <div
        aria-live="polite"
        className={`pointer-events-none absolute left-1/2 z-10 w-[min(92%,34rem)] -translate-x-1/2 text-center transition-opacity duration-300 ${isTouch ? 'bottom-[38%]' : 'bottom-8'} ${
          callout && (flying || screen === 'ending') ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {callout && (
          <span className={`inline-block rounded-lg bg-black/60 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm sm:text-base ${TONE[callout.tone]}`}>
            <span className="mr-2 text-[10px] tracking-widest text-white/45">TOWER</span>
            {callout.text}
          </span>
        )}
      </div>

      {/* ------------------------------ Touch controls ------------------------------ */}
      {isTouch && flying && (
        <>
          <div className="absolute bottom-0 left-0 top-[30%] z-20 w-[58%]" onPointerDown={onStickDown} onPointerMove={onStickMove} onPointerUp={onStickUp} onPointerCancel={onStickUp}>
            <div ref={stickRef} className="pointer-events-none absolute h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35 bg-white/5 opacity-45" style={{ left: '34%', top: '68%' }}>
              <div ref={knobRef} className="absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 rounded-full bg-white/70" />
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-widest text-white/60">TILT</span>
            </div>
          </div>
          <button
            type="button"
            onPointerDown={hold('burn', true)}
            onPointerUp={hold('burn', false)}
            onPointerCancel={hold('burn', false)}
            onContextMenu={(e) => e.preventDefault()}
            className="absolute bottom-[9%] right-[6%] z-20 h-28 w-28 rounded-full border-2 border-amber-200/80 bg-amber-400/25 text-lg font-extrabold tracking-widest text-amber-100 active:bg-amber-400/60"
          >
            BURN
          </button>
          {pro && (
            <button
              type="button"
              onPointerDown={hold('arms', true)}
              onPointerUp={hold('arms', false)}
              onPointerCancel={hold('arms', false)}
              onContextMenu={(e) => e.preventDefault()}
              className="absolute bottom-[calc(9%+8.5rem)] right-[8%] z-20 h-20 w-20 rounded-full border-2 border-emerald-200/80 bg-emerald-400/25 text-xs font-extrabold tracking-widest text-emerald-100 active:bg-emerald-400/60"
            >
              ARMS
            </button>
          )}
        </>
      )}

      {/* ------------------------------ Start screen ------------------------------ */}
      {(screen === 'start' || screen === 'loading' || screen === 'error') && (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-gradient-to-t from-black/70 via-transparent to-transparent p-3 sm:items-center sm:justify-end sm:bg-none sm:p-4 sm:pr-[6vw]">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur-md sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55 sm:text-[11px]">Can you catch a Starship?</p>
            <h1 className="mt-0.5 font-heading text-3xl font-extrabold tracking-tight sm:mt-1 sm:text-5xl">CATCH</h1>
            <p className="mt-2 hidden text-sm leading-relaxed text-white/75 sm:block">
              The ship flips, relights and is yours. One landing burn: lean back to brake, slide it between the tower&apos;s arms at Starbase and set the pins on the rails, right in the ring. New wind every day.
            </p>
            <p className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80">
              Today: wind from the {conditions.windFrom} at {conditions.windSpeed.toFixed(0)} m/s
            </p>
            <div className="mt-3 flex items-stretch gap-2 sm:mt-4 sm:block">
              {modeToggle}
              <button
                type="button"
                disabled={screen !== 'start'}
                onClick={fly}
                className="flex-1 rounded-xl bg-white py-2.5 text-base font-extrabold tracking-wide text-black transition hover:bg-white/90 disabled:opacity-50 sm:mt-4 sm:w-full sm:py-3.5 sm:text-lg"
              >
                {screen === 'loading' ? 'Rolling out to the pad…' : screen === 'error' ? 'Could not start 3D' : 'CATCH IT'}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-white/55 sm:mt-3 sm:text-xs">
              {pro ? 'Pro: you steer by rate and close the arms yourself. Score ×1.25.' : 'Easy: the ship levels itself and the tower closes the arms.'}
              {isTouch ? ' Left thumb tilts. Right thumb holds BURN.' : ''}
            </p>
            {screen === 'error' && <p className="mt-2 text-xs text-rose-200">This browser could not start WebGL. Try another browser or device.</p>}
          </div>
        </div>
      )}

      {/* ------------------------------ End of flight ------------------------------ */}
      {screen === 'result' && result && (
        <div className="absolute inset-x-0 bottom-0 z-20 p-3 sm:inset-x-auto sm:bottom-auto sm:left-3 sm:top-3 sm:w-[22rem] sm:p-0">
          <div className="rounded-2xl border border-white/15 bg-black/55 p-4 shadow-2xl backdrop-blur-xl">
            <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${good ? 'text-emerald-300' : 'text-rose-300'}`}>
              {headline(result)}
              {result.mode === 'pro' ? ' · PRO' : ''}
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-heading text-5xl font-extrabold tabular-nums">{fmt(result.score)}</span>
              <span className="text-sm text-white/55">pts</span>
            </div>
            <p className="mt-1 text-xs text-white/60">
              {good
                ? `${result.closingSpeed.toFixed(1)} m/s onto the rails · ${Math.abs(result.along).toFixed(1)} m ${result.along > 0 ? 'deep' : 'shallow'} · ${Math.abs(result.across).toFixed(1)} m off center · arms took hold ${result.armMargin.toFixed(1)} m up`
                : `Closest the pins came to the rails: ${result.closest.toFixed(0)} m`}
            </p>
            <dl className={`mt-2.5 grid gap-1 text-center ${good ? 'grid-cols-4' : 'grid-cols-2'}`}>
              {parts.map(([label, value, max]) => (
                <div key={label} className="rounded-md bg-white/[0.06] px-1 py-1.5">
                  <dt className="text-[9px] uppercase tracking-wide text-white/50">{label}</dt>
                  <dd className="text-sm font-bold tabular-nums leading-tight">
                    {value}
                    <span className="text-[9px] font-normal text-white/35">/{max}</span>
                  </dd>
                </div>
              ))}
            </dl>
            {result.damage.length > 0 && (
              <ul className="mt-2 space-y-0.5 rounded-md bg-rose-400/15 px-2 py-1.5 text-xs font-semibold text-rose-100">
                {result.damage.map((id) => (
                  <li key={id} className="flex justify-between">
                    <span>{STRUCTURE_NAME[id] ?? id}</span>
                    <span className="tabular-nums">−{fmt(DAMAGE_COST[id])}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3">
              <button type="button" onClick={fly} className="flex-1 rounded-xl bg-white py-3 text-base font-extrabold text-black transition hover:bg-white/90">
                Catch Again
              </button>
              {modeToggle}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function HudRow({ label, unit, valueRef, big }: { label: string; unit: string; valueRef: React.RefObject<HTMLSpanElement>; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[10px] tracking-widest text-white/55">{label}</span>
      <span className={`tabular-nums ${big ? 'text-xl' : 'text-sm'}`}>
        <span ref={valueRef}>0</span>
        <span className="ml-1 text-[10px] text-white/55">{unit}</span>
      </span>
    </div>
  )
}
