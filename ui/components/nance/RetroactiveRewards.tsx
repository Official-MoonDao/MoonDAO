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
import useStakedEth from 'lib/utils/hooks/useStakedEth'
import _ from 'lodash'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { useCitizens } from '@/lib/citizen/useCitizen'
import { assetImageExtension } from '@/lib/dashboard/dashboard-utils.ts/asset-config'
import { useAssets } from '@/lib/dashboard/hooks'
import { ethereum } from '@/lib/infura/infuraChains'
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

// Helper function to format large numbers for mobile display
function formatValueForDisplay(value: string | number): {
  full: string
  abbreviated: string
} {
  const numValue =
    typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value

  if (isNaN(numValue)) {
    return { full: value.toString(), abbreviated: value.toString() }
  }

  const full = numValue.toLocaleString()

  // Create abbreviated version for very large numbers
  if (numValue >= 1000000) {
    const millions = numValue / 1000000
    const abbreviated = `${millions.toFixed(2)}M`
    return { full, abbreviated }
  } else if (numValue >= 1000) {
    const thousands = numValue / 1000
    const abbreviated = `${thousands.toFixed(1)} K`
    return { full, abbreviated }
  }

  return { full, abbreviated: full }
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

  const formattedValue = formatValueForDisplay(value)

  return (
    <div className="flex gap-3 items-center">
      <Image
        className="scale-[0.55] filter drop-shadow-lg"
        src={image}
        alt={name}
        width={name === 'ETH' ? 42 : 50}
        height={name === 'ETH' ? 42 : 50}
      />
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex gap-2 font-GoodTimes text-lg text-white">
          <p className="text-white/80">{name}</p>
          {/* Show abbreviated on small screens, full on larger screens */}
          <p className="text-white font-bold whitespace-nowrap">
            <span className="sm:hidden">{formattedValue.abbreviated}</span>
            <span className="hidden sm:inline">{formattedValue.full}</span>
          </p>
        </div>
        {usd > 0 && (
          <p className="text-gray-400 text-xs">{`(${
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
  const eligibleProjects = useMemo(
    () => currentProjects.filter((p) => p.eligible),
    [currentProjects]
  )

  const ineligibleProjects = useMemo(
    () => currentProjects.filter((p) => !p.eligible),
    [currentProjects]
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
    const newValue = Math.min(100, Math.max(0, +value))
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

  //const walletVPs = useTotalVPs(addresses)
  //console.log('walletVPs', walletVPs)
  //const addressToQuadraticVotingPower = Object.fromEntries(
  //addresses.map((address, index) => [address, walletVPs[index]])
  //)
  const engibobVP = useTotalVP('0x4CBf10c36b481d6afF063070E35b4F42E7Aad201')

  const addressToQuadraticVotingPower = {
    '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': 1573.415382878253,
    '0x08e424b69851b7b210ba3e5e4233ca6fcc1adedb': 852.1725995593322,
    '0x223da87421786dd8960bf2350e6c499bebca64d1': 520.7629513123502,
    '0x37e6c43ae0341304ff181da55e8d2593f1728c45': 340.9273239413212,
    '0x59041d70deaefe849a48e77e0b273ddd072ea9e4': 532.7207641491732,
    '0x80581c6e88ce00095f85cdf24bb760f16d6ec0d6': 4262.3279519968555,
    '0x86c779b3741e83a36a2a236780d436e4ec673af4': 2311.3349875862436,
    '0x8f8c0cc482a24124123ccb95600781fcefeb09f8': 302.1739808348273,
    '0x9a1741b58bd99ebbc4e9742bd081b887dfc95f53': 915.4346417954712,
    '0x9fdf876a50ea8f95017dcfc7709356887025b5bb': 3663.127468362984,
    '0xa829cfd0a0ba3ef42561b9276147c25382aeb801': 395.0957678485315,
    '0xb2d3900807094d4fe47405871b0c8adb58e10d42': 6055.656492262018,
    '0xc9592be2224dd7a9ed8078ce18e3edc909d55085': 85.2539228491542,
    '0x4CBf10c36b481d6afF063070E35b4F42E7Aad201': 1101.3837892230695,
  }

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
  citizenDistributions.push({
    year,
    quarter,
    address: '0x4CBf10c36b481d6afF063070E35b4F42E7Aad201',
    distribution: { 9: 25, 16: 50, 77: 25 },
  })
  const nonCitizenDistributions = distributions?.filter(
    (_, i) => !isCitizens[i]
  )
  // All projects need at least one citizen distribution to do iterative normalization
  const allProjectsHaveCitizenDistribution = eligibleProjects?.every(({ id }) =>
    citizenDistributions.some(({ distribution }) => id in distribution)
  )
  const allProjectsHaveRewardDistribution = eligibleProjects?.every(
    (project) => project.rewardDistribution !== undefined
  )
  // Map from address to percentage of commnity rewards
  const communityCircle = {
    '0xa829cfd0a0ba3ef42561b9276147c25382aeb801': 4.44,
    '0x8f8c0cc482a24124123ccb95600781fcefeb09f8': 3.78,
    '0x08E424b69851b7b210bA3E5E4233Ca6fcc1ADEdb': 8.22,
    '0x9A1741b58Bd99EBbc4e9742Bd081b887DfC95f53': 2.89,
    '0x977e3f778d1aFce209Fa0D2299374b1875F5238A': 5.56,
    '0x8cd7f95b0c694dfc9abfee03139bd975a3e81768': 8.33,
    '0xb87b8c495d3dae468d4351621b69d2ec10e656fe': 7.56,
    '0x98d61675315d3ef156606bbeef7cabae96508cae': 8.78,
    '0x8a7fd7f4b1a77a606dfdd229c194b1f22de868ff': 8.22,
    '0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801': 9.89,
    '0x6bFd9e435cF6194c967094959626ddFF4473a836': 5.56,
    '0x4CBf10c36b481d6afF063070E35b4F42E7Aad201': 8.22,
    '0xA64f2228cceC96076c82abb903021C33859082F8': 3.56,
    '0x47cc4c7fef42187f9f7901838f316b033e92be05': 3.11,
    '0xf17858889d5a7e9002ed2bf808c6cffafe8d6014': 4,
    '0x79D0B453Dd5d694da4685Fbb94798335D5F77760': 4.56,
    '0x86c779b3741e83A36A2a236780d436E4EC673Af4': 3.33,
  }
  const communityCirclePopulated = Object.keys(communityCircle).length > 0
  const readyToRunVoting =
    allProjectsHaveCitizenDistribution &&
    allProjectsHaveRewardDistribution &&
    communityCirclePopulated
  console.log('citizenDistributions', citizenDistributions)

  const projectIdToEstimatedPercentage: { [key: string]: number } =
    readyToRunVoting
      ? computeRewardPercentages(
          citizenDistributions,
          nonCitizenDistributions,
          eligibleProjects,
          addressToQuadraticVotingPower
        )
      : {}

  const { tokens: mainnetTokens } = useAssets()
  const { tokens: arbitrumTokens } = useAssets(ARBITRUM_ASSETS_URL)
  const { tokens: polygonTokens } = useAssets(POLYGON_ASSETS_URL)
  const { tokens: baseTokens } = useAssets(BASE_ASSETS_URL)
  const { stakedEth, error } = useStakedEth()

  // Memoize the tokens array to prevent unnecessary re-renders
  const tokens = useMemo(() => {
    return mainnetTokens
      .concat(arbitrumTokens)
      .concat(polygonTokens)
      .concat(baseTokens)
      .concat([{ symbol: 'stETH', balance: stakedEth }])
  }, [mainnetTokens, arbitrumTokens, polygonTokens, baseTokens, stakedEth])

  const {
    ethBudget: ethBudgetCurrent,
    mooneyBudget,
    ethPrice,
  } = useMemo(() => getBudget(tokens, year, quarter), [tokens, year, quarter])

  const ethBudget = 15.4072
  const usdBudget = ethBudget * ethPrice
  const [mooneyBudgetUSD, setMooneyBudgetUSD] = useState(0)
  const { MOONEY, DAI } = useUniswapTokens(ethereum)

  const {
    addressToEthPayout,
    addressToMooneyPayout,
    ethPayoutCSV,
    vMooneyPayoutCSV,
    vMooneyAddresses,
    vMooneyAmounts,
  } = getPayouts(
    projectIdToEstimatedPercentage,
    eligibleProjects,
    communityCircle,
    ethBudget,
    mooneyBudget
  )
  console.log('projectIdToEstimatedPercentage', projectIdToEstimatedPercentage)
  console.log('ethPayoutCSV', ethPayoutCSV)
  console.log('vMooneyAddresses', vMooneyAddresses)
  console.log('vMooneyAmounts', vMooneyAmounts)

  useEffect(() => {
    let isCancelled = false

    async function getMooneyBudgetUSD() {
      try {
        // Skip if mooneyBudget is 0 or very small to avoid unnecessary calls
        if (!mooneyBudget || mooneyBudget < 0.01) {
          setMooneyBudgetUSD(0)
          return
        }

        const route = await pregenSwapRoute(ethereum, mooneyBudget, MOONEY, DAI)

        if (!isCancelled && route?.route[0]?.rawQuote) {
          const usd = route.route[0].rawQuote.toString() / 1e18
          setMooneyBudgetUSD(usd)
        }
      } catch (error) {
        console.error('Error fetching Mooney budget USD:', error)
        if (!isCancelled) {
          // Set a fallback value or keep the previous value
          setMooneyBudgetUSD(0)
        }
      }
    }

    if (mooneyBudget && MOONEY && DAI) {
      getMooneyBudgetUSD()
    }

    return () => {
      isCancelled = true
    }
  }, [mooneyBudget, DAI, MOONEY])

  const handleSubmit = async () => {
    const totalPercentage = Object.values(distribution).reduce(
      (sum, value) => sum + value,
      0
    )
    if (totalPercentage !== 100) {
      toast.error('Total distribution must equal 100%.', {
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
          <div className="flex flex-col gap-6 p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-[1200px]">
            {/* Condensed Top Section - Rewards + Create Button */}
            <div className="bg-black/20 rounded-xl p-4 border border-white/10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <h1 className="font-GoodTimes text-white/80 text-lg">{`Q${quarter}: ${year} Rewards`}</h1>
                <button
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl border-0 text-sm flex items-center justify-center gap-2 w-fit"
                  onClick={() => router.push('/submit')}
                >
                  <Image
                    src={'/assets/plus-icon.png'}
                    width={16}
                    height={16}
                    alt="Create Project"
                  />
                  <span className="leading-none">Create Project</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-lg p-3 border border-white/10">
                  <RewardAsset
                    name="ETH"
                    value={ethBudget.toFixed(4)}
                    usdValue={usdBudget.toFixed(2)}
                  />
                </div>
                <div className="bg-black/20 rounded-lg p-3 border border-white/10">
                  <RewardAsset
                    name="MOONEY"
                    value={Number(mooneyBudget.toPrecision(3)).toLocaleString()}
                    usdValue={mooneyBudgetUSD.toFixed(2)}
                    approximateUSD
                  />
                </div>
              </div>
            </div>

            <div
              id="projects-container"
              className="bg-black/20 rounded-xl p-6 border border-white/10"
            >
              <h1 className="font-GoodTimes text-white/80 text-xl mb-6">
                Eligible Projects
              </h1>

              <div className="flex flex-col gap-6">
                {eligibleProjects && eligibleProjects.length > 0 ? (
                  eligibleProjects.map((project: any, i) => (
                    <div
                      key={`project-card-${i}`}
                      className="bg-black/20 rounded-xl border border-white/10 overflow-hidden"
                    >
                      <ProjectCard
                        key={`project-card-${i}`}
                        project={project}
                        projectContract={projectContract}
                        hatsContract={hatsContract}
                        distribute={active && project.eligible}
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
                  <div className="text-center py-8 text-gray-400">
                    <p>There are no active projects.</p>
                  </div>
                )}

                {active && (
                  <div className="mt-6 w-full flex justify-end">
                    {eligibleProjects && userHasVotingPower ? (
                      <span className="flex flex-col md:flex-row md:items-center gap-2">
                        <PrivyWeb3Button
                          action={handleSubmit}
                          requiredChain={chain}
                          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0"
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
                          className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-RobotoMono rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0"
                        />
                      </span>
                    )}
                  </div>
                )}
              </div>

              {ineligibleProjects && ineligibleProjects.length > 0 && (
                <>
                  <h1 className="font-GoodTimes text-white/80 text-xl mt-10 mb-6">
                    Active Projects (Not Eligible)
                  </h1>
                  <div className="flex flex-col gap-6">
                    {ineligibleProjects.map((project: any, i) => (
                      <div
                        key={`ineligible-project-card-${i}`}
                        className="bg-black/20 rounded-xl border border-white/10 overflow-hidden"
                      >
                        <ProjectCard
                          key={`ineligible-project-card-${i}`}
                          project={project}
                          projectContract={projectContract}
                          hatsContract={hatsContract}
                          userHasVotingPower={userHasVotingPower}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="bg-black/20 rounded-xl border border-white/10 overflow-hidden">
              <PastProjects projects={pastProjects} />
            </div>
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}
