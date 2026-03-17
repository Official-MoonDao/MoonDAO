import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getRecentPublicNewsletters } from '@/lib/newsletter/newsletterData'

const emptyResponse = (res: NextApiResponse) =>
  res.status(200).json({ newsletters: [], total: 0, source: null })

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const CONVERTKIT_API_KEY =
      process.env.CONVERT_KIT_V4_API_KEY || process.env.CONVERT_KIT_API_KEY

    if (!CONVERTKIT_API_KEY) {
      console.log('[newsletters] API key not found')
      return emptyResponse(res)
    }

    let allBroadcasts: any[] = []
    const endpoints = [
      'https://api.kit.com/v4/broadcasts',
      'https://api.convertkit.com/v4/broadcasts',
    ]

    for (const endpoint of endpoints) {
      try {
        const url = `${endpoint}?per_page=100`
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Kit-Api-Key': CONVERTKIT_API_KEY,
          },
        })

        const body = await response.json().catch(() => ({}))
        if (response.ok && body.broadcasts && Array.isArray(body.broadcasts)) {
          if (body.broadcasts.length > 0) {
            console.log(`[newsletters] Fetched ${body.broadcasts.length} broadcasts from ${endpoint}`)
          }
          for (const broadcast of body.broadcasts) {
            if (!allBroadcasts.find((b) => b.id === broadcast.id)) {
              allBroadcasts.push(broadcast)
            }
          }
          break
        } else {
          const errMsg = body?.errors?.[0] || body?.message || body?.error || ''
          console.warn(`[newsletters] ${endpoint} failed: ${response.status}`, errMsg)
          if (response.status === 401) {
            console.warn('[newsletters] API key may be invalid - check CONVERT_KIT_V4_API_KEY')
          }
        }
      } catch (err) {
        console.warn(`[newsletters] ${endpoint} error:`, err)
      }
    }

    if (allBroadcasts.length === 0) {
      return emptyResponse(res)
    }

    const newsletters = getRecentPublicNewsletters(allBroadcasts)

    if (newsletters.length === 0) {
      return emptyResponse(res)
    }

    res.status(200).json({
      newsletters,
      total: newsletters.length,
      source: 'convertkit',
    })
  } catch (error) {
    console.error('[newsletters] Error:', error)
    return emptyResponse(res)
  }
}

export default withMiddleware(handler, rateLimit)
