import {
  SAFE_PROXY_ALLOWED_METHODS,
  buildSafeTxServiceUrl,
  serializeSafeProxyBody,
} from '@/lib/safe/txServiceProxy'
import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'

// rateLimit keys on req.url; collapse every Safe address / tx hash into one bucket per client.
async function safeProxyRateLimit(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  const originalUrl = req.url
  req.url = '/api/safe'
  try {
    await rateLimit(req, res, next)
  } finally {
    req.url = originalUrl
  }
}

/**
 * Proxies the Safe Transaction Service so the `SAFE_API_KEY` stays server-side.
 * The legacy `safe-transaction-<network>.safe.global` hosts redirect to
 * `api.safe.global`, whose keyless tier returns 429 "Monthly quota exceeded",
 * leaving treasuries showing no balances or pending transactions.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!req.method || !SAFE_PROXY_ALLOWED_METHODS.includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const chainId = req.query.chainId
  const target = buildSafeTxServiceUrl(chainId, req.query.path, req.url)
  if ('error' in target) {
    return res.status(400).json({ error: target.error })
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (process.env.SAFE_API_KEY) {
    headers.Authorization = `Bearer ${process.env.SAFE_API_KEY}`
  }
  const body = serializeSafeProxyBody(req.method, req.body)
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  try {
    const upstream = await fetch(target.url, {
      method: req.method,
      headers,
      body,
    })
    const text = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    if (req.method === 'GET' && upstream.ok) {
      setCDNCacheHeaders(res, 5, 10)
    }
    return res.send(text)
  } catch (err) {
    console.error(`[api/safe/${chainId}] proxy failed:`, err)
    return res.status(502).json({ error: 'Safe Transaction Service proxy failed' })
  }
}

export default withMiddleware(handler, safeProxyRateLimit)
