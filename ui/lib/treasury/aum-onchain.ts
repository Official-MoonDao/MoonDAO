/**
 * Free, no-CoinStats replacement for `getAUMHistory` (lib/coinstats/index.ts).
 *
 * Mirrors the original semantics exactly:
 *   AUM_history[day] = sum of safe portfolio values across all 8 MoonDAO safes
 *                    + (DeFi LP value if day >= earliest pool creation, else 0)
 *
 * Sources (all free):
 *   - Safe Transaction Service for current per-safe per-token balances + USD prices
 *   - Etherscan V2 multi-chain for transfer history (ETH, internal, ERC-20)
 *   - CoinGecko Demo for historical native + ERC-20 daily prices
 *   - Uniswap V3 NFT positions on Ethereum + Polygon (only DeFi MoonDAO holds)
 *
 * NOT included in AUM (matches original):
 *   - Native staked ETH validators (96 ETH). Tracked separately in `stakedEth`.
 */

import { LineChartData } from '@/components/layout/LineChart'

// ── Config ────────────────────────────────────────────────────────────────────

const ETHERSCAN_API = 'https://api.etherscan.io/v2/api'
const ETHERSCAN_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || ''

// MoonDAO custom staking contract (for the side-metric only).
const STAKING_CONTRACT = '0xbbb56e071f33e020daEB0A1dD2249B8Bbdb69fB8'
const STAKING_INITIAL_BLOCK = 21839730
const ETH_PER_VALIDATOR = 32

// MoonDAO main treasury (only safe that holds the staking + LP NFTs).
const MOONDAO_TREASURY = '0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9'

const SAFE_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Accept: 'application/json',
  Origin: 'https://app.safe.global',
  Referer: 'https://app.safe.global/',
}

interface ChainCfg {
  chainId: number
  /** CoinGecko asset-platform id for ERC-20 contract price lookups. */
  cgPlatform: string
  /** CoinGecko coin id for the native token. */
  cgNativeId: string
  /** DefiLlama chain prefix (used in {chain}:{address} lookup keys). */
  llamaChain: string
  /** Native token symbol. */
  nativeSymbol: string
}

const CHAINS: Record<string, ChainCfg> = {
  ethereum: { chainId: 1,     cgPlatform: 'ethereum',            cgNativeId: 'ethereum',       llamaChain: 'ethereum', nativeSymbol: 'ETH' },
  arbitrum: { chainId: 42161, cgPlatform: 'arbitrum-one',        cgNativeId: 'ethereum',       llamaChain: 'arbitrum', nativeSymbol: 'ETH' },
  polygon:  { chainId: 137,   cgPlatform: 'polygon-pos',         cgNativeId: 'matic-network',  llamaChain: 'polygon',  nativeSymbol: 'MATIC' },
  base:     { chainId: 8453,  cgPlatform: 'base',                cgNativeId: 'ethereum',       llamaChain: 'base',     nativeSymbol: 'ETH' },
  optimism: { chainId: 10,    cgPlatform: 'optimistic-ethereum', cgNativeId: 'ethereum',       llamaChain: 'optimism', nativeSymbol: 'ETH' },
}

interface SafeCfg {
  name: string
  address: string
  chain: keyof typeof CHAINS
}

// Mirrors MOONDAO_SAFES in ui/lib/coinstats/index.ts
const SAFES: SafeCfg[] = [
  { name: 'ETH Treasury',        chain: 'ethereum', address: '0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9' },
  { name: 'Arbitrum Treasury',   chain: 'arbitrum', address: '0xAF26a002d716508b7e375f1f620338442F5470c0' },
  { name: 'Polygon Treasury',    chain: 'polygon',  address: '0x8C0252c3232A2c7379DDC2E44214697ae8fF097a' },
  { name: 'Base Treasury',       chain: 'base',     address: '0x871e232Eb935E54Eb90B812cf6fe0934D45e7354' },
  { name: 'Optimism Treasury',   chain: 'optimism', address: '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB45e4' },
  { name: 'Arbitrum Multichain', chain: 'arbitrum', address: '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB4537' },
  { name: 'Polygon Multichain',  chain: 'polygon',  address: '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB4537' },
  { name: 'Base Multichain',     chain: 'base',     address: '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB4537' },
]

// MOONEY is excluded from AUM throughout the codebase (see useAssets()).
const EXCLUDED_SYMBOLS = new Set(['MOONEY'])

// Stablecoins always priced at $1 (avoid CoinGecko calls for these).
const STABLE_SYMBOLS = new Set([
  'USDC', 'USDT', 'DAI', 'BUSD', 'FRAX', 'LUSD', 'USDe', 'USDS', 'PYUSD',
  'USDC.e', 'USDT.e', 'DAI.e', 'sDAI', 'USDtb', 'USDTB',
])

// ── Rate-limited fetch ────────────────────────────────────────────────────────
// Etherscan V2 free tier = 5 req/sec. We pace ourselves at ~3 req/sec.
// DefiLlama coins API: no auth, generous limits — pace at 10 req/sec.

let lastEtherscan = 0
let lastLlama = 0

async function pace(host: 'etherscan' | 'llama'): Promise<void> {
  const now = Date.now()
  if (host === 'etherscan') {
    const wait = Math.max(0, 220 - (now - lastEtherscan))
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastEtherscan = Date.now()
  } else {
    const wait = Math.max(0, 100 - (now - lastLlama))
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastLlama = Date.now()
  }
}

async function fetchJson(
  url: string,
  opts: RequestInit & { host: 'etherscan' | 'llama' | 'safe' }
): Promise<any> {
  if (opts.host === 'etherscan') await pace('etherscan')
  if (opts.host === 'llama') await pace('llama')
  const headers: Record<string, string> = { ...(opts.headers as any) }
  if (opts.host === 'safe') Object.assign(headers, SAFE_HEADERS)
  for (let attempt = 0; attempt < 4; attempt++) {
    let r: Response
    try {
      r = await fetch(url, { ...opts, headers })
    } catch {
      // network error — backoff and retry
      await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)))
      continue
    }
    if (r.status === 429 || r.status === 503) {
      await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)))
      continue
    }
    // Safe Transaction Service occasionally serves 403 from CloudFront — retry
    if (opts.host === 'safe' && (r.status === 403 || r.status === 502 || r.status === 504)) {
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)))
      continue
    }
    if (!r.ok) {
      // 401/404 etc. — return null so caller can handle
      return null
    }
    let body: any
    try {
      body = await r.json()
    } catch {
      return null
    }
    // Etherscan rate-limit responses return HTTP 200 with body
    // {"status":"0","message":"NOTOK","result":"Max calls per sec rate limit reached..."}
    if (
      opts.host === 'etherscan' &&
      body &&
      body.status === '0' &&
      typeof body.result === 'string' &&
      /rate limit/i.test(body.result)
    ) {
      await new Promise((res) => setTimeout(res, 1200 * (attempt + 1)))
      continue
    }
    return body
  }
  return null
}

// ── Safe Transaction Service ──────────────────────────────────────────────────

interface SafeBalanceItem {
  tokenInfo: {
    type: 'NATIVE_TOKEN' | 'ERC20' | string
    address: string
    decimals: number
    symbol: string
    name: string
  }
  balance: string
  fiatBalance: string
  fiatConversion: string
}

interface SafeBalances {
  fiatTotal: string
  items: SafeBalanceItem[]
}

const safeBalCache = new Map<string, SafeBalances | null>()

async function fetchSafeBalances(
  chainId: number,
  safeAddr: string
): Promise<SafeBalances | null> {
  const key = `${chainId}:${safeAddr.toLowerCase()}`
  if (safeBalCache.has(key)) return safeBalCache.get(key) ?? null
  const url =
    `https://safe-client.safe.global/v1/chains/${chainId}` +
    `/safes/${safeAddr}/balances/usd?trusted=true`
  // Per-call retry loop on top of fetchJson's own retry, since the Safe API
  // is fronted by CloudFront and occasionally returns transient 403/empty.
  for (let i = 0; i < 3; i++) {
    const j = await fetchJson(url, { method: 'GET', host: 'safe' })
    if (j && Array.isArray(j.items)) {
      safeBalCache.set(key, j)
      return j
    }
    await new Promise((r) => setTimeout(r, 800 * (i + 1)))
  }
  safeBalCache.set(key, null)
  return null
}

// ── Etherscan transfer history ────────────────────────────────────────────────
// We replay balances *backwards* from today's known balance using transfer
// history. This is more accurate than forward-replay (no risk of drift from
// missing transfers; the current Safe API balance is the ground truth).

interface Transfer {
  /** Absolute amount transferred, in raw token units (not decimals-adjusted). */
  amountRaw: bigint
  /** True if this transfer increased the safe's balance (`to == safe`). */
  incoming: boolean
  /** Unix seconds. */
  timeStamp: number
}

async function fetchEtherscanList(
  chainId: number,
  module: string,
  action: string,
  params: Record<string, string>
): Promise<any[]> {
  if (!ETHERSCAN_KEY) return []
  const all: any[] = []
  let page = 1
  while (true) {
    const qs = new URLSearchParams({
      chainid: String(chainId),
      module,
      action,
      page: String(page),
      offset: '10000',
      sort: 'desc',
      apikey: ETHERSCAN_KEY,
      ...params,
    }).toString()
    const data = await fetchJson(`${ETHERSCAN_API}?${qs}`, {
      method: 'GET',
      host: 'etherscan',
    })
    if (!data || !Array.isArray(data.result)) break
    all.push(...data.result)
    if (data.result.length < 10000) break
    page++
    if (page > 10) break // safety cap (100k txs is plenty)
  }
  return all
}

/** Native + internal ETH/MATIC transfers in/out of `safe`. */
async function fetchNativeTransfers(
  chainId: number,
  safe: string
): Promise<Transfer[]> {
  const safeLower = safe.toLowerCase()
  const out: Transfer[] = []
  for (const action of ['txlist', 'txlistinternal']) {
    const rows = await fetchEtherscanList(chainId, 'account', action, {
      address: safe,
      startblock: '0',
      endblock: '99999999',
    })
    for (const tx of rows) {
      const v = BigInt(tx.value || '0')
      if (v === BigInt(0)) continue
      // Skip failed top-level txs.
      if (action === 'txlist' && tx.isError === '1') continue
      const from = (tx.from || '').toLowerCase()
      const to = (tx.to || '').toLowerCase()
      const incoming = to === safeLower
      const outgoing = from === safeLower
      if (!incoming && !outgoing) continue
      out.push({
        amountRaw: v,
        incoming,
        timeStamp: parseInt(tx.timeStamp, 10),
      })
    }
  }
  return out
}

/** ERC-20 transfers in/out of `safe`, grouped by token contract address. */
async function fetchErc20Transfers(
  chainId: number,
  safe: string
): Promise<Map<string, Transfer[]>> {
  const safeLower = safe.toLowerCase()
  const rows = await fetchEtherscanList(chainId, 'account', 'tokentx', {
    address: safe,
    startblock: '0',
    endblock: '99999999',
  })
  const byToken = new Map<string, Transfer[]>()
  for (const tx of rows) {
    const contract = (tx.contractAddress || '').toLowerCase()
    if (!contract) continue
    const v = BigInt(tx.value || '0')
    if (v === BigInt(0)) continue
    const from = (tx.from || '').toLowerCase()
    const to = (tx.to || '').toLowerCase()
    const incoming = to === safeLower
    const outgoing = from === safeLower
    if (!incoming && !outgoing) continue
    if (!byToken.has(contract)) byToken.set(contract, [])
    byToken.get(contract)!.push({
      amountRaw: v,
      incoming,
      timeStamp: parseInt(tx.timeStamp, 10),
    })
  }
  return byToken
}

// ── CoinGecko price history ───────────────────────────────────────────────────
// Demo key gives last-365-days historical via market_chart/range.
// Returns price-per-day as Map<'YYYY-MM-DD', usdPrice>.

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function buildDateRange(startMs: number, endMs: number): string[] {
  const out: string[] = []
  const start = new Date(ymd(startMs) + 'T00:00:00Z').getTime()
  const end = new Date(ymd(endMs) + 'T00:00:00Z').getTime()
  for (let t = start; t <= end; t += 86400000) out.push(ymd(t))
  return out
}

const llamaCache = new Map<string, Map<string, number>>()

/**
 * Fetch a daily price history for a single DefiLlama coin key
 * (e.g. `ethereum:0xabc...` or `coingecko:ethereum`).
 *
 * Uses the public `coins.llama.fi/chart/{coins}` endpoint:
 *   - `start` (unix sec), `span` (number of points), `period=1d`
 *   - Returns one price per day (or fewer if the token didn't yet exist).
 *   - No auth, no 365-day cap.
 */
async function fetchLlamaChart(
  coinKey: string,
  startMs: number,
  endMs: number
): Promise<Map<string, number>> {
  const startSec = Math.floor(startMs / 1000)
  const endSec = Math.floor(endMs / 1000)
  if (startSec >= endSec) return new Map()
  const span = Math.min(
    1000,
    Math.max(2, Math.ceil((endSec - startSec) / 86400) + 2)
  )
  const cacheKey = `${coinKey}|${startSec}|${span}`
  const cached = llamaCache.get(cacheKey)
  if (cached) return cached

  const url =
    `https://coins.llama.fi/chart/${encodeURIComponent(coinKey)}` +
    `?start=${startSec}&span=${span}&period=1d&searchWidth=600`

  let data: any = null
  for (let i = 0; i < 4; i++) {
    data = await fetchJson(url, { method: 'GET', host: 'llama' })
    if (data?.coins?.[coinKey]?.prices?.length) break
    await new Promise((r) => setTimeout(r, 800 * (i + 1)))
  }

  const m = new Map<string, number>()
  const points = data?.coins?.[coinKey]?.prices
  if (!Array.isArray(points) || points.length === 0) {
    console.warn(`[AUM] DefiLlama chart failed: ${coinKey}`)
    return m
  }
  for (const p of points as { timestamp: number; price: number }[]) {
    if (typeof p.timestamp === 'number' && typeof p.price === 'number') {
      m.set(ymd(p.timestamp * 1000), p.price)
    }
  }
  llamaCache.set(cacheKey, m)
  return m
}

/** CoinGecko-id -> DefiLlama coin key for native tokens we care about. */
const CG_TO_LLAMA: Record<string, string> = {
  ethereum: 'coingecko:ethereum',
  // MATIC was rebranded to POL; the old CG id has no points on DefiLlama.
  'matic-network': 'coingecko:polygon-ecosystem-token',
}

async function fetchNativePriceHistory(
  cgNativeId: string,
  startMs: number,
  endMs: number
): Promise<Map<string, number>> {
  const key = CG_TO_LLAMA[cgNativeId] || `coingecko:${cgNativeId}`
  return fetchLlamaChart(key, startMs, endMs)
}

async function fetchErc20PriceHistory(
  llamaChain: string,
  contractAddr: string,
  startMs: number,
  endMs: number
): Promise<Map<string, number>> {
  return fetchLlamaChart(
    `${llamaChain}:${contractAddr.toLowerCase()}`,
    startMs,
    endMs
  )
}

/** Last-known-price-on-or-before; falls forward to earliest known if no prior. */
function priceForDate(
  m: Map<string, number>,
  date: string,
  fallback = 0
): number {
  const direct = m.get(date)
  if (direct !== undefined) return direct
  // Walk backwards up to 14 days to find the nearest prior price.
  const t = new Date(date + 'T00:00:00Z').getTime()
  for (let i = 1; i <= 14; i++) {
    const prev = ymd(t - i * 86400000)
    const p = m.get(prev)
    if (p !== undefined) return p
  }
  // No prior price — date is before the fetched window. Fall FORWARD to the
  // earliest known price (better than 0 for dates outside the CoinGecko
  // demo key's 365-day cap).
  if (m.size > 0) {
    const earliestKey = Array.from(m.keys()).sort()[0]
    return m.get(earliestKey) ?? fallback
  }
  return fallback
}

// ── Per-safe historical USD reconstruction ────────────────────────────────────

interface SafeHistory {
  /** Current total USD across all (non-excluded) tokens in this safe. */
  current: number
  /** date('YYYY-MM-DD') -> total USD on that day. */
  daily: Map<string, number>
}

/**
 * For one safe:
 *   1. Snapshot current balances + USD prices from Safe API
 *   2. For each non-excluded token, pull transfer history and replay
 *      backwards day-by-day to get end-of-day token balance.
 *   3. Multiply each day's balance by the day's USD price (CoinGecko or
 *      fixed $1 for stables).
 *   4. Sum across tokens to produce the per-safe daily total.
 */
async function processSafe(
  safe: SafeCfg,
  startMs: number,
  endMs: number,
  dates: string[]
): Promise<SafeHistory> {
  const { chainId, llamaChain, cgNativeId, nativeSymbol } = CHAINS[safe.chain]

  const balances = await fetchSafeBalances(chainId, safe.address)
  if (!balances || !Array.isArray(balances.items)) {
    console.warn(
      `[AUM] Safe API failed for ${safe.name} — returning 0 (distorts averages!)`
    )
    return { current: 0, daily: new Map(dates.map((d) => [d, 0])) }
  }

  // Walk safe items, build per-token snapshot.
  type TokenSnap = {
    isNative: boolean
    contract: string
    decimals: number
    symbol: string
    /** Current raw balance (token base units, no decimals). */
    currentRaw: bigint
    /** Current USD value (from Safe API). */
    currentUsd: number
  }
  const snaps: TokenSnap[] = []
  for (const item of balances.items) {
    const sym = (item.tokenInfo.symbol || '').trim()
    if (EXCLUDED_SYMBOLS.has(sym)) continue
    const isNative = item.tokenInfo.type === 'NATIVE_TOKEN'
    const usd = parseFloat(item.fiatBalance || '0')
    const raw = (() => {
      try {
        return BigInt(item.balance || '0')
      } catch {
        return BigInt(0)
      }
    })()
    if (raw === BigInt(0) && usd === 0) continue
    snaps.push({
      isNative,
      contract: isNative ? '' : (item.tokenInfo.address || '').toLowerCase(),
      decimals: item.tokenInfo.decimals,
      symbol: sym,
      currentRaw: raw,
      currentUsd: usd,
    })
  }

  // Pre-fetch transfer histories.
  const nativeXfers = await fetchNativeTransfers(chainId, safe.address)
  const erc20Xfers = await fetchErc20Transfers(chainId, safe.address)

  // Pre-fetch native price history once (used for the native token).
  const nativePrices = await fetchNativePriceHistory(cgNativeId, startMs, endMs)

  // Daily USD totals for this safe.
  const daily = new Map<string, number>(dates.map((d) => [d, 0]))
  let currentTotal = 0

  for (const snap of snaps) {
    currentTotal += snap.currentUsd

    // Choose transfer set + price source.
    const xfers = snap.isNative
      ? nativeXfers
      : erc20Xfers.get(snap.contract) || []

    // Replay balances day-by-day, walking backwards from today's known raw.
    // Sort transfers DESC by time so we can iterate from now -> past.
    xfers.sort((a, b) => b.timeStamp - a.timeStamp)

    const dayRaw = new Map<string, bigint>()
    let raw = snap.currentRaw
    let xferIdx = 0
    for (let i = dates.length - 1; i >= 0; i--) {
      const date = dates[i]
      // End-of-day cutoff = next day 00:00 UTC, in seconds.
      const cutoff = Math.floor(
        (new Date(date + 'T00:00:00Z').getTime() + 86400000) / 1000
      )
      // Roll back transfers that happened *after* this day's cutoff.
      while (xferIdx < xfers.length && xfers[xferIdx].timeStamp >= cutoff) {
        const x = xfers[xferIdx]
        if (x.incoming) raw -= x.amountRaw
        else raw += x.amountRaw
        xferIdx++
      }
      if (raw < BigInt(0)) raw = BigInt(0) // history gaps -> clamp
      dayRaw.set(date, raw)
    }

    // Determine price source.
    let priceMap: Map<string, number>
    let isStable = STABLE_SYMBOLS.has(snap.symbol)
    if (isStable) {
      priceMap = new Map() // unused; we'll force $1
    } else if (snap.isNative || snap.symbol === nativeSymbol) {
      priceMap = nativePrices
      // Native price history failed → fall back to today's current rate.
      if (priceMap.size === 0 && snap.currentRaw > BigInt(0)) {
        const tokensNow = Number(snap.currentRaw) / 10 ** snap.decimals
        const px = tokensNow > 0 ? snap.currentUsd / tokensNow : 0
        priceMap = new Map(dates.map((d) => [d, px]))
      }
    } else {
      priceMap = await fetchErc20PriceHistory(
        llamaChain,
        snap.contract,
        startMs,
        endMs
      )
      // If the contract endpoint returned nothing, fall back to a flat
      // current-USD-per-token rate so the token still contributes.
      if (priceMap.size === 0 && snap.currentRaw > BigInt(0)) {
        const tokensNow = Number(snap.currentRaw) / 10 ** snap.decimals
        const px = tokensNow > 0 ? snap.currentUsd / tokensNow : 0
        for (const d of dates) priceMap.set(d, px)
      }
    }

    // Convert and accumulate.
    const decimals = snap.decimals
    for (const date of dates) {
      const r = dayRaw.get(date) || BigInt(0)
      if (r === BigInt(0)) continue
      const tokens = Number(r) / 10 ** decimals
      const px = isStable ? 1 : priceForDate(priceMap, date, 0)
      daily.set(date, (daily.get(date) || 0) + tokens * px)
    }
  }

  return { current: currentTotal, daily }
}

// ── Uniswap V3 LP NFT positions (the only DeFi MoonDAO holds) ─────────────────
// Mirrors the shape produced by CoinStats `/portfolio/defi`:
//   { balance, firstPoolCreationTimestamp, protocols: [{ chain, name, totalValue,
//     investments: [{ poolAddress, value, symbols, assets[] }] }] }

import { defaultAbiCoder, keccak256, toUtf8Bytes } from 'ethers/lib/utils'

const UNI_V3_NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
const UNI_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

interface UniV3LpPosition {
  chain: keyof typeof CHAINS
  tokenId: string
  pool: string
  token0: string
  token1: string
  symbol0: string
  symbol1: string
  amount0: number // human units
  amount1: number
  price0Usd: number
  price1Usd: number
  poolCreatedAt: number // ms
}

async function ethCall(
  chainId: number,
  to: string,
  data: string
): Promise<string | null> {
  const url =
    `${ETHERSCAN_API}?chainid=${chainId}&module=proxy&action=eth_call` +
    `&to=${to}&data=${data}&tag=latest&apikey=${ETHERSCAN_KEY}`
  const r = await fetchJson(url, { method: 'GET', host: 'etherscan' })
  if (!r || typeof r.result !== 'string') return null
  return r.result
}

async function readErc20Decimals(chainId: number, addr: string): Promise<number> {
  const sel = keccak256(toUtf8Bytes('decimals()')).slice(0, 10)
  const r = await ethCall(chainId, addr, sel)
  if (!r) return 18
  try {
    return Number(BigInt(r))
  } catch {
    return 18
  }
}

async function readErc20Symbol(chainId: number, addr: string): Promise<string> {
  const sel = keccak256(toUtf8Bytes('symbol()')).slice(0, 10)
  const r = await ethCall(chainId, addr, sel)
  if (!r) return ''
  try {
    return defaultAbiCoder.decode(['string'], r)[0]
  } catch {
    try {
      const stripped = r.replace(/^0x/, '').replace(/0+$/, '')
      return Buffer.from(stripped, 'hex').toString('utf8')
    } catch {
      return ''
    }
  }
}

async function findOwnedUniV3Tokens(
  chainId: number,
  owner: string
): Promise<string[]> {
  if (!ETHERSCAN_KEY) return []
  const url =
    `${ETHERSCAN_API}?chainid=${chainId}&module=account&action=tokennfttx` +
    `&address=${owner}&page=1&offset=10000&sort=asc&apikey=${ETHERSCAN_KEY}`
  const data = await fetchJson(url, { method: 'GET', host: 'etherscan' })
  if (!data || !Array.isArray(data.result)) return []
  const ownerLower = owner.toLowerCase()
  const lastOwner = new Map<string, string>()
  for (const tx of data.result) {
    const c = (tx.contractAddress || '').toLowerCase()
    if (c !== UNI_V3_NPM.toLowerCase()) continue
    lastOwner.set(String(tx.tokenID), (tx.to || '').toLowerCase())
  }
  return Array.from(lastOwner.entries())
    .filter(([, o]) => o === ownerLower)
    .map(([tid]) => tid)
}

async function readUniV3Position(
  chainId: number,
  tokenId: string
): Promise<{
  token0: string
  token1: string
  fee: number
  tickLower: number
  tickUpper: number
  liquidity: bigint
} | null> {
  const sel = keccak256(toUtf8Bytes('positions(uint256)')).slice(0, 10)
  const tidHex = BigInt(tokenId).toString(16).padStart(64, '0')
  const r = await ethCall(chainId, UNI_V3_NPM, sel + tidHex)
  if (!r) return null
  try {
    const types = [
      'uint96', 'address', 'address', 'address', 'uint24', 'int24',
      'int24', 'uint128', 'uint256', 'uint256', 'uint128', 'uint128',
    ]
    const decoded = defaultAbiCoder.decode(types, r) as any[]
    return {
      token0: decoded[2],
      token1: decoded[3],
      fee: Number(decoded[4]),
      tickLower: Number(decoded[5]),
      tickUpper: Number(decoded[6]),
      liquidity: BigInt(decoded[7].toString()),
    }
  } catch {
    return null
  }
}

async function readUniV3Pool(
  chainId: number,
  token0: string,
  token1: string,
  fee: number
): Promise<{ pool: string; sqrtPriceX96: bigint } | null> {
  const sel = keccak256(toUtf8Bytes('getPool(address,address,uint24)')).slice(0, 10)
  const data =
    sel +
    token0.slice(2).toLowerCase().padStart(64, '0') +
    token1.slice(2).toLowerCase().padStart(64, '0') +
    fee.toString(16).padStart(64, '0')
  const r = await ethCall(chainId, UNI_V3_FACTORY, data)
  if (!r) return null
  const pool = '0x' + r.slice(-40)
  if (/^0x0+$/.test(pool)) return null
  const slot0Sel = keccak256(toUtf8Bytes('slot0()')).slice(0, 10)
  const r2 = await ethCall(chainId, pool, slot0Sel)
  if (!r2) return null
  try {
    const decoded = defaultAbiCoder.decode(
      ['uint160', 'int24', 'uint16', 'uint16', 'uint16', 'uint8', 'bool'],
      r2
    ) as any[]
    return { pool, sqrtPriceX96: BigInt(decoded[0].toString()) }
  } catch {
    return null
  }
}

function uniV3Amounts(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number
): { amount0: number; amount1: number } {
  const sqrtP = Number(sqrtPriceX96) / 2 ** 96
  const sqrtPa = Math.pow(1.0001, tickLower / 2)
  const sqrtPb = Math.pow(1.0001, tickUpper / 2)
  const L = Number(liquidity)
  let amount0 = 0
  let amount1 = 0
  if (sqrtP < sqrtPa) {
    amount0 = (L * (sqrtPb - sqrtPa)) / (sqrtPa * sqrtPb)
  } else if (sqrtP > sqrtPb) {
    amount1 = L * (sqrtPb - sqrtPa)
  } else {
    amount0 = (L * (sqrtPb - sqrtP)) / (sqrtP * sqrtPb)
    amount1 = L * (sqrtP - sqrtPa)
  }
  return { amount0, amount1 }
}

/** Block timestamp of pool creation; used as `firstPoolCreationTimestamp`. */
async function getPoolCreationTs(
  chainId: number,
  pool: string
): Promise<number> {
  const url =
    `${ETHERSCAN_API}?chainid=${chainId}&module=account&action=txlist` +
    `&address=${pool}&startblock=0&endblock=99999999&page=1&offset=1` +
    `&sort=asc&apikey=${ETHERSCAN_KEY}`
  const data = await fetchJson(url, { method: 'GET', host: 'etherscan' })
  if (!data || !Array.isArray(data.result) || data.result.length === 0) return 0
  return parseInt(data.result[0].timeStamp, 10) * 1000
}

async function discoverUniV3Positions(
  chain: keyof typeof CHAINS,
  owner: string,
  priceBySymbol: Map<string, number>
): Promise<UniV3LpPosition[]> {
  const { chainId } = CHAINS[chain]
  const tokenIds = await findOwnedUniV3Tokens(chainId, owner)
  const out: UniV3LpPosition[] = []
  for (const tokenId of tokenIds) {
    const pos = await readUniV3Position(chainId, tokenId)
    if (!pos || pos.liquidity === BigInt(0)) continue
    const pool = await readUniV3Pool(chainId, pos.token0, pos.token1, pos.fee)
    if (!pool) continue
    const { amount0, amount1 } = uniV3Amounts(
      pos.liquidity,
      pool.sqrtPriceX96,
      pos.tickLower,
      pos.tickUpper
    )
    const [d0, d1, s0, s1, ts] = await Promise.all([
      readErc20Decimals(chainId, pos.token0),
      readErc20Decimals(chainId, pos.token1),
      readErc20Symbol(chainId, pos.token0),
      readErc20Symbol(chainId, pos.token1),
      getPoolCreationTs(chainId, pool.pool),
    ])
    out.push({
      chain,
      tokenId,
      pool: pool.pool.toLowerCase(),
      token0: pos.token0.toLowerCase(),
      token1: pos.token1.toLowerCase(),
      symbol0: s0,
      symbol1: s1,
      amount0: amount0 / 10 ** d0,
      amount1: amount1 / 10 ** d1,
      price0Usd: priceBySymbol.get(s0) ?? 0,
      price1Usd: priceBySymbol.get(s1) ?? 0,
      poolCreatedAt: ts,
    })
  }
  return out
}

function lpInvestmentValueUsd(p: UniV3LpPosition): number {
  // Exclude MOONEY side (codebase convention).
  const v0 = EXCLUDED_SYMBOLS.has(p.symbol0) ? 0 : p.amount0 * p.price0Usd
  const v1 = EXCLUDED_SYMBOLS.has(p.symbol1) ? 0 : p.amount1 * p.price1Usd
  return v0 + v1
}

// ── Staked ETH side metric (NOT counted in AUM, matches original) ─────────────

async function getActiveStakedEth(): Promise<{
  activeCount: number
  ethStaked: number
}> {
  if (!ETHERSCAN_KEY) return { activeCount: 0, ethStaked: 0 }
  try {
    const depositSig = keccak256(
      toUtf8Bytes('Deposit(address,address,bytes,bytes)')
    )
    const treasuryTopic =
      '0x' + MOONDAO_TREASURY.slice(2).toLowerCase().padStart(64, '0')
    const url =
      `${ETHERSCAN_API}?chainid=1&module=logs&action=getLogs` +
      `&address=${STAKING_CONTRACT}&topic0=${depositSig}` +
      `&topic2=${treasuryTopic}&topic0_2_opr=and` +
      `&fromBlock=${STAKING_INITIAL_BLOCK}&toBlock=latest&apikey=${ETHERSCAN_KEY}`
    const resp = await fetchJson(url, { method: 'GET', host: 'etherscan' })
    const logs = Array.isArray(resp?.result) ? resp.result : []
    const pubKeys: string[] = []
    for (const log of logs) {
      const d = (log.data as string).replace(/^0x/, '')
      // skip 2 offsets (64 chars each), then read pubkey length + bytes
      const lenOffset = 128
      const len = parseInt(d.slice(lenOffset, lenOffset + 64), 16)
      if (!Number.isFinite(len) || len <= 0 || len > 200) continue
      pubKeys.push('0x' + d.slice(lenOffset + 64, lenOffset + 64 + len * 2))
    }
    if (pubKeys.length === 0) return { activeCount: 0, ethStaked: 0 }

    const withdrawnSel = keccak256(
      toUtf8Bytes('getWithdrawnFromPublicKeyRoot(bytes32)')
    ).slice(0, 10)
    let active = 0
    for (const pk of pubKeys) {
      const root = keccak256(pk)
      const callData = withdrawnSel + root.slice(2)
      const r = await ethCall(1, STAKING_CONTRACT, callData)
      const isWithdrawn = parseInt(r || '0x0', 16) === 1
      if (!isWithdrawn) active++
    }
    return {
      activeCount: active,
      ethStaked: active * ETH_PER_VALIDATOR,
    }
  } catch (err) {
    console.warn('[AUM] getActiveStakedEth failed:', err)
    return { activeCount: 0, ethStaked: 0 }
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

interface DefiInvestment {
  id: string
  name: string
  poolAddress: string
  value: { USD: number; ETH: number; BTC: number }
  symbols: string
  assets: Array<{ symbol: string; amount: number; price: { USD: number } }>
}

interface DefiProtocol {
  id: string
  name: string
  chain: string
  totalValue: { USD: number; ETH: number; BTC: number }
  investments: DefiInvestment[]
}

interface DefiData {
  balance: number
  firstPoolCreationTimestamp: number
  protocols: DefiProtocol[]
}

interface AumResult {
  aumHistory: LineChartData[]
  aum: number
  defiData: DefiData
  /** Side metric: staked ETH (not counted in AUM, matches CoinStats semantics). */
  stakedEth: {
    activeCount: number
    ethStaked: number
    currentUsd: number
  }
}

/**
 * Returns daily AUM history matching the semantics of the original
 * CoinStats-based getAUMHistory. Optional `fromMs`/`toMs` override the
 * default trailing-`days` window.
 */
const aumResultCache = new Map<
  string,
  { ts: number; promise: Promise<AumResult> }
>()
const AUM_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export async function getAUMHistoryOnchain(
  days: number = 365,
  fromMs?: number,
  toMs?: number
): Promise<AumResult> {
  // Memoize: this function is called multiple times per HTTP request
  // (current quarter, previous quarter, revenue path × 2). The work it
  // does — dozens of Etherscan calls per safe — is far too expensive
  // to repeat. Cache by the exact (days, fromMs, toMs) tuple.
  const cacheKey = `${days}|${fromMs ?? ''}|${toMs ?? ''}`
  const cached = aumResultCache.get(cacheKey)
  const nowTs = Date.now()
  if (cached && nowTs - cached.ts < AUM_CACHE_TTL_MS) {
    return cached.promise
  }
  const promise = _getAUMHistoryOnchainImpl(days, fromMs, toMs)
  aumResultCache.set(cacheKey, { ts: nowTs, promise })
  // If the impl rejects, drop the cache entry so the next call can retry.
  promise.catch(() => aumResultCache.delete(cacheKey))
  return promise
}

async function _getAUMHistoryOnchainImpl(
  days: number = 365,
  fromMs?: number,
  toMs?: number
): Promise<AumResult> {
  const empty: AumResult = {
    aumHistory: [],
    aum: 0,
    defiData: { balance: 0, firstPoolCreationTimestamp: 0, protocols: [] },
    stakedEth: { activeCount: 0, ethStaked: 0, currentUsd: 0 },
  }
  if (!ETHERSCAN_KEY) {
    console.error('NEXT_PUBLIC_ETHERSCAN_API_KEY is required')
    return empty
  }
  // Fresh per-run cache. Note: llamaCache is intentionally PROCESS-wide
  // since historical price data doesn't change.
  safeBalCache.clear()

  const now = Date.now()
  const startMs = fromMs ?? now - days * 86400000
  const endMs = toMs ?? now
  const dates = buildDateRange(startMs, endMs)
  if (dates.length === 0) return empty

  // 1. Per-safe historical reconstruction (in series — gentle on rate limits).
  const safeResults: { safe: SafeCfg; result: SafeHistory }[] = []
  for (const safe of SAFES) {
    try {
      const result = await processSafe(safe, startMs, endMs, dates)
      safeResults.push({ safe, result })
    } catch (err) {
      console.error(`[AUM] processSafe failed for ${safe.name}:`, err)
      safeResults.push({
        safe,
        result: { current: 0, daily: new Map(dates.map((d) => [d, 0])) },
      })
    }
  }

  // 2. Build a symbol -> USD price map from ALL safes' Safe API snapshots.
  //    Used to value Uniswap V3 LP token amounts.
  const priceBySymbol = new Map<string, number>()
  for (const safe of SAFES) {
    try {
      const bals = await fetchSafeBalances(
        CHAINS[safe.chain].chainId,
        safe.address
      )
      for (const item of bals?.items ?? []) {
        const px = parseFloat(item.fiatConversion || '0')
        const sym = (item.tokenInfo.symbol || '').trim()
        if (px > 0 && sym && !priceBySymbol.has(sym)) {
          priceBySymbol.set(sym, px)
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (!priceBySymbol.has('WETH') && priceBySymbol.has('ETH')) {
    priceBySymbol.set('WETH', priceBySymbol.get('ETH')!)
  }
  if (!priceBySymbol.has('WPOL') && priceBySymbol.has('POL')) {
    priceBySymbol.set('WPOL', priceBySymbol.get('POL')!)
  }
  // DefiLlama fallback for ETH/WETH if Safe API was unavailable.
  if (!priceBySymbol.has('WETH')) {
    try {
      const j = await fetchJson(
        'https://coins.llama.fi/prices/current/coingecko:ethereum',
        { method: 'GET', host: 'llama' }
      )
      const px = j?.coins?.['coingecko:ethereum']?.price
      if (px > 0) {
        priceBySymbol.set('ETH', px)
        priceBySymbol.set('WETH', px)
      }
    } catch {
      /* ignore */
    }
  }


  // 3. Discover Uniswap V3 LP positions on ETH + Polygon (only DeFi MoonDAO holds).
  const lpEthereum = await discoverUniV3Positions(
    'ethereum',
    MOONDAO_TREASURY,
    priceBySymbol
  )
  // Polygon Treasury holds the MOONEY/WPOL pool position
  const polygonSafe = SAFES.find((s) => s.name === 'Polygon Treasury')!
  const lpPolygon = await discoverUniV3Positions(
    'polygon',
    polygonSafe.address,
    priceBySymbol
  )
  const allLp = [...lpEthereum, ...lpPolygon]
  const defiBalance = allLp.reduce((s, p) => s + lpInvestmentValueUsd(p), 0)
  const firstPoolCreationTimestamp = allLp.length
    ? Math.min(...allLp.map((p) => p.poolCreatedAt).filter((t) => t > 0))
    : 0

  // 4. Aggregate safes + add DeFi flat from earliest-pool-creation forward.
  const totalDaily = new Map<string, number>(dates.map((d) => [d, 0]))
  let currentTotal = 0
  for (const { result } of safeResults) {
    currentTotal += result.current
    for (const date of dates) {
      totalDaily.set(date, (totalDaily.get(date) || 0) + (result.daily.get(date) || 0))
    }
  }
  if (defiBalance > 0) {
    for (const date of dates) {
      const dayMs = new Date(date + 'T00:00:00Z').getTime()
      if (dayMs >= firstPoolCreationTimestamp) {
        totalDaily.set(date, (totalDaily.get(date) || 0) + defiBalance)
      }
    }
    currentTotal += defiBalance
  }

  // 5. Build defiData (shape compatible with revenue.ts / getDeFiRevenue).
  const lpByChain = new Map<string, UniV3LpPosition[]>()
  for (const p of allLp) {
    const arr = lpByChain.get(p.chain) || []
    arr.push(p)
    lpByChain.set(p.chain, arr)
  }
  const protocols: DefiProtocol[] = []
  for (const [chain, positions] of lpByChain.entries()) {
    const investments: DefiInvestment[] = positions
      .map((p) => ({
        id: `uniswap-v3-${p.tokenId}`,
        name: `${p.symbol0}/${p.symbol1}`,
        poolAddress: p.pool,
        value: { USD: lpInvestmentValueUsd(p), ETH: 0, BTC: 0 },
        symbols: `${p.symbol0}/${p.symbol1}`,
        assets: [
          { symbol: p.symbol0, amount: p.amount0, price: { USD: p.price0Usd } },
          { symbol: p.symbol1, amount: p.amount1, price: { USD: p.price1Usd } },
        ],
      }))
      .filter((inv) => inv.value.USD > 0)
    if (investments.length === 0) continue
    protocols.push({
      id: `uniswap-v3-${chain}`,
      name: 'Uniswap V3',
      chain,
      totalValue: {
        USD: investments.reduce((s, i) => s + i.value.USD, 0),
        ETH: 0,
        BTC: 0,
      },
      investments,
    })
  }

  // 6. Side metric: staked ETH (NOT included in `aum`).
  const stakedInfo = await getActiveStakedEth()
  const ethPriceMap = await fetchNativePriceHistory('ethereum', startMs, endMs)
  const lastDate = dates[dates.length - 1]
  const ethPxNow =
    priceBySymbol.get('ETH') ?? priceForDate(ethPriceMap, lastDate, 0)
  const stakedCurrentUsd = stakedInfo.ethStaked * ethPxNow

  // 7. Build the chart-friendly history (timestamps in seconds).
  const aumHistory: LineChartData[] = dates.map((date) => ({
    timestamp: Math.floor(new Date(date + 'T12:00:00Z').getTime() / 1000),
    value: totalDaily.get(date) || 0,
    date,
  }))

  console.log('[AUM On-chain] Per-safe current totals (excl. MOONEY):')
  for (const { safe, result } of safeResults) {
    console.log(`  ${safe.name.padEnd(22)} $${result.current.toFixed(2)}`)
  }
  console.log(`  Uniswap V3 LP (excl. MOONEY): $${defiBalance.toFixed(2)}`)
  for (const p of allLp) {
    console.log(
      `    [${p.chain}] NFT #${p.tokenId} ${p.symbol0}/${p.symbol1}` +
        `  ${p.amount0.toFixed(4)} ${p.symbol0} ($${(p.amount0 * p.price0Usd).toFixed(2)})` +
        `  + ${p.amount1.toFixed(4)} ${p.symbol1} ($${(p.amount1 * p.price1Usd).toFixed(2)})`
    )
  }
  console.log(`  TOTAL AUM (excl. staked ETH): $${currentTotal.toFixed(2)}`)
  console.log(
    `  [side metric] Staked ETH: ${stakedInfo.activeCount} validators ` +
      `× ${ETH_PER_VALIDATOR} = ${stakedInfo.ethStaked} ETH ` +
      `× $${ethPxNow.toFixed(2)} = $${stakedCurrentUsd.toFixed(2)}`
  )
  console.log(
    `[AUM On-chain] History: ${dates[0]} → ${dates[dates.length - 1]} (${dates.length} days)`
  )

  return {
    aumHistory,
    aum: currentTotal,
    defiData: { balance: defiBalance, firstPoolCreationTimestamp, protocols },
    stakedEth: {
      activeCount: stakedInfo.activeCount,
      ethStaked: stakedInfo.ethStaked,
      currentUsd: stakedCurrentUsd,
    },
  }
}






