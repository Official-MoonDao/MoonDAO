import { Solve } from '@bygdle/javascript-lp-solver'
import _ from 'lodash'
import { Distribution, Project } from '@/components/nance/RetroactiveRewards'

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

export function computeRewardPercentages(
  citizenDistributions: any,
  nonCitizenDistributions: any,
  projects: any,
  addressToQuadraticVotingPower: any
) {
  const [filledInCitizenDistributions, votes] = runIterativeNormalization(
    citizenDistributions,
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
