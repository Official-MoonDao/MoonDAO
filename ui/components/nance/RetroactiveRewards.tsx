import { PlusCircleIcon } from '@heroicons/react/24/outline'
import { Arbitrum, ArbitrumSepolia, Ethereum } from '@thirdweb-dev/chains'
import { useAddress, useContract } from '@thirdweb-dev/react'
import { nativeOnChain } from '@uniswap/smart-order-router'
import {
  DISTRIBUTION_TABLE_ADDRESSES,
  SNAPSHOT_RETROACTIVE_REWARDS_ID,
} from 'const/config'
import _ from 'lodash'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useCitizens } from '@/lib/citizen/useCitizen'
import { assetImageExtension } from '@/lib/dashboard/dashboard-utils.ts/asset-config'
import { useAssets } from '@/lib/dashboard/hooks'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { SNAPSHOT_SPACE_NAME } from '@/lib/nance/constants'
import { useVotingPowers } from '@/lib/snapshot'
import useWindowSize from '@/lib/team/use-window-size'
import { useUniswapTokens } from '@/lib/uniswap/hooks/useUniswapTokens'
import { pregenSwapRoute } from '@/lib/uniswap/pregenSwapRoute'
import { getBudget, getPayouts } from '@/lib/utils/rewards'
import { computeRewardPercentages } from '@/lib/utils/voting'
import Asset from '@/components/dashboard/treasury/balance/Asset'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SectionCard from '@/components/layout/SectionCard'
import StandardButton from '@/components/layout/StandardButton'

export type Project = {
  id: string
  title: string
  contributors: { [key: string]: number }
  finalReportLink: string
  MDP: number
}
export type Distribution = {
  year: number
  quarter: number
  address: string
  distribution: { [key: string]: number }
}

type RewardAssetProps = {
  name: string
  value: string
  usdValue: string
  approximateUSD?: boolean
}

export type RetroactiveRewardsProps = {
  projects: Project[]
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

  return (
    <div className="flex gap-2 items-center">
      <Image
        className="scale-[0.65]"
        src={image}
        alt={name}
        width={50}
        height={50}
      />
      <div className="flex flex-col min-h-[60px]">
        <div className="flex gap-2 font-GoodTimes text-xl">
          <p>{name}</p>
          <p>{value}</p>
        </div>
        {Number(usdValue) > 0 && (
          <p className="opacity-60">{`(${
            approximateUSD ? '~' : ''
          }${usdValue})`}</p>
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
  const chain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : ArbitrumSepolia
  const { isMobile } = useWindowSize()

  const userAddress = useAddress()
  const year = new Date().getFullYear()
  const quarter = Math.ceil((new Date().getMonth() + 1) / 3)

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
  }, [userAddress, distributions])
  const handleDistributionChange = (projectId: string, value: number) => {
    setDistribution((prev) => ({
      ...prev,
      [projectId]: Math.min(100, Math.max(1, value)),
    }))
  }

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
  const userHasVotingPower =
    userAddress &&
    userAddress in addressToQuadraticVotingPower &&
    addressToQuadraticVotingPower[userAddress] > 0

  // All projects need at least one citizen distribution to do iterative normalization
  const isCitizens = useCitizens(chain, addresses)
  const citizenDistributions = distributions?.filter((_, i) => isCitizens[i])
  const nonCitizenDistributions = distributions?.filter(
    (_, i) => !isCitizens[i]
  )
  const allProjectsHaveCitizenDistribution = projects.every(({ id }) =>
    citizenDistributions.some(({ distribution }) => id in distribution)
  )
  const readyToRunVoting =
    allProjectsHaveCitizenDistribution && votingPowerSumIsNonZero

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
  }, [mooneyBudget])

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
              className="mt-4 flex flex-col gap-2"
            >
              <RewardAsset
                name="ETH"
                value={ethBudget.toFixed(1)}
                usdValue={usdBudget.toFixed(2)}
              />
              <div className="flex items-center justify-between">
                <RewardAsset
                  name="MOONEY"
                  value={Number(mooneyBudget.toPrecision(3)).toLocaleString()}
                  usdValue={mooneyBudgetUSD.toFixed(2)}
                  approximateUSD
                />

                <StandardButton className="gradient-2 rounded-full">
                  <div className="flex items-center gap-2">
                    <Image
                      src={'/assets/plus-icon.png'}
                      width={20}
                      height={20}
                      alt="Create Project"
                    />
                    {'Create Project'}
                  </div>
                </StandardButton>
              </div>
            </div>

            <div id="projects-container" className="mt-8">
              <h1 className="font-GoodTimes opacity-60 text-xl">
                Active Projects
              </h1>

              <div className="flex flex-col gap-2">
                {projects.map((project, i) => (
                  <div
                    key={i}
                    className="flex items-center w-full py-1 text-[17px]"
                  >
                    <div className="w-24">{project.title}</div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
          <section
            className={`w-full flex ${
              isMobile ? 'flex-col items-center' : 'flex-row items-start'
            }`}
          >
            <section
              className={`mt-8 flex flex-col ${isMobile ? '' : 'w-1/3'}`}
            >
              <h3 className="title-text-colors text-2xl font-GoodTimes">
                Total Q{quarter} Rewards
              </h3>
              <Asset
                name="ETH"
                amount={String(ethBudget.toFixed(1))}
                usd={String(usdBudget.toFixed(2))}
              />
              <Asset
                name="MOONEY"
                amount={Number(mooneyBudget.toPrecision(3)).toLocaleString()}
                usd=""
              />
            </section>
            {userAddress && (
              <section
                className={`mt-8 flex flex-col px-4 ${isMobile ? '' : 'w-1/3'}`}
              >
                <h3 className="title-text-colors text-2xl font-GoodTimes">
                  Your Rewards
                </h3>
                <Asset
                  name="ETH"
                  amount={String(
                    addressToEthPayout[userAddress]?.toFixed(2) || 0
                  )}
                  usd={String(
                    userAddress in addressToEthPayout
                      ? (ethPrice * addressToEthPayout[userAddress]).toFixed(2)
                      : 0
                  )}
                />
                <Asset
                  name="MOONEY"
                  amount={String(
                    addressToMooneyPayout[userAddress]?.toFixed() || 0
                  )}
                  usd=""
                />
              </section>
            )}
            {userAddress && (
              <section
                className={`mt-8 flex flex-col px-4 ${isMobile ? '' : 'w-1/3'}`}
              >
                <h3 className="title-text-colors text-2xl font-GoodTimes">
                  Voting Power
                </h3>
                <Asset
                  name="MOONEY"
                  amount={String(
                    addressToQuadraticVotingPower[userAddress] ** 2 || 0
                  )}
                  usd=""
                />
              </section>
            )}
          </section>
          <div className="pb-32 w-full flex flex-col gap-4 py-2">
            <div className="flex justify-between items-center">
              <h3 className="title-text-colors text-2xl font-GoodTimes">
                Distribute
              </h3>
              {readyToRunVoting && (
                <h3 className="title-text-colors text-2xl font-GoodTimes">
                  Estimated Rewards
                </h3>
              )}
            </div>
            <div>
              {projects &&
                projects.map((project, i: number) => (
                  <div
                    key={i}
                    className="flex items-center w-full py-1 text-[17px]"
                  >
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
                          !userAddress ||
                          !userHasVotingPower ||
                          userAddress in project.contributors ||
                          userAddress.toLowerCase() in project.contributors
                        }
                      />
                      <span>%</span>
                    </div>
                    &nbsp;&nbsp;&nbsp;&nbsp;
                    <div className="flex-1 px-8">
                      <a
                        href={project.finalReportLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mr-2"
                      >
                        {project.MDP ? (
                          <u>MDP {project.MDP}:</u>
                        ) : (
                          <u>Project:</u>
                        )}
                      </a>
                      {project.title}
                    </div>
                    {readyToRunVoting && tokens && tokens[0] && (
                      <>
                        <div className="w-16 text-right px-4">
                          {projectIdToEstimatedPercentage[project.id].toFixed(
                            2
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
