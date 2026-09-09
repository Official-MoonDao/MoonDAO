// On-chain event access for DePrize pages: DePrizeMint `Bet` logs (who backed
// what) and LMSR `AMMOutcomeTokenTrade` logs (how prices moved, cash-outs).
//
// Primary source is `/api/deprize/logs` (Etherscan V2 behind a server key):
// one request covers the whole range since deployment and includes block
// timestamps. Fallback is chunked `eth_getLogs` through thirdweb when the API
// route is unavailable (no key, explorer outage). Results are cached per
// session so navigating between pages doesn't refetch.

import { getContractEvents, prepareEvent, type Chain, type ThirdwebContract } from 'thirdweb'
import { eth_blockNumber, eth_getBlockByNumber, getRpcClient } from 'thirdweb/rpc'
import { decodeEventLog, parseAbiItem, toEventSelector, type Hex } from 'viem'
import { deprizeReadClient } from './read'

export const BET_EVENT_SIGNATURE =
  'event Bet(uint256 indexed deprizeId, address indexed bettor, uint256 outcomeIndex, uint256 outcomeTokenAmount, uint256 cost, uint256 slice)' as const
export const TRADE_EVENT_SIGNATURE =
  'event AMMOutcomeTokenTrade(address indexed transactor, int256[] outcomeTokenAmounts, int256 outcomeTokenNetCost, uint256 marketFees)' as const
export const FUNDING_EVENT_SIGNATURE = 'event AMMFundingChanged(int256 fundingChange)' as const

export function betEvent(deprizeId: bigint) {
  return prepareEvent({ signature: BET_EVENT_SIGNATURE, filters: { deprizeId } })
}
export const tradeEvent = () => prepareEvent({ signature: TRADE_EVENT_SIGNATURE })
export const fundingEvent = () => prepareEvent({ signature: FUNDING_EVENT_SIGNATURE })

export type RawLog<TArgs> = {
  args: TArgs
  blockNumber: bigint
  logIndex: number
  transactionHash: string
  /** Unix ms when known from the source (explorer API); NaN otherwise. */
  timestampMs: number
}

// ---- Explorer-backed fetch ------------------------------------------------

type ExplorerLog = {
  topics: string[]
  data: string
  blockNumber: string
  timeStamp: string
  logIndex: string
  transactionHash: string
}

const pad32 = (v: bigint): Hex => `0x${v.toString(16).padStart(64, '0')}`

/**
 * Fetch and decode one event type from the explorer-backed API route.
 * `topic1` filters on the first indexed argument. Throws on any failure so the
 * caller can fall back to RPC.
 */
export async function fetchEventsViaExplorer<T>(args: {
  chainId: number
  address: string
  signature: string
  fromBlock: bigint
  topic1?: bigint
  gen?: number
}): Promise<RawLog<T>[]> {
  if (typeof window === 'undefined') throw new Error('explorer fetch is browser-only')
  const abiItem = parseAbiItem(args.signature)
  const topic0 = toEventSelector(abiItem as any)
  const q = new URLSearchParams({
    chainId: String(args.chainId),
    address: args.address,
    fromBlock: args.fromBlock.toString(),
    topic0,
  })
  if (args.topic1 !== undefined) q.set('topic1', pad32(args.topic1))
  if (args.gen) q.set('gen', String(args.gen))
  const r = await fetch(`/api/deprize/logs?${q.toString()}`)
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error(body?.error || `logs api ${r.status}`)
  }
  const { logs } = (await r.json()) as { logs: ExplorerLog[] }
  const out: RawLog<T>[] = []
  for (const l of logs) {
    try {
      const decoded = decodeEventLog({
        abi: [abiItem as any],
        data: l.data as Hex,
        topics: l.topics as [Hex, ...Hex[]],
      }) as { args: unknown }
      out.push({
        args: decoded.args as T,
        blockNumber: BigInt(l.blockNumber),
        logIndex: l.logIndex && l.logIndex !== '0x' ? Number(BigInt(l.logIndex)) : 0,
        transactionHash: l.transactionHash,
        timestampMs: Number(BigInt(l.timeStamp)) * 1000,
      })
    } catch {
      /* skip undecodable rows */
    }
  }
  return sortLogs(out)
}

// ---- RPC fallback ---------------------------------------------------------

const MIN_CHUNK = 2_000n

function isRangeError(e: unknown): boolean {
  const msg = `${(e as any)?.message ?? ''} ${(e as any)?.shortMessage ?? ''} ${(e as any)?.details ?? ''}`.toLowerCase()
  return (
    msg.includes('range') ||
    msg.includes('limit') ||
    msg.includes('too many') ||
    msg.includes('10000') ||
    msg.includes('exceed') ||
    msg.includes('timeout') ||
    msg.includes('too large') ||
    msg.includes('429')
  )
}

/**
 * Fetch logs for `events` between `fromBlock` and `toBlock` inclusive over RPC.
 * Tries the whole range in one request; on a range-style error splits into
 * chunks and halves the chunk size on further errors down to MIN_CHUNK.
 */
export async function fetchEventsChunked<T>(args: {
  contract: ThirdwebContract
  events: any[]
  fromBlock: bigint
  toBlock: bigint
  initialChunk?: bigint
}): Promise<RawLog<T>[]> {
  const { contract, events, fromBlock, toBlock } = args
  if (toBlock < fromBlock) return []

  const normalize = (logs: any[]): RawLog<T>[] =>
    logs.map((l) => ({
      args: l.args as T,
      blockNumber: BigInt(l.blockNumber ?? 0),
      logIndex: Number(l.logIndex ?? 0),
      transactionHash: String(l.transactionHash ?? ''),
      timestampMs: NaN,
    }))

  try {
    const logs = await getContractEvents({ contract, events, fromBlock, toBlock, useIndexer: false })
    return sortLogs(normalize(logs as any[]))
  } catch (e) {
    if (!isRangeError(e)) throw e
  }

  const out: RawLog<T>[] = []
  let chunk = args.initialChunk ?? 9_000n
  let from = fromBlock
  while (from <= toBlock) {
    const to = from + chunk - 1n > toBlock ? toBlock : from + chunk - 1n
    try {
      const logs = await getContractEvents({
        contract,
        events,
        fromBlock: from,
        toBlock: to,
        useIndexer: false,
      })
      out.push(...normalize(logs as any[]))
      from = to + 1n
    } catch (e) {
      if (!isRangeError(e) || chunk <= MIN_CHUNK) throw e
      chunk = chunk / 2n < MIN_CHUNK ? MIN_CHUNK : chunk / 2n
    }
  }
  return sortLogs(out)
}

function sortLogs<T>(logs: RawLog<T>[]): RawLog<T>[] {
  return logs.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1
    return a.logIndex - b.logIndex
  })
}

export async function latestBlock(chain: Chain): Promise<bigint> {
  return eth_blockNumber(getRpcClient({ client: deprizeReadClient, chain }))
}

const tsCache = new Map<string, number>()

/** Block number → unix ms for a set of blocks (deduped, cached, 6 in flight). */
export async function fetchBlockTimestamps(
  chain: Chain,
  blocks: bigint[],
): Promise<Map<bigint, number>> {
  const rpc = getRpcClient({ client: deprizeReadClient, chain })
  const unique = Array.from(new Set(blocks.map((b) => b.toString()))).map((s) => BigInt(s))
  const result = new Map<bigint, number>()
  const pending: bigint[] = []
  for (const b of unique) {
    const hit = tsCache.get(`${chain.id}:${b}`)
    if (hit !== undefined) result.set(b, hit)
    else pending.push(b)
  }
  for (let i = 0; i < pending.length; i += 6) {
    const slice = pending.slice(i, i + 6)
    const got = await Promise.all(
      slice.map(async (b) => {
        try {
          const block = await eth_getBlockByNumber(rpc, { blockNumber: b })
          return [b, Number(block.timestamp) * 1000] as const
        } catch {
          return [b, NaN] as const
        }
      }),
    )
    for (const [b, ts] of got) {
      if (Number.isFinite(ts)) {
        tsCache.set(`${chain.id}:${b}`, ts)
        result.set(b, ts)
      }
    }
  }
  return result
}

/** Fill in NaN timestamps from RPC block headers. */
export async function withTimestamps<T>(chain: Chain, logs: RawLog<T>[]): Promise<RawLog<T>[]> {
  const missing = logs.filter((l) => !Number.isFinite(l.timestampMs)).map((l) => l.blockNumber)
  if (!missing.length) return logs
  const ts = await fetchBlockTimestamps(chain, missing)
  return logs.map((l) =>
    Number.isFinite(l.timestampMs) ? l : { ...l, timestampMs: ts.get(l.blockNumber) ?? NaN },
  )
}

// ---- Session cache -------------------------------------------------------
const sessionCache = new Map<string, { gen: number; promise: Promise<unknown> }>()

/**
 * Memoize an async fetch for this browser session. `gen` is a monotonically
 * increasing refresh generation (e.g. the page's refreshNonce): an entry is
 * reused only if it was fetched at that generation or later, so several hooks
 * bumping the same generation share one refetch.
 */
export function cached<T>(key: string, gen: number, fn: () => Promise<T>): Promise<T> {
  const hit = sessionCache.get(key)
  if (hit && hit.gen >= gen) return hit.promise as Promise<T>
  const promise = fn().catch((e) => {
    const cur = sessionCache.get(key)
    if (cur?.promise === promise) sessionCache.delete(key)
    throw e
  })
  sessionCache.set(key, { gen, promise })
  return promise
}
