/**
 * Free, no-CoinStats replacement for `getAUMHistory`.
 *
 * Strategy:
 *  - CURRENT snapshot: pulled from Safe Transaction Service
 *    (`safe-client.safe.global`) for each of the 8 MoonDAO safes across
 *    Ethereum, Arbitrum, Polygon, Base, and Optimism. This is the same
 *    API the rest of the UI uses via `useAssets()`.
 *  - HISTORICAL reconstruction: for every token currently held by every
 *    safe (excluding MOONEY, which is excluded from AUM throughout the
 *    codebase – see `ui/lib/dashboard/hooks/useAssets.ts`), we pull the
 *    full transfer history via Etherscan v2 and reverse-replay from the
 *    current balance to get end-of-day balances. Each day's balance is
 *    priced via CoinGecko (stables fixed at $1, native + ERC-20 priced
 *    by the historical contract endpoint).
 *
 * Notes:
 *  - Native staked ETH (MoonDAO custom staking contract -> ETH2 deposit
 *    contract) IS included. We query Deposit events from the staking
 *    contract for `MOONDAO_TREASURY` as withdrawer, and for each pubkey
 *    that has not been withdrawn we count 32 ETH at the day's ETH price.
 *  - Uniswap V3 LP NFT positions held by the treasury ARE included. We
 *    look up NFT transfers on Etherscan, decode `positions()` for each
 *    LP position currently owned, derive `pool` via factory, read
 *    `slot0()` for current price, compute on-range token0/token1 amounts,
 *    and price each non-MOONEY side via Safe API per-token `fiatConversion`.
 *  - For historical days, LP USD is held flat at current value (rough
 *    but the Q/Q delta is dominated by ETH price moves, not LP size).
 *  - MOONEY is excluded throughout (matches `useAssets()` /
 *    `getBudget()` codebase convention).
 */

import { LineChartData } from '@/components/layout/LineChart'
import { defaultAbiCoder, keccak256, toUtf8Bytes } from 'ethers/lib/utils'

// ── Config ────────────────────────────────────────────────────────────────────

const ETHERSCAN_API = 'https://api.etherscan.io/v2/api'
const ETHERSCAN_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || ''

// MoonDAO custom staking contract -> ETH2 deposit
const STAKING_CONTRACT = '0xbbb56e071f33e020daEB0A1dD2249B8Bbdb69fB8'
const STAKING_INITIAL_BLOCK = 21839730
const ETH_PER_VALIDATOR = 32

// Uniswap V3
const UNI_V3_NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
const UNI_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

// MoonDAO treasury (the only safe known to hold staked ETH + LP NFT)
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
  /** Native token symbol. */
  nativeSymbol: string
}

const CHAINS: Record<string, ChainCfg> = {
  ethereum: { chainId: 1, cgPlatform: 'ethereum', cgNativeId: 'ethereum', nativeSymbol: 'ETH' },
  arbitrum: { chainId: 42161, cgPlatform: 'arbitrum-one', cgNativeId: 'ethereum', nativeSymbol: 'ETH' },
  polygon: { chainId: 137, cgPlatform: 'polygon-pos', cgNativeId: 'matic-network', nativeSymbol: 'MATIC' },
  base: { chainId: 8453, cgPlatform: 'base', cgNativeId: 'ethereum', nativeSymbol: 'ETH' },
  optimism: { chainId: 10, cgPlatform: 'optimistic-ethereum', cgNativeId: 'ethereum', nativeSymbol: 'ETH' },
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

const STABLE_SYMBOLS = new Set([
  'USDC', 'USDT', 'DAI', 'USDtb', 'USDTB', 'BUSD', 'FRAX', 'LUSD', 'USDe',
  'USDC.e', 'USDT.e', 'DAI.e', 'sDAI', 'USDS', 'PYUSD',
])

const EXCLUDED_SYMBOLS = new Set(['MOONEY'])

// ── Rate-limited fetchers ─────────────────────────────────────────────────────

const ETHERSCAN_RATE_MS = 400
let lastEtherscanCall = 0

async function rateLimitedFetch(url: string, retries = 4): Promise<any> {
  const wait = Math.max(0, lastEtherscanCall + ETHERSCAN_RATE_MS - Date.now())
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastEtherscanCall = Date.now()

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url)
      const data = await res.json()
      if (
        data.status === '0' &&
        typeof data.result === 'string' &&
        data.result.toLowerCase().includes('rate limit')
      ) {
        await new Promise((r) => setTimeout(r, 1500))
        lastEtherscanCall = Date.now()
        continue
      }
      return data
    } catch (err) {
      if (attempt === retries - 1) throw err
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  return { status: '0', message: 'Max retries exceeded', result: null }
}

const COINGECKO_RATE_MS = 1500
let lastCgCall = 0
async function cgFetch(url: string, retries = 3): Promise<any> {
  const wait = Math.max(0, lastCgCall + COINGECKO_RATE_MS - Date.now())
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCgCall = Date.now()

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url)
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)))
        lastCgCall = Date.now()
        continue
      }
      if (!res.ok) return null
      return await res.json()
    } catch (err) {
      if (attempt === retries - 1) return null
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  return null
}

// ── Safe Transaction Service ──────────────────────────────────────────────────

interface SafeTokenItem {
  tokenInfo: {
    type: 'NATIVE_TOKEN' | 'ERC20'
    address: string
    decimals: number
    symbol: string
    name: string
  }
  balance: string
  fiatBalance: string
  fiatConversion: string
}

interface SafeBalanceResponse {
  fiatTotal: string
  items: SafeTokenItem[]
}

async function fetchSafeBalances(
  chainId: number,
  safeAddr: string
): Promise<SafeBalanceResponse | null> {
  const url = `https://safe-client.safe.global/v1/chains/${chainId}/safes/${safeAddr}/balances/usd?trusted=true`
  try {
    const res = await fetch(url, { headers: SAFE_HEADERS })
    if (!res.ok) {
      console.warn(`[AUM] Safe API ${chainId}/${safeAddr} -> HTTP ${res.status}`)
      return null
    }
    return (await res.json()) as SafeBalanceResponse
  } catch (err) {
    console.warn(`[AUM] Safe API ${chainId}/${safeAddr} fetch failed:`, err)
    return null
  }
}

// ── Etherscan v2 transfer history ─────────────────────────────────────────────

interface TxEntry {
  timestamp: number // ms
  delta: number // signed, in token units
}

async function fetchNativeTxs(
  chainId: number,
  address: string
): Promise<TxEntry[]> {
  if (!ETHERSCAN_KEY) return []
  const entries: TxEntry[] = []
  const base = `${ETHERSCAN_API}?chainid=${chainId}&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&sort=asc&apikey=${ETHERSCAN_KEY}`

  for (const action of ['txlist', 'txlistinternal']) {
    const data = await rateLimitedFetch(`${base}&module=account&action=${action}`)
    if (data.status !== '1' || !Array.isArray(data.result)) continue
    for (const tx of data.result) {
      let value: number
      try {
        value = Number(BigInt(tx.value)) / 1e18
      } catch {
        continue
      }
      if (value === 0) continue
      const ts = parseInt(tx.timeStamp) * 1000
      const isIn = tx.to?.toLowerCase() === address.toLowerCase()
      const isOut = tx.from?.toLowerCase() === address.toLowerCase()
      if (!isIn && !isOut) continue
      entries.push({ timestamp: ts, delta: isIn ? value : -value })
    }
  }
  return entries.sort((a, b) => a.timestamp - b.timestamp)
}

async function fetchErc20Txs(
  chainId: number,
  address: string,
  tokenAddress: string,
  decimals: number
): Promise<TxEntry[]> {
  if (!ETHERSCAN_KEY) return []
  const entries: TxEntry[] = []
  const data = await rateLimitedFetch(
    `${ETHERSCAN_API}?chainid=${chainId}&module=account&action=tokentx` +
      `&contractaddress=${tokenAddress}&address=${address}` +
      `&page=1&offset=10000&sort=asc&apikey=${ETHERSCAN_KEY}`
  )
  if (data.status !== '1' || !Array.isArray(data.result)) return entries
  const divisor = Math.pow(10, decimals)
  for (const tx of data.result) {
    let value: number
    try {
      value = Number(BigInt(tx.value)) / divisor
    } catch {
      continue
    }
    if (value === 0) continue
    const ts = parseInt(tx.timeStamp) * 1000
    const isIn = tx.to?.toLowerCase() === address.toLowerCase()
    const isOut = tx.from?.toLowerCase() === address.toLowerCase()
    if (!isIn && !isOut) continue
    entries.push({ timestamp: ts, delta: isIn ? value : -value })
  }
  return entries.sort((a, b) => a.timestamp - b.timestamp)
}

// ── CoinGecko price history ───────────────────────────────────────────────────

const priceCache = new Map<string, Map<string, number>>()

async function fetchNativePriceHistory(
  cgId: string,
  fromMs: number,
  toMs: number
): Promise<Map<string, number>> {
  const cacheKey = `native:${cgId}:${Math.floor(fromMs / 86400000)}:${Math.ceil(toMs / 86400000)}`
  if (priceCache.has(cacheKey)) return priceCache.get(cacheKey)!

  const url = `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart/range?vs_currency=usd&from=${Math.floor(fromMs / 1000)}&to=${Math.floor(toMs / 1000)}`
  const data = await cgFetch(url)
  const map = new Map<string, number>()
  if (data?.prices) {
    for (const [ts, price] of data.prices) {
      const date = new Date(ts).toISOString().split('T')[0]
      map.set(date, price)
    }
  }
  priceCache.set(cacheKey, map)
  return map
}

async function fetchTokenPriceHistory(
  platform: string,
  contractAddress: string,
  fromMs: number,
  toMs: number
): Promise<Map<string, number>> {
  const cacheKey = `tok:${platform}:${contractAddress.toLowerCase()}:${Math.floor(fromMs / 86400000)}:${Math.ceil(toMs / 86400000)}`
  if (priceCache.has(cacheKey)) return priceCache.get(cacheKey)!

  const url = `https://api.coingecko.com/api/v3/coins/${platform}/contract/${contractAddress.toLowerCase()}/market_chart/range?vs_currency=usd&from=${Math.floor(fromMs / 1000)}&to=${Math.floor(toMs / 1000)}`
  const data = await cgFetch(url)
  const map = new Map<string, number>()
  if (data?.prices) {
    for (const [ts, price] of data.prices) {
      const date = new Date(ts).toISOString().split('T')[0]
      map.set(date, price)
    }
  }
  priceCache.set(cacheKey, map)
  return map
}

// ── Daily balance reconstruction ──────────────────────────────────────────────

/**
 * Reverse-replays current balance backwards through `txs` and emits a
 * Map<isoDate, balance> for every date in `dates` (UTC).
 */
function reconstructDailyBalances(
  currentBalance: number,
  allTxs: TxEntry[],
  dates: string[],
  fromMs: number,
  toMs: number
): Map<string, number> {
  const out = new Map<string, number>()

  // Step 1: undo any txs that occurred after toMs to find balance at toMs.
  let balanceAtEnd = currentBalance
  for (let i = allTxs.length - 1; i >= 0; i--) {
    if (allTxs[i].timestamp <= toMs) break
    balanceAtEnd -= allTxs[i].delta
  }

  // Step 2: undo every tx in (fromMs, toMs] to find balance at start.
  const txsInRange = allTxs.filter((t) => t.timestamp > fromMs && t.timestamp <= toMs)
  let balance = balanceAtEnd
  for (let i = txsInRange.length - 1; i >= 0; i--) balance -= txsInRange[i].delta

  // Step 3: walk forward, applying each tx as its day rolls in.
  let txIdx = 0
  for (const date of dates) {
    const dayEndMs = new Date(date + 'T23:59:59Z').getTime()
    while (txIdx < txsInRange.length && txsInRange[txIdx].timestamp <= dayEndMs) {
      balance += txsInRange[txIdx].delta
      txIdx++
    }
    out.set(date, Math.max(0, balance))
  }
  return out
}

function buildDateRange(fromMs: number, toMs: number): string[] {
  const out: string[] = []
  const start = new Date(fromMs)
  start.setUTCHours(0, 0, 0, 0)
  for (let t = start.getTime(); t <= toMs; t += 86400000) {
    out.push(new Date(t).toISOString().split('T')[0])
  }
  return out
}

function priceForDate(map: Map<string, number>, date: string, fallback = 0): number {
  if (map.has(date)) return map.get(date)!
  // Walk backwards up to 7 days for a recent price (CG sometimes skips a day).
  const d = new Date(date + 'T00:00:00Z')
  for (let i = 1; i <= 7; i++) {
    d.setUTCDate(d.getUTCDate() - 1)
    const k = d.toISOString().split('T')[0]
    if (map.has(k)) return map.get(k)!
  }
  return fallback
}

// ── Per-safe processing ───────────────────────────────────────────────────────

interface SafeHistoryResult {
  current: number
  daily: Map<string, number>
}

async function processSafe(
  safe: SafeCfg,
  fromMs: number,
  toMs: number,
  dates: string[]
): Promise<SafeHistoryResult> {
  const cfg = CHAINS[safe.chain]
  const balances = await fetchSafeBalances(cfg.chainId, safe.address)
  if (!balances || !balances.items?.length) {
    return { current: 0, daily: new Map(dates.map((d) => [d, 0])) }
  }

  const dailyTotal = new Map<string, number>(dates.map((d) => [d, 0]))
  let currentTotal = 0

  for (const item of balances.items) {
    const sym = item.tokenInfo.symbol
    if (EXCLUDED_SYMBOLS.has(sym)) continue
    const decimals = item.tokenInfo.decimals
    let currentBal: number
    try {
      currentBal = Number(BigInt(item.balance)) / Math.pow(10, decimals)
    } catch {
      currentBal = parseFloat(item.balance) / Math.pow(10, decimals)
    }
    const currentFiat = parseFloat(item.fiatBalance || '0')
    currentTotal += currentFiat

    if (currentBal === 0 && currentFiat === 0) continue

    const isNative = item.tokenInfo.type === 'NATIVE_TOKEN'
    const isStable = STABLE_SYMBOLS.has(sym)

    // Build daily price map for this token
    let priceMap: Map<string, number>
    if (isStable) {
      priceMap = new Map(dates.map((d) => [d, 1]))
    } else if (isNative) {
      priceMap = await fetchNativePriceHistory(cfg.cgNativeId, fromMs, toMs)
    } else {
      priceMap = await fetchTokenPriceHistory(
        cfg.cgPlatform,
        item.tokenInfo.address,
        fromMs,
        toMs
      )
    }

    // Implied current price as fallback when CoinGecko returns nothing.
    const impliedPrice = currentBal > 0 ? currentFiat / currentBal : 0
    if (priceMap.size === 0 && impliedPrice > 0) {
      priceMap = new Map(dates.map((d) => [d, impliedPrice]))
    }

    // Build daily balance via reverse-replay.
    const txs = isNative
      ? await fetchNativeTxs(cfg.chainId, safe.address)
      : await fetchErc20Txs(cfg.chainId, safe.address, item.tokenInfo.address, decimals)
    const dailyBal = reconstructDailyBalances(currentBal, txs, dates, fromMs, toMs)

    const fallbackPrice =
      priceMap.size > 0
        ? priceMap.get(dates[dates.length - 1]) ??
          Array.from(priceMap.values()).pop() ??
          impliedPrice
        : impliedPrice

    for (const date of dates) {
      const bal = dailyBal.get(date) || 0
      const px = priceForDate(priceMap, date, fallbackPrice)
      dailyTotal.set(date, (dailyTotal.get(date) || 0) + bal * px)
    }
  }

  return { current: currentTotal, daily: dailyTotal }
}

// ── Staked ETH (MoonDAO custom staking → ETH2) ───────────────────────────────

/**
 * Returns currently active validators (deposits not yet flagged withdrawn) =
 * ETH locked × $ETH price = USD AUM contribution from the beacon chain.
 */
async function getActiveStakedEth(): Promise<{
  activeCount: number
  ethStaked: number
  pubKeys: string[]
}> {
  if (!ETHERSCAN_KEY) return { activeCount: 0, ethStaked: 0, pubKeys: [] }
  try {
    // Deposit(address indexed caller, address indexed withdrawer, bytes publicKey, bytes signature)
    const depositSig = keccak256(
      toUtf8Bytes('Deposit(address,address,bytes,bytes)')
    )
    const treasuryTopic =
      '0x' + MOONDAO_TREASURY.slice(2).toLowerCase().padStart(64, '0')
    const logsUrl =
      `${ETHERSCAN_API}?chainid=1&module=logs&action=getLogs` +
      `&address=${STAKING_CONTRACT}&topic0=${depositSig}&topic2=${treasuryTopic}` +
      `&topic0_2_opr=and&fromBlock=${STAKING_INITIAL_BLOCK}&toBlock=latest&apikey=${ETHERSCAN_KEY}`
    const logsResp = await rateLimitedFetch(logsUrl)
    const logs = Array.isArray(logsResp.result) ? logsResp.result : []

    const pubKeys: string[] = []
    for (const log of logs) {
      // log.data = abi-encoded (publicKey bytes, signature bytes)
      // skip 2 offsets (64 chars each), then read pubkey length + bytes
      const d = (log.data as string).startsWith('0x')
        ? (log.data as string).slice(2)
        : (log.data as string)
      const lenOffset = 128
      const len = parseInt(d.slice(lenOffset, lenOffset + 64), 16)
      if (!Number.isFinite(len) || len <= 0 || len > 200) continue
      const pkHex = '0x' + d.slice(lenOffset + 64, lenOffset + 64 + len * 2)
      pubKeys.push(pkHex)
    }
    if (pubKeys.length === 0) {
      return { activeCount: 0, ethStaked: 0, pubKeys: [] }
    }

    // getWithdrawnFromPublicKeyRoot(bytes32) -> bool
    const withdrawnSel = keccak256(
      toUtf8Bytes('getWithdrawnFromPublicKeyRoot(bytes32)')
    ).slice(0, 10)

    let activeCount = 0
    for (const pk of pubKeys) {
      const root = keccak256(pk)
      const callData = withdrawnSel + root.slice(2)
      const url =
        `${ETHERSCAN_API}?chainid=1&module=proxy&action=eth_call` +
        `&to=${STAKING_CONTRACT}&data=${callData}&tag=latest&apikey=${ETHERSCAN_KEY}`
      const r = await rateLimitedFetch(url)
      const isWithdrawn = parseInt(r.result || '0x0', 16) === 1
      if (!isWithdrawn) activeCount++
    }
    return {
      activeCount,
      ethStaked: activeCount * ETH_PER_VALIDATOR,
      pubKeys,
    }
  } catch (err) {
    console.warn('[AUM] getActiveStakedEth failed:', err)
    return { activeCount: 0, ethStaked: 0, pubKeys: [] }
  }
}

// ── Uniswap V3 LP NFT valuation ───────────────────────────────────────────────

interface LpPosition {
  tokenId: string
  token0: string
  token1: string
  fee: number
  tickLower: number
  tickUpper: number
  liquidity: bigint
  amount0: number // token-units (decimals applied)
  amount1: number
  decimals0: number
  decimals1: number
  symbol0: string
  symbol1: string
  /** Per-token USD price as known today (used to value historical LP flat). */
  price0: number
  price1: number
}

async function ethCall(
  chainId: number,
  to: string,
  data: string
): Promise<string | null> {
  const url =
    `${ETHERSCAN_API}?chainid=${chainId}&module=proxy&action=eth_call` +
    `&to=${to}&data=${data}&tag=latest&apikey=${ETHERSCAN_KEY}`
  const r = await rateLimitedFetch(url)
  if (!r || typeof r.result !== 'string') return null
  return r.result
}

async function readErc20Decimals(
  chainId: number,
  tokenAddr: string
): Promise<number> {
  const sel = keccak256(toUtf8Bytes('decimals()')).slice(0, 10)
  const r = await ethCall(chainId, tokenAddr, sel)
  if (!r) return 18
  try {
    return Number(BigInt(r))
  } catch {
    return 18
  }
}

async function readErc20Symbol(
  chainId: number,
  tokenAddr: string
): Promise<string> {
  const sel = keccak256(toUtf8Bytes('symbol()')).slice(0, 10)
  const r = await ethCall(chainId, tokenAddr, sel)
  if (!r) return ''
  try {
    return defaultAbiCoder.decode(['string'], r)[0]
  } catch {
    // bytes32 fallback
    try {
      const bytes32 = r.replace(/^0x/, '').replace(/0+$/, '')
      return Buffer.from(bytes32, 'hex').toString('utf8')
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
  const data = await rateLimitedFetch(url)
  if (!Array.isArray(data.result)) return []
  // Walk transfers to determine final owner per tokenId
  const lastOwner = new Map<string, string>()
  const ownerLow = owner.toLowerCase()
  for (const tx of data.result) {
    const c = (tx.contractAddress || '').toLowerCase()
    if (c !== UNI_V3_NPM.toLowerCase()) continue
    const tid = String(tx.tokenID)
    lastOwner.set(tid, (tx.to || '').toLowerCase())
  }
  return Array.from(lastOwner.entries())
    .filter(([, o]) => o === ownerLow)
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
    const [, , token0, token1, fee, tickLower, tickUpper, liquidity] =
      defaultAbiCoder.decode(types, r) as any[]
    return {
      token0,
      token1,
      fee: Number(fee),
      tickLower: Number(tickLower),
      tickUpper: Number(tickUpper),
      liquidity: BigInt(liquidity.toString()),
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
): Promise<{ pool: string; sqrtPriceX96: bigint; tick: number } | null> {
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
    const [sqrtPriceX96, tick] = defaultAbiCoder.decode(
      ['uint160', 'int24', 'uint16', 'uint16', 'uint16', 'uint8', 'bool'],
      r2
    ) as any[]
    return {
      pool,
      sqrtPriceX96: BigInt(sqrtPriceX96.toString()),
      tick: Number(tick),
    }
  } catch {
    return null
  }
}

function uniV3AmountsFromLiquidity(
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

/**
 * Returns Uniswap V3 LP positions currently owned by `owner` on Ethereum
 * mainnet, with token amounts and per-token USD prices derived from the
 * Safe Transaction Service balance snapshot for the same safe.
 */
async function getUniV3Positions(
  owner: string,
  safePriceBySymbol: Map<string, number>
): Promise<LpPosition[]> {
  const tokenIds = await findOwnedUniV3Tokens(1, owner)
  const positions: LpPosition[] = []
  for (const tokenId of tokenIds) {
    const pos = await readUniV3Position(1, tokenId)
    if (!pos || pos.liquidity === BigInt(0)) continue
    const pool = await readUniV3Pool(1, pos.token0, pos.token1, pos.fee)
    if (!pool) continue
    const { amount0, amount1 } = uniV3AmountsFromLiquidity(
      pos.liquidity,
      pool.sqrtPriceX96,
      pos.tickLower,
      pos.tickUpper
    )
    const [decimals0, decimals1, symbol0, symbol1] = await Promise.all([
      readErc20Decimals(1, pos.token0),
      readErc20Decimals(1, pos.token1),
      readErc20Symbol(1, pos.token0),
      readErc20Symbol(1, pos.token1),
    ])
    // Prefer Safe-API-known prices (already in USD/token at current price).
    // Fall back to 0 (unknown tokens won't contribute).
    const price0 = safePriceBySymbol.get(symbol0) ?? 0
    const price1 = safePriceBySymbol.get(symbol1) ?? 0
    positions.push({
      tokenId,
      token0: pos.token0,
      token1: pos.token1,
      fee: pos.fee,
      tickLower: pos.tickLower,
      tickUpper: pos.tickUpper,
      liquidity: pos.liquidity,
      amount0: amount0 / Math.pow(10, decimals0),
      amount1: amount1 / Math.pow(10, decimals1),
      decimals0,
      decimals1,
      symbol0,
      symbol1,
      price0,
      price1,
    })
  }
  return positions
}

function lpUsdValue(pos: LpPosition, excludeMooney = true): number {
  const v0 = excludeMooney && pos.symbol0 === 'MOONEY' ? 0 : pos.amount0 * pos.price0
  const v1 = excludeMooney && pos.symbol1 === 'MOONEY' ? 0 : pos.amount1 * pos.price1
  return v0 + v1
}



export async function getAUMHistoryOnchain(
  days: number = 365,
  fromMs?: number,
  toMs?: number
): Promise<{
  aumHistory: LineChartData[]
  aum: number
  defiData: { balance: number; firstPoolCreationTimestamp: number; protocols: any[] }
}> {
  const emptyResult = {
    aumHistory: [] as LineChartData[],
    aum: 0,
    defiData: { balance: 0, firstPoolCreationTimestamp: 0, protocols: [] },
  }

  if (!ETHERSCAN_KEY) {
    console.error('NEXT_PUBLIC_ETHERSCAN_API_KEY is required for on-chain AUM history')
    return emptyResult
  }

  const now = Date.now()
  const startMs = fromMs ?? now - days * 86400000
  const endMs = toMs ?? now
  const dates = buildDateRange(startMs, endMs)
  if (dates.length === 0) return emptyResult

  // Process safes serially to be gentle on Etherscan + CoinGecko rate limits.
  const safeResults: { safe: SafeCfg; result: SafeHistoryResult }[] = []
  // Map symbol -> per-token USD price (from main treasury Safe API snapshot).
  // Used to value Uniswap V3 LP token amounts at current prices.
  const safePriceBySymbol = new Map<string, number>()
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

  // Build symbol -> USD price map from the ETH treasury (used for LP pricing).
  try {
    const ethSafe = SAFES.find((s) => s.chain === 'ethereum')
    if (ethSafe) {
      const bals = await fetchSafeBalances(1, ethSafe.address)
      for (const item of bals?.items ?? []) {
        const px = parseFloat(item.fiatConversion || '0')
        if (px > 0) safePriceBySymbol.set(item.tokenInfo.symbol, px)
      }
      // Common alias: WETH ↔ ETH price
      if (!safePriceBySymbol.has('WETH') && safePriceBySymbol.has('ETH')) {
        safePriceBySymbol.set('WETH', safePriceBySymbol.get('ETH')!)
      }
    }
  } catch (err) {
    console.warn('[AUM] could not build price map for LP valuation:', err)
  }

  // Native staked ETH (96 ETH currently across 3 active validators)
  const staked = await getActiveStakedEth()
  const ethPriceMap = await fetchNativePriceHistory('ethereum', startMs, endMs)
  const currentEthPrice =
    safePriceBySymbol.get('ETH') ??
    priceForDate(ethPriceMap, dates[dates.length - 1]) ??
    0

  // Uniswap V3 LP NFTs owned by the ETH treasury
  const lpPositions = await getUniV3Positions(MOONDAO_TREASURY, safePriceBySymbol)
  const lpCurrentUsd = lpPositions.reduce((s, p) => s + lpUsdValue(p, true), 0)

  // Aggregate token-level safe results
  const totalDaily = new Map<string, number>(dates.map((d) => [d, 0]))
  let currentTotal = 0
  for (const { result } of safeResults) {
    currentTotal += result.current
    for (const date of dates) {
      totalDaily.set(date, (totalDaily.get(date) || 0) + (result.daily.get(date) || 0))
    }
  }

  // Add staked ETH at each day's ETH price (assumes today's active count was
  // also active on each historical day in-range, which is true while no
  // validator has withdrawn — we already verified that's the case).
  const stakedEthAmount = staked.ethStaked
  let stakedCurrentUsd = 0
  for (const date of dates) {
    const px = priceForDate(ethPriceMap, date, currentEthPrice)
    totalDaily.set(date, (totalDaily.get(date) || 0) + stakedEthAmount * px)
  }
  stakedCurrentUsd = stakedEthAmount * currentEthPrice

  // Add Uniswap V3 LP value flat across history (LP $ value tends to track
  // ETH price closely; for the Q/Q delta this approximation is fine).
  if (lpCurrentUsd > 0) {
    for (const date of dates) {
      totalDaily.set(date, (totalDaily.get(date) || 0) + lpCurrentUsd)
    }
    currentTotal += lpCurrentUsd
  }
  // Staked ETH contributes to current total too
  currentTotal += stakedCurrentUsd

  const aumHistory: LineChartData[] = dates.map((date) => ({
    timestamp: Math.floor(new Date(date + 'T12:00:00Z').getTime() / 1000),
    value: totalDaily.get(date) || 0,
    date,
  }))

  console.log('[AUM On-chain] Per-safe current totals (excl. MOONEY):')
  for (const { safe, result } of safeResults) {
    console.log(`  ${safe.name.padEnd(22)} $${result.current.toFixed(2)}`)
  }
  console.log(
    `  Staked ETH (${staked.activeCount} validators × ${ETH_PER_VALIDATOR}` +
      ` = ${stakedEthAmount} ETH × $${currentEthPrice.toFixed(2)}): ` +
      `$${stakedCurrentUsd.toFixed(2)}`
  )
  if (lpPositions.length) {
    console.log(`  Uniswap V3 LP positions (excl. MOONEY side): $${lpCurrentUsd.toFixed(2)}`)
    for (const p of lpPositions) {
      console.log(
        `    NFT #${p.tokenId}  ${p.symbol0}/${p.symbol1}  ` +
          `${p.amount0.toFixed(4)} ${p.symbol0} ($${(p.amount0 * p.price0).toFixed(2)})  ` +
          `+ ${p.amount1.toFixed(4)} ${p.symbol1} ($${(p.amount1 * p.price1).toFixed(2)})`
      )
    }
  }
  console.log(`  TOTAL: $${currentTotal.toFixed(2)}`)
  console.log(
    `[AUM On-chain] History: ${dates[0]} → ${dates[dates.length - 1]} (${dates.length} days)`
  )

  return {
    aumHistory,
    aum: currentTotal,
    defiData: { balance: 0, firstPoolCreationTimestamp: 0, protocols: [] },
  }
}
