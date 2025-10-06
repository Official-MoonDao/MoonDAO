import JBV5Controller from 'const/abis/JBV5Controller.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import TeamABI from 'const/abis/Team.json'
import {
  DEFAULT_CHAIN_V5,
  JBV5_CONTROLLER_ADDRESS,
  MISSION_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
import { BLOCKED_MISSIONS } from 'const/whitelist'
import { GetStaticProps } from 'next'
import Image from 'next/image'
import { useRouter } from 'next/router'
import React, { useState, useEffect, useCallback, useContext } from 'react'
import { getContract, readContract } from 'thirdweb'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import JuiceProviders from '@/lib/juicebox/JuiceProviders'
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

  const teamContract = useContract({
    chain: selectedChain,
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
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

  return (
    <section id="missions-container" className="overflow-hidden">
      <Head
        title={'Missions'}
        description={'Discover MoonDAO Missions.'}
        image="https://ipfs.io/ipfs/QmbExwDgVoDYpThFaVRRxUkusHnXxMj3Go8DdWrXg1phxi"
      />
      <Container>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <h1 className="text-[max(20px,3vw)] font-bold mb-4">Missions</h1>
            {description}
          </div>

          <div className="mb-8">
            <Frame
              bottomLeft="20px"
              topLeft="5vmax"
              marginBottom="10px"
              noPadding
            >
              <Search
                input={input}
                setInput={setInput}
                placeholder="Search missions..."
              />
            </Frame>
            <div className="flex justify-start mt-4 mb-8">
              <StandardButtonPlus
                className="gradient-2 rounded-full"
                hoverEffect={false}
                link="/launch"
              >
                Launch a Mission!
              </StandardButtonPlus>
            </div>

            <div className="w-full flex justify-center">
              <div
                id="filter-container"
                className="max-w-[350px] border-b-5 border-black"
              ></div>
            </div>
          </div>

          <CardGridContainer maxCols={3}>
            {cachedMissions?.[0] ? (
              cachedMissions
                ?.slice((pageIdx - 1) * 9, pageIdx * 9)
                .map((mission: any, I: number) => {
                  return (
                    <JuiceProviders
                      key={`mission-card-${I}`}
                      projectId={mission.projectId}
                      selectedChain={selectedChain}
                    >
                      <MissionCard
                        key={`mission-card-${I}`}
                        mission={mission}
                        teamContract={teamContract}
                      />
                    </JuiceProviders>
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

          <div className="mt-8">
            <NoticeFooter />
          </div>
        </div>
      </Container>
    </section>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  try {
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
      return !BLOCKED_MISSIONS.has(mission.id)
    })

    const jbV4ControllerContract = getContract({
      client: serverClient,
      address: JBV5_CONTROLLER_ADDRESS,
      abi: JBV5Controller.abi as any,
      chain: chain,
    })

    const missions = await Promise.all(
      filteredMissionRows.map(async (missionRow) => {
        const metadataURI = await readContract({
          contract: jbV4ControllerContract,
          method: 'uriOf' as string,
          params: [missionRow.projectId],
        })

        if (!metadataURI) {
          console.warn(
            `No metadata URI found for project ${missionRow.projectId}`
          )
          return {
            id: missionRow.id,
            teamId: missionRow.teamId,
            projectId: missionRow.projectId,
            metadata: {
              name: 'Unknown Mission',
              description: 'No metadata available',
            },
          }
        }

        const metadataRes = await fetch(getIPFSGateway(metadataURI))
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
  } catch (err: any) {
    console.error(err)
    return {
      props: { missions: [] },
      revalidate: 60,
    }
  }
}
