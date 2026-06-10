import type { NextApiRequest, NextApiResponse } from 'next'
import { notifyNewContributions } from '@/lib/contributions/notifyNewContributions'

// Polled by the "Contribution Discord Notifications" GitHub Actions cron (and
// triggerable manually). Diffs the Community Circle contributions sheet against
// the rows we've already announced and posts the new ones to Discord.
//
// Auth: matches the townhall cron — a shared `CRON_SECRET` passed as either an
// `Authorization: Bearer <secret>` header, an `x-cron-secret` header, or a
// `?secret=` query param. When `CRON_SECRET` is unset the route is open (parity
// with the existing cron endpoints); the work is idempotent so repeated calls
// post nothing once rows are seen.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const first = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v

  const authHeader = first(req.headers['authorization'])
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null
  const provided =
    bearerToken || first(req.headers['x-cron-secret']) || first(req.query.secret)
  const expectedSecret = process.env.CRON_SECRET

  if (expectedSecret && provided !== expectedSecret) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const result = await notifyNewContributions()
    const status = result.ok ? 200 : 500
    return res.status(status).json(result)
  } catch (error) {
    console.error('[cron/contribution-notifications]', error)
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
