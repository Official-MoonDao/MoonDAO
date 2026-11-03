import type { NextApiRequest, NextApiResponse } from 'next'
import { getOnchainFeedContributions } from '@/lib/contributions/getOnchainContributions'
import { getSheetContributions, type Contribution } from '@/lib/contributions/getSheetContributions'

export type { Contribution }

function time(c: Contribution): number {
  const t = new Date(c.timestamp).getTime()
  return Number.isNaN(t) ? 0 : t
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // While the Google Form is still open, show both sources. The onchain read
    // is empty until the table is deployed, and a failed read must not hide the
    // sheet.
    const [sheet, onchain] = await Promise.all([
      getSheetContributions(),
      getOnchainFeedContributions().catch((err) => {
        console.error('[contributions/feed] onchain read failed', err)
        return [] as Contribution[]
      }),
    ])
    const contributions = onchain.length
      ? [...onchain, ...sheet].sort((a, b) => time(b) - time(a))
      : sheet

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ contributions })
  } catch (error) {
    console.error('[contributions/feed]', error)
    return res.status(500).json({
      message: 'Failed to fetch contributions',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
