import { isOperator } from 'middleware/isOperator'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  RANGE_DAYS,
  RangeKey,
  getAnalyticsReport,
  getMissingConfig,
} from '@/lib/analytics/ga4DataApi'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const missing = getMissingConfig()
  if (missing.length > 0) {
    return res.status(200).json({ configured: false, missing })
  }

  const requested = String(req.query.range)
  const range: RangeKey = requested in RANGE_DAYS ? (requested as RangeKey) : '28d'

  try {
    const report = await getAnalyticsReport(range, req.query.fresh === '1')
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).json({ configured: true, report })
  } catch (err: any) {
    console.error('[operator/analytics]', err)
    return res.status(500).json({ error: err?.message || 'analytics report failed' })
  }
}

export default withMiddleware(handler, isOperator)
