import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Raw event logs for one contract via the Etherscan V2 API (one key, every
 * chain). The DePrize pages need every `Bet` / `AMMOutcomeTokenTrade` since
 * deployment; RPC `eth_getLogs` is capped at ~10k blocks per call, which is
 * unusable on Arbitrum. Etherscan returns the full range in one page of up to
 * 1000 logs and includes block timestamps.
 *
 * GET /api/deprize/logs?chainId=11155111&address=0x…&fromBlock=N&topic0=0x…[&topic1=0x…]
 * → { logs: [{ address, topics, data, blockNumber, timeStamp, logIndex, transactionHash }] }
 */

export type EtherscanLog = {
  address: string
  topics: string[]
  data: string
  blockNumber: string // hex
  timeStamp: string // hex seconds
  logIndex: string // hex
  transactionHash: string
}

const SUPPORTED_CHAINS = new Set([1, 11155111, 42161, 421614])
const PAGE = 1000
const MAX_PAGES = 10

function isHex(v: unknown): v is string {
  return typeof v === 'string' && /^0x[0-9a-fA-F]*$/.test(v)
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey =
    process.env.ETHERSCAN_API_KEY ||
    process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ||
    process.env.ARBISCAN_API_KEY
  if (!apiKey) return res.status(503).json({ error: 'Explorer API key not configured' })

  const chainId = Number(req.query.chainId)
  const address = req.query.address
  const fromBlock = Number(req.query.fromBlock ?? 0)
  const topic0 = req.query.topic0
  const topic1 = req.query.topic1
  if (!SUPPORTED_CHAINS.has(chainId)) return res.status(400).json({ error: 'Unsupported chainId' })
  if (!isHex(address) || address.length !== 42) return res.status(400).json({ error: 'Bad address' })
  if (!Number.isFinite(fromBlock) || fromBlock < 0) return res.status(400).json({ error: 'Bad fromBlock' })
  if (!isHex(topic0) || topic0.length !== 66) return res.status(400).json({ error: 'Bad topic0' })
  if (topic1 !== undefined && (!isHex(topic1) || topic1.length !== 66)) {
    return res.status(400).json({ error: 'Bad topic1' })
  }

  const logs: EtherscanLog[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      chainid: String(chainId),
      module: 'logs',
      action: 'getLogs',
      address,
      fromBlock: String(fromBlock),
      toBlock: 'latest',
      topic0,
      page: String(page),
      offset: String(PAGE),
      apikey: apiKey,
    })
    if (topic1) {
      params.set('topic0_1_opr', 'and')
      params.set('topic1', topic1)
    }
    let json: any
    try {
      const r = await fetch(`https://api.etherscan.io/v2/api?${params.toString()}`)
      json = await r.json()
    } catch (e: any) {
      return res.status(502).json({ error: `Explorer request failed: ${e?.message ?? e}` })
    }
    // status "0" + "No records found" is an empty result, not an error.
    if (json?.status !== '1') {
      if (typeof json?.message === 'string' && /no records/i.test(json.message)) break
      return res.status(502).json({ error: json?.result || json?.message || 'Explorer error' })
    }
    const batch = Array.isArray(json.result) ? (json.result as EtherscanLog[]) : []
    logs.push(...batch)
    if (batch.length < PAGE) break
  }

  // Short CDN cache: the page refetches after its own transactions with a
  // cache-busting `gen` query param, so a brief TTL is safe.
  setCDNCacheHeaders(res, 15, 60)
  return res.status(200).json({ logs })
}

export default withMiddleware(handler, rateLimit)
