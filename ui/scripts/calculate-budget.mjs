/**
 * Calculate the quarterly project budget for MoonDAO.
 *
 * Budget = 5% of liquid non-MOONEY assets (NMA), rounded to the nearest USD.
 * MOONEY budget decays geometrically from 15M at 5% per quarter starting Q4 2022.
 *
 * USD prices lock at 00:00 UTC on the first day of the quarter (see
 * ProjectRewards.tsx and docs Projects/Project-System). Live CoinGecko prints
 * are not used — that would make the budget drift with the market.
 *
 * Default run (no flags): upcoming quarter's budget, priced at the last
 * quarter-start that has already occurred. Example: in August 2026 this is
 * the Q4 2026 budget at 2026-07-01 00:00 UTC. Once the target quarter has
 * started, the lock date is the first day of that quarter.
 *
 * Usage:
 *   node scripts/calculate-budget.mjs
 *   node scripts/calculate-budget.mjs --year 2026 --quarter 4
 *   node scripts/calculate-budget.mjs --price-date 2026-07-01
 *   node scripts/calculate-budget.mjs --live          # unofficial, current prints
 *
 * Treasuries (home-chain Safes only) + Kiln-staked ETH:
 *   - Ethereum mainnet
 *   - Arbitrum
 *   - Polygon
 *   - Base
 */

const MAINNET_TREASURY = '0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9'
const ARBITRUM_TREASURY = '0xAF26a002d716508b7e375f1f620338442F5470c0'
const POLYGON_TREASURY = '0x8C0252c3232A2c7379DDC2E44214697ae8fF097a'
const BASE_TREASURY = '0x871e232Eb935E54Eb90B812cf6fe0934D45e7354'
const STAKED_ETH_ADDRESS = '0xbbb56e071f33e020daEB0A1dD2249B8Bbdb69fB8'

// Known Kiln stake (3 deposits × 32 ETH) used when Etherscan is unavailable.
const KNOWN_STAKED_ETH = 96

const SAFES = [
  { name: 'Ethereum Mainnet', chainId: 1, address: MAINNET_TREASURY },
  { name: 'Arbitrum', chainId: 42161, address: ARBITRUM_TREASURY },
  { name: 'Polygon', chainId: 137, address: POLYGON_TREASURY },
  { name: 'Base', chainId: 8453, address: BASE_TREASURY },
]

const SAFE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Accept: 'application/json',
  Origin: 'https://app.safe.global',
  Referer: 'https://app.safe.global/',
}

// DefiLlama / CoinGecko ids for every non-MOONEY asset the treasuries hold.
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

const STABLECOINS = new Set(['DAI', 'USDC', 'USDT', 'USDTB'])

function parseArgs(argv) {
  const args = {
    year: null,
    quarter: null,
    priceDate: null,
    live: false,
    help: false,
    stakedEth: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--year') args.year = Number(argv[++i])
    else if (a === '--quarter') args.quarter = Number(argv[++i])
    else if (a === '--price-date') args.priceDate = argv[++i]
    else if (a === '--staked-eth') args.stakedEth = Number(argv[++i])
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
        if (attempt < retries && (res.status === 429 || res.status >= 500)) {
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

  // CoinGecko /history uses dd-mm-yyyy and returns that calendar day's print.
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
    // Safe Client labels native ETH on Arbitrum as AETH.
    AETH: eth,
    WETH: rawPrices.WETH || eth,
    stETH: eth,
    DAI: rawPrices.DAI || 1,
    USDC: rawPrices.USDC || 1,
    USDT: rawPrices.USDT || 1,
    USDTB: rawPrices.USDTB || 1,
    WBTC: rawPrices.WBTC || 0,
    SAFE: rawPrices.SAFE || 0,
    GIV: rawPrices.GIV || 0,
    POL: pol,
    // Safe Client may still label Polygon native as MATIC.
    MATIC: pol,
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

async function fetchStakedEth(apiKey) {
  // MoonDAO staked ETH via Kiln staking contract.
  // Count Deposit events where the withdrawer is the MoonDAO treasury,
  // then subtract any 32-ETH internals back to the treasury.
  const DEPOSIT_EVENT_TOPIC =
    '0xac1020908b5f7134d59c1580838eba6fc42dd8c28bae65bf345676bba1913f8e'
  const MOONDAO_TREASURY_TOPIC =
    '0x000000000000000000000000ce4a1e86a5c47cd677338f53da22a91d85cab2c9'
  const INITIAL_STAKE_BLOCK = 21839730
  const ETH_PER_DEPOSIT = 32

  if (!apiKey) {
    console.warn(
      `  ⚠️  No ETHERSCAN_API_KEY — using known stake of ${KNOWN_STAKED_ETH} ETH (3 × 32)`
    )
    return KNOWN_STAKED_ETH
  }

  try {
    const url =
      `https://api.etherscan.io/v2/api?chainid=1&module=logs&action=getLogs` +
      `&address=${STAKED_ETH_ADDRESS}&fromBlock=${INITIAL_STAKE_BLOCK}&toBlock=99999999` +
      `&topic0=${DEPOSIT_EVENT_TOPIC}&topic2=${MOONDAO_TREASURY_TOPIC}&topic0_2_opr=and` +
      `&apikey=${apiKey}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status !== '1' || !Array.isArray(data.result)) {
      console.warn(
        `  ⚠️  Could not fetch staked ETH deposit events, using known ${KNOWN_STAKED_ETH} ETH`
      )
      return KNOWN_STAKED_ETH
    }

    const numDeposits = data.result.length
    console.log(`   Found ${numDeposits} deposit events`)

    let withdrawnCount = 0
    const withdrawalUrl =
      `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlistinternal` +
      `&address=${STAKED_ETH_ADDRESS}&startblock=${INITIAL_STAKE_BLOCK}&endblock=99999999` +
      `&sort=asc&apikey=${apiKey}`
    const wRes = await fetch(withdrawalUrl)
    const wData = await wRes.json()

    if (wData.status === '1' && Array.isArray(wData.result)) {
      const treasuryLower = MAINNET_TREASURY.toLowerCase()
      const stakingLower = STAKED_ETH_ADDRESS.toLowerCase()
      for (const tx of wData.result) {
        if (
          tx.from.toLowerCase() === stakingLower &&
          tx.to.toLowerCase() === treasuryLower
        ) {
          const ethReturned = parseInt(tx.value) / 1e18
          if (ethReturned >= 32) {
            withdrawnCount += Math.round(ethReturned / 32)
          }
        }
      }
    }

    const stillStaked = numDeposits - withdrawnCount
    const totalStaked = stillStaked * ETH_PER_DEPOSIT
    if (withdrawnCount > 0) {
      console.log(
        `   ${withdrawnCount} validator(s) withdrawn, ${stillStaked} still staked`
      )
    }
    console.log(
      `   ${stillStaked} validators × ${ETH_PER_DEPOSIT} ETH = ${totalStaked} ETH`
    )
    return totalStaked
  } catch (err) {
    console.warn(
      `  ⚠️  Staked ETH fetch failed (${err.message}), using known ${KNOWN_STAKED_ETH} ETH`
    )
    return KNOWN_STAKED_ETH
  }
}

function printHelp() {
  console.log(`MoonDAO quarterly project-budget calculator

USD prices lock at 00:00 UTC on the first day of the quarter.

Usage:
  node scripts/calculate-budget.mjs [options]

Options:
  --year YYYY --quarter N   Budget quarter (default: upcoming calendar quarter)
  --price-date YYYY-MM-DD   Override the UTC midnight used for historical prices
  --live                    Use current market prices (unofficial)
  --staked-eth N            Override Kiln-staked ETH instead of querying Etherscan
  -h, --help                Show this help

Environment:
  ETHERSCAN_API_KEY         Optional. Without it the script uses the known 96 ETH stake.
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
  const etherscanKey =
    process.env.ETHERSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY

  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log(
    `║        MoonDAO Q${target.quarter} ${target.year} Budget Calculator`.padEnd(64) + '║'
  )
  console.log('╚═══════════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`🔒 Price lock: ${priceLockNote}`)
  if (priceLock) {
    console.log(`   timestamp: ${Math.floor(priceLock.getTime() / 1000)} (${priceLock.toISOString()})`)
  }
  console.log()

  console.log('📡 Fetching treasury balances from all chains...')

  const delay = (ms) => new Promise((r) => setTimeout(r, ms))
  const allTokens = []
  for (let i = 0; i < SAFES.length; i++) {
    const tokens = await fetchAssets(SAFES[i])
    allTokens.push(...tokens)
    if (i < SAFES.length - 1) await delay(3000)
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
      if (symbol === 'ETH' || symbol === 'stETH' || !price) continue
      if (STABLECOINS.has(symbol) && Math.abs(price - 1) < 0.01) continue
      console.log(`   ${symbol}: $${price}`)
    }
  }
  console.log()

  const aggregated = {}
  for (const t of allTokens) {
    if (!aggregated[t.symbol]) {
      aggregated[t.symbol] = { symbol: t.symbol, balance: 0 }
    }
    aggregated[t.symbol].balance += t.balance
  }

  console.log('🔒 Fetching staked ETH...')
  const stakedEth =
    args.stakedEth != null ? args.stakedEth : await fetchStakedEth(etherscanKey)
  if (args.stakedEth != null) {
    console.log(`   Using --staked-eth override: ${stakedEth} ETH`)
  }
  console.log(
    `   Staked ETH: ${stakedEth.toFixed(4)} ETH ($${(stakedEth * ethPrice).toFixed(2)})`
  )
  console.log()

  if (!aggregated['stETH']) {
    aggregated['stETH'] = { symbol: 'stETH', balance: 0 }
  }
  aggregated['stETH'].balance += stakedEth

  console.log('📊 Token Breakdown (non-MOONEY):')
  console.log('─'.repeat(70))

  let totalUSD = 0
  const tokenEntries = Object.values(aggregated)
    .filter((t) => t.symbol !== 'MOONEY')
    .map((t) => {
      const price = priceMap[t.symbol] || 0
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

  // Budget = 5% of liquid non-MOONEY assets in USD (stablecoins)
  // See: https://docs.moondao.com/Projects/Project-System#quarterly-rewards
  const usdBudget = Math.round(totalUSD * 0.05)
  const maxPerProject = Math.round(usdBudget / 5)
  const approvalCap = Math.round((usdBudget * 3) / 4)

  const MOONEY_INITIAL_BUDGET = 15_000_000
  const MOONEY_DECAY_RATE = 0.95
  const mooneyBudget = MOONEY_INITIAL_BUDGET * Math.pow(MOONEY_DECAY_RATE, quartersPast)
  const mooneyFormatted = mooneyBudget
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  const label = `Q${target.quarter} ${target.year}`
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log(`║  ${label} BUDGET RESULTS`.padEnd(64) + '║')
  console.log('╠═══════════════════════════════════════════════════════════════╣')
  console.log(
    `║  Total Assets (non-MOONEY):  $${totalUSD.toFixed(0).padStart(10)}`.padEnd(64) + '║'
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
    `║  📌 PROJECT_CYCLE.budgetUSD:  $${usdBudget.toLocaleString()}`.padEnd(64) + '║'
  )
  console.log('║     (5% of liquid non-MOONEY assets)                         ║')
  console.log('║                                                              ║')
  console.log(
    `║  Max per Project (1/5):       $${maxPerProject.toLocaleString()}`.padEnd(64) + '║'
  )
  console.log(
    `║  Approval Cap (3/4):          $${approvalCap.toLocaleString()}`.padEnd(64) + '║'
  )
  console.log('║                                                              ║')
  console.log(
    `║  Retroactive Rewards:         $${usdBudget.toLocaleString()} - project budgets`.padEnd(64) +
      '║'
  )
  console.log('║    10% of rewards → Community Circle                         ║')
  console.log('║                                                              ║')
  console.log(
    `║  vMOONEY Budget:              ${mooneyFormatted} vMOONEY`.padEnd(64) + '║'
  )
  console.log(`║  (15M * 0.95^${quartersPast})`.padEnd(64) + '║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')
  console.log()
  console.log('👉 Update ui/const/config.ts PROJECT_CYCLE:')
  console.log(`   budgetUSD: ${usdBudget}`)
}

// Exported for the inline self-check when run as `node --input-type=module`
// against this file; the CLI always calls main().
export {
  addQuarter,
  getCalendarQuarter,
  numQuartersPastQ4Y2022,
  quarterStartUtc,
  resolveTargetAndPriceLock,
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
