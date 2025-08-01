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
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header Section - Clean Profile Style */}
        <div className="bg-gradient-to-br from-slate-900 via-blue-900/40 to-purple-900/30 backdrop-blur-xl border border-white/10 rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-8">
            {/* Profile Picture */}
            <div className="w-28 h-28 rounded-full overflow-hidden border border-white/20 shadow-lg">
              {citizen?.metadata?.image ? (
                <MediaRenderer
                  client={client}
                  src={citizen.metadata.image}
                  alt={citizen.metadata.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-3xl">
                    {citizen?.metadata?.name?.[0] || address?.[2] || 'G'}
                  </span>
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-white mb-4">
                {isLoadingCitizen ? (
                  <span className="flex items-center gap-3">
                    Welcome...
                    <LoadingSpinner width="w-6" height="h-6" />
                  </span>
                ) : citizen ? (
                  `Welcome, ${citizen.metadata.name}`
                ) : (
                  'Welcome to MoonDAO'
                )}
              </h1>
              
              {address && (
                <div className="flex flex-wrap gap-6 text-base text-white/80 mb-6">
                  <div className="flex items-center gap-3">
                    <Image src="/coins/MOONEY.png" width={20} height={20} alt="MOONEY" className="rounded-full" />
                    {MOONEYBalance === undefined || MOONEYBalance === null ? (
                      <div className="animate-pulse bg-white/20 rounded w-24 h-5"></div>
                    ) : (
                      <span>
                        <span className="text-blue-300 font-semibold text-lg">{Math.round(MOONEYBalance).toLocaleString()}</span> MOONEY
                        {mooneyPrice && (
                          <span className="text-white/60 ml-2">
                            (${(MOONEYBalance * mooneyPrice).toFixed(0)})
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-purple-500 rounded-full"></div>
                    {walletVP === undefined || walletVP === null ? (
                      <div className="animate-pulse bg-white/20 rounded w-20 h-5"></div>
                    ) : (
                      <span>
                        <span className="text-purple-300 font-semibold text-lg">{Math.round(walletVP).toLocaleString()}</span> vMOONEY
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-white/70">
                    <span className="text-lg">🗳️ <span className="font-semibold">{voteCount}</span> votes</span>
                  </div>

                  <div className="flex items-center gap-2 text-white/70">
                    <span className="text-lg">👥 <span className="font-semibold">{teamHats?.length || 0}</span> teams</span>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-4">
                <StandardButton className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-base font-medium transition-all" link="/get-mooney">
                  Buy MOONEY
                </StandardButton>
                <StandardButton className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg text-base font-medium transition-all" link="/lock">
                  Stake MOONEY
                </StandardButton>
                <StandardButton className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg text-base font-medium transition-all" link="/governance">
                  Vote
                </StandardButton>
              </div>
            </div>

            {/* Quick Stats Card */}
            <div className="bg-black/20 rounded-xl p-6 border border-white/10">
              <WeeklyRewardPool />
            </div>
          </div>
        </div>

        {/* Dashboard Grid - Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Left Column - Metrics */}
          <div className="lg:col-span-1 space-y-4">
            {/* Key Metrics */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Key Metrics</h3>
              <div className="space-y-4">
                <div 
                  className="cursor-pointer transition-all duration-200 hover:bg-white/5 rounded-lg p-3"
                  onClick={openCitizensChart}
                  title="Click to view full chart"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Citizens</span>
                    <span className="text-white font-bold text-xl">
                      {citizenSubgraphData?.transfers?.length || '2,341'}
                    </span>
                  </div>
                  <div className="h-8">
                    <CitizensChart
                      transfers={citizenSubgraphData.transfers}
                      isLoading={false}
                      height={32}
                      compact={true}
                      createdAt={citizenSubgraphData.createdAt}
                    />
                  </div>
                </div>

                {aumData && (
                  <div 
                    className="cursor-pointer transition-all duration-200 hover:bg-white/5 rounded-lg p-3"
                    onClick={openAUMChart}
                    title="Click to view full chart"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">AUM</span>
                      <span className="text-white font-bold text-xl">
                        ${aumData.aum.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-8">
                      <AUMChart
                        compact={true}
                        height={32}
                        days={365}
                        data={aumData.aumHistory}
                      />
                    </div>
                  </div>
                )}

                {arrData && (
                  <div 
                    className="cursor-pointer transition-all duration-200 hover:bg-white/5 rounded-lg p-3"
                    onClick={openARRChart}
                    title="Click to view full chart"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">ARR</span>
                      <span className="text-white font-bold text-xl">
                        ~${arrData.currentARR.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-8">
                      <ARRChart
                        data={arrData.arrHistory || []}
                        compact={true}
                        height={32}
                        isLoading={false}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <StandardButton className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-3 rounded-lg transition-all" link="/launchpad">
                  <div className="text-center">
                    <div className="text-lg mb-1">🚀</div>
                    <div>Launchpad</div>
                  </div>
                </StandardButton>
                <StandardButton className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm py-3 rounded-lg transition-all" link="/governance">
                  <div className="text-center">
                    <div className="text-lg mb-1">🗳️</div>
                    <div>Governance</div>
                  </div>
                </StandardButton>
                <StandardButton className="w-full bg-green-600 hover:bg-green-700 text-white text-sm py-3 rounded-lg transition-all" link="/network">
                  <div className="text-center">
                    <div className="text-lg mb-1">👥</div>
                    <div>Network</div>
                  </div>
                </StandardButton>
                <StandardButton className="w-full bg-orange-600 hover:bg-orange-700 text-white text-sm py-3 rounded-lg transition-all" link="/marketplace">
                  <div className="text-center">
                    <div className="text-lg mb-1">🛒</div>
                    <div>Market</div>
                  </div>
                </StandardButton>
              </div>
            </div>
          </div>

          {/* Center Column - Activity Feed */}
          <div className="lg:col-span-2 space-y-4">
            {/* Recent Activity */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                <div className="flex gap-2">
                  <StandardButton className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded-md transition-all" link="/news">
                    All News
                  </StandardButton>
                  <StandardButton 
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1 rounded-md transition-all"
                    onClick={() => setNewsletterModalOpen(true)}
                  >
                    Subscribe
                  </StandardButton>
                </div>
              </div>

              {/* Activity Items */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-white/5">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm">📰</div>
                  <div className="flex-1">
                    <p className="text-white text-sm">Latest Newsletter: Datacenters on the moon?</p>
                    <p className="text-gray-400 text-xs">2 hours ago</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-white/5">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-sm">🏛️</div>
                  <div className="flex-1">
                    <p className="text-white text-sm">Next Townhall: Thursday, June 19th, 2025 @ 3PM EST</p>
                    <p className="text-gray-400 text-xs">Upcoming event</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-white/5">
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-sm">🚀</div>
                  <div className="flex-1">
                    <p className="text-white text-sm">New proposal: MDP-177: Lunar Surface Settlement Study</p>
                    <p className="text-gray-400 text-xs">6 hours ago</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Proposals */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Active Proposals</h3>
                <StandardButton className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded-md transition-all" link="/governance">
                  View All
                </StandardButton>
              </div>
              
              <div className="space-y-3">
                {proposals && proposals.slice(0, 3).map((proposal: any, i: number) => (
                  <div key={proposal.proposalId || i} className="p-4 bg-black/20 rounded-lg border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-white font-medium text-sm">
                        {proposal.title || `MDP-${179 - i}: Study on Lunar Surface Selection For Settlement`}
                      </h4>
                      {i === 0 && (
                        <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">Active</span>
                      )}
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>💰 2.2 ETH requested</span>
                      <span>⏰ {3 + i} days left</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Compact Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Launchpad Section - Simplified */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Launchpad</h3>
              <StandardButton className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-all" link="/launchpad">
                View All
              </StandardButton>
            </div>
            <p className="text-gray-300 text-sm mb-4">Fund your next mission with MoonDAO. Simple enough for a student project, robust enough for moonshots.</p>
            
            <div className="space-y-3">
              <div className="bg-black/20 rounded-lg p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">F</div>
                    <div>
                      <h4 className="font-semibold text-white">Frank to Space</h4>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-gray-400">Active</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">1.2 / 31 ETH</p>
                    <div className="w-20 bg-gray-600 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '4%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Governance Section - Simplified */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Governance</h3>
              <StandardButton className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-all" link="/governance">
                View All
              </StandardButton>
            </div>
            <p className="text-gray-300 text-sm mb-4">Weekly voting on community projects and proposals.</p>
            
            <div className="bg-black/20 rounded-lg p-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-lg font-bold text-white">32.3 ETH</div>
                  <div className="text-sm text-gray-400">Quarterly Pool</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">8.9M</div>
                  <div className="text-sm text-gray-400">vMOONEY Staked</div>
                </div>
              </div>
              
              {proposals && proposals.length > 0 && (
                <div className="pt-3 border-t border-white/10">
                  <div className="text-sm">
                    <span className="font-medium text-white">Latest:</span> <span className="text-gray-300">{proposals[0].title || 'MDP-179: Lunar Surface Study'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Community Section - Simplified */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Teams */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Active Teams</h3>
              <StandardButton className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded-md transition-all" link="/network?tab=teams">
                See All
              </StandardButton>
            </div>
            
            <div className="space-y-3">
              {filteredTeams && filteredTeams.length > 0 ? (
                filteredTeams.slice(0, 3).map((team: any, index: number) => (
                  <div key={team.id || index} className="flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-white/5">
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
                      {team.image ? (
                        <MediaRenderer
                          client={client}
                          src={team.image}
                          alt={team.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                          {team.name?.[0] || 'T'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-medium text-sm">{team.name || 'Team'}</h4>
                      <p className="text-gray-400 text-xs">Team #{team.id}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-white/5">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white">🚀</div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium text-sm">Mission Control</h4>
                    <p className="text-gray-400 text-xs">Strategic planning team</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Citizens */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Recent Citizens</h3>
              <StandardButton className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded-md transition-all" link="/network?tab=citizens">
                See All
              </StandardButton>
            </div>
            
            <div className="space-y-3">
              {newestCitizens && newestCitizens.length > 0 ? (
                newestCitizens.slice(0, 3).map((citizen: any) => (
                  <div key={citizen.id} className="flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-white/5">
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
                      {citizen.image ? (
                        <MediaRenderer
                          client={client}
                          src={citizen.image}
                          alt={citizen.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                          {citizen.name?.[0] || 'C'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-medium text-sm">{citizen.name || 'Anonymous'}</h4>
                      <p className="text-gray-400 text-xs">Citizen #{citizen.id}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-400 text-sm text-center py-4">
                  Loading citizen data...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global Community Map - Compact */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Global Community</h3>
            <StandardButton className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded-md transition-all" link="/map">
              View Full Map
            </StandardButton>
          </div>

          <div className="relative w-full h-[400px] bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center justify-center" style={{ width: '400px', height: '400px' }}>
                <Earth pointsData={citizensLocationData || []} width={400} height={400} />
              </div>
            </div>

            {/* Stats overlay */}
            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-xl p-4">
              <div className="text-white">
                <div className="text-2xl font-bold">
                  {citizenSubgraphData?.transfers?.length || '2,341'}
                </div>
                <div className="text-sm opacity-80">Global Citizens</div>
              </div>
            </div>

            <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-xl p-4">
              <div className="text-white">
                <div className="text-2xl font-bold">47</div>
                <div className="text-sm opacity-80">Countries</div>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm rounded-xl p-4">
              <div className="text-white">
                <div className="text-2xl font-bold">24/7</div>
                <div className="text-sm opacity-80">Activity</div>
              </div>
            </div>

            <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm rounded-xl p-4">
              <div className="text-white">
                <div className="text-2xl font-bold">
                  {filteredTeams?.length || teamHats?.length || '12'}
                </div>
                <div className="text-sm opacity-80">Active Teams</div>
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
