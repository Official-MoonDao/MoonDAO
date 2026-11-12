/**
 * Touchdown persistence: chosen mode, mute, nickname and the day's best score.
 * localStorage can throw (private mode, blocked site data), so every access is
 * wrapped and the game works without it.
 */
import type { ModeId } from './modes'

const KEY = 'md_touchdown_v1'

export type TouchdownPrefs = {
  mode: ModeId
  muted: boolean
  nickname: string
  /** Best score per `${mission}:${mode}`. Only the latest few missions are kept. */
  best: Record<string, number>
  flights: number
}

const DEFAULTS: TouchdownPrefs = { mode: 'easy', muted: false, nickname: '', best: {}, flights: 0 }

export function loadPrefs(): TouchdownPrefs {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const p = JSON.parse(raw)
    return {
      mode: p.mode === 'pro' ? 'pro' : 'easy',
      muted: !!p.muted,
      nickname: typeof p.nickname === 'string' ? p.nickname.slice(0, 16) : '',
      best: p.best && typeof p.best === 'object' ? p.best : {},
      flights: Number.isFinite(p.flights) ? p.flights : 0,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function savePrefs(prefs: TouchdownPrefs): void {
  try {
    const entries = Object.entries(prefs.best)
      .sort((a, b) => parseInt(b[0], 10) - parseInt(a[0], 10))
      .slice(0, 14)
    window.localStorage.setItem(KEY, JSON.stringify({ ...prefs, best: Object.fromEntries(entries) }))
  } catch {}
}

export function bestKey(mission: number, mode: ModeId): string {
  return `${mission}:${mode}`
}
