/**
 * First Tracks daily leaderboard: shared types and validation. No Redis here, so the
 * browser can import it. Names are cleaned and checked exactly as Touchdown's
 * are (that code is shared unchanged); the store is in leaderboardStore.ts.
 *
 * The browser sends its recorded inputs, not a score: the server re-drives them
 * (lib/first-tracks/replay.ts) and stores what the sim produces.
 */
import { cleanBoardName, isNameAllowed, nameKey, type BoardEntry } from '@/lib/touchdown/leaderboard'
import { MODES, type ModeId } from './modes'
import { maxScore } from './scoring'

export { cleanBoardName, nameKey }
export type { BoardEntry }

export type FirstTracksBoardResponse = {
  /** False when the store is not configured; the UI then hides the board. */
  enabled: boolean
  mission: number
  mode: ModeId
  top: BoardEntry[]
  total: number
  /** Rank the queried or submitted score holds (1 = top). */
  rank?: number
  /** The score the server's replay produced, on a saved submission. */
  verifiedScore?: number
  /** The best driver on the day before `mission`, when there was one. */
  yesterday?: BoardEntry
  error?: string
}

/** A ceiling on what the board accepts, per mode. The score itself always comes from the server's own replay. */
export const MAX_SCORE: Record<ModeId, number> = {
  easy: maxScore(MODES.easy.scoreMultiplier),
  pro: maxScore(MODES.pro.scoreMultiplier),
}

export type Submission = { mission: number; mode: ModeId; name: string; score: number }

export function validateSubmission(body: unknown, today: number, extraBlocklist = ''): { ok: true; value: Submission } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Bad request' }
  const b = body as Record<string, unknown>
  const mode: ModeId | null = b.mode === 'pro' ? 'pro' : b.mode === 'easy' ? 'easy' : null
  if (!mode) return { ok: false, error: 'Bad mode' }
  const mission = Number(b.mission)
  if (!Number.isInteger(mission) || (mission !== today && mission !== today - 1)) {
    return { ok: false, error: "Only today's site can be posted" }
  }
  const score = Number(b.score)
  if (!Number.isInteger(score) || score < 1 || score > MAX_SCORE[mode]) return { ok: false, error: 'Score out of range' }
  const name = cleanBoardName(b.name)
  if (name.length < 2) return { ok: false, error: 'Enter a name of at least 2 characters' }
  if (!isNameAllowed(name, extraBlocklist)) return { ok: false, error: 'Please choose a different name' }
  return { ok: true, value: { mission, mode, name, score } }
}
