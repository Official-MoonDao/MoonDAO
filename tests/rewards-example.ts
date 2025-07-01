import {
  computeRewardPercentages,
  getBudget,
  getPayouts,
  runIterativeNormalization,
  runQuadraticVoting
} from '../ui/lib/utils/rewards'

// Example data structures
const sampleProjects = [
  {
    id: "1",
    name: "Project Alpha",
    rewardDistribution: '{"0x1234567890123456789012345678901234567890": 50, "0x2345678901234567890123456789012345678901": 50}',
    upfrontPayments: '{}'
  },
  {
    id: "2", 
    name: "Project Beta",
    rewardDistribution: '{"0x3456789012345678901234567890123456789012": 100}',
    upfrontPayments: '{}'
  }
]

const sampleDistributions = [
  {
    address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
    year: 2024,
    quarter: 1,
    distribution: { "1": 60, "2": 40 }
  },
  {
    address: "0xfedcbafedcbafedcbafedcbafedcbafedcbafedcba",
    year: 2024,
    quarter: 1,
    distribution: { "1": 30, "2": 70 }
  }
]

const sampleTokens = [
  { symbol: 'ETH', balance: 100, usd: 300000 }, // 100 ETH worth $300k total
  { symbol: 'USDC', balance: 500000, usd: 500000 }, // $500k USDC
  { symbol: 'MOONEY', balance: 1000000, usd: 50000 } // 1M MOONEY worth $50k
]

const sampleVotingPower = {
  "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef": 1000,
  "0xfedcbafedcbafedcbafedcbafedcbafedcbafedcba": 500
}

const communityCirle = {
  "0x1111111111111111111111111111111111111111": 100
}

// Example usage
function runRewardsExample() {
  console.log("=== MoonDAO Rewards System Example ===\n")

  // 1. Calculate budget for Q1 2024
  console.log("1. Calculating Budget:")
  const budget = getBudget(sampleTokens, 2024, 1)
  console.log(`ETH Budget: ${budget.ethBudget.toFixed(4)} ETH`)
  console.log(`USD Budget: $${budget.usdBudget.toFixed(2)}`)
  console.log(`MOONEY Budget: ${budget.mooneyBudget.toLocaleString()} MOONEY`)
  console.log(`ETH Price: $${budget.ethPrice.toFixed(2)}\n`)

  // 2. Run iterative normalization (fills in missing votes)
  console.log("2. Running Iterative Normalization:")
  const [normalizedDistributions, votes] = runIterativeNormalization(sampleDistributions, sampleProjects)
  console.log("Normalized distributions:", normalizedDistributions)
  console.log("Vote matrix:", votes)
  console.log()

  // 3. Calculate reward percentages using quadratic voting
  console.log("3. Computing Reward Percentages:")
  const citizenDistributions = sampleDistributions // In real app, this would be filtered
  const nonCitizenDistributions: any[] = [] // Empty for this example
  
  const rewardPercentages = computeRewardPercentages(
    citizenDistributions,
    nonCitizenDistributions,
    sampleProjects,
    sampleVotingPower
  )
  console.log("Project reward percentages:", rewardPercentages)
  console.log()

  // 4. Calculate actual payouts
  console.log("4. Calculating Payouts:")
  const payouts = getPayouts(
    rewardPercentages,
    sampleProjects,
    communityCirle,
    budget.ethBudget,
    budget.mooneyBudget
  )
  
  console.log("ETH Payouts:")
  Object.entries(payouts.addressToEthPayout).forEach(([address, amount]) => {
    console.log(`  ${address}: ${amount.toFixed(6)} ETH`)
  })
  
  console.log("\nMOONEY Payouts:")
  Object.entries(payouts.addressToMooneyPayout).forEach(([address, amount]) => {
    console.log(`  ${address}: ${amount.toLocaleString()} MOONEY`)
  })

  console.log("\n=== CSV Outputs ===")
  console.log("\nETH Payout CSV:")
  console.log(payouts.ethPayoutCSV)
  
  console.log("\nvMOONEY Payout CSV:")
  console.log(payouts.vMooneyPayoutCSV)
}

// Run the example
runRewardsExample() 