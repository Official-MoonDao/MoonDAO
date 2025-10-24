import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { getBackers } from '@/lib/mission'

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<any> {
  const { projectId, missionId } = req.query

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')

  try {
    const backers = await getBackers(projectId, missionId)
    return backers
  } catch (error) {
    console.error('Failed to fetch backers:', error)
    throw new Error('Failed to fetch backers')
  }
}

export default withMiddleware(handler, rateLimit)
