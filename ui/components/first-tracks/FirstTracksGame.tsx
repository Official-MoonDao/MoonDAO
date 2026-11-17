/**
 * First Tracks game shell: screens, HUD, input, result layout, sharing and the
 * leaderboard. The 3D scene and the sim loop live in engine.ts; no three.js
 * object is ever held in React state.
 */
import { siteFor } from '@/lib/first-tracks/day'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { trackFirstTracks } from '@/lib/analytics/ga4'
import type { DriverKind } from '@/lib/first-tracks/autopilot'
import { cleanBoardName, type FirstTracksBoardResponse } from '@/lib/first-tracks/leaderboard'
import { MODES, type ModeId } from '@/lib/first-tracks/modes'
import { BATTERY_POINTS, ROUTE_POINTS, TARGET_POINTS, type RunResult } from '@/lib/first-tracks/scoring'
import { canvasToBlob, challengeQuery, cleanNickname, composeCard, copyImage, SHARE_PATH, shareCard, shareText, stampPhoto, xIntentUrl, type Challenge } from '@/lib/first-tracks/share'
import { PRIZE_METRES, windowSecondsFor } from '@/lib/first-tracks/sim'
import { N_TARGETS } from '@/lib/first-tracks/site'
import { bestKey, loadPrefs, savePrefs, type FirstTracksPrefs } from '@/lib/first-tracks/storage'
import { bragLine, formatScore, isGoodOutcome, outcomeHeadline, verdictFor } from '@/lib/first-tracks/verdicts'
import { missionDateLabel, missionNumberFor } from '@/lib/touchdown/mission'
import { FirstTracksSound } from './audio'
import type { Callout, FirstTracksEngine, HudState } from './engine'
import FirstTracksLeaderboard from './FirstTracksLeaderboard'
import { FIRST_TRACKS_RACE_GOAL_ID } from './FirstTracksRaceView'

type Screen = 'loading' | 'start' | 'driving' | 'result' | 'error'

const TONE: Record<Callout['tone'], string> = {
  info: 'text-sky-200',
  warn: 'text-amber-200',
  good: 'text-emerald-300',
  bad: 'text-rose-300',
}

const FirstTracksRacePanel = dynamic(() => import('./FirstTracksRacePanel'), {
  ssr: false,
  loading: () => <div className="h-40 rounded-xl border border-white/10 bg-white/[0.04]" />,
})

const fmt = (n: number) => n.toLocaleString('en-US')
const clockText = (s: number) => {
  const sec = Math.ceil(s)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export default function FirstTracksGame({ challenge = null }: { challenge?: Challenge | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapRef = useRef<HTMLCanvasElement>(null)
  const linkRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<FirstTracksEngine | null>(null)
  const [screen, setScreenState] = useState<Screen>('loading')
  const screenRef = useRef<Screen>('loading')
  const setScreen = useCallback((s: Screen) => {
    screenRef.current = s
    setScreenState(s)
  }, [])
  const [mode, setMode] = useState<ModeId>('easy')
  const modeRef = useRef<ModeId>('easy')
  const [isTouch, setIsTouch] = useState(false)
  const [desk, setDesk] = useState(true)
  const [short, setShort] = useState(false)
  const [callout, setCallout] = useState<Callout | null>(null)
  const calloutTimer = useRef(0)
  const [result, setResult] = useState<RunResult | null>(null)
  const audioRef = useRef<FirstTracksSound | null>(null)
  const [muted, setMuted] = useState(false)
  // A challenge link replays the day it was set on; otherwise it is today's site.
  const [today] = useState(() => missionNumberFor())
  const [mission] = useState(() => (challenge && challenge.mission >= 1 && challenge.mission <= missionNumberFor() ? challenge.mission : missionNumberFor()))
  const [site] = useState(() => siteFor(mission))
  const prefsRef = useRef<FirstTracksPrefs | null>(null)
  const [nickname, setNickname] = useState('')
  const nicknameRef = useRef('')
  const [verdict, setVerdict] = useState('')
  const [best, setBest] = useState<number | null>(null)
  const [newBest, setNewBest] = useState(false)
  const [cardUrl, setCardUrl] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [showCard, setShowCard] = useState(false)
  const [modal, setModal] = useState<'card' | 'photo' | 'orbiter'>('card')
  const [shotUrl, setShotUrl] = useState<string | null>(null)
  const frameRef = useRef<HTMLCanvasElement | null>(null)
  const [holdLabel, setHoldLabel] = useState('')
  const [shareNote, setShareNote] = useState('')
  const blobRef = useRef<Blob | null>(null)
  const [board, setBoard] = useState<FirstTracksBoardResponse | null>(null)
  const [wouldRank, setWouldRank] = useState<number | null>(null)
  const [savedRank, setSavedRank] = useState<number | null>(null)
  const savedRankRef = useRef<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [boardNote, setBoardNote] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const botRef = useRef(false)
  const runId = useRef(0)
  const stampSeq = useRef(0)
  const [keysFaded, setKeysFaded] = useState(false)
  const keysTimer = useRef(0)
  const [hint, setHint] = useState('')
  const [onLander, setOnLander] = useState(true)

  const toggleMute = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    a.unlock()
    a.muted = !a.muted
    setMuted(a.muted)
    try {
      window.localStorage.setItem('first-tracks:muted', a.muted ? '1' : '0')
    } catch {}
  }, [])

  useEffect(() => {
    const prefs = loadPrefs()
    prefsRef.current = prefs
    setNickname(prefs.nickname)
    nicknameRef.current = prefs.nickname
    setBest(prefs.best[bestKey(mission, 'easy')] ?? null)
  }, [mission])

  useEffect(() => {
    const update = () => {
      setDesk(window.innerWidth >= 1024 && window.innerHeight >= 560)
      setShort(window.innerHeight < 900)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  /** Put the score, verdict, name and rank over the 3D shot of the drive and make it the share image. */
  const stampCard = useCallback(async (r: RunResult, name: string, rank: number | null, photo?: HTMLCanvasElement) => {
    // Only the newest request may set the card: a slower, older one is dropped.
    const seq = ++stampSeq.current
    try {
      const frame = photo ?? frameRef.current ?? engineRef.current?.getShot()
      if (!frame) return
      frameRef.current = frame
      const blob = await canvasToBlob(composeCard({ frame, result: r, nickname: name, rank: rank ?? undefined }))
      if (seq !== stampSeq.current) return
      blobRef.current = blob
      setCardUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return blob ? URL.createObjectURL(blob) : null
      })
    } catch {
      if (seq !== stampSeq.current) return
      blobRef.current = null
      frameRef.current = null
      setShotUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return null
      })
      setCardUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return null
      })
    }
  }, [])

  const handleEnd = useCallback(
    (r: RunResult) => {
      const prefs = prefsRef.current ?? loadPrefs()
      prefsRef.current = prefs
      const bot = botRef.current
      prefs.runs += 1
      const v = verdictFor(r, prefs.runs * 7 + mission * 3 + Math.round(r.metres))
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
      trackFirstTracks('first_tracks_end', {
        outcome: r.outcome,
        score: r.score,
        targets: r.imaged,
        metres: Math.round(r.metres),
        battery: Math.round(r.batteryLeft * 100),
        first_tracks: r.firstTracks,
        mode: r.mode,
        mission,
      })
      const photo = engineRef.current?.getPhoto()
      if (photo) {
        void canvasToBlob(photo).then((blob) => {
          setPhotoUrl((old) => {
            if (old) URL.revokeObjectURL(old)
            return blob ? URL.createObjectURL(blob) : null
          })
        })
      }
      frameRef.current = null
      void stampCard(r, nicknameRef.current, null)
    },
    [mission, setScreen, stampCard]
  )
  const handleEndRef = useRef(handleEnd)
  handleEndRef.current = handleEnd

  // HUD refs: written by the engine about 12 times a second without a React render.
  const clockRef = useRef<HTMLSpanElement>(null)
  const clockLabelRef = useRef<HTMLSpanElement>(null)
  const odoRef = useRef<HTMLSpanElement>(null)
  const odoBarRef = useRef<HTMLDivElement>(null)
  const sciRef = useRef<HTMLSpanElement>(null)
  const battRef = useRef<HTMLSpanElement>(null)
  const battBarRef = useRef<HTMLDivElement>(null)
  const sinkRef = useRef<HTMLDivElement>(null)
  const sinkBarRef = useRef<HTMLDivElement>(null)
  const holdRef = useRef<HTMLDivElement>(null)
  const holdBarRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef('')
  const holdLabelRef = useRef('')
  const baseRef = useRef<HTMLDivElement>(null)
  const landerRef = useRef(true)
  const keyEls = useRef<Record<string, HTMLElement | null>>({})

  const writeHud = useCallback((h: HudState) => {
    if (clockRef.current) {
      clockRef.current.textContent = clockText(h.clock)
      clockRef.current.style.color = h.clockRunning && h.clock < 10 ? '#ffbf5e' : ''
    }
    if (clockLabelRef.current) clockLabelRef.current.textContent = h.clockRunning || h.off ? 'Comms window' : 'Clock starts off the lander'
    if (odoRef.current) odoRef.current.textContent = h.metres >= PRIZE_METRES ? `${h.metres.toFixed(0)} m ✓` : `${h.metres.toFixed(1)} / ${PRIZE_METRES} m`
    if (odoBarRef.current) {
      odoBarRef.current.style.width = `${Math.min(100, (h.metres / PRIZE_METRES) * 100)}%`
      odoBarRef.current.style.background = h.metres >= PRIZE_METRES ? '#86e3a8' : '#8fd3ff'
    }
    if (sciRef.current) sciRef.current.textContent = `${h.imaged} / ${N_TARGETS}`
    if (battRef.current) battRef.current.textContent = `${Math.round(h.battery * 100)}%`
    if (battBarRef.current) {
      battBarRef.current.style.width = `${h.battery * 100}%`
      battBarRef.current.style.background = h.battery < 0.2 ? '#ff7a6b' : h.battery < 0.4 ? '#ffbf5e' : '#8fd3ff'
    }
    if (sinkRef.current) sinkRef.current.style.opacity = h.sink > 0.04 ? '1' : '0.35'
    if (sinkBarRef.current) {
      sinkBarRef.current.style.width = `${h.sink * 100}%`
      sinkBarRef.current.style.background = h.sink > 0.6 ? '#ff7a6b' : '#ffbf5e'
    }
    if (holdRef.current) holdRef.current.style.opacity = h.hold > 0.02 && h.hold < 1 ? '1' : '0'
    if (holdBarRef.current) holdBarRef.current.style.width = `${h.hold * 100}%`
    if (baseRef.current) {
      baseRef.current.style.left = `${h.baseX * 100}%`
      baseRef.current.style.top = `${h.baseY * 100}%`
      baseRef.current.style.opacity = h.baseOn ? '1' : '0'
    }
    if (h.holdLabel && h.holdLabel !== holdLabelRef.current) {
      holdLabelRef.current = h.holdLabel
      setHoldLabel(h.holdLabel)
    }
    if (h.hint !== hintRef.current) {
      hintRef.current = h.hint
      setHint(h.hint)
    }
    const lander = !h.off
    if (lander !== landerRef.current) {
      landerRef.current = lander
      setOnLander(lander)
    }
  }, [])

  // --- Boot ------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
    setIsTouch(coarse)
    const audio = new FirstTracksSound()
    try {
      audio.muted = window.localStorage.getItem('first-tracks:muted') === '1'
    } catch {}
    setMuted(audio.muted)
    audioRef.current = audio
    let ro: ResizeObserver | undefined
    const onVisibility = () => (document.hidden ? audio.suspend() : audio.resume())
    document.addEventListener('visibilitychange', onVisibility)
    ;(async () => {
      try {
        const { FirstTracksEngine } = await import('./engine')
        if (cancelled) return
        const params = new URLSearchParams(window.location.search)
        const dev = process.env.NODE_ENV !== 'production'
        const engine = new FirstTracksEngine(
          canvas,
          site,
          {
            onHud: writeHud,
            onCallout: (c) => {
              setCallout(c)
              window.clearTimeout(calloutTimer.current)
              calloutTimer.current = window.setTimeout(() => setCallout(null), 3200)
            },
            onEnd: (r) => handleEndRef.current(r),
          },
          audio,
          { mobile: coarse || window.innerWidth < 760, bloom: !(dev && params.get('bloom') === '0') }
        )
        engineRef.current = engine
        engine.minimap = mapRef.current
        engine.link = linkRef.current
        if (dev) (window as any).__ft = engine
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
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearTimeout(calloutTimer.current)
      window.clearTimeout(keysTimer.current)
      engineRef.current?.dispose()
      audio.dispose()
      audioRef.current = null
      engineRef.current = null
    }
  }, [site, setScreen, writeHud])

  const drive = useCallback(
    (retry?: unknown) => {
      const engine = engineRef.current
      if (!engine) return
      const m = modeRef.current
      trackFirstTracks(retry === true ? 'first_tracks_retry' : 'first_tracks_start', { mode: m, mission })
      if (retry === true) trackFirstTracks('first_tracks_start', { mode: m, mission })
      // A new run: nothing from the last one (a save in flight, its card, its photo) may show on this one.
      runId.current++
      stampSeq.current++
      setSaving(false)
      blobRef.current = null
      setCardUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return null
      })
      setPhotoUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return null
      })
      setShowCard(false)
      // A tap or key press is the only moment a browser lets sound start.
      audioRef.current?.unlock()
      // The canvases mount with the HUD; hand them over again in case they were not there at boot.
      engine.minimap = mapRef.current
      engine.link = linkRef.current
      const dev = process.env.NODE_ENV !== 'production'
      const auto = dev ? (new URLSearchParams(window.location.search).get('autopilot') as DriverKind | null) : null
      botRef.current = !!auto
      engine.start(MODES[m], auto || undefined)
      setResult(null)
      setCallout(null)
      setKeysFaded(false)
      window.clearTimeout(keysTimer.current)
      keysTimer.current = window.setTimeout(() => setKeysFaded(true), 14000)
      setScreen('driving')
    },
    [mission, setScreen]
  )

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
    trackFirstTracks('first_tracks_share', { method, mode: result.mode, outcome: result.outcome, mission })
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
    setShotUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return blob ? URL.createObjectURL(blob) : null
    })
    await stampCard(result, nicknameRef.current, savedRankRef.current, raw)
    setShareNote(copied ? 'Photo copied to your clipboard and set as your share image.' : 'Photo set as your share image. Save it from the preview.')
    setModal('photo')
    setShowCard(true)
    trackFirstTracks('first_tracks_share', { method: 'photo', mode: result.mode, outcome: result.outcome, mission })
  }, [mission, result, stampCard])
  const takePhotoRef = useRef(takePhoto)
  takePhotoRef.current = takePhoto

  // --- Leaderboard ----------------------------------------------------------------
  // Only today's site (or yesterday's, across midnight UTC) has a live board.
  const boardOpen = mission === today || mission === today - 1
  const loadBoard = useCallback(
    async (m: ModeId, score?: number) => {
      try {
        const q = new URLSearchParams({ m: String(mission), mode: m })
        if (score && score > 0) q.set('score', String(score))
        const res = await fetch(`/api/first-tracks/leaderboard?${q.toString()}`)
        if (!res.ok) return null
        const data = (await res.json()) as FirstTracksBoardResponse
        if (modeRef.current === m) setBoard(data)
        return data
      } catch {
        return null
      }
    },
    [mission]
  )
  useEffect(() => {
    if (screen === 'start') void loadBoard(mode)
  }, [screen, mode, loadBoard])
  useEffect(() => {
    if (screen !== 'result' || !result) return
    let stale = false
    void loadBoard(result.mode, botRef.current ? undefined : result.score).then((data) => {
      if (!stale && data?.enabled && data.rank && result.score > 0 && !botRef.current) setWouldRank(data.rank)
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
    const run = runId.current
    try {
      const res = await fetch('/api/first-tracks/leaderboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mission, mode: result.mode, name, replay: engineRef.current?.tapeBase64() ?? '' }),
      })
      const data = (await res.json()) as FirstTracksBoardResponse
      // The player has already driven again: this answer belongs to the last run.
      if (run !== runId.current) return
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
      await stampCard(result, name, rank)
    } catch {
      if (run === runId.current) setBoardNote('Could not reach the leaderboard. Try again.')
    } finally {
      if (run === runId.current) setSaving(false)
    }
  }, [mission, result, saving, stampCard])

  const saveNickname = useCallback(
    async (raw: string) => {
      const nick = cleanNickname(raw)
      setNickname(nick)
      nicknameRef.current = nick
      if (prefsRef.current) {
        prefsRef.current.nickname = nick
        savePrefs(prefsRef.current)
      }
      if (result) await stampCard(result, nick, savedRankRef.current)
    },
    [result, stampCard]
  )

  // --- Input ----------------------------------------------------------------------
  const keys = useRef({ left: false, right: false, up: false, down: false })
  const touch = useRef({ th: 0, st: 0 })
  const pushInput = useCallback(() => {
    const k = keys.current
    const t = touch.current
    const th = (k.up ? 1 : 0) - (k.down ? 1 : 0) || t.th
    const st = (k.right ? 1 : 0) - (k.left ? 1 : 0) || t.st
    engineRef.current?.setControl(th, st)
    for (const name of ['up', 'down', 'left', 'right'] as const) {
      const el = keyEls.current[name]
      if (el) el.dataset.on = k[name] ? '1' : '0'
    }
  }, [])

  useEffect(() => {
    const MAP: Record<string, keyof typeof keys.current> = {
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
    }
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
    }
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return
      const s = screenRef.current
      const k = MAP[e.code]
      if (s === 'driving') {
        // A focused button must never fire on Space or Enter mid-drive.
        if (k || e.code === 'Space' || e.code === 'Enter') e.preventDefault()
        if (k && !keys.current[k]) {
          keys.current[k] = true
          pushInput()
          setKeysFaded(true)
        }
        return
      }
      if (e.repeat) return
      if (s === 'start' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault()
        drive(false)
      } else if (s === 'result' && e.code === 'KeyR') {
        e.preventDefault()
        drive(true)
      } else if (s === 'result' && e.code === 'KeyP') {
        e.preventDefault()
        void takePhotoRef.current()
      } else if (e.code === 'KeyM') toggleMute()
    }
    const up = (e: KeyboardEvent) => {
      const k = MAP[e.code]
      if (k && keys.current[k]) {
        keys.current[k] = false
        pushInput()
      }
    }
    const blur = () => {
      keys.current = { left: false, right: false, up: false, down: false }
      touch.current = { th: 0, st: 0 }
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
  }, [drive, pushInput, toggleMute])

  // Camera: drag to look round, scroll or pinch to zoom, double-click to reset.
  // On a phone the lower half of the screen is the drive stick, so this is the upper half.
  const look = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinch = useRef(0)
  const onLookDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    look.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    e.currentTarget.setPointerCapture(e.pointerId)
    if (look.current.size === 2) {
      const [a, b] = [...look.current.values()]
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y)
    }
  }
  const onLookMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const last = look.current.get(e.pointerId)
    const engine = engineRef.current
    if (!last || !engine) return
    if (look.current.size >= 2) {
      look.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const [a, b] = [...look.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch.current > 0 && d > 0) engine.zoom(pinch.current / d)
      pinch.current = d
      return
    }
    engine.orbit(-(e.clientX - last.x) * 0.006, (e.clientY - last.y) * 0.005)
    look.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
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

  // Touch: a stick that appears under the thumb. Up and down drive, sideways steers.
  const stickRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const stickOrigin = useRef<{ id: number; x: number; y: number } | null>(null)
  const STICK_R = 56
  const moveStick = (x: number, y: number) => {
    const o = stickOrigin.current
    if (!o) return
    let dx = (x - o.x) / STICK_R
    let dy = (y - o.y) / STICK_R
    const d = Math.hypot(dx, dy)
    if (d > 1) {
      dx /= d
      dy /= d
    }
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx * STICK_R}px, ${dy * STICK_R}px)`
    const dead = (v: number) => (Math.abs(v) < 0.18 ? 0 : (Math.sign(v) * (Math.abs(v) - 0.18)) / 0.82)
    touch.current = { th: dead(-dy), st: dead(dx) }
    pushInput()
  }
  const onStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickOrigin.current) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    stickOrigin.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
    if (stickRef.current) {
      stickRef.current.style.left = `${e.clientX - rect.left}px`
      stickRef.current.style.top = `${e.clientY - rect.top}px`
      stickRef.current.style.opacity = '0.9'
    }
    moveStick(e.clientX, e.clientY)
  }
  const onStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickOrigin.current?.id === e.pointerId) moveStick(e.clientX, e.clientY)
  }
  const onStickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickOrigin.current?.id !== e.pointerId) return
    stickOrigin.current = null
    touch.current = { th: 0, st: 0 }
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)'
    if (stickRef.current) stickRef.current.style.opacity = '0.4'
    pushInput()
  }
  // The stick unmounts when a run ends; a thumb still down never sends its
  // pointer-up. Clear everything held whenever we are not driving.
  useEffect(() => {
    if (screen === 'driving') return
    stickOrigin.current = null
    touch.current = { th: 0, st: 0 }
    keys.current = { left: false, right: false, up: false, down: false }
    pushInput()
  }, [screen, pushInput])

  const driving = screen === 'driving'
  const modalUrl = modal === 'orbiter' ? photoUrl : modal === 'photo' ? shotUrl : cardUrl
  const pro = mode === 'pro'
  const cfg = MODES[mode]
  // The day's clock is sized from the day's site, so it differs from day to day.
  const windowSeconds = windowSecondsFor(site, cfg)
  const keyCap =
    "flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-base text-white/70 backdrop-blur transition data-[on='1']:border-sky-300 data-[on='1']:bg-sky-500 data-[on='1']:text-white"

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

  const good = !!result && isGoodOutcome(result)
  const canSave = !!result && result.score > 0 && !!board?.enabled && boardOpen && !botRef.current
  const challenger = challenge?.nickname || 'Your challenger'
  const beatChallenge = !!result && !!challenge && result.score > challenge.score

  const scoreBlock = (compact: boolean) =>
    result && (
      <div>
        <div className="flex items-baseline gap-2">
          <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${good ? 'text-emerald-300' : result.firstTracks ? 'text-amber-300' : 'text-rose-300'}`}>
            {outcomeHeadline(result)}
            {result.mode === 'pro' ? ' · PRO' : ''}
          </p>
          {newBest && <span className="rounded bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">New best</span>}
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className={`font-heading font-extrabold tabular-nums ${compact ? 'text-4xl' : 'text-5xl'}`}>{fmt(result.score)}</span>
          <span className="text-sm text-white/55">pts</span>
          {best !== null && best > result.score && <span className="ml-auto text-[11px] text-white/50">Best today {fmt(best)}</span>}
        </div>
        <p className={`font-semibold leading-snug ${compact ? 'mt-1 text-sm' : 'mt-1.5 text-[15px]'}`}>{verdict}</p>
        {!compact && <p className="mt-1 text-xs text-white/55">{bragLine(result)}</p>}
        {challenge && challenge.mission === mission && (
          <p className={`mt-1.5 text-xs font-semibold ${beatChallenge ? 'text-emerald-300' : 'text-amber-200'}`}>
            {beatChallenge ? `You beat ${challenger}'s ${formatScore(challenge.score)}.` : `${challenger} still leads with ${formatScore(challenge.score)}.`}
          </p>
        )}
        <dl className={`space-y-1 ${compact ? 'mt-2' : 'mt-2.5'}`}>
          {(
            [
              [`Science ${result.imaged}/${N_TARGETS}`, result.parts.targets, TARGET_POINTS],
              ['Route', result.parts.route, ROUTE_POINTS],
              ['Battery', result.parts.battery, BATTERY_POINTS],
            ] as const
          ).map(([label, value, max]) => (
            <div key={label} className="flex items-baseline gap-2 rounded-md bg-white/[0.06] px-2 py-1 text-[13px]">
              <dt className="text-white/75">{label}</dt>
              <dd className="ml-auto font-bold tabular-nums">
                {value}
                <span className="text-[10px] font-normal text-white/35">/{max}</span>
              </dd>
            </div>
          ))}
          {result.imaged > 0 && (
            <p className="px-2 text-[11px] text-white/55">
              {result.done.image} regolith {result.done.image === 1 ? 'image' : 'images'} · {result.done.rock} boulder {result.done.rock === 1 ? 'spectrum' : 'spectra'} · {result.done.ice} ice {result.done.ice === 1 ? 'core' : 'cores'}
            </p>
          )}
          {(result.parts.time > 0 || result.condition !== 1 || result.mode === 'pro') && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-2 pt-0.5 text-[11px] text-white/60">
              {result.parts.time > 0 && (
                <span>
                  Time left {Math.round(result.timeLeft)} s <span className="font-bold text-white/85">+{result.parts.time}</span>
                </span>
              )}
              {result.condition !== 1 && (
                <span>
                  Rover condition <span className="font-bold text-rose-200">×{result.condition}</span>
                </span>
              )}
              {result.mode === 'pro' && (
                <span>
                  Pro <span className="font-bold text-amber-200">×{MODES.pro.scoreMultiplier}</span>
                </span>
              )}
            </div>
          )}
        </dl>
      </div>
    )

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
      className="ft-share relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 py-3 text-base font-extrabold text-black transition hover:brightness-110"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
      </svg>
      Share your {result.off ? 'tracks' : 'drive'}
    </button>
  )

  const raceAndMore = result && (
    <>
      <FirstTracksRacePanel compact={!desk || short} onMakeYourCall={() => trackFirstTracks('first_tracks_odds_click', { mode: result.mode, outcome: result.outcome })} />
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/moonbase?race=${FIRST_TRACKS_RACE_GOAL_ID}`}
          onClick={() => trackFirstTracks('first_tracks_moonbase_click', { mode: result.mode, outcome: result.outcome })}
          className="flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-2 py-2.5 text-center text-[13px] font-bold text-white transition hover:bg-white/10"
        >
          Moon Base Zero →
        </Link>
        <Link
          href="/touchdown"
          onClick={() => trackFirstTracks('first_tracks_game_click', { mode: result.mode, outcome: result.outcome })}
          className="flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-2 py-2.5 text-center text-[13px] font-bold text-white transition hover:bg-white/10"
        >
          Land on the Moon →
        </Link>
      </div>
    </>
  )

  // The orbiter's photo of the tracks: the independent check the real prize asks for.
  const orbiterLink = photoUrl && (
    <button
      type="button"
      onClick={() => {
        setModal('orbiter')
        setShowCard(true)
      }}
      className="mt-2 flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-left transition hover:bg-white/10"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
      <span className="text-[11px] leading-snug text-white/65">
        <span className="block font-bold text-white/90">Orbiter pass</span>
        The photo from orbit that confirms your tracks
      </span>
    </button>
  )

  const driveAgain = (
    <div className="flex items-center gap-3 border-t border-white/10 p-3">
      <button type="button" onClick={() => drive(true)} className="flex-1 rounded-xl bg-white py-3 text-base font-extrabold text-black transition hover:bg-white/90">
        Drive Again
      </button>
      {modeToggle}
    </div>
  )

  const stat = 'rounded-lg border border-white/10 bg-black/55 px-2.5 py-1.5 backdrop-blur'
  const label = 'text-[9px] font-semibold uppercase tracking-[0.14em] text-white/50'
  const value = 'font-heading text-sm font-bold tabular-nums leading-tight sm:text-base'
  const bar = 'relative mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10'

  return (
    <div className="relative h-[100dvh] w-full select-none overflow-hidden bg-black text-white" style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}>
      <style>{`
        @keyframes ft-shine { 0% { transform: translateX(-140%) skewX(-20deg); } 55%, 100% { transform: translateX(320%) skewX(-20deg); } }
        @keyframes ft-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.6); } 55% { box-shadow: 0 0 0 12px rgba(251, 146, 60, 0); } }
        .ft-share { animation: ft-glow 2.2s ease-out infinite; }
        .ft-share::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 38%; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent); animation: ft-shine 2.8s ease-in-out infinite; pointer-events: none; }
        @media (prefers-reduced-motion: reduce) { .ft-share, .ft-share::after { animation: none; } }
      `}</style>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        aria-label="Lunar Rover: First Tracks, a lunar rover driving game"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
        onDoubleClick={() => engineRef.current?.resetCamera()}
      />

      {!driving && (
        <div className="pointer-events-none absolute bottom-2 right-3 z-10 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
          Daily site #{mission} · {missionDateLabel(mission)}
        </div>
      )}

      {/* Moon Base Zero, out on the horizon: a label that floats over it wherever the camera looks. */}
      <div ref={baseRef} className="pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-full opacity-0 transition-opacity">
        <div className="whitespace-nowrap rounded border border-amber-200/40 bg-black/50 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.18em] text-amber-100">MOON BASE ZERO</div>
        <div className="mx-auto h-4 w-px bg-amber-200/50" />
      </div>

      {/* Sound: always reachable */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute sound' : 'Mute sound'}
        aria-pressed={muted}
        className={`absolute z-30 rounded-lg border border-white/15 bg-black/55 px-2.5 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur transition hover:text-white ${
          driving ? 'left-3 top-3' : 'left-1/2 top-3 -translate-x-1/2'
        }`}
      >
        {muted ? 'Sound off' : 'Sound on'}
      </button>

      {/* ------------------------------ HUD ------------------------------ */}
      <div className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 ${driving ? 'opacity-100' : 'opacity-0'}`} aria-hidden={!driving}>
        {/* Clock */}
        <div className="absolute left-1/2 top-2.5 flex -translate-x-1/2 flex-col items-center sm:top-3">
          <span ref={clockLabelRef} className={label}>
            Comms window
          </span>
          <span ref={clockRef} className="font-heading text-3xl font-extrabold tabular-nums leading-none sm:text-4xl">
            {clockText(windowSeconds)}
          </span>
          <span className="mt-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-200">Picture is {cfg.downlink.toFixed(1)} s old</span>
          <div ref={holdRef} className="mt-1.5 flex w-44 flex-col items-center opacity-0 transition-opacity">
            <div className="whitespace-nowrap text-center text-[9px] font-bold uppercase tracking-widest text-emerald-200">{holdLabel || 'Hold still'}</div>
            <div className={bar}>
              <div ref={holdBarRef} className="absolute inset-y-0 left-0 rounded-full bg-emerald-300" style={{ width: 0 }} />
            </div>
          </div>
        </div>
        {/* Minimap */}
        <div className="absolute right-2.5 top-2.5 sm:right-3 sm:top-3">
          <canvas ref={mapRef} className="h-[104px] w-[104px] rounded-full sm:h-[156px] sm:w-[156px]" />
          <p className="mt-1 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
            #{mission} · {cfg.label}
          </p>
        </div>
        {/* Telemetry */}
        <div className={`absolute flex gap-1.5 ${isTouch ? 'left-2.5 top-12 w-[8.6rem] flex-col' : 'bottom-3 left-3 items-end'}`}>
          <div className={`${stat} ${isTouch ? '' : 'w-36'}`}>
            <div className={label}>First tracks</div>
            <div className={value}>
              <span ref={odoRef}>0.0 / {PRIZE_METRES} m</span>
            </div>
            <div className={bar}>
              <div ref={odoBarRef} className="absolute inset-y-0 left-0 rounded-full" style={{ width: 0, background: '#8fd3ff' }} />
            </div>
          </div>
          <div className={`flex gap-1.5 ${isTouch ? '' : 'contents'}`}>
            <div className={`${stat} ${isTouch ? 'flex-1' : 'w-24'}`}>
              <div className={label}>Science</div>
              <div className={value}>
                <span ref={sciRef}>0 / {N_TARGETS}</span>
              </div>
            </div>
            <div className={`${stat} ${isTouch ? 'flex-1' : 'w-28'}`}>
              <div className={label}>Battery</div>
              <div className={value}>
                <span ref={battRef}>100%</span>
              </div>
              <div className={bar}>
                <div ref={battBarRef} className="absolute inset-y-0 left-0 rounded-full" style={{ width: '100%', background: '#8fd3ff' }} />
              </div>
            </div>
          </div>
          <div ref={sinkRef} className={`${stat} ${isTouch ? '' : 'w-28'} opacity-35 transition-opacity`}>
            <div className={label}>Wheel sinkage</div>
            <div className={`${bar} mt-1.5`}>
              <div ref={sinkBarRef} className="absolute inset-y-0 left-0 rounded-full" style={{ width: 0, background: '#ffbf5e' }} />
            </div>
          </div>
          <div className={`${stat} ${isTouch ? '' : 'w-64'}`}>
            <div className={label}>
              Commands in flight · <span className="text-sky-200">{cfg.uplink.toFixed(1)} s</span>
            </div>
            <canvas ref={linkRef} className={`mt-0.5 w-full ${isTouch ? 'h-8' : 'h-9'}`} />
            <div className="flex justify-between text-[8px] font-semibold tracking-[0.14em] text-white/40">
              <span>EARTH</span>
              <span>MOON</span>
            </div>
          </div>
        </div>
        {/* Desktop: the keys, bottom-right. They light as they are pressed and fade once the drive is under way. */}
        {!isTouch && (
          <div className={`absolute bottom-3 right-3 flex flex-col items-end gap-1 transition-opacity duration-700 ${keysFaded ? 'opacity-30' : 'opacity-100'}`}>
            <div className="flex gap-1">
              <span
                ref={(el) => {
                  keyEls.current.up = el
                }}
                className={keyCap}
              >
                W
              </span>
            </div>
            <div className="flex gap-1">
              <span
                ref={(el) => {
                  keyEls.current.left = el
                }}
                className={keyCap}
              >
                A
              </span>
              <span
                ref={(el) => {
                  keyEls.current.down = el
                }}
                className={keyCap}
              >
                S
              </span>
              <span
                ref={(el) => {
                  keyEls.current.right = el
                }}
                className={keyCap}
              >
                D
              </span>
            </div>
            <p className="rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white/70">W S drive · A D steer · or the arrow keys</p>
          </div>
        )}
        {/* Hint: always on a dark pill, never grey on a grey scene. */}
        <div className={`absolute left-1/2 w-[min(92%,34rem)] -translate-x-1/2 text-center transition-opacity duration-300 ${isTouch ? 'bottom-3' : 'bottom-24'} ${hint ? 'opacity-100' : 'opacity-0'}`}>
          <span className="inline-block rounded-lg bg-black/65 px-3 py-1.5 text-xs font-semibold text-sky-100 backdrop-blur-sm sm:text-sm">{hint}</span>
        </div>
      </div>

      {/* Mission control ticker */}
      <div
        aria-live="polite"
        className={`pointer-events-none absolute left-1/2 z-10 w-[min(92%,34rem)] -translate-x-1/2 text-center transition-opacity duration-300 ${isTouch ? 'top-[38%]' : 'top-[22%]'} ${
          callout && driving ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {callout && (
          <span className={`inline-block rounded-lg bg-black/65 px-3 py-1.5 text-sm font-bold backdrop-blur-sm sm:text-lg ${TONE[callout.tone]}`}>
            <span className="mr-2 text-[10px] tracking-widest text-white/45">MISSION CONTROL</span>
            {callout.text}
          </span>
        )}
      </div>

      {/* ------------------------------ Touch controls ------------------------------ */}
      {isTouch && driving && (
        <div className="absolute inset-x-0 bottom-0 top-[46%] z-20" onPointerDown={onStickDown} onPointerMove={onStickMove} onPointerUp={onStickUp} onPointerCancel={onStickUp} onContextMenu={(e) => e.preventDefault()}>
          <div ref={stickRef} className="pointer-events-none absolute h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35 bg-white/5 opacity-40 transition-opacity" style={{ left: '50%', top: '62%' }}>
            <div ref={knobRef} className="absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 rounded-full bg-white/70" />
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold tracking-widest text-white/60">{onLander ? 'DRAG TO DRIVE' : 'DRIVE'}</span>
          </div>
        </div>
      )}

      {/* ------------------------------ Start screen ------------------------------ */}
      {(screen === 'start' || screen === 'loading' || screen === 'error') && (
        // The wrapper lets drags through to the scene; only the card takes clicks.
        <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center bg-gradient-to-t from-black/70 via-transparent to-transparent p-3 sm:items-center sm:justify-end sm:bg-none sm:p-4 sm:pr-[5vw]">
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur-md sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55 sm:text-[11px]">Can you drive on the Moon?</p>
            <h1 className="mt-0.5 font-heading text-3xl font-extrabold leading-none tracking-tight sm:mt-1 sm:text-[2.6rem]">LUNAR ROVER</h1>
            <p className="mt-1 font-heading text-sm font-bold tracking-[0.3em] text-white/70 sm:text-base">FIRST TRACKS</p>
            <p className="mt-2 hidden text-sm leading-relaxed text-white/75 sm:block">
              Drive a rover off its lander and across the Moon. Every command arrives late, so you are always steering where the rover was. Reach as many science sites as you can before the clock runs out. New site every
              day.
            </p>
            <div className="mt-3 flex items-stretch gap-2 sm:mt-4 sm:block">
              {modeToggle}
              <button
                type="button"
                disabled={screen !== 'start'}
                onClick={() => drive(false)}
                className="flex-1 rounded-xl bg-white py-2.5 text-base font-extrabold tracking-wide text-black transition hover:bg-white/90 disabled:opacity-50 sm:mt-4 sm:w-full sm:py-3.5 sm:text-lg"
              >
                {screen === 'loading' ? 'Unpacking the rover…' : screen === 'error' ? 'Could not start 3D' : 'START DRIVING'}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-white/55 sm:mt-3 sm:text-xs">
              {pro ? `Pro: the real ${cfg.uplink} s signal delay, no guide. Score ×${cfg.scoreMultiplier}.` : `Easy: ${cfg.uplink} s signal delay, and a ghost shows where the rover will be.`}
              {isTouch ? ' Drag the lower half of the screen to drive.' : ''}
            </p>
            {screen === 'error' && <p className="mt-2 text-xs text-rose-200">This browser could not start WebGL. Try another browser or device.</p>}
            {challenge && challenge.mission === mission && (
              <p className="mt-2 text-xs font-semibold text-amber-200">
                {challenge.nickname || 'A friend'} scored {formatScore(challenge.score)}
                {challenge.mode === 'pro' ? ' on Pro' : ''} on this site. Beat it.
              </p>
            )}
            {best !== null && best > 0 && <p className="mt-2 text-xs text-white/55">Your best {mission === today ? 'today' : 'on this site'}: {formatScore(best)}</p>}
            {board?.enabled && boardOpen && (
              <div className="mt-3 hidden border-t border-white/10 pt-3 sm:block">
                <FirstTracksLeaderboard board={board} highlight={nickname || undefined} rows={5} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------ Result: wide screens ------------------------------ */}
      {screen === 'result' && result && desk && (
        <>
          <div className="absolute left-3 top-3 z-20 max-h-[calc(100%-1.5rem)] w-[21.5rem] overflow-y-auto rounded-2xl border border-white/15 bg-black/55 p-4 shadow-2xl backdrop-blur-xl" style={{ touchAction: 'pan-y' }}>
            {scoreBlock(false)}
            <div className="mt-3 border-t border-white/10 pt-3">{nameSave}</div>
            {board?.enabled && boardOpen && (
              <div className="mt-3 border-t border-white/10 pt-3">
                <FirstTracksLeaderboard board={board} highlight={savedRank !== null ? nickname : undefined} rows={5} />
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
                {orbiterLink}
              </div>
              {raceAndMore}
            </div>
            {driveAgain}
          </div>
        </>
      )}

      {/* ------------------------------ Result: phones ------------------------------ */}
      {screen === 'result' && result && !desk && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex max-h-[66%] flex-col rounded-t-2xl border border-white/10 bg-black/85 backdrop-blur-md sm:left-1/2 sm:max-w-xl sm:-translate-x-1/2">
          <div className="flex-1 space-y-2.5 overflow-y-auto p-3" style={{ touchAction: 'pan-y' }}>
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
            {scoreBlock(true)}
            {orbiterLink}
            {nameSave}
            {raceAndMore}
            {board?.enabled && boardOpen && (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <FirstTracksLeaderboard board={board} highlight={savedRank !== null ? nickname : undefined} rows={3} />
              </div>
            )}
          </div>
          {driveAgain}
        </div>
      )}

      {/* Share fallback / preview: the image to save, plus the X link */}
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

      {/* Share fallback / preview: the image to save, plus the X link */}
      {showCard && modalUrl && result && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 p-4" onClick={() => setShowCard(false)}>
          <div className={`w-full ${modal === 'orbiter' ? 'max-w-xl' : 'max-w-2xl'}`} onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={modalUrl}
              alt={modal === 'orbiter' ? "The orbiter's photo of the landing site with the rover's tracks" : modal === 'photo' ? 'Your Lunar Rover photo' : 'Your Lunar Rover result card'}
              className="max-h-[70vh] w-full select-auto rounded-xl border border-white/15 object-contain"
            />
            <p className="mt-2 text-center text-xs text-white/65">
              {modal === 'orbiter' ? 'The view from orbit that confirms your tracks. ' : ''}
              {isTouch ? 'Press and hold the image to save it' : 'Right-click the image to copy or save it'}
              {modal === 'orbiter' ? '.' : ', then attach it to your post.'}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <a href={modalUrl} download={modal === 'orbiter' ? 'lunar-rover-orbiter.png' : modal === 'photo' ? 'lunar-rover-photo.png' : 'lunar-rover.png'} className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold">
                Save image
              </a>
              <a href={xIntentUrl(shareText(result, savedRank ?? undefined), shareUrl())} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-sky-400 px-4 py-2 text-sm font-bold text-black">
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
