import {
  RocketLaunchIcon,
  BanknotesIcon,
  CheckBadgeIcon,
  UserGroupIcon,
  ShoppingBagIcon,
  NewspaperIcon,
  GlobeAmericasIcon,
  ChartBarIcon,
  BoltIcon,
  TrophyIcon,
  StarIcon,
  FireIcon,
  GiftIcon,
  PencilIcon,
} from '@heroicons/react/24/outline'
import { Action, RequestBudget } from '@nance/nance-sdk'
import CitizenTableABI from 'const/abis/CitizenTable.json'
import JobTableABI from 'const/abis/JobBoardTable.json'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import TeamABI from 'const/abis/Team.json'
import TeamTableABI from 'const/abis/TeamTable.json'
import VotingEscrowDepositor from 'const/abis/VotingEscrowDepositor.json'
import {
  ARBITRUM_ASSETS_URL,
  BASE_ASSETS_URL,
  CITIZEN_TABLE_ADDRESSES,
  DEFAULT_CHAIN_V5,
  JOBS_TABLE_ADDRESSES,
  MARKETPLACE_TABLE_ADDRESSES,
  POLYGON_ASSETS_URL,
  PROJECT_TABLE_ADDRESSES,
  PROJECT_TABLE_NAMES,
  TEAM_ADDRESSES,
  TEAM_TABLE_ADDRESSES,
  VOTING_ESCROW_DEPOSITOR_ADDRESSES,
} from 'const/config'
import { blockedTeams, featuredTeams } from 'const/whitelist'
import { blockedProjects } from 'const/whitelist'
import { BigNumber } from 'ethers'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useContext, useState, useEffect } from 'react'
import { getContract, readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { getAUMHistory } from '@/lib/coinstats'
import { getMooneyPrice } from '@/lib/coinstats'
import { useAssets } from '@/lib/dashboard/hooks'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import { sepolia } from '@/lib/infura/infuraChains'
import { formatNumberUSStyle } from '@/lib/nance'
import useNewestProposals from '@/lib/nance/useNewestProposals'
import { getAllNetworkTransfers } from '@/lib/network/networkSubgraph'
import { Project } from '@/lib/project/useProjectData'
import { useVoteCountOfAddress } from '@/lib/snapshot'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { teamRowToNFT } from '@/lib/tableland/convertRow'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client, { serverClient } from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTotalMooneyBalance } from '@/lib/tokens/hooks/useTotalMooneyBalance'
import { useTotalVP } from '@/lib/tokens/hooks/useTotalVP'
import { calculateARRFromTransfers } from '@/lib/treasury/arr'
import { getRelativeQuarter } from '@/lib/utils/dates'
import useStakedEth from '@/lib/utils/hooks/useStakedEth'
import useWithdrawAmount from '@/lib/utils/hooks/useWithdrawAmount'
import { getBudget } from '@/lib/utils/rewards'
import { ARRChart } from '@/components/dashboard/treasury/ARRChart'
import { AUMChart } from '@/components/dashboard/treasury/AUMChart'
import ChartModal from '@/components/layout/ChartModal'
import Container from '@/components/layout/Container'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
import Frame from '@/components/layout/Frame'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import StandardButton from '@/components/layout/StandardButton'
import StandardDetailCard from '@/components/layout/StandardDetailCard'
import { ETH_MOCK_ADDRESS } from '@/components/nance/form/SafeTokenForm'
import { NewsletterSubModal } from '@/components/newsletter/NewsletterSubModal'
import CitizenMetadataModal from '@/components/subscription/CitizenMetadataModal'
import CitizensChart from '@/components/subscription/CitizensChart'
import WeeklyRewardPool from '@/components/tokens/WeeklyRewardPool'
import IPFSRenderer from '../layout/IPFSRenderer'
import Quests from '../xp/Quests'

// import Quests from '@/components/xp/Quests'

const Earth = dynamic(() => import('@/components/globe/Earth'), { ssr: false })

// Function to extract ETH amount from proposal actions
function getEthAmountFromProposal(actions: Action[] | undefined): number {
  if (!actions) return 0

  let ethAmount = 0
  actions
    .filter((action) => action.type === 'Request Budget')
    .flatMap((action) => (action.payload as RequestBudget).budget)
    .forEach((transfer) => {
      if (transfer.token === ETH_MOCK_ADDRESS) {
        ethAmount += Number(transfer.amount)
      }
    })

  return ethAmount
}

export default function SingedInDashboard({
  newestNewsletters,
  newestCitizens,
  newestListings,
  newestJobs,
  citizenSubgraphData,
  aumData,
  arrData,
  mooneyPrice, // Add this new prop
  citizensLocationData,
  filteredTeams,
  currentProjects, // Add current projects
}: any) {
  const selectedChain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(selectedChain)

  const { citizen, isLoading: isLoadingCitizen } = useContext(CitizenContext)

  // Modal state for charts
  const [chartModalOpen, setChartModalOpen] = useState(false)
  const [chartModalComponent, setChartModalComponent] =
    useState<React.ReactNode>(null)
  const [chartModalTitle, setChartModalTitle] = useState('')

  // Newsletter modal state
  const [newsletterModalOpen, setNewsletterModalOpen] = useState(false)

  // Citizen metadata modal state
  const [citizenMetadataModalEnabled, setCitizenMetadataModalEnabled] =
    useState(false)

  // Client-side newsletter state
  const [clientNewsletters, setClientNewsletters] = useState<any[]>(
    newestNewsletters || []
  )
  const [newslettersLoading, setNewslettersLoading] = useState(false)

  // Fetch newsletters on client-side to get real ConvertKit data
  useEffect(() => {
    const fetchNewsletters = async () => {
      setNewslettersLoading(true)
      try {
        const response = await fetch('/api/newsletters')
        if (response.ok) {
          const data = await response.json()
          setClientNewsletters(data.newsletters || [])
        }
      } catch (error) {
        console.error('Failed to fetch newsletters:', error)
      } finally {
        setNewslettersLoading(false)
      }
    }

    fetchNewsletters()
  }, [])

  // Chart modal handlers
  const openCitizensChart = () => {
    setChartModalComponent(
      <CitizensChart
        transfers={citizenSubgraphData.transfers}
        isLoading={false}
        height={400}
        compact={false}
        createdAt={citizenSubgraphData.createdAt}
        defaultRange={365}
      />
    )
    setChartModalTitle('CITIZENS')
    setChartModalOpen(true)
  }

  const openAUMChart = () => {
    setChartModalComponent(
      <AUMChart
        data={aumData?.aumHistory || []}
        compact={false}
        height={400}
        isLoading={false}
        defaultRange={365}
      />
    )
    setChartModalTitle('ASSETS UNDER MANAGEMENT')
    setChartModalOpen(true)
  }

  const openARRChart = () => {
    setChartModalComponent(
      <ARRChart
        data={arrData?.arrHistory || []}
        compact={false}
        height={400}
        isLoading={false}
        defaultRange={365}
      />
    )
    setChartModalTitle('ESTIMATED ANNUAL RECURRING REVENUE')
    setChartModalOpen(true)
  }

  const { proposals, packet, votingInfoMap } = useNewestProposals(100)
  const account = useActiveAccount()
  const address = account?.address

  const { data: voteCount } = useVoteCountOfAddress(address)

  const MOONEYBalance = useTotalMooneyBalance(address)
  const {
    walletVP,
    isLoading: isLoadingVP,
    isError: isErrorVP,
  } = useTotalVP(address || '')

  const { quarter, year } = getRelativeQuarter(0)

  const { tokens: mainnetTokens } = useAssets()
  const { tokens: arbitrumTokens } = useAssets(ARBITRUM_ASSETS_URL)
  const { tokens: polygonTokens } = useAssets(POLYGON_ASSETS_URL)
  const { tokens: baseTokens } = useAssets(BASE_ASSETS_URL)
  const { stakedEth, error } = useStakedEth()

  const tokens = mainnetTokens
    .concat(arbitrumTokens)
    .concat(polygonTokens)
    .concat(baseTokens)
    .concat([{ symbol: 'stETH', balance: stakedEth }])

  const {
    ethBudget: ethBudgetCurrent,
    usdBudget,
    mooneyBudget,
    ethPrice,
  } = getBudget(tokens, year, quarter)
  const ethBudget = 17.09

  const votingEscrowDepositorContract = useContract({
    address: VOTING_ESCROW_DEPOSITOR_ADDRESSES[chainSlug],
    abi: VotingEscrowDepositor.abi,
    chain: selectedChain,
  })

  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI,
    chain: selectedChain,
  })

  const { userTeams: teamHats } = useTeamWearer(
    teamContract,
    selectedChain,
    address
  )

  return (
    <Container>
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Compact All-in-One Header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 rounded-2xl p-4 sm:p-6 mb-6 overflow-hidden">
          <div className="absolute inset-0 bg-black/20 rounded-2xl"></div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-0">
            {/* Left Side - Profile & Title */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Profile Picture */}
              <div className="relative">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-3 border-white shadow-xl bg-white relative flex-shrink-0">
                  {citizen?.metadata?.image ? (
                    <IPFSRenderer
                      src={citizen.metadata.image}
                      alt={citizen.metadata.name}
                      className="w-full h-full object-cover"
                      width={100}
                      height={100}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white font-bold text-base sm:text-lg">
                        {citizen?.metadata?.name?.[0] || address?.[2] || 'G'}
                      </span>
                    </div>
                  )}
                  {/* Online status indicator */}
                  <div className="absolute bottom-0 right-0 w-3 h-3 sm:w-4 sm:h-4 bg-green-500 border-2 border-white rounded-full"></div>
                </div>

                {/* Edit Profile Button */}
                {citizen && (
                  <button
                    className="absolute -top-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center transition-colors shadow-lg border-2 border-white"
                    onClick={() => setCitizenMetadataModalEnabled(true)}
                    title="Edit Profile"
                  >
                    <PencilIcon className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </button>
                )}
              </div>

              {/* Title & Subtitle */}
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-1 drop-shadow-lg leading-tight">
                  {isLoadingCitizen ? (
                    <span className="flex items-center gap-2">
                      Welcome...
                      <LoadingSpinner width="w-4" height="h-4" />
                    </span>
                  ) : citizen ? (
                    `Welcome, ${citizen.metadata.name}`
                  ) : (
                    'Welcome to MoonDAO'
                  )}
                </h1>
              </div>
            </div>

            {/* Center - Stats with Action Buttons */}
            {address && (
              <div className="flex items-center justify-center gap-2 sm:gap-4 lg:gap-6 order-3 lg:order-2 overflow-x-auto scrollbar-hide">
                <div className="text-center flex-shrink-0">
                  {MOONEYBalance === undefined || MOONEYBalance === null ? (
                    <div className="animate-pulse bg-white/20 rounded w-12 sm:w-16 h-6 mx-auto"></div>
                  ) : (
                    <div className="text-lg sm:text-xl font-bold text-white">
                      {Math.round(MOONEYBalance).toLocaleString()}
                    </div>
                  )}
                  <div className="text-xs sm:text-sm text-white/60 flex items-center justify-center gap-1 mt-1 mb-3">
                    <Image
                      src="/coins/MOONEY.png"
                      width={12}
                      height={12}
                      alt="MOONEY"
                      className="rounded-full"
                    />
                    MOONEY
                  </div>
                  <div className="flex justify-center">
                    <StandardButton
                      className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-2 sm:px-3 py-1 sm:py-2 rounded-lg font-medium text-xs transition-all flex items-center gap-1"
                      link="/get-mooney"
                    >
                      <BanknotesIcon className="w-3 h-3" />
                      Buy
                    </StandardButton>
                  </div>
                </div>

                <div className="w-px h-12 sm:h-16 bg-white/20 hidden sm:block"></div>

                <div className="text-center flex-shrink-0">
                  {walletVP === undefined || walletVP === null ? (
                    <div className="animate-pulse bg-white/20 rounded w-12 sm:w-16 h-6 mx-auto"></div>
                  ) : (
                    <div className="text-lg sm:text-xl font-bold text-white">
                      {Math.round(walletVP).toLocaleString()}
                    </div>
                  )}
                  <div className="text-xs sm:text-sm text-white/60 flex items-center justify-center gap-1 mt-1 mb-3">
                    <BoltIcon className="w-3 h-3" />
                    vMOONEY
                  </div>
                  <div className="flex justify-center">
                    <StandardButton
                      className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-2 sm:px-3 py-1 sm:py-2 rounded-lg font-medium text-xs transition-all flex items-center gap-1"
                      link="/lock"
                    >
                      <BoltIcon className="w-3 h-3" />
                      Stake
                    </StandardButton>
                  </div>
                </div>

                <div className="w-px h-12 sm:h-16 bg-white/20 hidden sm:block"></div>

                <div className="text-center flex-shrink-0">
                  <div className="text-lg sm:text-xl font-bold text-white">
                    1
                  </div>
                  <div className="text-xs sm:text-sm text-white/60 flex items-center justify-center gap-1 mt-1 mb-3">
                    <CheckBadgeIcon className="w-3 h-3" />
                    Votes
                  </div>
                  <div className="flex justify-center">
                    <StandardButton
                      className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-2 sm:px-3 py-1 sm:py-2 rounded-lg font-medium text-xs transition-all flex items-center gap-1"
                      link="/governance"
                    >
                      <CheckBadgeIcon className="w-3 h-3" />
                      Vote
                    </StandardButton>
                  </div>
                </div>

                <div className="w-px h-12 sm:h-16 bg-white/20 hidden sm:block"></div>

                <div className="text-center flex-shrink-0">
                  <div className="text-lg sm:text-xl font-bold text-white">
                    {teamHats?.length || 0}
                  </div>
                  <div className="text-xs sm:text-sm text-white/60 flex items-center justify-center gap-1 mt-1 mb-3">
                    <UserGroupIcon className="w-3 h-3" />
                    Teams
                  </div>
                  <div className="flex justify-center">
                    <StandardButton
                      className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-2 sm:px-3 py-1 sm:py-2 rounded-lg font-medium text-xs transition-all flex items-center gap-1"
                      link="/network"
                    >
                      <UserGroupIcon className="w-3 h-3" />
                      <span className="hidden sm:inline">Join Team</span>
                      <span className="sm:hidden">Join</span>
                    </StandardButton>
                  </div>
                </div>
              </div>
            )}

            {/* Right Side - Empty space for balance */}
            <div className="order-2 lg:order-3"></div>
          </div>
        </div>

        {/* Quest System - Horizontal Section */}
        {address && selectedChain === sepolia && <Quests />}

        {/* Main Content - Facebook Style Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-start lg:h-full">
          {/* Left Sidebar - Key Metrics & Quick Actions */}
          <div className="lg:col-span-3 flex flex-col space-y-4 h-full order-2 lg:order-1">
            {/* Weekly Reward Pool - Enhanced UI */}
            <div className="order-2">
              <WeeklyRewardPool />
            </div>

            {/* Key Metrics Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex-grow order-5">
              <h3 className="font-semibold text-white mb-8 text-lg">
                DAO Metrics
              </h3>
              <div className="space-y-8 h-full">
                <div
                  className="cursor-pointer transition-all duration-200 hover:bg-white/5 rounded-xl p-6 border border-white/5"
                  onClick={openCitizensChart}
                  title="Click to view full chart"
                >
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-gray-300 font-medium">Citizens</span>
                    <span className="text-white font-bold text-2xl">
                      {citizenSubgraphData?.transfers?.length || '2,341'}
                    </span>
                  </div>
                  <div className="h-20">
                    <CitizensChart
                      transfers={citizenSubgraphData.transfers}
                      isLoading={false}
                      height={80}
                      compact={true}
                      createdAt={citizenSubgraphData.createdAt}
                    />
                  </div>
                </div>

                {aumData && (
                  <div
                    className="cursor-pointer transition-all duration-200 hover:bg-white/5 rounded-xl p-6 border border-white/5"
                    onClick={openAUMChart}
                    title="Click to view full chart"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-gray-300 font-medium">AUM</span>
                      <span className="text-white font-bold text-2xl">
                        ${Math.round(aumData.aum).toLocaleString()}
                      </span>
                    </div>
                    <div className="h-20">
                      <AUMChart
                        compact={true}
                        height={80}
                        days={365}
                        data={aumData.aumHistory}
                      />
                    </div>
                  </div>
                )}

                {arrData && (
                  <div
                    className="cursor-pointer transition-all duration-200 hover:bg-white/5 rounded-xl p-6 border border-white/5"
                    onClick={openARRChart}
                    title="Click to view full chart"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-gray-300 font-medium">ARR</span>
                      <span className="text-white font-bold text-2xl">
                        ${Math.round(arrData.currentARR).toLocaleString()}
                      </span>
                    </div>
                    <div className="h-20">
                      <ARRChart
                        data={arrData.arrHistory || []}
                        compact={true}
                        height={80}
                        isLoading={false}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center Column - Main Feed */}
          <div className="lg:col-span-6 flex flex-col space-y-6 h-full min-h-[800px] order-1 lg:order-2">
            {/* Quick Actions */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 order-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full overflow-hidden">
                  {citizen?.metadata?.image ? (
                    <IPFSRenderer
                      src={citizen.metadata.image}
                      alt={citizen.metadata.name}
                      className="w-full h-full object-cover"
                      width={100}
                      height={100}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                      {citizen?.metadata?.name?.[0] || address?.[2] || 'G'}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">
                    Quick Actions
                  </h3>
                  <p className="text-white/70 text-sm">
                    What would you like to do today?
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StandardButton
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-xl font-medium transition-all duration-200 w-full h-12 flex items-center justify-center text-sm gap-1 whitespace-nowrap"
                  link="/governance"
                >
                  <CheckBadgeIcon className="w-4 h-4" />
                  Propose
                </StandardButton>
                <StandardButton
                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-3 rounded-xl font-medium transition-all duration-200 w-full h-12 flex items-center justify-center text-sm gap-1 whitespace-nowrap"
                  link="/launchpad"
                >
                  <RocketLaunchIcon className="w-4 h-4" />
                  Launch
                </StandardButton>
                <StandardButton
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 rounded-xl font-medium transition-all duration-200 w-full h-12 flex items-center justify-center text-sm gap-1 whitespace-nowrap"
                  link="/network"
                >
                  <UserGroupIcon className="w-4 h-4" />
                  Join Team
                </StandardButton>
                <StandardButton
                  className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white py-3 rounded-xl font-medium transition-all duration-200 w-full h-12 flex items-center justify-center text-sm gap-1 whitespace-nowrap"
                  link="/marketplace"
                >
                  <ShoppingBagIcon className="w-4 h-4" />
                  Shop
                </StandardButton>
              </div>
            </div>

            {/* Activity Feed */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 order-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3 sm:gap-0">
                <h3 className="text-xl font-bold text-white whitespace-nowrap">
                  Recent Activity
                </h3>
                <div className="flex gap-2 flex-shrink-0">
                  <StandardButton
                    className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-sm px-4 py-2 rounded-lg transition-all whitespace-nowrap"
                    link="/news"
                  >
                    View All
                  </StandardButton>
                  <StandardButton
                    className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 text-sm px-4 py-2 rounded-lg transition-all whitespace-nowrap"
                    onClick={() => setNewsletterModalOpen(true)}
                  >
                    Subscribe
                  </StandardButton>
                </div>
              </div>

              <div className="space-y-4">
                {newslettersLoading ? (
                  <div className="text-center py-8">
                    <div className="text-white/60">Loading newsletters...</div>
                  </div>
                ) : clientNewsletters && clientNewsletters.length > 0 ? (
                  clientNewsletters
                    .slice(0, 4)
                    .map((newsletter: any, index: number) => (
                      <div
                        key={newsletter.id || index}
                        className="bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer border border-white/5"
                        onClick={() => {
                          if (
                            newsletter.url &&
                            newsletter.url !==
                              'https://news.moondao.com/posts' &&
                            newsletter.url !==
                              'https://moondao.kit.com/posts' &&
                            newsletter.url.includes('http')
                          ) {
                            window.open(newsletter.url, '_blank')
                          } else {
                            window.open(
                              'https://news.moondao.com/posts',
                              '_blank'
                            )
                          }
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-blue-600">
                            {newsletter.image ? (
                              <IPFSRenderer
                                src={newsletter.image}
                                alt={newsletter.title}
                                className="w-full h-full object-cover"
                                width={100}
                                height={100}
                              />
                            ) : (
                              <NewspaperIcon className="w-6 h-6 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-medium mb-1">
                              {newsletter.title || 'Newsletter Update'}
                            </p>
                            {newsletter.description && (
                              <p className="text-gray-300 text-sm mb-2 line-clamp-2">
                                {newsletter.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              <span>
                                {newsletter.publishedAt
                                  ? new Date(
                                      newsletter.publishedAt
                                    ).toLocaleDateString()
                                  : 'Recently'}
                              </span>
                              {newsletter.views && newsletter.views > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{newsletter.views} recipients</span>
                                </>
                              )}
                              {newsletter.readTime && (
                                <>
                                  <span>•</span>
                                  <span>{newsletter.readTime} min read</span>
                                </>
                              )}
                              {newsletter.isArchived && (
                                <>
                                  <span>•</span>
                                  <span className="text-orange-400">
                                    Archive
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div
                            className="text-gray-400 hover:text-white transition-colors"
                            title="Click to view newsletter"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-16 min-h-[300px] flex flex-col justify-center">
                    <NewspaperIcon className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">
                      No newsletters available
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Check back soon for updates
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Active Proposals Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex-grow order-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">
                  Active Proposals
                </h3>
                <StandardButton
                  className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-sm px-4 py-2 rounded-lg transition-all"
                  link="/governance"
                >
                  View All
                </StandardButton>
              </div>

              <div className="space-y-4 h-full overflow-y-auto">
                {proposals &&
                  proposals.slice(0, 3).map((proposal: any, i: number) => {
                    const ethAmount = getEthAmountFromProposal(proposal.actions)

                    return (
                      <Link
                        key={proposal.uuid || i}
                        href={`/proposal/${proposal.uuid}`}
                        className="block"
                      >
                        <div className="bg-white/5 rounded-xl p-5 border border-white/5 hover:border-white/20 transition-all cursor-pointer">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="text-white font-semibold">
                              {proposal.title ||
                                `MDP-${
                                  179 - i
                                }: Study on Lunar Surface Selection For Settlement`}
                            </h4>
                            {i === 0 && (
                              <span className="bg-green-500/20 text-green-300 text-xs px-3 py-1 rounded-full border border-green-500/30">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-300">
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-white">
                                  {ethAmount > 0
                                    ? `${formatNumberUSStyle(ethAmount)} ETH`
                                    : 'No funding'}
                                </span>
                                <span>requested</span>
                              </div>
                              <span className="hidden sm:inline">•</span>
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-white">
                                  {3 + i} days
                                </span>
                                <span>left</span>
                              </div>
                            </div>
                            <span className="hidden sm:inline">•</span>
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-white">
                                {3 + i} days
                              </span>
                              <span>left</span>
                              <div className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm px-4 py-2 rounded-lg transition-all self-start sm:self-auto">
                                Vote
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Community & Stats */}
          <div className="lg:col-span-3 flex flex-col space-y-4 h-full min-h-[800px] order-4 lg:order-3">
            {/* Recent Citizens */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white text-lg">
                  New Citizens
                </h3>
                <StandardButton
                  className="text-blue-300 text-sm hover:text-blue-200 transition-all"
                  link="/network?tab=citizens"
                >
                  See all
                </StandardButton>
              </div>

              <div className="space-y-3">
                {newestCitizens && newestCitizens.length > 0 ? (
                  newestCitizens.slice(0, 5).map((citizen: any) => (
                    <div
                      key={citizen.id}
                      className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
                        {citizen.image ? (
                          <IPFSRenderer
                            src={citizen.image}
                            alt={citizen.name}
                            className="w-full h-full object-cover"
                            width={100}
                            height={100}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                            {citizen.name?.[0] || 'C'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm truncate">
                          {citizen.name || 'Anonymous'}
                        </h4>
                        <p className="text-gray-400 text-xs">New citizen</p>
                      </div>
                      <StandardButton
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded-lg transition-all"
                        link={`/citizen/${
                          citizen.name && citizen.id
                            ? generatePrettyLinkWithId(citizen.name, citizen.id)
                            : citizen.id || 'anonymous'
                        }`}
                      >
                        Connect
                      </StandardButton>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400 text-sm text-center py-4">
                    Loading...
                  </div>
                )}
              </div>
            </div>

            {/* Featured Teams */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white text-lg">
                  Featured Teams
                </h3>
                <StandardButton
                  className="text-blue-300 text-sm hover:text-blue-200 transition-all"
                  link="/network?tab=teams"
                >
                  See all
                </StandardButton>
              </div>

              <div className="space-y-3">
                {filteredTeams && filteredTeams.length > 0 ? (
                  filteredTeams.slice(0, 5).map((team: any, index: number) => (
                    <div
                      key={team.id || index}
                      className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
                        {team.image ? (
                          <IPFSRenderer
                            src={team.image}
                            alt={team.name}
                            className="w-full h-full object-cover"
                            width={100}
                            height={100}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                            {team.name?.[0] || 'T'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm truncate">
                          {team.name || 'Team'}
                        </h4>
                        <p className="text-gray-400 text-xs">
                          {team.memberCount || '8'} members
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                      M
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-medium text-sm">
                        Mission Control
                      </h4>
                      <p className="text-gray-400 text-xs">12 members</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Marketplace */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex-grow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white text-lg">
                  Marketplace
                </h3>
                <StandardButton
                  className="text-blue-300 text-sm hover:text-blue-200 transition-all"
                  link="/marketplace"
                >
                  See all
                </StandardButton>
              </div>

              <div className="space-y-3 h-full overflow-y-auto">
                {newestListings && newestListings.length > 0 ? (
                  newestListings
                    .slice(0, 3)
                    .map((listing: any, index: number) => (
                      <div
                        key={listing.id || index}
                        className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
                          {listing.image ? (
                            <IPFSRenderer
                              src={listing.image}
                              alt={listing.title}
                              className="w-full h-full object-cover"
                              width={100}
                              height={100}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                              <ShoppingBagIcon className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium text-sm truncate">
                            {listing.title || 'Marketplace Item'}
                          </h4>
                          <p className="text-gray-400 text-xs">
                            {listing.price
                              ? `${listing.price} ETH`
                              : 'View details'}
                          </p>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center text-white">
                        <ShoppingBagIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-medium text-sm">
                          Moon Rock Sample
                        </h4>
                        <p className="text-gray-400 text-xs">2.5 ETH</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center text-white">
                        <ShoppingBagIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-medium text-sm">
                          Space Suit NFT
                        </h4>
                        <p className="text-gray-400 text-xs">1.8 ETH</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center text-white">
                        <ShoppingBagIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-medium text-sm">
                          Lunar Map Print
                        </h4>
                        <p className="text-gray-400 text-xs">0.5 ETH</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Events Section - Full Width */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mt-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white">Upcoming Events</h3>
            <StandardButton
              className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-sm px-4 py-2 rounded-lg transition-all"
              link="/events"
            >
              View All Events
            </StandardButton>
          </div>

          <div className="w-full relative">
            <div
              id="luma-loading-dashboard"
              className="absolute inset-0 bg-gray-800/20 rounded-lg flex items-center justify-center min-h-[350px]"
            >
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-sm">Loading events...</p>
              </div>
            </div>
            <iframe
              src="https://lu.ma/embed/calendar/cal-7mKdy93TZVlA0Xh/events?lt=dark"
              width="100%"
              height="400"
              frameBorder="0"
              style={{ border: '1px solid #ffffff20', borderRadius: '12px' }}
              allowFullScreen
              aria-hidden="false"
              tabIndex={0}
              className="rounded-lg relative z-10"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="MoonDAO Events Calendar"
              onLoad={(e) => {
                const loadingDiv = document.getElementById(
                  'luma-loading-dashboard'
                )
                if (loadingDiv) {
                  loadingDiv.style.display = 'none'
                }
              }}
            />
            {/* Fallback link */}
            <div className="mt-4 text-center">
              <p className="text-white/70 text-sm mb-2">
                Can't see the calendar?
              </p>
              <a
                href="https://lu.ma/moondao"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
              >
                View events on lu.ma
                <svg
                  className="ml-2 w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Featured Projects Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 mb-8">
          {/* Launchpad Feature */}
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-2 flex items-center gap-2">
                  <RocketLaunchIcon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 flex-shrink-0" />
                  <span className="leading-tight">Launchpad</span>
                </h3>
                <p className="text-blue-200 text-sm sm:text-base leading-tight">
                  Coming soon - Fund your next mission to space
                </p>
              </div>
              <div className="bg-gray-600 text-gray-300 px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-semibold shadow-lg cursor-not-allowed text-sm sm:text-base whitespace-nowrap flex-shrink-0">
                Coming Soon
              </div>
            </div>

            <div className="bg-black/20 rounded-xl p-6 border border-blue-500/20">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-400 mx-auto mb-4">
                  <RocketLaunchIcon className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-white text-xl mb-2">
                  Launchpad Coming Soon
                </h4>
                <p className="text-blue-200 text-sm mb-4">
                  We're preparing an exciting new way to fund space missions
                  through decentralized crowdfunding.
                </p>
                <div className="text-blue-300 text-xs">
                  Stay tuned for launch updates!
                </div>
              </div>
            </div>
          </div>

          {/* Projects Feature */}
          <div className="bg-gradient-to-br from-green-600/20 to-emerald-800/20 backdrop-blur-xl border border-green-500/20 rounded-2xl p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-2 flex items-center gap-2">
                  <RocketLaunchIcon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 flex-shrink-0" />
                  <span className="leading-tight">Active Projects</span>
                </h3>
                <p className="text-green-200 text-sm sm:text-base leading-tight">
                  Contribute to space exploration initiatives
                </p>
              </div>
              <StandardButton
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-semibold shadow-lg transition-all text-sm sm:text-base whitespace-nowrap flex-shrink-0"
                link="/projects"
              >
                View All Projects
              </StandardButton>
            </div>

            <div className="bg-black/20 rounded-xl p-6 border border-green-500/20">
              <div className="grid grid-cols-2 gap-6 mb-4">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {Math.round(ethBudget)} ETH
                  </div>
                  <div className="text-green-200 text-sm">
                    Quarterly Rewards Budget
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">
                    {currentProjects?.length || 0}
                  </div>
                  <div className="text-green-200 text-sm">Active Projects</div>
                </div>
              </div>

              {currentProjects && currentProjects.length > 0 ? (
                <div className="pt-4 border-t border-green-500/20">
                  <div className="text-sm mb-3">
                    <span className="font-medium text-white">
                      Featured Project:
                    </span>
                  </div>
                  <div className="bg-black/30 rounded-lg p-4 border border-green-500/10">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-white text-sm">
                        {currentProjects[0].name}
                      </h4>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          currentProjects[0].active
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-gray-500/20 text-gray-300'
                        }`}
                      >
                        {currentProjects[0].active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-green-100 text-xs leading-relaxed">
                      {currentProjects[0].description?.length > 120
                        ? `${currentProjects[0].description.substring(
                            0,
                            120
                          )}...`
                        : currentProjects[0].description ||
                          'No description available'}
                    </p>
                    {currentProjects.length > 1 && (
                      <p className="text-green-300 text-xs mt-2">
                        +{currentProjects.length - 1} more projects available
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="pt-4 border-t border-green-500/20">
                  <div className="text-center py-8">
                    <RocketLaunchIcon className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm mb-2">
                      No active projects at the moment
                    </p>
                    <p className="text-gray-500 text-xs mb-4">
                      Check back soon for new space exploration initiatives
                    </p>
                    <StandardButton
                      className="bg-green-600/20 hover:bg-green-600/40 text-green-300 text-sm px-4 py-2 rounded-lg transition-all"
                      link="/projects"
                    >
                      View All Projects
                    </StandardButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global Community Map - Enhanced */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 lg:p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-2 flex items-center gap-2">
                <GlobeAmericasIcon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 flex-shrink-0" />
                <span className="leading-tight">Global Community</span>
              </h3>
              <p className="text-gray-300 text-sm sm:text-base leading-tight">
                MoonDAO citizens around the world
              </p>
            </div>
            <StandardButton
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-semibold transition-all text-sm sm:text-base whitespace-nowrap flex-shrink-0"
              link="/map"
            >
              Explore Map
            </StandardButton>
          </div>

          <div className="relative w-full h-[400px] sm:h-[500px] lg:h-[650px] xl:h-[700px] bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-2xl overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center justify-center">
                <Earth
                  pointsData={citizensLocationData || []}
                  width={undefined}
                  height={undefined}
                />
              </div>
            </div>

            {/* Enhanced Stats overlay with glassmorphism */}
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 lg:top-6 lg:left-6 bg-black/40 backdrop-blur-lg rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-white/10 max-w-[120px] sm:max-w-none">
              <div className="text-white">
                <div className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1 leading-tight">
                  {citizenSubgraphData?.transfers?.length || '145'}
                </div>
                <div className="text-xs sm:text-sm opacity-90 leading-tight">
                  Global Citizens
                </div>
              </div>
            </div>

            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 lg:top-6 lg:right-6 bg-black/40 backdrop-blur-lg rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-white/10 max-w-[120px] sm:max-w-none">
              <div className="text-white">
                <div className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1 leading-tight">
                  47
                </div>
                <div className="text-xs sm:text-sm opacity-90 leading-tight">
                  Countries
                </div>
              </div>
            </div>

            <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 lg:bottom-6 lg:left-6 bg-black/40 backdrop-blur-lg rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-white/10 max-w-[120px] sm:max-w-none">
              <div className="text-white">
                <div className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1 leading-tight">
                  24/7
                </div>
                <div className="text-xs sm:text-sm opacity-90 leading-tight">
                  Active Commu
                </div>
              </div>
            </div>

            <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 lg:bottom-6 lg:right-6 bg-black/40 backdrop-blur-lg rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-white/10 max-w-[120px] sm:max-w-none">
              <div className="text-white">
                <div className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1 leading-tight">
                  {filteredTeams?.length || teamHats?.length || '9'}
                </div>
                <div className="text-xs sm:text-sm opacity-90 leading-tight">
                  Active Teams
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Modal */}
      <ChartModal
        isOpen={chartModalOpen}
        setIsOpen={setChartModalOpen}
        chartComponent={chartModalComponent}
        chartTitle={chartModalTitle}
      />

      {/* Newsletter Modal */}
      {newsletterModalOpen && (
        <NewsletterSubModal setEnabled={setNewsletterModalOpen} />
      )}

      {/* Citizen Metadata Modal */}
      {citizenMetadataModalEnabled && citizen && (
        <CitizenMetadataModal
          nft={citizen}
          selectedChain={selectedChain}
          setEnabled={setCitizenMetadataModalEnabled}
        />
      )}

      {/* Extended Footer */}
      <ExpandedFooter
        hasCallToAction={false}
        darkBackground={true}
        isFullwidth={true}
      />
    </Container>
  )
}
