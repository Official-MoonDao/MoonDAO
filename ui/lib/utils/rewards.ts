export function getBudget(tokens: any, year: number, quarter: number) {
  const numQuartersPastQ4Y2022 = (year - 2022) * 4 + quarter - 1
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
  const addressToPayoutProportion: { [key: string]: number } = {}
  for (const project of projects) {
    const projectId = project.id
    const projectPercentage = projectIdToEstimatedPercentage[projectId]
    const contributors = project.contributors
    for (const [contributerAddress, contributorPercentage] of Object.entries(
      contributors
    )) {
      if (contributerAddress in addressToPayoutProportion) {
        addressToPayoutProportion[contributerAddress] +=
          (contributorPercentage / 100) * (projectPercentage / 100)
      } else {
        addressToPayoutProportion[contributerAddress] =
          (contributorPercentage / 100) * (projectPercentage / 100)
      }
    }
  }
  const addressToEthPayout: { [key: string]: number } = {}
  const addressToMooneyPayout: { [key: string]: number } = {}
  for (const [address, proportion] of Object.entries(
    addressToPayoutProportion
  )) {
    addressToEthPayout[address] = proportion * ethBudget
    addressToMooneyPayout[address] = proportion * mooneyBudget
  }
  const ethPayoutCSV = Object.entries(addressToEthPayout)
    .map(([address, eth]) => `${address},${eth}`)
    .join('\n')
  const mooneyPayoutCSV = Object.entries(addressToMooneyPayout)
    .map(([address, mooney]) => `${address},${mooney}`)
    .join('\n')

  return {
    projectIdToETHPayout,
    projectIdToMooneyPayout,
    addressToEthPayout,
    addressToMooneyPayout,
    ethPayoutCSV,
    mooneyPayoutCSV,
  }
}
