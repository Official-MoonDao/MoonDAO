import { Arbitrum, Sepolia, ArbitrumSepolia } from '@thirdweb-dev/chains'
import { useAddress, useContract } from '@thirdweb-dev/react'
import { DISTRIBUTION_TABLE_ADDRESSES } from 'const/config'
import _ from 'lodash'
import { useState, useEffect } from 'react'
import { useCitizens } from '@/lib/citizen/useCitizen'
import { useAssets } from '@/lib/dashboard/hooks'
import { SNAPSHOT_SPACE_NAME } from '@/lib/nance/constants'
import { useVotingPowers } from '@/lib/snapshot'
import { iterativeNormalization, minimizeL1Distance } from '@/lib/utils/voting'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import StandardButton from '../layout/StandardButton'

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
  distributions,
  refreshRewards,
}: RetroactiveRewardsProps) {
  const [distribution, setDistribution] = useState<{ [key: string]: number }>(
    {}
  )
  const chain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : ArbitrumSepolia

  const year = new Date().getFullYear()
  const [edit, setEdit] = useState(false)
  const userAddress = useAddress()
  // TODO use current quarter
  const quarter = Math.floor((new Date().getMonth() + 3) / 3) - 2
  // Check if the user already has a distribution for the current quarter
  useEffect(() => {
    if (distributions && userAddress) {
      for (const d of distributions) {
        if (
          d.year === year &&
          d.quarter === quarter &&
          d.address.toLowerCase() === userAddress.toLowerCase()
        ) {
          setDistribution(d.distribution)
          setEdit(true)
          break
        }
      }
    }
  }, [userAddress, distributions])

  const projectIdToListOfPercentage: { [key: string]: number[] } = {}
  const projectIdToEstimatedPercentage: { [key: string]: number } = {}

  const addresses = distributions ? distributions.map((d) => d.address) : []
  const isCitizens = useCitizens(chain, addresses)
  const citizenDistributions = distributions?.filter((_, i) => isCitizens[i])
  const nonCitizenDistributions = distributions?.filter(
    (_, i) => !isCitizens[i]
  )

  const SNAPSHOT_SPACE_NAME = 'tomoondao.eth'
  const SNAPSHOT_ID =
    '0xa38f7cfeb73b166aea0b65432230bc19faf5411e7f86cc8ea3b961d7c72c85ed'
  const { data: _vps } = useVotingPowers(
    addresses,
    SNAPSHOT_SPACE_NAME,
    SNAPSHOT_ID
  )
  const votingPowers = _vps ? _vps.map((vp) => (vp ? vp.vp : 0)) : []
  const addressToQuadraticVotingPower = Object.fromEntries(
    addresses.map((address, i) => [address, Math.sqrt(votingPowers[i])])
  )
  const userHasVotingPower =
    userAddress &&
    userAddress in addressToQuadraticVotingPower &&
    addressToQuadraticVotingPower[userAddress] > 0

  // All projects need at least one citizen distribution to do iterative normalization
  const allProjectsHaveCitizenDistribution = projects.every(({ id }) =>
    citizenDistributions.some(({ distribution }) => id in distribution)
  )
  let votingPowerSumIsNonZero = false

  if (allProjectsHaveCitizenDistribution) {
    const [filledInCitizenDistributions, votes] = iterativeNormalization(
      citizenDistributions,
      projects
    )
    const bestFitNonCitizenDistributions = []
    for (const d of nonCitizenDistributions) {
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
      bestFitNonCitizenDistributions.push(newDistribution)
    }
    const allDistributions: Distribution[] = [
      ...filledInCitizenDistributions,
      ...bestFitNonCitizenDistributions,
    ]

    if (distributions) {
      const allAddresses = allDistributions.map((d) => d.address)
      for (const d of allDistributions) {
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
        votingPowerSumIsNonZero = true
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
          projectIdToEstimatedPercentage[projectId] = (percentage / sum) * 100
        }
      }
    }
  }

  const { contract: distributionTableContract } = useContract(
    DISTRIBUTION_TABLE_ADDRESSES[chain.slug]
  )

  const handleDistributionChange = (projectId: string, value: number) => {
    setDistribution((prev) => ({
      ...prev,
      [projectId]: Math.min(100, Math.max(1, value)),
    }))
  }

  const handleSubmit = async () => {
    const totalPercentage = Object.values(distribution).reduce(
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
        !(project.id in distribution) &&
        !(
          !userAddress ||
          userAddress in project.contributors ||
          userAddress.toLowerCase() in project.contributors
        )
      ) {
        distribution[project.id] = 0
      }
    }

    try {
      if (edit) {
        await distributionTableContract?.call('updateTableCol', [
          quarter,
          year,
          JSON.stringify(distribution),
        ])
        alert('Distribution edited successfully!')
        setTimeout(() => {
          refreshRewards()
        }, 5000)
      } else {
        await distributionTableContract?.call('insertIntoTable', [
          quarter,
          year,
          JSON.stringify(distribution),
        ])
        alert('Distribution submitted successfully!')
        setTimeout(() => {
          refreshRewards()
        }, 5000)
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
      setTimeout(() => {
        refreshRewards()
      }, 5000)
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
  console.log('ethPayoutCSV')
  console.log(ethPayoutCSV)
  console.log('mooneyPayoutCSV')
  console.log(mooneyPayoutCSV)

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
          <div className="pb-8 w-full flex flex-col gap-4">
            <div className="mb-4">
              <label className="mr-2">
                Q{quarter} {year}
              </label>
              {userAddress && (
                <label className="ml-4 mr-2">
                  Voting Power:{' '}
                  {addressToQuadraticVotingPower[userAddress] ** 2 || 0}
                </label>
              )}
              <label className="ml-4 mr-2">
                Total Rewards: {ethBudget.toFixed(1)} ETH
                &nbsp;&nbsp;&nbsp;&nbsp;
                {Number(mooneyBudget.toPrecision(3)).toLocaleString()} MOONEY
              </label>
              {userAddress && (
                <label className="ml-4 mr-2">
                  Your Estimated Reward: {addressToEthPayout[userAddress] || 0}{' '}
                  ETH &nbsp;&nbsp;&nbsp;&nbsp;
                  {addressToMooneyPayout[userAddress] || 0} MOONEY
                </label>
              )}
            </div>
          </div>
          <div className="pb-32 w-full flex flex-col gap-4">
            <div>
              {projects &&
                projects.map((project, i: number) => (
                  <div key={i} className="flex items-center w-full">
                    <div className="w-24">
                      <input
                        type="number"
                        value={distribution[project.id] || ''}
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
                          !userHasVotingPower ||
                          !userAddress ||
                          userAddress in project.contributors ||
                          userAddress.toLowerCase() in project.contributors
                        }
                      />
                    </div>
                    &nbsp;&nbsp;&nbsp;&nbsp;
                    <div className="flex-1 px-4">
                      <a
                        href={project.finalReportLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mr-2"
                      >
                        <u>{project.title}</u>
                      </a>
                    </div>
                    {allProjectsHaveCitizenDistribution &&
                      votingPowerSumIsNonZero &&
                      tokens &&
                      tokens[0] && (
                        <>
                          <div className="w-16 text-right px-4">
                            {projectIdToEstimatedPercentage[project.id].toFixed(
                              1
                            )}
                            %
                          </div>
                          <div className="px-4">
                            {projectIdToETHPayout[project.id].toFixed(1)} ETH
                          </div>
                          <div className="w-48 px-4">
                            {Number(
                              projectIdToMooneyPayout[project.id].toPrecision(3)
                            ).toLocaleString()}{' '}
                            MOONEY
                          </div>
                        </>
                      )}
                  </div>
                ))}
            </div>
            {projects && userHasVotingPower ? (
              <span>
                <StandardButton
                  onClick={handleSubmit}
                  className="gradient-2 rounded-full"
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
            ) : (
              <span>
                <StandardButton
                  link="/lock"
                  className="gradient-2 rounded-full"
                >
                  Get Voting Power
                </StandardButton>
              </span>
            )}
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}
