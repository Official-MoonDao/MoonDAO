import CitizenABI from 'const/abis/Citizen.json'
import HatsABI from 'const/abis/Hats.json'
import JBV5Controller from 'const/abis/JBV5Controller.json'
import JBV5Directory from 'const/abis/JBV5Directory.json'
import JBV5MultiTerminal from 'const/abis/JBV5MultiTerminal.json'
import JBV5Token from 'const/abis/JBV5Token.json'
import JBV5Tokens from 'const/abis/JBV5Tokens.json'
import MissionCreator from 'const/abis/MissionCreator.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import TeamABI from 'const/abis/Team.json'
import {
  CITIZEN_ADDRESSES,
  DEFAULT_CHAIN_V5,
  HATS_ADDRESS,
  JBV5_CONTROLLER_ADDRESS,
  JBV5_DIRECTORY_ADDRESS,
  JBV5_TERMINAL_ADDRESS,
  JBV5_TOKENS_ADDRESS,
  MISSION_CREATOR_ADDRESSES,
  MISSION_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useWindowSize } from 'react-use'
import { ChatBubbleLeftIcon } from '@heroicons/react/24/outline'
import { getContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import useJBProjectTimeline from '@/lib/juicebox/useJBProjectTimeline'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import { useDeadlineTracking } from '@/lib/mission/useDeadlineTracking'
import {
  fetchNativeBalanceWei,
  pickChainWithMaxNativeBalance,
} from '@/lib/mission/contributeModalDefaultChain'
import { useMissionDefaultFundingChain } from '@/lib/mission/useMissionDefaultFundingChain'
import { useManagerActions } from '@/lib/mission/useManagerActions'
import useMissionData from '@/lib/mission/useMissionData'
import { useOnrampFlow } from '@/lib/mission/useOnrampFlow'
import type { LeaderboardEntry } from '@/lib/overview-delegate/leaderboard'
import {
  type Chain,
  arbitrum,
  ethereum,
  optimismSepolia,
  sepolia,
} from '@/lib/rpc/chains'
import { useTeamData } from '@/lib/team/useTeamData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import { useElementVisibility } from '@/lib/utils/hooks/useElementVisibility'
import { getAttribute } from '@/lib/utils/nft'
import Modal from '@/components/layout/Modal'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayoutMission'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
import { Mission } from '@/components/mission/MissionCard'
import MissionContributeModal from '@/components/mission/MissionContributeModal'
import MissionDeployTokenModal from '@/components/mission/MissionDeployTokenModal'
import MissionInfo from '@/components/mission/MissionInfo'
import MissionJuiceboxFooter from '@/components/mission/MissionJuiceboxFooter'
import MissionMetadataModal from '@/components/mission/MissionMetadataModal'
import MissionMobileContributeButton from '@/components/mission/MissionMobileContributeButton'
import MissionPayRedeem from '@/components/mission/MissionPayRedeem'
import MissionProfileHeader from '@/components/mission/MissionProfileHeader'
import MissionTeamSection from '@/components/mission/MissionTeamSection'
import TeamMembers from '@/components/subscription/TeamMembers'
import { TwitterIcon } from '@/components/assets'

const CHAIN = DEFAULT_CHAIN_V5
const CHAIN_SLUG = getChainSlug(CHAIN)

const missionCreatorContract = getContract({
  client: serverClient,
  address: MISSION_CREATOR_ADDRESSES[CHAIN_SLUG],
  abi: MissionCreator.abi as any,
  chain: CHAIN,
})

const jbControllerContract = getContract({
  client: serverClient,
  address: JBV5_CONTROLLER_ADDRESS,
  abi: JBV5Controller.abi as any,
  chain: CHAIN,
})

type MissionProfileProps = {
  mission: Mission
  _stage: number
  _deadline: number | null | undefined
  _refundPeriod: number | null | undefined
  _primaryTerminalAddress: string
  _token?: any
  _teamNFT?: any
  _teamHats?: any[]
  _fundingGoal: number
  _ruleset: any[]
  /** Pre-fetched top entries of the $OVERVIEW leaderboard. Only provided
   *  for the Overview Flight mission (id 4); undefined for other missions. */
  _overviewLeaderboard?: LeaderboardEntry[]
  /** $OVERVIEW total backing the candidate currently sitting at rank 25 on
   *  the leaderboard. `null` when fewer than 25 candidates exist. Only
   *  provided for the Overview Flight mission. Powers the "minimum to enter
   *  the top 25" callout in the Fly with Frank explainer card. */
  _overviewTop25Threshold?: number | null
  /** Total ranked candidates on the $OVERVIEW leaderboard. Used by the Fly
   *  with Frank explainer to show honest empty-state copy when the top 25
   *  isn't filled yet (vs. just claiming "fewer than 25"). */
  _overviewRankedCount?: number
}

export default function MissionProfile({
  mission,
  _stage,
  _deadline,
  _refundPeriod,
  _primaryTerminalAddress,
  _token,
  _teamNFT,
  _teamHats,
  _fundingGoal,
  _ruleset,
  _overviewLeaderboard,
  _overviewTop25Threshold,
  _overviewRankedCount,
}: MissionProfileProps) {
  const account = useActiveAccount()
  const router = useRouter()
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)

  const walletAddress = account?.address

  const payRedeemContainerRef = useRef<HTMLDivElement>(null)

  const [isMounted, setIsMounted] = useState(false)

  const { width: windowWidth } = useWindowSize()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const [payChainGate, setPayChainGate] = useState<{
    target: Chain
    nextUsd?: string
  } | null>(null)
  /** Signals MissionContributeModal to keep pay chain on current app network (user declined richest-chain switch). */
  const stayOnSelectedAppChainForContributeRef = useRef(false)
  const [teamNFT, setTeamNFT] = useState<any>(_teamNFT)
  const [missionMetadataModalEnabled, setMissionMetadataModalEnabled] = useState(false)
  const [deployTokenModalEnabled, setDeployTokenModalEnabled] = useState(false)

  const isTestnet = process.env.NEXT_PUBLIC_CHAIN !== 'mainnet'
  // Keep this list in sync with MissionContributeModal — Base was removed
  // from the supported funding chains (users without ETH on Base were
  // bouncing). Mission funding-chain detection / "switch to richest chain"
  // banners therefore won't suggest Base anymore.
  const chains = useMemo(
    () => (isTestnet ? [sepolia, optimismSepolia] : [arbitrum, ethereum]),
    [isTestnet]
  )
  const chainSlugs = chains.map((chain) => getChainSlug(chain))

  /** Props-based so this hook can run before useMissionData / useContract (stable hook order). */
  const fundingChainCompareEnabled =
    !!walletAddress && mission?.projectId != null && Number(_stage) !== 4

  const { fundingPickReady, recommendedChain, fundingChainBalances } =
    useMissionDefaultFundingChain({
      enabled: fundingChainCompareEnabled,
      address: walletAddress,
      chains,
    })

  const chainSlug = getChainSlug(selectedChain)

  // Use custom hooks for extracted logic
  const {
    usdInput,
    setUsdInput,
    contributeModalEnabled,
    setContributeModalEnabled,
  } = useOnrampFlow(router, chainSlugs)

  /**
   * Contribute: re-fetch balances at click time, pick richest chain. If app network ≠ that chain,
   * show a gate first (no contribute modal) until the user confirms switching the app network.
   */
  const handleOpenContributeModal = useCallback(
    async (nextUsdInput?: string) => {
      if (process.env.NEXT_PUBLIC_TEST_ENV !== 'true') {
        const canResolveRichest =
          !!walletAddress &&
          mission?.projectId != null &&
          Number(_stage) !== 4
        if (canResolveRichest && walletAddress) {
          const entries = await Promise.all(
            chains.map(async (chain) => ({
              chain,
              wei: await fetchNativeBalanceWei(chain, walletAddress),
            }))
          )
          const richest = pickChainWithMaxNativeBalance(entries, chains)
          const target = chains.find((c) => c.id === richest.id) ?? richest
          const skipAlignmentGate = target.id === ethereum.id
          if (target.id !== selectedChain.id && !skipAlignmentGate) {
            setPayChainGate({ target, nextUsd: nextUsdInput })
            return
          }
        }
      }

      if (nextUsdInput !== undefined) {
        setUsdInput(nextUsdInput)
      }
      setContributeModalEnabled(true)
    },
    [
      walletAddress,
      mission?.projectId,
      _stage,
      chains,
      selectedChain.id,
      setUsdInput,
      setContributeModalEnabled,
    ]
  )

  const { isVisible: isPayRedeemContainerVisible } = useElementVisibility(payRedeemContainerRef, {
    visibilityThreshold: 0.75,
    rootMargin: '-100px 0px 0px 0px',
  })

  const {
    totalFunding,
    refetch: refreshTotalFunding,
    isLoading: isLoadingTotalFunding,
  } = useTotalFunding(mission?.projectId)

  const hatsContract = useContract({
    address: HATS_ADDRESS,
    abi: HatsABI,
    chain: CHAIN,
  })

  const teamContract = useContract({
    address: TEAM_ADDRESSES[CHAIN_SLUG],
    abi: TeamABI as any,
    chain: CHAIN,
  })

  const citizenContract = useContract({
    address: CITIZEN_ADDRESSES[CHAIN_SLUG],
    abi: CitizenABI as any,
    chain: CHAIN,
  })

  const jbTerminalContract = useContract({
    address: JBV5_TERMINAL_ADDRESS,
    abi: JBV5MultiTerminal.abi as any,
    chain: selectedChain,
  })

  const jbTokensContract = useContract({
    address: JBV5_TOKENS_ADDRESS,
    abi: JBV5Tokens.abi as any,
    chain: selectedChain,
  })

  const jbDirectoryContract = useContract({
    address: JBV5_DIRECTORY_ADDRESS,
    abi: JBV5Directory.abi as any,
    chain: selectedChain,
  })

  const missionTableContract = useContract({
    address: MISSION_TABLE_ADDRESSES[chainSlug],
    abi: MissionTableABI as any,
    chain: selectedChain,
  })

  const {
    ruleset,
    token,
    subgraphData,
    fundingGoal,
    primaryTerminalAddress,
    stage,
    deadline,
    refundPeriod,
    refreshStage,
    poolDeployerAddress,
  } = useMissionData({
    mission,
    missionTableContract,
    missionCreatorContract,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
    _stage,
    _deadline,
    _refundPeriod,
    _primaryTerminalAddress,
    _token,
    _fundingGoal,
    _ruleset,
  })

  const missionDefaultFundingChainEnabled =
    !!primaryTerminalAddress &&
    primaryTerminalAddress !== '0x0000000000000000000000000000000000000000' &&
    Number(stage) !== 4

  const fundingBannerEnabled =
    fundingChainCompareEnabled || missionDefaultFundingChainEnabled

  // Use deadline tracking hook
  const { duration, deadlinePassed, refundPeriodPassed } = useDeadlineTracking(
    deadline,
    refundPeriod,
    refreshStage
  )

  const { adminHatId, isManager } = useTeamData(teamContract, hatsContract, teamNFT)

  const teamHats = _teamHats || []

  const {
    points,
    isLoading: isLoadingPoints,
    range,
    setRange,
  } = useJBProjectTimeline(
    selectedChain,
    subgraphData?.createdAt,
    subgraphData?.suckerGroupId,
    mission?.projectId
  )

  const missionTokenContract = useContract({
    address: token.tokenAddress,
    abi: JBV5Token as any,
    chain: selectedChain,
  })

  const { data: userMissionTokenBalance, isLoading: userMissionTokenBalanceLoading } = useRead({
    contract: missionTokenContract,
    method: 'balanceOf',
    params: [account?.address],
  })

  const {
    availableTokens,
    availablePayouts,
    sendReservedTokens,
    sendPayouts,
    deployLiquidityPool,
  } = useManagerActions(mission, selectedChain, poolDeployerAddress)

  const teamSocials = useMemo(() => {
    return {
      communications: getAttribute(teamNFT?.metadata?.attributes, 'communications')?.value,
      twitter: getAttribute(teamNFT?.metadata?.attributes, 'twitter')?.value,
      website: getAttribute(teamNFT?.metadata?.attributes, 'website')?.value,
      discord: getAttribute(teamNFT?.metadata?.attributes, 'discord')?.value,
    }
  }, [teamNFT?.metadata?.attributes])

  useEffect(() => {
    async function getTeamNFT() {
      if (mission?.teamId === undefined || !teamContract) return
      const teamNFT = await getNFT({
        contract: teamContract,
        tokenId: BigInt(mission.teamId),
      })
      setTeamNFT({
        ...teamNFT,
        metadata: { ...teamNFT.metadata, id: teamNFT.id.toString() },
      })
    }

    // Only fetch teamNFT if not provided via props
    if (!_teamNFT) {
      getTeamNFT()
    }
  }, [teamContract, mission?.teamId, _teamNFT])

  return (
    <>
      {/* Mission Metadata Modal */}
      {missionMetadataModalEnabled && (
        <MissionMetadataModal
          mission={mission}
          teamNFT={teamNFT}
          selectedChain={selectedChain}
          setEnabled={setMissionMetadataModalEnabled}
          jbControllerContract={jbControllerContract}
        />
      )}

      {/* Deploy Token Modal */}
      {deployTokenModalEnabled && (
        <MissionDeployTokenModal
          setEnabled={setDeployTokenModalEnabled}
          isTeamSigner={isManager}
          queueSafeTx={() => {}}
          mission={mission}
          chainSlug={chainSlug}
          teamMutlisigAddress=""
          lastSafeTxExecuted={false}
        />
      )}

      {/* Full-width Mission Header outside Container */}
      <MissionProfileHeader
        mission={mission}
        teamNFT={teamNFT}
        ruleset={ruleset}
        fundingGoal={fundingGoal}
        paymentsCount={subgraphData?.paymentsCount || 0}
        deadline={deadline}
        duration={duration}
        deadlinePassed={deadlinePassed}
        refundPeriodPassed={refundPeriodPassed}
        refundPeriod={refundPeriod}
        stage={stage}
        poolDeployerAddress={poolDeployerAddress}
        isManager={isManager}
        availableTokens={availableTokens}
        availablePayouts={availablePayouts}
        sendReservedTokens={sendReservedTokens}
        sendPayouts={sendPayouts}
        deployLiquidityPool={deployLiquidityPool}
        totalFunding={totalFunding}
        subgraphVolume={subgraphData?.volume}
        isLoadingTotalFunding={isLoadingTotalFunding}
        setMissionMetadataModalEnabled={setMissionMetadataModalEnabled}
        setDeployTokenModalEnabled={setDeployTokenModalEnabled}
        token={token}
        contributeButton={
          !deadlinePassed && Number(stage) !== 3 && (
            <MissionPayRedeem
              mission={mission}
              teamNFT={teamNFT}
              token={token}
              stage={stage}
              deadline={deadline || 0}
              primaryTerminalAddress={primaryTerminalAddress}
              jbControllerContract={jbControllerContract}
              jbTokensContract={jbTokensContract}
              refreshTotalFunding={refreshTotalFunding}
              ruleset={ruleset}
              onOpenModal={handleOpenContributeModal}
              usdInput={usdInput || ''}
              setUsdInput={setUsdInput}
              fundingCompareEnabled={fundingChainCompareEnabled}
              fundingPickReady={fundingPickReady}
              fundingChainBalances={fundingChainBalances}
              recommendedFundingChain={recommendedChain}
              onlyButton
              visibleButton={windowWidth > 0 && windowWidth > 768}
              buttonClassName={
                mission?.id === 4 || String(mission?.id) === '4'
                  ? // Overview Mission CTA: prominent but sized to avoid colliding
                    // with the amount-raised text on sm/md or the manager-actions
                    // row below. No hover-scale (keeps the button inside its slot).
                    'w-full sm:w-auto sm:min-w-[200px] sm:max-w-[260px] rounded-full gradient-2 px-5 sm:px-7 py-2.5 sm:py-3 text-sm sm:text-base font-bold uppercase tracking-wide shadow-lg shadow-blue-500/30 ring-1 ring-white/15 hover:brightness-110 hover:shadow-blue-500/50 active:scale-[0.99] transition-all duration-200 flex justify-center items-center'
                  : 'max-h-1/2 w-full  rounded-full text-sm flex justify-center items-center'
              }
            />
          )
        }
      />

      <Container containerwidth={true}>
        <ContentLayout
          header={''}
          headerSize="max(20px, 3vw)"
          description={''}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          preFooter={
            <ExpandedFooter
              callToActionTitle="Join the Network"
              callToActionBody="Be part of the space acceleration network and play a role in establishing a permanent human presence on the moon and beyond!"
              callToActionImage="/assets/SAN-logo-dark.svg"
              callToActionButtonText="Join the Network"
              callToActionButtonLink="/join"
              hasCallToAction={true}
            />
          }
        >
          {/* Fixed contribute button for mobile with fade effect */}
          <MissionMobileContributeButton
            mission={mission}
            teamNFT={teamNFT}
            token={token}
            stage={stage}
            deadline={deadline || 0}
            primaryTerminalAddress={primaryTerminalAddress}
            jbControllerContract={jbControllerContract}
            jbTokensContract={jbTokensContract}
            refreshTotalFunding={refreshTotalFunding}
            ruleset={ruleset}
            onOpenModal={handleOpenContributeModal}
            usdInput={usdInput || ''}
            setUsdInput={setUsdInput}
            fundingCompareEnabled={fundingChainCompareEnabled}
            fundingPickReady={fundingPickReady}
            fundingChainBalances={fundingChainBalances}
            recommendedFundingChain={recommendedChain}
            isPayRedeemContainerVisible={isPayRedeemContainerVisible}
            deadlinePassed={deadlinePassed}
          />
          <div
            id="page-container"
            className="bg-[#090d21] animate-fadeIn flex flex-col items-center w-full"
          >
            {/* Pay/Redeem Panel - mobile only */}
            <div
              ref={payRedeemContainerRef}
              className="flex z-20 lg:hidden w-full justify-center px-5 md:px-8 lg:px-12"
            >
              {primaryTerminalAddress &&
              primaryTerminalAddress !== '0x0000000000000000000000000000000000000000' ? (
                <div
                  id="mission-pay-redeem-container"
                  className="w-full max-w-[1200px] mt-6 md:mt-4 rounded-2xl"
                >
                  <MissionPayRedeem
                    mission={mission}
                    teamNFT={teamNFT}
                    token={token}
                    stage={stage}
                    deadline={deadline || 0}
                    primaryTerminalAddress={primaryTerminalAddress}
                    jbControllerContract={jbControllerContract}
                    jbTokensContract={jbTokensContract}
                    refreshTotalFunding={refreshTotalFunding}
                    ruleset={ruleset}
                    onOpenModal={handleOpenContributeModal}
                    usdInput={usdInput || ''}
                    setUsdInput={setUsdInput}
                    fundingCompareEnabled={fundingChainCompareEnabled}
                    fundingPickReady={fundingPickReady}
                    fundingChainBalances={fundingChainBalances}
                    recommendedFundingChain={recommendedChain}
                    overviewTop25Threshold={
                      mission?.id === 4 || String(mission?.id) === '4'
                        ? _overviewTop25Threshold ?? null
                        : undefined
                    }
                    overviewRankedCount={
                      mission?.id === 4 || String(mission?.id) === '4'
                        ? _overviewRankedCount
                        : undefined
                    }
                    hideRecentContributions
                  />
                </div>
              ) : (
                <div className="p-6 text-center text-gray-400">
                  <p>Loading payment terminal...</p>
                </div>
              )}
            </div>

            {/* Project Overview */}
            <div className="w-full px-5 md:px-8 lg:px-12 flex justify-center mt-6 md:mt-8">
              <div className="w-full max-w-[1200px]">
                <MissionInfo
                  selectedChain={selectedChain}
                  mission={mission}
                  stage={stage}
                  teamNFT={teamNFT}
                  ruleset={ruleset}
                  jbDirectoryContract={jbDirectoryContract}
                  jbTokensContract={jbTokensContract}
                  jbControllerContract={jbControllerContract}
                  points={points}
                  isLoadingPoints={isLoadingPoints}
                  range={range}
                  setRange={setRange}
                  subgraphData={subgraphData}
                  token={token}
                  primaryTerminalAddress={primaryTerminalAddress}
                  refreshStage={refreshStage}
                  refreshTotalFunding={refreshTotalFunding}
                  deadline={deadline}
                  openContributeModal={handleOpenContributeModal}
                  usdInput={usdInput || ''}
                  setUsdInput={setUsdInput}
                  fundingPickReady={fundingPickReady}
                  recommendedChain={recommendedChain}
                  fundingChainBalances={fundingChainBalances}
                  fundingCompareEnabled={fundingChainCompareEnabled}
                  // Only thread the leaderboard through for missions that
                  // actually have one (today: just mission 4). MissionInfo
                  // uses the presence of this array to decide whether to
                  // render the dedicated "Fly with Frank" tab.
                  _overviewLeaderboard={
                    mission?.id === 4 || String(mission?.id) === '4'
                      ? _overviewLeaderboard ?? []
                      : undefined
                  }
                  _overviewTop25Threshold={
                    mission?.id === 4 || String(mission?.id) === '4'
                      ? _overviewTop25Threshold ?? null
                      : undefined
                  }
                  _overviewRankedCount={
                    mission?.id === 4 || String(mission?.id) === '4'
                      ? _overviewRankedCount
                      : undefined
                  }
                />
              </div>
            </div>

            {/* Meet the Team Section */}
            <div className="w-full px-5 md:px-8 lg:px-12 flex justify-center mt-8 md:mt-10">
              <div className="w-full max-w-[1200px] bg-gradient-to-br from-slate-900/80 to-slate-800/40 border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="px-6 md:px-8 pt-6 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <Image
                        src={'/assets/icon-star-blue.svg'}
                        alt="Team icon"
                        width={18}
                        height={18}
                      />
                    </div>
                    <h2 className="text-xl md:text-2xl font-GoodTimes text-white">
                      Meet the Team
                    </h2>
                  </div>
                  <div className="flex items-center gap-3 text-white/70">
                    {teamSocials.communications && (
                      <Link
                        className="hover:text-white transition-colors duration-200 p-1.5 rounded-lg hover:bg-white/5"
                        href={teamSocials.communications}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Team communications"
                        passHref
                      >
                        <ChatBubbleLeftIcon height={20} width={20} />
                      </Link>
                    )}
                    {teamSocials.twitter && (
                      <Link
                        className="hover:text-white transition-colors duration-200 p-1.5 rounded-lg hover:bg-white/5"
                        href={teamSocials.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Team Twitter"
                        passHref
                      >
                        <TwitterIcon />
                      </Link>
                    )}
                  </div>
                </div>
                <div className="px-6 md:px-8 pb-6">
                  {teamHats?.[0]?.id && (
                    <TeamMembers
                      hats={teamHats}
                      hatsContract={hatsContract}
                      citizenContract={citizenContract}
                    />
                  )}
                </div>
              </div>
            </div>
            {/* The Fly with Frank Leaderboard now lives inside MissionInfo
                as a dedicated tab so it surfaces above the fold instead of
                being hidden at the bottom of the page. See MissionInfo's
                `_overviewLeaderboard` prop wiring above. */}
            <MissionJuiceboxFooter
              projectId={mission?.projectId ?? 0}
              isManager={isManager}
            />
          </div>
        </ContentLayout>
      </Container>

      {payChainGate != null && (
        <Modal
          id="mission-pay-chain-alignment-gate"
          setEnabled={(open) => {
            if (!open) setPayChainGate(null)
          }}
          title="Switch app network"
          size="sm"
        >
          <div className="p-6 space-y-4">
            <p className="text-gray-300 text-sm leading-relaxed">
              Your largest mission funding balance is on{' '}
              <span className="font-semibold text-white">
                {(payChainGate.target.name ?? 'network').replace(' One', '')}
              </span>
              , but the app network is set to{' '}
              <span className="font-semibold text-white">
                {(selectedChain.name ?? 'network').replace(' One', '')}
              </span>
              . Switch the app to use that balance, or stay on your current app network and contribute
              from there.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                className="px-4 py-2.5 rounded-lg text-sm text-gray-300 border border-white/15 hover:bg-white/5 sm:order-1"
                onClick={() => setPayChainGate(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2.5 rounded-lg text-sm text-gray-300 border border-white/15 hover:bg-white/5 sm:order-2"
                onClick={() => {
                  const g = payChainGate
                  if (!g) return
                  stayOnSelectedAppChainForContributeRef.current = true
                  if (g.nextUsd !== undefined) {
                    setUsdInput(g.nextUsd)
                  }
                  setPayChainGate(null)
                  setContributeModalEnabled(true)
                }}
              >
                {`Stay on ${(selectedChain.name ?? 'network').replace(' One', '')} and continue`}
              </button>
              <button
                type="button"
                className="px-4 py-2.5 rounded-lg text-sm font-semibold gradient-2 text-white sm:order-3"
                onClick={() => {
                  const g = payChainGate
                  if (!g) return
                  flushSync(() => {
                    setSelectedChain(g.target)
                  })
                  if (g.nextUsd !== undefined) {
                    setUsdInput(g.nextUsd)
                  }
                  setPayChainGate(null)
                  setContributeModalEnabled(true)
                }}
              >
                {`Switch to ${(payChainGate.target.name ?? 'network').replace(' One', '')} and continue`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Single modal instance for all contribute buttons */}
      <MissionContributeModal
        mission={mission}
        token={token}
        modalEnabled={contributeModalEnabled}
        setModalEnabled={setContributeModalEnabled}
        primaryTerminalAddress={primaryTerminalAddress}
        jbControllerContract={jbControllerContract}
        refreshTotalFunding={refreshTotalFunding}
        ruleset={ruleset}
        usdInput={usdInput || ''}
        setUsdInput={setUsdInput}
        fundingChainCompareEnabled={fundingChainCompareEnabled}
        fundingBannerEnabled={fundingBannerEnabled}
        fundingPickReady={fundingPickReady}
        recommendedFundingChain={recommendedChain}
        fundingChainBalances={fundingChainBalances}
        stayOnSelectedAppChainRef={stayOnSelectedAppChainForContributeRef}
      />
    </>
  )
}
