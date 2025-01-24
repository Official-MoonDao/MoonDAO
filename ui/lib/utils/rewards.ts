export function getBudget(tokens: any, year: number, quarter: number) {
  const numQuartersPastQ4Y2022 = (year - 2023) * 4 + quarter
  let ethBudget = 0
  let usdValue = 0
  let usdBudget = 0
  let mooneyBudget = 0
  let ethPrice = 0
  if (tokens && tokens[0]) {
    for (const token of tokens) {
      if (token.symbol !== 'MOONEY') {
        usdValue += token.usd
      }
    }
    ethPrice = tokens[0].usd / tokens[0].balance
    const ethValue = usdValue / ethPrice
    usdBudget = usdValue * 0.05
    ethBudget = ethValue * 0.05
    const MOONEY_INITIAL_BUDGET = 15_000_000
    const MOONEY_DECAY_RATE = 0.95

    mooneyBudget =
      MOONEY_INITIAL_BUDGET * MOONEY_DECAY_RATE ** numQuartersPastQ4Y2022
  }
  return {
    ethBudget,
    usdBudget,
    mooneyBudget,
    ethPrice,
    usdValue,
  }
}

export function getPayouts(
  projectIdToEstimatedPercentage: any,
  projects: any,
  ethBudget: number,
  mooneyBudget: number
) {
  const projectIdToETHPayout: { [key: string]: number } = {}
  const projectIdToMooneyPayout: { [key: string]: number } = {}
  for (const project of projects) {
    const percentage = projectIdToEstimatedPercentage[project.id]
    projectIdToETHPayout[project.id] = (percentage / 100) * ethBudget
    projectIdToMooneyPayout[project.id] = (percentage / 100) * mooneyBudget
  }
  const addressToEthPayout: { [key: string]: number } = {}
  const addressToMooneyPayout: { [key: string]: number } = {}
  for (const project of projects) {
    const projectId = project.id
    const projectPercentage = projectIdToEstimatedPercentage[projectId]
    const rewardDistributionString = project.rewardDistribution || '{}'
    // arbiscan tends to remove the quotes around the first key, so handle gracefully
    const fixedRewardDistribution = rewardDistributionString.replace(
      /(\b0x[a-fA-F0-9]{40}\b):/g,
      '"$1":'
    )
    const upfrontPayments: { [key: string]: number } = project.upfrontPayments

    const contributors: { [key: string]: number } = JSON.parse(
      fixedRewardDistribution
    )
    for (const [contributerAddress, contributorPercentage] of Object.entries(
      contributors
    )) {
      const marginalPayoutProportion =
        (contributorPercentage / 100) * (projectPercentage / 100)
      if (!(contributerAddress in addressToEthPayout)) {
        addressToEthPayout[contributerAddress] = 0
      }
      if (!(contributerAddress in addressToMooneyPayout)) {
        addressToMooneyPayout[contributerAddress] = 0
      }
      addressToMooneyPayout[contributerAddress] +=
        marginalPayoutProportion * mooneyBudget

      if (
        upfrontPayments &&
        contributerAddress in upfrontPayments &&
        upfrontPayments[contributerAddress] >
          marginalPayoutProportion * ethBudget
      ) {
        continue
      }
      addressToEthPayout[contributerAddress] +=
        marginalPayoutProportion * ethBudget
    }
  }

  const communityCircle = {}
  const COMMUNITY_CIRCLE_PERCENTAGE = 10
  for (const [contributerAddress, contributorPercentage] of Object.entries(
    communityCircle
  )) {
    if (!(contributerAddress in addressToEthPayout)) {
      addressToEthPayout[contributerAddress] = 0
    }
    if (!(contributerAddress in addressToMooneyPayout)) {
      addressToMooneyPayout[contributerAddress] = 0
    }
    const marginalPayoutProportion =
      (COMMUNITY_CIRCLE_PERCENTAGE / 100) * (contributorPercentage / 100)
    addressToMooneyPayout[contributerAddress] +=
      marginalPayoutProportion * mooneyBudget
    addressToEthPayout[contributerAddress] +=
      marginalPayoutProportion * ethBudget
  }

  const addressToPayoutProportion: { [key: string]: number } = {}
  for (const [address, mooneyPayout] of Object.entries(addressToMooneyPayout)) {
    addressToPayoutProportion[address] = mooneyPayout / mooneyBudget
  }
  const ethPayoutCSV = Object.entries(addressToEthPayout)
    .map(([address, eth]) => `${address},${eth}`)
    .join('\n')
  const vMooneyAddresses = Object.keys(addressToMooneyPayout).join(',')
  const vMooneyAmounts = Object.values(addressToMooneyPayout)
    .map((mooney) => `"0x${(mooney * 10 ** 18).toString(16)}"`)
    .join(',')

  return {
    projectIdToETHPayout,
    projectIdToMooneyPayout,
    addressToEthPayout,
    addressToMooneyPayout,
    ethPayoutCSV,
    vMooneyAddresses,
    vMooneyAmounts,
  }
}
