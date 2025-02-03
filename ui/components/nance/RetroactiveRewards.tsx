import DistributionTableABI from 'const/abis/DistributionTable.json'
import HatsABI from 'const/abis/Hats.json'
import ProjectABI from 'const/abis/Project.json'
import {
  DEFAULT_CHAIN_V5,
  DISTRIBUTION_TABLE_ADDRESSES,
  HATS_ADDRESS,
  PROJECT_ADDRESSES,
  ARBITRUM_ASSETS_URL,
  POLYGON_ASSETS_URL,
  BASE_ASSETS_URL,
} from 'const/config'
import _ from 'lodash'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { ethereum } from 'thirdweb/chains'
import { useActiveAccount } from 'thirdweb/react'
import { useCitizens } from '@/lib/citizen/useCitizen'
import { assetImageExtension } from '@/lib/dashboard/dashboard-utils.ts/asset-config'
import { useAssets } from '@/lib/dashboard/hooks'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { Project } from '@/lib/project/useProjectData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTotalVP, useTotalVPs } from '@/lib/tokens/hooks/useTotalVP'
import { useUniswapTokens } from '@/lib/uniswap/hooks/useUniswapTokens'
import { pregenSwapRoute } from '@/lib/uniswap/pregenSwapRoute'
import { getRelativeQuarter, isRewardsCycle } from '@/lib/utils/dates'
import { getBudget, getPayouts } from '@/lib/utils/rewards'
import { computeRewardPercentages } from '@/lib/utils/voting'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SectionCard from '@/components/layout/SectionCard'
import StandardButtonRight from '@/components/layout/StandardButtonRight'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
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

  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const account = useActiveAccount()
  const userAddress = account?.address

  const [active, setActive] = useState(false)
  const { quarter, year } = getRelativeQuarter(active ? -1 : 0)

  const [edit, setEdit] = useState(false)
  const [distribution, setDistribution] = useState<{ [key: string]: number }>(
    {}
  )

  //Check if its the rewards cycle
  useEffect(() => {
    const interval = setInterval(() => {
      setActive(isRewardsCycle(new Date()))
    }, 30000)
    return () => clearInterval(interval)
  }, [projects, distributions])

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
    const newValue = Math.min(100, Math.max(1, +value))
    setDistribution((prev) => ({
      ...prev,
      [projectId]: newValue,
    }))
  }

  //Contracts
  const projectContract = useContract({
    address: PROJECT_ADDRESSES[chainSlug],
    chain: chain,
    abi: ProjectABI as any,
  })
  const distributionTableContract = useContract({
    address: DISTRIBUTION_TABLE_ADDRESSES[chainSlug],
    chain: chain,
    abi: DistributionTableABI as any,
  })
  const hatsContract = useContract({
    address: HATS_ADDRESS,
    chain: chain,
    abi: HatsABI as any,
  })

  const addresses = useMemo(() => {
    return distributions ? distributions.map((d) => d.address) : []
  }, [distributions])

  const { walletVPs: _vps } = useTotalVPs(addresses)
  const addressToQuadraticVotingPower = Object.fromEntries(
    addresses.map((address, index) => [address, _vps[index]])
  )
  const votingPowerSumIsNonZero =
    _.sum(Object.values(addressToQuadraticVotingPower)) > 0
  const userVotingPower = useTotalVP(userAddress || '')
  const userHasVotingPower = useMemo(() => {
    return userAddress && userVotingPower > 0
  }, [userVotingPower, userAddress])

  const isCitizenAddresses = useCitizens(chain, addresses)
  const citizenVotingAddresses = [
    '0x78176eaabcb3255e898079dc67428e15149cdc99', // payout for ryand2d.eth
    '0x9fdf876a50ea8f95017dcfc7709356887025b5bb', // payout for mitchmcquinn.eth
  ]
  const isCitizenVotingAddresses = addresses.map((address) =>
    citizenVotingAddresses.includes(address.toLowerCase())
  )
  const isCitizens = isCitizenAddresses.map(
    (isCitizen, i) => isCitizen || isCitizenVotingAddresses[i]
  )

  let citizenDistributions = distributions?.filter((_, i) => isCitizens[i])
  const nonCitizenDistributions = distributions?.filter(
    (_, i) => !isCitizens[i]
  )
  // All projects need at least one citizen distribution to do iterative normalization
  const allProjectsHaveCitizenDistribution = projects?.every(({ id }) =>
    citizenDistributions.some(({ distribution }) => id in distribution)
  )
  const allProjectsHaveRewardDistribution = projects?.every(
    (project) => project.rewardDistribution !== undefined
  )
  // Map from address to percentage of commnity rewards
  const communityCircle = {}
  const communityCirclePopulated = Object.keys(communityCircle).length > 0
  const readyToRunVoting =
    allProjectsHaveCitizenDistribution &&
    allProjectsHaveRewardDistribution &&
    communityCirclePopulated

  const projectIdToEstimatedPercentage: { [key: string]: number } =
    readyToRunVoting
      ? computeRewardPercentages(
          citizenDistributions,
          nonCitizenDistributions,
          projects,
          addressToQuadraticVotingPower
        )
      : {}

  const { tokens: mainnetTokens } = useAssets()
  const { tokens: arbitrumTokens } = useAssets(ARBITRUM_ASSETS_URL)
  const { tokens: polygonTokens } = useAssets(POLYGON_ASSETS_URL)
  const { tokens: baseTokens } = useAssets(BASE_ASSETS_URL)

  const tokens = mainnetTokens
    .concat(arbitrumTokens)
    .concat(polygonTokens)
    .concat(baseTokens)
  console.log(tokens)

  const { ethBudget, usdBudget, mooneyBudget, ethPrice } = getBudget(
    tokens,
    year,
    quarter
  )
  const [mooneyBudgetUSD, setMooneyBudgetUSD] = useState(0)
  const { MOONEY, DAI } = useUniswapTokens(ethereum)

  useEffect(() => {
    async function getMooneyBudgetUSD() {
      const route = await pregenSwapRoute(ethereum, mooneyBudget, MOONEY, DAI)

      const usd = route?.route[0].rawQuote.toString() / 1e18
      setMooneyBudgetUSD(usd)
    }

    if (mooneyBudget) {
      getMooneyBudgetUSD()
    }
  }, [mooneyBudget, DAI, MOONEY])

  const {
    addressToEthPayout,
    addressToMooneyPayout,
    ethPayoutCSV,
    vMooneyAddresses,
    vMooneyAmounts,
  } = getPayouts(
    projectIdToEstimatedPercentage,
    projects,
    communityCircle,
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
      if (!account) throw new Error('No account found')
      let receipt
      if (edit) {
        const transaction = prepareContractCall({
          contract: distributionTableContract,
          method: 'updateTableCol' as string,
          params: [quarter, year, JSON.stringify(distribution)],
        })
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      } else {
        const transaction = prepareContractCall({
          contract: distributionTableContract,
          method: 'insertIntoTable' as string,
          params: [quarter, year, JSON.stringify(distribution)],
        })
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      }
      if (receipt) setTimeout(() => router.push('/rewards/thank-you'), 5000)
    } catch (error) {
      console.error('Error submitting distribution:', error)
      toast.error('Error submitting distribution. Please try again.', {
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
          description={
            'Allocate retroactive rewards to completed projects and their contributors based on impact and results.'
          }
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
                value={ethBudget.toFixed(4)}
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
                        distribute={active}
                        distribution={
                          userHasVotingPower ? distribution : undefined
                        }
                        handleDistributionChange={
                          userHasVotingPower
                            ? handleDistributionChange
                            : undefined
                        }
                        userHasVotingPower={userHasVotingPower}
                      />
                    </div>
                  ))
                ) : (
                  <div>There are no active projects.</div>
                )}

                {active && (
                  <div className="mt-4 w-full flex justify-end">
                    {projects && userHasVotingPower ? (
                      <span className="flex flex-col md:flex-row md:items-center gap-2">
                        <PrivyWeb3Button
                          action={handleSubmit}
                          requiredChain={chain}
                          className="gradient-2 rounded-full"
                          label={
                            edit ? 'Edit Distribution' : 'Submit Distribution'
                          }
                        />
                      </span>
                    ) : (
                      <span>
                        <PrivyWeb3Button
                          v5
                          requiredChain={DEFAULT_CHAIN_V5}
                          label="Get Voting Power"
                          action={() => router.push('/lock')}
                          className="gradient-2 rounded-full"
                        />
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        </ContentLayout>
      </Container>
    </section>
  )
}
