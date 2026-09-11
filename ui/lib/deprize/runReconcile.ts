import DePrizeMintABI from 'const/abis/DePrizeMint.json'
import DePrizeRegistryABI from 'const/abis/DePrizeRegistry.json'
import {
  DEFAULT_CHAIN_V5,
  DEPRIZE_REGISTRY_ADDRESSES,
  LMSR_WITH_TWAP_ADDRESSES,
} from 'const/config'
import { getContract } from 'thirdweb'
import { decodeEventLog, parseAbiItem, toEventSelector, type Hex } from 'viem'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { sendComplianceAlert } from './complianceAlerts'
import { mintAddressForChain } from './compliancePermit'
import { getComplianceRedis } from './complianceStore'
import { BET_EVENT_SIGNATURE, TRADE_EVENT_SIGNATURE } from './events'
import {
  ETHERSCAN_SUPPORTED_CHAINS,
  etherscanApiKey,
  fetchEtherscanBlockNumber,
  fetchEtherscanV2Logs,
  type EtherscanLog,
} from './etherscanLogs'
import { getPermitRecordsForWallet } from './permitLog'
import { deprizeReadChain, deprizeReadClient, rpcRead } from './read'
import {
  betHasMatchingPermit,
  classifyLmsrTrade,
  nextReconcileCursor,
  parseReconcileStartBlock,
  parseStoredCursor,
  reconcileCursorKey,
  resolveReconcileWindow,
  uniqueConfiguredAddresses,
} from './reconcile'

const betAbiItem = parseAbiItem(BET_EVENT_SIGNATURE)
const tradeAbiItem = parseAbiItem(TRADE_EVENT_SIGNATURE)
const BET_TOPIC0 = toEventSelector(betAbiItem)
const TRADE_TOPIC0 = toEventSelector(tradeAbiItem)

export type ReconcileResult = {
  ok: boolean
  chainId: number
  fromBlock?: number
  toBlock?: number
  lastProcessedBlock: number | null
  bets: number
  unmatchedBets: number
  trades: number
  directBuys: number
  error?: string
}

type MarketRef = { address: string; deprizeId: number | null }

function logTimestampSec(log: EtherscanLog): number | null {
  try {
    const sec = Number(BigInt(log.timeStamp))
    return Number.isFinite(sec) ? sec : null
  } catch {
    return null
  }
}

function decodeBet(log: EtherscanLog): {
  wallet: string
  deprizeId: number
  txHash: string
  blockTimestampSec: number
} | null {
  const blockTimestampSec = logTimestampSec(log)
  if (blockTimestampSec === null) return null
  try {
    const decoded = decodeEventLog({
      abi: [betAbiItem],
      data: log.data as Hex,
      topics: log.topics as [Hex, ...Hex[]],
    })
    const args = decoded.args as {
      deprizeId: bigint
      bettor: string
    }
    return {
      wallet: args.bettor,
      deprizeId: Number(args.deprizeId),
      txHash: log.transactionHash,
      blockTimestampSec,
    }
  } catch {
    return null
  }
}

function decodeTrade(log: EtherscanLog): {
  transactor: string
  outcomeTokenAmounts: readonly bigint[]
  txHash: string
} | null {
  try {
    const decoded = decodeEventLog({
      abi: [tradeAbiItem],
      data: log.data as Hex,
      topics: log.topics as [Hex, ...Hex[]],
    })
    const args = decoded.args as {
      transactor: string
      outcomeTokenAmounts: readonly bigint[]
    }
    return {
      transactor: args.transactor,
      outcomeTokenAmounts: args.outcomeTokenAmounts,
      txHash: log.transactionHash,
    }
  } catch {
    return null
  }
}

async function listMarkets(chainId: number, mintAddress: string): Promise<MarketRef[]> {
  const chain = deprizeReadChain(chainId)
  const slug = getChainSlug(chain)
  const markets: MarketRef[] = []
  const seen = new Set<string>()

  const add = (address: string | null | undefined, deprizeId: number | null) => {
    const unique = uniqueConfiguredAddresses([address])
    const next = unique[0]
    if (!next || seen.has(next)) return
    seen.add(next)
    markets.push({ address: next, deprizeId })
  }

  const registryAddress = DEPRIZE_REGISTRY_ADDRESSES[slug]
  if (registryAddress) {
    const registry = getContract({
      client: deprizeReadClient,
      chain,
      address: registryAddress,
      abi: DePrizeRegistryABI as any,
    })
    const mint = getContract({
      client: deprizeReadClient,
      chain,
      address: mintAddress,
      abi: DePrizeMintABI as any,
    })
    const count = Number(await rpcRead({ contract: registry, method: 'count' as string, params: [] }))
    if (!Number.isInteger(count) || count < 0) {
      throw new Error('registry count is unavailable')
    }
    for (let id = 1; id <= count; id++) {
      const market = await rpcRead({
        contract: mint,
        method: 'marketOf' as string,
        params: [BigInt(id)],
      })
      add(typeof market === 'string' ? market : null, id)
    }
  }

  add(LMSR_WITH_TWAP_ADDRESSES[slug], null)
  return markets
}

export async function runDePrizeReconcile(): Promise<ReconcileResult> {
  const chain = DEFAULT_CHAIN_V5
  const chainId = chain.id
  const redis = getComplianceRedis()
  const cursorKey = reconcileCursorKey(chainId)
  let lastProcessedBlock: number | null = null

  const fail = async (error: string, extras: Partial<ReconcileResult> = {}): Promise<ReconcileResult> => {
    await sendComplianceAlert({
      kind: 'reconcile-failed',
      reason: error,
      chainId,
      timestamp: new Date().toISOString(),
    })
    return {
      ok: false,
      chainId,
      lastProcessedBlock,
      bets: 0,
      unmatchedBets: 0,
      trades: 0,
      directBuys: 0,
      error,
      ...extras,
    }
  }

  if (!redis) return fail('compliance redis is not configured')
  if (!ETHERSCAN_SUPPORTED_CHAINS.has(chainId)) {
    return fail(`unsupported chainId ${chainId}`)
  }

  const mintAddress = mintAddressForChain(chainId)
  if (!mintAddress) return fail('DePrizeMint address is not configured')

  const apiKey = etherscanApiKey()
  if (!apiKey) return fail('explorer API key is not configured')

  try {
    lastProcessedBlock = parseStoredCursor(await redis.get(cursorKey))
  } catch (err) {
    console.error('[deprize] reconcile cursor read failed', err)
    return fail('reconcile cursor read failed')
  }

  let latestBlock: number
  try {
    latestBlock = await fetchEtherscanBlockNumber(chainId, apiKey)
  } catch (err: any) {
    return fail(err?.message || 'latest block is unavailable')
  }

  const window = resolveReconcileWindow({
    lastProcessedBlock,
    startBlock: parseReconcileStartBlock(process.env.DEPRIZE_RECONCILE_START_BLOCK),
    latestBlock,
  })
  if (!window.ok) return fail(window.error)
  if (window.empty) {
    return {
      ok: true,
      chainId,
      lastProcessedBlock,
      bets: 0,
      unmatchedBets: 0,
      trades: 0,
      directBuys: 0,
    }
  }

  const { fromBlock, toBlock } = window
  let succeeded = true
  let unmatchedBets = 0
  let directBuys = 0
  let bets = 0
  let trades = 0

  try {
    const betPage = await fetchEtherscanV2Logs({
      chainId,
      address: mintAddress,
      fromBlock,
      toBlock,
      topic0: BET_TOPIC0,
      apiKey,
    })
    if (betPage.truncated) {
      return fail('bet logs truncated before the window was fully read', {
        fromBlock,
        toBlock,
        lastProcessedBlock,
      })
    }

    for (const log of betPage.logs) {
      const bet = decodeBet(log)
      if (!bet) continue
      bets += 1
      const permits = await getPermitRecordsForWallet(bet.wallet)
      if (permits.failed) {
        succeeded = false
        continue
      }
      if (
        betHasMatchingPermit(permits.records, {
          wallet: bet.wallet,
          deprizeId: bet.deprizeId,
          chainId,
          blockTimestampSec: bet.blockTimestampSec,
        })
      ) {
        continue
      }
      unmatchedBets += 1
      const sent = await sendComplianceAlert({
        kind: 'unmatched-bet',
        wallet: bet.wallet,
        chainId,
        deprizeId: bet.deprizeId,
        txHash: bet.txHash,
        reason: 'no matching permit issuance record',
        timestamp: new Date(bet.blockTimestampSec * 1000).toISOString(),
      })
      if (!sent) succeeded = false
    }

    const markets = await listMarkets(chainId, mintAddress)
    for (const market of markets) {
      const tradePage = await fetchEtherscanV2Logs({
        chainId,
        address: market.address,
        fromBlock,
        toBlock,
        topic0: TRADE_TOPIC0,
        apiKey,
      })
      if (tradePage.truncated) {
        return fail('trade logs truncated before the window was fully read', {
          fromBlock,
          toBlock,
          lastProcessedBlock,
          bets,
          unmatchedBets,
          trades,
          directBuys,
        })
      }
      for (const log of tradePage.logs) {
        const trade = decodeTrade(log)
        if (!trade) continue
        trades += 1
        const classification = classifyLmsrTrade({
          transactor: trade.transactor,
          mintAddress,
          outcomeTokenAmounts: trade.outcomeTokenAmounts,
        })
        if (classification !== 'direct-buy-review-required') continue
        directBuys += 1
        const sent = await sendComplianceAlert({
          kind: 'direct-buy-review-required',
          wallet: trade.transactor,
          chainId,
          ...(market.deprizeId !== null ? { deprizeId: market.deprizeId } : {}),
          txHash: trade.txHash,
          reason: 'non-mint LMSR buy bypassed DePrizeMint',
          timestamp: new Date().toISOString(),
        })
        if (!sent) succeeded = false
      }
    }
  } catch (err: any) {
    console.error('[deprize] reconcile run failed', err)
    return fail(err?.message || 'reconcile run failed', {
      fromBlock,
      toBlock,
      lastProcessedBlock,
      bets,
      unmatchedBets,
      trades,
      directBuys,
    })
  }

  const processedThrough = nextReconcileCursor({
    lastProcessedBlock,
    succeeded,
    processedThrough: toBlock,
  })

  if (succeeded) {
    try {
      await redis.set(cursorKey, toBlock)
      lastProcessedBlock = toBlock
    } catch (err) {
      console.error('[deprize] reconcile cursor write failed', err)
      return fail('reconcile cursor write failed', {
        fromBlock,
        toBlock,
        lastProcessedBlock,
        bets,
        unmatchedBets,
        trades,
        directBuys,
      })
    }
  } else {
    await sendComplianceAlert({
      kind: 'reconcile-failed',
      reason: 'alert delivery or permit lookup failed; cursor unchanged',
      chainId,
      timestamp: new Date().toISOString(),
    })
  }

  return {
    ok: succeeded,
    chainId,
    fromBlock,
    toBlock,
    lastProcessedBlock: processedThrough,
    bets,
    unmatchedBets,
    trades,
    directBuys,
    ...(succeeded ? {} : { error: 'alert delivery or permit lookup failed; cursor unchanged' }),
  }
}
