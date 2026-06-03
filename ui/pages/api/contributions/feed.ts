import type { NextApiRequest, NextApiResponse } from 'next'
import {
  getSheetContributions,
  type Contribution,
} from '@/lib/contributions/getSheetContributions'

export type { Contribution }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const contributions = await getSheetContributions()

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
