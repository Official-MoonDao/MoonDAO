import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  isSupportedRpcChain,
  proxyJsonRpcRequest,
} from '@/lib/rpc/serverJsonRpc'

function parseChainId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return NaN
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : NaN
}

function isJsonRpcPayload(body: unknown): boolean {
  if (Array.isArray(body)) {
    return (
      body.length > 0 &&
      body.every(
        (item) =>
          item &&
          typeof item === 'object' &&
          (item as { jsonrpc?: string }).jsonrpc === '2.0' &&
          typeof (item as { method?: string }).method === 'string'
      )
    )
  }
  return (
    !!body &&
    typeof body === 'object' &&
    (body as { jsonrpc?: string }).jsonrpc === '2.0' &&
    typeof (body as { method?: string }).method === 'string'
  )
}

function normalizeIp(ip?: string | null): string {
  if (!ip) return '0.0.0.0'
  ip = ip.replace(/:\d+$/, '')
  if (ip.startsWith('::ffff:')) ip = ip.slice(7)
  return ip.toLowerCase()
}

function getTrustedClientIp(req: NextApiRequest): string {
  const h = req.headers
  const vercel = (h['x-vercel-proxied-for'] as string | undefined)?.trim()
  const real = (h['x-real-ip'] as string | undefined)?.trim()
  const cf = (h['cf-connecting-ip'] as string | undefined)?.trim()
  const ip =
    vercel ||
    real ||
    cf ||
    (h['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '0.0.0.0'
  return normalizeIp(ip)
}

// Dashboard mounts fire many batched JSON-RPC posts; the global API limiter
// (25/s) is too tight for this hot path. Keep abuse protection, but allow a
// realistic signed-in burst.
const redis =
  process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_URL,
        token: process.env.UPSTASH_REDIS_TOKEN,
      })
    : null

const rpcRateLimitSecond = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1 s') })
  : null
const rpcRateLimitMinute = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(2000, '1 m') })
  : null

async function enforceRpcRateLimit(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_ENV !== 'prod') return true
  if (!rpcRateLimitSecond || !rpcRateLimitMinute) return true

  const ip = getTrustedClientIp(req)
  const [sec, min] = await Promise.all([
    rpcRateLimitSecond.limit(`rpc-sec:${ip}`),
    rpcRateLimitMinute.limit(`rpc-min:${ip}`),
  ])

  if (!sec.success || !min.success) {
    const reset = !sec.success ? sec.reset : min.reset
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
    res.setHeader('Retry-After', String(retryAfter))
    res.status(429).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32005, message: 'Too Many Requests' },
    })
    return false
  }
  return true
}

/**
 * Browser-facing JSON-RPC proxy with Infura → public RPC fallback.
 *
 * Client chain configs point here (`/api/rpc/<chainId>`) so dashboard reads
 * (balances, hats, fee hook, etc.) no longer die when the shared Infura key
 * returns HTTP 429. Server-side code keeps using Infura directly via
 * `serverJsonRpc` / chain `rpc` URLs.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!(await enforceRpcRateLimit(req, res))) return

  const chainId = parseChainId(req.query.chainId)
  if (!Number.isFinite(chainId) || !isSupportedRpcChain(chainId)) {
    return res.status(400).json({ error: `Unsupported chain ID: ${req.query.chainId}` })
  }

  if (!isJsonRpcPayload(req.body)) {
    return res.status(400).json({ error: 'Invalid JSON-RPC payload' })
  }

  try {
    const { status, body } = await proxyJsonRpcRequest(chainId, req.body)
    return res.status(status).json(body)
  } catch (err) {
    console.error(`[api/rpc/${chainId}] proxy failed:`, err)
    return res.status(502).json({
      error: err instanceof Error ? err.message : 'RPC proxy failed',
    })
  }
}
