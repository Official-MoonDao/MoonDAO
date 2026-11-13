/**
 * Catch game shell: start screen, flight HUD, input and the end-of-flight
 * card. No three.js in React state: the engine owns the scene and the loop,
 * and writes the HUD straight into DOM refs so a flight never re-renders React.
 *
 * After the flight: the score card with name save, today's leaderboard, the
 * share image and photo, the real-race panel for Starship HLS, and the ways on.
 */
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { trackCatch } from '@/lib/analytics/ga4'
import { conditionsFor } from '@/lib/catch/conditions'
import { cleanBoardName, type CatchBoardResponse } from '@/lib/catch/leaderboard'
import { MODES, type ModeId } from '@/lib/catch/modes'
import { DAMAGE_COST, type FlightResult } from '@/lib/catch/scoring'
import {
  SHARE_PATH,
  canvasToBlob,
  challengeQuery,
  cleanNickname,
  composeCard,
  copyImage,
  shareCard,
  shareText,
  stampPhoto,
  xIntentUrl,
  type Challenge,
} from '@/lib/catch/share'
import { bestKey, loadPrefs, savePrefs, type CatchPrefs } from '@/lib/catch/storage'
import { bragLine, formatScore, outcomeHeadline, verdictFor } from '@/lib/catch/verdicts'
import { missionDateLabel, missionNumberFor } from '@/lib/touchdown/mission'
import { TOUCHDOWN_RACE_GOAL_ID } from '@/components/touchdown/TouchdownTeaser'
import CatchLeaderboard from './CatchLeaderboard'
import { CatchSound } from './audio'
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

// The odds panel pulls in the chain reader: load it only when a flight has ended.
const CatchRacePanel = dynamic(() => import('./CatchRacePanel'), {
  ssr: false,
  loading: () => <div className="h-44 rounded-xl border border-white/10 bg-white/[0.04]" />,
})

const fmt = (n: number) => n.toLocaleString('en-US')

export default function CatchGame({ challenge = null }: { challenge?: Challenge | null }) {
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
  const audioRef = useRef<CatchSound | null>(null)
  const [muted, setMuted] = useState(false)
  const toggleMute = useCallback(() => {
    setMuted((was) => {
      const next = !was
      if (audioRef.current) audioRef.current.muted = next
      try {
        window.localStorage.setItem('catch:muted', next ? '1' : '0')
      } catch {}
      return next
    })
  }, [])
  const burnedRef = useRef(false)
  const [keysFaded, setKeysFaded] = useState(false)
  const keysTimer = useRef(0)
  const [mission] = useState(() => missionNumberFor())
  const [conditions] = useState(() => conditionsFor(missionNumberFor()))

  // --- After the flight ---------------------------------------------------------
  const prefsRef = useRef<CatchPrefs | null>(null)
  const [nickname, setNickname] = useState('')
  const nicknameRef = useRef('')
  const [verdict, setVerdict] = useState('')
  const [best, setBest] = useState<number | null>(null)
  const [newBest, setNewBest] = useState(false)
  const [cardUrl, setCardUrl] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [modal, setModal] = useState<'card' | 'photo'>('card')
  const [showCard, setShowCard] = useState(false)
  const [shareNote, setShareNote] = useState('')
  /** The frame behind the share card: the end shot, or the player's own photo. */
  const frameRef = useRef<HTMLCanvasElement | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const [board, setBoard] = useState<CatchBoardResponse | null>(null)
  const [wouldRank, setWouldRank] = useState<number | null>(null)
  const [savedRank, setSavedRank] = useState<number | null>(null)
  const savedRankRef = useRef<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [boardNote, setBoardNote] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  /** Wide enough for a panel either side of the scene. */
  const [desk, setDesk] = useState(true)
  const flownByBotRef = useRef(false)
  /** Which flight the result screen belongs to: a save or a card that finishes late is dropped. */
  const flightId = useRef(0)
  const stampSeq = useRef(0)
  const cardUrlRef = useRef<string | null>(null)
  const photoUrlRef = useRef<string | null>(null)
  cardUrlRef.current = cardUrl
  photoUrlRef.current = photoUrl
  useEffect(
    () => () => {
      if (cardUrlRef.current) URL.revokeObjectURL(cardUrlRef.current)
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    },
    []
  )

  useEffect(() => {
    const prefs = loadPrefs()
    prefsRef.current = prefs
    setNickname(prefs.nickname)
    nicknameRef.current = prefs.nickname
    setBest(prefs.best[bestKey(mission, modeRef.current)] ?? null)
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setDesk(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [mission])

  /** Put the score, verdict, name and rank over a frame and make it the share image. */
  const stampCard = useCallback(async (r: FlightResult, v: string, name: string, rank: number | null, frame?: HTMLCanvasElement) => {
    // Only the newest request may set the card: a slower, older one is dropped.
    const seq = ++stampSeq.current
    try {
      const f = frame ?? frameRef.current ?? engineRef.current?.capture()
      if (!f) return
      frameRef.current = f
      const blob = await canvasToBlob(composeCard({ frame: f, result: r, verdict: v, nickname: name, rank: rank ?? undefined }))
      if (seq !== stampSeq.current) return
      blobRef.current = blob
      setCardUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return blob ? URL.createObjectURL(blob) : null
      })
    } catch {
      if (seq !== stampSeq.current) return
      blobRef.current = null
      setCardUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return null
      })
    }
  }, [])

  const handleEnd = useCallback(
    (r: FlightResult) => {
      const prefs = prefsRef.current ?? loadPrefs()
      prefsRef.current = prefs
      const bot = !!engineRef.current?.autopilot
      flownByBotRef.current = bot
      prefs.flights += 1
      const v = verdictFor(r, prefs.flights * 7 + mission * 3 + Math.round(r.closest))
      const key = bestKey(mission, r.mode)
      const prev = prefs.best[key] ?? 0
      const isBest = !bot && r.score > prev
      if (isBest) prefs.best[key] = r.score
      savePrefs(prefs)
      setResult(r)
      setVerdict(v)
      setBest(Math.max(prev, bot ? 0 : r.score) || null)
      setNewBest(isBest && r.score > 0 && prev > 0)
      setShareNote('')
      setBoardNote('')
      setWouldRank(null)
      setSavedRank(null)
      savedRankRef.current = null
      setScreen('result')
      trackCatch('catch_end', {
        outcome: r.hard ? 'hard_catch' : r.outcome,
        score: r.score,
        speed: Math.round(r.closingSpeed * 100) / 100,
        fuel: Math.round(r.fuelLeft * 100),
        damage: r.damage.length,
        mode: r.mode,
        mission,
      })
      frameRef.current = null
      void stampCard(r, v, nicknameRef.current, null)
    },
    [mission, setScreen, stampCard]
  )
  const handleEndRef = useRef(handleEnd)
  handleEndRef.current = handleEnd

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
  const guideShipRef = useRef<SVGCircleElement>(null)
  const guideVelRef = useRef<SVGLineElement>(null)
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
    // Top view: where the ship is over the arms, and which way it is drifting.
    if (guideShipRef.current && guideVelRef.current) {
      const gx = Math.max(-22, Math.min(22, h.across))
      const gy = Math.max(-30, Math.min(44, -h.along))
      const ok = h.dist < 2.5
      guideShipRef.current.setAttribute('cx', gx.toFixed(1))
      guideShipRef.current.setAttribute('cy', gy.toFixed(1))
      guideShipRef.current.setAttribute('fill', ok ? '#7dffb0' : h.dist < 7 ? '#ffd34d' : '#ffffff')
      guideVelRef.current.setAttribute('x1', gx.toFixed(1))
      guideVelRef.current.setAttribute('y1', gy.toFixed(1))
      guideVelRef.current.setAttribute('x2', (gx + h.vAcross * 1.6).toFixed(1))
      guideVelRef.current.setAttribute('y2', (gy - h.vAlong * 1.6).toFixed(1))
    }
  }, [])

  // --- Boot ------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
    setIsTouch(coarse)
    const audio = new CatchSound()
    try {
      audio.muted = window.localStorage.getItem('catch:muted') === '1'
    } catch {}
    setMuted(audio.muted)
    audioRef.current = audio
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
            onEnd: (r) => handleEndRef.current(r),
          },
          audio,
          { mobile: coarse || window.innerWidth < 760, bloom: !(dev && params.get('bloom') === '0') }
        )
        engineRef.current = engine
        engine.touch = coarse
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
      audio.dispose()
      audioRef.current = null
      engineRef.current = null
    }
  }, [conditions, setScreen, writeHud])

  const fly = useCallback((retry?: unknown) => {
    const engine = engineRef.current
    if (!engine) return
    const m = modeRef.current
    trackCatch(retry === true ? 'catch_retry' : 'catch_start', { mode: m, mission })
    if (retry === true) trackCatch('catch_start', { mode: m, mission })
    // A new flight: nothing from the last one (a save in flight, its card, its photo) may show on this one.
    flightId.current++
    stampSeq.current++
    setSaving(false)
    blobRef.current = null
    frameRef.current = null
    setCardUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    setShowCard(false)
    setPhotoUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    // A tap or key press is the only moment a browser lets sound start.
    audioRef.current?.unlock()
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
  }, [mission, setScreen])

  const changeMode = useCallback(
    (m: ModeId) => {
      modeRef.current = m
      setMode(m)
      setBest(prefsRef.current?.best[bestKey(mission, m)] ?? null)
    },
    [mission]
  )

  // --- Sharing ------------------------------------------------------------------
  const shareUrl = useCallback(() => {
    const q = result ? challengeQuery({ mission, score: result.score, mode: result.mode, nickname: nicknameRef.current }) : ''
    return `${window.location.origin}${SHARE_PATH}${q ? `?${q}` : ''}`
  }, [mission, result])

  const share = useCallback(async () => {
    if (!result) return
    const method = await shareCard({ blob: blobRef.current, text: shareText(result, savedRankRef.current ?? undefined), url: shareUrl(), preferSheet: isTouch })
    if (method === 'cancelled') return
    trackCatch('catch_share', { method, mode: result.mode, outcome: result.outcome, mission })
    if (method === 'clipboard') setShareNote('Image copied. Press Ctrl+V (⌘V) in the post to attach it.')
    else if (method === 'fallback') {
      setModal('card')
      setShowCard(true)
      setShareNote('')
    } else setShareNote('')
  }, [isTouch, mission, result, shareUrl])

  /**
   * Take a photo of the scene exactly as the player has framed it. It is copied
   * to the clipboard, offered for saving, and becomes the image on the share card.
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
    await stampCard(result, verdict, nicknameRef.current, savedRankRef.current, raw)
    setShareNote(copied ? 'Photo copied to your clipboard and set as your share image.' : 'Photo set as your share image. Save it from the preview.')
    setModal('photo')
    setShowCard(true)
    trackCatch('catch_share', { method: 'photo', mode: result.mode, outcome: result.outcome, mission })
  }, [mission, result, stampCard, verdict])
  const takePhotoRef = useRef(takePhoto)
  takePhotoRef.current = takePhoto

  // --- Leaderboard ----------------------------------------------------------------
  const loadBoard = useCallback(
    async (m: ModeId, score?: number) => {
      try {
        const q = new URLSearchParams({ m: String(mission), mode: m })
        if (score && score > 0) q.set('score', String(score))
        const res = await fetch(`/api/catch/leaderboard?${q.toString()}`)
        if (!res.ok) return null
        const data = (await res.json()) as CatchBoardResponse
        if (modeRef.current === m) setBoard(data)
        return data
      } catch {
        return null
      }
    },
    [mission]
  )
  // Start screen: the board for the selected mode.
  useEffect(() => {
    if (screen === 'start') void loadBoard(mode)
  }, [screen, mode, loadBoard])
  // Result screen: where would this score rank?
  useEffect(() => {
    if (screen !== 'result' || !result) return
    let stale = false
    void loadBoard(result.mode, flownByBotRef.current ? undefined : result.score).then((data) => {
      if (!stale && data?.enabled && data.rank && result.score > 0 && !flownByBotRef.current) setWouldRank(data.rank)
    })
    return () => {
      stale = true
    }
  }, [screen, result, loadBoard])

  const saveScore = useCallback(async () => {
    if (!result || saving) return
    const name = cleanBoardName(nameInputRef.current?.value ?? nicknameRef.current)
    if (name.length < 2) {
      setBoardNote('Enter a name to save your score.')
      nameInputRef.current?.focus()
      return
    }
    setSaving(true)
    setBoardNote('')
    const flight = flightId.current
    try {
      const res = await fetch('/api/catch/leaderboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mission, mode: result.mode, name, replay: engineRef.current?.tapeBase64() ?? '' }),
      })
      const data = (await res.json()) as CatchBoardResponse
      // The player has already flown again: this answer belongs to the last flight.
      if (flight !== flightId.current) return
      if (!res.ok || data.error || !data.enabled) {
        setBoardNote(data.error || 'Could not save your score. Try again.')
        return
      }
      setBoard((old) => ({ ...data, yesterday: data.yesterday ?? old?.yesterday }))
      if (data.verifiedScore !== undefined && Math.abs(data.verifiedScore - result.score) > 1) {
        setBoardNote(`Saved with a verified score of ${formatScore(data.verifiedScore)}.`)
      }
      const rank = data.rank ?? null
      setSavedRank(rank)
      savedRankRef.current = rank
      setNickname(name)
      nicknameRef.current = name
      if (prefsRef.current) {
        prefsRef.current.nickname = name
        savePrefs(prefsRef.current)
      }
      await stampCard(result, verdict, name, rank)
    } catch {
      if (flight === flightId.current) setBoardNote('Could not reach the leaderboard. Try again.')
    } finally {
      if (flight === flightId.current) setSaving(false)
    }
  }, [mission, result, saving, stampCard, verdict])

  const saveNickname = useCallback(
    async (raw: string) => {
      const nick = cleanNickname(raw)
      setNickname(nick)
      nicknameRef.current = nick
      if (prefsRef.current) {
        prefsRef.current.nickname = nick
        savePrefs(prefsRef.current)
      }
      if (result) await stampCard(result, verdict, nick, savedRankRef.current)
    },
    [result, stampCard, verdict]
  )

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
          if (down && !e.repeat && (screenRef.current === 'start' || screenRef.current === 'result')) fly(screenRef.current === 'result')
          break
        case 'Enter':
          if (screenRef.current === 'flying') k.arms = down
          else if (down && !e.repeat && (screenRef.current === 'start' || screenRef.current === 'result')) fly(screenRef.current === 'result')
          else handled = false
          break
        case 'KeyC':
          k.arms = down
          break
        case 'KeyR':
          if (down && !e.repeat && screenRef.current !== 'start' && screenRef.current !== 'loading') fly(true)
          break
        case 'KeyQ':
          if (down) engineRef.current?.orbit(-0.12, 0)
          break
        case 'KeyE':
          if (down) engineRef.current?.orbit(0.12, 0)
          break
        case 'KeyM':
          if (down && !e.repeat) toggleMute()
          break
        case 'KeyV':
          if (down && !e.repeat) engineRef.current?.resetCamera()
          break
        case 'KeyP':
          if (down && !e.repeat && screenRef.current === 'result') void takePhotoRef.current()
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
      if (document.hidden) {
        clear()
        audioRef.current?.suspend()
      } else audioRef.current?.resume()
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
  }, [fly, pushInput, toggleMute])

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
  // sends its pointer-up, and a key released after the flight is over (or with a
  // button focused) is not read as flight input. Clear both whenever we are not
  // flying, so nothing held at the end of one flight is still held in the next.
  useEffect(() => {
    if (screen === 'flying') return
    stickOrigin.current = null
    touch.current = { x: 0, y: 0, burn: false, arms: false }
    keys.current = { left: false, right: false, up: false, down: false, burn: false, arms: false }
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
          ['Catch', result.parts.caught, 150],
          ['Upright', result.parts.upright, 100],
          ['Depth', result.parts.depth, 150],
          ['Center', result.parts.center, 100],
          ['Height', result.parts.height, 100],
          ['Soft', result.parts.soft, 250],
          ['Steady', result.parts.steady, 100],
          ['Fuel', result.parts.fuel, 150],
        ]
      : [
          ['Near miss', result.parts.near, 200],
          ['Soft landing', result.parts.water, 120],
        ]
    : []

  // Only a flight the player flew can go on the board, and only if it scored.
  const canSave = !!result && result.score > 0 && !!board?.enabled && !flownByBotRef.current
  const challenger = challenge?.nickname || 'Your challenger'
  const beatChallenge = !!result && !!challenge && result.score > challenge.score

  const scoreBlock = (compact: boolean) =>
    result && (
      <div>
        <div className="flex items-baseline gap-2">
          <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${good ? (result.hard ? 'text-amber-300' : 'text-emerald-300') : 'text-rose-300'}`}>
            {outcomeHeadline(result)}
            {result.mode === 'pro' ? ' · PRO' : ''}
          </p>
          {newBest && <span className="rounded bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">New best</span>}
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className={`font-heading font-extrabold tabular-nums ${compact ? 'text-4xl' : 'text-5xl'}`}>{fmt(result.score)}</span>
          <span className="text-sm text-white/55">pts</span>
          {compact && <span className="ml-auto text-right text-[11px] text-white/55">{bragLine(result)}</span>}
        </div>
        <p className={`font-semibold leading-snug ${compact ? 'mt-1 text-sm' : 'mt-1.5 text-[15px]'}`}>{verdict}</p>
        {!compact && <p className="mt-1 text-xs text-white/55">{bragLine(result)}</p>}
        {result.hard && <p className="mt-2 rounded-md bg-amber-300/10 px-2 py-1 text-xs font-semibold text-amber-100">The flaps did the catching, not the pins · points ×0.5</p>}
        {challenge && challenge.mission === mission && (
          <p className={`mt-1.5 text-xs font-semibold ${beatChallenge ? 'text-emerald-300' : 'text-amber-200'}`}>
            {beatChallenge ? `You beat ${challenger}'s ${formatScore(challenge.score)}.` : `${challenger} still leads with ${formatScore(challenge.score)}.`}
          </p>
        )}
        <dl className={`grid gap-1 text-center ${good ? 'grid-cols-4' : 'grid-cols-2'} ${compact ? 'mt-2' : 'mt-2.5'}`}>
          {parts.map(([label, value, max]) => (
            <div key={label} className={`rounded-md bg-white/[0.06] px-1 ${compact ? 'py-1' : 'py-1.5'}`}>
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
      </div>
    )

  // Name + Save: between the player's points and today's board.
  const nameSave = result && (
    <div>
      <p className="text-xs font-semibold">
        {canSave ? (
          savedRank !== null ? (
            <span className="text-emerald-300">Saved. You are #{savedRank} today.</span>
          ) : wouldRank ? (
            <span className="text-white">
              That would put you <span className="text-emerald-300">#{wouldRank}</span> today
            </span>
          ) : (
            <span className="text-white/85">Save your score to today&apos;s board</span>
          )
        ) : (
          <span className="text-white/60">Name on your share image (optional)</span>
        )}
      </p>
      <div className="mt-1.5 flex gap-2">
        <input
          ref={nameInputRef}
          type="text"
          maxLength={16}
          defaultValue={nickname}
          onBlur={(e) => void saveNickname(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            if (canSave && savedRank === null) void saveScore()
            else (e.target as HTMLInputElement).blur()
          }}
          placeholder="Your name"
          aria-label="Your name"
          autoComplete="off"
          className="min-w-0 flex-1 select-text rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-300 focus:outline-none"
        />
        {canSave && savedRank === null && (
          <button
            type="button"
            onClick={() => void saveScore()}
            disabled={saving}
            className="shrink-0 rounded-md bg-emerald-400 px-3.5 py-1.5 text-sm font-extrabold text-black transition hover:bg-emerald-300 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
      {boardNote && <p className="mt-1.5 text-xs font-semibold text-amber-200">{boardNote}</p>}
    </div>
  )

  const shareButton = result && (
    <button
      type="button"
      onClick={() => void share()}
      className="catch-share relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 py-3 text-base font-extrabold text-black transition hover:brightness-110"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
      </svg>
      Share your {good ? 'catch' : result.outcome === 'splashdown' ? 'splashdown' : result.outcome === 'crashed' ? 'fireball' : 'flight'}
    </button>
  )

  const raceAndMore = result && (
    <>
      <CatchRacePanel compact={!desk} onMakeYourCall={() => trackCatch('catch_odds_click', { mode: result.mode, outcome: result.outcome })} />
      <p className="px-0.5 text-[11px] leading-snug text-white/55">Starship is our gateway to a Moon base.</p>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/moonbase?race=${TOUCHDOWN_RACE_GOAL_ID}`}
          onClick={() => trackCatch('catch_moonbase_click', { mode: result.mode, outcome: result.outcome })}
          className="flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-2 py-2.5 text-center text-[13px] font-bold text-white transition hover:bg-white/10"
        >
          Moon Base Zero →
        </Link>
        <Link
          href="/touchdown"
          onClick={() => trackCatch('catch_touchdown_click', { mode: result.mode, outcome: result.outcome })}
          className="flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-2 py-2.5 text-center text-[13px] font-bold text-white transition hover:bg-white/10"
        >
          Land on the Moon →
        </Link>
      </div>
    </>
  )

  const catchAgain = (
    <div className="flex items-center gap-3 border-t border-white/10 p-3">
      <button type="button" onClick={() => fly(true)} className="flex-1 rounded-xl bg-white py-3 text-base font-extrabold text-black transition hover:bg-white/90">
        Catch Again
      </button>
      {modeToggle}
    </div>
  )

  return (
    <div className="relative h-[100dvh] w-full select-none overflow-hidden bg-black text-white" style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}>
      {/* The share button's glow and shine, as on Touchdown. */}
      <style>{`
        @keyframes catch-shine { 0% { transform: translateX(-140%) skewX(-20deg); } 55%, 100% { transform: translateX(320%) skewX(-20deg); } }
        @keyframes catch-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.6); } 55% { box-shadow: 0 0 0 12px rgba(251, 146, 60, 0); } }
        .catch-share { animation: catch-glow 2.2s ease-out infinite; }
        .catch-share::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 38%; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent); animation: catch-shine 2.8s ease-in-out infinite; pointer-events: none; }
        @media (prefers-reduced-motion: reduce) { .catch-share, .catch-share::after { animation: none; } }
      `}</style>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        aria-label="Starship Catch: a Starship tower catch game"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
        onDoubleClick={() => engineRef.current?.resetCamera()}
      />

      <div className="pointer-events-none absolute bottom-2 right-3 z-10 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
        Daily conditions #{mission} · {missionDateLabel(mission)}
      </div>

      {/* Sound: always reachable */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute sound' : 'Mute sound'}
        aria-pressed={muted}
        className="absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-lg border border-white/15 bg-black/55 px-2.5 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur transition hover:text-white"
      >
        {muted ? 'Sound off' : 'Sound on'}
      </button>

      {/* ------------------------------ HUD ------------------------------ */}
      <div className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 ${flying ? 'opacity-100' : 'invisible opacity-0'}`} aria-hidden={!flying}>
        <div className="absolute left-3 top-3 rounded-xl border border-white/10 bg-black/55 px-2.5 py-1.5 font-RobotoMono backdrop-blur-sm sm:px-3 sm:py-2">
          <HudRow label="TO ARMS" unit="m" valueRef={altRef} big />
          <HudRow label="V/S" unit="m/s" valueRef={vsRef} />
          <HudRow label="H/S" unit="m/s" valueRef={hsRef} />
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

        {/* Top view of the arms: steer the dot into the ring. */}
        <div className="absolute left-3 top-[6.6rem] rounded-xl border border-white/10 bg-black/55 p-1.5 backdrop-blur-sm sm:bottom-24 sm:left-auto sm:right-3 sm:top-auto sm:p-2">
          <svg viewBox="-24 -32 48 78" className="block h-[6.6rem] w-[4.1rem] sm:h-[11rem] sm:w-[6.8rem]" aria-hidden>
            <rect x="-6" y="-32" width="12" height="10" fill="#5b6068" />
            <line x1="-5.7" y1="-20.5" x2="-5.7" y2="15.5" stroke="#9aa0a8" strokeWidth="1.6" />
            <line x1="5.7" y1="-20.5" x2="5.7" y2="15.5" stroke="#9aa0a8" strokeWidth="1.6" />
            <circle cx="0" cy="0" r="5.2" fill="none" stroke="#7dffb0" strokeWidth="1.2" />
            <line ref={guideVelRef} x1="0" y1="30" x2="0" y2="30" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1" />
            <circle ref={guideShipRef} cx="0" cy="30" r="3.6" fill="#ffffff" />
          </svg>
          <p className="mt-0.5 text-center font-RobotoMono text-[8px] tracking-widest text-white/55 sm:text-[9px]">TOP VIEW</p>
        </div>

        <div
          ref={promptRef}
          className="absolute left-1/2 top-[31%] max-w-[92%] sm:top-[19%] -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/60 px-3 py-1.5 text-center text-sm font-bold tracking-wide opacity-0 backdrop-blur-sm transition-opacity sm:px-4 sm:py-2 sm:text-xl"
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
            <p className="mt-1.5 text-[10px] font-bold tracking-[0.3em] text-white/70">STEER</p>
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
              Hold <kbd className="mx-1 inline-block rounded-lg border-2 border-white/70 bg-white/15 px-5 py-1 font-RobotoMono text-base sm:text-xl">SPACE</kbd> to fire the engines and brake
            </p>
            <p className="mt-1.5 text-xs font-semibold text-white/75 sm:text-sm">Release to fall. While the engines burn, the arrows steer: ↑ toward the tower, ↓ away from it.</p>
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
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-widest text-white/60">STEER</span>
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
            <h1 className="mt-0.5 font-heading text-3xl font-extrabold leading-none tracking-tight sm:mt-1 sm:text-[2.6rem]">STARSHIP CATCH</h1>
            <p className="mt-2 hidden text-sm leading-relaxed text-white/75 sm:block">
              A Starship is falling out of the sky over Starbase. Brake, steer, and set it down in the tower&apos;s arms. Overshoot and it ends up in the Gulf. New weather every day.
            </p>
            <p className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80">
              Today: {conditions.sky.toLowerCase()}, wind from the {conditions.windFrom} at {conditions.windSpeed.toFixed(0)} m/s
            </p>
            <div className="mt-3 flex items-stretch gap-2 sm:mt-4 sm:block">
              {modeToggle}
              <button
                type="button"
                disabled={screen !== 'start'}
                onClick={() => fly(false)}
                className="flex-1 rounded-xl bg-white py-2.5 text-base font-extrabold tracking-wide text-black transition hover:bg-white/90 disabled:opacity-50 sm:mt-4 sm:w-full sm:py-3.5 sm:text-lg"
              >
                {screen === 'loading' ? 'Rolling out to the pad…' : screen === 'error' ? 'Could not start 3D' : 'CATCH IT'}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-white/55 sm:mt-3 sm:text-xs">
              {pro ? 'Pro: a faster approach, less fuel, full wind, and you close the arms yourself. Score ×1.25.' : 'Easy: more fuel, lighter wind, and the tower closes the arms for you.'}
              {isTouch ? ' Left thumb steers. Right thumb holds BURN.' : ''}
            </p>
            {screen === 'error' && <p className="mt-2 text-xs text-rose-200">This browser could not start WebGL. Try another browser or device.</p>}
            {challenge && challenge.mission === mission && (
              <p className="mt-2 text-xs font-semibold text-amber-200">
                {challenge.nickname || 'A friend'} scored {formatScore(challenge.score)}
                {challenge.mode === 'pro' ? ' on Pro' : ''} today. Beat it.
              </p>
            )}
            {best !== null && best > 0 && <p className="mt-2 text-xs text-white/55">Your best today: {formatScore(best)}</p>}
            {board?.enabled && (
              <div className="mt-3 hidden border-t border-white/10 pt-3 sm:block">
                <CatchLeaderboard board={board} highlight={nickname || undefined} rows={5} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photo button: in the corner of the scene, clear of the panels. */}
      {screen === 'result' && result && !showCard && (
        <button
          type="button"
          onClick={() => void takePhoto()}
          aria-label="Take a photo"
          title="Take a photo (P). Drag the scene to frame it first. Copies to your clipboard and becomes your share image."
          className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-full border border-white/25 bg-black/60 p-2.5 text-sm font-bold text-white backdrop-blur transition hover:bg-black/80 lg:bottom-5 lg:left-1/2 lg:top-auto lg:-translate-x-1/2 lg:rounded-xl lg:px-4 lg:py-2.5"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
            <circle cx="12" cy="13.5" r="3.6" />
          </svg>
          <span className="hidden lg:inline">Take a photo</span>
        </button>
      )}

      {/* ------------------------------ Result: wide screens ------------------------------ */}
      {/* A panel either side, so the ship in the arms stays in the open middle. */}
      {screen === 'result' && result && desk && (
        <>
          <div className="absolute left-3 top-3 z-20 max-h-[calc(100%-1.5rem)] w-[21rem] overflow-y-auto rounded-2xl border border-white/15 bg-black/50 p-4 shadow-2xl backdrop-blur-xl" style={{ touchAction: 'pan-y' }}>
            {scoreBlock(false)}
            <div className="mt-3 border-t border-white/10 pt-3">{nameSave}</div>
            {board?.enabled && (
              <div className="mt-3 border-t border-white/10 pt-3">
                <CatchLeaderboard board={board} highlight={savedRank !== null ? nickname : undefined} rows={5} />
              </div>
            )}
          </div>
          <div className="absolute right-3 top-3 z-20 flex max-h-[calc(100%-1.5rem)] w-[22.5rem] flex-col rounded-2xl border border-white/10 bg-black/80 backdrop-blur-md">
            <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ touchAction: 'pan-y' }}>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setModal('card')
                    setShowCard(true)
                  }}
                  disabled={!cardUrl}
                  className="block aspect-[16/9] w-full overflow-hidden rounded-xl border border-white/15 bg-white/5"
                  aria-label="Preview share image"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {cardUrl && <img src={cardUrl} alt="" className="h-full w-full object-cover" />}
                </button>
                <div className="mt-2.5">{shareButton}</div>
                <p className="mt-2 text-xs leading-snug text-white/60">Copies this image and opens X. Paste it in with Ctrl+V (⌘V).</p>
                {shareNote && <p className="mt-1.5 text-xs font-semibold text-emerald-300">{shareNote}</p>}
              </div>
              {raceAndMore}
            </div>
            {catchAgain}
          </div>
        </>
      )}

      {/* ------------------------------ Result: phones ------------------------------ */}
      {screen === 'result' && result && !desk && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex max-h-[58%] flex-col rounded-t-2xl border border-white/10 bg-black/85 backdrop-blur-md sm:left-1/2 sm:max-w-xl sm:-translate-x-1/2">
          <div className="flex-1 space-y-2.5 overflow-y-auto p-3" style={{ touchAction: 'pan-y' }}>
            {scoreBlock(true)}
            <div className="flex items-stretch gap-2">
              {cardUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setModal('card')
                    setShowCard(true)
                  }}
                  className="shrink-0 overflow-hidden rounded-lg border border-white/15"
                  aria-label="Preview share image"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cardUrl} alt="" className="h-12 w-[5.35rem] object-cover" />
                </button>
              )}
              <div className="min-w-0 flex-1">{shareButton}</div>
            </div>
            {shareNote && <p className="text-xs font-semibold text-emerald-300">{shareNote}</p>}
            {nameSave}
            {raceAndMore}
            {board?.enabled && (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <CatchLeaderboard board={board} highlight={savedRank !== null ? nickname : undefined} rows={3} />
              </div>
            )}
          </div>
          {catchAgain}
        </div>
      )}

      {/* Share fallback / preview: the image to save, plus the X link */}
      {showCard && (modal === 'photo' ? photoUrl : cardUrl) && result && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 p-4" onClick={() => setShowCard(false)}>
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={(modal === 'photo' ? photoUrl : cardUrl) ?? ''}
              alt={modal === 'photo' ? 'Your Starship Catch photo' : 'Your Starship Catch result card'}
              className="max-h-[70vh] w-full select-auto rounded-xl border border-white/15 object-contain"
            />
            <p className="mt-2 text-center text-xs text-white/65">
              {isTouch ? 'Press and hold the image to save it' : 'Right-click the image to copy or save it'}, then attach it to your post.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <a
                href={(modal === 'photo' ? photoUrl : cardUrl) ?? ''}
                download={modal === 'photo' ? 'catch-photo.png' : 'catch.png'}
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold"
              >
                Save image
              </a>
              <a
                href={xIntentUrl(shareText(result, savedRank ?? undefined), shareUrl())}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-sky-400 px-4 py-2 text-sm font-bold text-black"
              >
                Post on X
              </a>
              <button type="button" onClick={() => setShowCard(false)} className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold">
                Close
              </button>
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
