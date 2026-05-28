import { NextApiRequest, NextApiResponse } from 'next'
import { authMiddleware } from 'middleware/authMiddleware'
import { secureHeaders } from 'middleware/secureHeaders'
import withMiddleware from 'middleware/withMiddleware'
import { getCountryFromHeaders } from '../../../lib/geo'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  secureHeaders(res)

  const country = getCountryFromHeaders(req)
  return res.status(200).json({
    country: country || null,
    isUS: country === 'US',
  })
}

export default withMiddleware(handler, authMiddleware)
