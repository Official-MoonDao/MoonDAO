import JBV4ControllerABI from 'const/abis/JBV4Controller.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import {
  DEFAULT_CHAIN_V5,
  JBV4_CONTROLLER_ADDRESSES,
  MISSION_TABLE_ADDRESSES,
} from 'const/config'
import { blockedMissions } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import { useContext, useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

export type Mission = {
  id: number
  teamId: number
  projectId: number
  jb: any
}

type ProjectProfileProps = {
  tokenId: string
  mission: Mission
}

export default function ProjectProfile({
  tokenId,
  mission,
}: ProjectProfileProps) {
  const account = useActiveAccount()

  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  useChainDefault()

  const jbV4ControllerContract = useContract({
    address: JBV4_CONTROLLER_ADDRESSES[chainSlug],
    abi: JBV4ControllerABI as any,
    chain: selectedChain,
  })

  useEffect(() => {
    async function getProjectMetadata() {
      try {
        const metadataURI = await readContract({
          contract: jbV4ControllerContract,
          method: 'uriOf' as string,
          params: [mission.projectId],
        })

        console.log(metadataURI)
      } catch (err) {
        console.error(err)
      }
    }

    if (jbV4ControllerContract && mission) {
      getProjectMetadata()
    }
  }, [jbV4ControllerContract, mission])

  //Profile Header Section
  const ProfileHeader = (
    <div id="orgheader-container">
      <Frame
        noPadding
        bottomRight="0px"
        bottomLeft="0px"
        topLeft="0px"
        topRight="0px"
        className="z-50"
        marginBottom="0px"
      >
        <div id="frame-content-container" className="w-full">
          <div
            id="frame-content"
            className="w-full flex flex-col items-start justify-between"
          >
            <div
              id="profile-description-section"
              className="flex flex-col lg:flex-row items-start lg:items-center gap-4"
            >
              <div id="team-name-container">
                <div id="profile-container">
                  {mission ? (
                    <p
                      id="profile-description-container"
                      className="mb-5 w-full lg:w-[80%]"
                    >
                      {''}
                    </p>
                  ) : (
                    <></>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Frame>
    </div>
  )

  return (
    <Container>
      <Head title={''} description={''} />
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
              <div className="p-5 pb-0 md:p-0 flex flex-col items-start gap-5 pr-12"></div>
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

  const missions = await queryTable(chain, statement)
  const mission = missions?.[0]

  if (!mission || blockedMissions.includes(Number(tokenId))) {
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

  try {
    const metadataURI = await readContract({
      contract: jbV4ControllerContract,
      method: 'uriOf' as string,
      params: [mission.projectId],
    })

    console.log(metadataURI)
  } catch (err) {
    console.log(err)
  }

  return {
    props: {
      mission,
      tokenId,
    },
  }
}
