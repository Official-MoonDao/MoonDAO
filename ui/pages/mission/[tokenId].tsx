import CitizenABI from 'const/abis/Citizen.json'
import HatsABI from 'const/abis/Hats.json'
import JBV4ControllerABI from 'const/abis/JBV4Controller.json'
import JBV4DirectoryABI from 'const/abis/JBV4Directory.json'
import JBV4TokenABI from 'const/abis/JBV4Token.json'
import JBV4TokensABI from 'const/abis/JBV4Tokens.json'
import MissionCreatorABI from 'const/abis/MissionCreator.json'
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
  JBV4_TERMINAL_ADDRESSES
} from 'const/config'
import { blockedMissions } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useContext, useEffect, useMemo, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
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
import TeamMembers from '@/components/subscription/TeamMembers'

type ProjectProfileProps = {
  tokenId: string
  mission: Mission
}

export default function MissionProfile({ mission }: ProjectProfileProps) {
  const account = useActiveAccount()

  // const { selectedChain } = useContext(ChainContextV5)
  const selectedChain = sepolia
  const chainSlug = getChainSlug(selectedChain)

  const [teamNFT, setTeamNFT] = useState<any>()

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
  } = useMissionData({
    mission,
    missionTableContract,
    missionCreatorContract,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
  })

  const { adminHatId } = useTeamData(teamContract, hatsContract, teamNFT)

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
      const teamNFT = await getNFT({
        contract: teamContract,
        tokenId: BigInt(mission.teamId),
        includeOwner: true,
      })
      setTeamNFT(teamNFT)
    }
    if (teamContract ?? mission.teamId) {
      getTeamNFT()
    }
  }, [teamContract, mission.teamId])

  useChainDefault()

  const duration = useMemo(() => {
    return formatTimeUntilDeadline(
      new Date(ruleset?.[0]?.start * 1000 + 28 * 24 * 60 * 60 * 1000)
    )
  }, [ruleset])

  //Profile Header Section
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
                    className="pl-[0vw] sm:pl-0 relative w-full h-full md:min-w-[300px] md:min-h-[300px] md:max-w-[300px] md:max-h-[300px]"
                  >
                    <IPFSRenderer
                      src={mission?.metadata?.logoUri}
                      className="pl-[5vw] sm:pl-0 rounded-full rounded-tr-none sm:rounded-tr-full w-full h-full sm:max-w-[350px] sm:max-h-[350px]"
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
                    <div className="flex pb-2 flex-col sm:flex-row items-start ">
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
                              subgraphData?.volume / 1e18,
                              'ETH'
                            )}
                          </span>
                          <span className="text-sm md:text-base">
                            ETH RAISED
                          </span>
                        </div>
                        <p className="font-[Lato] text-sm opacity-60">{`($${Math.round(
                          (subgraphData?.volume / 1e18) * ethPrice
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
                        <div className="ml-2">
                          <p className="text-gray-400 text-sm">CONTRIBUTIONS</p>
                          <p className="text-white font-GoodTimes">
                            {subgraphData?.paymentsCount || 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="w-full">
                      <MissionFundingProgressBar
                        fundingGoal={fundingGoal}
                        volume={subgraphData?.volume / 1e18}
                        stage={stage ?? 0}
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
                          <p className="text-gray-400 text-sm">CONTRIBUTIONS</p>
                          <p className="text-white font-GoodTimes">
                            {subgraphData?.paymentsCount || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
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
              callToActionImage="/assets/logo-san-cropped.svg"
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
}
