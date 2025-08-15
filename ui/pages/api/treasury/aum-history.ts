import { setPublicHeaders } from 'middleware/publicHeaders'
import { NextApiRequest, NextApiResponse } from 'next'
import { getAUMHistory } from '@/lib/coinstats'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers for all requests
  setPublicHeaders(res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { days = '365' } = req.query
    const numDays = parseInt(String(days), 10)

    const aumHistory = await getAUMHistory(numDays)

    res.setHeader(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=7200'
    )
    res.status(200).json(aumHistory)
  } catch (error) {
    console.error('AUM History API Error:', error)
    res.status(500).json({ error: 'Failed to fetch AUM history' })
  }
}
