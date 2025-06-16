import CitizenABI from 'const/abis/Citizen.json'
import HatsABI from 'const/abis/Hats.json'
import JBV4ControllerABI from 'const/abis/JBV4Controller.json'
import JBV4DirectoryABI from 'const/abis/JBV4Directory.json'
import JBV4TokenABI from 'const/abis/JBV4Token.json'
import JBV4TokensABI from 'const/abis/JBV4Tokens.json'
import MissionCreatorABI from 'const/abis/MissionCreator.json'
import IJBTerminalStoreABI from 'const/abis/IJBTerminalStore.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import TeamABI from 'const/abis/Team.json'
import JBMultiTerminal from 'const/abis/IJBMultiTerminal.json'
import {
  CITIZEN_ADDRESSES,
  DEFAULT_CHAIN_V5,
  HATS_ADDRESS,
  IPFS_GATEWAY,
  JBV4_CONTROLLER_ADDRESSES,
  JBV4_DIRECTORY_ADDRESSES,
  JBV4_TOKENS_ADDRESSES,
  MISSION_CREATOR_ADDRESSES,
  MISSION_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
  JBV4_TERMINAL_ADDRESSES,
  JB_NATIVE_TOKEN_ADDRESS
} from 'const/config'
import { blockedMissions } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useContext, useEffect, useMemo, useState } from 'react'
import {
  getContract,
  readContract,
  prepareContractCall,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { sepolia } from 'thirdweb/chains'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { useSubHats } from '@/lib/hats/useSubHats'
import JuiceProviders from '@/lib/juicebox/JuiceProviders'
import useJBProjectTimeline from '@/lib/juicebox/useJBProjectTimeline'
import useMissionData from '@/lib/mission/useMissionData'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import queryTable from '@/lib/tableland/queryTable'
import { useTeamData } from '@/lib/team/useTeamData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import { formatTimeUntilDeadline } from '@/lib/utils/dates'
import { truncateTokenValue } from '@/lib/utils/numbers'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayoutMission'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
import Frame from '@/components/layout/Frame'
import Head from '@/components/layout/Head'
import IPFSRenderer from '@/components/layout/IPFSRenderer'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import Tooltip from '@/components/layout/Tooltip'
import { Mission } from '@/components/mission/MissionCard'
import MissionFundingProgressBar from '@/components/mission/MissionFundingProgressBar'
import MissionInfo from '@/components/mission/MissionInfo'
import MissionPayRedeem from '@/components/mission/MissionPayRedeem'
import MissionStat from '@/components/mission/MissionStat'
import StandardButton from '@/components/layout/StandardButton'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import toast from 'react-hot-toast'
import TeamMembers from '@/components/subscription/TeamMembers'

type ProjectProfileProps = {
  tokenId: string
  mission: Mission
}

export default function MissionProfile({ mission }: ProjectProfileProps) {
  const [isLoading, setIsLoading] = useState(false)
  const account = useActiveAccount()

  // const { selectedChain } = useContext(ChainContextV5)
  const selectedChain = sepolia
  const chainSlug = getChainSlug(selectedChain)

  const [teamNFT, setTeamNFT] = useState<any>()

  const [availableTokens, setAvailableTokens] = useState<string>('Loading...')
  const [availablePayouts, setAvailablePayouts] = useState<string>('Loading...')

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

  const jbControllerContract = useContract({
    address: JBV4_CONTROLLER_ADDRESSES[chainSlug],
    abi: JBV4ControllerABI as any,
    chain: selectedChain,
  })

  const jbTerminalContract = useContract({
    address: JBV4_TERMINAL_ADDRESSES[chainSlug],
    abi: JBMultiTerminal.abi as any,
    chain: selectedChain,
  })

  const jbTokensContract = useContract({
    address: JBV4_TOKENS_ADDRESSES[chainSlug],
    abi: JBV4TokensABI as any,
    chain: selectedChain,
  })

  const jbDirectoryContract = useContract({
    address: JBV4_DIRECTORY_ADDRESSES[chainSlug],
    abi: JBV4DirectoryABI as any,
    chain: selectedChain,
  })

  const missionTableContract = useContract({
    address: MISSION_TABLE_ADDRESSES[chainSlug],
    abi: MissionTableABI as any,
    chain: selectedChain,
  })

  const missionCreatorContract = useContract({
    address: MISSION_CREATOR_ADDRESSES[chainSlug],
    abi: MissionCreatorABI as any,
    chain: selectedChain,
  })

  const {
    ruleset,
    token,
    subgraphData,
    fundingGoal,
    primaryTerminalAddress,
    stage,
    backers,
  } = useMissionData({
    mission,
    missionTableContract,
    missionCreatorContract,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
  })

  const { adminHatId, isManager } = useTeamData(teamContract, hatsContract, teamNFT)

  const teamHats = useSubHats(selectedChain, adminHatId)

  const { points, isLoading: isLoadingPoints } = useJBProjectTimeline(
    selectedChain,
    mission?.projectId,
    subgraphData?.createdAt
  )

  const missionTokenContract = useContract({
    address: token.tokenAddress,
    abi: JBV4TokenABI as any,
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

  const { data: ethPrice } = useETHPrice(1, 'ETH_TO_USD')

  useEffect(() => {
    async function getTeamNFT() {
      if (mission?.teamId === undefined || !teamContract) return
      const teamNFT = await getNFT({
        contract: teamContract,
        tokenId: BigInt(mission.teamId),
        includeOwner: true,
      })
      setTeamNFT({
        ...teamNFT,
        metadata: { ...teamNFT.metadata, id: teamNFT.id.toString() },
      })
    }

    getTeamNFT()
  }, [teamContract, mission.teamId])

  useChainDefault()

  const duration = useMemo(() => {
    return formatTimeUntilDeadline(
      new Date(ruleset?.[0]?.start * 1000 + 28 * 24 * 60 * 60 * 1000)
    )
  }, [ruleset])

  const deadlinePassed = useMemo(() => {
    if (!ruleset?.[0]?.start) return false
    const deadline = new Date(ruleset[0].start * 1000 + 28 * 24 * 60 * 60 * 1000)
    return Date.now() > deadline.getTime()
  }, [ruleset])

  useEffect(() => {
    async function fetchAvailableAmounts() {
      if (!jbTerminalContract || mission?.projectId === undefined || mission?.projectId === null) return

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
          abi: IJBTerminalStoreABI.abi as any,
          chain: selectedChain,
        })

        const balance: any = await readContract({
          contract: jbTerminalStoreContract,
          method: 'balanceOf' as string,
          params: [jbTerminalContract.address, mission.projectId, JB_NATIVE_TOKEN_ADDRESS],
        })

        if (balance === 0) {
          setAvailablePayouts('No payouts to send.')
        } else {
          setAvailablePayouts(`${(balance / 1e18).toFixed(4)} ETH`)
        }

        // Get available reserved tokens
        const reservedTokenBalance: any = await readContract({
          contract: jbControllerContract,
          method: 'reservedTokenBalanceOf' as string,
          params: [mission.projectId],
        })

        if (reservedTokenBalance === 0) {
          setAvailableTokens('No tokens to send.')
        } else {
          setAvailableTokens(`${(reservedTokenBalance / 1e18).toFixed(0)} Tokens`)
        }
      } catch (err: any) {
        if (err?.message?.includes('store')) {
          setAvailablePayouts('Contract not accessible.')
        } else if (err?.message?.includes('balance')) {
          setAvailablePayouts('Cannot check ETH balance.')
        } else if (err?.message?.includes('token')) {
          setAvailableTokens('Cannot check token balance.')
        } else {
          setAvailableTokens('No tokens to send.')
          setAvailablePayouts('No payouts to send.')
        }
        console.error('Error fetching available amounts:', err)
      }
    }

    fetchAvailableAmounts()
  }, [jbTerminalContract, jbControllerContract, mission?.projectId])

  const sendReservedTokens = async () => {
    if (!account || !mission?.projectId) return

    try {
      const reservedTokenBalance = await readContract({
        contract: jbControllerContract,
        method: 'currentOfTotalReservedTokens' as string,
        params: [mission.projectId],
      })

      // Determine the balance from the result (it may return a bigint or an array)
      let balance: bigint | undefined
      if (typeof reservedTokenBalance === 'bigint') {
        balance = reservedTokenBalance
      } else if (Array.isArray(reservedTokenBalance)) {
        balance = reservedTokenBalance[0] as bigint
      }

      if (!balance || balance === BigInt(0)) {
        toast.error('No tokens to send.')
        return
      }

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
      const fundingCycleResult = await readContract({
        contract: jbControllerContract,
        method: 'currentFundingCycleOf' as string,
        params: [mission.projectId],
      })

      // Cast the result to an array and extract metadata.
      const fcResult = fundingCycleResult as unknown as readonly unknown[]
      // Assuming metadata is stored at index 1 and it contains a target property.
      const fcMetadata = fcResult[1] as { target: bigint } | undefined

      if (!fcMetadata || fcMetadata.target === BigInt(0)) {
        toast.error("Project didn't reach it's goal")
        return
      }

      const availablePayouts = await readContract({
        contract: jbTerminalContract,
        method: 'balanceOf' as string,
        params: [mission.projectId],
      })

      let payouts: bigint | undefined
      if (typeof availablePayouts === 'bigint') {
        payouts = availablePayouts
      } else if (Array.isArray(availablePayouts)) {
        payouts = availablePayouts[0] as bigint
      }

      if (!payouts || payouts === BigInt(0)) {
        toast.error('No payouts to send.')
        return
      }

      const tx = prepareContractCall({
        contract: jbTerminalContract,
        method: 'sendPayouts' as string,
        params: [mission.projectId],
      })

      await sendAndConfirmTransaction({ transaction: tx, account })
      toast.success('Payouts sent.')
    } catch (err: any) {
      console.error('Payout distribution error:', err)
      toast.error('No payouts to send.')
    }
  }

  const ProfileHeader = (
    <div id="citizenheader-container" className="w-[100vw]">
      <div className="w-full">
        <div id="frame-content-container" className="w-full">
          <div
            id="frame-content"
            className="w-full sm:px-[5vw] flex flex-col lg:flex-row items-start xl:px-0 xl:w-[1200px]"
          >
            <div
              id="profile-description-section"
              className="flex w-full flex-col lg:flex-row items-start lg:items-center"
            >
              {mission?.metadata?.logoUri ? (
                <div className="pr-0 md:pr-[2vw] pb-[5vw] md:pb-[2vw]">
                  <div
                    id="mission-image-container"
                    className="pl-0 relative w-full h-full md:min-w-[300px] md:min-h-[300px] md:max-w-[300px] md:max-h-[300px]"
                  >
                    <IPFSRenderer
                      src={mission?.metadata?.logoUri}
                      className="sm:rounded-full rounded-tr-none sm:rounded-tr-full mt-[-3vw] sm:mt-0 w-[100vw] sm:w-full h-full sm:max-w-[350px] sm:max-h-[350px]"
                      height={576}
                      width={576}
                      alt="Mission Image"
                    />
                    {teamNFT?.metadata?.image && (
                      <div
                        id="team-nft-container"
                        className="absolute bottom-0 lg:right-0 mb-[-5vw] md:mb-[-2vw] mr-[-5vw] md:mr-[-2vw]"
                      >
                        <IPFSRenderer
                          src={teamNFT?.metadata?.image}
                          className="top-[2vw] rounded-full ml-[5vw] sm:ml-0"
                          height={150}
                          width={150}
                          alt="Team Image"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <></>
              )}
              <div className="flex items-start justify-start w-full sm:w-auto">
                <div
                  id="mission-name"
                  className="flex px-[5vw] sm:px-0 w-full flex-col justify-center lg:ml-5 max-w-[650px]"
                >
                  <div
                    id="mission-name-container"
                    className="mt-5 lg:mt-0 flex flex-col w-full items-start justify-start"
                  >
                    {mission ? (
                      <h1 className="max-w-[450px] text-black opacity-[80%] lg:block font-GoodTimes header dark:text-white text-3xl">
                        {mission?.metadata?.name}
                      </h1>
                    ) : (
                      <></>
                    )}
                  </div>
                  <div id="profile-container">
                    {mission?.metadata?.tagline ? (
                      <p
                        id="profile-description-container"
                        className="w-full pr-12 text-gray-300 pb-5"
                      >
                        {mission?.metadata?.tagline || ''}
                      </p>
                    ) : (
                      <></>
                    )}
                  </div>

                  {ruleset && teamNFT?.metadata?.name && (
                    <div className="hidden sm:flex pb-2 flex-col sm:flex-row items-start ">
                      <p className="opacity-60">
                        {`Created on ${new Date(
                          ruleset?.[0]?.start * 1000
                        ).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })} by: `}
                      </p>
                      <Link
                        href={`/team/${generatePrettyLink(
                          teamNFT?.metadata?.name
                        )}`}
                        className="font-GoodTimes text-white underline sm:pl-2"
                      >
                        {teamNFT?.metadata?.name}
                      </Link>
                    </div>
                  )}

                  <div className="max-w-[500px] w-full bg-gradient-to-r from-[#3343A5] to-[#18183F] p-4 rounded-xl">
                    {/* Purple raised amount tag */}
                    <div className="mb-4 flex flex-col sm:flex-row md:items-center md:justify-between">
                      <div className="bg-gradient-to-r from-[#51285C] to-[#6D3F79] text-white font-GoodTimes py-2 px-6 rounded-full inline-flex items-start w-fit flex flex-col">
                        <div className="flex items-center">
                          <Image
                            src="/assets/icon-raised-tokens.svg"
                            alt="Raised"
                            width={24}
                            height={24}
                            className="mr-2"
                          />
                          <span className="mr-2">
                            {truncateTokenValue(
                              subgraphData?.volume / 1e18 || 0,
                              'ETH'
                            )}
                          </span>
                          <span className="text-sm md:text-base">
                            ETH RAISED
                          </span>
                        </div>
                        <p className="font-[Lato] text-sm opacity-60">{`($${Math.round(
                          (subgraphData?.volume / 1e18 || 0) * ethPrice
                        ).toLocaleString()} USD)`}</p>
                      </div>

                      {/* Contributors section - visible on md screens and above */}
                      <div className="hidden sm:flex items-center ml-2 md:mt-0">
                        <Image
                          src="/assets/icon-backers.svg"
                          alt="Backers"
                          width={24}
                          height={24}
                        />
                        <div className="mx-2">
                          <p className="sm:hidden text-gray-400 text-sm">
                            BACKERS
                          </p>
                          <p className="text-white font-GoodTimes">
                            {backers?.length || 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="w-full">
                      <MissionFundingProgressBar
                        fundingGoal={fundingGoal}
                        volume={subgraphData?.volume / 1e18}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-between sm:justify-start">
                      <div className="flex items-center">
                        <Image
                          src="/assets/launchpad/target.svg"
                          alt="Goal"
                          width={24}
                          height={24}
                        />
                        <div className="ml-2">
                          <div className="flex items-center gap-1">
                            <p className="text-gray-400 text-sm">GOAL</p>
                            <Tooltip
                              text={`~ $${Math.round(
                                (fundingGoal / 1e18) * ethPrice
                              ).toLocaleString()} USD`}
                              buttonClassName="scale-75"
                            >
                              ?
                            </Tooltip>
                          </div>
                          <p className="text-white font-GoodTimes">
                            {+(fundingGoal / 1e18).toFixed(3)} ETH
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <Image
                          src="/assets/launchpad/clock.svg"
                          alt="Deadline"
                          width={24}
                          height={24}
                        />
                        <div className="ml-2">
                          <p className="text-gray-400 text-sm">DEADLINE</p>
                          <p className="text-white font-GoodTimes">
                            {duration}
                          </p>
                        </div>
                      </div>

                      {/* Contributors section - visible only on smaller screens */}
                      <div className="flex sm:hidden items-center">
                        <Image
                          src="/assets/icon-backers.svg"
                          alt="Backers"
                          width={24}
                          height={24}
                        />
                        <div className="ml-2">
                          <p className="text-gray-400 text-sm">BACKERS</p>
                          <p className="text-white font-GoodTimes">
                            {backers?.length || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {ruleset && teamNFT?.metadata?.name && (
                    <div className="flex sm:hidden pt-2 flex-col sm:flex-row items-start ">
                      <p className="opacity-60">
                        {`Created on ${new Date(
                          ruleset?.[0]?.start * 1000
                        ).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })} by: `}
                      </p>
                      <Link
                        href={`/team/${generatePrettyLink(
                          teamNFT?.metadata?.name
                        )}`}
                        className="font-GoodTimes text-white underline"
                      >
                        {teamNFT?.metadata?.name}
                      </Link>
                    </div>
                  )}
                    {/* Send payouts and tokens Buttons - only shown to managers */}
                    {account && deadlinePassed && (
                      <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full sm:w-auto sm:absolute sm:right-2 sm:top-[250px]">
                        <PrivyWeb3Button
                          requiredChain={DEFAULT_CHAIN_V5}
                          className="gradient-2 rounded-full noPadding leading-none flex-1 sm:w-[180px]"
                          label={<span className="whitespace-nowrap">Send Tokens</span>}
                          action={sendReservedTokens}
                        />
                        <PrivyWeb3Button
                          requiredChain={DEFAULT_CHAIN_V5}
                          className="gradient-2 rounded-full noPadding leading-none flex-1 sm:w-[180px]"
                          label={<span className="whitespace-nowrap">Send Payouts</span>}
                          action={sendPayouts}
                        />
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <JuiceProviders
      projectId={mission?.projectId}
      selectedChain={selectedChain}
    >
      <Container containerwidth={true}>
        <Head
          title={mission?.metadata?.name}
          description={mission?.metadata?.description}
          image={mission?.metadata?.logoUri}
        />
        <ContentLayout
          header={''}
          headerSize="max(20px, 3vw)"
          description={ProfileHeader}
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
            {/* Youtube Video Section */}
            {mission?.metadata?.youtubeLink &&
              mission?.metadata?.youtubeLink !== '' && (
                <div className="w-full px-[5vw]">
                  <div className="w-full h-full">
                    <iframe
                      src={mission?.metadata?.youtubeLink?.replace(
                        'watch?v=',
                        'embed/'
                      )}
                      width="100%"
                      height="500"
                      allowFullScreen
                      className="rounded-lg"
                    />
                  </div>
                </div>
              )}
            {/* Pay & Redeem Section */}
            <div className="flex z-20 xl:hidden w-full px-[5vw]">
              <div
                id="mission-pay-redeem-container"
                className="xl:bg-darkest-cool lg:max-w-[650px] mt-[5vw] md:mt-0 xl:mt-[2vw] w-full xl:rounded-tl-[2vmax] rounded-[2vmax] xl:pr-0 overflow-hidden xl:rounded-bl-[5vmax]"
              >
                {primaryTerminalAddress &&
                primaryTerminalAddress !==
                  '0x0000000000000000000000000000000000000000' ? (
                  <MissionPayRedeem
                    selectedChain={selectedChain}
                    mission={mission}
                    teamNFT={teamNFT}
                    token={token}
                    fundingGoal={fundingGoal}
                    subgraphData={subgraphData}
                    ruleset={ruleset}
                    stage={stage}
                    primaryTerminalAddress={primaryTerminalAddress}
                    jbControllerContract={jbControllerContract}
                    jbTokensContract={jbTokensContract}
                  />
                ) : (
                  <div className="p-4 text-center">
                    <p>Loading payment terminal...</p>
                  </div>
                )}
              </div>
              <div className="hidden lg:block xl:hidden ml-[-5vw] w-[50%] h-full">
                <Image
                  src="/assets/logo-san-full.svg"
                  className="w-full h-full"
                  alt="Space acceleration network logo"
                  width={200}
                  height={200}
                />
              </div>
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
                  subgraphData={subgraphData}
                  fundingGoal={fundingGoal}
                  token={token}
                  userMissionTokenBalance={userMissionTokenBalance}
                  primaryTerminalAddress={primaryTerminalAddress}
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
                  {teamHats?.[0].id && (
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
    </JuiceProviders>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  try {
    const tokenId: any = params?.tokenId

    const chain = sepolia
    const chainSlug = getChainSlug(chain)

    if (tokenId === undefined) {
      return {
        notFound: true,
      }
    }

    const missionTableContract = getContract({
      client: serverClient,
      address: MISSION_TABLE_ADDRESSES[chainSlug],
      abi: MissionTableABI as any,
      chain: chain,
    })
 
    const missionTableName = await readContract({
      contract: missionTableContract,
      method: 'getTableName' as string,
      params: [],
    })

    const statement = `SELECT * FROM ${missionTableName} WHERE id = ${tokenId}`

    const missionRows = await queryTable(chain, statement)
    const missionRow = missionRows?.[0]

    if (!missionRow || blockedMissions.includes(Number(tokenId))) {
      return {
        notFound: true,
      }
    }

    const jbV4ControllerContract = getContract({
      client: serverClient,
      address: JBV4_CONTROLLER_ADDRESSES[chainSlug],
      abi: JBV4ControllerABI as any,
      chain: chain,
    })

    const metadataURI = await readContract({
      contract: jbV4ControllerContract,
      method: 'uriOf' as string,
      params: [missionRow.projectId],
    })

    const ipfsHash = metadataURI.startsWith('ipfs://')
      ? metadataURI.replace('ipfs://', '')
      : metadataURI

    const metadataRes = await fetch(`${IPFS_GATEWAY}${ipfsHash}`)
    const metadata = await metadataRes.json()

    const mission = {
      id: missionRow.id,
      teamId: missionRow.teamId,
      projectId: missionRow.projectId,
      metadata: metadata,
    }

    return {
      props: {
        mission,
      },
    }
  } catch (error) {
    return {
      notFound: true,
    }
  }
}
