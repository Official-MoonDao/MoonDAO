/**
 * Calculate the quarterly project pot for MoonDAO (MDP-267 / Project System v9.0).
 *
 * Pot = 3% of official liquid AUM, rounded to the nearest $500.
 *
 * Official liquid AUM (same set as the finance overview / aum-onchain.ts):
 *   - The eight designated treasury Safes on their home chains
 *   - The WETH side of the Ethereum Uniswap V3 MOONEY/WETH LP
 *   - Exclude MOONEY
 *   - Exclude Kiln-staked ETH (do not add it on top of Safe balances)
 *
 * USD prices lock at 00:00 UTC on the first day of the quarter. Default run
 * (no flags): upcoming quarter's pot, priced at the last quarter-start that
 * has already occurred. Example: in September 2026 this is the Q4 2026 pot
 * at 2026-07-01 00:00 UTC. Once the target quarter has started, the lock
 * date is the first day of that quarter.
 *
 * Usage:
 *   node scripts/calculate-budget.mjs
 *   node scripts/calculate-budget.mjs --year 2026 --quarter 4
 *   node scripts/calculate-budget.mjs --price-date 2026-07-01
 *   node scripts/calculate-budget.mjs --live          # unofficial, current prints
 */

const MAINNET_TREASURY = '0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9'

// Official AUM set: home-chain Safes only. Same addresses as
// `lib/treasury/aum-onchain.ts` COUNTED_SAFES.
const SAFES = [
  { name: 'ETH Treasury', chainId: 1, address: MAINNET_TREASURY },
  { name: 'Arbitrum Treasury', chainId: 42161, address: '0xAF26a002d716508b7e375f1f620338442F5470c0' },
  { name: 'Polygon Treasury', chainId: 137, address: '0x8C0252c3232A2c7379DDC2E44214697ae8fF097a' },
  { name: 'Base Treasury', chainId: 8453, address: '0x871e232Eb935E54Eb90B812cf6fe0934D45e7354' },
  { name: 'Optimism Treasury', chainId: 10, address: '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB45e4' },
  { name: 'Arbitrum Multichain', chainId: 42161, address: '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB4537' },
  { name: 'Polygon Multichain', chainId: 137, address: '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB4537' },
  { name: 'Base Multichain', chainId: 8453, address: '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB4537' },
]

// Ethereum Uniswap V3 MOONEY/WETH position held by the ETH treasury.
// Official AUM counts the WETH side only (MOONEY is excluded throughout).
const UNI_V3_NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
const UNI_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
const UNI_V3_POSITION_ID = 686147n
const ETH_RPCS = [
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://cloudflare-eth.com',
]

const SAFE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Accept: 'application/json',
  Origin: 'https://app.safe.global',
  Referer: 'https://app.safe.global/',
}

const TOKEN_PRICE_IDS = {
  ETH: { llama: 'coingecko:ethereum', gecko: 'ethereum' },
  WETH: { llama: 'coingecko:weth', gecko: 'weth' },
  DAI: { llama: 'coingecko:dai', gecko: 'dai' },
  USDC: { llama: 'coingecko:usd-coin', gecko: 'usd-coin' },
  USDT: { llama: 'coingecko:tether', gecko: 'tether' },
  USDTB: { llama: 'coingecko:usdtb', gecko: 'usdtb' },
  WBTC: { llama: 'coingecko:wrapped-bitcoin', gecko: 'wrapped-bitcoin' },
  SAFE: { llama: 'coingecko:safe', gecko: 'safe' },
  GIV: { llama: 'coingecko:giveth', gecko: 'giveth' },
  POL: { llama: 'coingecko:polygon-ecosystem-token', gecko: 'polygon-ecosystem-token' },
}

const STABLECOINS = new Set(['DAI', 'USDC', 'USDT', 'USDTB', 'USDC.e', 'USDT.e'])
const EXCLUDED_SYMBOLS = new Set(['MOONEY'])
const PROJECT_POT_AUM_RATE = 0.03
const PROJECT_POT_ROUND_USD = 500

function parseArgs(argv) {
  const args = {
    year: null,
    quarter: null,
    priceDate: null,
    live: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--year') args.year = Number(argv[++i])
    else if (a === '--quarter') args.quarter = Number(argv[++i])
    else if (a === '--price-date') args.priceDate = argv[++i]
    else if (a === '--live') args.live = true
    else if (a === '--help' || a === '-h') args.help = true
    else {
      console.error(`Unknown argument: ${a}`)
      process.exit(1)
    }
  }
  if (args.year != null && (args.year < 2022 || !Number.isInteger(args.year))) {
    console.error('--year must be an integer ≥ 2022')
    process.exit(1)
  }
  if (args.quarter != null && ![1, 2, 3, 4].includes(args.quarter)) {
    console.error('--quarter must be 1, 2, 3, or 4')
    process.exit(1)
  }
  if ((args.year == null) !== (args.quarter == null)) {
    console.error('--year and --quarter must be passed together')
    process.exit(1)
  }
  if (args.priceDate && !/^\d{4}-\d{2}-\d{2}$/.test(args.priceDate)) {
    console.error('--price-date must be YYYY-MM-DD (UTC)')
    process.exit(1)
  }
  if (args.live && args.priceDate) {
    console.error('Use either --live or --price-date, not both')
    process.exit(1)
  }
  return args
}

function getCalendarQuarter(date) {
  return {
    year: date.getUTCFullYear(),
    quarter: Math.floor(date.getUTCMonth() / 3) + 1,
  }
}

function addQuarter({ year, quarter }, delta) {
  const abs = year * 4 + (quarter - 1) + delta
  return { year: Math.floor(abs / 4), quarter: (abs % 4) + 1 }
}

function quarterStartUtc({ year, quarter }) {
  return new Date(Date.UTC(year, (quarter - 1) * 3, 1, 0, 0, 0))
}

function formatYmd(date) {
  return date.toISOString().slice(0, 10)
}

/**
 * Target quarter + the UTC midnight used to lock USD prices.
 *
 * Default target is the upcoming quarter (this script writes
 * PROJECT_CYCLE.budgetUSD for the next Senate Vote). Prices lock to the
 * first day of that quarter once it has started; before then they lock to
 * the first day of the current quarter so the print is already finalized.
 */
function resolveTargetAndPriceLock(args, now = new Date()) {
  const target =
    args.year != null
      ? { year: args.year, quarter: args.quarter }
      : addQuarter(getCalendarQuarter(now), 1)

  if (args.live) {
    return {
      target,
      priceLock: null,
      priceLockNote: 'LIVE market prices (unofficial — not a quarter-start lock)',
    }
  }

  if (args.priceDate) {
    const priceLock = new Date(`${args.priceDate}T00:00:00.000Z`)
    if (Number.isNaN(priceLock.getTime())) {
      console.error(`Invalid --price-date: ${args.priceDate}`)
      process.exit(1)
    }
    return {
      target,
      priceLock,
      priceLockNote: `override via --price-date (${formatYmd(priceLock)} 00:00 UTC)`,
    }
  }

  const targetStart = quarterStartUtc(target)
  if (targetStart.getTime() <= now.getTime()) {
    return {
      target,
      priceLock: targetStart,
      priceLockNote: `first day of Q${target.quarter} ${target.year} (00:00 UTC)`,
    }
  }

  const current = getCalendarQuarter(now)
  const priceLock = quarterStartUtc(current)
  return {
    target,
    priceLock,
    priceLockNote:
      `first day of Q${current.quarter} ${current.year} (00:00 UTC); ` +
      `Q${target.quarter} ${target.year} has not started yet`,
  }
}

function numQuartersPastQ4Y2022({ year, quarter }) {
  return (year - 2023) * 4 + quarter
}

function roundToNearest500(amountUSD) {
  if (!Number.isFinite(amountUSD)) return 0
  return Math.round(amountUSD / PROJECT_POT_ROUND_USD) * PROJECT_POT_ROUND_USD
}

function projectPotFromOfficialAum(officialLiquidAumUSD) {
  return roundToNearest500(officialLiquidAumUSD * PROJECT_POT_AUM_RATE)
}

async function fetchJson(url, opts = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        ...opts,
        headers: { Accept: 'application/json', ...(opts.headers || {}) },
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        if (attempt < retries && (res.status === 429 || res.status >= 500 || res.status === 403)) {
          await new Promise((r) => setTimeout(r, attempt * 1500))
          continue
        }
        throw new Error(`HTTP ${res.status} ${body.slice(0, 160)}`)
      }
      return await res.json()
    } catch (err) {
      if (attempt >= retries) throw err
      await new Promise((r) => setTimeout(r, attempt * 1500))
    }
  }
  return null
}

async function getLivePrices() {
  const geckoIds = Object.values(TOKEN_PRICE_IDS)
    .map((t) => t.gecko)
    .join(',')
  const data = await fetchJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${geckoIds}&vs_currencies=usd`
  )
  const prices = {}
  for (const [symbol, ids] of Object.entries(TOKEN_PRICE_IDS)) {
    prices[symbol] = data?.[ids.gecko]?.usd || 0
  }
  return prices
}

async function getHistoricalPrices(priceLock) {
  const timestamp = Math.floor(priceLock.getTime() / 1000)
  const llamaCoins = Object.values(TOKEN_PRICE_IDS)
    .map((t) => t.llama)
    .join(',')
  const prices = {}

  try {
    const data = await fetchJson(
      `https://coins.llama.fi/prices/historical/${timestamp}/${llamaCoins}`
    )
    for (const [symbol, ids] of Object.entries(TOKEN_PRICE_IDS)) {
      prices[symbol] = data?.coins?.[ids.llama]?.price || 0
    }
  } catch (err) {
    console.warn(`  ⚠️  DefiLlama historical failed: ${err.message}`)
  }

  const missing = Object.entries(TOKEN_PRICE_IDS).filter(
    ([symbol]) => !prices[symbol]
  )
  if (missing.length === 0) return prices

  const [year, month, day] = formatYmd(priceLock).split('-')
  const geckoDate = `${day}-${month}-${year}`
  for (const [symbol, ids] of missing) {
    try {
      const data = await fetchJson(
        `https://api.coingecko.com/api/v3/coins/${ids.gecko}/history?date=${geckoDate}&localization=false`
      )
      prices[symbol] = data?.market_data?.current_price?.usd || 0
    } catch (err) {
      console.warn(`  ⚠️  CoinGecko history failed for ${symbol}: ${err.message}`)
      prices[symbol] = 0
    }
  }
  return prices
}

function buildPriceMap(rawPrices) {
  const eth = rawPrices.ETH || 0
  const pol = rawPrices.POL || 0
  const map = {
    ETH: eth,
    AETH: eth,
    WETH: rawPrices.WETH || eth,
    DAI: rawPrices.DAI || 1,
    USDC: rawPrices.USDC || 1,
    USDT: rawPrices.USDT || 1,
    USDTB: rawPrices.USDTB || 1,
    WBTC: rawPrices.WBTC || 0,
    SAFE: rawPrices.SAFE || 0,
    GIV: rawPrices.GIV || 0,
    POL: pol,
    MATIC: pol,
    WPOL: pol,
  }
  for (const symbol of STABLECOINS) {
    if (!map[symbol]) map[symbol] = 1
  }
  return map
}

async function fetchAssets(safe, retries = 3) {
  const url =
    `https://safe-client.safe.global/v1/chains/${safe.chainId}` +
    `/safes/${safe.address}/balances/usd?trusted=true`

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: SAFE_HEADERS,
        redirect: 'follow',
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        if (attempt < retries && (res.status === 429 || res.status >= 500 || res.status === 403)) {
          const wait = attempt * 3000
          console.log(
            `  ⏳ ${safe.name}: HTTP ${res.status}, retrying in ${wait / 1000}s... (attempt ${attempt}/${retries})`
          )
          await new Promise((r) => setTimeout(r, wait))
          continue
        }
        console.error(`  ❌ ${safe.name}: HTTP ${res.status} - ${body.slice(0, 200)}`)
        return []
      }
      const data = await res.json()
      const items = Array.isArray(data?.items) ? data.items : []
      const tokens = items.map((item) => {
        const info = item.tokenInfo || {}
        const decimals = info.decimals ?? 18
        const isNative = info.type === 'NATIVE_TOKEN' || !info.address
        const symbol = (info.symbol || (isNative ? 'ETH' : '?')).trim()
        const balance = parseFloat(item.balance) / Math.pow(10, decimals)
        return {
          balance,
          symbol,
          address: isNative ? 'native' : info.address,
          safe: safe.name,
        }
      })
      console.log(`  ✅ ${safe.name}: ${tokens.length} tokens found`)
      return tokens
    } catch (err) {
      if (attempt < retries) {
        const wait = attempt * 3000
        console.log(
          `  ⏳ ${safe.name}: ${err.message}, retrying in ${wait / 1000}s... (attempt ${attempt}/${retries})`
        )
        await new Promise((r) => setTimeout(r, wait))
        continue
      }
      console.error(`  ❌ ${safe.name}: ${err.message}`)
      return []
    }
  }
  return []
}

function pad64(hex) {
  return hex.replace(/^0x/, '').padStart(64, '0')
}

async function ethCall(to, data) {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_call',
    params: [{ to, data }, 'latest'],
  }
  let lastErr
  for (const rpc of ETH_RPCS) {
    try {
      const json = await fetchJson(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (json?.result && json.result !== '0x') return json.result
      lastErr = new Error(`empty result from ${rpc}`)
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr || new Error('all Ethereum RPCs failed')
}

function signedInt24(value) {
  return value >= 0x800000 ? value - 0x1000000 : value
}

function uniV3Amounts(liquidity, sqrtPriceX96, tickLower, tickUpper) {
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

async function fetchUniV3Weth() {
  // positions(uint256) → 0x99fbab88
  const posSel = '0x99fbab88' + pad64(UNI_V3_POSITION_ID.toString(16))
  const posHex = await ethCall(UNI_V3_NPM, posSel)
  const raw = posHex.replace(/^0x/, '')
  const word = (i) => raw.slice(i * 64, (i + 1) * 64)
  const token0 = '0x' + word(2).slice(24)
  const token1 = '0x' + word(3).slice(24)
  const fee = parseInt(word(4), 16)
  const tickLower = signedInt24(parseInt(word(5).slice(-6), 16))
  const tickUpper = signedInt24(parseInt(word(6).slice(-6), 16))
  const liquidity = BigInt('0x' + word(7))
  if (liquidity === 0n) {
    return { weth: 0, token0, token1, amount0: 0, amount1: 0 }
  }

  const getPoolSel =
    '0x1698ee82' + pad64(token0) + pad64(token1) + pad64(fee.toString(16))
  const poolHex = await ethCall(UNI_V3_FACTORY, getPoolSel)
  const pool = '0x' + poolHex.slice(-40)
  const slot0Hex = await ethCall(pool, '0x3850c7bd')
  const sqrtPriceX96 = BigInt('0x' + slot0Hex.replace(/^0x/, '').slice(0, 64))

  const decSel = '0x313ce567'
  const [d0Hex, d1Hex, s0Hex, s1Hex] = await Promise.all([
    ethCall(token0, decSel),
    ethCall(token1, decSel),
    ethCall(token0, '0x95d89b41'),
    ethCall(token1, '0x95d89b41'),
  ])
  const d0 = Number(BigInt(d0Hex))
  const d1 = Number(BigInt(d1Hex))
  const decodeSymbol = (hex) => {
    try {
      const h = hex.replace(/^0x/, '')
      // dynamic string: offset + length + data
      const len = parseInt(h.slice(64, 128), 16)
      if (len > 0 && len < 64) {
        return Buffer.from(h.slice(128, 128 + len * 2), 'hex').toString('utf8')
      }
      return Buffer.from(h.replace(/00+$/, ''), 'hex').toString('utf8').replace(/\0/g, '')
    } catch {
      return ''
    }
  }
  const symbol0 = decodeSymbol(s0Hex)
  const symbol1 = decodeSymbol(s1Hex)
  const { amount0, amount1 } = uniV3Amounts(liquidity, sqrtPriceX96, tickLower, tickUpper)
  const human0 = amount0 / 10 ** d0
  const human1 = amount1 / 10 ** d1
  const weth =
    symbol0 === 'WETH' ? human0 : symbol1 === 'WETH' ? human1 : 0
  return {
    weth,
    token0,
    token1,
    symbol0,
    symbol1,
    amount0: human0,
    amount1: human1,
    pool,
    fee,
  }
}

function printHelp() {
  console.log(`MoonDAO quarterly project-pot calculator (MDP-267 / v9.0)

Official liquid AUM = designated treasury Safes + Uniswap V3 WETH.
Exclude MOONEY and staked ETH. Pot = 3% of that AUM, rounded to $500.
USD prices lock at 00:00 UTC on the first day of the quarter.

Usage:
  node scripts/calculate-budget.mjs [options]

Options:
  --year YYYY --quarter N   Budget quarter (default: upcoming calendar quarter)
  --price-date YYYY-MM-DD   Override the UTC midnight used for historical prices
  --live                    Use current market prices (unofficial)
  -h, --help                Show this help
`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const { target, priceLock, priceLockNote } = resolveTargetAndPriceLock(args)
  const quartersPast = numQuartersPastQ4Y2022(target)

  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log(
    `║        MoonDAO Q${target.quarter} ${target.year} Budget Calculator (v9)`.padEnd(64) + '║'
  )
  console.log('╚═══════════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`🔒 Price lock: ${priceLockNote}`)
  if (priceLock) {
    console.log(`   timestamp: ${Math.floor(priceLock.getTime() / 1000)} (${priceLock.toISOString()})`)
  }
  console.log()

  console.log('📡 Fetching official AUM Safes (home chains, ex-MOONEY)...')

  const delay = (ms) => new Promise((r) => setTimeout(r, ms))
  const allTokens = []
  for (let i = 0; i < SAFES.length; i++) {
    const tokens = await fetchAssets(SAFES[i])
    allTokens.push(...tokens)
    if (i < SAFES.length - 1) await delay(2500)
  }

  console.log()
  console.log('📡 Reading Uniswap V3 WETH side (NFT #686147)...')
  let lp = null
  try {
    lp = await fetchUniV3Weth()
    console.log(
      `  ✅ ${lp.symbol0}/${lp.symbol1}  ${lp.amount0.toFixed(4)} ${lp.symbol0} + ${lp.amount1.toFixed(4)} ${lp.symbol1}`
    )
    console.log(`     Official AUM counts WETH only: ${lp.weth.toFixed(4)} WETH`)
  } catch (err) {
    console.error(`  ❌ Uniswap V3 read failed: ${err.message}`)
  }

  console.log()
  console.log(priceLock ? '💱 Fetching quarter-start historical prices...' : '💱 Fetching live prices...')
  const rawPrices = priceLock
    ? await getHistoricalPrices(priceLock)
    : await getLivePrices()
  const priceMap = buildPriceMap(rawPrices)
  const ethPrice = priceMap.ETH

  if (!ethPrice) {
    console.error('❌ Could not fetch ETH price. Aborting.')
    process.exit(1)
  }

  console.log(`💰 ETH Price: $${ethPrice.toFixed(2)}`)
  if (priceLock) {
    for (const [symbol, price] of Object.entries(priceMap)) {
      if (symbol === 'ETH' || !price) continue
      if (STABLECOINS.has(symbol) && Math.abs(price - 1) < 0.01) continue
      console.log(`   ${symbol}: $${Number(price).toFixed(2)}`)
    }
  }
  console.log()

  const aggregated = {}
  const perSafe = {}
  for (const t of allTokens) {
    if (EXCLUDED_SYMBOLS.has(t.symbol)) continue
    if (!aggregated[t.symbol]) aggregated[t.symbol] = { symbol: t.symbol, balance: 0 }
    aggregated[t.symbol].balance += t.balance
    if (!perSafe[t.safe]) perSafe[t.safe] = 0
    const px = STABLECOINS.has(t.symbol) ? 1 : priceMap[t.symbol] || 0
    perSafe[t.safe] += t.balance * px
  }

  if (lp?.weth > 0) {
    if (!aggregated.WETH) aggregated.WETH = { symbol: 'WETH', balance: 0 }
    aggregated.WETH.balance += lp.weth
    perSafe['Uniswap V3 LP (WETH)'] = lp.weth * (priceMap.WETH || ethPrice)
  }

  console.log('🏦 Official liquid AUM by custodian (ex-MOONEY, ex-staked ETH):')
  console.log('─'.repeat(70))
  let safeTotal = 0
  for (const [name, usd] of Object.entries(perSafe)) {
    safeTotal += usd
    console.log(`  ${name.padEnd(28)} $${usd.toFixed(2).padStart(12)}`)
  }
  console.log('─'.repeat(70))
  console.log()

  console.log('📊 Token Breakdown (official liquid AUM):')
  console.log('─'.repeat(70))

  let totalUSD = 0
  const tokenEntries = Object.values(aggregated)
    .map((t) => {
      const price = STABLECOINS.has(t.symbol) ? 1 : priceMap[t.symbol] || 0
      const usd = t.balance * price
      return { ...t, price, usd }
    })
    .filter((t) => t.usd > 1)
    .sort((a, b) => b.usd - a.usd)

  for (const token of tokenEntries) {
    totalUSD += token.usd
    console.log(
      `  ${token.symbol.padEnd(12)} ${token.balance.toFixed(4).padStart(15)} @ $${token.price.toFixed(2).padStart(10)}  = $${token.usd.toFixed(2).padStart(12)}`
    )
  }

  console.log('─'.repeat(70))
  console.log(
    `  ${'TOTAL'.padEnd(12)} ${''.padStart(15)}              ${'$' + totalUSD.toFixed(2).padStart(11)}`
  )
  console.log()

  const rawThreePercent = totalUSD * PROJECT_POT_AUM_RATE
  const usdBudget = projectPotFromOfficialAum(totalUSD)
  const maxPerProject = Math.round(usdBudget / 4)
  const community = Math.round(usdBudget * 0.1)

  const MOONEY_INITIAL_BUDGET = 15_000_000
  const MOONEY_DECAY_RATE = 0.95
  const mooneyBudget = MOONEY_INITIAL_BUDGET * Math.pow(MOONEY_DECAY_RATE, quartersPast)
  const mooneyFormatted = mooneyBudget
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  const label = `Q${target.quarter} ${target.year}`
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log(`║  ${label} BUDGET RESULTS (MDP-267 / v9.0)`.padEnd(64) + '║')
  console.log('╠═══════════════════════════════════════════════════════════════╣')
  console.log(
    `║  Official liquid AUM:        $${totalUSD.toFixed(0).padStart(10)}`.padEnd(64) + '║'
  )
  console.log(
    `║  ETH Price:                  $${ethPrice.toFixed(2).padStart(10)}`.padEnd(64) + '║'
  )
  if (priceLock) {
    console.log(
      `║  Price lock (UTC):           ${formatYmd(priceLock)}`.padEnd(64) + '║'
    )
  }
  console.log('║                                                              ║')
  console.log(
    `║  3% of AUM (raw):            $${rawThreePercent.toFixed(0).padStart(10)}`.padEnd(64) + '║'
  )
  console.log(
    `║  📌 PROJECT_CYCLE.budgetUSD:  $${usdBudget.toLocaleString()}`.padEnd(64) + '║'
  )
  console.log('║     (3% of official liquid AUM, nearest $500)                ║')
  console.log('║                                                              ║')
  console.log(
    `║  Grant cap (¼ pot):          $${maxPerProject.toLocaleString()}`.padEnd(64) + '║'
  )
  console.log(
    `║  Community circle (10%):     $${community.toLocaleString()}`.padEnd(64) + '║'
  )
  console.log(
    `║  Max grants if 3 × cap:      $${(maxPerProject * 3).toLocaleString()}`.padEnd(64) + '║'
  )
  console.log(
    `║  Retro if 3 × full cap:      $${(usdBudget - maxPerProject * 3 - community).toLocaleString()}`.padEnd(64) + '║'
  )
  console.log('║                                                              ║')
  console.log(
    `║  vMOONEY Budget:              ${mooneyFormatted} vMOONEY`.padEnd(64) + '║'
  )
  console.log(`║  (15M * 0.95^${quartersPast})`.padEnd(64) + '║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')
  console.log()
  console.log('👉 Update ui/const/config.ts PROJECT_CYCLE:')
  console.log(`   budgetUSD: ${usdBudget}`)
  console.log('   MAX_BUDGET_USD is derived as budgetUSD / 4.')
}

export {
  addQuarter,
  getCalendarQuarter,
  numQuartersPastQ4Y2022,
  quarterStartUtc,
  resolveTargetAndPriceLock,
  roundToNearest500,
  projectPotFromOfficialAum,
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('calculate-budget.mjs') ||
    process.argv[1].endsWith('calculate-budget.js'))

if (isDirectRun) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
