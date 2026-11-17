/**
 * First Tracks persistence: nickname, the day's best score and a run count.
 * localStorage can throw (private mode, blocked site data), so every access is
 * wrapped and the game works without it.
 */
import type { ModeId } from './modes'

const KEY = 'md_first_tracks_v1'

export type FirstTracksPrefs = {
  nickname: string
  /** Best score per `${mission}:${mode}`. Only the latest few days are kept. */
  best: Record<string, number>
  runs: number
}

export function loadPrefs(): FirstTracksPrefs {
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) || '{}')
    return {
      nickname: typeof p.nickname === 'string' ? p.nickname.slice(0, 16) : '',
      best: p.best && typeof p.best === 'object' ? p.best : {},
      runs: Number.isFinite(p.runs) ? p.runs : 0,
    }
  } catch {
    return { nickname: '', best: {}, runs: 0 }
  }
}

export function savePrefs(prefs: FirstTracksPrefs): void {
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
