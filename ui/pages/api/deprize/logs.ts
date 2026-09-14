import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  ETHERSCAN_SUPPORTED_CHAINS,
  etherscanApiKey,
  fetchEtherscanV2Logs,
  type EtherscanLog,
} from '@/lib/deprize/etherscanLogs'

/**
 * Raw event logs for one contract via the Etherscan V2 API (one key, every
 * chain). The DePrize pages need every `Bet` / `AMMOutcomeTokenTrade` since
 * deployment; RPC `eth_getLogs` is capped at ~10k blocks per call, which is
 * unusable on Arbitrum. Etherscan returns the full range in one page of up to
 * 1000 logs and includes block timestamps.
 *
 * GET /api/deprize/logs?chainId=11155111&address=0x…&fromBlock=N&topic0=0x…[&topic1=0x…]
 * → { logs: [{ address, topics, data, blockNumber, timeStamp, logIndex, transactionHash }], truncated: boolean }
 * `truncated` is true when the result hit the page cap, so the chart treats
 * the rebuilt history as partial and snaps to live prices.
 */

export type { EtherscanLog }

function isHex(v: unknown): v is string {
  return typeof v === 'string' && /^0x[0-9a-fA-F]*$/.test(v)
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = etherscanApiKey()
  if (!apiKey) return res.status(503).json({ error: 'Explorer API key not configured' })

  const chainId = Number(req.query.chainId)
  const address = req.query.address
  const fromBlock = Number(req.query.fromBlock ?? 0)
  const topic0 = req.query.topic0
  const topic1 = req.query.topic1
  if (!ETHERSCAN_SUPPORTED_CHAINS.has(chainId)) {
    return res.status(400).json({ error: 'Unsupported chainId' })
  }
  if (!isHex(address) || address.length !== 42) return res.status(400).json({ error: 'Bad address' })
  if (!Number.isFinite(fromBlock) || fromBlock < 0) {
    return res.status(400).json({ error: 'Bad fromBlock' })
  }
  if (!isHex(topic0) || topic0.length !== 66) return res.status(400).json({ error: 'Bad topic0' })
  if (topic1 !== undefined && (!isHex(topic1) || topic1.length !== 66)) {
    return res.status(400).json({ error: 'Bad topic1' })
  }

  let logs: EtherscanLog[]
  let truncated: boolean
  try {
    ;({ logs, truncated } = await fetchEtherscanV2Logs({
      chainId,
      address,
      fromBlock,
      toBlock: 'latest',
      topic0,
      topic1: typeof topic1 === 'string' ? topic1 : undefined,
      apiKey,
    }))
  } catch (e: any) {
    return res.status(502).json({ error: `Explorer request failed: ${e?.message ?? e}` })
  }

  // Short CDN cache: the page refetches after its own transactions with a
  // cache-busting `gen` query param, so a brief TTL is safe.
  setCDNCacheHeaders(res, 15, 60)
  return res.status(200).json({ logs, truncated })
}

export default withMiddleware(handler, rateLimit)
