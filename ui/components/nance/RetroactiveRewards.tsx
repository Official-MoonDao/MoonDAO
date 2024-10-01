import {
  PlusIcon,
  QueueListIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/solid'
import { NanceProvider } from '@nance/nance-hooks'
import { useProposalsInfinite } from '@nance/nance-hooks'
import { ProposalsPacket, getActionsFromBody } from '@nance/nance-sdk'
import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import { useAddress, useContract } from '@thirdweb-dev/react'
import {
  PROJECT_TABLE_ADDRESSES,
  DISTRIBUTION_TABLE_ADDRESSES,
  TABLELAND_ENDPOINT,
} from 'const/config'
//const solver = require('javascript-lp-solver');
import solver from 'javascript-lp-solver'
import _ from 'lodash'
import { StringParam, useQueryParams, withDefault } from 'next-query-params'
import { useState, useEffect } from 'react'
import { useDebounce } from 'react-use'
import useCitizen from '@/lib/citizen/useCitizen'
import { useAssets } from '@/lib/dashboard/hooks'
import { SNAPSHOT_SPACE_NAME } from '@/lib/nance/constants'
import { NANCE_API_URL } from '@/lib/nance/constants'
import {
  SnapshotGraphqlProposalVotingInfo,
  useVotingPower,
} from '@/lib/snapshot'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import ProposalList from '@/components/nance/ProposalList'

type ProjectType = {
  id: string
  title: string
  // ... other project properties
}

export type RetroactiveRewardsProps = {
  projects: ProjectType[]
  //distributionTableContract: any
  distributions: []
}

// Function to minimize L1 distance
function minimizeL1Distance(D, V) {
  const numDistributions = V.length // Number of distributions in V
  const numComponents = D.length // Length of the distributions

  // Initialize variables for the LP problem
  const variables = {}

  // Initialize constraints
  const constraints = {}

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

  // Build variables
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

  // Define the model for the LP solver
  const model = {
    optimize: 'cost',
    opType: 'min',
    constraints: constraints,
    variables: variables,
  }

  // Solve the LP problem
  const results = solver.Solve(model)

  // Extract coefficients c_i from the results
  const coefficients = []
  for (let i = 0; i < numDistributions; i++) {
    coefficients.push(results['c' + i] || 0)
  }
  return coefficients
}

function fillIn(distributions, projects) {
  const numProjects = projects.length

  const numVotes = distributions.length
  const votes = Array.from({ length: numVotes }, () =>
    Array(numProjects).fill(NaN)
  )
  for (const [citizenIndex, d] of distributions.entries()) {
    const { address, year, quarter, distribution: dist } = d
    for (const [projectIndex, project] of projects.entries()) {
      const projectId = project.id
      votes[citizenIndex][projectIndex] = dist[projectId]
    }
  }

  let newVotes = []
  let newDistributionSums = []
  for (let loop = 0; loop < 10; loop++) {
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
      projectAverages.push(sum / count)
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
    for (let j = 0; j < numProjects; j++) {
      newDistributionSums.push(_.sum(newVotes[j]))
    }

    for (let j = 0; j < numProjects; j++) {
      for (let i = 0; i < numVotes; i++) {
        if (!isNaN(votes[i][j])) {
          votes[i][j] = (votes[i][j] / newDistributionSums[i]) * 100
        }
      }
    }
  }

  const testVotes = [
    [0.1, 0.2, 0.7],
    [0.1, 0.1, 0.8],
    [0.1, 0, 0.9],
  ]

  //return newVotes
  // recreate distributions
  const newDistributions = []
  for (let i = 0; i < numVotes; i++) {
    const distribution = {}
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
  return [newDistributions, newVotes]
}

export function RetroactiveRewards({
  projects,
  //distributionTableContract,
  distributions: currentDistributions,
}: RetroactiveRewardsProps) {
  const [distributions, setDistributions] = useState<{ [key: string]: number }>(
    {}
  )
  console.log('projects')
  console.log(projects)
  console.log('current')
  console.log(currentDistributions)
  const [year, setYear] = useState(new Date().getFullYear())
  const [quarter, setQuarter] = useState(
    Math.floor((new Date().getMonth() + 3) / 3)
  )
  const TEST_NANCE_SPACE_NAME = 'moondao.eth'
  const cycle = 'All'
  const keyword = ''
  const limit = 10
  const {
    data: proposalDataArray,
    isLoading: proposalsLoading,
    size,
    setSize,
  } = useProposalsInfinite(
    { space: TEST_NANCE_SPACE_NAME, cycle, keyword, limit },
    true
  )
  console.log('proposalDataArray')
  console.log(proposalDataArray)

  const groupedDistributions = {}
  const projectIdToEstimatedAllocation = {}
  const votingPower = {}
  // TODO don't spoof to pablos address
  //const userAddress = useAddress()
  const userAddress = '0x679d87D8640e66778c3419D164998E720D7495f6'

  const addresses = []
  const TEST_SNAPSHOT_SPACE_NAME = 'moondao.eth'

  // TODO set to selected chain
  const citizenDisitributions = []
  const nonCitizenDistributions = []
  for (const d of currentDistributions) {
    const isCitizen = useCitizen(Sepolia, '', d.address)
    if (isCitizen) {
      citizenDisitributions.push(d)
    } else {
      nonCitizenDistributions.push(d)
    }
  }
  const [filledInCitizenDistributions, votes] = fillIn(
    citizenDisitributions,
    projects
  )
  for (const d of nonCitizenDistributions) {
    //nonCitizenDistributions.distribution
    const desiredDistribution = []
    const dist = d.distribution
    for (const [projectIndex, project] of projects.entries()) {
      const projectId = project.id
      desiredDistribution.push(dist[projectId])
    }
    const actualDistribution = minimizeL1Distance(desiredDistribution, votes)
    for (const [projectIndex, project] of projects.entries()) {
      const projectId = project.id
      d.distribution[projectId] = actualDistribution[projectIndex]
    }
  }
  const allDistributions = [
    ...filledInCitizenDistributions,
    ...nonCitizenDistributions,
  ]

  if (currentDistributions) {
    //const filledInDistributions =
    //const fill = fillIn(currentDistributions, projects)
    //const filledInDistributions = currentDistributions
    for (const d of allDistributions) {
      const { address, year, quarter, distribution: dist } = d
      //groupedDistributions['address'].push(address)
      addresses.push(address)
      const { data: _vp } = useVotingPower(
        // TODO use real address
        //address,
        '0x679d87D8640e66778c3419D164998E720D7495f6',
        TEST_SNAPSHOT_SPACE_NAME,
        //'moondao.eth',
        //proposal?.id || ''
        //'https://testnet.snapshot.org/#/moondao.eth/proposal/0x0581832b2bc87afb9d23b8bb0a2454d21be75bd33ef92d757cbc67ea45ac685e'
        '0x0581832b2bc87afb9d23b8bb0a2454d21be75bd33ef92d757cbc67ea45ac685e'
      )
      console.log('_vp')
      console.log(_vp)
      if (_vp) {
        votingPower[address] = _vp.vp
      }
      for (const [key, value] of Object.entries(dist)) {
        if (!groupedDistributions[key]) {
          groupedDistributions[key] = []
        }
        groupedDistributions[key].push(value)
      }
    }
    const votingPowerSum = _.sum(Object.values(votingPower))
    for (const [projectId, percentages] of Object.entries(
      groupedDistributions
    )) {
      const sumProduct = _.sum(
        percentages.map((p, i) => p * votingPower[addresses[i]])
      )
      const sumProductPercentage = sumProduct / votingPowerSum
      projectIdToEstimatedAllocation[projectId] = sumProductPercentage
    }
    // normalize projectIdToEstimatedAllocation
    const sum = _.sum(Object.values(projectIdToEstimatedAllocation))
    for (const [projectId, percentage] of Object.entries(
      projectIdToEstimatedAllocation
    )) {
      projectIdToEstimatedAllocation[projectId] = (percentage / sum) * 100
    }
  }

  // TODO dynamically set chain
  const chain = Sepolia
  const { contract: distributionTableContract } = useContract(
    DISTRIBUTION_TABLE_ADDRESSES[chain.slug]
  )

  const handleDistributionChange = (projectId: string, value: number) => {
    setDistributions((prev) => ({
      ...prev,
      [projectId]: Math.min(100, Math.max(1, value)),
    }))
  }

  const handleSubmit = async () => {
    const totalPercentage = Object.values(distributions).reduce(
      (sum, value) => sum + value,
      0
    )
    if (totalPercentage !== 100) {
      alert('Total distribution must equal 100%')
      return
    }
    for (const project of projects) {
      if (
        !(project.id in distributions) &&
        !(
          // TODO change to contributors
          (
            userAddress in project.allocation ||
            userAddress.toLowerCase() in project.allocation
          )
        )
      ) {
        distributions[project.id] = 0
      }
    }

    try {
      //const sdk = initSDK(chain)

      //const distributionTableContract = await sdk.getContract(
      //DISTRIBUTION_TABLE_ADDRESSES[chain.slug]
      //)
      await distributionTableContract.call('insertIntoTable', [
        quarter,
        year,
        JSON.stringify(distributions),
      ])
      alert('Distribution submitted successfully!')
    } catch (error) {
      console.error('Error submitting distribution:', error)
      alert('Error submitting distribution. Please try again.')
    }
  }
  const idToTitle = projects.reduce((acc, project) => {
    acc[project.id] = project.title
    return acc
  }, {})

  const { tokens } = useAssets()
  console.log('tokens')
  console.log(tokens)
  let ethBudget = 0
  let mooneyBudget = 0
  if (tokens && tokens[0]) {
    ethBudget = tokens[0].balance * 0.05
    mooneyBudget = 15_000_000 * 0.95 ** numQuartersPastQ4Y2022
  }

  const VMOONEY_ROUND_TO = 10_000
  const numQuartersPastQ4Y2022 = (year - 2022) * 4 + quarter - 1

  const addressToPercentagePayout = {}
  for (const project of projects) {
    const projectId = project.id
    const allocation = projectIdToEstimatedAllocation[projectId]
    // TODO change to contributors
    const contributors = project.allocation
    for (const [contributerAddress, proportion] of contributors.entries()) {
      if (contributerAddress in addressToPercentagePayout) {
        addressToPercentagePayout[contributerAddress] += proportion * allocation
      } else {
        addressToPercentagePayout[contributerAddress] = proportion * allocation
      }
    }
  }
  const addressToEthPayout = {}
  const addressToMooneyPayout = {}
  for (const [address, percentage] of Object.entries(
    addressToPercentagePayout
  )) {
    addressToEthPayout[address] = (percentage / 100) * ethBudget
    addressToMooneyPayout[address] = (percentage / 100) * mooneyBudget
  }
  const ethPayoutCSV = Object.entries(addressToEthPayout)
    .map(([address, eth]) => `${address},${eth}`)
    .join('\n')
  const mooneyPayoutCSV = Object.entries(addressToMooneyPayout)
    .map(([address, mooney]) => `${address},${mooney}`)
    .join('\n')

  return (
    <section id="projects-container" className="overflow-hidden">
      <Head title="Projects" image="" />
      <Container>
        <ContentLayout
          header="Projects"
          headerSize="max(20px, 3vw)"
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="pb-32 w-full flex flex-col gap-4">
            <div className="mb-4">
              <label className="mr-2">Year: {year}</label>
              <label className="ml-4 mr-2">Quarter: {quarter}</label>
            </div>
            {projects &&
              projects.map((project, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div>{project.title}</div>
                  <input
                    type="number"
                    value={distributions[project.id] || ''}
                    onChange={(e) =>
                      handleDistributionChange(
                        project.id,
                        parseInt(e.target.value)
                      )
                    }
                    className="border rounded px-2 py-1 w-20"
                    min="1"
                    max="100"
                    disabled={
                      // TODO change to contributors
                      userAddress in project.allocation ||
                      userAddress.toLowerCase() in project.allocation
                    }
                  />
                </div>
              ))}
            <button
              onClick={handleSubmit}
              className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Submit Distribution
            </button>
            <div> Current Estimated Distributions </div>
            {Object.entries(groupedDistributions).map(
              ([projectId, percentages], i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>{idToTitle[projectId]}</div>
                  <div>{projectIdToEstimatedAllocation[projectId]}%</div>
                  {tokens && tokens[0] && (
                    <div>
                      {Math.round(
                        ethBudget * projectIdToEstimatedAllocation[projectId]
                      ) / 100}{' '}
                      ETH
                    </div>
                  )}
                  <div>
                    {(
                      Math.round(
                        (mooneyBudget *
                          projectIdToEstimatedAllocation[projectId]) /
                          100 /
                          VMOONEY_ROUND_TO
                      ) * VMOONEY_ROUND_TO
                    ).toLocaleString()}{' '}
                    MOONEY
                  </div>
                </div>
              )
            )}
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}
