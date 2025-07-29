import CitizenTableABI from 'const/abis/CitizenTable.json'
import JobTableABI from 'const/abis/JobBoardTable.json'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import TeamABI from 'const/abis/Team.json'
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
  VOTING_ESCROW_DEPOSITOR_ADDRESSES,
} from 'const/config'
import Image from 'next/image'
import Link from 'next/link'
import { useContext, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { MediaRenderer, useActiveAccount } from 'thirdweb/react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { getAUMHistory } from '@/lib/coinstats'
import { useAssets } from '@/lib/dashboard/hooks'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import useNewestProposals from '@/lib/nance/useNewestProposals'
import { getAllNetworkTransfers } from '@/lib/network/networkSubgraph'
import { useVoteCountOfAddress } from '@/lib/snapshot'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
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
import { ProposalCard } from '@/components/home/ProposalCard'
import ChartModal from '@/components/layout/ChartModal'
import Container from '@/components/layout/Container'
import Frame from '@/components/layout/Frame'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import StandardButton from '@/components/layout/StandardButton'
import StandardDetailCard from '@/components/layout/StandardDetailCard'
import CitizensChart from '@/components/subscription/CitizensChart'

export default function Home({
  newestNewsletters,
  newestCitizens,
  newestListings,
  newestJobs,
  citizenSubgraphData,
  aumData,
  arrData,
}: any) {
  const selectedChain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(selectedChain)

  const { citizen } = useContext(CitizenContext)

  // Modal state for charts
  const [chartModalOpen, setChartModalOpen] = useState(false)
  const [chartModalComponent, setChartModalComponent] =
    useState<React.ReactNode>(null)
  const [chartModalTitle, setChartModalTitle] = useState('')

  // Chart modal handlers
  const openCitizensChart = () => {
    setChartModalComponent(
      <CitizensChart
        transfers={citizenSubgraphData.transfers}
        isLoading={false}
        height={400}
        compact={false}
        createdAt={citizenSubgraphData.createdAt}
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
  const VMOONEYBalance = useTotalVP(address || '')

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
      <div className="flex flex-col gap-5 mt-24 p-5">
        {/* Welcome Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Welcome Card */}
          <div className="lg:col-span-2">
            <Frame
              noPadding
              bottomLeft="20px"
              bottomRight="20px"
              topRight="0px"
              topLeft="10px"
            >
              <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 p-6">
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
                    <h1 className="text-2xl font-GoodTimes text-white mb-2">
                      WELCOME,{' '}
                      {citizen
                        ? citizen.metadata.name.toUpperCase()
                        : address
                        ? address.slice(0, 6) + '...' + address.slice(-4)
                        : ''}
                    </h1>
                    <div className="grid grid-cols-2 gap-4 text-sm text-white/90 mb-4">
                      <div>
                        <span className="text-blue-300">
                          {MOONEYBalance
                            ? Math.round(MOONEYBalance).toLocaleString()
                            : '12.4m'}
                        </span>{' '}
                        MOONEY{' '}
                        <span className="text-white/60">
                          ($
                          {MOONEYBalance
                            ? (MOONEYBalance * 0.12).toFixed(0)
                            : '12,342'}
                          )
                        </span>
                      </div>
                      <div>
                        <span className="text-purple-300">
                          {VMOONEYBalance
                            ? Math.round(VMOONEYBalance).toLocaleString()
                            : '1.2m'}
                        </span>{' '}
                        vMOONEY{' '}
                        <span className="text-white/60">
                          ($
                          {VMOONEYBalance
                            ? (VMOONEYBalance * 0.12).toFixed(0)
                            : '1,442'}
                          )
                        </span>
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
          <div>
            <Frame
              noPadding
              bottomLeft="20px"
              bottomRight="20px"
              topRight="0px"
              topLeft="10px"
            >
              <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 p-6 h-full">
                <h3 className="text-sm font-GoodTimes text-white/80 mb-2">
                  WEEKLY REWARD POOL
                </h3>
                <div className="mb-4">
                  <p className="text-3xl font-bold text-white mb-1">
                    💎{' '}
                    {withdrawable ? (+withdrawable / 1e18).toFixed(2) : '0.32'}{' '}
                    ETH
                  </p>
                  <p className="text-sm text-white/70">
                    Your Reward:{' '}
                    {withdrawable
                      ? ((+withdrawable / 1e18) * 0.007).toFixed(4)
                      : '0.0023'}{' '}
                    ETH
                  </p>
                </div>
                <button className="w-full py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm rounded-lg font-medium transition-all duration-200">
                  Claim Now
                </button>
                <div className="mt-3 text-center">
                  <Link
                    href="/learn"
                    className="text-xs text-blue-300 hover:text-blue-200"
                  >
                    Learn More
                  </Link>
                </div>
              </div>
            </Frame>
          </div>
        </div>

        {/* What's New Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-GoodTimes text-white">WHAT'S NEW?</h2>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>Latest Newsletter: Datacenters on the moon?</span>
              <span>Next Townhall: Thursday, June 19th, 2025 @ 3PM EST</span>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs rounded">
                  All News
                </button>
                <button className="px-3 py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs rounded">
                  Subscribe
                </button>
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
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-GoodTimes text-white">LAUNCHPAD</h2>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>
                Fund your next mission with MoonDAO. Simple enough for a student
                project, robust enough to handle billion dollar moonshots. Built
                on a proven framework with built-in liquidity mining.
              </span>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs rounded">
                  Learn More
                </button>
                <button className="px-3 py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs rounded">
                  Apply
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Frank To Space */}
            <Frame
              noPadding
              bottomLeft="20px"
              bottomRight="20px"
              topRight="0px"
              topLeft="10px"
            >
              <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20">
                    <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                      F
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-GoodTimes text-white mb-2">
                      FRANK TO SPACE
                    </h3>
                    <button className="px-4 py-1 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm transition-all duration-200 mb-1">
                      Buy $FRANK
                    </button>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-white/60">Active</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white/80 mb-1">1.2 / 31 ETH</p>
                    <div className="w-20 bg-white/20 rounded-full h-1">
                      <div
                        className="bg-blue-400 h-1 rounded-full"
                        style={{ width: `${(1.2 / 31) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Frame>

            {/* Save The Mice */}
            <Frame
              noPadding
              bottomLeft="20px"
              bottomRight="20px"
              topRight="0px"
              topLeft="10px"
            >
              <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20">
                    <div className="w-full h-full bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center text-white font-bold text-xl">
                      🐭
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-GoodTimes text-white mb-2">
                      SAVE THE MICE
                    </h3>
                    <button className="px-4 py-1 rounded-lg bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white text-sm transition-all duration-200 mb-1">
                      Get Refund
                    </button>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                      <span className="text-white/60">Refunds Available</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white/80 mb-1">1.2 / 31 ETH</p>
                    <div className="w-20 bg-white/20 rounded-full h-1">
                      <div
                        className="bg-red-400 h-1 rounded-full"
                        style={{ width: `${(1.2 / 31) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Frame>
          </div>
        </div>

        {/* Contribute Section */}
        <Frame
          noPadding
          bottomLeft="20px"
          bottomRight="20px"
          topRight="0px"
          topLeft="10px"
        >
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-GoodTimes text-white mb-2">
                  CONTRIBUTE
                </h2>
                <p className="text-sm text-white/90 max-w-2xl">
                  Every week we vote on projects supported by the community.
                  Approved projects are eligible to receive a share from this
                  pool. Each contributor's project may also accommodate
                  contributions to support their mission.
                </p>
              </div>
              <button className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition-all duration-200">
                Learn More
              </button>
            </div>
          </div>
        </Frame>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Column - Proposals */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-GoodTimes text-white">PROPOSALS</h2>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs rounded">
                  View all Proposals
                </button>
                <button className="px-3 py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs rounded">
                  View all Proposals
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proposals &&
                proposals
                  .slice(0, 6)
                  .map((proposal: any, i: number) => (
                    <ProposalCard
                      key={proposal.proposalId || i}
                      proposal={proposal}
                      index={i}
                    />
                  ))}
            </div>
          </div>

          {/* Right Column - Quarterly Reward Pool */}
          <div>
            <Frame
              noPadding
              bottomLeft="10px"
              bottomRight="10px"
              topRight="0px"
              topLeft="0px"
            >
              <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 p-5">
                <h3 className="text-lg font-GoodTimes text-white mb-4">
                  QUARTERLY REWARD POOL
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-black/20 border border-white/10 rounded">
                    <div className="flex items-center gap-2">
                      <Image
                        src="/coins/ETH.svg"
                        alt="ETH"
                        width={20}
                        height={20}
                      />
                      <span className="text-white font-medium">32.3 ETH</span>
                    </div>
                    <span className="text-sm text-gray-400">~$123k</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-black/20 border border-white/10 rounded">
                    <div className="flex items-center gap-2">
                      <Image
                        src="/coins/MOONEY.png"
                        alt="MOONEY"
                        width={20}
                        height={20}
                      />
                      <span className="text-white font-medium">
                        8.8m vMOONEY
                      </span>
                    </div>
                    <span className="text-sm text-gray-400">~$1.1m</span>
                  </div>
                </div>
              </div>
            </Frame>
          </div>
        </div>

        {/* Citizens and Teams Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Newest Citizens */}
          <Frame
            noPadding
            bottomLeft="0px"
            bottomRight="0px"
            topRight="0px"
            topLeft="0px"
          >
            <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-GoodTimes text-white">
                  NEWEST CITIZENS
                </h2>
                <Link
                  href="/citizen"
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View All
                </Link>
              </div>

              {newestCitizens && newestCitizens.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
                  {newestCitizens?.slice(0, 4).map((citizen: any) => {
                    const link = `/citizen/${generatePrettyLinkWithId(
                      citizen.name,
                      citizen.id
                    )}`

                    return (
                      <div key={citizen.id} className="w-full">
                        <StandardDetailCard
                          title={citizen.name || 'Anonymous Citizen'}
                          paragraph={citizen.description || 'MoonDAO Citizen'}
                          image={citizen.image}
                          link={link}
                        />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">No citizens found</p>
                </div>
              )}
            </div>
          </Frame>
        </div>

        {/* Chart Modal */}
        <ChartModal
          isOpen={chartModalOpen}
          setIsOpen={setChartModalOpen}
          chartComponent={chartModalComponent}
          chartTitle={chartModalTitle}
        />
      </div>
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

      // Batch all table name reads
      const [citizenTableName, marketplaceTableName, jobTableName] =
        await Promise.all([
          readContract({
            contract: citizenTableContract,
            method: 'getTableName',
          }),
          readContract({
            contract: marketplaceTableContract,
            method: 'getTableName',
          }),
          readContract({ contract: jobTableContract, method: 'getTableName' }),
        ])

      // Batch all table queries
      const [citizens, listings, jobs] = await Promise.all([
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
      ])

      return { citizens, listings, jobs }
    } catch (error) {
      console.error('Contract operations failed:', error)
      return { citizens: [], listings: [], jobs: [] }
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
  const [transferResult, contractResult, aumResult] = await Promise.allSettled([
    allTransferData(),
    contractOperations(),
    getAUMData(),
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
    const { citizens, listings, jobs } = contractResult.value
    newestCitizens = citizens
    newestListings = listings
    newestJobs = jobs
  }

  if (aumResult.status === 'fulfilled') {
    aumData = aumResult.value
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
    },
    revalidate: 300, // Increase cache time to 5 minutes to reduce build frequency
  }
}
