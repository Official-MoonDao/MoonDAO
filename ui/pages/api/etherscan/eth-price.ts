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

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Race etherscan + coingecko in parallel so a slow primary source doesn't
  // gate the response on its full timeout. Whichever returns a valid number
  // first wins; cryptocompare is only used if both of those fail.
  const [etherscan, coingecko] = await Promise.all([
    fetchEtherscan(),
    fetchCoinGecko(),
  ])

  let result = etherscan ?? coingecko
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
