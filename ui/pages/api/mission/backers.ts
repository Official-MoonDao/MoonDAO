import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { getBackers } from '@/lib/mission'

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<any> {
  const { projectId, missionId } = req.query

  setCDNCacheHeaders(res, 60, 60, 'Accept-Encoding, projectId, missionId')

  try {
    const backers = await getBackers(projectId, missionId)
    return res.status(200).json({ backers })
  } catch (error) {
    console.error('Failed to fetch backers:', error)
    return res.status(500).json({ error: 'Failed to fetch backers' })
  }
}

export default withMiddleware(handler, rateLimit)
