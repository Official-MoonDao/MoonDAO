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
import {
  getBudget,
  getPayouts,
  computeRewardPercentages,
} from '@/lib/utils/rewards'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SectionCard from '@/components/layout/SectionCard'
import StandardButtonRight from '@/components/layout/StandardButtonRight'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import PastProjects from '@/components/project/PastProjects'
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
  currentProjects: Project[]
  pastProjects: Project[]
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
  currentProjects,
  pastProjects,
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
    setActive(isRewardsCycle(new Date()))
    const interval = setInterval(() => {
      setActive(isRewardsCycle(new Date()))
    }, 30000)
    return () => clearInterval(interval)
  }, [currentProjects, distributions])

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
  const allProjectsHaveCitizenDistribution = currentProjects?.every(({ id }) =>
    citizenDistributions.some(({ distribution }) => id in distribution)
  )
  const allProjectsHaveRewardDistribution = currentProjects?.every(
    (project) => project.rewardDistribution !== undefined
  )
  // Map from address to percentage of commnity rewards
  const communityCircle = {
    '0x08e424b69851b7b210ba3e5e4233ca6fcc1adedb': 10.51,
    '0x2eb09037de144d7bdf2af06130def727a239f8cd': 9.77,
    '0xf2befa4b9489c1ef75e069d16a6f829f71b4b988': 8.16,
    '0x06e9ee59f76cbaefd12715c7b95f89d4f0b0a67d': 7.54,
    '0x79d0b453dd5d694da4685fbb94798335d5f77760': 7.05,
    '0x36acd775b51ff1eca097f9a630ab9b98ceefb435': 6.92,
    '0xfef6b7199e69b9bcd3bebb28543e78e68b29696e': 6.8,
    '0x0bfc29af6c23cadd46149d0b94dffaf163aa0b1b': 6.06,
    '0x2d2f4f747e1a56da59cec9be3ac7c373e5701ba6': 5.81,
    '0x08ce673d72a6cd8c4673f0fb6cae7701434f5c8f': 5.56,
    '0xf85dbc31d0c7bd46eb9ec684a64d97e41ab04ce3': 5.19,
    '0x661030571ecf75938254577008ad859fc40007fa': 4.45,
    '0xa829cfd0a0ba3ef42561b9276147c25382aeb801': 3.46,
    '0x9a1741b58bd99ebbc4e9742bd081b887dfc95f53': 3.46,
    '0x8f8c0cc482a24124123ccb95600781fcefeb09f8': 3.34,
    '0xf17858889d5a7e9002ed2bf808c6cffafe8d6014': 3.09,
    '0x62af51d895f72cb8117a3a6099879b683a13919b': 2.84,
  }
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
          currentProjects,
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
    vMooneyPayoutCSV,
    vMooneyAddresses,
    vMooneyAmounts,
  } = getPayouts(
    projectIdToEstimatedPercentage,
    currentProjects,
    communityCircle,
    ethBudget,
    mooneyBudget
  )
  console.log('eth rewards')
  console.log(ethPayoutCSV)
  console.log('vmooney rewards')
  console.log(vMooneyPayoutCSV)

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
      if (receipt) setTimeout(() => router.push('/projects/thank-you'), 5000)
    } catch (error) {
      console.error('Error submitting distribution:', error)
      toast.error('Error submitting distribution. Please try again.', {
        style: toastStyle,
      })
    }
  }
  return (
    <section id="projects-container" className="overflow-hidden">
      <Head
        title="Projects"
        description="View active projects and allocate retroactive rewards to completed projects and their contributors based on impact and results.'"
      />
      <Container>
        <ContentLayout
          header={'Projects'}
          description={
            'View active projects and allocate retroactive rewards to completed projects and their contributors based on impact and results.'
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
                {currentProjects && currentProjects?.length > 0 ? (
                  currentProjects.map((project: any, i) => (
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
                    {currentProjects && userHasVotingPower ? (
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
            <PastProjects projects={pastProjects} />
          </SectionCard>
        </ContentLayout>
      </Container>
    </section>
  )
}
