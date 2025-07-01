import { getBudget } from '../ui/lib/utils/rewards'

// Example token holdings data (what MoonDAO treasury might hold)
const sampleTokens = [
  { symbol: 'ETH', balance: 150, usd: 450000 },     // 150 ETH worth $450k total
  { symbol: 'USDC', balance: 800000, usd: 800000 }, // $800k USDC
  { symbol: 'DAI', balance: 200000, usd: 200000 },  // $200k DAI  
  { symbol: 'stETH', balance: 50, usd: 0 },         // 50 stETH (will use ETH price)
  { symbol: 'MOONEY', balance: 5000000, usd: 25000 } // 5M MOONEY (excluded from budget calc)
]

function demonstrateBudgetCalculation() {
  console.log("=== MoonDAO Budget Calculator ===\n")
  
  console.log("Treasury Holdings:")
  sampleTokens.forEach(token => {
    if (token.symbol === 'stETH') {
      console.log(`${token.symbol}: ${token.balance.toLocaleString()} (uses ETH price)`)
    } else {
      console.log(`${token.symbol}: ${token.balance.toLocaleString()} ($${token.usd.toLocaleString()})`)
    }
  })
  console.log()

  // Calculate budgets for different quarters
  const quarters = [
    { year: 2024, quarter: 1, name: "Q1 2024" },
    { year: 2024, quarter: 2, name: "Q2 2024" },
    { year: 2024, quarter: 4, name: "Q4 2024" },
    { year: 2025, quarter: 1, name: "Q1 2025" },
  ]

  quarters.forEach(({ year, quarter, name }) => {
    console.log(`--- ${name} Budget ---`)
    const budget = getBudget(sampleTokens, year, quarter)
    
    console.log(`Total Treasury Value: $${budget.usdValue.toLocaleString()}`)
    console.log(`ETH Price: $${budget.ethPrice.toFixed(2)}`)
    console.log(`ETH Budget (5% of treasury): ${budget.ethBudget.toFixed(4)} ETH`)
    console.log(`USD Budget: $${budget.usdBudget.toLocaleString()}`)
    console.log(`MOONEY Budget: ${budget.mooneyBudget.toLocaleString()} MOONEY`)
    console.log()
  })

  // Explain the calculation
  console.log("=== How the Budget is Calculated ===")
  console.log("1. ETH Price = Total ETH USD Value / ETH Balance")
  console.log("2. Treasury Value = Sum of all non-MOONEY tokens (stETH uses ETH price)")
  console.log("3. ETH/USD Budget = 5% of total treasury value")
  console.log("4. MOONEY Budget = 15,000,000 * (0.95 ^ quarters_since_Q4_2022)")
  console.log("   - Decays by 5% each quarter from the initial 15M allocation")
}

demonstrateBudgetCalculation() 