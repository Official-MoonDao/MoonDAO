import { Ethereum, Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import { useAddress, useContract } from '@thirdweb-dev/react'
import HatsABI from 'const/abis/Hats.json'
import ProjectABI from 'const/abis/Project.json'
import {
  DISTRIBUTION_TABLE_ADDRESSES,
  HATS_ADDRESS,
  PROJECT_ADDRESSES,
  SNAPSHOT_RETROACTIVE_REWARDS_ID,
} from 'const/config'
import _ from 'lodash'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useCitizens } from '@/lib/citizen/useCitizen'
import { assetImageExtension } from '@/lib/dashboard/dashboard-utils.ts/asset-config'
import { useAssets } from '@/lib/dashboard/hooks'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { SNAPSHOT_SPACE_NAME } from '@/lib/nance/constants'
import { Project } from '@/lib/project/useProjectData'
import { useVotingPowers } from '@/lib/snapshot'
import useTotalVP from '@/lib/tokens/hooks/useTotalVP'
import { useUniswapTokens } from '@/lib/uniswap/hooks/useUniswapTokens'
import { pregenSwapRoute } from '@/lib/uniswap/pregenSwapRoute'
import { getRelativeQuarter } from '@/lib/utils/dates'
import { getBudget, getPayouts } from '@/lib/utils/rewards'
import { computeRewardPercentages } from '@/lib/utils/voting'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SectionCard from '@/components/layout/SectionCard'
import StandardButtonRight from '@/components/layout/StandardButtonRight'
import ProjectCard from '@/components/project/ProjectCard'

export type Distribution = {
  year: number
  quarter: number
  address: string
  distribution: { [key: string]: number }
}

export type RewardAssetProps = {
  name: string
  value: string | number
  usdValue: string | number
  approximateUSD?: boolean
}

export type RetroactiveRewardsProps = {
  projects: Project[] | undefined
  distributions: Distribution[]
  refreshRewards: () => void
}

function RewardAsset({
  name,
  value,
  usdValue,
  approximateUSD,
}: RewardAssetProps) {
  const image = assetImageExtension[name]
    ? `/coins/${name}.${assetImageExtension[name]}`
    : '/coins/DEFAULT.png'
  const usd = Number(usdValue)

  return (
    <div className="flex gap-2 items-center">
      <Image
        className="scale-[0.65]"
        src={image}
        alt={name}
        width={name === 'ETH' ? 42 : 50}
        height={name === 'ETH' ? 42 : 50}
      />
      <div className="flex flex-col min-h-[60px]">
        <div className="flex gap-2 font-GoodTimes text-xl">
          <p>{name}</p>
          <p>{value}</p>
        </div>
        {usd > 0 && (
          <p className="opacity-60">{`(${
            approximateUSD ? '~' : ''
          }$${usd.toLocaleString()})`}</p>
        )}
      </div>
    </div>
  )
}

export function RetroactiveRewards({
  projects,
  distributions,
  refreshRewards,
}: RetroactiveRewardsProps) {
  const router = useRouter()

  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia

  const userAddress = useAddress()

  const { quarter, year } = getRelativeQuarter(-1)

  const [edit, setEdit] = useState(false)
  const [distribution, setDistribution] = useState<{ [key: string]: number }>(
    {}
  )

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
  }, [userAddress, distributions, quarter, year])
  const handleDistributionChange = (projectId: string, value: number) => {
    setDistribution((prev) => ({
      ...prev,
      [projectId]: Math.min(100, Math.max(1, value)),
    }))
  }

  //Contracts
  const { contract: projectContract } = useContract(
    PROJECT_ADDRESSES[chain.slug],
    ProjectABI
  )
  const { contract: hatsContract } = useContract(HATS_ADDRESS, HatsABI)

  const addresses = distributions ? distributions.map((d) => d.address) : []

  const { data: _vps } = useVotingPowers(
    addresses,
    SNAPSHOT_SPACE_NAME,
    SNAPSHOT_RETROACTIVE_REWARDS_ID
  )
  const votingPowers = _vps ? _vps.map((vp) => (vp ? vp.vp : 0)) : []
  const addressToQuadraticVotingPower = Object.fromEntries(
    addresses.map((address, i) => [address, Math.sqrt(votingPowers[i])])
  )
  const votingPowerSumIsNonZero =
    _.sum(Object.values(addressToQuadraticVotingPower)) > 0
  const userVotingPower = useTotalVP(userAddress || '')
  const userHasVotingPower = useMemo(() => {
    return userAddress && userVotingPower > 0
  }, [userVotingPower, userAddress])

  // All projects need at least one citizen distribution to do iterative normalization
  const isCitizens = useCitizens(chain, addresses)
  const citizenDistributions = distributions?.filter((_, i) => isCitizens[i])
  const nonCitizenDistributions = distributions?.filter(
    (_, i) => !isCitizens[i]
  )
  const allProjectsHaveCitizenDistribution = projects?.every(({ id }) =>
    citizenDistributions.some(({ distribution }) => id in distribution)
  )
  const readyToRunVoting = true

  const projectIdToEstimatedPercentage: { [key: string]: number } =
    readyToRunVoting
      ? computeRewardPercentages(
          citizenDistributions,
          nonCitizenDistributions,
          projects,
          addressToQuadraticVotingPower
        )
      : {}

  const { contract: distributionTableContract } = useContract(
    DISTRIBUTION_TABLE_ADDRESSES[chain.slug]
  )
  const { tokens } = useAssets()
  const { ethBudget, usdBudget, mooneyBudget, ethPrice } = getBudget(
    tokens,
    year,
    quarter
  )
  const [mooneyBudgetUSD, setMooneyBudgetUSD] = useState(0)
  const { MOONEY, DAI } = useUniswapTokens(Ethereum)

  useEffect(() => {
    async function getMooneyBudgetUSD() {
      const route = await pregenSwapRoute(Ethereum, mooneyBudget, MOONEY, DAI)

      const usd = route?.route[0].rawQuote.toString() / 1e18
      setMooneyBudgetUSD(usd)
    }

    if (mooneyBudget) {
      getMooneyBudgetUSD()
    }
  }, [mooneyBudget, DAI, MOONEY])

  const {
    projectIdToETHPayout,
    projectIdToMooneyPayout,
    addressToEthPayout,
    addressToMooneyPayout,
    ethPayoutCSV,
    mooneyPayoutCSV,
  } = getPayouts(
    projectIdToEstimatedPercentage,
    projects,
    ethBudget,
    mooneyBudget
  )

  const handleSubmit = async () => {
    const totalPercentage = Object.values(distribution).reduce(
      (sum, value) => sum + value,
      0
    )
    if (totalPercentage !== 100) {
      toast.error('Total distribution must equal 100%', {
        style: toastStyle,
      })
      return
    }
    try {
      if (edit) {
        await distributionTableContract?.call('updateTableCol', [
          quarter,
          year,
          JSON.stringify(distribution),
        ])
        toast.success('Distribution edited successfully!', {
          style: toastStyle,
        })
        setTimeout(() => {
          refreshRewards()
        }, 5000)
      } else {
        await distributionTableContract?.call('insertIntoTable', [
          quarter,
          year,
          JSON.stringify(distribution),
        ])
        toast.success('Distribution submitted successfully!', {
          style: toastStyle,
        })
        setTimeout(() => {
          refreshRewards()
        }, 5000)
      }
    } catch (error) {
      console.error('Error submitting distribution:', error)
      toast.error('Error submitting distribution. Please try again.', {
        style: toastStyle,
      })
    }
  }
  const handleDelete = async () => {
    try {
      await distributionTableContract?.call('deleteFromTable', [quarter, year])
      toast.success('Distribution deleted successfully!', {
        style: toastStyle,
      })
      setTimeout(() => {
        refreshRewards()
      }, 5000)
    } catch (error) {
      console.error('Error deleting distribution:', error)
      toast.error('Error deleting distribution. Please try again.', {
        style: toastStyle,
      })
    }
  }

  return (
    <section id="rewards-container" className="overflow-hidden">
      <Head
        title="Rewards"
        description="Distribute rewards to contributors based on their contributions."
      />
      <Container>
        <ContentLayout
          header={'Project Rewards'}
          description="Distribute rewards to contributors based on their contributions."
          headerSize="max(20px, 3vw)"
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <SectionCard>
            <h1 className="font-GoodTimes opacity-60">{`Q${quarter}: ${year} Rewards`}</h1>
            <div
              id="rewards-asset-container"
              className="mt-4 flex flex-col justify-center gap-2"
            >
              <RewardAsset
                name="ETH"
                value={ethBudget.toFixed(1)}
                usdValue={usdBudget.toFixed(2)}
              />
              <div className="flex flex-col md:flex-row md:items-center justify-between">
                <RewardAsset
                  name="MOONEY"
                  value={Number(mooneyBudget.toPrecision(3)).toLocaleString()}
                  usdValue={mooneyBudgetUSD.toFixed(2)}
                  approximateUSD
                />

                <StandardButtonRight
                  className="mt-4 md:mt-0 gradient-2 rounded-full"
                  onClick={() => router.push('/submit')}
                  styleOnly
                >
                  <div className="flex items-center gap-2">
                    <Image
                      src={'/assets/plus-icon.png'}
                      width={20}
                      height={20}
                      alt="Create Project"
                    />
                    {'Create Project'}
                  </div>
                </StandardButtonRight>
              </div>
            </div>

            <div id="projects-container" className="mt-8">
              <h1 className="font-GoodTimes opacity-60 text-2xl">
                Active Projects
              </h1>

              <div className="mt-12 flex flex-col gap-4">
                {projects && projects?.length > 0 ? (
                  projects.map((project: any, i) => (
                    <div key={`project-card-${i}`}>
                      <ProjectCard
                        key={`project-card-${i}`}
                        project={project}
                        projectContract={projectContract}
                        hatsContract={hatsContract}
                        distribute
                        distribution={
                          userHasVotingPower ? distribution : undefined
                        }
                        handleDistributionChange={
                          userHasVotingPower
                            ? handleDistributionChange
                            : undefined
                        }
                      />
                      {/* TODO */}
                      {/* {readyToRunVoting && tokens && tokens[0] && (
                        <>
                          <div className="w-16 text-right px-4">
                            {projectIdToEstimatedPercentage?.[
                              project.id
                            ]?.toFixed(2)}
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
                      )} */}
                    </div>
                  ))
                ) : (
                  <div>There are no active projects.</div>
                )}

                <div className="mt-4 w-full flex justify-end">
                  {projects && userHasVotingPower ? (
                    <span className="flex flex-col md:flex-row md:items-center gap-2">
                      <StandardButtonRight
                        onClick={handleSubmit}
                        className="gradient-2 rounded-full"
                      >
                        {edit ? 'Edit Distribution' : 'Submit Distribution'}
                      </StandardButtonRight>
                      {edit && (
                        <StandardButtonRight
                          onClick={handleDelete}
                          className="gradient-1 rounded-full"
                        >
                          Delete Distribution
                        </StandardButtonRight>
                      )}
                    </span>
                  ) : (
                    <span>
                      <StandardButtonRight
                        link="/lock"
                        className="gradient-2 rounded-full"
                      >
                        Get Voting Power
                      </StandardButtonRight>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>
        </ContentLayout>
      </Container>
    </section>
  )
}
