/**
 * Touchdown daily leaderboard: shared types and validation. No Redis here, so
 * the browser can import it. The store is in leaderboardStore.ts.
 *
 * One entry per name per day and mode, best score only, with an attempt count.
 * The browser sends its recorded inputs, not a score: the server re-flies them
 * (lib/touchdown/replay.ts) and stores what the physics produces.
 */
import type { ModeId } from './modes'

export type BoardEntry = { name: string; score: number; attempts: number }

export type BoardResponse = {
  /** False when the store is not configured; the UI then hides the board. */
  enabled: boolean
  mission: number
  mode: ModeId
  top: BoardEntry[]
  /** Pilots on today's board. */
  total: number
  /** The top pilot on the previous day's board, as a score to aim for. */
  yesterday?: { name: string; score: number }
  /** The best score ever saved in this mode, on any day's map. */
  allTime?: { name: string; score: number }
  /** Rank the queried or submitted score holds (1 = top). */
  rank?: number
  /** The score the server's replay produced, on a saved submission. */
  verifiedScore?: number
  /** Set on a rejected submission. */
  error?: string
}

export const BOARD_SIZE = 10
export const NAME_MAX = 16
/** Highest score the scoring formula can produce, per mode. */
export const MAX_SCORE: Record<ModeId, number> = { easy: 1250, pro: 1563 }

/** Display form: plain characters, single spaces, at most NAME_MAX. */
export function cleanBoardName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
}

/** Identity form: one board entry per key, so "Ryan" and "ryan " are the same pilot. */
export function nameKey(name: string): string {
  return cleanBoardName(name).toLowerCase()
}

// A short built-in list of common profanity. Matching is on a squashed form of
// the name (letters only, common digit swaps undone), so spacing and leetspeak
// do not get around it. Extend it without a deploy via TOUCHDOWN_NAME_BLOCKLIST.
const BLOCKED = ['fuck', 'shit', 'cunt', 'bitch', 'dick', 'cock', 'pussy', 'asshole', 'bastard', 'slut', 'whore', 'porn', 'nazi', 'hitler', 'rape']

function squash(name: string): string {
  return name
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/[^a-z]/g, '')
}

export function isNameAllowed(name: string, extraBlocklist = ''): boolean {
  const s = squash(name)
  if (!s) return cleanBoardName(name).length >= 2
  const extra = extraBlocklist
    .split(',')
    .map((w) => squash(w))
    .filter((w) => w.length >= 3)
  return ![...BLOCKED, ...extra].some((w) => s.includes(w))
}

export type Submission = { mission: number; mode: ModeId; name: string; score: number }

/**
 * Bound a submitted score. `today` is the server's own mission number: only
 * today's map (or yesterday's, for a flight that straddled midnight UTC) can
 * be posted to.
 */
export function validateSubmission(
  body: unknown,
  today: number,
  extraBlocklist = ''
): { ok: true; value: Submission } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Bad request' }
  const b = body as Record<string, unknown>
  const mode: ModeId | null = b.mode === 'pro' ? 'pro' : b.mode === 'easy' ? 'easy' : null
  if (!mode) return { ok: false, error: 'Bad mode' }
  const mission = Number(b.mission)
  if (!Number.isInteger(mission) || (mission !== today && mission !== today - 1)) {
    return { ok: false, error: "Only today's landing site can be posted" }
  }
  const score = Number(b.score)
  if (!Number.isInteger(score) || score < 1 || score > MAX_SCORE[mode]) {
    return { ok: false, error: 'Score out of range' }
  }
  const name = cleanBoardName(b.name)
  if (name.length < 2) return { ok: false, error: 'Enter a name of at least 2 characters' }
  if (!isNameAllowed(name, extraBlocklist)) return { ok: false, error: 'Please choose a different name' }
  return { ok: true, value: { mission, mode, name, score } }
}
