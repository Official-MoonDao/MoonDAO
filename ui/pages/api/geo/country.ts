import type { NextApiRequest, NextApiResponse } from 'next'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { getCountryFromHeaders } from '../../../lib/geo'

/**
 * GET /api/geo/country
 * Returns the requesting user's country code (from Vercel/Cloudflare geo headers).
 * Used client-side to decide whether to show the cookie consent banner.
 * Returns `country: null` when the country cannot be determined.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const country = getCountryFromHeaders(req)

  // Geo derives only from request headers, so this is safe to cache briefly.
  res.setHeader('Cache-Control', 'private, max-age=3600')
  return res.status(200).json({ country })
}

export default withMiddleware(handler, rateLimit)
