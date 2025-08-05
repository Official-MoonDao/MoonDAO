import CitizenTableABI from 'const/abis/CitizenTable.json'
import JobTableABI from 'const/abis/JobBoardTable.json'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
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
  TEAM_ADDRESSES,
  TEAM_TABLE_ADDRESSES,
  VOTING_ESCROW_DEPOSITOR_ADDRESSES,
} from 'const/config'
import { blockedTeams, featuredTeams } from 'const/whitelist'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useContext, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { MediaRenderer, useActiveAccount } from 'thirdweb/react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { getAUMHistory } from '@/lib/coinstats'
import { getMooneyPrice } from '@/lib/coinstats'
import { useAssets } from '@/lib/dashboard/hooks'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import useNewestProposals from '@/lib/nance/useNewestProposals'
import { getAllNetworkTransfers } from '@/lib/network/networkSubgraph'
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
import { NewsletterSubModal } from '../components/newsletter/NewsletterSubModal'
import { ARRChart } from '@/components/dashboard/treasury/ARRChart'
import { AUMChart } from '@/components/dashboard/treasury/AUMChart'
import { ProposalCard } from '@/components/home/ProposalCard'
import ChartModal from '@/components/layout/ChartModal'
import Container from '@/components/layout/Container'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
import Frame from '@/components/layout/Frame'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import StandardButton from '@/components/layout/StandardButton'
import StandardDetailCard from '@/components/layout/StandardDetailCard'
import CitizensChart from '@/components/subscription/CitizensChart'
import WeeklyRewardPool from '@/components/tokens/WeeklyRewardPool'

const Earth = dynamic(() => import('@/components/globe/Earth'), { ssr: false })

export default function Home({
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

  const { ethBudget, usdBudget, mooneyBudget, ethPrice } = getBudget(
    tokens,
    year,
    quarter
  )

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

  const teamHats = useTeamWearer(teamContract, selectedChain, address)

  const withdrawable = useWithdrawAmount(votingEscrowDepositorContract, address)

  return (
    <Container>
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Compact All-in-One Header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 rounded-2xl p-6 mb-6 overflow-hidden">
          <div className="absolute inset-0 bg-black/20 rounded-2xl"></div>
          
          <div className="relative z-10 flex items-center justify-between">
            {/* Left Side - Profile & Title */}
            <div className="flex items-center gap-4">
              {/* Profile Picture */}
              <div className="w-20 h-20 rounded-full overflow-hidden border-3 border-white shadow-xl bg-white relative">
                {citizen?.metadata?.image ? (
                  <MediaRenderer
                    client={client}
                    src={citizen.metadata.image}
                    alt={citizen.metadata.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {citizen?.metadata?.name?.[0] || address?.[2] || 'G'}
                    </span>
                  </div>
                )}
                {/* Online status indicator */}
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
              </div>
              
              {/* Title & Subtitle */}
              <div>
                <h1 className="text-2xl font-bold text-white mb-1 drop-shadow-lg">
                  {isLoadingCitizen ? (
                    <span className="flex items-center gap-2">
                      Welcome...
                      <LoadingSpinner width="w-4" height="h-4" />
                    </span>
                  ) : citizen ? (
                    citizen.metadata.name
                  ) : (
                    'Welcome to MoonDAO'
                  )}
                </h1>
                <p className="text-white/90 text-sm font-medium drop-shadow">
                  Building the future of space exploration together
                </p>
              </div>
            </div>

            {/* Center - Stats */}
            {address && (
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Image src="/coins/MOONEY.png" width={16} height={16} alt="MOONEY" className="rounded-full" />
                  </div>
                  {MOONEYBalance === undefined || MOONEYBalance === null ? (
                    <div className="animate-pulse bg-white/20 rounded w-12 h-4 mx-auto mb-1"></div>
                  ) : (
                    <div className="text-lg font-bold text-blue-300">
                      {Math.round(MOONEYBalance).toLocaleString()}
                    </div>
                  )}
                  <div className="text-xs text-white/70">MOONEY</div>
                </div>

                <div className="text-center">
                  <div className="w-4 h-4 bg-purple-500 rounded-full mx-auto mb-1"></div>
                  {walletVP === undefined || walletVP === null ? (
                    <div className="animate-pulse bg-white/20 rounded w-12 h-4 mx-auto mb-1"></div>
                  ) : (
                    <div className="text-lg font-bold text-purple-300">
                      {Math.round(walletVP).toLocaleString()}
                    </div>
                  )}
                  <div className="text-xs text-white/70">vMOONEY</div>
                </div>

                <div className="text-center">
                  <div className="text-sm mb-1">🗳️</div>
                  <div className="text-lg font-bold text-green-300">{voteCount}</div>
                  <div className="text-xs text-white/70">Votes</div>
                </div>

                <div className="text-center">
                  <div className="text-sm mb-1">👥</div>
                  <div className="text-lg font-bold text-orange-300">{teamHats?.length || 0}</div>
                  <div className="text-xs text-white/70">Teams</div>
                </div>
              </div>
            )}

            {/* Right Side - Action Buttons */}
            <div className="flex gap-2">
              <StandardButton className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all" link="/get-mooney">
                💰 Buy
              </StandardButton>
              <StandardButton className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all" link="/lock">
                🔒 Stake
              </StandardButton>
              <StandardButton className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all" link="/governance">
                🗳️ Vote
              </StandardButton>
            </div>
          </div>
        </div>

        {/* Main Content - Facebook Style Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Key Metrics & Quick Actions */}
          <div className="lg:col-span-3 space-y-4">
            {/* Weekly Reward Pool - Moved from header */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <WeeklyRewardPool />
            </div>

            {/* Navigation Menu */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-4 text-lg">Navigate</h3>
              <div className="space-y-2">
                {[
                  { icon: '🚀', label: 'Launchpad', href: '/launchpad', color: 'hover:bg-blue-600/20' },
                  { icon: '🗳️', label: 'Governance', href: '/governance', color: 'hover:bg-purple-600/20' },
                  { icon: '👥', label: 'Network', href: '/network', color: 'hover:bg-green-600/20' },
                  { icon: '🛒', label: 'Marketplace', href: '/marketplace', color: 'hover:bg-orange-600/20' },
                  { icon: '📰', label: 'News', href: '/news', color: 'hover:bg-red-600/20' },
                ].map((item) => (
                  <Link key={item.label} href={item.href}>
                    <div className={`flex items-center gap-3 p-3 rounded-xl text-white/80 hover:text-white transition-all cursor-pointer ${item.color}`}>
                      <span className="text-xl">{item.icon}</span>
                      <span className="font-medium">{item.label}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Key Metrics Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-4 text-lg">DAO Metrics</h3>
              <div className="space-y-4">
                <div 
                  className="cursor-pointer transition-all duration-200 hover:bg-white/5 rounded-xl p-4 border border-white/5"
                  onClick={openCitizensChart}
                  title="Click to view full chart"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-300 font-medium">Citizens</span>
                    <span className="text-white font-bold text-2xl">
                      {citizenSubgraphData?.transfers?.length || '2,341'}
                    </span>
                  </div>
                  <div className="h-12">
                    <CitizensChart
                      transfers={citizenSubgraphData.transfers}
                      isLoading={false}
                      height={48}
                      compact={true}
                      createdAt={citizenSubgraphData.createdAt}
                    />
                  </div>
                </div>

                {aumData && (
                  <div 
                    className="cursor-pointer transition-all duration-200 hover:bg-white/5 rounded-xl p-4 border border-white/5"
                    onClick={openAUMChart}
                    title="Click to view full chart"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-300 font-medium">AUM</span>
                      <span className="text-white font-bold text-2xl">
                        ${aumData.aum.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-12">
                      <AUMChart
                        compact={true}
                        height={48}
                        days={365}
                        data={aumData.aumHistory}
                      />
                    </div>
                  </div>
                )}

                {arrData && (
                  <div 
                    className="cursor-pointer transition-all duration-200 hover:bg-white/5 rounded-xl p-4 border border-white/5"
                    onClick={openARRChart}
                    title="Click to view full chart"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-300 font-medium">ARR</span>
                      <span className="text-white font-bold text-2xl">
                        ~${arrData.currentARR.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-12">
                      <ARRChart
                        data={arrData.arrHistory || []}
                        compact={true}
                        height={48}
                        isLoading={false}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center Column - Main Feed */}
          <div className="lg:col-span-6 space-y-6">
            {/* Quick Actions */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full overflow-hidden">
                  {citizen?.metadata?.image ? (
                    <MediaRenderer
                      client={client}
                      src={citizen.metadata.image}
                      alt={citizen.metadata.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                      {citizen?.metadata?.name?.[0] || address?.[2] || 'G'}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">Quick Actions</h3>
                  <p className="text-white/70 text-sm">What would you like to do today?</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <StandardButton className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-xl font-medium transition-all duration-200" link="/governance">
                  🗳️ Create Proposal
                </StandardButton>
                <StandardButton className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-3 rounded-xl font-medium transition-all duration-200" link="/launchpad">
                  🚀 Launch Project
                </StandardButton>
                <StandardButton className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 rounded-xl font-medium transition-all duration-200" link="/network">
                  👥 Join Team
                </StandardButton>
              </div>
            </div>

            {/* Activity Feed */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Recent Activity</h3>
                <div className="flex gap-2">
                  <StandardButton className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-sm px-4 py-2 rounded-lg transition-all" link="/news">
                    View All
                  </StandardButton>
                  <StandardButton 
                    className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 text-sm px-4 py-2 rounded-lg transition-all"
                    onClick={() => setNewsletterModalOpen(true)}
                  >
                    Subscribe
                  </StandardButton>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  {
                    type: 'newsletter',
                    icon: '📰',
                    color: 'bg-blue-600',
                    title: 'Latest Newsletter: Datacenters on the moon?',
                    time: '2 hours ago',
                    engagement: '1.2k views'
                  },
                  {
                    type: 'event',
                    icon: '🏛️',
                    color: 'bg-green-600',
                    title: 'Next Townhall: Thursday, June 19th, 2025 @ 3PM EST',
                    time: 'Upcoming event',
                    engagement: '234 interested'
                  },
                  {
                    type: 'proposal',
                    icon: '🚀',
                    color: 'bg-purple-600',
                    title: 'New proposal: MDP-177: Lunar Surface Settlement Study',
                    time: '6 hours ago',
                    engagement: '45 votes'
                  },
                  {
                    type: 'team',
                    icon: '👥',
                    color: 'bg-orange-600',
                    title: 'New team formed: Lunar Mining Research Initiative',
                    time: '12 hours ago',
                    engagement: '8 members'
                  }
                ].map((item, index) => (
                  <div key={index} className="bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer border border-white/5">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 ${item.color} rounded-full flex items-center justify-center text-white text-lg font-semibold shadow-lg`}>
                        {item.icon}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium mb-1">{item.title}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span>{item.time}</span>
                          <span>•</span>
                          <span>{item.engagement}</span>
                        </div>
                      </div>
                      <div className="text-gray-400 hover:text-white">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Proposals Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Active Proposals</h3>
                <StandardButton className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-sm px-4 py-2 rounded-lg transition-all" link="/governance">
                  View All
                </StandardButton>
              </div>
              
              <div className="space-y-4">
                {proposals && proposals.slice(0, 3).map((proposal: any, i: number) => (
                  <div key={proposal.proposalId || i} className="bg-white/5 rounded-xl p-5 border border-white/5 hover:border-white/20 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="text-white font-semibold">
                        {proposal.title || `MDP-${179 - i}: Study on Lunar Surface Selection For Settlement`}
                      </h4>
                      {i === 0 && (
                        <span className="bg-green-500/20 text-green-300 text-xs px-3 py-1 rounded-full border border-green-500/30">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4 text-sm text-gray-300">
                        <span className="flex items-center gap-1">
                          💰 <span className="font-medium">2.2 ETH</span> requested
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          ⏰ <span className="font-medium">{3 + i} days</span> left
                        </span>
                      </div>
                      <StandardButton className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg transition-all">
                        Vote
                      </StandardButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Community & Stats */}
          <div className="lg:col-span-3 space-y-4">
            {/* Teams */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white text-lg">Teams</h3>
                <StandardButton className="text-blue-300 text-sm hover:text-blue-200 transition-all" link="/network?tab=teams">
                  See all
                </StandardButton>
              </div>
              
              <div className="space-y-3">
                {filteredTeams && filteredTeams.length > 0 ? (
                  filteredTeams.slice(0, 5).map((team: any, index: number) => (
                    <div key={team.id || index} className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer">
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
                        {team.image ? (
                          <MediaRenderer
                            client={client}
                            src={team.image}
                            alt={team.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                            {team.name?.[0] || 'T'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm truncate">{team.name || 'Team'}</h4>
                        <p className="text-gray-400 text-xs">{team.memberCount || '8'} members</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white">🚀</div>
                    <div className="flex-1">
                      <h4 className="text-white font-medium text-sm">Mission Control</h4>
                      <p className="text-gray-400 text-xs">12 members</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Citizens */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white text-lg">New Citizens</h3>
                <StandardButton className="text-blue-300 text-sm hover:text-blue-200 transition-all" link="/network?tab=citizens">
                  See all
                </StandardButton>
              </div>
              
              <div className="space-y-3">
                {newestCitizens && newestCitizens.length > 0 ? (
                  newestCitizens.slice(0, 5).map((citizen: any) => (
                    <div key={citizen.id} className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer">
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
                        {citizen.image ? (
                          <MediaRenderer
                            client={client}
                            src={citizen.image}
                            alt={citizen.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                            {citizen.name?.[0] || 'C'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm truncate">{citizen.name || 'Anonymous'}</h4>
                        <p className="text-gray-400 text-xs">New citizen</p>
                      </div>
                      <StandardButton className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded-lg transition-all">
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

            {/* Quick Stats */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-white text-lg mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Total Citizens</span>
                  <span className="text-white font-bold">
                    {citizenSubgraphData?.transfers?.length || '2,341'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Teams</span>
                  <span className="text-white font-bold">
                    {filteredTeams?.length || '12'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Active Proposals</span>
                  <span className="text-white font-bold">3</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Countries</span>
                  <span className="text-white font-bold">47</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Projects Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 mb-8">
          {/* Launchpad Feature */}
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">🚀 Launchpad</h3>
                <p className="text-blue-200">Fund your next mission to space</p>
              </div>
              <StandardButton className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg transition-all" link="/launchpad">
                Launch Project
              </StandardButton>
            </div>
            
            <div className="bg-black/20 rounded-xl p-6 border border-blue-500/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">F</div>
                  <div>
                    <h4 className="font-bold text-white text-lg">Frank to Space</h4>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-blue-200">Active Funding</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-white text-lg">1.2 / 31 ETH</p>
                  <p className="text-blue-200 text-sm">3.9% funded</p>
                </div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 mb-4">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all" style={{ width: '4%' }}></div>
              </div>
              <p className="text-blue-100 text-sm">Send Frank Miller to space as MoonDAO's first citizen astronaut mission.</p>
            </div>
          </div>

          {/* Governance Feature */}
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">🗳️ Governance</h3>
                <p className="text-purple-200">Shape the future of space exploration</p>
              </div>
              <StandardButton className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg transition-all" link="/governance">
                Vote Now
              </StandardButton>
            </div>
            
            <div className="bg-black/20 rounded-xl p-6 border border-purple-500/20">
              <div className="grid grid-cols-2 gap-6 mb-4">
                <div>
                  <div className="text-2xl font-bold text-white">32.3 ETH</div>
                  <div className="text-purple-200 text-sm">Quarterly Treasury</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">8.9M</div>
                  <div className="text-purple-200 text-sm">vMOONEY Staked</div>
                </div>
              </div>
              
              {proposals && proposals.length > 0 && (
                <div className="pt-4 border-t border-purple-500/20">
                  <div className="text-sm">
                    <span className="font-medium text-white">Latest Proposal:</span>
                    <p className="text-purple-100 mt-1">{proposals[0].title || 'MDP-179: Lunar Surface Settlement Study'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global Community Map - Enhanced */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">🌍 Global Community</h3>
              <p className="text-gray-300">MoonDAO citizens around the world</p>
            </div>
            <StandardButton className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-semibold transition-all" link="/map">
              Explore Map
            </StandardButton>
          </div>

          <div className="relative w-full h-[500px] bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-2xl overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center justify-center" style={{ width: '500px', height: '500px' }}>
                <Earth pointsData={citizensLocationData || []} width={500} height={500} />
              </div>
            </div>

            {/* Enhanced Stats overlay with glassmorphism */}
            <div className="absolute top-6 left-6 bg-black/40 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
              <div className="text-white">
                <div className="text-3xl font-bold mb-1">
                  {citizenSubgraphData?.transfers?.length || '2,341'}
                </div>
                <div className="text-sm opacity-90">Global Citizens</div>
              </div>
            </div>

            <div className="absolute top-6 right-6 bg-black/40 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
              <div className="text-white">
                <div className="text-3xl font-bold mb-1">47</div>
                <div className="text-sm opacity-90">Countries</div>
              </div>
            </div>

            <div className="absolute bottom-6 left-6 bg-black/40 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
              <div className="text-white">
                <div className="text-3xl font-bold mb-1">24/7</div>
                <div className="text-sm opacity-90">Active Community</div>
              </div>
            </div>

            <div className="absolute bottom-6 right-6 bg-black/40 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
              <div className="text-white">
                <div className="text-3xl font-bold mb-1">
                  {filteredTeams?.length || teamHats?.length || '12'}
                </div>
                <div className="text-sm opacity-90">Active Teams</div>
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

      {/* Extended Footer */}
      <ExpandedFooter
        hasCallToAction={false}
        darkBackground={true}
        isFullwidth={true}
      />
    </Container>
  )
}

export async function getStaticProps() {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)

  // Initialize all data structures with proper types
  let transferData: any = { citizenTransfers: [], teamTransfers: [] }
  let arrData: any = {
    arrHistory: [],
    currentARR: 0,
    citizenARR: 0,
    teamARR: 0,
  }
  let citizenSubgraphData: any = { transfers: [], createdAt: Date.now() }
  let aumData = null
  let newestCitizens: any = []
  let newestListings: any = []
  let newestJobs: any = []
  let mooneyPrice = 0.0003605 // Default fallback price

  // Get MOONEY price data
  const getMooneyPriceData = async () => {
    try {
      const priceData = await getMooneyPrice()
      console.log('PRICE DATA', priceData)
      return priceData?.price || 0
    } catch (error) {
      console.error('MOONEY price fetch failed:', error)
      return 0
    }
  }
  let newestTeams: any = []
  let filteredTeams: any = []
  let citizensLocationData: any = []

  // Batch all contract operations to reduce API calls
  const contractOperations = async () => {
    try {
      const citizenTableContract = getContract({
        client: serverClient,
        address: CITIZEN_TABLE_ADDRESSES[chainSlug],
        chain: chain,
        abi: CitizenTableABI as any,
      })

      const marketplaceTableContract = getContract({
        client: serverClient,
        address: MARKETPLACE_TABLE_ADDRESSES[chainSlug],
        chain: chain,
        abi: MarketplaceTableABI as any,
      })

      const jobTableContract = getContract({
        client: serverClient,
        address: JOBS_TABLE_ADDRESSES[chainSlug],
        chain: chain,
        abi: JobTableABI as any,
      })

      const teamTableContract = getContract({
        client: serverClient,
        address: TEAM_TABLE_ADDRESSES[chainSlug],
        chain: chain,
        abi: TeamTableABI as any,
      })

      // Batch all table name reads
      const [
        citizenTableName,
        marketplaceTableName,
        jobTableName,
        teamTableName,
      ] = await Promise.all([
        readContract({
          contract: citizenTableContract,
          method: 'getTableName',
        }),
        readContract({
          contract: marketplaceTableContract,
          method: 'getTableName',
        }),
        readContract({ contract: jobTableContract, method: 'getTableName' }),
        readContract({ contract: teamTableContract, method: 'getTableName' }),
      ])

      // Batch all table queries
      const [citizens, listings, jobs, teams] = await Promise.all([
        queryTable(
          chain,
          `SELECT * FROM ${citizenTableName} ORDER BY id DESC LIMIT 10`
        ),
        queryTable(
          chain,
          `SELECT * FROM ${marketplaceTableName} ORDER BY id DESC LIMIT 10`
        ),
        queryTable(
          chain,
          `SELECT * FROM ${jobTableName} ORDER BY id DESC LIMIT 10`
        ),
        queryTable(
          chain,
          `SELECT * FROM ${teamTableName} ORDER BY id DESC LIMIT 10`
        ),
      ])

      return { citizens, listings, jobs, teams }
    } catch (error) {
      console.error('Contract operations failed:', error)
      return { citizens: [], listings: [], jobs: [], teams: [] }
    }
  }

  // Get all transfer data as requested
  const allTransferData = async () => {
    try {
      console.log('Fetching all network transfers...')
      const transfers = await getAllNetworkTransfers()
      console.log(
        `Fetched ${transfers.citizenTransfers.length} citizen transfers and ${transfers.teamTransfers.length} team transfers`
      )
      return transfers
    } catch (error) {
      console.error('Transfer data fetch failed:', error)
      return { citizenTransfers: [], teamTransfers: [] }
    }
  }

  // Get AUM data with proper error handling
  const getAUMData = async () => {
    try {
      const aum = await getAUMHistory(365)
      return aum
    } catch (error) {
      console.error('AUM data fetch failed:', error)
      return null
    }
  }

  // Use Promise.allSettled to run all operations in parallel with individual error handling
  const [transferResult, contractResult, aumResult, mooneyPriceResult] =
    await Promise.allSettled([
      allTransferData(),
      contractOperations(),
      getAUMData(),
      getMooneyPriceData(),
    ])

  // Extract results with fallbacks and proper type handling
  if (transferResult.status === 'fulfilled') {
    transferData = transferResult.value

    // Calculate ARR from all transfer data
    try {
      arrData = await calculateARRFromTransfers(
        transferData.citizenTransfers,
        transferData.teamTransfers,
        365
      )
    } catch (error) {
      console.error('ARR calculation failed:', error)
    }

    citizenSubgraphData = {
      transfers: transferData.citizenTransfers.map((transfer: any) => ({
        id: transfer.id,
        from: transfer.transactionHash,
        blockTimestamp: transfer.blockTimestamp,
      })),
      createdAt: Date.now(),
    }
  }

  if (contractResult.status === 'fulfilled') {
    const { citizens, listings, jobs, teams } = contractResult.value
    newestCitizens = citizens
    newestListings = listings
    newestJobs = jobs
    newestTeams = teams

    // Process teams data for home page display
    filteredTeams = teams.filter((team: any) => team.id && team.name)

    // Process citizens data for map display
    citizensLocationData = citizens
      .filter((citizen: any) => citizen.location)
      .map((citizen: any) => ({
        name: citizen.name || 'Anonymous',
        location: citizen.location,
        bio: citizen.bio || '',
      }))
  }

  if (aumResult.status === 'fulfilled') {
    aumData = aumResult.value
  }

  if (mooneyPriceResult.status === 'fulfilled') {
    mooneyPrice = mooneyPriceResult.value
  }

  const newestNewsletters: any = []

  return {
    props: {
      newestNewsletters,
      newestCitizens,
      newestListings,
      newestJobs,
      citizenSubgraphData,
      aumData,
      arrData,
      mooneyPrice,
      filteredTeams,
      citizensLocationData,
    },
    revalidate: 300,
  }
}
