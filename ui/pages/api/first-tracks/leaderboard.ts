/**
 * First Tracks daily leaderboard.
 *
 *   GET    ?m=<mission>&mode=easy|pro[&score=N]   top 10, yesterday's winner, and the rank `score` would hold
 *   POST   { mission, mode, name, replay }        re-drive the recorded inputs, record that score
 *   DELETE ?m=&mode=&name=                        moderation; needs x-first-tracks-admin
 *
 * Returns `enabled: false` (200) when Redis is not configured, so the game
 * simply hides the board instead of erroring.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { validateSubmission, type FirstTracksBoardResponse } from '@/lib/first-tracks/leaderboard'
import { leaderboardRedis, rankOf, readBoard, removeEntry, submitLimiter, submitScore } from '@/lib/first-tracks/leaderboardStore'
import { modeOf, type ModeId } from '@/lib/first-tracks/modes'
import { base64ToTape, replayRun } from '@/lib/first-tracks/replay'
import { newsletterClientIp } from '@/lib/convert-kit/subscribeRateLimit'
import { missionNumberFor } from '@/lib/touchdown/mission'

export default async function handler(req: NextApiRequest, res: NextApiResponse<FirstTracksBoardResponse | { ok: boolean }>) {
  res.setHeader('Cache-Control', 'no-store')
  const today = missionNumberFor()
  const redis = leaderboardRedis()
  const empty = (mission: number, mode: ModeId, error?: string): FirstTracksBoardResponse => ({
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
      const [board, before] = await Promise.all([readBoard(redis, mission, mode), mission > 1 ? readBoard(redis, mission - 1, mode, 1) : null])
      const score = Number(req.query.score)
      const rank = Number.isInteger(score) && score > 0 ? await rankOf(redis, mission, mode, score) : undefined
      return res.status(200).json({
        enabled: true,
        mission,
        mode,
        ...board,
        ...(rank ? { rank } : {}),
        ...(before?.top[0] ? { yesterday: before.top[0] } : {}),
      })
    }

    if (req.method === 'POST') {
      const mode = modeOf(req.body?.mode)
      if (!redis) return res.status(200).json(empty(today, mode))
      const limited = await submitLimiter(redis).limit(newsletterClientIp(req))
      if (!limited.success) {
        return res.status(429).json(empty(today, mode, 'Too many scores from this connection. Try again in a few minutes.'))
      }
      // Never trust a score from the browser: re-drive the recorded inputs here
      // and score what the sim produces, par included.
      const mission = Number(req.body?.mission)
      const tape = base64ToTape(req.body?.replay)
      if (!tape || !Number.isInteger(mission) || (mission !== today && mission !== today - 1)) {
        return res.status(400).json(empty(today, mode, 'Could not verify this drive.'))
      }
      const flown = replayRun(mission, mode, tape)
      if (!flown) return res.status(400).json(empty(today, mode, 'Could not verify this drive.'))
      if (flown.score < 1) return res.status(400).json(empty(today, mode, 'Only drives that score points go on the board.'))
      const checked = validateSubmission({ ...req.body, score: flown.score }, today, process.env.TOUCHDOWN_NAME_BLOCKLIST)
      if (!checked.ok) return res.status(400).json(empty(today, mode, checked.error))
      const rank = await submitScore(redis, checked.value)
      const board = await readBoard(redis, checked.value.mission, checked.value.mode)
      return res.status(200).json({ enabled: true, mission: checked.value.mission, mode: checked.value.mode, ...board, rank, verifiedScore: checked.value.score })
    }

    if (req.method === 'DELETE') {
      // The same moderation token as the other games' boards.
      const admin = process.env.TOUCHDOWN_ADMIN_TOKEN
      if (!admin || admin.length < 16 || req.headers['x-first-tracks-admin'] !== admin) return res.status(403).json({ ok: false })
      if (!redis) return res.status(200).json({ ok: false })
      const ok = await removeEntry(redis, Number(req.query.m), modeOf(req.query.mode), String(req.query.name ?? ''))
      return res.status(200).json({ ok })
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ ok: false })
  } catch (err) {
    console.error('first tracks leaderboard failed', err)
    // Never let the board break the game.
    return res.status(200).json({ ...empty(today, modeOf(req.query.mode ?? req.body?.mode)), enabled: false })
  }
}
