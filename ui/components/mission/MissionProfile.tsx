import CitizenABI from 'const/abis/Citizen.json'
import HatsABI from 'const/abis/Hats.json'
import JBV5MultiTerminal from 'const/abis/JBV5MultiTerminal.json'
import JBV5TerminalStore from 'const/abis/JBV5TerminalStore.json'
import JBV5Controller from 'const/abis/JBV5Controller.json'
import JBV5Directory from 'const/abis/JBV5Directory.json'
import JBV5Token from 'const/abis/JBV5Token.json'
import JBV5Tokens from 'const/abis/JBV5Tokens.json'
import MissionCreator from 'const/abis/MissionCreator.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import PoolDeployerABI from 'const/abis/PoolDeployer.json'
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
  JB_NATIVE_TOKEN_ADDRESS,
  JB_NATIVE_TOKEN_ID,
} from 'const/config'
import Image from 'next/image'
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import toast from 'react-hot-toast'
import {
  getContract,
  readContract,
  prepareContractCall,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import useJBProjectTimeline from '@/lib/juicebox/useJBProjectTimeline'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import useMissionData from '@/lib/mission/useMissionData'
import { useTeamData } from '@/lib/team/useTeamData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client, { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import { formatTimeUntilDeadline } from '@/lib/utils/dates'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayoutMission'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
import Head from '@/components/layout/Head'
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import { Mission } from '@/components/mission/MissionCard'
import MissionInfo from '@/components/mission/MissionInfo'
import MissionPayRedeem from '@/components/mission/MissionPayRedeem'
import MissionProfileHeader from '@/components/mission/MissionProfileHeader'
import TeamMembers from '@/components/subscription/TeamMembers'

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
}: MissionProfileProps) {
  const account = useActiveAccount()

  const selectedChain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(selectedChain)

  const [teamNFT, setTeamNFT] = useState<any>(_teamNFT)
  const [availableTokens, setAvailableTokens] = useState<number>(0)
  const [availablePayouts, setAvailablePayouts] = useState<number>(0)

  const [duration, setDuration] = useState<any>()
  const [deadlinePassed, setDeadlinePassed] = useState(false)
  const [refundPeriodPassed, setRefundPeriodPassed] = useState(false)
  const [hasRefreshedStageAfterDeadline, setHasRefreshedStageAfterDeadline] =
    useState(false)
  const [
    hasRefreshedStageAfterRefundPeriod,
    setHasRefreshedStageAfterRefundPeriod,
  ] = useState(false)

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
    backers,
    stage,
    deadline,
    refundPeriod,
    refreshBackers,
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
  })

  useEffect(() => {
    const interval = setInterval(() => {
      if (deadline !== undefined && deadline !== null && deadline !== 0) {
        const newDuration = formatTimeUntilDeadline(new Date(deadline))
        setDuration(newDuration)

        const isDeadlinePassed = deadline < Date.now()

        // Only update deadlinePassed if it actually changed
        if (isDeadlinePassed) {
          setDeadlinePassed(isDeadlinePassed)
        }

        // If deadline just passed and we haven't refreshed stage yet, do it now
        if (isDeadlinePassed && !hasRefreshedStageAfterDeadline) {
          setTimeout(() => {
            refreshStage?.()
            setHasRefreshedStageAfterDeadline(true)
          }, 3000)
        }

        // Reset the flag if deadline is not passed (in case deadline changes)
        if (!isDeadlinePassed && hasRefreshedStageAfterDeadline) {
          setHasRefreshedStageAfterDeadline(false)
        }

        if (
          refundPeriod !== undefined &&
          refundPeriod !== null &&
          refundPeriod !== 0
        ) {
          const isRefundPeriodPassed = deadline + refundPeriod < Date.now()

          if (isRefundPeriodPassed) {
            setRefundPeriodPassed(isRefundPeriodPassed)
          }

          if (isRefundPeriodPassed && !hasRefreshedStageAfterRefundPeriod) {
            refreshStage?.()
            setHasRefreshedStageAfterRefundPeriod(true)
          }
          if (!isRefundPeriodPassed && hasRefreshedStageAfterRefundPeriod) {
            setHasRefreshedStageAfterRefundPeriod(false)
          }
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [deadline, refundPeriod]) // eslint-disable-line react-hooks/exhaustive-deps

  const { adminHatId, isManager } = useTeamData(
    teamContract,
    hatsContract,
    teamNFT
  )

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

  const {
    data: userMissionTokenBalance,
    isLoading: userMissionTokenBalanceLoading,
  } = useRead({
    contract: missionTokenContract,
    method: 'balanceOf',
    params: [account?.address],
  })

  useEffect(() => {
    async function fetchAvailableAmounts() {
      if (
        !jbTerminalContract ||
        !jbControllerContract ||
        mission?.projectId === undefined ||
        mission?.projectId === null
      )
        return

      try {
        // Get available payouts
        const storeAddress: any = await readContract({
          contract: jbTerminalContract,
          method: 'STORE' as string,
          params: [],
        })
        const jbTerminalStoreContract = getContract({
          client: serverClient,
          address: storeAddress,
          abi: JBV5TerminalStore.abi as any,
          chain: selectedChain,
        })
        const balance: any = await readContract({
          contract: jbTerminalStoreContract,
          method: 'balanceOf' as string,
          params: [
            jbTerminalContract.address,
            mission.projectId,
            JB_NATIVE_TOKEN_ADDRESS,
          ],
        })

        setAvailablePayouts(+balance.toString())

        const reservedTokenBalance: any = await readContract({
          contract: jbControllerContract,
          method: 'pendingReservedTokenBalanceOf' as string,
          params: [mission.projectId],
        })

        setAvailableTokens(+reservedTokenBalance.toString())
      } catch (err: any) {
        console.error('Error fetching available amounts:', err)
      }
    }

    if (jbTerminalContract && jbControllerContract && mission?.projectId) {
      fetchAvailableAmounts()
    }
  }, [
    jbTerminalContract,
    mission?.projectId,
    selectedChain,
    // jbControllerContract omitted - it's a stable module-level reference
  ])

  const sendReservedTokens = async () => {
    if (!account || !mission?.projectId) return

    try {
      const tx = prepareContractCall({
        contract: jbControllerContract,
        method: 'sendReservedTokensToSplitsOf' as string,
        params: [mission.projectId],
      })

      await sendAndConfirmTransaction({ transaction: tx, account })
      toast.success('Tokens sent.')
    } catch (err: any) {
      console.error('Token distribution error:', err)
      toast.error('No tokens to send.')
    }
  }

  const sendPayouts = async () => {
    if (!account || !mission?.projectId) return

    try {
      const storeAddress: any = await readContract({
        contract: jbTerminalContract,
        method: 'STORE' as string,
        params: [],
      })
      const jbTerminalStoreContract = getContract({
        client: serverClient,
        address: storeAddress,
        abi: JBV5TerminalStore.abi as any,
        chain: selectedChain,
      })
      const balance: any = await readContract({
        contract: jbTerminalStoreContract,
        method: 'balanceOf' as string,
        params: [
          jbTerminalContract.address,
          mission.projectId,
          JB_NATIVE_TOKEN_ADDRESS,
        ],
      })
      const tx = prepareContractCall({
        contract: jbTerminalContract,
        method: 'sendPayoutsOf' as string,
        params: [
          mission.projectId,
          JB_NATIVE_TOKEN_ADDRESS,
          balance,
          JB_NATIVE_TOKEN_ID,
          0,
        ],
      })

      await sendAndConfirmTransaction({ transaction: tx, account })
      toast.success('Payouts sent.')
    } catch (err: any) {
      console.error('Payout distribution error:', err)
      toast.error('No payouts to send.')
    }
  }

  const deployLiquidityPool = async () => {
    if (!account || !poolDeployerAddress) return
    const poolDeployerContract = getContract({
      client: serverClient,
      address: poolDeployerAddress,
      abi: PoolDeployerABI as any,
      chain: selectedChain,
    })

    try {
      const tx = prepareContractCall({
        contract: poolDeployerContract,
        method: 'createAndAddLiquidity' as string,
        params: [],
      })

      await sendAndConfirmTransaction({ transaction: tx, account })
      toast.success('Liquidity pool deployed.')
    } catch (err: any) {
      console.error('Liquidity deployment error:', err)
      toast.error('Failed to deploy liquidity pool.')
    }
  }

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

  useChainDefault()

  return (
    <>
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
      />

      <Container containerwidth={true}>
        <Head
          title={mission?.metadata?.name}
          description={mission?.metadata?.description}
          image={mission?.metadata?.logoUri}
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
          <div
            id="page-container"
            className="bg-[#090d21] animate-fadeIn flex flex-col items-center gap-5 w-full"
          >
            <div className="flex z-20 xl:hidden w-full px-[5vw]">
              {primaryTerminalAddress &&
              primaryTerminalAddress !==
                '0x0000000000000000000000000000000000000000' ? (
                <div
                  id="mission-pay-redeem-container"
                  className="xl:bg-darkest-cool lg:max-w-[650px] mt-[5vw] md:mt-0 xl:mt-[2vw] w-full xl:rounded-tl-[2vmax] rounded-[2vmax] xl:pr-0 overflow-hidden xl:rounded-bl-[5vmax]"
                >
                  <MissionPayRedeem
                    mission={mission}
                    teamNFT={teamNFT}
                    token={token}
                    stage={stage}
                    primaryTerminalAddress={primaryTerminalAddress}
                    jbControllerContract={jbControllerContract}
                    jbTokensContract={jbTokensContract}
                    refreshBackers={refreshBackers}
                    refreshTotalFunding={refreshTotalFunding}
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
                  refreshStage={refreshStage}
                  refreshTotalFunding={refreshTotalFunding}
                />
              </div>
            </div>
            <div className="w-full px-[5vw] pb-[5vw] md:pb-[2vw] bg-gradient-to-b from-dark-cool to-darkest-cool flex justify-center">
              <div className="w-full bg-gradient-to-r from-darkest-cool to-dark-cool max-w-[1200px] rounded-[5vw] md:rounded-[2vw] px-0 pb-[5vw] md:pb-[2vw]">
                <div className="ml-[5vw] md:ml-[2vw] mt-[2vw] flex w-full gap-2 text-light-cool">
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
          </div>
        </ContentLayout>
      </Container>
    </>
  )
}
