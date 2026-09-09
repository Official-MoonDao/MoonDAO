// Typed, timestamped DePrize activity rows built from on-chain logs. Shared by
// `useDePrizeActivity` (backers / positions) and `useOddsHistory` (odds
// rebuild), with a session cache so both read one fetch.

import DePrizeMintABI from 'const/abis/DePrizeMint.json'
import LMSRWithTWAP from 'const/abis/LMSRWithTWAP.json'
import { DEPRIZE_EVENTS_FROM_BLOCK, DEPRIZE_MINT_ADDRESSES } from 'const/config'
import { getContract, type Chain } from 'thirdweb'
import type { BetRow, SellRow } from './activity-math'
import { UNIT } from './constants'
import {
  BET_EVENT_SIGNATURE,
  FUNDING_EVENT_SIGNATURE,
  TRADE_EVENT_SIGNATURE,
  betEvent,
  cached,
  fetchEventsChunked,
  fetchEventsViaExplorer,
  fundingEvent,
  latestBlock,
  tradeEvent,
  withTimestamps,
  type RawLog,
} from './events'
import type { FundingLike } from './lmsr-history'
import { deprizeReadChain, deprizeReadClient } from './read'

export type TradeRow = {
  transactor: string // lowercase
  /** Signed outcome-token deltas in ETH units (positive = bought from the AMM). */
  amounts: number[]
  netCostEth: number
  feesEth: number
  blockNumber: bigint
  logIndex: number
  txHash: string
  timestampMs: number
}

export type MarketTrades = {
  trades: TradeRow[]
  fundingChanges: FundingLike[]
}

const toEth = (v: bigint) => Number(v) / Number(UNIT)

export function eventsFromBlock(chainSlug: string): bigint {
  return BigInt(DEPRIZE_EVENTS_FROM_BLOCK[chainSlug] ?? 0)
}

type BetArgs = {
  deprizeId: bigint
  bettor: string
  outcomeIndex: bigint
  outcomeTokenAmount: bigint
  cost: bigint
  slice: bigint
}
type TradeArgs = {
  transactor: string
  outcomeTokenAmounts: readonly bigint[]
  outcomeTokenNetCost: bigint
  marketFees: bigint
}
type FundingArgs = { fundingChange: bigint }

/** Explorer API first (one call, timestamps included); RPC chunks as fallback. */
async function fetchLogs<T>(args: {
  chain: Chain
  address: string
  abi: any
  signature: string
  event: any
  fromBlock: bigint
  topic1?: bigint
  gen: number
}): Promise<RawLog<T>[]> {
  const readChain = deprizeReadChain(args.chain.id)
  try {
    return await fetchEventsViaExplorer<T>({
      chainId: args.chain.id,
      address: args.address,
      signature: args.signature,
      fromBlock: args.fromBlock,
      topic1: args.topic1,
      gen: args.gen,
    })
  } catch (e) {
    console.warn('[deprize] explorer logs unavailable, falling back to RPC', e)
  }
  const contract = getContract({
    client: deprizeReadClient,
    chain: readChain,
    address: args.address,
    abi: args.abi,
  })
  const toBlock = await latestBlock(readChain)
  const logs = await fetchEventsChunked<T>({
    contract,
    events: [args.event],
    fromBlock: args.fromBlock,
    toBlock,
  })
  return withTimestamps(readChain, logs)
}

/** All `Bet` events for one DePrize (indexed filter — never scans other prizes). */
export function fetchDePrizeBets(args: {
  chain: Chain
  chainSlug: string
  deprizeId: number
  gen: number
}): Promise<BetRow[]> {
  const { chain, chainSlug, deprizeId, gen } = args
  const mintAddress = DEPRIZE_MINT_ADDRESSES[chainSlug] ?? ''
  if (!mintAddress) return Promise.resolve([])
  const key = `bets:${chain.id}:${mintAddress}:${deprizeId}`
  return cached(key, gen, async () => {
    const logs = await fetchLogs<BetArgs>({
      chain,
      address: mintAddress,
      abi: DePrizeMintABI,
      signature: BET_EVENT_SIGNATURE,
      event: betEvent(BigInt(deprizeId)),
      fromBlock: eventsFromBlock(chainSlug),
      topic1: BigInt(deprizeId),
      gen,
    })
    return logs
      .filter((l) => BigInt(l.args.deprizeId) === BigInt(deprizeId))
      .map((l) => ({
        bettor: l.args.bettor.toLowerCase(),
        outcomeIndex: Number(l.args.outcomeIndex),
        qty: toEth(l.args.outcomeTokenAmount),
        costEth: toEth(l.args.cost),
        sliceEth: toEth(l.args.slice),
        blockNumber: l.blockNumber,
        logIndex: l.logIndex,
        txHash: l.transactionHash,
        timestampMs: l.timestampMs,
      }))
  })
}

/**
 * All LMSR trades (buys routed through the mint + direct sells) and funding
 * changes for one market. `fromBlock` should be the first Bet block for the
 * DePrize when known (trades cannot precede the first bet), else the registry
 * deploy block.
 */
export function fetchMarketTrades(args: {
  chain: Chain
  marketAddress: string
  fromBlock: bigint
  gen: number
}): Promise<MarketTrades> {
  const { chain, marketAddress, fromBlock, gen } = args
  const key = `trades:${chain.id}:${marketAddress.toLowerCase()}`
  return cached(key, gen, async () => {
    const [tradeLogs, fundingLogs] = await Promise.all([
      fetchLogs<TradeArgs>({
        chain,
        address: marketAddress,
        abi: LMSRWithTWAP.abi,
        signature: TRADE_EVENT_SIGNATURE,
        event: tradeEvent(),
        fromBlock,
        gen,
      }),
      fetchLogs<FundingArgs>({
        chain,
        address: marketAddress,
        abi: LMSRWithTWAP.abi,
        signature: FUNDING_EVENT_SIGNATURE,
        event: fundingEvent(),
        fromBlock,
        gen,
      }).catch(() => [] as RawLog<FundingArgs>[]),
    ])
    const trades: TradeRow[] = tradeLogs.map((l) => ({
      transactor: l.args.transactor.toLowerCase(),
      amounts: l.args.outcomeTokenAmounts.map((a) => toEth(a)),
      netCostEth: toEth(l.args.outcomeTokenNetCost),
      feesEth: toEth(l.args.marketFees),
      blockNumber: l.blockNumber,
      logIndex: l.logIndex,
      txHash: l.transactionHash,
      timestampMs: l.timestampMs,
    }))
    const fundingChanges: FundingLike[] = fundingLogs.map((l) => ({
      timestampMs: l.timestampMs,
      deltaEth: toEth(l.args.fundingChange),
    }))
    return { trades, fundingChanges }
  })
}

/**
 * Cash-outs: trades where the transactor is a wallet (not the mint router) and
 * tokens flowed back to the AMM. One outcome per sell in our UI; pick the most
 * negative leg.
 */
export function sellsFromTrades(trades: TradeRow[], mintAddress: string | undefined): SellRow[] {
  const mint = (mintAddress ?? '').toLowerCase()
  const out: SellRow[] = []
  for (const t of trades) {
    if (mint && t.transactor === mint) continue
    let idx = -1
    let most = 0
    t.amounts.forEach((a, i) => {
      if (a < most) {
        most = a
        idx = i
      }
    })
    if (idx < 0) continue
    out.push({
      seller: t.transactor,
      outcomeIndex: idx,
      qty: -most,
      // netCost is negative for a sell (AMM pays out); fees are deducted.
      proceedsEth: -t.netCostEth - t.feesEth,
      blockNumber: t.blockNumber,
      logIndex: t.logIndex,
      txHash: t.txHash,
      timestampMs: t.timestampMs,
    })
  }
  return out
}
