/**
 * Canonical, on-chain subscription revenue.
 *
 * Bypasses the cached/incremental pipeline in revenue.ts and goes straight to
 * Etherscan v2 (Arbitrum) for internal transactions on the treasury, then
 * filters the ones whose `from` is the Citizen NFT or Team NFT contract.
 *
 * This is the source of truth used by /api/eb/audit and /api/eb/rewards. It
 * is deterministic — the only inputs are the public Etherscan API and a fixed
 * set of contract addresses.
 *
 * Verify with:
 *   curl "https://api.etherscan.io/v2/api?chainid=42161&module=account\
 *        &action=txlistinternal&address=0xAF26a002d716508b7e375f1f620338442F5470c0\
 *        &startblock=0&endblock=99999999&sort=asc&apikey=YOUR_KEY"
 */
import {
  CITIZEN_ADDRESSES,
  TEAM_ADDRESSES,
  MOONDAO_ARBITRUM_TREASURY,
} from 'const/config'

const CITIZEN_ADDRESS = CITIZEN_ADDRESSES['arbitrum']
const TEAM_ADDRESS = TEAM_ADDRESSES['arbitrum']

interface InternalTx {
  blockNumber: string
  timeStamp: string
  hash: string
  from: string
  to: string
  value: string
  isError: string
}

interface TxRecord {
  timestamp: number // ms
  valueETH: number
  hash: string
}

let memo: { fetchedAt: number; txs: InternalTx[] } | null = null
const TTL_MS = 10 * 60 * 1000 // 10 min

async function fetchAllInternalTxs(): Promise<InternalTx[]> {
  if (memo && Date.now() - memo.fetchedAt < TTL_MS) {
    return memo.txs
  }

  const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY
  if (!apiKey) throw new Error('NEXT_PUBLIC_ETHERSCAN_API_KEY missing')

  const url =
    `https://api.etherscan.io/v2/api?chainid=42161` +
    `&module=account&action=txlistinternal` +
    `&address=${MOONDAO_ARBITRUM_TREASURY}` +
    `&startblock=0&endblock=99999999&sort=asc` +
    `&apikey=${apiKey}`

  // Retry on Etherscan rate-limit ("NOTOK") and transient HTTP errors.
  // Etherscan free tier: 5 req/sec; we may collide with other helpers.
  const maxAttempts = 6
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = (await resp.json()) as {
        status: string
        message: string
        result: any
      }
      // Etherscan returns status="0" message="NOTOK" with result="Max calls
      // per sec rate limit reached" when we're throttled. Treat as retryable.
      if (data.status !== '1') {
        const resultStr = typeof data.result === 'string' ? data.result : ''
        const isRateLimit =
          data.message === 'NOTOK' ||
          /rate limit|max calls/i.test(resultStr)
        if (isRateLimit && attempt < maxAttempts) {
          const backoff = 600 * attempt
          await new Promise((r) => setTimeout(r, backoff))
          continue
        }
        if (Array.isArray(data.result) && data.result.length === 0) {
          // Empty result is legitimate
          memo = { fetchedAt: Date.now(), txs: [] }
          return []
        }
        throw new Error(`Etherscan v2 error: ${data.message} ${resultStr}`)
      }
      const txs = (data.result as InternalTx[]) || []
      memo = { fetchedAt: Date.now(), txs }
      return txs
    } catch (err) {
      if (attempt >= maxAttempts) throw err
      await new Promise((r) => setTimeout(r, 600 * attempt))
    }
  }
  throw new Error('canonicalRevenue: exhausted retries')
}

function filterFromTo(
  txs: InternalTx[],
  from: string,
  to: string,
  startMs: number,
  endMs: number
): TxRecord[] {
  const fromLc = from.toLowerCase()
  const toLc = to.toLowerCase()
  return txs
    .filter(
      (t) =>
        t.from?.toLowerCase() === fromLc &&
        t.to?.toLowerCase() === toLc &&
        t.isError === '0'
    )
    .map((t) => ({
      timestamp: parseInt(t.timeStamp, 10) * 1000,
      valueETH: parseInt(t.value, 10) / 1e18,
      hash: t.hash,
    }))
    .filter(
      (t) =>
        t.valueETH > 0 && t.timestamp >= startMs && t.timestamp <= endMs
    )
    .sort((a, b) => a.timestamp - b.timestamp)
}

export interface CanonicalSubscriptionRevenue {
  startMs: number
  endMs: number
  citizen: {
    txCount: number
    totalETH: number
    totalUSD: number
    transactions: TxRecord[]
  }
  team: {
    txCount: number
    totalETH: number
    totalUSD: number
    transactions: TxRecord[]
  }
  totalETH: number
  totalUSD: number
  ethPriceUSD: number
  source: string
}

/**
 * Get canonical subscription revenue (Citizen + Team NFT mints) directed to the
 * Arbitrum treasury, for an arbitrary [startMs, endMs] window.
 */
export async function getCanonicalSubscriptionRevenue(
  startMs: number,
  endMs: number,
  ethPriceUSD: number
): Promise<CanonicalSubscriptionRevenue> {
  const txs = await fetchAllInternalTxs()
  const cit = filterFromTo(txs, CITIZEN_ADDRESS, MOONDAO_ARBITRUM_TREASURY, startMs, endMs)
  const tm = filterFromTo(txs, TEAM_ADDRESS, MOONDAO_ARBITRUM_TREASURY, startMs, endMs)

  const citEth = cit.reduce((s, t) => s + t.valueETH, 0)
  const teamEth = tm.reduce((s, t) => s + t.valueETH, 0)

  return {
    startMs,
    endMs,
    citizen: {
      txCount: cit.length,
      totalETH: citEth,
      totalUSD: citEth * ethPriceUSD,
      transactions: cit,
    },
    team: {
      txCount: tm.length,
      totalETH: teamEth,
      totalUSD: teamEth * ethPriceUSD,
      transactions: tm,
    },
    totalETH: citEth + teamEth,
    totalUSD: (citEth + teamEth) * ethPriceUSD,
    ethPriceUSD,
    source:
      'https://api.etherscan.io/v2/api?chainid=42161&module=account&action=txlistinternal&address=' +
      MOONDAO_ARBITRUM_TREASURY,
  }
}
