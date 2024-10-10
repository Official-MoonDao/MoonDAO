import {
  PlusIcon,
  QueueListIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/solid'
import { NanceProvider } from '@nance/nance-hooks'
import { useProposalsInfinite } from '@nance/nance-hooks'
import { ProposalsPacket, getActionsFromBody } from '@nance/nance-sdk'
import { Arbitrum, Sepolia, ArbitrumSepolia } from '@thirdweb-dev/chains'
import { useAddress, useContract } from '@thirdweb-dev/react'
import { DISTRIBUTION_TABLE_ADDRESSES, TABLELAND_ENDPOINT } from 'const/config'
//const solver = require('javascript-lp-solver');
import _ from 'lodash'
import { StringParam, useQueryParams, withDefault } from 'next-query-params'
import { useState, useEffect } from 'react'
import { useDebounce } from 'react-use'
import { useCitizens } from '@/lib/citizen/useCitizen'
import { useAssets } from '@/lib/dashboard/hooks'
import { SNAPSHOT_SPACE_NAME } from '@/lib/nance/constants'
import { NANCE_API_URL } from '@/lib/nance/constants'
import {
  SnapshotGraphqlProposalVotingInfo,
  useVotingPowers,
} from '@/lib/snapshot'
import { iterativeNormalization, minimizeL1Distance } from '@/lib/utils/voting'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import ProposalList from '@/components/nance/ProposalList'
import StandardButton from '../layout/StandardButton'
import StandardButtonRight from '../layout/StandardButtonRight'

export type Project = {
  id: string
  title: string
  contributors: { [key: string]: number }
  finalReportLink: string
}
export type Distribution = {
  year: number
  quarter: number
  address: string
  distribution: { [key: string]: number }
}

export type RetroactiveRewardsProps = {
  projects: Project[]
  distributions: Distribution[]
  refreshRewards: () => void
}

export function RetroactiveRewards({
  projects,
  distributions: currentDistributions,
  refreshRewards,
}: RetroactiveRewardsProps) {
  const [distributions, setDistributions] = useState<{ [key: string]: number }>(
    {}
  )
  const chain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : ArbitrumSepolia

  const [year, setYear] = useState(new Date().getFullYear())
  const [edit, setEdit] = useState(false)
  const userAddress = useAddress()
  // TODO use current quarter
  const [quarter, setQuarter] = useState(
    Math.floor((new Date().getMonth() + 3) / 3) - 2
  )
  console.log('currentDistributions')
  console.log(currentDistributions)

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
  }, [userAddress, currentDistributions])

  const groupedDistributions: { [key: string]: number[] } = {}

  const projectIdToEstimatedAllocation: { [key: string]: number } = {}
  const SNAPSHOT_SPACE_NAME = 'tomoondao.eth'

  const citizenDistributions = []
  const nonCitizenDistributions = []

  const addresses = currentDistributions
    ? currentDistributions.map((d) => d.address)
    : []
  const isCitizens = useCitizens(chain, addresses)
  //const isCitizens = Array(addresses.length).fill(true)
  console.log('isCitizens')
  console.log(isCitizens)
  for (const [i, d] of currentDistributions.entries()) {
    const isCitizen = isCitizens[i]
    if (isCitizen) {
      citizenDistributions.push(d)
    } else {
      nonCitizenDistributions.push(d)
    }
  }
  const { data: _vps } = useVotingPowers(
    addresses,
    SNAPSHOT_SPACE_NAME,
    '0xa38f7cfeb73b166aea0b65432230bc19faf5411e7f86cc8ea3b961d7c72c85ed'
  )
  const votingPowers = _vps ? _vps.map((vp) => (vp ? vp.vp : 0)) : []
  const addressToVotingPower = Object.fromEntries(
    addresses.map((address, i) => [address, votingPowers[i]])
  )
  console.log('citizenDistributions')
  console.log(citizenDistributions)
  console.log('nonCitizenDistributions')
  console.log(nonCitizenDistributions)

  // All projects need at least one citizen distribution to do iterative normalization
  const doAllProjectsHaveCitizenDistribution = (
    projects: Project[],
    citizenDistributions: Distribution[]
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
    const allDistributions: Distribution[] = [
      ...filledInCitizenDistributions,
      ...nonCitizenDistributions,
    ]
    //const allAddresses = allDistributions.map((d) => d.address)
    // set undefined votingPower to 0
    //for (const [i, vp] of votingPowers.entries()) {
    //if (vp === undefined) {
    //votingPowers[i] = 0
    //}
    //}

    if (currentDistributions) {
      const allAddresses = allDistributions.map((d) => d.address)
      for (const d of allDistributions) {
        const { address, year, quarter, distribution: dist } = d
        for (const [key, value] of Object.entries(dist)) {
          if (!groupedDistributions[key]) {
            groupedDistributions[key] = []
          }
          groupedDistributions[key].push(value)
        }
      }
      const votingPowerSum = _.sum(Object.values(addressToVotingPower))
      console.log('votingPowerSum')
      console.log(votingPowerSum)
      if (votingPowerSum > 0) {
        votingPowerSumIsNonZero = true
        for (const [projectId, percentages] of Object.entries(
          groupedDistributions
        )) {
          const sumProduct = _.sum(
            percentages.map((p, i) => p * addressToVotingPower[allAddresses[i]])
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
          !userAddress ||
          userAddress in project.contributors ||
          userAddress.toLowerCase() in project.contributors
        )
      ) {
        distributions[project.id] = 0
      }
    }

    try {
      if (edit) {
        await distributionTableContract?.call('updateTableCol', [
          quarter,
          year,
          JSON.stringify(distributions),
        ])
        alert('Distribution edited successfully!')
        refreshRewards()
      } else {
        await distributionTableContract?.call('insertIntoTable', [
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
      await distributionTableContract?.call('deleteFromTable', [quarter, year])
      alert('Distribution deleted successfully!')
      refreshRewards()
    } catch (error) {
      console.error('Error deleting distribution:', error)
      alert('Error deleting distribution. Please try again.')
    }
  }

  const idToTitle: { [key: string]: string } = {}
  for (const project of projects) {
    idToTitle[project.id] = project.title
  }

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

  const addressToPercentagePayout: { [key: string]: number } = {}
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
  const addressToEthPayout: { [key: string]: number } = {}
  const addressToMooneyPayout: { [key: string]: number } = {}
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
                  <a
                    href={project.finalReportLink}
                    target="_blank"
                    rel="noreferrer"
                  >
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
                  {edit ? 'Edit Distribution' : 'Submit Distribution'}
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
            {allProjectsHaveCitizenDistribution &&
              votingPowerSumIsNonZero &&
              Object.entries(groupedDistributions).map(
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
