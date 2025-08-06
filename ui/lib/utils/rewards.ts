import { Solve } from '@bygdle/javascript-lp-solver'
import { utils } from 'ethers'
import _ from 'lodash'
import { Distribution } from '@/components/nance/RetroactiveRewards'

// Function to minimize L1 distance
function minimizeL1Distance(D: number[], V: number[][]) {
  const numDistributions = V.length // Number of distributions in V
  const numComponents = D.length // Length of the distributions
  const variables: { [key: string]: { [key: string]: number } } = {}
  const constraints: { [key: string]: { [key: string]: number } } = {}

  // Constraint: sum of c_i equals 1
  constraints['sum_c'] = { equal: 1 }
  // Constraints: c_i >= 0
  for (let i = 0; i < numDistributions; i++) {
    constraints['c' + i + '_nonneg'] = { min: 0 }
  }

  // Constraints: z_k >= 0
  for (let k = 0; k < numComponents; k++) {
    constraints['z' + k + '_nonneg'] = { min: 0 }
  }

  // Constraints for absolute differences
  for (let k = 0; k < numComponents; k++) {
    // Initialize constraints for each k
    constraints['abs_diff_pos_k' + k] = { max: D[k] }
    constraints['abs_diff_neg_k' + k] = { max: -D[k] }
  }

  for (let i = 0; i < numDistributions; i++) {
    const variableName = 'c' + i
    variables[variableName] = {
      cost: 0, // c_i does not contribute to the objective function directly
      sum_c: 1, // Coefficient in the sum_c constraint
      ['c' + i + '_nonneg']: 1, // Coefficient in its non-negativity constraint
    }

    // Coefficients in the absolute difference constraints
    for (let k = 0; k < numComponents; k++) {
      const V_ik = V[i][k]
      variables[variableName]['abs_diff_pos_k' + k] = V_ik
      variables[variableName]['abs_diff_neg_k' + k] = -V_ik
    }
  }

  for (let k = 0; k < numComponents; k++) {
    const variableName = 'z' + k
    variables[variableName] = {
      cost: 1, // z_k contributes to the objective function
      ['z' + k + '_nonneg']: 1, // Coefficient in its non-negativity constraint
    }

    // Coefficient in the absolute difference constraints
    variables[variableName]['abs_diff_pos_k' + k] = -1
    variables[variableName]['abs_diff_neg_k' + k] = -1
  }

  const opType: 'min' = 'min'
  const model = {
    optimize: 'cost',
    opType: opType,
    constraints: constraints,
    variables: variables,
  }
  const results = Solve(model)
  const coefficients = []
  for (let i = 0; i < numDistributions; i++) {
    coefficients.push(results['c' + i] || 0)
  }
  return coefficients
}

function getBestFitDistributions(
  distributions: any,
  projects: any,
  votes: any
) {
  const bestFitDistributions = []
  for (const d of distributions) {
    const desiredDistribution = []
    const dist = d.distribution
    for (const [projectIndex, project] of projects.entries()) {
      desiredDistribution.push(dist[project.id])
    }
    const actualDistribution = minimizeL1Distance(desiredDistribution, votes)
    const newDistribution = {
      address: d.address,
      year: d.year,
      quarter: d.quarter,
      distribution: actualDistribution,
    }
    bestFitDistributions.push(newDistribution)
  }
  return bestFitDistributions
}

export function runIterativeNormalization(distributions: any, projects: any) {
  const numProjects = projects.length

  const numVotes = distributions.length
  const votes = Array.from({ length: numVotes }, () =>
    Array(numProjects).fill(NaN)
  )
  for (const [citizenIndex, d] of distributions.entries()) {
    const { address, year, quarter, distribution: dist } = d
    for (const [projectIndex, project] of projects.entries()) {
      const projectId = project.id
      if (projectId in dist) {
        votes[citizenIndex][projectIndex] = dist[projectId]
      }
    }
  }

  let newVotes: number[][] = []
  let newDistributionSums: number[] = []
  for (let loop = 0; loop < 20; loop++) {
    // compute column wise averages
    const projectAverages = []
    for (let j = 0; j < numProjects; j++) {
      let sum = 0
      let count = 0
      for (let i = 0; i < numVotes; i++) {
        if (!isNaN(votes[i][j])) {
          sum += votes[i][j]
          count += 1
        }
      }
      if (count === 0) {
        projectAverages.push(0)
      } else {
        projectAverages.push(sum / count)
      }
    }

    newVotes = _.cloneDeep(votes)
    for (let j = 0; j < numProjects; j++) {
      for (let i = 0; i < numVotes; i++) {
        if (isNaN(newVotes[i][j])) {
          newVotes[i][j] = projectAverages[j]
        }
      }
    }

    newDistributionSums = []
    for (let i = 0; i < numVotes; i++) {
      newDistributionSums.push(_.sum(newVotes[i]))
    }

    for (let j = 0; j < numProjects; j++) {
      for (let i = 0; i < numVotes; i++) {
        if (!isNaN(votes[i][j])) {
          votes[i][j] = (votes[i][j] / newDistributionSums[i]) * 100
        }
      }
    }
  }

  // recreate distributions
  const newDistributions = []
  for (let i = 0; i < numVotes; i++) {
    const distribution: { [key: string]: number } = {}
    for (let j = 0; j < numProjects; j++) {
      distribution[projects[j].id] = newVotes[i][j]
    }
    newDistributions.push({
      address: distributions[i].address,
      year: distributions[i].year,
      quarter: distributions[i].quarter,
      distribution,
    })
  }
  let return_tuple: [any[], number[][]] = [newDistributions, newVotes]
  return return_tuple
}

export function runQuadraticVoting(
  distributions: Distribution[],
  addressToQuadraticVotingPower: any,
  budgetPercentMinusCommunityFund = 90
) {
  const projectIdToEstimatedPercentage: { [key: string]: number } = {}
  const projectIdToListOfPercentage: { [key: string]: number[] } = {}
  const allAddresses = distributions.map((d) => d.address)
  for (const d of distributions) {
    const { address, year, quarter, distribution: dist } = d
    for (const [key, value] of Object.entries(dist)) {
      if (!projectIdToListOfPercentage[key]) {
        projectIdToListOfPercentage[key] = []
      }
      projectIdToListOfPercentage[key].push(value)
    }
  }
  const votingPowerSum = _.sum(Object.values(addressToQuadraticVotingPower))
  if (votingPowerSum > 0) {
    for (const [projectId, percentages] of Object.entries(
      projectIdToListOfPercentage
    )) {
      projectIdToEstimatedPercentage[projectId] =
        _.sum(
          percentages.map(
            (p, i) => p * addressToQuadraticVotingPower[allAddresses[i]]
          )
        ) / votingPowerSum
    }
    // normalize projectIdToEstimatedPercentage
    const sum = _.sum(Object.values(projectIdToEstimatedPercentage))
    for (const [projectId, percentage] of Object.entries(
      projectIdToEstimatedPercentage
    )) {
      projectIdToEstimatedPercentage[projectId] =
        (percentage / sum) * budgetPercentMinusCommunityFund
    }
  }
  return projectIdToEstimatedPercentage
}

export function zeroOutDistributionForContributors(
  citizenDistributions: any,
  projects: any
) {
  // 1. if a citizen is listed in the rewardDistribution for a projects, zero out that value
  const newDistributions = []
  for (const d of citizenDistributions) {
    const { id, address, year, quarter, distribution: dist } = d
    const newDist: { [key: string]: number } = {}
    for (const project of projects) {
      const contributors: { [key: string]: number } = normalizeJsonString(
        project.rewardDistribution
      )
      if (
        Object.keys(contributors).some(
          (contributor) => contributor.toLowerCase() === address.toLowerCase()
        )
      ) {
        newDist[project.id] = 0
      } else if (project.id in dist) {
        newDist[project.id] = dist[project.id]
      }
    }
    newDistributions.push({
      id: id,
      address,
      year,
      quarter,
      distribution: newDist,
    })
  }
  // 2. normalize the distribution to add up to 100
  const normalizedDistributions = []
  for (const d of newDistributions) {
    const { id, address, year, quarter, distribution: dist } = d
    const sum = _.sum(Object.values(dist))
    const normDist: { [key: string]: number } = {}
    for (const [key, value] of Object.entries(dist)) {
      if (value === 0) {
        continue
      }
      normDist[key] = (value / sum) * 100
    }
    normalizedDistributions.push({
      id: id,
      address,
      year,
      quarter,
      distribution: normDist,
    })
  }
  return normalizedDistributions
}

export function computeRewardPercentages(
  citizenDistributions: any,
  nonCitizenDistributions: any,
  projects: any,
  addressToQuadraticVotingPower: any
) {
  const citizenDistributionsWithZeroedOutContributors =
    zeroOutDistributionForContributors(citizenDistributions, projects)
  const [filledInCitizenDistributions, votes] = runIterativeNormalization(
    citizenDistributionsWithZeroedOutContributors,
    projects
  )

  const bestFitNonCitizenDistributions = getBestFitDistributions(
    nonCitizenDistributions,
    projects,
    votes
  )
  const allDistributions: Distribution[] = [
    ...filledInCitizenDistributions,
    ...bestFitNonCitizenDistributions,
  ]
  return runQuadraticVoting(allDistributions, addressToQuadraticVotingPower)
}
export function getBudget(tokens: any, year: number, quarter: number) {
  const numQuartersPastQ4Y2022 = (year - 2023) * 4 + quarter
  let ethBudget = 0
  let usdValue = 0
  let usdBudget = 0
  let mooneyBudget = 0
  let ethPrice = 0
  let btcPriceCurrent = 0
  const ethToken = tokens.find(
    (token: any) => token.symbol === 'ETH' && token.balance > 0
  )
  if (tokens && ethToken) {
    ethPriceCurrent = ethToken.usd / ethToken.balance
    ethPrice =  2407
      btcPrice = 115341
    for (const token of tokens) {
      if (token.symbol !== 'MOONEY') {
          if ('BTC' in token.symbol) {
              btcPriceCurrent = token.usd / token.balance
          }
        if (token.symbol == 'stETH') {
          usdValue += token.balance * ethPrice
        } else {
            if ('ETH' in token.symbol) {
              usdValue += token.usd  * ethPrice / ethPriceCurrent
            }
            else if ('BTC' in token.symbol) {
              usdValue += token.usd * btcPrice /btcPriceCurrent
            }
            else {
          usdValue += token.usd
            }
        }
      }
    }
    const ethValue = usdValue / ethPrice
    usdBudget = usdValue * 0.05
    ethBudget = ethValue * 0.05
    usdBudget = ethBudget * ethPrice
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

export function normalizeJsonString(jsonString: string) {
  const nonEmptyJsonString = jsonString || '{}'
  // replace fancy double quotes with regular double quotes
  // and add leading double quotes if needed
  return JSON.parse(
    nonEmptyJsonString
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/(\b0x[a-fA-F0-9]{40}\b):/g, '"$1":')
  )
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
      upfrontPayments: '{}',
      rewardDistribution: JSON.stringify(communityCircle),
    },
  ])
  for (const project of projectsAndCommunityCircle) {
    const projectId = project.id
    const projectPercentage =
      projectId == -1
        ? COMMUNITY_CIRCLE_PERCENTAGE
        : projectIdToEstimatedPercentage[projectId]
    const contributors: { [key: string]: number } = normalizeJsonString(
      project.rewardDistribution
    )
    const upfrontPayments: { [key: string]: number } = normalizeJsonString(
      project.upfrontPayments
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
        ((contributerAddress in upfrontPayments &&
        upfrontPayments[contributerAddress] >
          marginalPayoutProportion * ethBudget) ||
        (utils.getAddress(contributerAddress) in upfrontPayments &&
          upfrontPayments[utils.getAddress(contributerAddress)] > marginalPayoutProportion * ethBudget))
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
  const ethPayoutCSV =
    'token_type,token_address,receiver,amount,id\n' +
    Object.entries(addressToEthPayout)
      .map(([address, eth]) => `native,,${address},${eth},`)
      .join('\n')
  const vMooneyPayoutCSV = Object.entries(addressToMooneyPayout)
    .map(([address, mooney]) => `${address},${mooney}`)
    .join('\n')
  const vMooneyAddresses = Object.keys(addressToMooneyPayout).join(',')
  const vMooneyAmounts = Object.values(addressToMooneyPayout)
    .map((mooney) => {
      if (!mooney || mooney === 0) {
        return '0x0'
      }
      return `"${utils.parseUnits(mooney.toString(), 18).toHexString()}"`
    })
    .join(',')

  return {
    addressToEthPayout,
    addressToMooneyPayout,
    ethPayoutCSV,
    vMooneyPayoutCSV,
    vMooneyAddresses,
    vMooneyAmounts,
  }
}
