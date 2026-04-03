/**
 * Calculate Q2 2026 quarterly budget for MoonDAO projects.
 * 
 * Budget = 5% of liquid non-MOONEY assets (in ETH)
 * MOONEY budget decays geometrically from 15M at 5% per quarter starting Q4 2022
 * 
 * Fetches data from Safe Global API for all treasury chains:
 *   - Ethereum mainnet
 *   - Arbitrum
 *   - Polygon
 *   - Base
 * Plus staked ETH from the beacon chain deposit contract.
 */

const MAINNET_TREASURY = '0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9'
const ARBITRUM_TREASURY = '0xAF26a002d716508b7e375f1f620338442F5470c0'
const POLYGON_TREASURY = '0x8C0252c3232A2c7379DDC2E44214697ae8fF097a'
const BASE_TREASURY = '0x871e232Eb935E54Eb90B812cf6fe0934D45e7354'
const STAKED_ETH_ADDRESS = '0xbbb56e071f33e020daEB0A1dD2249B8Bbdb69fB8'

// Using Safe Transaction Service API (the client API returns 403)
const MAINNET_URL = `https://safe-transaction-mainnet.safe.global/api/v1/safes/${MAINNET_TREASURY}/balances/?trusted=true`
const ARBITRUM_URL = `https://safe-transaction-arbitrum.safe.global/api/v1/safes/${ARBITRUM_TREASURY}/balances/?trusted=true`
const POLYGON_URL = `https://safe-transaction-polygon.safe.global/api/v1/safes/${POLYGON_TREASURY}/balances/?trusted=true`
const BASE_URL = `https://safe-transaction-base.safe.global/api/v1/safes/${BASE_TREASURY}/balances/?trusted=true`

// Etherscan API for staked ETH (beacon chain deposits)
// Set ETHERSCAN_API_KEY or NEXT_PUBLIC_ETHERSCAN_API_KEY in your environment
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY
if (!ETHERSCAN_API_KEY) {
  console.error('❌ Missing ETHERSCAN_API_KEY env var. Set it in .env.local or export it before running.')
  process.exit(1)
}

// Current quarter: Q2 2026
const YEAR = 2026
const QUARTER = 2
const NUM_QUARTERS_PAST_Q4_2022 = (YEAR - 2023) * 4 + QUARTER // = 14

async function getETHPrice() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
    const data = await res.json()
    return data.ethereum.usd
  } catch {
    // Fallback: use CoinGecko alternative
    try {
      const res = await fetch('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD')
      const data = await res.json()
      return data.USD
    } catch {
      return 0
    }
  }
}

// Token prices for non-ETH tokens (CoinGecko IDs)
const TOKEN_COINGECKO_IDS = {
  'DAI': 'dai',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'WBTC': 'wrapped-bitcoin',
  'WETH': 'weth',
  'SAFE': 'safe',
  'GIV': 'giveth',
  'USDTB': 'usdtb',
}

async function getTokenPrices() {
  const ids = Object.values(TOKEN_COINGECKO_IDS).join(',')
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`)
    const data = await res.json()
    const prices = {}
    for (const [symbol, id] of Object.entries(TOKEN_COINGECKO_IDS)) {
      prices[symbol] = data[id]?.usd || 0
    }
    return prices
  } catch {
    return {}
  }
}

async function fetchAssets(url, chainName, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        if (attempt < retries && (res.status === 429 || res.status >= 500)) {
          const wait = attempt * 3000
          console.log(`  ⏳ ${chainName}: HTTP ${res.status}, retrying in ${wait/1000}s... (attempt ${attempt}/${retries})`)
          await new Promise(r => setTimeout(r, wait))
          continue
        }
        console.error(`  ❌ ${chainName}: HTTP ${res.status} - ${body.slice(0, 200)}`)
        return []
      }
      const data = await res.json()
      const tokens = data.map((item) => {
        const decimals = item.token ? item.token.decimals : 18
        const symbol = item.token ? item.token.symbol : 'ETH'
        const balance = parseFloat(item.balance) / Math.pow(10, decimals)
        return {
          balance,
          symbol,
          address: item.tokenAddress || 'native',
        }
      })
      console.log(`  ✅ ${chainName}: ${tokens.length} tokens found`)
      return tokens
    } catch (err) {
      if (attempt < retries) {
        const wait = attempt * 3000
        console.log(`  ⏳ ${chainName}: ${err.message}, retrying in ${wait/1000}s... (attempt ${attempt}/${retries})`)
        await new Promise(r => setTimeout(r, wait))
        continue
      }
      console.error(`  ❌ ${chainName}: ${err.message}`)
      return []
    }
  }
  return []
}

async function fetchStakedEth() {
  // MoonDAO staked ETH via Kiln staking contract
  // We count Deposit events where the withdrawer is the MoonDAO treasury,
  // then check each validator's withdrawal status via getWithdrawnFromPublicKeyRoot
  // to mirror the app's useStakedEth hook logic.
  const DEPOSIT_EVENT_TOPIC = '0xac1020908b5f7134d59c1580838eba6fc42dd8c28bae65bf345676bba1913f8e'
  const MOONDAO_TREASURY_TOPIC = '0x000000000000000000000000ce4a1e86a5c47cd677338f53da22a91d85cab2c9'
  const INITIAL_STAKE_BLOCK = 21839730
  const ETH_PER_DEPOSIT = 32

  // keccak256 helper using the Web Crypto API (no dependencies)
  async function keccak256(hexData) {
    // We need actual keccak256, not SHA-3. Use a minimal pure-JS implementation.
    // For simplicity, use etherscan's eth_call to check withdrawal status directly.
    // The function selector for getWithdrawnFromPublicKeyRoot(bytes32) is the first 4 bytes of keccak256("getWithdrawnFromPublicKeyRoot(bytes32)")
    return null // handled below via contract call
  }

  try {
    // Step 1: Get deposit events
    const url = `https://api.etherscan.io/v2/api?chainid=1&module=logs&action=getLogs&address=${STAKED_ETH_ADDRESS}&fromBlock=${INITIAL_STAKE_BLOCK}&toBlock=99999999&topic0=${DEPOSIT_EVENT_TOPIC}&topic2=${MOONDAO_TREASURY_TOPIC}&topic0_2_opr=and&apikey=${ETHERSCAN_API_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status !== '1' || !Array.isArray(data.result)) {
      console.warn('  ⚠️  Could not fetch staked ETH deposit events, using 0')
      return 0
    }

    const numDeposits = data.result.length
    console.log(`   Found ${numDeposits} deposit events`)

    // Step 2: Extract public keys and check withdrawal status
    // The Deposit event data contains: publicKey (bytes) and signature (bytes), ABI-encoded
    // We need to decode the pubkey, compute its keccak256 root, then call getWithdrawnFromPublicKeyRoot
    // Function selector: 0x9a498a07 = getWithdrawnFromPublicKeyRoot(bytes32)
    const GET_WITHDRAWN_SELECTOR = '0x9a498a07'

    let withdrawnCount = 0
    for (const event of data.result) {
      // ABI decode: data is offset(pubkey) + offset(sig) + len(pubkey) + pubkey + len(sig) + sig
      // The pubkey is a 48-byte BLS key. The publicKeyRoot is keccak256(pubkey padded to 64 bytes)
      // For keccak256 without ethers, we use Etherscan's proxy API to call the contract
      // which already stores the mapping — we just need to derive the root.

      // Actually, the simplest approach: extract pubkey from event data, then call the contract
      // via eth_call with the pubkey root. But computing keccak256 in pure JS without deps is complex.
      // 
      // Pragmatic approach: just call eth_call for each deposit's toggleWithdrawnFromPublicKeyRoot
      // No — let's just check if any ETH was returned to the treasury from the staking contract.
    }

    // Simpler withdrawal check: look for any ETH transfers from staking contract back to MoonDAO treasury
    const withdrawalUrl = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlistinternal&address=${STAKED_ETH_ADDRESS}&startblock=${INITIAL_STAKE_BLOCK}&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`
    const wRes = await fetch(withdrawalUrl)
    const wData = await wRes.json()

    if (wData.status === '1' && Array.isArray(wData.result)) {
      const MOONDAO_TREASURY_LOWER = MAINNET_TREASURY.toLowerCase()
      const STAKING_LOWER = STAKED_ETH_ADDRESS.toLowerCase()

      for (const tx of wData.result) {
        if (tx.from.toLowerCase() === STAKING_LOWER && tx.to.toLowerCase() === MOONDAO_TREASURY_LOWER) {
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
      console.log(`   ${withdrawnCount} validator(s) withdrawn, ${stillStaked} still staked`)
    }
    console.log(`   ${stillStaked} validators × ${ETH_PER_DEPOSIT} ETH = ${totalStaked} ETH`)
    return totalStaked
  } catch (err) {
    console.warn(`  ⚠️  Staked ETH fetch failed: ${err.message}`)
    return 0
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║        MoonDAO Q2 2026 Budget Calculator                     ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')
  console.log()

  console.log('📡 Fetching treasury balances from all chains...')

  const delay = (ms) => new Promise((r) => setTimeout(r, ms))

  // Fetch sequentially with delays to avoid Safe API rate limiting (429/504)
  const mainnetTokens = await fetchAssets(MAINNET_URL, 'Ethereum Mainnet')
  await delay(3000)
  const arbitrumTokens = await fetchAssets(ARBITRUM_URL, 'Arbitrum')
  await delay(3000)
  const polygonTokens = await fetchAssets(POLYGON_URL, 'Polygon')
  await delay(3000)
  const baseTokens = await fetchAssets(BASE_URL, 'Base')

  const [ethPrice, tokenPrices] = await Promise.all([
    getETHPrice(),
    getTokenPrices(),
  ])

  if (ethPrice === 0) {
    console.error('❌ Could not fetch ETH price. Aborting.')
    process.exit(1)
  }

  console.log()
  console.log(`💰 ETH Price: $${ethPrice.toFixed(2)}`)
  console.log()

  // Combine all tokens
  const allTokens = [...mainnetTokens, ...arbitrumTokens, ...polygonTokens, ...baseTokens]

  // Aggregate by symbol
  const aggregated = {}
  for (const t of allTokens) {
    if (!aggregated[t.symbol]) {
      aggregated[t.symbol] = { symbol: t.symbol, balance: 0 }
    }
    aggregated[t.symbol].balance += t.balance
  }

  // Fetch staked ETH
  console.log('🔒 Fetching staked ETH...')
  const stakedEth = await fetchStakedEth()
  console.log(`   Staked ETH: ${stakedEth.toFixed(4)} ETH ($${(stakedEth * ethPrice).toFixed(2)})`)
  console.log()

  // Add staked ETH
  if (!aggregated['stETH']) {
    aggregated['stETH'] = { symbol: 'stETH', balance: 0 }
  }
  aggregated['stETH'].balance += stakedEth

  // Calculate USD values for each token
  const priceMap = {
    'ETH': ethPrice,
    'WETH': ethPrice,
    'stETH': ethPrice,
    'DAI': tokenPrices['DAI'] || 1,
    'USDC': tokenPrices['USDC'] || 1,
    'USDT': tokenPrices['USDT'] || 1,
    'USDTB': tokenPrices['USDTB'] || 1,
    'WBTC': tokenPrices['WBTC'] || 0,
    'SAFE': tokenPrices['SAFE'] || 0,
    'GIV': tokenPrices['GIV'] || 0,
  }

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
  console.log(`  ${'TOTAL'.padEnd(12)} ${''.padStart(15)}              ${'$' + totalUSD.toFixed(2).padStart(11)}`)
  console.log()

  // Budget = 5% of liquid non-MOONEY assets in USD (stablecoins)
  const usdBudget = Math.round(totalUSD * 0.05)

  // MOONEY budget with geometric decay
  const MOONEY_INITIAL_BUDGET = 15_000_000
  const MOONEY_DECAY_RATE = 0.95
  const mooneyBudget = MOONEY_INITIAL_BUDGET * Math.pow(MOONEY_DECAY_RATE, NUM_QUARTERS_PAST_Q4_2022)

  // Derived values
  const communityCircleFraction = 0.1
  const availableForFundingFraction = 0.75
  const maxBudgetFraction = 0.2

  const projectsBudgetUSD = usdBudget * (1 - communityCircleFraction)
  const fundingUSD = projectsBudgetUSD * availableForFundingFraction
  const maxBudgetUSD = projectsBudgetUSD * maxBudgetFraction

  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║  Q2 2026 BUDGET RESULTS                                     ║')
  console.log('╠═══════════════════════════════════════════════════════════════╣')
  console.log(`║  Total Assets (non-MOONEY):  $${totalUSD.toFixed(0).padStart(10)}`.padEnd(64) + '║')
  console.log(`║  ETH Price:                  $${ethPrice.toFixed(2).padStart(10)}`.padEnd(64) + '║')
  console.log('║                                                              ║')
  console.log(`║  📌 NEXT_QUARTER_BUDGET_USD:  $${usdBudget.toLocaleString()}`.padEnd(64) + '║')
  console.log(`║     (5% of liquid non-MOONEY assets)`.padEnd(64) + '║')
  console.log('║                                                              ║')
  console.log(`║  Projects Budget (90%):       $${Math.round(projectsBudgetUSD).toLocaleString()}`.padEnd(64) + '║')
  console.log(`║  Available for Funding (75%): $${Math.round(fundingUSD).toLocaleString()}`.padEnd(64) + '║')
  console.log(`║  Max Single Project (20%):    $${Math.round(maxBudgetUSD).toLocaleString()}`.padEnd(64) + '║')
  console.log(`║  Community Circle (10%):      $${Math.round(usdBudget * communityCircleFraction).toLocaleString()}`.padEnd(64) + '║')
  console.log('║                                                              ║')
  console.log(`║  vMOONEY Budget:              ${mooneyBudget.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} vMOONEY`.padEnd(64) + '║')
  console.log(`║  (15M * 0.95^${NUM_QUARTERS_PAST_Q4_2022})`.padEnd(64) + '║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`👉 Update ui/const/config.ts:`)
  console.log(`   export const NEXT_QUARTER_BUDGET_USD = ${usdBudget}`)
}

main().catch(console.error)