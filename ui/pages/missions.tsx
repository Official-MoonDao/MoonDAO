import JBV4ControllerABI from 'const/abis/JBV4Controller.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import TeamABI from 'const/abis/Team.json'
import {
  DEFAULT_CHAIN_V5,
  JBV4_CONTROLLER_ADDRESSES,
  MISSION_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
import { blockedMissions } from 'const/whitelist'
import { GetStaticProps } from 'next'
import Image from 'next/image'
import { useRouter } from 'next/router'
import React, { useState, useEffect, useCallback, useContext } from 'react'
import { getContract, readContract } from 'thirdweb'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import CardGridContainer from '@/components/layout/CardGridContainer'
import CardSkeleton from '@/components/layout/CardSkeleton'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import Search from '@/components/layout/Search'
import StandardButtonPlus from '@/components/layout/StandardButtonPlus'
import MissionCard, { Mission } from '@/components/mission/MissionCard'

type MissionsProps = {
  missions: Mission[]
}

export default function Missions({ missions }: MissionsProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const router = useRouter()
  const shallowQueryRoute = useShallowQueryRoute()

  //Contracts
  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
    chain: selectedChain,
  })

  const [input, setInput] = useState('')
  function filterBySearch(missions: Mission[]) {
    return missions.filter((mission) => {
      return mission.metadata.name
        ?.toString()
        .toLowerCase()
        .includes(input.toLowerCase())
    })
  }

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPageIdx(newPage)
      shallowQueryRoute({ page: newPage.toString() })
    },
    [shallowQueryRoute]
  )

  const [maxPage, setMaxPage] = useState(1)

  useEffect(() => {
    const totalMissions =
      input != '' ? filterBySearch(missions).length : missions.length

    setMaxPage(Math.ceil(totalMissions / 9))
  }, [input, missions])

  const [cachedMissions, setCachedMissions] = useState<Mission[]>([])

  const [pageIdx, setPageIdx] = useState(1)

  useEffect(() => {
    const { page: urlPage } = router.query
    if (urlPage && !isNaN(Number(urlPage))) {
      setPageIdx(Number(urlPage))
    }
  }, [router.query])

  useEffect(() => {
    setCachedMissions(input != '' ? filterBySearch(missions) : missions)
  }, [input, missions, router.query])

  useChainDefault()

  const description = (
    <div className="pt-2">
      <p>Discover MoonDAO Missions.</p>
    </div>
  )

  const descriptionSection = (
    <div className="pt-2">
      <div className="mb-4">{description}</div>

      <Frame bottomLeft="20px" topLeft="5vmax" marginBottom="10px" noPadding>
        <Search input={input} setInput={setInput} />
      </Frame>
      <StandardButtonPlus
        className="gradient-2 rounded-full"
        hoverEffect={false}
        link="/launch"
      >
        Launch a Mission
      </StandardButtonPlus>

      <div className="w-full flex gap-4">
        <div
          id="filter-container"
          className="max-w-[350px] border-b-5 border-black"
        >
          {/* <Frame noPadding>
            <div className="flex flex-wrap text-sm bg-filter">
              <Tab
                tab="active"
                currentTab={tab}
                setTab={handleTabChange}
                icon="/../.././assets/icon-org.svg"
              >
                Active
              </Tab>
              <Tab
                tab="inactive"
                currentTab={tab}
                setTab={handleTabChange}
                icon="/../.././assets/icon-passport.svg"
              >
                Past
              </Tab>
            </div>
          </Frame> */}
        </div>
      </div>
    </div>
  )

  return (
    <section id="missions-container" className="overflow-hidden">
      <Head
        title={'Missions'}
        description={description}
        image="https://ipfs.io/ipfs/QmbExwDgVoDYpThFaVRRxUkusHnXxMj3Go8DdWrXg1phxi"
      />
      <Container>
        <ContentLayout
          header="Missions"
          headerSize="max(20px, 3vw)"
          description={descriptionSection}
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <>
            <CardGridContainer maxCols={3}>
              {cachedMissions?.[0] ? (
                cachedMissions
                  ?.slice((pageIdx - 1) * 9, pageIdx * 9)
                  .map((mission: any, I: number) => {
                    return (
                      <MissionCard
                        key={`mission-card-${I}`}
                        mission={mission}
                        teamContract={teamContract}
                      />
                    )
                  })
              ) : (
                <>
                  {Array.from({ length: 9 }).map((_, i) => (
                    <CardSkeleton key={`card-skeleton-${i}`} />
                  ))}
                </>
              )}
            </CardGridContainer>
            <Frame noPadding marginBottom="0px">
              <div
                id="pagination-container"
                className="w-full mb-5 flex font-GoodTimes text-2xl flex-row justify-center items-center lg:space-x-8"
              >
                <button
                  onClick={() => {
                    if (pageIdx > 1) {
                      handlePageChange(pageIdx - 1)
                    }
                  }}
                  className={`pagination-button ${
                    pageIdx === 1 ? 'opacity-10' : 'cursor-pointer opacity-100'
                  }`}
                  disabled={pageIdx === 1}
                >
                  <Image
                    src="/../.././assets/icon-left.svg"
                    alt="Left Arrow"
                    width={35}
                    height={35}
                  />
                </button>
                <p id="page-number" className="px-5 font-bold">
                  Page {pageIdx} of {maxPage}
                </p>
                <button
                  onClick={() => {
                    if (pageIdx < maxPage) {
                      handlePageChange(pageIdx + 1)
                    }
                  }}
                  className={`pagination-button ${
                    pageIdx === maxPage
                      ? 'opacity-10'
                      : 'cursor-pointer opacity-100'
                  }`}
                  disabled={pageIdx === maxPage}
                >
                  <Image
                    src="/../.././assets/icon-right.svg"
                    alt="Right Arrow"
                    width={35}
                    height={35}
                  />
                </button>
              </div>
            </Frame>
          </>
        </ContentLayout>
      </Container>
    </section>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)

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

  const statement = `SELECT * FROM ${missionTableName}`

  const missionRows = await queryTable(chain, statement)

  const filteredMissionRows = missionRows.filter((mission) => {
    return !blockedMissions.includes(mission.id)
  })

  const jbV4ControllerContract = getContract({
    client: serverClient,
    address: JBV4_CONTROLLER_ADDRESSES[chainSlug],
    abi: JBV4ControllerABI as any,
    chain: chain,
  })

  const missions = await Promise.all(
    filteredMissionRows.map(async (missionRow) => {
      const metadataURI = await readContract({
        contract: jbV4ControllerContract,
        method: 'uriOf' as string,
        params: [missionRow.projectId],
      })

      const metadataRes = await fetch(
        `https://ipfs.io/ipfs/${metadataURI.replace('ipfs://', '')}`
      )
      const metadata = await metadataRes.json()

      return {
        id: missionRow.id,
        teamId: missionRow.teamId,
        projectId: missionRow.projectId,
        metadata: metadata,
      }
    })
  )

  return {
    props: {
      missions,
    },
    revalidate: 60,
  }
}
