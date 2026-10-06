import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getCountryFromHeaders, isEUCountry } from '../../../lib/geo'

/**
 * GET /api/geo/country
 * Returns the requesting user's country code from Vercel/Cloudflare geo headers.
 * Used client-side to decide whether to show the cookie consent banner and
 * whether to allow on-chain profile creation.
 * - `country` is null when the country cannot be determined.
 * - `restricted` is true for EU/EEA visitors, who can browse the site but may
 *   not permanently store personal data on chain (GDPR compliance).
 * Do not cache this. A cached miss kept showing the cookie banner to US
 * visitors for an hour after the header was missing on the first request.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const country = getCountryFromHeaders(req)

  res.setHeader('Cache-Control', 'private, no-store')
  return res.status(200).json({ country, restricted: isEUCountry(country) })
}

export default withMiddleware(handler, rateLimit)
