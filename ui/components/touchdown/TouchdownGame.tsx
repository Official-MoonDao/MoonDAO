/**
 * Touchdown: the React shell around the engine. Client-only (loaded with
 * next/dynamic, ssr: false). React owns the screens; the HUD is written
 * straight to DOM refs so the game loop never waits on a render.
 */
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { trackTouchdown } from '@/lib/analytics/ga4'
import { missionDateLabel, missionNumberFor, missionSeed } from '@/lib/touchdown/mission'
import { MODES, type ModeId } from '@/lib/touchdown/modes'
import { isUpright, type FlightResult } from '@/lib/touchdown/scoring'
import { lateralOffsetFor } from '@/lib/touchdown/setup'
import {
  canvasToBlob,
  challengeQuery,
  cleanNickname,
  composeCard,
  copyImage,
  shareCard,
  SHARE_PATH,
  shareText,
  stampPhoto,
  xIntentUrl,
  type Challenge,
} from '@/lib/touchdown/share'
import { bestKey, loadPrefs, savePrefs, type TouchdownPrefs } from '@/lib/touchdown/storage'
import { generateTerrain } from '@/lib/touchdown/terrain'
import { bragLine, formatScore, outcomeHeadline, verdictFor } from '@/lib/touchdown/verdicts'
import { TouchdownAudio } from './audio'
import type { Callout, HudState, TouchdownEngine } from './engine'
import { TOUCHDOWN_GOAL_ID } from './RealRacePanel'

const RealRacePanel = dynamic(() => import('./RealRacePanel'), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5 text-[13px] text-white/50">
      Loading the real race…
    </div>
  ),
})

type Screen = 'loading' | 'start' | 'flying' | 'result' | 'error'

const TONE: Record<Callout['tone'], string> = {
  info: 'text-white/85',
  warn: 'text-amber-300',
  good: 'text-emerald-300',
  bad: 'text-rose-300',
}

function ModeToggle({ mode, onChange }: { mode: ModeId; onChange: (m: ModeId) => void }) {
  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Difficulty"
        className="inline-flex rounded-lg border border-white/15 bg-black/50 p-0.5"
      >
        {(['easy', 'pro'] as ModeId[]).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => onChange(m)}
            className={`rounded-md px-4 py-1.5 text-sm font-bold transition ${
              mode === m
                ? m === 'pro'
                  ? 'bg-amber-300 text-black'
                  : 'bg-white text-black'
                : 'text-white/65 hover:text-white'
            }`}
          >
            {MODES[m].label}
            {m === 'pro' ? ' ×1.25' : ''}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs leading-snug text-white/55">
        {mode === 'easy'
          ? 'Assisted tilt: the stick sets the lean and it levels itself when you let go.'
          : 'Apollo-style: the stick sets a rotation rate and the lander holds whatever attitude you leave it in.'}
      </p>
    </div>
  )
}

export default function TouchdownGame({ challenge: linked }: { challenge: Challenge | null }) {
  // A challenge link may replay an earlier day's map, never preview a future one.
  const [challenge] = useState(() => (linked && linked.mission <= missionNumberFor() ? linked : null))
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<TouchdownEngine | null>(null)
  const audioRef = useRef<TouchdownAudio | null>(null)
  const prefsRef = useRef<TouchdownPrefs | null>(null)
  const screenRef = useRef<Screen>('loading')
  const keys = useRef({ left: false, right: false, up: false, down: false, burn: false })
  const touch = useRef({ x: 0, y: 0, burn: false })
  const blobRef = useRef<Blob | null>(null)
  /** The frame behind the share card: the end shot, or the player's own photo. */
  const frameRef = useRef<HTMLCanvasElement | null>(null)
  const calloutTimer = useRef<number>()

  const [mission] = useState(() => challenge?.mission ?? missionNumberFor())
  const today = missionNumberFor()
  const [screen, setScreenState] = useState<Screen>('loading')
  const [mode, setMode] = useState<ModeId>('easy')
  const [muted, setMuted] = useState(false)
  const [nickname, setNickname] = useState('')
  const [isTouch, setIsTouch] = useState(false)
  const [callout, setCallout] = useState<Callout | null>(null)
  const [result, setResult] = useState<FlightResult | null>(null)
  const [verdict, setVerdict] = useState('')
  const [cardUrl, setCardUrl] = useState<string | null>(null)
  const [best, setBest] = useState<number | null>(null)
  const [newBest, setNewBest] = useState(false)
  const [shareNote, setShareNote] = useState('')
  const [showCard, setShowCard] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [modal, setModal] = useState<'card' | 'photo'>('card')
  const [hasFlown, setHasFlown] = useState(false)
  /** Desktop: show the "hold Space" hint until the engine is first fired this flight. */
  const [burnHint, setBurnHint] = useState(false)
  const burnedRef = useRef(false)

  // HUD refs
  const hudRef = useRef<HTMLDivElement>(null)
  const altRef = useRef<HTMLSpanElement>(null)
  const vsRef = useRef<HTMLSpanElement>(null)
  const hsRef = useRef<HTMLSpanElement>(null)
  const distRef = useRef<HTMLSpanElement>(null)
  const tiltRef = useRef<HTMLSpanElement>(null)
  const fuelRef = useRef<HTMLDivElement>(null)
  const fuelTextRef = useRef<HTMLSpanElement>(null)
  const promptRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<HTMLDivElement>(null)
  const baseRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)

  const setScreen = useCallback((s: Screen) => {
    screenRef.current = s
    setScreenState(s)
  }, [])

  const modeRef = useRef<ModeId>('easy')
  modeRef.current = mode
  const nicknameRef = useRef('')
  nicknameRef.current = nickname

  // --- HUD writer (called ~20 Hz by the engine, no React) -----------------------
  const writeHud = useCallback((h: HudState) => {
    const cfg = MODES[modeRef.current]
    if (altRef.current) altRef.current.textContent = h.alt < 100 ? h.alt.toFixed(1) : h.alt.toFixed(0)
    if (vsRef.current) {
      vsRef.current.textContent = h.vspeed.toFixed(1)
      const sink = -h.vspeed
      const danger = sink > cfg.legCollapseSpeed && h.alt < 60
      const warn = sink > 2.5 + h.alt * 0.11
      vsRef.current.style.color = danger ? '#ff6b6b' : warn ? '#ffd34d' : sink < 2 ? '#7dffb0' : '#fff'
    }
    if (hsRef.current) {
      hsRef.current.textContent = h.hspeed.toFixed(1)
      hsRef.current.style.color =
        h.alt < 25 ? (h.hspeed > 3 ? '#ff6b6b' : h.hspeed > 1.2 ? '#ffd34d' : '#7dffb0') : '#fff'
    }
    if (distRef.current) distRef.current.textContent = h.dist < 100 ? h.dist.toFixed(1) : h.dist.toFixed(0)
    if (tiltRef.current) {
      tiltRef.current.textContent = h.tilt.toFixed(0)
      tiltRef.current.style.color = h.alt < 15 && h.tilt > 12 ? '#ffd34d' : '#fff'
    }
    if (fuelRef.current) {
      fuelRef.current.style.transform = `scaleX(${Math.max(0, h.fuel)})`
      fuelRef.current.style.background = h.fuel < 0.15 ? '#ff6b6b' : h.fuel < 0.3 ? '#ffd34d' : '#7dffb0'
    }
    if (fuelTextRef.current) fuelTextRef.current.textContent = `${Math.round(h.fuel * cfg.fuelSeconds)} s`
    if (promptRef.current) {
      promptRef.current.textContent = h.prompt
      promptRef.current.style.opacity = h.prompt ? '1' : '0'
      promptRef.current.style.color = h.promptTone === 'warn' ? '#ffd34d' : '#fff'
    }
    if (markerRef.current) {
      markerRef.current.style.left = `${h.tx * 100}%`
      markerRef.current.style.top = `${h.ty * 100}%`
      markerRef.current.dataset.off = h.tOnScreen ? '0' : '1'
      markerRef.current.style.opacity = h.dist < 12 && h.tOnScreen ? '0' : '1'
    }
    if (baseRef.current) {
      baseRef.current.style.left = `${h.bx * 100}%`
      baseRef.current.style.top = `${h.by * 100}%`
      baseRef.current.style.opacity = h.bOnScreen && h.alt > 25 ? '1' : '0'
    }
  }, [])

  // --- End of flight ---------------------------------------------------------------
  const handleEnd = useCallback(
    async (r: FlightResult) => {
      const engine = engineRef.current
      const prefs = prefsRef.current
      if (!engine || !prefs) return
      prefs.flights += 1
      setHasFlown(true)
      const v = verdictFor(r, prefs.flights * 7 + mission * 3 + Math.round(r.distance))
      const key = bestKey(mission, r.mode)
      const prev = prefs.best[key] ?? 0
      const isBest = r.score > prev
      if (isBest) prefs.best[key] = r.score
      savePrefs(prefs)
      setResult(r)
      setVerdict(v)
      setBest(Math.max(prev, r.score))
      setNewBest(isBest && r.score > 0 && prev > 0)
      setShareNote('')
      setScreen('result')
      trackTouchdown('touchdown_end', {
        outcome: r.outcome,
        score: r.score,
        distance: Math.round(r.distance * 10) / 10,
        speed: Math.round(r.touchdownSpeed * 100) / 100,
        fuel: Math.round(r.fuelLeft * 100),
        mode: r.mode,
        mission,
      })
      try {
        const frame = engine.capture()
        frameRef.current = frame
        const card = composeCard({ frame, result: r, verdict: v, nickname: nicknameRef.current })
        const blob = await canvasToBlob(card)
        blobRef.current = blob
        setCardUrl((old) => {
          if (old) URL.revokeObjectURL(old)
          return blob ? URL.createObjectURL(blob) : null
        })
      } catch {
        blobRef.current = null
        setCardUrl(null)
      }
    },
    [mission, setScreen]
  )

  // --- Boot ------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    const prefs = loadPrefs()
    prefsRef.current = prefs
    setMode(prefs.mode)
    modeRef.current = prefs.mode
    setMuted(prefs.muted)
    setNickname(prefs.nickname)
    setHasFlown(prefs.flights > 0)
    setBest(prefs.best[bestKey(mission, prefs.mode)] ?? null)
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
    setIsTouch(coarse)
    const audio = new TouchdownAudio()
    audio.muted = prefs.muted
    audioRef.current = audio

    let ro: ResizeObserver | undefined
    ;(async () => {
      try {
        const { TouchdownEngine } = await import('./engine')
        if (cancelled) return
        const seed = missionSeed(mission)
        const terrain = generateTerrain(seed)
        const engine = new TouchdownEngine(
          canvas,
          terrain,
          {
            onHud: writeHud,
            onCallout: (c) => {
              setCallout(c)
              window.clearTimeout(calloutTimer.current)
              calloutTimer.current = window.setTimeout(() => setCallout(null), 3200)
            },
            onEnd: (r) => void handleEnd(r),
          },
          audio,
          { mobile: coarse || window.innerWidth < 760 }
        )
        engineRef.current = engine
        engine.autopilot =
          process.env.NODE_ENV !== 'production' &&
          new URLSearchParams(window.location.search).get('autopilot') === '1'
        if (engine.autopilot) (window as any).__touchdown = engine
        engine.prepare(MODES[prefs.mode], lateralOffsetFor(seed))
        engine.run()
        ro = new ResizeObserver(() => engine.resize())
        ro.observe(canvas)
        setScreen('start')
      } catch (err) {
        console.error('Touchdown failed to start', err)
        if (!cancelled) setScreen('error')
      }
    })()

    return () => {
      cancelled = true
      ro?.disconnect()
      window.clearTimeout(calloutTimer.current)
      engineRef.current?.dispose()
      engineRef.current = null
      audio.dispose()
      setCardUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return null
      })
      setPhotoUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return null
      })
    }
    // Boot once per mission; handlers are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission])

  // --- Actions ----------------------------------------------------------------------
  const fly = useCallback(
    (retry: boolean) => {
      const engine = engineRef.current
      if (!engine) return
      audioRef.current?.unlock()
      const m = modeRef.current
      engine.prepare(MODES[m], lateralOffsetFor(missionSeed(mission)))
      engine.start()
      setResult(null)
      setCallout(null)
      setShowCard(false)
      setLeaving(false)
      burnedRef.current = false
      setBurnHint(true)
      blobRef.current = null
      frameRef.current = null
      setCardUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return null
      })
      setPhotoUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return null
      })
      setScreen('flying')
      trackTouchdown(retry ? 'touchdown_retry' : 'touchdown_start', { mode: m, mission })
      if (retry) trackTouchdown('touchdown_start', { mode: m, mission })
    },
    [mission, setScreen]
  )

  const changeMode = useCallback(
    (m: ModeId) => {
      setMode(m)
      modeRef.current = m
      const prefs = prefsRef.current
      if (prefs) {
        prefs.mode = m
        savePrefs(prefs)
        setBest(prefs.best[bestKey(mission, m)] ?? null)
      }
      // On the start screen, re-park the lander at the new approach.
      if (screenRef.current === 'start') {
        engineRef.current?.prepare(MODES[m], lateralOffsetFor(missionSeed(mission)))
      }
    },
    [mission]
  )

  const toggleMute = useCallback(() => {
    setMuted((was) => {
      const next = !was
      audioRef.current?.setMuted(next)
      if (prefsRef.current) {
        prefsRef.current.muted = next
        savePrefs(prefsRef.current)
      }
      return next
    })
  }, [])

  const shareUrl = useCallback(() => {
    const r = result
    const q = r
      ? challengeQuery({ mission, score: r.score, mode: r.mode, nickname: nicknameRef.current })
      : ''
    return `${window.location.origin}${SHARE_PATH}${q ? `?${q}` : ''}`
  }, [mission, result])

  const share = useCallback(async () => {
    if (!result) return
    const text = shareText(result)
    const url = shareUrl()
    const method = await shareCard({ blob: blobRef.current, text, url, preferSheet: isTouch })
    if (method === 'cancelled') return
    trackTouchdown('touchdown_share', { method, mode: result.mode, outcome: result.outcome, mission })
    if (method === 'clipboard') {
      setShareNote('Image copied. Press Ctrl+V (⌘V) in the post to attach it.')
    } else if (method === 'fallback') {
      setModal('card')
      setShowCard(true)
      setShareNote('')
    } else {
      setShareNote('')
    }
  }, [isTouch, mission, result, shareUrl])

  const saveNickname = useCallback(
    async (raw: string) => {
      const nick = cleanNickname(raw)
      setNickname(nick)
      if (prefsRef.current) {
        prefsRef.current.nickname = nick
        savePrefs(prefsRef.current)
      }
      // Re-stamp the card with the new name.
      const engine = engineRef.current
      if (!engine || !result) return
      try {
        const frame = frameRef.current ?? engine.capture()
        const card = composeCard({ frame, result, verdict, nickname: nick })
        const blob = await canvasToBlob(card)
        blobRef.current = blob
        setCardUrl((old) => {
          if (old) URL.revokeObjectURL(old)
          return blob ? URL.createObjectURL(blob) : null
        })
      } catch {}
    },
    [mission, result, verdict]
  )

  /**
   * Take a photo of the scene exactly as the player has framed it. It is
   * copied to the clipboard, offered for saving, and becomes the image on the
   * share card.
   */
  const takePhoto = useCallback(async () => {
    const engine = engineRef.current
    if (!engine || !result) return
    let raw: HTMLCanvasElement
    try {
      raw = engine.photo()
    } catch {
      return
    }
    frameRef.current = raw
    const stamped = document.createElement('canvas')
    stamped.width = raw.width
    stamped.height = raw.height
    stamped.getContext('2d')!.drawImage(raw, 0, 0)
    stampPhoto(stamped)
    // Hand the clipboard a promise so the write still counts as part of this tap.
    const photoBlob = canvasToBlob(stamped)
    const copied = await copyImage(photoBlob)
    const blob = await photoBlob
    setPhotoUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return blob ? URL.createObjectURL(blob) : null
    })
    try {
      const card = composeCard({ frame: raw, result, verdict, nickname: nicknameRef.current })
      const cardBlob = await canvasToBlob(card)
      blobRef.current = cardBlob
      setCardUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return cardBlob ? URL.createObjectURL(cardBlob) : null
      })
    } catch {}
    setShareNote(
      copied
        ? 'Photo copied to your clipboard and set as your share image.'
        : 'Photo set as your share image. Save it from the preview.'
    )
    setModal('photo')
    setShowCard(true)
    trackTouchdown('touchdown_share', { method: 'photo', mode: result.mode, outcome: result.outcome, mission })
  }, [mission, result, verdict])

  // --- Input ------------------------------------------------------------------------
  const pushInput = useCallback(() => {
    const engine = engineRef.current
    if (!engine || engine.autopilot) return
    const k = keys.current
    const t = touch.current
    const kx = (k.right ? 1 : 0) - (k.left ? 1 : 0)
    const ky = (k.up ? 1 : 0) - (k.down ? 1 : 0)
    const keyed = kx !== 0 || ky !== 0
    engine.setControl(keyed ? kx : t.x, keyed ? ky : t.y, k.burn || t.burn, !keyed && (t.x !== 0 || t.y !== 0))
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
      if (
        el &&
        (el.tagName === 'BUTTON' || el.tagName === 'A') &&
        screenRef.current !== 'flying' &&
        (e.code === 'Space' || e.code === 'Enter')
      ) {
        return
      }
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
          if (down && !e.repeat) {
            if (screenRef.current === 'start') fly(false)
            else if (screenRef.current === 'result') fly(true)
          }
          break
        case 'Enter':
          if (down && !e.repeat) {
            if (screenRef.current === 'start') fly(false)
            else if (screenRef.current === 'result') fly(true)
            else handled = false
          }
          break
        case 'KeyR':
          if (down && !e.repeat && screenRef.current !== 'start' && screenRef.current !== 'loading') fly(true)
          break
        case 'KeyM':
          if (down && !e.repeat) toggleMute()
          break
        case 'KeyQ':
          if (down) engineRef.current?.orbit(-0.12, 0)
          break
        case 'KeyE':
          if (down) engineRef.current?.orbit(0.12, 0)
          break
        case 'KeyP':
          if (down && !e.repeat && screenRef.current === 'result') void takePhoto()
          break
        case 'KeyC':
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
    const blur = () => {
      keys.current = { left: false, right: false, up: false, down: false, burn: false }
      touch.current = { x: 0, y: 0, burn: false }
      pushInput()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [fly, pushInput, takePhoto, toggleMute])

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
  const burnDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    touch.current.burn = true
    pushInput()
  }
  // The stick and BURN unmount when a flight ends. If a thumb was still down,
  // its pointer-up never arrives, so clear the touch state whenever we are not
  // flying. Also silence and clear input when the tab is hidden.
  useEffect(() => {
    if (screen === 'flying') return
    stickOrigin.current = null
    touch.current = { x: 0, y: 0, burn: false }
    pushInput()
  }, [screen, pushInput])
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        keys.current = { left: false, right: false, up: false, down: false, burn: false }
        touch.current = { x: 0, y: 0, burn: false }
        stickOrigin.current = null
        pushInput()
        audioRef.current?.suspend()
      } else {
        audioRef.current?.resume()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pushInput])

  const burnUp = () => {
    touch.current.burn = false
    pushInput()
  }

  const flying = screen === 'flying'
  const upright = result ? isUpright(result.outcome) : false
  const beatChallenge = !!(challenge && result && result.score > challenge.score)
  const challenger = challenge?.nickname || 'a friend'

  return (
    <div
      ref={wrapRef}
      className="relative h-[100dvh] w-full select-none overflow-hidden bg-black text-white"
      style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        aria-label="Touchdown lunar landing game"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
        onDoubleClick={() => engineRef.current?.resetCamera()}
      />

      {/* The daily map number lives here and nowhere else. */}
      <div className="pointer-events-none absolute bottom-2 left-3 z-10 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
        Daily map #{mission} · {missionDateLabel(mission)}
      </div>

      {/* Mute: always reachable */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute sound' : 'Mute sound'}
        aria-pressed={muted}
        className="absolute right-3 top-3 z-30 rounded-lg border border-white/15 bg-black/55 px-2.5 py-1.5 text-xs font-semibold text-white/80 backdrop-blur transition hover:text-white"
      >
        {muted ? 'Sound off' : 'Sound on'}
      </button>

      {/* ------------------------------ HUD ------------------------------ */}
      <div
        ref={hudRef}
        className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 ${
          flying ? 'opacity-100' : 'invisible opacity-0'
        }`}
        aria-hidden={!flying}
      >
        <div className="absolute left-3 top-3 rounded-xl border border-white/10 bg-black/55 px-3 py-2 font-RobotoMono backdrop-blur-sm">
          <HudRow label="ALT" unit="m" valueRef={altRef} big />
          <HudRow label="V/S" unit="m/s" valueRef={vsRef} />
          <HudRow label="H/S" unit="m/s" valueRef={hsRef} />
          <HudRow label="TILT" unit="°" valueRef={tiltRef} />
        </div>

        <div className="absolute right-3 top-14 w-36 rounded-xl border border-white/10 bg-black/55 px-3 py-2 font-RobotoMono backdrop-blur-sm sm:w-44">
          <div className="flex items-baseline justify-between text-[10px] tracking-widest text-white/55">
            <span>FUEL</span>
            <span ref={fuelTextRef} className="text-xs text-white">
              {MODES[mode].fuelSeconds} s
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15">
            <div ref={fuelRef} className="h-full w-full origin-left rounded-full bg-emerald-300" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-[10px] tracking-widest text-white/55">TARGET</span>
            <span className="text-sm text-white">
              <span ref={distRef}>0</span>
              <span className="ml-1 text-[10px] text-white/55">m</span>
            </span>
          </div>
          {mode === 'pro' && <div className="mt-1 text-[10px] tracking-widest text-amber-200/80">PRO</div>}
        </div>

        <div
          ref={promptRef}
          className="absolute left-1/2 top-[19%] -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/60 px-4 py-2 text-center text-base font-bold tracking-wide opacity-0 backdrop-blur-sm transition-opacity sm:text-xl"
        />

        <div
          ref={markerRef}
          data-off="0"
          className="group absolute -translate-x-1/2 -translate-y-1/2 transition-opacity"
        >
          <div className="h-7 w-7 rounded-full border-2 border-emerald-300/90 group-data-[off='1']:border-dashed group-data-[off='1']:border-amber-300" />
          <div className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold tracking-widest text-emerald-200 group-data-[off='1']:text-amber-200">
            TARGET
          </div>
        </div>

        <div ref={baseRef} className="absolute -translate-x-1/2 -translate-y-full opacity-0 transition-opacity">
          <div className="whitespace-nowrap rounded border border-amber-200/40 bg-black/50 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.18em] text-amber-100">
            MOON BASE ZERO
          </div>
          <div className="mx-auto h-4 w-px bg-amber-200/50" />
        </div>
      </div>

      {/* First thing a desktop player sees in flight: how to fire the engine. */}
      {flying && burnHint && !isTouch && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-4">
          <div className="animate-pulse rounded-2xl border-2 border-amber-300/80 bg-black/75 px-5 py-3 text-center shadow-2xl backdrop-blur">
            <p className="text-lg font-extrabold tracking-wide text-white sm:text-xl">
              Hold{' '}
              <kbd className="mx-1 inline-block rounded-lg border-2 border-white/70 bg-white/15 px-5 py-1 font-RobotoMono text-base sm:text-xl">
                SPACE
              </kbd>{' '}
              to fire the engine
            </p>
            <p className="mt-1.5 text-xs font-semibold text-white/75 sm:text-sm">
              <kbd className="rounded border border-white/50 px-1.5 py-0.5 font-RobotoMono text-xs">W</kbd>{' '}
              <kbd className="rounded border border-white/50 px-1.5 py-0.5 font-RobotoMono text-xs">A</kbd>{' '}
              <kbd className="rounded border border-white/50 px-1.5 py-0.5 font-RobotoMono text-xs">S</kbd>{' '}
              <kbd className="rounded border border-white/50 px-1.5 py-0.5 font-RobotoMono text-xs">D</kbd> or arrow
              keys to tilt · tilt back and burn to brake
            </p>
          </div>
        </div>
      )}

      {/* Mission control ticker */}
      <div
        aria-live="polite"
        className={`pointer-events-none absolute left-1/2 z-10 w-[min(92%,34rem)] -translate-x-1/2 text-center transition-opacity duration-300 ${
          isTouch ? 'bottom-[38%]' : 'bottom-8'
        } ${callout && flying ? 'opacity-100' : 'opacity-0'}`}
      >
        {callout && (
          <span className={`inline-block rounded-lg bg-black/60 px-3 py-1.5 text-sm font-semibold backdrop-blur-sm sm:text-base ${TONE[callout.tone]}`}>
            <span className="mr-2 text-[10px] tracking-widest text-white/45">CAPCOM</span>
            {callout.text}
          </span>
        )}
      </div>

      {/* ------------------------------ Touch controls ------------------------------ */}
      {isTouch && flying && (
        <>
          <div
            className="absolute bottom-0 left-0 top-[30%] z-20 w-[58%]"
            onPointerDown={onStickDown}
            onPointerMove={onStickMove}
            onPointerUp={onStickUp}
            onPointerCancel={onStickUp}
          >
            <div
              ref={stickRef}
              className="pointer-events-none absolute h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35 bg-white/5 opacity-45"
              style={{ left: '34%', top: '68%' }}
            >
              <div
                ref={knobRef}
                className="absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 rounded-full bg-white/70"
              />
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-widest text-white/60">
                TILT
              </span>
            </div>
          </div>
          <button
            type="button"
            onPointerDown={burnDown}
            onPointerUp={burnUp}
            onPointerCancel={burnUp}
            onContextMenu={(e) => e.preventDefault()}
            className="absolute bottom-[9%] right-[6%] z-20 h-28 w-28 rounded-full border-2 border-amber-200/80 bg-amber-400/25 text-lg font-extrabold tracking-widest text-amber-100 active:bg-amber-400/60"
          >
            BURN
          </button>
        </>
      )}

      {/* ------------------------------ Start screen ------------------------------ */}
      {(screen === 'start' || screen === 'loading' || screen === 'error') && (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-gradient-to-t from-black/80 via-transparent to-transparent p-4 sm:items-center sm:justify-end sm:bg-none sm:pr-[6vw]">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/70 p-5 backdrop-blur-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
              {mission !== today ? 'Replaying an earlier landing site' : 'Land beside Moon Base Zero'}
            </p>
            <h1 className="mt-1 font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">TOUCHDOWN</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              Brake from orbit, thread the craters and boulders, and set it down soft, upright and on
              target. A new landing site every day.
            </p>
            {challenge && (
              <p className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-100">
                Beat {challenger}&apos;s {formatScore(challenge.score)}
                {challenge.mode === 'pro' ? ' (PRO)' : ''} on this exact landing site.
              </p>
            )}
            <div className="mt-4">
              <ModeToggle mode={mode} onChange={changeMode} />
            </div>
            <button
              type="button"
              disabled={screen !== 'start'}
              onClick={() => fly(false)}
              className="mt-4 w-full rounded-xl bg-white py-3.5 text-lg font-extrabold tracking-wide text-black transition hover:bg-white/90 disabled:opacity-50"
            >
              {screen === 'loading' ? 'Building the Moon…' : screen === 'error' ? 'Could not start 3D' : hasFlown ? 'LAND AGAIN' : 'LAND'}
            </button>
            {screen === 'error' && (
              <p className="mt-2 text-xs text-rose-200">
                This browser could not start WebGL. Try another browser or device.
              </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-white/55">
              {isTouch
                ? 'Left thumb: tilt stick. Right thumb: hold BURN. Drag the sky to look around.'
                : 'WASD or arrows to tilt · hold Space to burn · drag to look around · scroll to zoom · R to restart'}
              {best ? ` · Your best today: ${formatScore(best)}` : ''}
            </p>
            {mission !== today && (
              <a href={SHARE_PATH} className="mt-2 inline-block text-xs font-semibold text-sky-300 underline">
                Play today&apos;s landing site
              </a>
            )}
          </div>
        </div>
      )}

      {/* Photo button: out of the panel, in the corner of the scene. Phones get
          an icon at the top (the result sheet covers the bottom); desktop gets a
          labelled button bottom-left. */}
      {screen === 'result' && result && !leaving && !showCard && (
        <button
          type="button"
          onClick={() => void takePhoto()}
          aria-label="Take a photo"
          title="Take a photo (P). Drag the scene to frame it first. Copies to your clipboard and becomes your share image."
          className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-full border border-white/25 bg-black/60 p-3 text-sm font-bold text-white backdrop-blur transition hover:bg-black/80 sm:bottom-8 sm:top-auto sm:rounded-xl sm:px-4 sm:py-2.5"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
            <circle cx="12" cy="13.5" r="3.6" />
          </svg>
          <span className="hidden sm:inline">Take a photo</span>
        </button>
      )}

      {/* ------------------------------ Result screen ------------------------------ */}
      {screen === 'result' && result && leaving && (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 z-20 text-center text-sm font-semibold tracking-[0.2em] text-amber-100">
          ENTERING MOON BASE ZERO…
        </div>
      )}
      {screen === 'result' && result && !leaving && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex max-h-[66%] flex-col rounded-t-2xl border border-white/10 bg-black/80 backdrop-blur-md sm:bottom-3 sm:left-auto sm:right-3 sm:top-14 sm:max-h-none sm:w-[23.5rem] sm:rounded-2xl">
          <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ touchAction: 'pan-y' }}>
            {/* 1 + 2: verdict and score */}
            <div>
              <p
                className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
                  upright ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {outcomeHeadline(result)}
                {result.mode === 'pro' ? ' · PRO' : ''}
              </p>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="font-heading text-5xl font-extrabold tabular-nums">{formatScore(result.score)}</span>
                <span className="text-sm text-white/55">pts</span>
                {newBest && (
                  <span className="rounded bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                    New best
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[15px] font-semibold leading-snug">{verdict}</p>
              <p className="mt-1 text-xs text-white/55">{bragLine(result)}</p>
              {challenge && challenge.mission === mission && (
                <p className={`mt-1.5 text-xs font-semibold ${beatChallenge ? 'text-emerald-300' : 'text-amber-200'}`}>
                  {beatChallenge
                    ? `You beat ${challenger}'s ${formatScore(challenge.score)}.`
                    : `${challenger} still leads with ${formatScore(challenge.score)}.`}
                </p>
              )}
              {result.condition > 0 && result.condition < 1 && (
                <p className="mt-2 rounded-md bg-amber-300/10 px-2 py-1 text-xs font-semibold text-amber-100">
                  Lander condition: {result.conditionLabel} · points ×{result.condition}
                </p>
              )}
              {result.baseDamage > 0 && (
                <p className="mt-2 rounded-md bg-rose-400/15 px-2 py-1 text-xs font-semibold text-rose-100">
                  Moon Base Zero: {result.baseDamage} {result.baseDamage === 1 ? 'structure' : 'structures'} hit ·
                  −{formatScore(result.penalty)} pts
                </p>
              )}
              {result.condition > 0 && (
                <dl className="mt-2.5 grid grid-cols-5 gap-1 text-center">
                  {(
                    [
                      ['Soft', result.parts.softness, 400],
                      ['Accuracy', result.parts.accuracy, 400],
                      ['Target', result.parts.bullseye, 150],
                      ['Fuel', result.parts.fuel, 200],
                      ['Level', result.parts.level, 100],
                    ] as const
                  ).map(([label, value, max]) => (
                    <div key={label} className="rounded-md bg-white/[0.06] px-1 py-1.5">
                      <dt className="text-[9px] uppercase tracking-wide text-white/50">{label}</dt>
                      <dd className="text-sm font-bold tabular-nums">{value}</dd>
                      <dd className="text-[9px] text-white/35">/{max}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            {/* 3: share */}
            <div>
              <button
                type="button"
                onClick={() => void share()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 py-3 text-base font-extrabold text-black transition hover:bg-sky-300"
              >
                Share your {upright ? 'landing' : result.outcome === 'crashed' ? 'crater' : 'wreck'}
              </button>
              <p className="mt-1.5 text-xs leading-snug text-white/60">
                {isTouch
                  ? 'Opens your share sheet with the image attached.'
                  : 'Copies your image and opens X. In the post, press Ctrl+V (⌘V on Mac) to paste it in.'}
              </p>
              {shareNote && <p className="mt-1.5 text-xs font-semibold text-emerald-300">{shareNote}</p>}
              <div className="mt-2 flex items-center gap-2">
                {cardUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setModal('card')
                      setShowCard(true)
                    }}
                    className="shrink-0 overflow-hidden rounded-md border border-white/15"
                    aria-label="Preview share image"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cardUrl} alt="" className="h-12 w-[5.35rem] object-cover" />
                  </button>
                )}
                <label className="flex-1 text-[11px] text-white/50">
                  Name on the card (optional)
                  <input
                    type="text"
                    maxLength={16}
                    defaultValue={nickname}
                    onBlur={(e) => void saveNickname(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    }}
                    placeholder="Nickname"
                    autoComplete="off"
                    className="mt-0.5 w-full select-text rounded-md border border-white/15 bg-white/5 px-2 py-1 text-sm text-white placeholder:text-white/30 focus:border-sky-300 focus:outline-none"
                  />
                </label>
              </div>
            </div>

            {/* 4: the real race */}
            <RealRacePanel
              result={result}
              onMakeYourCall={() => trackTouchdown('touchdown_odds_click', { mode: result.mode, outcome: result.outcome })}
            />

            {/* 5: step into Moonbase */}
            <Link
              href={`/moonbase?race=${TOUCHDOWN_GOAL_ID}`}
              onClick={(e) => {
                trackTouchdown('touchdown_moonbase_click', { mode: result.mode, outcome: result.outcome })
                const engine = engineRef.current
                if (!engine || e.metaKey || e.ctrlKey) return
                // Hand the camera from the lander to the base, then open the sim.
                e.preventDefault()
                setLeaving(true)
                engine.flyToBase(() => void router.push(`/moonbase?race=${TOUCHDOWN_GOAL_ID}`))
              }}
              className="flex w-full items-center justify-center rounded-xl border border-white/20 bg-white/5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Explore Moon Base Zero →
            </Link>
          </div>

          {/* 6: fly again, always one tap away */}
          <div className="flex items-center gap-3 border-t border-white/10 p-3">
            <button
              type="button"
              onClick={() => fly(true)}
              className="flex-1 rounded-xl bg-white py-3 text-base font-extrabold text-black transition hover:bg-white/90"
            >
              Land Again
            </button>
            <div
              role="radiogroup"
              aria-label="Difficulty"
              className="inline-flex shrink-0 rounded-lg border border-white/15 bg-black/50 p-0.5"
            >
              {(['easy', 'pro'] as ModeId[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => changeMode(m)}
                  className={`rounded-md px-3 py-2 text-xs font-bold transition ${
                    mode === m ? (m === 'pro' ? 'bg-amber-300 text-black' : 'bg-white text-black') : 'text-white/65'
                  }`}
                >
                  {MODES[m].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Share fallback / preview: the image to save, plus the X link */}
      {showCard && (modal === 'photo' ? photoUrl : cardUrl) && result && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setShowCard(false)}
        >
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={(modal === 'photo' ? photoUrl : cardUrl) ?? ''}
              alt={modal === 'photo' ? 'Your Touchdown photo' : 'Your Touchdown result card'}
              className="max-h-[70vh] w-full select-auto rounded-xl border border-white/15 object-contain"
            />
            <p className="mt-2 text-center text-xs text-white/65">
              {isTouch ? 'Press and hold the image to save it' : 'Right-click the image to copy or save it'}, then
              attach it to your post.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <a
                href={(modal === 'photo' ? photoUrl : cardUrl) ?? ''}
                download={modal === 'photo' ? 'touchdown-photo.png' : 'touchdown.png'}
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold"
              >
                Save image
              </a>
              <a
                href={xIntentUrl(shareText(result), shareUrl())}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-sky-400 px-4 py-2 text-sm font-bold text-black"
              >
                Post on X
              </a>
              <button
                type="button"
                onClick={() => setShowCard(false)}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function HudRow({
  label,
  unit,
  valueRef,
  big,
}: {
  label: string
  unit: string
  valueRef: React.RefObject<HTMLSpanElement>
  big?: boolean
}) {
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
