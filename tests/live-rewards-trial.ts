import { getBudget } from '../ui/lib/utils/rewards'

// MoonDAO's actual Safe addresses and API endpoints
const TREASURY_URLS = {
  ethereum: process.env.NEXT_PUBLIC_ASSETS_URL, // Will need to check this
  arbitrum: 'https://safe-client.safe.global/v1/chains/42161/safes/0xAF26a002d716508b7e375f1f620338442F5470c0/balances/usd?trusted=true',
  polygon: 'https://safe-client.safe.global/v1/chains/137/safes/0x8C0252c3232A2c7379DDC2E44214697ae8fF097a/balances/usd?trusted=true',
  base: 'https://safe-client.safe.global/v1/chains/8453/safes/0x871e232Eb935E54Eb90B812cf6fe0934D45e7354/balances/usd?trusted=true'
}

// Get current quarter info
function getCurrentQuarter() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // JavaScript months are 0-indexed
  const quarter = Math.ceil(month / 3)
  return { year, quarter }
}

// Transform Safe API response to match expected format
function transformAssets(safeResponse: any) {
  if (!safeResponse || !safeResponse.items || !Array.isArray(safeResponse.items)) {
    return []
  }
  
  return safeResponse.items.map((item: any) => {
    const tokenInfo = item.tokenInfo || {}
    let symbol = tokenInfo.symbol || 'UNKNOWN'
    
    // Normalize symbol names (AETH -> ETH, etc.)
    if (symbol === 'AETH') symbol = 'ETH'
    
    const balance = parseFloat(item.balance) / Math.pow(10, tokenInfo.decimals || 18)
    const usdValue = parseFloat(item.fiatBalance) || 0
    
    return {
      symbol,
      balance,
      usd: usdValue
    }
  })
}

// Fetch treasury data from a single chain
async function fetchChainAssets(chainName: string, url: string) {
  try {
    console.log(`Fetching ${chainName} treasury data...`)
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    const assets = transformAssets(data)
    
    console.log(`✅ ${chainName}: Found ${assets.length} assets`)
    return assets
  } catch (error) {
    console.error(`❌ Failed to fetch ${chainName} data:`, error)
    return []
  }
}

// Fetch staked ETH (simplified version - in real app this comes from a contract call)
async function getStakedEth() {
  // For trial run, we'll use a placeholder
  // In the real app, this calls a contract to get actual staked ETH
  console.log("📍 Using placeholder for staked ETH (real app calls contract)")
  return 0 // Will need actual implementation for production
}

async function runLiveRewardsTrial() {
  console.log("🚀 === LIVE MoonDAO Rewards Trial Run ===")
  console.log(`⏰ Trial run time: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST\n`)
  
  const { year, quarter } = getCurrentQuarter()
  console.log(`📅 Current Quarter: Q${quarter} ${year}\n`)
  
  // Fetch live treasury data from all chains
  console.log("💰 Fetching live treasury data from all chains...")
  
  const [arbitrumAssets, polygonAssets, baseAssets] = await Promise.all([
    fetchChainAssets('Arbitrum', TREASURY_URLS.arbitrum),
    fetchChainAssets('Polygon', TREASURY_URLS.polygon),
    fetchChainAssets('Base', TREASURY_URLS.base),
  ])
  
  // Get staked ETH
  const stakedEth = await getStakedEth()
  
  // Combine all assets
  const allAssets = [
    ...arbitrumAssets,
    ...polygonAssets, 
    ...baseAssets,
    { symbol: 'stETH', balance: stakedEth, usd: 0 } // USD will be calculated using ETH price
  ]
  
  console.log("\n📊 === LIVE TREASURY SUMMARY ===")
  
  // Group by token symbol and sum balances
  const tokenSummary: { [symbol: string]: { balance: number, usd: number } } = {}
  allAssets.forEach(asset => {
    if (!tokenSummary[asset.symbol]) {
      tokenSummary[asset.symbol] = { balance: 0, usd: 0 }
    }
    tokenSummary[asset.symbol].balance += asset.balance
    tokenSummary[asset.symbol].usd += asset.usd
  })
  
  // Display treasury summary
  let totalUsd = 0
  Object.entries(tokenSummary).forEach(([symbol, data]) => {
    if (symbol !== 'MOONEY') { // MOONEY is excluded from budget calculation
      totalUsd += data.usd
    }
    console.log(`${symbol}: ${data.balance.toLocaleString(undefined, {maximumFractionDigits: 4})} ($${data.usd.toLocaleString()})`)
  })
  
  console.log(`\n💵 Total Treasury Value (excluding MOONEY): $${totalUsd.toLocaleString()}`)
  
  // Calculate budget using live data
  console.log("\n🧮 === BUDGET CALCULATION ===")
  console.log("Assets passed to getBudget:", allAssets.map(a => `${a.symbol}: ${a.balance} ($${a.usd})`))
  
  const budget = getBudget(allAssets, year, quarter)
  
  console.log(`ETH Price: $${budget.ethPrice.toFixed(2)}`)
  console.log(`ETH Budget (5% of treasury): ${budget.ethBudget.toFixed(4)} ETH`)
  console.log(`USD Budget: $${budget.usdBudget.toLocaleString()}`)
  console.log(`MOONEY Budget: ${budget.mooneyBudget.toLocaleString()} MOONEY`)
  
  // Calculate quarters since Q4 2022 for MOONEY decay info
  const quartersSinceQ4_2022 = (year - 2023) * 4 + quarter
  const decayFactor = Math.pow(0.95, quartersSinceQ4_2022)
  
  // Manual MOONEY calculation as backup (matches the rewards.ts logic)
  const MOONEY_INITIAL_BUDGET = 15_000_000
  const MOONEY_DECAY_RATE = 0.95
  const manualMooneyBudget = MOONEY_INITIAL_BUDGET * Math.pow(MOONEY_DECAY_RATE, quartersSinceQ4_2022)
  
  console.log("\n📈 === MOONEY BUDGET DETAILS ===")
  console.log(`Quarters since Q4 2022: ${quartersSinceQ4_2022}`)
  console.log(`Decay factor (0.95^${quartersSinceQ4_2022}): ${decayFactor.toFixed(4)}`)
  console.log(`Initial MOONEY budget: 15,000,000`)
  console.log(`Current MOONEY budget (from getBudget): ${budget.mooneyBudget.toLocaleString()}`)
  console.log(`Manual MOONEY calculation: ${manualMooneyBudget.toLocaleString()}`)
  
  console.log("\n🎯 === TRIAL RUN COMPLETE ===")
  console.log("This is the budget that would be distributed if rewards were calculated right now.")
  console.log("Actual distribution requires citizen voting data and project submissions.")
  
  return {
    budget,
    treasuryValue: totalUsd,
    tokenSummary,
    quarter,
    year
  }
}

// Run the trial
runLiveRewardsTrial()
  .then((result) => {
    console.log("\n✅ Trial run completed successfully!")
  })
  .catch((error) => {
    console.error("\n❌ Trial run failed:", error)
  }) 