import {
  PlusIcon,
  QueueListIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/solid'
import { NanceProvider } from '@nance/nance-hooks'
import { useProposalsInfinite } from '@nance/nance-hooks'
import { ProposalsPacket, getActionsFromBody } from '@nance/nance-sdk'
import { useChain } from '@thirdweb-dev/react'
import { useAddress, useContract } from '@thirdweb-dev/react'
import { DISTRIBUTION_TABLE_ADDRESSES, TABLELAND_ENDPOINT } from 'const/config'
//const solver = require('javascript-lp-solver');
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
import { iterativeNormalization, minimizeL1Distance } from '@/lib/utils/voting'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import ProposalList from '@/components/nance/ProposalList'
import StandardButton from '../layout/StandardButton'
import StandardButtonRight from '../layout/StandardButtonRight'

type ProjectType = {
  id: string
  title: string
  // ... other project properties
}

export type RetroactiveRewardsProps = {
  projects: ProjectType[]
  //distributionTableContract: any
  distributions: []
  refreshRewards: () => void
}

export function RetroactiveRewards({
  projects,
  //distributionTableContract,
  distributions: currentDistributions,
  refreshRewards,
}: RetroactiveRewardsProps) {
  const [distributions, setDistributions] = useState<{ [key: string]: number }>(
    {}
  )
  const chain = useChain()
  console.log('projects')
  console.log(projects)
  console.log('current')
  console.log(_.cloneDeep(currentDistributions))

  const testDistributions = [
    {
      // Pablo/R1
      address: '0x679d87D8640e66778c3419D164998E720D7495f6',
      distribution: {
        //'1': 0,
        '2': 50,
        '4': 30,
        '3': 20,
        '5': 0,
      },
      id: 1,
      quarter: 2,
      year: 2024,
    },
    {
      // Mitchie/R2
      address: '0x9fDf876a50EA8f95017dCFC7709356887025B5BB',
      distribution: {
        '1': 23,
        '2': 24,
        '4': 49,
        '5': 4,
      },
      id: 2,
      quarter: 2,
      year: 2024,
    },
    {
      //Phil/R3
      address: '0x6bFd9e435cF6194c967094959626ddFF4473a836',
      distribution: {
        '1': 31,
        '2': 12,
        '4': 42,
        '3': 10,
        '5': 5,
      },
      id: 3,
      quarter: 2,
      year: 2024,
    },
  ]
  //TODO remove
  //currentDistributions = testDistributions

  const [year, setYear] = useState(new Date().getFullYear())
  const [edit, setEdit] = useState(false)
  // TODO don't spoof to pablos address
  const userAddress = useAddress()
  // TODO use current quarter
  const [quarter, setQuarter] = useState(
    Math.floor((new Date().getMonth() + 3) / 3) - 2
  )
  // Check if the user already has a distribution for the current quarter
  useEffect(() => {
    if (currentDistributions && userAddress) {
      for (const d of currentDistributions) {
        if (
          d.year === year &&
          d.quarter === quarter &&
          d.address.toLowerCase() === userAddress.toLowerCase()
        ) {
          setDistributions(d.distribution)
          setEdit(true)
          break
        }
      }
    }
  }, [year, quarter, userAddress, currentDistributions])

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
  console.log('userAddress')
  console.log(userAddress)
  //const userAddress = '0x679d87D8640e66778c3419D164998E720D7495f6'

  const addresses = []
  //const TEST_SNAPSHOT_SPACE_NAME = 'moondao.eth'
  const SNAPSHOT_SPACE_NAME = 'tomoondao.eth'

  // TODO set to selected chain
  const citizenDistributions = []
  const nonCitizenDistributions = []
  for (const d of currentDistributions) {
    const isCitizen = useCitizen(chain, '', d.address)
    if (isCitizen) {
      citizenDistributions.push(d)
    } else {
      // TODO undo
      nonCitizenDistributions.push(d)
      //citizenDistributions.push(d)
    }
  }
  console.log('citizenDistributions')
  console.log(citizenDistributions)
  console.log('nonCitizenDistributions')
  console.log(nonCitizenDistributions)

  // All projects need at least one citizen distribution to do iterative normalization
  const doAllProjectsHaveCitizenDistribution = (
    projects,
    citizenDistributions
  ) => {
    const projectsWithVotes = new Set()
    for (const d of citizenDistributions) {
      for (const [projectId, percentage] of Object.entries(d.distribution)) {
        projectsWithVotes.add(projectId)
      }
    }
    console.log('projectsWithVotes')
    console.log(projectsWithVotes)
    for (const project of projects) {
      if (!projectsWithVotes.has(String(project.id))) {
        return false
      }
    }
    return true
  }
  const allProjectsHaveCitizenDistribution =
    doAllProjectsHaveCitizenDistribution(projects, citizenDistributions)
  console.log('allProjectsHaveCitizenDistribution')
  console.log(allProjectsHaveCitizenDistribution)
  let votingPowerSumIsNonZero = false

  if (allProjectsHaveCitizenDistribution) {
    const [filledInCitizenDistributions, votes] = iterativeNormalization(
      citizenDistributions,
      projects
    )
    console.log('filledInCitizenDistributions')
    console.log(filledInCitizenDistributions)
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
        // TODO uncomment and don't update the original object, instead make a copy
        //d.distribution[projectId] = _.cloneDeep(actualDistribution[projectIndex])
      }
    }
    const allDistributions = [
      ...filledInCitizenDistributions,
      ...nonCitizenDistributions,
    ]

    if (currentDistributions) {
      //const filledInDistributions =
      //const filledInDistributions = currentDistributions
      for (const d of allDistributions) {
        const { address, year, quarter, distribution: dist } = d
        //groupedDistributions['address'].push(address)
        addresses.push(address)
        const { data: _vp } = useVotingPower(
          // TODO use real address
          address,
          //'0x679d87D8640e66778c3419D164998E720D7495f6',
          SNAPSHOT_SPACE_NAME,
          //'moondao.eth',
          //proposal?.id || ''
          //'https://testnet.snapshot.org/#/moondao.eth/proposal/0x0581832b2bc87afb9d23b8bb0a2454d21be75bd33ef92d757cbc67ea45ac685e'
          //'0x0581832b2bc87afb9d23b8bb0a2454d21be75bd33ef92d757cbc67ea45ac685e'
          '0xa38f7cfeb73b166aea0b65432230bc19faf5411e7f86cc8ea3b961d7c72c85ed'
        )
        console.log('_vp')
        console.log(_vp)
        if (_vp && _vp.vp) {
          votingPower[address] = _vp.vp
        } else {
          console.log('no vp for address: ', address)
          continue
        }
        for (const [key, value] of Object.entries(dist)) {
          if (!groupedDistributions[key]) {
            groupedDistributions[key] = []
          }
          groupedDistributions[key].push(value)
        }
      }
      const votingPowerSum = _.sum(Object.values(votingPower))
      if (votingPowerSum > 0) {
        votingPowerSumIsNonZero = true
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
    }
  }

  // TODO dynamically set chain
  const { contract: distributionTableContract } = useContract(
    DISTRIBUTION_TABLE_ADDRESSES[chain.slug]
  )
  //const sdk = initSDK(chain)

  //const distributionTableContract = await sdk.getContract(
  //DISTRIBUTION_TABLE_ADDRESSES[chain.slug]
  //)
  console.log('distributionTableContract')
  console.log(distributionTableContract)

  const handleDistributionChange = (projectId: string, value: number) => {
    setDistributions((prev) => ({
      ...prev,
      [projectId]: Math.min(100, Math.max(1, value)),
    }))
  }

  const handleSubmit = async () => {
    // Validate percentage
    const totalPercentage = Object.values(distributions).reduce(
      (sum, value) => sum + value,
      0
    )
    if (totalPercentage !== 100) {
      alert('Total distribution must equal 100%')
      return
    }

    // Fill in empty values with 0
    // Missing values are assumed to be projects which the user is a contributor to
    // and will be filled in with iterative normalization
    for (const project of projects) {
      if (
        !(project.id in distributions) &&
        !(
          userAddress in project.contributors ||
          userAddress.toLowerCase() in project.contributors
        )
      ) {
        distributions[project.id] = 0
      }
    }

    try {
      if (edit) {
        await distributionTableContract.call('updateTableCol', [
          quarter,
          year,
          JSON.stringify(distributions),
        ])
        alert('Distribution edited successfully!')
        refreshRewards()
      } else {
        await distributionTableContract.call('insertIntoTable', [
          quarter,
          year,
          JSON.stringify(distributions),
        ])
        alert('Distribution submitted successfully!')
        refreshRewards()
      }
    } catch (error) {
      console.error('Error submitting distribution:', error)
      alert('Error submitting distribution. Please try again.')
    }
  }
  const handleDelete = async () => {
    try {
      await distributionTableContract.call('deleteFromTable', [quarter, year])
      alert('Distribution deleted successfully!')
      refreshRewards()
    } catch (error) {
      console.error('Error deleting distribution:', error)
      alert('Error deleting distribution. Please try again.')
    }
  }

  const idToTitle = projects.reduce((acc, project) => {
    acc[project.id] = project.title
    return acc
  }, {})

  const { tokens } = useAssets()
  console.log('tokens')
  console.log(tokens)
  const VMOONEY_ROUND_TO = 10_000
  const numQuartersPastQ4Y2022 = (year - 2022) * 4 + quarter - 1
  let ethBudget = 0
  let usdBudget = 0
  let mooneyBudget = 0
  if (tokens && tokens[0]) {
    for (const token of tokens) {
      if (token.symbol !== 'MOONEY') {
        usdBudget += token.usd
      }
    }
    const ethPrice = tokens[0].usd / tokens[0].balance
    const ethValue = usdBudget / ethPrice
    ethBudget = ethValue * 0.05
    mooneyBudget = 15_000_000 * 0.95 ** numQuartersPastQ4Y2022
  }

  const addressToPercentagePayout = {}
  for (const project of projects) {
    const projectId = project.id
    const allocation = projectIdToEstimatedAllocation[projectId]
    const contributors = project.contributors
    for (const [contributerAddress, proportion] of Object.entries(
      contributors
    )) {
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
                  <a href={project.finalReportLink} target="_blank">
                    {project.title}
                  </a>
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
                      !userAddress ||
                      userAddress in project.contributors ||
                      userAddress.toLowerCase() in project.contributors
                    }
                  />
                </div>
              ))}
            {projects && (
              <span>
                <StandardButton
                  onClick={handleSubmit}
                  className="gradient-2 rounded-full"
                  //className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  {edit ? 'Edit' : 'Submit'} Distribution
                </StandardButton>
                {edit && (
                  <StandardButton
                    onClick={handleDelete}
                    //className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                    className="gradient-1 rounded-full"
                  >
                    Delete Distribution
                  </StandardButton>
                )}
              </span>
            )}

            {allProjectsHaveCitizenDistribution && votingPowerSumIsNonZero && (
              <div> Current Estimated Distributions </div>
            )}
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
