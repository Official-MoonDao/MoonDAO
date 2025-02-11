import { GlobeAltIcon } from '@heroicons/react/20/solid'
import JBV4ControllerABI from 'const/abis/JBV4Controller.json'
import JBV4TokensABI from 'const/abis/JBV4Tokens.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import TeamABI from 'const/abis/Team.json'
import {
  DEFAULT_CHAIN_V5,
  JBV4_CONTROLLER_ADDRESSES,
  JBV4_TOKENS_ADDRESSES,
  MISSION_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
import { blockedMissions } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { MediaRenderer, useActiveAccount } from 'thirdweb/react'
import useJBProjectData from '@/lib/juicebox/useJBProjectData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client, { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { DiscordIcon, TwitterIcon } from '@/components/assets'
import JuiceboxLogoWhite from '@/components/assets/JuiceboxLogoWhite'
import Address from '@/components/layout/Address'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import { Mission } from '@/components/mission/MissionCard'

type ProjectProfileProps = {
  tokenId: string
  mission: Mission
}

export default function MissionProfile({ mission }: ProjectProfileProps) {
  const account = useActiveAccount()

  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const [teamNFT, setTeamNFT] = useState<any>()

  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
    chain: selectedChain,
  })

  const jbV4ControllerContract = useContract({
    address: JBV4_CONTROLLER_ADDRESSES[chainSlug],
    abi: JBV4ControllerABI as any,
    chain: selectedChain,
  })

  const jbTokensContract = useContract({
    address: JBV4_TOKENS_ADDRESSES[chainSlug],
    abi: JBV4TokensABI as any,
    chain: selectedChain,
  })

  const {
    ruleset,
    rulesetMetadata,
    tokenAddress: missionTokenAddress,
  } = useJBProjectData(
    mission?.projectId,
    jbV4ControllerContract,
    jbTokensContract,
    mission?.metadata
  )

  useEffect(() => {
    async function getTeamNFT() {
      const teamNFT = await getNFT({
        contract: teamContract,
        tokenId: BigInt(mission.teamId),
        includeOwner: true,
      })
      setTeamNFT(teamNFT)
    }
    if (teamContract && mission.teamId) {
      getTeamNFT()
    }
  }, [teamContract, mission.teamId])

  useChainDefault()

  //Profile Header Section
  const ProfileHeader = (
    <div id="citizenheader-container">
      <div className="z-50 rounded-tl-[20px] overflow-hidden">
        <div id="frame-content-container" className="w-full">
          <div
            id="frame-content"
            className="w-full flex flex-col lg:flex-row items-start justify-between"
          >
            <div
              id="profile-description-section"
              className="flex w-full flex-col lg:flex-row items-start lg:items-center"
            >
              {mission?.metadata?.logoUri ? (
                <div
                  id="mission-image-container"
                  className="relative w-full max-w-[350px] h-full md:min-w-[300px] md:min-h-[300px] md:max-w-[300px] md:max-h-[300px]"
                >
                  <MediaRenderer
                    client={client}
                    src={mission?.metadata?.logoUri}
                    className="rounded-full"
                    height={'300'}
                    width={'300'}
                  />
                  <div
                    id="star-asset-container"
                    className="absolute bottom-0 lg:right-0"
                  >
                    <Image
                      src="/../.././assets/icon-star.svg"
                      alt=""
                      width={80}
                      height={80}
                    ></Image>
                  </div>
                </div>
              ) : (
                <></>
              )}
              <div id="mission-name-container">
                <div
                  id="mission-name"
                  className="flex mb-2 w-full flex-col justify-center gap-2 lg:ml-5"
                >
                  <div
                    id="mission-name-container"
                    className="mt-5 lg:mt-0 flex flex-col flex-col-reverse w-full items-start justify-start"
                  >
                    {mission ? (
                      <h1 className="max-w-[450px] text-black opacity-[80%] order-2 lg:order-1 lg:block font-GoodTimes header dark:text-white text-3xl">
                        {mission?.metadata?.name}
                      </h1>
                    ) : (
                      <></>
                    )}
                    <div id="profile-container">
                      {mission?.metadata?.description ? (
                        <p
                          id="profile-description-container"
                          className="w-full pr-12"
                        >
                          {mission?.metadata?.description || ''}
                        </p>
                      ) : (
                        <></>
                      )}
                    </div>
                  </div>
                  <div
                    id="interactions-container"
                    className="flex flex-col md:flex-row items-center justify-start lg:pr-10"
                  >
                    {mission?.metadata?.discord ||
                    mission?.metadata?.twitter ||
                    mission?.metadata?.infoUri ? (
                      <div
                        id="socials-container"
                        className="p-1.5 mb-2 mr-2 md:mb-0 px-5 max-w-[160px] gap-5 rounded-bl-[10px] rounded-[2vmax] flex text-sm bg-filter"
                      >
                        {mission?.metadata?.discord &&
                          !mission?.metadata?.discord.includes(
                            '/users/undefined'
                          ) && (
                            <Link
                              className="flex gap-2"
                              href={mission?.metadata?.discord}
                              target="_blank"
                              passHref
                            >
                              <DiscordIcon />
                            </Link>
                          )}
                        {mission?.metadata?.twitter && (
                          <Link
                            className="flex gap-2"
                            href={mission?.metadata?.twitter}
                            target="_blank"
                            passHref
                          >
                            <TwitterIcon />
                          </Link>
                        )}
                        {mission?.metadata?.infoUri && (
                          <Link
                            className="flex gap-2"
                            href={mission?.metadata?.infoUri}
                            target="_blank"
                            passHref
                          >
                            <GlobeAltIcon height={25} width={25} />
                          </Link>
                        )}
                      </div>
                    ) : null}
                    <Link
                      href={`https://sepolia.juicebox.money/v4/p/${mission.projectId}`}
                      target="_blank"
                      passHref
                    >
                      <JuiceboxLogoWhite />
                    </Link>
                  </div>
                </div>
                {teamNFT?.owner ? (
                  <>
                    <div className="mt-4 lg:ml-5">
                      <Address address={teamNFT?.owner} />
                    </div>
                  </>
                ) : (
                  <></>
                )}
                <p className="lg:ml-5 flex items-center gap-2">
                  {`This mission was created by `}
                  <Link
                    className="mt-1 text-light-warm font-GoodTimes hover:underline"
                    href=""
                  >
                    {teamNFT?.metadata.name}
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <Container>
      <Head
        title={mission?.metadata?.name}
        description={mission?.metadata?.description}
      />
      <ContentLayout
        header={''}
        headerSize="max(20px, 3vw)"
        description={ProfileHeader}
        mainPadding
        mode="compact"
        popOverEffect={false}
        isProfile
        preFooter={<NoticeFooter darkBackground={true} />}
      >
        <div
          id="page-container"
          className="animate-fadeIn flex flex-col gap-5 w-full max-w-[1080px]"
        >
          {/* Project Overview */}
          <Frame
            noPadding
            bottomLeft="0px"
            bottomRight="0px"
            topRight="0px"
            topLeft="0px"
          >
            <div
              id="project-overview-container"
              className="w-full md:rounded-tl-[2vmax] md:p-5 md:pr-0 md:pb-14 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section"
            >
              <Frame
                noPadding
                bottomLeft="0px"
                bottomRight="0px"
                topRight="0px"
                topLeft="0px"
              >
                <div className="z-50 w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
                  <div id="vote-title-section" className="flex justify-between">
                    <h2 className="header font-GoodTimes opacity-[50%]">
                      Funding Cycle
                    </h2>
                  </div>
                  <div className="mt-5 flex flex-col gap-5 opacity-60">
                    <p className="">{`Cyle # ${ruleset?.cycleNumber}`}</p>
                    <p className="">{`Start : ${new Date(
                      ruleset?.start * 1000
                    ).toLocaleDateString()}`}</p>
                  </div>
                </div>
              </Frame>
              <Frame
                noPadding
                bottomLeft="0px"
                bottomRight="0px"
                topRight="0px"
                topLeft="0px"
              >
                <div className="z-50 w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
                  <div id="vote-title-section" className="flex justify-between">
                    <h2 className="header font-GoodTimes opacity-[50%]">
                      Token
                    </h2>
                  </div>
                  <div className="mt-5 flex flex-col gap-5 opacity-60">
                    <div>
                      <p className="">{`Token Address : ${missionTokenAddress}`}</p>
                    </div>
                  </div>
                </div>
              </Frame>
            </div>
          </Frame>
        </div>
      </ContentLayout>
    </Container>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const tokenId: any = params?.tokenId

  const chain = DEFAULT_CHAIN_V5
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

  const metadataRes = await fetch(
    `https://ipfs.io/ipfs/${metadataURI.replace('ipfs://', '')}`
  )
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
