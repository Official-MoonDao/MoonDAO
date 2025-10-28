import { ChatBubbleLeftIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import CitizenABI from 'const/abis/Citizen.json'
import HatsABI from 'const/abis/Hats.json'
import JBV5Controller from 'const/abis/JBV5Controller.json'
import JBV5Directory from 'const/abis/JBV5Directory.json'
import JBV5MultiTerminal from 'const/abis/JBV5MultiTerminal.json'
import JBV5TerminalStore from 'const/abis/JBV5TerminalStore.json'
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
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import toast from 'react-hot-toast'
import { useWindowSize } from 'react-use'
import {
  getContract,
  readContract,
  prepareContractCall,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import useOnrampJWT, { OnrampJwtPayload } from '@/lib/coinbase/useOnrampJWT'
import useJBProjectTimeline from '@/lib/juicebox/useJBProjectTimeline'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import useMissionData from '@/lib/mission/useMissionData'
import {
  arbitrum,
  base,
  ethereum,
  optimismSepolia,
  sepolia,
} from '@/lib/rpc/chains'
import { useTeamData } from '@/lib/team/useTeamData'
import { getChainSlug, v4SlugToV5Chain } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client, { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import { formatTimeUntilDeadline } from '@/lib/utils/dates'
import { getAttribute } from '@/lib/utils/nft'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayoutMission'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
import Head from '@/components/layout/Head'
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import { Mission } from '@/components/mission/MissionCard'
import MissionContributeModal from '@/components/mission/MissionContributeModal'
import MissionDeployTokenModal from '@/components/mission/MissionDeployTokenModal'
import MissionInfo from '@/components/mission/MissionInfo'
import MissionMetadataModal from '@/components/mission/MissionMetadataModal'
import MissionPayRedeem from '@/components/mission/MissionPayRedeem'
import MissionProfileHeader from '@/components/mission/MissionProfileHeader'
import TeamMembers from '@/components/subscription/TeamMembers'
import { TwitterIcon } from '../assets'
import JuiceboxLogoWhite from '../assets/JuiceboxLogoWhite'
import StandardButton from '../layout/StandardButton'

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
}: MissionProfileProps) {
  const account = useActiveAccount()
  const router = useRouter()
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)

  const fullComponentRef = useRef<HTMLDivElement>(null)

  const [isFullComponentVisible, setIsFullComponentVisible] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  const { width: windowWidth, height: windowHeight } = useWindowSize()

  // Track when component has mounted to avoid hydration issues
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Add Intersection Observer to detect when full component is visible
  useEffect(() => {
    const currentRef = fullComponentRef.current
    console.log('currentRef', currentRef)
    const observer = new IntersectionObserver(
      ([entry]) => {
        // When the full component is more than 20% visible, hide the fixed button
        setIsFullComponentVisible(entry.intersectionRatio > 0.75)
      },
      {
        threshold: [0, 0.2, 0.5, 1.0], // Multiple thresholds for smoother detection
        rootMargin: '-100px 0px 0px 0px', // Adjust when fade starts
      }
    )

    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [fullComponentRef])

  const isTestnet = process.env.NEXT_PUBLIC_CHAIN !== 'mainnet'
  const chains = useMemo(
    () => (isTestnet ? [sepolia, optimismSepolia] : [arbitrum, base, ethereum]),
    [isTestnet]
  )
  const chainSlugs = chains.map((chain) => getChainSlug(chain))

  const chainSlug = getChainSlug(selectedChain)

  const [teamNFT, setTeamNFT] = useState<any>(_teamNFT)
  const [availableTokens, setAvailableTokens] = useState<number>(0)
  const [availablePayouts, setAvailablePayouts] = useState<number>(0)
  const [missionMetadataModalEnabled, setMissionMetadataModalEnabled] =
    useState(false)
  const [contributeModalEnabled, setContributeModalEnabled] = useState(false)
  const [deployTokenModalEnabled, setDeployTokenModalEnabled] = useState(false)
  const [usdInput, setUsdInput] = useState<string>('')
  const hasProcessedOnrampRef = useRef(false)

  const [hasReadInitialChainParam, setHasReadInitialChainParam] =
    useState(false)

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

  const {
    verifyJWT: verifyOnrampJWT,
    clearJWT: clearOnrampJWT,
    getStoredJWT: getStoredOnrampJWT,
  } = useOnrampJWT()

  const [onrampJWTPayload, setOnrampJWTPayload] =
    useState<OnrampJwtPayload | null>(null)

  // Handle onramp success from URL params and chain switching
  useEffect(() => {
    const onrampSuccess = router?.query?.onrampSuccess === 'true'
    const chainToSwitchTo = router?.query?.chain as string | undefined

    // Only process initial chain param once
    if (!hasReadInitialChainParam) {
      if (
        chainToSwitchTo &&
        chainToSwitchTo !== chainSlug &&
        chainSlugs.includes(chainToSwitchTo)
      ) {
        const targetChain = v4SlugToV5Chain(chainToSwitchTo)
        if (targetChain && setSelectedChain) {
          setTimeout(() => {
            setSelectedChain(targetChain)
            setHasReadInitialChainParam(true)
          }, 1000)
        }
      } else {
        // No chain to switch to or already on correct chain, mark as read immediately
        setHasReadInitialChainParam(true)
        if (!chainToSwitchTo) {
          setSelectedChain(DEFAULT_CHAIN_V5)
        }
      }
    }
  }, [
    router?.query?.chain,
    hasReadInitialChainParam,
    chainSlug,
    setSelectedChain,
    chainSlugs,
    router?.query?.onrampSuccess,
  ])

  // Handle post-onramp modal opening
  const handlePostOnrampModal = useCallback(async () => {
    const onrampSuccess = router?.query?.onrampSuccess === 'true'
    const agreedFromUrl = router?.query?.agreed === 'true'
    const usdAmountFromUrl = router?.query?.usdAmount as string | undefined
    if (!onrampSuccess || !agreedFromUrl || !usdAmountFromUrl) return

    try {
      if (hasProcessedOnrampRef.current)
        throw new Error('Already processed onramp')
      if (!router?.isReady) throw new Error('Router not ready')

      // Mark as processed immediately to prevent re-runs
      hasProcessedOnrampRef.current = true

      const storedJWT = getStoredOnrampJWT()
      if (!storedJWT) throw new Error('No stored JWT found')
      const payload = await verifyOnrampJWT(storedJWT, account?.address || '')
      if (
        !payload ||
        !payload.address ||
        !payload.chainSlug ||
        payload.address.toLowerCase() !== account?.address?.toLowerCase() ||
        payload.chainSlug !== chainSlug
      ) {
        throw new Error('Invalid JWT')
      }

      setOnrampJWTPayload(payload)

      setUsdInput(usdAmountFromUrl)
      setContributeModalEnabled(true)
    } catch (error) {
      console.error('Error handling post-onramp modal:', error)
      clearOnrampJWT()
      const { onrampSuccess: _, ...restQuery } = router.query
      router.replace(
        { pathname: router.pathname, query: restQuery },
        undefined,
        {
          shallow: true,
        }
      )
    }
  }, [
    getStoredOnrampJWT,
    verifyOnrampJWT,
    account?.address,
    chainSlug,
    clearOnrampJWT,
    router,
  ])

  useEffect(() => {
    handlePostOnrampModal()
  }, [
    router?.isReady,
    router?.query?.onrampSuccess,
    router?.query?.agreed,
    router?.query?.usdAmount,
    handlePostOnrampModal,
  ])

  // Update URL when chain changes (but only after initial chain param has been read)
  useEffect(() => {
    const urlChain = router?.query?.chain as string | undefined

    // Only update URL if we've read the initial chain param to avoid premature updates
    if (hasReadInitialChainParam && urlChain && urlChain !== chainSlug) {
      router.replace(
        {
          pathname: router.pathname,
          query: {
            ...router.query,
            chain: chainSlug,
          },
        },
        undefined,
        { shallow: true }
      )
    }
  }, [chainSlug, hasReadInitialChainParam, router])

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

  const teamSocials = useMemo(() => {
    return {
      communications: getAttribute(
        teamNFT?.metadata?.attributes,
        'communications'
      )?.value,
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

  // Add Intersection Observer to detect when full component is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // When the full component is more than 20% visible, hide the fixed button
        setIsFullComponentVisible(entry.intersectionRatio > 0.2)
      },
      {
        threshold: [0, 0.2, 0.5, 1.0], // Multiple thresholds for smoother detection
        rootMargin: '-100px 0px 0px 0px', // Adjust this to control when fade starts
      }
    )

    if (fullComponentRef.current) {
      observer.observe(fullComponentRef.current)
    }

    return () => {
      if (fullComponentRef.current) {
        observer.unobserve(fullComponentRef.current)
      }
    }
  }, [])

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
        }
      />

      <Container containerwidth={true}>
        <Head
          title={mission?.metadata?.name}
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
          {/* Fixed contribute button for mobile with fade effect */}
          {isMounted && windowWidth > 0 && windowWidth < 768 && (
            <div className={`fixed bottom-8 transition-opacity duration-300`}>
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
                visibleButton={
                  windowWidth > 0 &&
                  windowWidth < 768 &&
                  !isFullComponentVisible
                }
                buttonMode="fixed"
              />
            </div>
          )}
          <div
            id="page-container"
            className="bg-[#090d21] animate-fadeIn flex flex-col items-center gap-5 w-full"
          >
            <div
              ref={fullComponentRef} // Add ref to the full component container
              className="flex z-20 xl:hidden w-full px-[5vw]"
            >
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
                      {teamSocials.website && (
                        <Link
                          className="flex gap-2 hover:scale-105 transition-all duration-200"
                          href={teamSocials.website}
                          target="_blank"
                          passHref
                        >
                          <GlobeAltIcon height={25} width={25} />
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
