/**
 * Touchdown daily leaderboard.
 *
 *   GET    ?m=<mission>&mode=easy|pro[&score=N]   top 10, plus the rank `score` would hold
 *   POST   { mission, mode, name, score }         record an attempt, keep the best
 *   DELETE ?m=&mode=&name=                        moderation; needs x-touchdown-admin
 *
 * Returns `enabled: false` (200) when Redis is not configured, so the game
 * simply hides the board instead of erroring.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { newsletterClientIp } from '@/lib/convert-kit/subscribeRateLimit'
import { validateSubmission, type BoardResponse } from '@/lib/touchdown/leaderboard'
import { leaderboardRedis, rankOf, readBoard, removeEntry, submitLimiter, submitScore } from '@/lib/touchdown/leaderboardStore'
import { missionNumberFor } from '@/lib/touchdown/mission'
import type { ModeId } from '@/lib/touchdown/modes'

function modeOf(v: unknown): ModeId {
  return v === 'pro' ? 'pro' : 'easy'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<BoardResponse | { ok: boolean }>) {
  res.setHeader('Cache-Control', 'no-store')
  const today = missionNumberFor()
  const redis = leaderboardRedis()
  const empty = (mission: number, mode: ModeId, error?: string): BoardResponse => ({
    enabled: !!redis,
    mission,
    mode,
    top: [],
    total: 0,
    ...(error ? { error } : {}),
  })

  try {
    if (req.method === 'GET') {
      const mode = modeOf(req.query.mode)
      const mission = Number(req.query.m)
      if (!redis || !Number.isInteger(mission) || mission < 1 || mission > today) {
        return res.status(200).json(empty(Number.isInteger(mission) ? mission : today, mode))
      }
      const board = await readBoard(redis, mission, mode)
      const score = Number(req.query.score)
      const rank = Number.isInteger(score) && score > 0 ? await rankOf(redis, mission, mode, score) : undefined
      return res.status(200).json({ enabled: true, mission, mode, ...board, ...(rank ? { rank } : {}) })
    }

    if (req.method === 'POST') {
      const mode = modeOf(req.body?.mode)
      if (!redis) return res.status(200).json(empty(today, mode))
      const limited = await submitLimiter(redis).limit(newsletterClientIp(req))
      if (!limited.success) {
        return res.status(429).json(empty(today, mode, 'Too many scores from this connection. Try again in a few minutes.'))
      }
      const checked = validateSubmission(req.body, today, process.env.TOUCHDOWN_NAME_BLOCKLIST)
      if (!checked.ok) return res.status(400).json(empty(today, mode, checked.error))
      const rank = await submitScore(redis, checked.value)
      const board = await readBoard(redis, checked.value.mission, checked.value.mode)
      return res.status(200).json({
        enabled: true,
        mission: checked.value.mission,
        mode: checked.value.mode,
        ...board,
        rank,
      })
    }

    if (req.method === 'DELETE') {
      const admin = process.env.TOUCHDOWN_ADMIN_TOKEN
      if (!admin || admin.length < 16 || req.headers['x-touchdown-admin'] !== admin) {
        return res.status(403).json({ ok: false })
      }
      if (!redis) return res.status(200).json({ ok: false })
      const ok = await removeEntry(redis, Number(req.query.m), modeOf(req.query.mode), String(req.query.name ?? ''))
      return res.status(200).json({ ok })
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ ok: false })
  } catch (err) {
    console.error('touchdown leaderboard failed', err)
    // Never let the board break the game.
    return res.status(200).json({ ...empty(today, modeOf(req.query.mode ?? req.body?.mode)), enabled: false })
  }
}
