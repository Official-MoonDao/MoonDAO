import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'

/**
 * Try Etherscan first (so the response shape stays the same as before for
 * any callers that read `result.ethusd`), then fall back to CoinGecko and
 * finally CryptoCompare. We *only* return 5xx if every source fails — a
 * single rate-limit on Etherscan used to zero out the contribution UI
 * because it derives the ETH input from `usd / ethUsdPrice`.
 *
 * Each fallback path normalizes back into the Etherscan-shaped envelope
 * `{ message: 'OK', result: { ethusd: '<price>', source } }` so the client
 * doesn't need to care which source actually served the price.
 */

const PRICE_TTL_SECONDS = 60

type PriceResult = { price: number; source: string }

async function fetchEtherscan(): Promise<PriceResult | null> {
  const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch(
      `https://api.etherscan.io/v2/api?module=stats&action=ethprice&chainid=1&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(4000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const raw = data?.result?.ethusd
    const price = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
    if (data?.message !== 'OK' || !Number.isFinite(price) || price <= 0) {
      return null
    }
    return { price, source: 'etherscan' }
  } catch (err) {
    console.warn('[eth-price] etherscan fetch failed:', err)
    return null
  }
}

async function fetchCoinGecko(): Promise<PriceResult | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { signal: AbortSignal.timeout(4000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const price = Number(data?.ethereum?.usd)
    if (!Number.isFinite(price) || price <= 0) return null
    return { price, source: 'coingecko' }
  } catch (err) {
    console.warn('[eth-price] coingecko fetch failed:', err)
    return null
  }
}

async function fetchCryptoCompare(): Promise<PriceResult | null> {
  try {
    const res = await fetch(
      'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD',
      { signal: AbortSignal.timeout(4000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const price = Number(data?.USD)
    if (!Number.isFinite(price) || price <= 0) return null
    return { price, source: 'cryptocompare' }
  } catch (err) {
    console.warn('[eth-price] cryptocompare fetch failed:', err)
    return null
  }
}

/**
 * Resolves with the first promise that settles with a non-null value.
 *
 * Differs from `Promise.any` in two important ways for our use:
 *  1. Our fetchers return `null` on failure rather than throwing, so a
 *     `null` resolution should be treated like a rejection (keep waiting
 *     for the other source).
 *  2. We deliberately *don't* abort the slower request — we just stop
 *     waiting for it. The slow source's `AbortSignal.timeout` already
 *     bounds the work, and letting it finish in the background is fine
 *     because the serverless invocation will be torn down anyway.
 *
 * Returns `null` only if every input resolves null / rejects.
 */
function raceFirstValid<T>(promises: Promise<T | null>[]): Promise<T | null> {
  if (promises.length === 0) return Promise.resolve(null)
  return new Promise((resolve) => {
    let pending = promises.length
    let settled = false
    const finish = (value: T | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    for (const p of promises) {
      p.then(
        (value) => {
          if (value != null) {
            finish(value)
          } else if (--pending === 0) {
            finish(null)
          }
        },
        () => {
          if (--pending === 0) finish(null)
        }
      )
    }
  })
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Truly race etherscan + coingecko: whichever returns a valid price
  // *first* resolves the response. We don't wait for the slower source to
  // also finish (each has its own 4s timeout, and `Promise.all` would
  // serialize us behind the slowest). Cryptocompare is only consulted if
  // both of the primaries failed/returned null.
  let result = await raceFirstValid([fetchEtherscan(), fetchCoinGecko()])
  if (!result) {
    result = await fetchCryptoCompare()
  }

  if (!result) {
    console.error('[eth-price] all price sources failed')
    return res.status(502).json({ error: 'Failed to fetch current ETH price' })
  }

  setCDNCacheHeaders(res, PRICE_TTL_SECONDS, PRICE_TTL_SECONDS, 'Accept-Encoding')

  return res.status(200).json({
    status: '1',
    message: 'OK',
    result: {
      ethusd: result.price.toString(),
      source: result.source,
    },
  })
}

export default withMiddleware(handler, rateLimit)
