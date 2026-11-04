import { isOperator } from 'middleware/isOperator'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { isArchiveConfigured } from '@/lib/contributions/archive'
import { contributionsCsv, parseCycleParam } from '@/lib/contributions/export'
import { getContributions } from '@/lib/contributions/getContributions'
import { cycleLabel } from '@/lib/contributions/onchain'

// The Senate's review input for one cycle: every contribution from the
// archive and the onchain table, one row each, as CSV. Operators only, since it
// carries wallets.
//
//   GET /api/contributions/export?cycle=20264   (or ?cycle=2026-q4)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' })

  const cycleId = parseCycleParam(req.query.cycle)
  if (cycleId == null) return res.status(400).json({ message: 'Pass ?cycle=20264 or ?cycle=2026-q4.' })
  // Without the archive the export would silently miss every pre-launch row.
  if (!isArchiveConfigured())
    return res.status(503).json({ message: 'The contributions archive is not configured.' })

  const entries = await getContributions({ cycleId })
  // Oldest first, the order reviewers read in.
  const csv = contributionsCsv([...entries].reverse())
  const file = `contributions-${cycleLabel(cycleId).replace(' ', '-').toLowerCase()}.csv`
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${file}"`)
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).send(csv)
}

export default withMiddleware(handler, rateLimit, isOperator)
