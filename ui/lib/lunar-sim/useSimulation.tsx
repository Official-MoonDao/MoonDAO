// React host for the MoonSim engine: computes a SimResult and exposes playback
// controls (play/pause/scrub/speed) over the precomputed event log + snapshots.
//
// The engine is pure and deterministic; compute is deferred a tick so the UI
// can show a "running" state. The renderer reads snapshots and interpolates
// between them using the fractional `subTick`.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { simulate } from './engine/loop'
import type {
  Scenario,
  SimEvent,
  SimResult,
  SirosRegistry,
  SoarRegistry,
  WorldSnapshot,
} from './engine/types'

export type UseSimulationResult = {
  result?: SimResult
  isComputing: boolean
  error?: string
  tick: number
  tickIndex: number
  subTick: number
  totalTicks: number
  currentSnapshot?: WorldSnapshot
  nextSnapshot?: WorldSnapshot
  eventsUpToTick: SimEvent[]
  isPlaying: boolean
  speed: number
  play: () => void
  pause: () => void
  toggle: () => void
  seek: (t: number) => void
  setSpeed: (s: number) => void
  restart: () => void
}

const SPEED_DEFAULT = 1

export default function useSimulation(
  scenario?: Scenario,
  soar?: SoarRegistry,
  siros?: SirosRegistry
): UseSimulationResult {
  const [result, setResult] = useState<SimResult>()
  const [isComputing, setIsComputing] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [tick, setTick] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeedState] = useState(SPEED_DEFAULT)

  // Compute the simulation whenever inputs change.
  useEffect(() => {
    if (!scenario || !soar || !siros) return
    let cancelled = false
    setIsComputing(true)
    setError(undefined)
    setResult(undefined)
    setTick(0)
    setIsPlaying(false)

    const id = setTimeout(() => {
      try {
        const r = simulate(scenario, soar, siros)
        if (!cancelled) {
          setResult(r)
          setIsComputing(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setIsComputing(false)
        }
      }
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [scenario, soar, siros])

  const totalTicks = result ? Math.max(result.snapshots.length - 1, 0) : 0

  const tickIndex = useMemo(
    () => Math.min(Math.floor(tick), totalTicks),
    [tick, totalTicks]
  )
  const subTick = useMemo(() => {
    const frac = tick - Math.floor(tick)
    return tickIndex >= totalTicks ? 0 : frac
  }, [tick, tickIndex, totalTicks])

  // Events grouped so "up to tick" lookups are cheap.
  const eventsByTick = useMemo(() => {
    const m = new Map<number, SimEvent[]>()
    if (result) {
      for (const e of result.events) {
        const arr = m.get(e.tick)
        if (arr) arr.push(e)
        else m.set(e.tick, [e])
      }
    }
    return m
  }, [result])

  const eventsUpToTick = useMemo(() => {
    if (!result) return []
    const out: SimEvent[] = []
    for (let t = 0; t <= tickIndex; t++) {
      const arr = eventsByTick.get(t)
      if (arr) out.push(...arr)
    }
    return out
  }, [result, eventsByTick, tickIndex])

  const currentSnapshot = result?.snapshots[tickIndex]
  const nextSnapshot =
    result?.snapshots[Math.min(tickIndex + 1, totalTicks)] ?? currentSnapshot

  // Playback loop (browser only).
  const rafRef = useRef<number | null>(null)
  const lastRef = useRef<number | null>(null)
  useEffect(() => {
    if (!isPlaying || !result) return
    if (typeof window === 'undefined') return

    const tickSec = scenario?.tickSec || 1
    const timeScale = scenario?.timeScale || 1

    const step = (ts: number) => {
      if (lastRef.current == null) lastRef.current = ts
      const dt = (ts - lastRef.current) / 1000
      lastRef.current = ts
      const ticksPerSecond = (timeScale * speed) / tickSec
      setTick((prev) => {
        const next = prev + dt * ticksPerSecond
        if (next >= totalTicks) {
          setIsPlaying(false)
          return totalTicks
        }
        return next
      })
      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastRef.current = null
    }
  }, [isPlaying, result, speed, totalTicks, scenario])

  const play = useCallback(() => {
    if (!result) return
    setTick((prev) => (prev >= totalTicks ? 0 : prev))
    setIsPlaying(true)
  }, [result, totalTicks])

  const pause = useCallback(() => setIsPlaying(false), [])
  const toggle = useCallback(() => {
    if (isPlaying) setIsPlaying(false)
    else play()
  }, [isPlaying, play])

  const seek = useCallback(
    (t: number) => {
      setIsPlaying(false)
      setTick(Math.max(0, Math.min(t, totalTicks)))
    },
    [totalTicks]
  )

  const setSpeed = useCallback((s: number) => setSpeedState(s), [])

  const restart = useCallback(() => {
    setTick(0)
    setIsPlaying(true)
  }, [])

  return {
    result,
    isComputing,
    error,
    tick,
    tickIndex,
    subTick,
    totalTicks,
    currentSnapshot,
    nextSnapshot,
    eventsUpToTick,
    isPlaying,
    speed,
    play,
    pause,
    toggle,
    seek,
    setSpeed,
    restart,
  }
}
