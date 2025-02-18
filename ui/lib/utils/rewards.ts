export function getBudget(tokens: any, year: number, quarter: number) {
  const numQuartersPastQ4Y2022 = (year - 2023) * 4 + quarter
  let ethBudget = 0
  let usdValue = 0
  let usdBudget = 0
  let mooneyBudget = 0
  let ethPrice = 0
  const ethToken = tokens.find(
    (token: any) => token.symbol === 'ETH' && token.balance > 0
  )
  if (tokens && ethToken) {
    for (const token of tokens) {
      if (token.symbol !== 'MOONEY') {
        usdValue += token.usd
      }
    }
    ethPrice = ethToken.usd / ethToken.balance
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
  communityCircle: any,
  ethBudget: number,
  mooneyBudget: number
) {
  const addressToEthPayout: { [key: string]: number } = {}
  const addressToMooneyPayout: { [key: string]: number } = {}

  const COMMUNITY_CIRCLE_PERCENTAGE = 10
  const projectsAndCommunityCircle = projects.concat([
    {
      id: -1,
      upfrontPayments: {},
      rewardDistribution: JSON.stringify(communityCircle),
    },
  ])
  for (const project of projectsAndCommunityCircle) {
    const projectId = project.id
    const projectPercentage =
      projectId == -1
        ? COMMUNITY_CIRCLE_PERCENTAGE
        : projectIdToEstimatedPercentage[projectId]
    const rewardDistributionString = project.rewardDistribution || '{}'
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
    addressToEthPayout,
    addressToMooneyPayout,
    ethPayoutCSV,
    vMooneyAddresses,
    vMooneyAmounts,
  }
}
