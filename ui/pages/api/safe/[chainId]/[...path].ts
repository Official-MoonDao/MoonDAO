import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'

// Safe Transaction Service short names: https://docs.safe.global/advanced/smart-account-supported-networks
const SAFE_TX_SERVICE_SHORT_NAMES: Record<number, string> = {
  1: 'eth',
  10: 'oeth',
  137: 'pol',
  8453: 'base',
  42161: 'arb1',
  84532: 'basesep',
  11155111: 'sep',
}

const ALLOWED_METHODS = ['GET', 'POST', 'DELETE']

/**
 * Proxies the Safe Transaction Service so the `SAFE_API_KEY` stays server-side.
 * The legacy `safe-transaction-<network>.safe.global` hosts redirect to
 * `api.safe.global`, whose keyless tier returns 429 "Monthly quota exceeded",
 * leaving treasuries showing no balances or pending transactions.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!req.method || !ALLOWED_METHODS.includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const chainId = Number(req.query.chainId)
  const shortName = SAFE_TX_SERVICE_SHORT_NAMES[chainId]
  if (!shortName) {
    return res.status(400).json({ error: `Unsupported chain ID: ${req.query.chainId}` })
  }

  const segments = Array.isArray(req.query.path) ? req.query.path : []
  if (
    !['v1', 'v2'].includes(segments[0]) ||
    segments.some((s) => !/^[A-Za-z0-9_-]+$/.test(s))
  ) {
    return res.status(400).json({ error: 'Invalid path' })
  }

  const search = req.url?.includes('?') ? `?${req.url.split('?')[1]}` : ''
  const url = `https://api.safe.global/tx-service/${shortName}/api/${segments.join('/')}/${search}`

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (process.env.SAFE_API_KEY) {
    headers.Authorization = `Bearer ${process.env.SAFE_API_KEY}`
  }
  const hasBody = req.method !== 'GET' && req.body !== undefined && req.body !== ''
  if (hasBody) headers['Content-Type'] = 'application/json'

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: hasBody
        ? typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body)
        : undefined,
    })
    const text = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    return res.send(text)
  } catch (err) {
    console.error(`[api/safe/${chainId}] proxy failed:`, err)
    return res.status(502).json({ error: 'Safe Transaction Service proxy failed' })
  }
}

export default withMiddleware(handler, rateLimit)
