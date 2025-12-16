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
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useWindowSize } from 'react-use'
import { ChatBubbleLeftIcon } from '@heroicons/react/24/outline'
import { getContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import useJBProjectTimeline from '@/lib/juicebox/useJBProjectTimeline'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import { useDeadlineTracking } from '@/lib/mission/useDeadlineTracking'
import { useManagerActions } from '@/lib/mission/useManagerActions'
import useMissionData from '@/lib/mission/useMissionData'
import { useOnrampFlow } from '@/lib/mission/useOnrampFlow'
import { arbitrum, base, ethereum, optimismSepolia, sepolia } from '@/lib/rpc/chains'
import { useTeamData } from '@/lib/team/useTeamData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import { useElementVisibility } from '@/lib/utils/hooks/useElementVisibility'
import { getAttribute } from '@/lib/utils/nft'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayoutMission'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
import Head from '@/components/layout/Head'
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
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import TeamMembers from '@/components/subscription/TeamMembers'
import { TwitterIcon } from '@/components/assets'
import JuiceboxLogoWhite from '../assets/JuiceboxLogoWhite'

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
  _deadline: number | undefined
  _refundPeriod: number | undefined
  _primaryTerminalAddress: string
  _token?: any
  _teamNFT?: any
  _teamHats?: any[]
  _fundingGoal: number
  _ruleset: any[]
  _backers: any[]
  _citizens: any[]
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
  _backers,
  _citizens,
}: MissionProfileProps) {
  const account = useActiveAccount()
  const router = useRouter()
  const { selectedChain } = useContext(ChainContextV5)

  const payRedeemContainerRef = useRef<HTMLDivElement>(null)

  const [isMounted, setIsMounted] = useState(false)

  const { width: windowWidth } = useWindowSize()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const isTestnet = process.env.NEXT_PUBLIC_CHAIN !== 'mainnet'
  const chains = useMemo(
    () => (isTestnet ? [sepolia, optimismSepolia] : [arbitrum, base, ethereum]),
    [isTestnet]
  )
  const chainSlugs = chains.map((chain) => getChainSlug(chain))

  const chainSlug = getChainSlug(selectedChain)

  const [teamNFT, setTeamNFT] = useState<any>(_teamNFT)
  const [missionMetadataModalEnabled, setMissionMetadataModalEnabled] = useState(false)
  const [deployTokenModalEnabled, setDeployTokenModalEnabled] = useState(false)

  // Use custom hooks for extracted logic
  const {
    onrampJWTPayload,
    usdInput,
    setUsdInput,
    contributeModalEnabled,
    setContributeModalEnabled,
  } = useOnrampFlow(mission, router, chainSlugs)

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
    chain: selectedChain,
  })

  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
    chain: selectedChain,
  })

  const citizenContract = useContract({
    address: CITIZEN_ADDRESSES[chainSlug],
    abi: CitizenABI as any,
    chain: selectedChain,
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
    refreshBackers,
    backers,
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
    _backers,
  })

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
        backers={backers}
        deadline={deadline}
        duration={duration}
        deadlinePassed={deadlinePassed}
        refundPeriodPassed={refundPeriodPassed}
        stage={stage}
        poolDeployerAddress={poolDeployerAddress}
        isManager={isManager}
        availableTokens={availableTokens}
        availablePayouts={availablePayouts}
        sendReservedTokens={sendReservedTokens}
        sendPayouts={sendPayouts}
        deployLiquidityPool={deployLiquidityPool}
        totalFunding={totalFunding}
        isLoadingTotalFunding={isLoadingTotalFunding}
        setMissionMetadataModalEnabled={setMissionMetadataModalEnabled}
        setDeployTokenModalEnabled={setDeployTokenModalEnabled}
        token={token}
        contributeButton={
          !deadlinePassed && (
            <MissionPayRedeem
              mission={mission}
              teamNFT={teamNFT}
              token={token}
              stage={stage}
              deadline={deadline || 0}
              primaryTerminalAddress={primaryTerminalAddress}
              jbControllerContract={jbControllerContract}
              jbTokensContract={jbTokensContract}
              refreshBackers={refreshBackers}
              backers={backers}
              refreshTotalFunding={refreshTotalFunding}
              ruleset={ruleset}
              onOpenModal={() => {
                setContributeModalEnabled(true)
              }}
              usdInput={usdInput || ''}
              setUsdInput={setUsdInput}
              onlyButton
              visibleButton={windowWidth > 0 && windowWidth > 768}
              buttonClassName="max-h-1/2 w-full  rounded-full text-sm flex justify-center items-center"
            />
          )
        }
      />

      <Container containerwidth={true}>
        <Head
          title={mission?.metadata?.name}
          image={mission?.metadata?.logoUri}
          description={mission?.metadata?.tagline}
        />
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
            refreshBackers={refreshBackers}
            backers={backers}
            refreshTotalFunding={refreshTotalFunding}
            ruleset={ruleset}
            onOpenModal={() => {
              setContributeModalEnabled(true)
            }}
            usdInput={usdInput || ''}
            setUsdInput={setUsdInput}
            isPayRedeemContainerVisible={isPayRedeemContainerVisible}
            deadlinePassed={deadlinePassed}
          />
          <div
            id="page-container"
            className="bg-[#090d21] animate-fadeIn flex flex-col items-center gap-5 w-full"
          >
            <div
              ref={payRedeemContainerRef} // Add ref to the full component container
              className="flex z-20 xl:hidden w-full px-[5vw]"
            >
              {primaryTerminalAddress &&
              primaryTerminalAddress !== '0x0000000000000000000000000000000000000000' ? (
                <div
                  id="mission-pay-redeem-container"
                  className="xl:bg-darkest-cool lg:max-w-[650px] mt-[5vw] md:mt-0 xl:mt-[2vw] w-full xl:rounded-tl-[2vmax] rounded-[2vmax] xl:pr-0 overflow-hidden xl:rounded-bl-[5vmax]"
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
                    refreshBackers={refreshBackers}
                    backers={backers}
                    refreshTotalFunding={refreshTotalFunding}
                    ruleset={ruleset}
                    onOpenModal={() => {
                      setContributeModalEnabled(true)
                    }}
                    usdInput={usdInput || ''}
                    setUsdInput={setUsdInput}
                  />
                </div>
              ) : (
                <div className="p-4 text-center">
                  <p>Loading payment terminal...</p>
                </div>
              )}
            </div>
            {/* Project Overview */}
            <div className="px-[5vw] w-full flex items-center justify-center">
              <div className="z-50 w-[100%] md:pb-[2vw] md:pr-0 overflow-hidden xl:px-[2vw] max-w-[1200px] xl:min-w-[1200px] xl:bg-gradient-to-r from-[#020617] to-[#090d21] to-90% rounded-[2vw]">
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
                  refreshBackers={refreshBackers}
                  backers={backers}
                  citizens={_citizens}
                  refreshStage={refreshStage}
                  refreshTotalFunding={refreshTotalFunding}
                  deadline={deadline}
                  setContributeModalEnabled={setContributeModalEnabled}
                  usdInput={usdInput || ''}
                  setUsdInput={setUsdInput}
                />
              </div>
            </div>
            <div className="w-full px-[5vw] flex justify-center">
              <div className="w-full bg-gradient-to-r from-darkest-cool to-dark-cool max-w-[1200px] rounded-[5vw] md:rounded-[2vw] px-0 pb-[5vw] md:pb-[2vw]">
                <div className="ml-[5vw] md:ml-[2vw] mt-[2vw] flex justify-between w-full gap-2 text-light-cool">
                  <div className="flex items-center gap-2 w-full">
                    <Image
                      src={'/assets/icon-star-blue.svg'}
                      alt="Job icon"
                      width={30}
                      height={30}
                    />
                    <h2 className="text-2xl 2xl:text-4xl font-GoodTimes text-moon-indigo">
                      Meet the Team
                    </h2>
                  </div>
                  <div className="flex justify-end gap-2 w-full text-white mr-[5vw]">
                    <div className="flex gap-2 justify-start justify-end">
                      {teamSocials.communications && (
                        <Link
                          className="flex gap-2 hover:scale-105 transition-all duration-200"
                          href={teamSocials.communications}
                          target="_blank"
                          passHref
                        >
                          <ChatBubbleLeftIcon height={25} width={25} />
                        </Link>
                      )}
                      {teamSocials.twitter && (
                        <Link
                          className="flex gap-2 hover:scale-105 transition-all duration-200"
                          href={teamSocials.twitter}
                          target="_blank"
                          passHref
                        >
                          <TwitterIcon />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
                <SlidingCardMenu>
                  <div className="flex gap-4"></div>
                  {teamHats?.[0]?.id && (
                    <TeamMembers
                      hats={teamHats}
                      hatsContract={hatsContract}
                      citizenContract={citizenContract}
                    />
                  )}
                </SlidingCardMenu>
              </div>
            </div>
            <div className="w-full px-[5vw] pb-[5vw] md:pb-[2vw] flex justify-center">
              <div className="w-full bg-gradient-to-r from-darkest-cool to-dark-cool max-w-[1200px] rounded-[5vw] md:rounded-[2vw] px-0 py-4">
                <div className="flex items-center relative rounded-tl-[20px] rounded-bl-[5vmax] p-4">
                  <div
                    className="pl-4 pr-8 flex overflow-x-auto overflow-y-hidden"
                    style={{
                      msOverflowStyle: 'none',
                      WebkitOverflowScrolling: 'touch',
                    }}
                  >
                    <Link
                      className="flex flex-col group"
                      href={`https://juicebox.money/v5/arb:${mission?.projectId}`}
                      target="_blank"
                    >
                      <div className="group-hover:scale-[1.05] transition-all duration-200">
                        <JuiceboxLogoWhite />
                      </div>
                      {isManager && (
                        <p className="text-xs opacity-90 uppercase group-hover:scale-105 transition-all duration-200">
                          (Edit Project)
                        </p>
                      )}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ContentLayout>
      </Container>

      {/* Single modal instance for all contribute buttons */}
      <MissionContributeModal
        mission={mission}
        token={token}
        modalEnabled={contributeModalEnabled}
        setModalEnabled={setContributeModalEnabled}
        primaryTerminalAddress={primaryTerminalAddress}
        onrampJWTPayload={onrampJWTPayload}
        jbControllerContract={jbControllerContract}
        refreshBackers={refreshBackers}
        backers={backers}
        refreshTotalFunding={refreshTotalFunding}
        ruleset={ruleset}
        usdInput={usdInput || ''}
        setUsdInput={setUsdInput}
      />
    </>
  )
}
