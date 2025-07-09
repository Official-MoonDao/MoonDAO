import CitizenABI from 'const/abis/Citizen.json'
import HatsABI from 'const/abis/Hats.json'
import JBMultiTerminal from 'const/abis/IJBMultiTerminal.json'
import IJBTerminalStoreABI from 'const/abis/IJBTerminalStore.json'
import JBV4ControllerABI from 'const/abis/JBV4Controller.json'
import JBV4DirectoryABI from 'const/abis/JBV4Directory.json'
import JBV4TokenABI from 'const/abis/JBV4Token.json'
import JBV4TokensABI from 'const/abis/JBV4Tokens.json'
import LaunchPadPayHookABI from 'const/abis/LaunchPadPayHook.json'
import MissionCreatorABI from 'const/abis/MissionCreatorSep.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import PoolDeployerABI from 'const/abis/PoolDeployer.json'
import TeamABI from 'const/abis/Team.json'
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
  JB_NATIVE_TOKEN_ADDRESS,
  JB_NATIVE_TOKEN_ID,
  MISSION_TABLE_NAMES,
} from 'const/config'
import { blockedMissions } from 'const/whitelist'
import { ethers } from 'ethers'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useContext, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  getContract,
  readContract,
  prepareContractCall,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { useSubHats } from '@/lib/hats/useSubHats'
import JuiceProviders from '@/lib/juicebox/JuiceProviders'
import useJBProjectTimeline from '@/lib/juicebox/useJBProjectTimeline'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import useMissionData from '@/lib/mission/useMissionData'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import queryTable from '@/lib/tableland/queryTable'
import { useTeamData } from '@/lib/team/useTeamData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client, { serverClient } from '@/lib/thirdweb/client'
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
import StandardButton from '@/components/layout/StandardButton'
import Tooltip from '@/components/layout/Tooltip'
import { Mission } from '@/components/mission/MissionCard'
import MissionFundingProgressBar from '@/components/mission/MissionFundingProgressBar'
import MissionInfo from '@/components/mission/MissionInfo'
import MissionPayRedeem from '@/components/mission/MissionPayRedeem'
import MissionProfileHeader from '@/components/mission/MissionProfileHeader'
import MissionStat from '@/components/mission/MissionStat'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import TeamMembers from '@/components/subscription/TeamMembers'

const CHAIN = DEFAULT_CHAIN_V5
const CHAIN_SLUG = getChainSlug(CHAIN)

const jbControllerContract = getContract({
  client: serverClient,
  address: JBV4_CONTROLLER_ADDRESSES[CHAIN_SLUG],
  abi: JBV4ControllerABI as any,
  chain: CHAIN,
})

const missionCreatorContract = getContract({
  client: serverClient,
  address: MISSION_CREATOR_ADDRESSES[CHAIN_SLUG],
  abi: MissionCreatorABI as any,
  chain: CHAIN,
})

const IPFS_GATEWAYS = [
  IPFS_GATEWAY,
  'https://cf-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
]

// Try multiple IPFS gateways with timeout
const fetchFromIPFSWithFallback = async (ipfsHash: string, timeout = 3000) => {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const response = await Promise.race([
        fetch(`${gateway}${ipfsHash}`),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('IPFS fetch timeout')), timeout)
        ),
      ])

      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      console.warn(`Failed to fetch from gateway ${gateway}:`, error)
      continue // Try next gateway
    }
  }

  // All gateways failed, return fallback
  throw new Error('All IPFS gateways failed')
}

type ProjectProfileProps = {
  tokenId: string
  mission: Mission
  stage: number
  deadline: number | undefined
}

export default function MissionProfile({
  mission,
  stage,
  deadline,
}: ProjectProfileProps) {
  const [isLoading, setIsLoading] = useState(false)
  const account = useActiveAccount()

  const selectedChain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(selectedChain)

  const [teamNFT, setTeamNFT] = useState<any>()

  const [availableTokens, setAvailableTokens] = useState<number>(0)
  const [availablePayouts, setAvailablePayouts] = useState<number>(0)

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

  const {
    ruleset,
    token,
    subgraphData,
    fundingGoal,
    primaryTerminalAddress,
    backers,
    refreshBackers,
    poolDeployerAddress,
  } = useMissionData({
    mission,
    missionTableContract,
    missionCreatorContract,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
  })

  const { adminHatId, isManager } = useTeamData(
    teamContract,
    hatsContract,
    teamNFT
  )

  const teamHats = useSubHats(selectedChain, adminHatId, true)

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
          abi: IJBTerminalStoreABI.abi as any,
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

    fetchAvailableAmounts()
  }, [jbTerminalContract, jbControllerContract, mission?.projectId])

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
        abi: IJBTerminalStoreABI.abi as any,
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

  return (
    <JuiceProviders
      projectId={mission?.projectId}
      selectedChain={selectedChain}
    >
      {/* Full-width Mission Header outside Container */}
      <MissionProfileHeader
        mission={mission}
        teamNFT={teamNFT}
        ruleset={ruleset}
        fundingGoal={fundingGoal}
        backers={backers}
        deadline={deadline}
        stage={stage}
        poolDeployerAddress={poolDeployerAddress}
        isManager={isManager}
        availableTokens={availableTokens}
        availablePayouts={availablePayouts}
        sendReservedTokens={sendReservedTokens}
        sendPayouts={sendPayouts}
        deployLiquidityPool={deployLiquidityPool}
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
                    mission={mission}
                    teamNFT={teamNFT}
                    token={token}
                    stage={stage}
                    primaryTerminalAddress={primaryTerminalAddress}
                    jbControllerContract={jbControllerContract}
                    jbTokensContract={jbTokensContract}
                    refreshBackers={refreshBackers}
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
    </JuiceProviders>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  try {
    const tokenId: any = params?.tokenId

    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    if (tokenId === undefined || isNaN(Number(tokenId))) {
      return {
        notFound: true,
      }
    }

    const missionTableName = MISSION_TABLE_NAMES[chainSlug]
    const statement = `SELECT * FROM ${missionTableName} WHERE id = ${tokenId}`

    const missionRows = await queryTable(chain, statement)

    const missionRow = missionRows?.[0]

    if (!missionRow || blockedMissions.includes(Number(tokenId))) {
      return {
        notFound: true,
      }
    }

    const [metadataURI, stage, payHookAddress] = await Promise.all([
      readContract({
        contract: jbControllerContract,
        method: 'uriOf' as string,
        params: [missionRow.projectId],
      }).then((result) => {
        return result
      }),
      readContract({
        contract: missionCreatorContract,
        method: 'stage' as string,
        params: [tokenId],
      }).then((result) => {
        return result
      }),
      readContract({
        contract: missionCreatorContract,
        method: 'missionIdToPayHook' as string,
        params: [tokenId],
      })
        .then((result) => {
          return result
        })
        .catch(() => null), // Don't fail if this fails
    ])

    const ipfsHash = metadataURI.startsWith('ipfs://')
      ? metadataURI.replace('ipfs://', '')
      : metadataURI

    const promises = [
      // IPFS metadata fetch with multiple gateway fallbacks
      fetchFromIPFSWithFallback(ipfsHash).catch((error: any) => {
        console.warn('All IPFS gateways failed:', error)
        return {
          name: 'Mission Loading...',
          description: 'Metadata is loading...',
          logoUri: '',
        }
      }),
    ]

    if (
      payHookAddress &&
      payHookAddress !== '0x0000000000000000000000000000000000000000'
    ) {
      const payHookContract = getContract({
        client: serverClient,
        address: payHookAddress,
        chain: chain,
        abi: LaunchPadPayHookABI.abi as any,
      })

      promises.push(
        readContract({
          contract: payHookContract,
          method: 'deadline' as string,
          params: [],
        })
          .then((dl: any) => +dl.toString() * 1000)
          .catch(() => undefined)
      )
    }

    const [metadata, deadline] = await Promise.all(promises)

    const mission = {
      id: missionRow.id,
      teamId: missionRow.teamId,
      projectId: missionRow.projectId,
      metadata: metadata,
    }

    return {
      props: {
        mission,
        stage: +stage.toString(),
        deadline,
      },
    }
  } catch (error) {
    console.error('getServerSideProps error:', error)
    return {
      notFound: true,
    }
  }
}
