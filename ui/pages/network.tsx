import { PlusCircleIcon } from '@heroicons/react/20/solid'
import { GlobeAmericasIcon, ListBulletIcon, MoonIcon } from '@heroicons/react/24/outline'
import {
  DEFAULT_CHAIN_V5,
  TEAM_TABLE_NAMES,
  CITIZEN_TABLE_NAMES,
  TEAM_TABLE_ADDRESSES,
  CITIZEN_TABLE_ADDRESSES,
} from 'const/config'
import { GetStaticProps } from 'next'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useRouter } from 'next/router'
import React, { useState, useEffect, useCallback } from 'react'
import { useDebounce } from 'react-use'
import { NetworkTab } from '@/lib/network/types'
import { useMapData } from '@/lib/network/useMapData'
import { useValidTeams, useValidCitizens } from '@/lib/network/useNetworkData'
import { filterBlockedTeams, filterBlockedCitizens } from '@/lib/network/utils'
import { generatePrettyLink, generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { teamRowToNFT, citizenRowToNFT } from '@/lib/tableland/convertRow'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import { networkCard } from '@/lib/layout/styles'
import Container from '../components/layout/Container'
import Frame from '../components/layout/Frame'
import Head from '../components/layout/Head'
import CardGridContainer from '@/components/layout/CardGridContainer'
import NetworkCardSkeleton from '@/components/layout/NetworkCardSkeleton'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import Search from '@/components/layout/Search'
import StandardButton from '@/components/layout/StandardButton'
import StandardDetailCard from '@/components/layout/StandardDetailCard'
import Tab from '@/components/layout/Tab'

const Earth = dynamic(() => import('@/components/globe/Earth'), { ssr: false })
const Moon = dynamic(() => import('@/components/globe/Moon'), { ssr: false })

export default function Network({
  initialTeams,
  initialCitizens,
}: {
  initialTeams?: any[]
  initialCitizens?: any[]
}) {
  const router = useRouter()
  const shallowQueryRoute = useShallowQueryRoute()

  const [input, setInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useDebounce(
    () => {
      setDebouncedSearch(input)
      if (pageIdx !== 1) {
        handlePageChange(1)
      }
    },
    500,
    [input]
  )

  const [tab, setTab] = useState<NetworkTab>('citizens')
  const [mapView, setMapView] = useState<string>('earth')
  const [pageIdx, setPageIdx] = useState(1)

  useEffect(() => {
    const { tab: urlTab, page: urlPage } = router.query
    if (urlTab && (urlTab === 'teams' || urlTab === 'citizens' || urlTab === 'map')) {
      setTab(urlTab as NetworkTab)
    }
    if (urlPage && !isNaN(Number(urlPage))) {
      setPageIdx(Number(urlPage))
    }
  }, [router.query])

  const handleTabChange = useCallback(
    (newTab: string) => {
      setTab(newTab as NetworkTab)
      setPageIdx(1)
      shallowQueryRoute({ tab: newTab, page: '1' })
    },
    [shallowQueryRoute]
  )

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPageIdx(newPage)
      shallowQueryRoute({ tab, page: newPage.toString() })
    },
    [shallowQueryRoute, tab]
  )

  const isTeamsTab = tab === 'teams'
  const isCitizensTab = tab === 'citizens'
  const isMapTab = tab === 'map'

  const teamsResult = useValidTeams({
    page: isTeamsTab ? pageIdx : 1,
    search: isTeamsTab ? debouncedSearch : '',
    enabled: isTeamsTab || isMapTab,
    initialData: initialTeams,
  })

  const citizensResult = useValidCitizens({
    page: isCitizensTab ? pageIdx : 1,
    search: isCitizensTab ? debouncedSearch : '',
    enabled: isCitizensTab || isMapTab,
    initialData: initialCitizens,
  })

  const mapData = useMapData(isMapTab)

  const currentData = isTeamsTab
    ? teamsResult
    : isCitizensTab
    ? citizensResult
    : { data: [], isLoading: false, error: null, maxPage: 1 }

  useChainDefault()

  function renderNFTs() {
    const nfts = currentData.data

    if (currentData.isLoading && nfts.length === 0) {
      return Array.from({ length: 10 }, (_, i) => <NetworkCardSkeleton key={i} />)
    }

    if (nfts.length === 0 && !currentData.isLoading) {
      return (
        <div className="col-span-full text-center py-12">
          <div className="text-slate-400 mb-4">
            <ListBulletIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
          </div>
          <h3 className="text-xl font-GoodTimes text-white mb-2">No {tab} found</h3>
          <p className="text-slate-400">
            {debouncedSearch
              ? `No results for "${debouncedSearch}"`
              : `No ${tab} available at the moment.`}
          </p>
        </div>
      )
    }

    return nfts.map((nft, i) => {
      const link = `/${tab === 'teams' ? 'team' : 'citizen'}/${
        tab === 'teams'
          ? generatePrettyLink(nft.metadata.name)
          : generatePrettyLinkWithId(nft.metadata.name, nft.id.toString())
      }`

      return (
        <div className="w-full h-full" key={`${nft.metadata.name}-${nft.id}-${i}`}>
          <StandardDetailCard
            title={nft.metadata.name}
            paragraph={nft.metadata.description}
            image={nft.metadata.image}
            link={link}
          />
        </div>
      )
    })
  }

  return (
    <div className="animate-fadeIn">
      <Head
        title="Explore the Network | MoonDAO"
        description="Discover and connect with citizens and teams building the future of space exploration"
        image="https://ipfs.io/ipfs/QmbbjvWBUAXPPibj4ZbzzErVaZBSD99r3dbt5CGQMd5Bkh"
      />

      <Container>
        <Frame noPadding>
          <div className="relative py-8 px-6">
            <div className="max-w-6xl mx-auto text-center">
              <h1 className="header font-GoodTimes text-white mb-3">Explore the Network</h1>
              <p className="sub-header text-white/80 max-w-3xl mx-auto mb-6">
                Discover and connect with citizens and teams building the future of space
                exploration
              </p>
            </div>
          </div>

          <div id="network-controls" className="max-w-6xl mx-auto mb-8 px-6">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div
                className={`w-full lg:w-auto min-w-0 max-w-[320px] bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 px-4 py-3 ${
                  isMapTab ? 'invisible' : ''
                }`}
              >
                <Search
                  className="w-full"
                  input={input}
                  setInput={setInput}
                  placeholder={
                    isTeamsTab
                      ? 'Search teams'
                      : isCitizensTab
                      ? 'Search citizens'
                      : 'Search network'
                  }
                />
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-1.5">
                <div className="flex text-sm gap-1">
                  <Tab
                    tab="citizens"
                    currentTab={tab}
                    setTab={handleTabChange}
                    icon="/assets/icon-passport.svg"
                  >
                    Citizens
                  </Tab>
                  <Tab
                    tab="teams"
                    currentTab={tab}
                    setTab={handleTabChange}
                    icon="/assets/icon-org.svg"
                  >
                    Teams
                  </Tab>
                  <Tab
                    tab="map"
                    currentTab={tab}
                    setTab={handleTabChange}
                    icon={<GlobeAmericasIcon width={20} height={20} />}
                  >
                    Map
                  </Tab>
                </div>
              </div>

              <div className="w-full lg:w-auto min-w-0 max-w-[320px] flex justify-end">
                <StandardButton
                  className="gradient-2 rounded-xl hover:scale-105 transition-transform"
                  hoverEffect={false}
                  link="/join"
                >
                  <div className="flex items-center justify-center gap-2">
                    <PlusCircleIcon width={16} height={16} />
                    <span className="text-sm">Join Network</span>
                  </div>
                </StandardButton>
              </div>
            </div>
          </div>

          <div id="network-content" className="max-w-6xl mx-auto px-6 pb-16">
            {isMapTab ? (
              <div className={`${networkCard.base} p-6 md:p-8`}>
                <div className="mb-6">
                  <div className="flex justify-center">
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-1.5">
                      <div className="flex text-sm gap-1">
                        <Tab
                          tab="earth"
                          setTab={setMapView}
                          currentTab={mapView}
                          icon={<GlobeAmericasIcon width={20} height={20} />}
                        >
                          Earth
                        </Tab>
                        <Tab
                          tab="moon"
                          setTab={setMapView}
                          currentTab={mapView}
                          icon={<MoonIcon width={20} height={20} />}
                        >
                          Moon
                        </Tab>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-full flex justify-center">
                  <div className={`w-full max-w-4xl rounded-lg z-[100] min-h-[60vh] ${networkCard.base} shadow-xl overflow-hidden`}>
                    <div
                      className={`flex items-center justify-center ${
                        mapView !== 'earth' && 'hidden'
                      }`}
                    >
                      <Earth pointsData={mapData.data || []} />
                    </div>
                    <div className={`${mapView !== 'moon' && 'hidden'}`}>
                      <Moon />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`${networkCard.base} p-6 md:p-8`}>
                <CardGridContainer xsCols={1} smCols={1} mdCols={2} lgCols={2} maxCols={2} center>
                  {renderNFTs()}
                </CardGridContainer>

                {!isMapTab && (
                  <div className="w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mt-8">
                    <div className="w-full flex font-GoodTimes text-2xl flex-row justify-center items-center lg:space-x-8">
                      <button
                        onClick={() => {
                          if (pageIdx > 1) {
                            handlePageChange(pageIdx - 1)
                          }
                        }}
                        className={`pagination-button transition-opacity hover:scale-110 ${
                          pageIdx === 1 ? 'opacity-30' : 'cursor-pointer opacity-100'
                        }`}
                        disabled={pageIdx === 1}
                      >
                        <Image
                          src="/assets/icon-left.svg"
                          alt="Left Arrow"
                          width={35}
                          height={35}
                        />
                      </button>
                      <p id="page-number" className="px-5 font-bold text-white">
                        Page {pageIdx} of {currentData.maxPage}
                      </p>
                      <button
                        onClick={() => {
                          if (pageIdx < currentData.maxPage) {
                            handlePageChange(pageIdx + 1)
                          }
                        }}
                        className={`pagination-button transition-opacity hover:scale-110 ${
                          pageIdx === currentData.maxPage
                            ? 'opacity-30'
                            : 'cursor-pointer opacity-100'
                        }`}
                        disabled={pageIdx === currentData.maxPage}
                      >
                        <Image
                          src="/assets/icon-right.svg"
                          alt="Right Arrow"
                          width={35}
                          height={35}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Frame>

        <div className="flex justify-center w-full">
          <NoticeFooter
            defaultImage="../assets/MoonDAO-Logo-White.svg"
            defaultTitle="Need Help?"
            defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
            defaultButtonText="Submit a Ticket"
            defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
            imageWidth={200}
            imageHeight={200}
          />
        </div>
      </Container>
    </div>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    // Dynamic imports for large/server-only dependencies to reduce client bundle size
    const { getContract, readContract } = await import('thirdweb')
    const { serverClient } = await import('@/lib/thirdweb/client')
    const TeamTableABI = (await import('const/abis/TeamTable.json')).default
    const CitizenTableABI = (await import('const/abis/CitizenTable.json')).default
    const queryTable = (await import('@/lib/tableland/queryTable')).default

    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)
    const PAGE_SIZE = 10

    let teamTableName = TEAM_TABLE_NAMES[chainSlug]
    let citizenTableName = CITIZEN_TABLE_NAMES[chainSlug]

    if (!teamTableName && TEAM_TABLE_ADDRESSES[chainSlug]) {
      const teamTableContract = getContract({
        client: serverClient,
        address: TEAM_TABLE_ADDRESSES[chainSlug],
        chain,
        abi: TeamTableABI as any,
      })
      teamTableName = (await readContract({
        contract: teamTableContract,
        method: 'getTableName',
      })) as string
    }

    if (!citizenTableName && CITIZEN_TABLE_ADDRESSES[chainSlug]) {
      const citizenTableContract = getContract({
        client: serverClient,
        address: CITIZEN_TABLE_ADDRESSES[chainSlug],
        chain,
        abi: CitizenTableABI as any,
      })
      citizenTableName = (await readContract({
        contract: citizenTableContract,
        method: 'getTableName',
      })) as string
    }

    // Fetch 3 pages worth of data (30 items) for pre-rendering
    const PRE_RENDER_PAGES = 3
    const PRE_RENDER_LIMIT = PAGE_SIZE * PRE_RENDER_PAGES

    const [teamRows, citizenRows] = await Promise.all([
      teamTableName
        ? queryTable(
            chain,
            `SELECT * FROM ${teamTableName} ORDER BY id DESC LIMIT ${PRE_RENDER_LIMIT}`
          )
        : Promise.resolve([]),
      citizenTableName
        ? queryTable(
            chain,
            `SELECT * FROM ${citizenTableName} ORDER BY id DESC LIMIT ${PRE_RENDER_LIMIT}`
          )
        : Promise.resolve([]),
    ])

    // Pass raw rows as initialData - the hooks will convert and filter them
    // This matches the format expected by useTablelandQuery fallbackData
    return {
      props: {
        initialTeams: teamRows || [],
        initialCitizens: citizenRows || [],
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error('Error in getStaticProps for network page:', error)
    return {
      props: {
        initialTeams: [],
        initialCitizens: [],
      },
      revalidate: 60,
    }
  }
}
