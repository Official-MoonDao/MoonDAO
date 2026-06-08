import { Redis } from '@upstash/redis'
import { secureHeaders } from 'middleware/secureHeaders'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  detectUserState,
  getCountryFromHeaders,
  isValidUSState,
} from '../../../lib/geo'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

/**
 * Lightweight geo lookup so the UI can choose the right Coinbase onramp flow:
 * the Headless (Apple Pay / Google Pay) checkout is US-only, while the hosted
 * redirect remains the fallback for everyone else.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  secureHeaders(res)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let country = getCountryFromHeaders(req)
  let state: string | null = null

  if (!country || country === 'US') {
    try {
      state = await detectUserState(req, redis)
      if (state && isValidUSState(state)) {
        country = 'US'
      }
    } catch (error) {
      console.error('[region] state detection error:', error)
    }
  }

  return res.status(200).json({
    country: country || null,
    state,
    isUS: country === 'US',
  })
}
