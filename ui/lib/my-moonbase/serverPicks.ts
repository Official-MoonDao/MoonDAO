/**
 * What the owner of a shared base backs, read on the server.
 *
 * A visitor's browser is never given the owner's wallet, so it cannot read
 * their predictions itself. This reads them here, the same two ways the
 * builder does: free predictions from the Forecasts table, and any outcome
 * the wallet holds a position on in a live DePrize market.
 *
 * Server only.
 */
import type { Redis } from '@upstash/redis'
import ConditionalTokensABI from 'const/abis/ConditionalTokens.json'
import DePrizeMintABI from 'const/abis/DePrizeMint.json'
import LMSRWithTWAP from 'const/abis/LMSRWithTWAP.json'
import {
  COLLATERAL_TOKEN_ADDRESSES,
  CONDITIONAL_TOKEN_ADDRESSES,
  DEFAULT_CHAIN_V5,
  DEPRIZE_MINT_ADDRESSES,
  FORECASTS_TABLE_NAMES,
} from 'const/config'
import { SEED_ATLAS } from '@/lib/lunar-atlas/seed'
import { tablelandQueryEndpoint } from '@/lib/tableland/endpoint'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { picksCacheKey } from './baseStore'
import {
  mergePicks,
  picksFromBetReads,
  picksFromForecastRows,
  raceBooks,
  type ForecastRow,
  type RaceBook,
} from './picks'

/** One piece of hardware the owner backs. How they back it is not passed on. */
export type VisitorPick = { projectId: string; goalIds: string[] }

export type VisitorPicks = {
  picks: VisitorPick[]
  /**
   * Every source was read. When false, hardware missing from `picks` may
   * still be backed, so nothing on the plot may be shown as given up.
   */
  complete: boolean
}

const READ_TIMEOUT_MS = 6_000
const CACHE_SECONDS = 60
const POSITION_IDS_TTL_MS = 60 * 60 * 1000
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`
const WALLET_RE = /^0x[0-9a-f]{40}$/

function isConfiguredAddress(value: string | undefined | null): value is string {
  return !!value && !/^0x0+$/.test(value)
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), READ_TIMEOUT_MS)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function fetchForecastRows(
  chainId: number,
  table: string,
  wallet: string
): Promise<ForecastRow[]> {
  const statement = `SELECT voteId, vote FROM ${table} WHERE address = '${wallet}'`
  const res = await fetch(
    `${tablelandQueryEndpoint(chainId)}?statement=${encodeURIComponent(statement)}`,
    { signal: AbortSignal.timeout(READ_TIMEOUT_MS) }
  )
  if (!res.ok) throw new Error(`forecast read failed: ${res.status}`)
  const rows = await res.json()
  if (!Array.isArray(rows)) throw new Error('forecast read returned no rows array')
  return rows
    .map((row) => ({ voteId: Number(row?.voteId), vote: row?.vote }))
    .filter((row) => Number.isInteger(row.voteId))
}

// A market's position ids never change, and reading them is two calls per outcome.
const positionIds = new Map<string, { ids: bigint[]; at: number }>()

async function readBetBalances(
  chainSlug: string,
  chainId: number,
  book: RaceBook,
  wallet: string
): Promise<{ index: number; balance: number }[]> {
  const mintAddress = DEPRIZE_MINT_ADDRESSES[chainSlug]
  const ctfAddress = CONDITIONAL_TOKEN_ADDRESSES[chainSlug]
  const wethAddress = COLLATERAL_TOKEN_ADDRESSES[chainSlug]
  if (
    book.deprizeId === undefined ||
    !isConfiguredAddress(mintAddress) ||
    !isConfiguredAddress(ctfAddress) ||
    !isConfiguredAddress(wethAddress)
  ) {
    return []
  }

  const { getContract } = await import('thirdweb')
  const { deprizeReadChain, deprizeReadClient, rpcRead } = await import('@/lib/deprize/read')
  const chain = deprizeReadChain(chainId)
  const ctf = getContract({
    client: deprizeReadClient,
    chain,
    address: ctfAddress,
    abi: ConditionalTokensABI as any,
  })

  const cacheKey = `${chainSlug}:${book.deprizeId}`
  let cached = positionIds.get(cacheKey)
  if (!cached || Date.now() - cached.at > POSITION_IDS_TTL_MS) {
    const mint = getContract({
      client: deprizeReadClient,
      chain,
      address: mintAddress,
      abi: DePrizeMintABI as any,
    })
    const marketAddress = await rpcRead<string>({
      contract: mint,
      method: 'marketOf' as string,
      params: [BigInt(book.deprizeId)],
    })
    // No market yet: nobody can hold a position.
    if (!isConfiguredAddress(marketAddress)) return []
    const lmsr = getContract({
      client: deprizeReadClient,
      chain,
      address: marketAddress,
      // This file is a build artifact: the ABI is one of its fields.
      abi: LMSRWithTWAP.abi as any,
    })
    const conditionId = await rpcRead<string>({
      contract: lmsr,
      method: 'conditionIds' as string,
      params: [0n],
    })
    const ids = await Promise.all(
      book.outcomeIds.map(async (_, index) => {
        const collectionId = await rpcRead<string>({
          contract: ctf,
          method: 'getCollectionId' as string,
          params: [ZERO_BYTES32, conditionId, 1n << BigInt(index)],
        })
        return rpcRead<bigint>({
          contract: ctf,
          method: 'getPositionId' as string,
          params: [wethAddress, collectionId],
        })
      })
    )
    cached = { ids, at: Date.now() }
    positionIds.set(cacheKey, cached)
  }

  const balances = await rpcRead<bigint[]>({
    contract: ctf,
    method: 'balanceOfBatch' as string,
    params: [cached.ids.map(() => wallet), cached.ids],
  })
  return cached.ids.map((_, index) => ({ index, balance: balances[index] > 0n ? 1 : 0 }))
}

function parseCached(raw: unknown): VisitorPicks | null {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  const cached = value as Partial<VisitorPicks> | null
  return cached && Array.isArray(cached.picks) && typeof cached.complete === 'boolean'
    ? { picks: cached.picks, complete: cached.complete }
    : null
}

/**
 * Null when predictions could not be read at all. A wallet that backs nothing
 * is an empty list, not null.
 */
export async function readVisitorPicks(
  redis: Redis | null,
  owner: string
): Promise<VisitorPicks | null> {
  const wallet = owner.toLowerCase()
  // The wallet goes into a SQL statement.
  if (!WALLET_RE.test(wallet)) return null

  const cacheKey = picksCacheKey(wallet)
  if (redis) {
    const cached = parseCached(await redis.get(cacheKey).catch(() => null))
    if (cached) return cached
  }

  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const table = FORECASTS_TABLE_NAMES[chainSlug] as string | undefined
  if (!table) return null
  const books = raceBooks(chainSlug, SEED_ATLAS.sharedGoals)
  const betBooks = books.filter((book) => book.deprizeId !== undefined)

  const [rows, betReads] = await Promise.all([
    fetchForecastRows(chain.id, table, wallet).catch((err) => {
      console.warn('[my-moonbase] could not read a base owner’s predictions', err)
      return null
    }),
    Promise.all(
      betBooks.map((book) =>
        withTimeout(readBetBalances(chainSlug, chain.id, book, wallet), 'position read').catch(
          (err) => {
            console.warn('[my-moonbase] could not read a base owner’s positions', err)
            return null
          }
        )
      )
    ),
  ])
  if (!rows) return null

  // One failed market must not look like a finished read. The share page
  // empties a lot only when `complete` is true.
  const bets = picksFromBetReads(books, betReads)
  const result: VisitorPicks = {
    picks: mergePicks([...picksFromForecastRows(rows, books), ...bets.picks]).map(
      ({ projectId, goalIds }) => ({ projectId, goalIds })
    ),
    complete: bets.complete,
  }
  // A partial read is not kept: the next visitor should get another try at it.
  if (redis && result.complete) {
    await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_SECONDS }).catch(() => {})
  }
  return result
}
