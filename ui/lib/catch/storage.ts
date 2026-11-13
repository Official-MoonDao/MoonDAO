/**
 * Catch persistence: nickname, the day's best score and a flight count.
 * localStorage can throw (private mode, blocked site data), so every access is
 * wrapped and the game works without it.
 */
import type { ModeId } from './modes'

const KEY = 'md_catch_v1'

export type CatchPrefs = {
  nickname: string
  /** Best score per `${mission}:${mode}`. Only the latest few days are kept. */
  best: Record<string, number>
  flights: number
}

export function loadPrefs(): CatchPrefs {
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) || '{}')
    return {
      nickname: typeof p.nickname === 'string' ? p.nickname.slice(0, 16) : '',
      best: p.best && typeof p.best === 'object' ? p.best : {},
      flights: Number.isFinite(p.flights) ? p.flights : 0,
    }
  } catch {
    return { nickname: '', best: {}, flights: 0 }
  }
}

export function savePrefs(prefs: CatchPrefs): void {
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
