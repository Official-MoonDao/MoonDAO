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

  const { citizen, isLoading } = useContext(CitizenContext)

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
      <div className="flex flex-col gap-5 mt-24">
        {/* Welcome Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-5">
          {/* Welcome Card */}
          <div className="lg:col-span-2 h-full">
            <Frame
              noPadding
              bottomLeft="20px"
              bottomRight="20px"
              topRight="0px"
              topLeft="10px"
              className="h-full"
            >
              <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 p-6 h-full flex flex-col">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/30">
                    {citizen?.metadata?.image ? (
                      <MediaRenderer
                        client={client}
                        src={citizen.metadata.image}
                        alt={citizen.metadata.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {citizen?.metadata?.name?.[0] || address?.[2] || 'G'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    {address && (
                      <h1 className="text-2xl font-GoodTimes text-white mb-2 flex gap-2">
                        WELCOME,{' '}
                        {isLoading ? (
                          <LoadingSpinner width="w-8" height="h-8" />
                        ) : citizen ? (
                          citizen.metadata.name.toUpperCase()
                        ) : (
                          'GUEST'
                        )}
                      </h1>
                    )}
                    <div className="grid grid-cols-2 gap-4 text-sm text-white/90 mb-4">
                      <div>
                        <span className="text-blue-300">
                          {MOONEYBalance
                            ? Math.round(MOONEYBalance).toLocaleString()
                            : ''}
                        </span>{' '}
                        MOONEY{' '}
                        <span className="text-white/60">
                          ($
                          {MOONEYBalance && mooneyPrice
                            ? (MOONEYBalance * mooneyPrice).toFixed(0)
                            : ''}
                          )
                        </span>
                      </div>

                      <div>
                        <span className="text-purple-300">
                          {walletVP
                            ? Math.round(walletVP).toLocaleString()
                            : ''}
                        </span>{' '}
                        vMOONEY{' '}
                      </div>
                    </div>
                    <div className="flex gap-3 mb-3">
                      <StandardButton
                        className="gradient-2 rounded-full"
                        link="/get-mooney"
                      >
                        Buy $MOONEY
                      </StandardButton>
                      <StandardButton
                        className="gradient-2 rounded-full"
                        link="/lock"
                      >
                        Stake $MOONEY
                      </StandardButton>
                    </div>
                    <div className="flex gap-6 text-xs text-white/70">
                      <span>🗳️ {voteCount} Votes</span>
                      {/* <span>📋 {proposals.length} Proposal</span> */}
                      <span className="flex items-center gap-2">
                        👥{' '}
                        {teamHats?.length !== undefined ? (
                          teamHats.length
                        ) : (
                          <LoadingSpinner width="w-4" height="h-4" />
                        )}{' '}
                        Teams
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Frame>
          </div>

          {/* Weekly Reward Pool */}

          <WeeklyRewardPool />
        </div>

        {/* What's New Section */}
        <div className="px-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-GoodTimes text-white">WHAT'S NEW?</h2>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>Latest Newsletter: Datacenters on the moon?</span>
              <span>Next Townhall: Thursday, June 19th, 2025 @ 3PM EST</span>
              <div className="flex gap-2">
                <StandardButton
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs rounded"
                  link="/news"
                >
                  All News
                </StandardButton>
                <StandardButton
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs rounded"
                  onClick={() => setNewsletterModalOpen(true)}
                >
                  Subscribe
                </StandardButton>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Frame
              noPadding
              bottomLeft="10px"
              bottomRight="10px"
              topRight="0px"
              topLeft="0px"
            >
              <div
                className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 p-4 text-center cursor-pointer transition-all duration-200 hover:scale-105 hover:opacity-80 rounded"
                onClick={openCitizensChart}
                title="Click to view full chart"
              >
                <h3 className="text-sm font-medium text-gray-400 mb-2">
                  Citizens
                </h3>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl font-bold text-white">
                    {citizenSubgraphData?.transfers?.length}
                  </span>
                  <div className="w-24 h-12">
                    <CitizensChart
                      transfers={citizenSubgraphData.transfers}
                      isLoading={false}
                      height={48}
                      compact={true}
                      createdAt={citizenSubgraphData.createdAt}
                    />
                  </div>
                </div>
              </div>
            </Frame>

            <Frame
              noPadding
              bottomLeft="10px"
              bottomRight="10px"
              topRight="0px"
              topLeft="0px"
            >
              <div
                className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 p-4 text-center cursor-pointer transition-all duration-200 hover:scale-105 hover:opacity-80 rounded"
                onClick={openAUMChart}
                title="Click to view full chart"
              >
                <h3 className="text-sm font-medium text-gray-400 mb-2">AUM</h3>
                {aumData &&
                aumData.aumHistory &&
                aumData.aumHistory.length > 0 ? (
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-2xl font-bold text-white">
                      ${aumData.aum.toLocaleString()}
                    </span>
                    <div className="w-24 h-12">
                      <AUMChart
                        compact={true}
                        height={48}
                        days={365}
                        data={aumData.aumHistory}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center mb-2">
                    <span className="text-sm text-gray-400">
                      AUM data unavailable
                    </span>
                  </div>
                )}
              </div>
            </Frame>

            <Frame
              noPadding
              bottomLeft="10px"
              bottomRight="10px"
              topRight="0px"
              topLeft="0px"
            >
              <div
                className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 p-4 text-center cursor-pointer transition-all duration-200 hover:scale-105 hover:opacity-80 rounded"
                onClick={openARRChart}
                title="Click to view full chart"
              >
                <h3 className="text-sm font-medium text-gray-400 mb-2">ARR</h3>
                {arrData ? (
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-2xl font-bold text-white">
                      ~${arrData.currentARR.toLocaleString()}
                    </span>
                    <div className="w-24 h-12">
                      <ARRChart
                        data={arrData.arrHistory || []}
                        compact={true}
                        height={48}
                        isLoading={false}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center mb-2">
                    <span className="text-sm text-gray-400">
                      ARR data unavailable
                    </span>
                  </div>
                )}
              </div>
            </Frame>
          </div>
        </div>

        {/* Launchpad Section */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 py-20 px-12 rounded-2xl shadow-lg border border-gray-200 mx-5">
          <div className="flex items-center justify-between mb-10">
            <div className="flex-1 pr-8">
              <h2 className="text-5xl font-GoodTimes text-gray-900 mb-4">
                LAUNCHPAD
              </h2>
              <p className="text-gray-700 max-w-4xl text-lg leading-relaxed">
                Fund your next mission with MoonDAO. Simple enough for a student
                project, robust enough to handle billion dollar moonshots. Built
                on a proven framework with built-in liquidity mining.
              </p>
            </div>
            <div className="flex gap-4 flex-shrink-0">
              <button className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                Learn More
              </button>
              <button className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                Apply
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Frank To Space */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center gap-6 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                  F
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-GoodTimes text-gray-900 mb-2">
                    FRANK TO SPACE
                  </h3>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm"></div>
                    <span className="text-gray-700 font-medium">
                      Active Campaign
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-gray-900 mb-2">
                    1.2 / 31 ETH
                  </p>
                  <div className="w-28 bg-gray-200 rounded-full h-3 shadow-inner">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full shadow-sm"
                      style={{ width: `${(1.2 / 31) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {Math.round((1.2 / 31) * 100)}% funded
                  </p>
                </div>
              </div>
              <button className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                Buy $FRANK
              </button>
            </div>

            {/* Save The Mice */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center gap-6 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white text-2xl shadow-lg">
                  🐭
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-GoodTimes text-gray-900 mb-2">
                    SAVE THE MICE
                  </h3>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-3 h-3 bg-orange-500 rounded-full shadow-sm"></div>
                    <span className="text-gray-700 font-medium">
                      Refunds Available
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-gray-900 mb-2">
                    1.2 / 31 ETH
                  </p>
                  <div className="w-28 bg-gray-200 rounded-full h-3 shadow-inner">
                    <div
                      className="bg-gradient-to-r from-orange-500 to-red-600 h-3 rounded-full shadow-sm"
                      style={{ width: `${(1.2 / 31) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {Math.round((1.2 / 31) * 100)}% funded
                  </p>
                </div>
              </div>
              <button className="w-full py-4 rounded-xl bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                Get Refund
              </button>
            </div>
          </div>
        </div>

        {/* Contribute Section */}
        <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-violet-900 py-20 px-12 rounded-2xl shadow-2xl relative overflow-hidden mx-5">
          {/* Background decorations */}
          <div className="absolute inset-0">
            <div className="absolute top-10 right-10 w-32 h-32 bg-purple-500 rounded-full opacity-10 blur-xl"></div>
            <div className="absolute bottom-10 left-10 w-40 h-40 bg-blue-500 rounded-full opacity-10 blur-xl"></div>
          </div>

          <div className="relative z-10">
            <div className="mb-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex-1 pr-8">
                  <h2 className="text-5xl font-GoodTimes text-white mb-4">
                    CONTRIBUTE
                  </h2>
                  <p className="text-white/90 max-w-4xl text-lg leading-relaxed">
                    Every week we vote on projects supported by the community.
                    Approved projects are eligible to receive a share from this
                    pool. Each contributor's project may also accommodate
                    contributions to support their mission.
                  </p>
                </div>
                <button className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex-shrink-0">
                  Learn More
                </button>
              </div>

              {/* Quarterly Reward Pool */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mb-10 border border-white/20 shadow-xl">
                <h3 className="text-2xl font-GoodTimes text-white mb-6 text-center">
                  QUARTERLY REWARD POOL
                </h3>
                <div className="flex justify-center items-center gap-12">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-xl">Ξ</span>
                    </div>
                    <div>
                      <span className="text-3xl font-bold text-white">
                        12.32 ETH
                      </span>
                      <p className="text-white/70 text-sm">≈ $41,890 USD</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-xl">M</span>
                    </div>
                    <div>
                      <span className="text-3xl font-bold text-white">
                        8.9m vMOONEY
                      </span>
                      <p className="text-white/70 text-sm">Community Staked</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Proposals Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Left Column - Proposals */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-GoodTimes text-white">
                    PROPOSALS
                  </h3>
                  <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                    See All Proposals
                  </button>
                </div>

                <div className="space-y-4">
                  {proposals &&
                    proposals.slice(0, 3).map((proposal: any, i: number) => (
                      <div
                        key={proposal.proposalId || i}
                        className="bg-white/10 border border-white/20 rounded-xl p-6 hover:bg-white/15 transition-all duration-200 backdrop-blur-sm shadow-lg"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-white font-semibold text-lg">
                            {proposal.title ||
                              `MDP-${
                                179 - i
                              }: Study on Lunar Surface Selection For Settlement`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                          <div className="text-white/80">💰 2.2 ETH</div>
                          <div className="text-white/80">
                            ⏰ {3 + i} days left
                          </div>
                        </div>
                        {i === 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-400 rounded-full shadow-sm"></div>
                            <span className="text-sm text-green-300 font-medium">
                              Active Proposal
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>

                <div className="mt-6">
                  <button className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/30 py-4 rounded-xl font-semibold transition-all duration-200 backdrop-blur-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                    Propose Project
                  </button>
                </div>
              </div>

              {/* Right Column - Quarterly Reward Pool Details */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-GoodTimes text-white">
                    REWARD BREAKDOWN
                  </h3>
                </div>

                <div className="bg-white/10 border border-white/20 rounded-xl p-8 backdrop-blur-sm shadow-lg">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-black/20 border border-white/10 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Image
                          src="/coins/ETH.svg"
                          alt="ETH"
                          width={24}
                          height={24}
                        />
                        <span className="text-white font-semibold text-lg">
                          32.3 ETH
                        </span>
                      </div>
                      <span className="text-white/70">~$123,456</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-black/20 border border-white/10 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Image
                          src="/coins/MOONEY.png"
                          alt="MOONEY"
                          width={24}
                          height={24}
                        />
                        <span className="text-white font-semibold text-lg">
                          8.8m vMOONEY
                        </span>
                      </div>
                      <span className="text-white/70">~$1.1m</span>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-purple-500/20 border border-purple-400/30 rounded-xl">
                    <h4 className="text-white font-semibold mb-2">
                      💡 How it works
                    </h4>
                    <p className="text-white/80 text-sm">
                      Community members propose projects, vote on submissions,
                      and approved projects receive funding from the quarterly
                      pool based on their impact and completion.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Space Acceleration Network Section */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 py-20 px-12 rounded-2xl shadow-lg border border-gray-200 mx-5">
          <div className="mb-12">
            <h2 className="text-5xl font-GoodTimes text-gray-900 text-center mb-4">
              SPACE ACCELERATION NETWORK
            </h2>
            <p className="text-gray-700 text-center max-w-5xl mx-auto text-lg leading-relaxed">
              Connect with leading organizations and projects accelerating
              humanity's journey to becoming a multiplanetary species.
            </p>
          </div>

          {/* Company Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {/* Row 1 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-white font-bold text-2xl">🚀</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-lg">SpaceX</h3>
              <p className="text-gray-600 text-sm">Launch Provider</p>
              <div className="mt-4 w-full h-1 bg-gray-200 rounded-full">
                <div className="w-4/5 h-1 bg-blue-500 rounded-full"></div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-white font-bold text-2xl">🌱</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-lg">
                Blue Origin
              </h3>
              <p className="text-gray-600 text-sm">Space Tourism</p>
              <div className="mt-4 w-full h-1 bg-gray-200 rounded-full">
                <div className="w-3/5 h-1 bg-green-500 rounded-full"></div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-white font-bold text-2xl">🛰️</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-lg">NASA</h3>
              <p className="text-gray-600 text-sm">Space Agency</p>
              <div className="mt-4 w-full h-1 bg-gray-200 rounded-full">
                <div className="w-full h-1 bg-purple-500 rounded-full"></div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-white font-bold text-2xl">🌙</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-lg">
                Lunar Outpost
              </h3>
              <p className="text-gray-600 text-sm">Lunar Infrastructure</p>
              <div className="mt-4 w-full h-1 bg-gray-200 rounded-full">
                <div className="w-2/3 h-1 bg-orange-500 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Bottom Projects */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center gap-6 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-2xl">🎯</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-GoodTimes text-gray-900 mb-1">
                    1kg to the Moon
                  </h3>
                  <p className="text-gray-600 text-lg">
                    Payload delivery mission
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-gray-700 font-medium">
                      Mission Active
                    </span>
                  </div>
                </div>
              </div>
              <button className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                Learn More
              </button>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center gap-6 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-2xl">📋</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-GoodTimes text-gray-900 mb-1">
                    MDP Project
                  </h3>
                  <p className="text-gray-600 text-lg">
                    Moonbeam Development Program
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                    <span className="text-sm text-gray-700 font-medium">
                      In Development
                    </span>
                  </div>
                </div>
              </div>
              <button className="w-full py-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                Learn More
              </button>
            </div>
          </div>

          {/* Stats Section */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-white/50 rounded-xl border border-gray-200">
              <div className="text-3xl font-bold text-gray-900 mb-2">50+</div>
              <div className="text-gray-600">Partner Organizations</div>
            </div>
            <div className="text-center p-6 bg-white/50 rounded-xl border border-gray-200">
              <div className="text-3xl font-bold text-gray-900 mb-2">$2.1B</div>
              <div className="text-gray-600">Total Network Value</div>
            </div>
            <div className="text-center p-6 bg-white/50 rounded-xl border border-gray-200">
              <div className="text-3xl font-bold text-gray-900 mb-2">12</div>
              <div className="text-gray-600">Active Missions</div>
            </div>
          </div>
        </div>

        {/* Citizens and Teams Section */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 py-20 px-12 rounded-2xl shadow-lg border border-gray-200 mx-5">
          <div className="mb-12">
            <h2 className="text-5xl font-GoodTimes text-gray-900 text-center mb-4">
              COMMUNITY
            </h2>
            <p className="text-gray-700 text-center max-w-4xl mx-auto text-lg leading-relaxed">
              Meet the citizens and teams driving MoonDAO's mission forward.
              Join our growing community of space enthusiasts, builders, and
              visionaries.
            </p>
          </div>

          {/* Teams Section */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-GoodTimes text-gray-900">TEAMS</h3>
              <Link
                href="/network?tab=teams"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                See All
              </Link>
            </div>

            <div className="relative">
              <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
                {filteredTeams && filteredTeams.length > 0 ? (
                  filteredTeams.slice(0, 6).map((team: any, index: number) => (
                    <div
                      key={team.id || index}
                      className="flex-shrink-0 w-72 bg-white rounded-2xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                    >
                      <Link href={`/teams/${team.id}`} className="block">
                        <div className="w-full h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                          <span className="text-white font-bold text-2xl">
                            🚀
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-900 mb-2 text-lg">
                          {team.name || 'Unnamed Team'}
                        </h4>
                        <p className="text-gray-600 text-sm mb-3">
                          {team.metadata?.description ||
                            'No description available'}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-gray-700 font-medium">
                            Team #{team.id}
                          </span>
                        </div>
                      </Link>
                    </div>
                  ))
                ) : (
                  // Fallback team cards when no data is available
                  <>
                    {/* Team Card 1 */}
                    <div className="flex-shrink-0 w-72 bg-white rounded-2xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                      <div className="w-full h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                        <span className="text-white font-bold text-2xl">
                          🚀
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-900 mb-2 text-lg">
                        Mission Control
                      </h4>
                      <p className="text-gray-600 text-sm mb-3">
                        Strategic planning and operations
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-gray-700 font-medium">
                          12 Members
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Scroll indicators */}
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white/80 rounded-full p-2 shadow-lg">
              <span className="text-gray-400">→</span>
            </div>
          </div>

          {/* Citizens Section */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-GoodTimes text-gray-900">
                CITIZENS
              </h3>
              <Link
                href="/network?tab=citizens"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                See All
              </Link>
            </div>

            <div className="relative">
              <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
                {newestCitizens && newestCitizens.length > 0
                  ? newestCitizens?.slice(0, 8).map((citizen: any) => {
                      const link = `/citizen/${generatePrettyLinkWithId(
                        citizen.name,
                        citizen.id
                      )}`

                      return (
                        <div
                          key={citizen.id}
                          className="flex-shrink-0 w-60 bg-white rounded-2xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                        >
                          <div className="w-full h-40 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg overflow-hidden">
                            {citizen.image ? (
                              <img
                                src={citizen.image}
                                alt={citizen.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-white font-bold text-3xl">
                                {citizen.name?.[0] || 'C'}
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-gray-900 mb-2 text-lg">
                            {citizen.name || 'Anonymous Citizen'}
                          </h4>
                          <p className="text-gray-600 text-sm mb-4">
                            {citizen.description || 'MoonDAO Citizen'}
                          </p>
                          <Link
                            href={link}
                            className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg font-medium transition-all duration-200 text-center block"
                          >
                            View Profile
                          </Link>
                        </div>
                      )
                    })
                  : Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-shrink-0 w-60 bg-white rounded-2xl p-6 shadow-lg border border-gray-200"
                      >
                        <div className="w-full h-40 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl flex items-center justify-center mb-4">
                          <span className="text-gray-400 text-2xl">👤</span>
                        </div>
                        <h4 className="font-bold text-gray-900 mb-2 text-lg">
                          Citizen Profile
                        </h4>
                        <p className="text-gray-600 text-sm mb-4">
                          Loading citizen data...
                        </p>
                        <div className="w-full py-2 bg-gray-100 text-gray-400 text-sm rounded-lg text-center">
                          Loading...
                        </div>
                      </div>
                    ))}
              </div>

              {/* Scroll indicators */}
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white/80 rounded-full p-2 shadow-lg">
                <span className="text-gray-400">→</span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Map Section */}
        <div className="bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-700 mx-5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-GoodTimes text-white">
              GLOBAL COMMUNITY MAP
            </h3>
            <Link
              href="/map"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              View Full Map
            </Link>
          </div>

          <div className="relative w-full h-[700px] bg-gradient-to-br from-blue-900 to-purple-900 rounded-xl overflow-hidden">
            {/* Earth Globe Component */}
            <div className="absolute inset-0 flex items-center justify-center p-12">
              <div className="w-[500px] h-[500px] max-w-full max-h-full flex items-center justify-center">
                <Earth pointsData={citizensLocationData || []} />
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

          <div className="mt-6 text-center">
            <p className="text-gray-300 mb-4">
              Connected with our global network of space enthusiasts and
              contributors
            </p>
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
