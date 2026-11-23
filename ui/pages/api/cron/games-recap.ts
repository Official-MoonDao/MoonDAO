/**
 * Daily Discord recap of the mini games' leaderboards: the podium of
 * yesterday's mission for Touchdown and Starship Catch.
 *
 * Triggered by .github/workflows/games-recap.yml an hour after the mission
 * rolls over at 00:00 UTC, so runs that were still going at midnight have
 * landed on yesterday's board. Posts at most once per mission; reruns answer
 * `already-posted`. `?mission=N` re-targets an earlier day (manual reruns).
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { authorizeCronRequest, cronSecretFromRequest } from '@/lib/deprize/reconcile'
import { readRecaps } from '@/lib/games/boards'
import { postDailyRecap } from '@/lib/games/discordAlerts'
import { leaderboardRedis } from '@/lib/touchdown/leaderboardStore'
import { missionNumberFor } from '@/lib/touchdown/mission'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = authorizeCronRequest({
    production: process.env.NEXT_PUBLIC_ENV === 'prod',
    expectedSecret: process.env.CRON_SECRET,
    providedSecret: cronSecretFromRequest(req),
  })
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message })

  const redis = leaderboardRedis()
  if (!redis) return res.status(200).json({ configured: false })

  const today = missionNumberFor()
  const requested = Number(req.query.mission)
  const mission = Number.isInteger(requested) && requested >= 1 && requested < today ? requested : today - 1
  if (mission < 1) return res.status(200).json({ configured: true, posted: false, reason: 'no-missions-yet' })

  try {
    const outcome = await postDailyRecap(redis, mission, (m) => readRecaps(redis, m))
    return res.status(200).json({ configured: true, ...outcome })
  } catch (err: any) {
    console.error('[games recap] failed', err)
    return res.status(500).json({ configured: true, posted: false, mission, error: String(err?.message ?? err) })
  }
}
