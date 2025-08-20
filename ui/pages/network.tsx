import { PlusCircleIcon } from '@heroicons/react/20/solid'
import { GlobeAmericasIcon, ListBulletIcon, MoonIcon } from '@heroicons/react/24/outline'
import CitizenTableABI from 'const/abis/CitizenTable.json'
import TeamTableABI from 'const/abis/TeamTable.json'
import {
  CITIZEN_ADDRESSES,
  CITIZEN_TABLE_ADDRESSES,
  DEFAULT_CHAIN_V5,
  JOBS_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
  TEAM_TABLE_ADDRESSES,
} from 'const/config'
import { blockedCitizens, blockedTeams, featuredTeams } from 'const/whitelist'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useState, useEffect, useCallback, useContext } from 'react'
import { getContract, NFT, readContract } from 'thirdweb'
import CitizenContext from '@/lib/citizen/citizen-context'
import {
  generatePrettyLink,
  generatePrettyLinkWithId,
} from '@/lib/subscription/pretty-links'
import { citizenRowToNFT, teamRowToNFT } from '@/lib/tableland/convertRow'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import { getAttribute } from '@/lib/utils/nft'
import Card from '../components/layout/Card'
import Container from '../components/layout/Container'
import Frame from '../components/layout/Frame'
import Head from '../components/layout/Head'
import CardGridContainer from '@/components/layout/CardGridContainer'
import CardSkeleton from '@/components/layout/CardSkeleton'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import PaginationButtons from '@/components/layout/PaginationButtons'
import Search from '@/components/layout/Search'
import StandardButton from '@/components/layout/StandardButton'
import StandardDetailCard from '@/components/layout/StandardDetailCard'
import Tab from '@/components/layout/Tab'
import Job, { Job as JobType } from '../components/jobs/Job'
import CitizenABI from '../const/abis/Citizen.json'
import TeamABI from '../const/abis/Team.json'
import JobsABI from '../const/abis/JobBoardTable.json'

// Dynamic imports for globe components
const Earth = dynamic(() => import('@/components/globe/Earth'), { ssr: false })
const Moon = dynamic(() => import('@/components/globe/Moon'), { ssr: false })

type NetworkProps = {
  filteredTeams: any[]
  filteredCitizens: any[]
  jobs: JobType[]
  citizensLocationData?: any[]
}

export default function Network({
  filteredTeams,
  filteredCitizens,
  jobs,
  citizensLocationData,
}: NetworkProps) {
  const router = useRouter()
  const shallowQueryRoute = useShallowQueryRoute()
  const { citizen } = useContext(CitizenContext)

  const [input, setInput] = useState('')
  function filterBySearch(nfts: any[]) {
    return nfts.filter((nft) => {
      return nft.metadata.name
        ?.toString()
        .toLowerCase()
        .includes(input.toLowerCase())
    })
  }

  const [tab, setTab] = useState<string>('citizens')
  const [mapView, setMapView] = useState<string>('earth') // For map sub-tabs
  
  function loadByTab(tab: string) {
    if (tab === 'teams') {
      setCachedNFTs(input != '' ? filterBySearch(filteredTeams) : filteredTeams)
    } else if (tab === 'citizens') {
      setCachedNFTs(
        input != '' ? filterBySearch(filteredCitizens) : filteredCitizens
      )
    } else if (tab === 'map') {
      // For map tab, we don't need to set cachedNFTs as it shows the globe
      setCachedNFTs([])
    } else {
      const nfts =
        filteredTeams?.[0] && filteredCitizens?.[0]
          ? [...filteredTeams, ...filteredCitizens]
          : filteredCitizens?.[0]
          ? filteredCitizens
          : filteredTeams?.[0]
          ? filteredTeams
          : []
      setCachedNFTs(input != '' ? filterBySearch(nfts) : nfts)
    }
  }

  const handleTabChange = useCallback(
    (newTab: string) => {
      setTab(newTab)
      setPageIdx(1)
      shallowQueryRoute({ tab: newTab, page: '1' })
    },
    [shallowQueryRoute]
  )

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPageIdx(newPage)
      shallowQueryRoute({ tab, page: newPage.toString() })
      
      // Scroll to the controls section to keep the user focused on the network browsing area
      setTimeout(() => {
        const controls = document.getElementById('network-controls')
        if (controls) {
          controls.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    },
    [shallowQueryRoute, tab]
  )

  const [maxPage, setMaxPage] = useState(1)

  useEffect(() => {
    const totalTeams =
      input != '' ? filterBySearch(filteredTeams).length : filteredTeams.length
    const totalCitizens =
      input != ''
        ? filterBySearch(filteredCitizens).length
        : filteredCitizens.length

    if (tab === 'teams') setMaxPage(Math.ceil(totalTeams / 10))
    else if (tab === 'citizens') setMaxPage(Math.ceil(totalCitizens / 10))
    else if (tab === 'map') setMaxPage(1) // Map doesn't need pagination
  }, [tab, input, filteredCitizens, filteredTeams])

  const [cachedNFTs, setCachedNFTs] = useState<any[]>([])

  const [pageIdx, setPageIdx] = useState(1)

  useEffect(() => {
    const { tab: urlTab, page: urlPage } = router.query
    if (urlTab && (urlTab === 'teams' || urlTab === 'citizens' || urlTab === 'map')) {
      setTab(urlTab as string)
    }
    if (urlPage && !isNaN(Number(urlPage))) {
      setPageIdx(Number(urlPage))
    }
  }, [router.query])

  useEffect(() => {
    loadByTab(tab)
  }, [tab, input, filteredTeams, filteredCitizens, router.query])

  useChainDefault()

  function renderNFTs() {
    const nfts = cachedNFTs

    // Show loading state if no NFTs and we're not on the map tab
    if ((!nfts || nfts.length === 0) && tab !== 'map') {
      return Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)
    }

    // Calculate pagination
    const startIndex = (pageIdx - 1) * 10
    const endIndex = startIndex + 10
    const paginatedNFTs = nfts.slice(startIndex, endIndex)

    if (paginatedNFTs.length === 0 && tab !== 'map') {
      return (
        <div className="col-span-full text-center py-12">
          <div className="text-slate-400 mb-4">
            <ListBulletIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
          </div>
          <h3 className="text-xl font-GoodTimes text-white mb-2">
            No {tab} found
          </h3>
          <p className="text-slate-400">
            {input ? `No results for "${input}"` : `No ${tab} available at the moment.`}
          </p>
        </div>
      )
    }

    return paginatedNFTs.map((nft, i) => {
      const teamTier = getAttribute(nft?.metadata?.attributes as any[], 'Team Tier')?.value
      const isFeatured = featuredTeams.includes(nft.metadata.name)

      const type = nft?.metadata?.attributes?.find((attr: any) => attr.trait_type === 'Type')?.value
      const link = `/${type === 'team' ? 'team' : 'citizen'}/${
        type === 'team'
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
          {/* Compact Header Section */}
          <div className="relative py-8 px-6">
            <div className="max-w-6xl mx-auto text-center">
              <h1 className="header font-GoodTimes text-white mb-3">
                Explore the Network
              </h1>
              <p className="sub-header text-white/80 max-w-3xl mx-auto mb-6">
                Discover and connect with citizens and teams building the future of space exploration
              </p>
            </div>
          </div>

          {/* Controls Section */}
          <div id="network-controls" className="max-w-6xl mx-auto mb-8 px-6">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              {/* Search Bar - Always present but invisible for map tab */}
              <div className={`w-full lg:w-auto min-w-0 max-w-[320px] bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 px-4 py-3 ${tab === 'map' ? 'invisible' : ''}`}>
                <Search
                  className="w-full"
                  input={input}
                  setInput={setInput}
                  placeholder={tab === 'teams' ? 'Search teams' : tab === 'citizens' ? 'Search citizens' : 'Search network'}
                />
              </div>

              {/* Tabs - Always centered */}
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

              {/* Join Button - Compact */}
              <div className="w-full lg:w-auto min-w-0 max-w-[320px] flex justify-end">
                <StandardButton
                  className="gradient-2 rounded-xl hover:scale-105 transition-transform"
                  hoverEffect={false}
                  link="/network-overview"
                >
                  <div className="flex items-center justify-center gap-2">
                    <PlusCircleIcon width={16} height={16} />
                    <span className="text-sm">Join Network</span>
                  </div>
                </StandardButton>
              </div>
            </div>
          </div>

          {/* Content Section - Either Grid or Map */}
          <div id="network-content" className="max-w-6xl mx-auto px-6 pb-16">
            {tab === 'map' ? (
              /* Map View */
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 md:p-8">
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
                  <div className="w-full max-w-4xl rounded-lg z-[100] min-h-[60vh] bg-dark-cool shadow-xl shadow-[#112341] overflow-hidden">
                    <div className={`flex items-center justify-center ${mapView !== 'earth' && 'hidden'}`}>
                      <Earth pointsData={citizensLocationData || []} />
                    </div>
                    <div className={`${mapView !== 'moon' && 'hidden'}`}>
                      <Moon />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Network Grid View */
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 md:p-8">
                <CardGridContainer
                  xsCols={1}
                  smCols={1}
                  mdCols={2}
                  lgCols={2}
                  maxCols={2}
                  center
                >
                  {renderNFTs()}
                </CardGridContainer>

                {/* Pagination - Only for non-map tabs */}
                {tab !== 'map' && (
                  <div className="w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mt-8">
                    <div className="w-full flex font-GoodTimes text-2xl flex-row justify-center items-center lg:space-x-8">
                      <button
                        onClick={() => {
                          if (pageIdx > 1) {
                            handlePageChange(pageIdx - 1)
                          }
                        }}
                        className={`pagination-button transition-opacity hover:scale-110 ${
                          pageIdx === 1
                            ? 'opacity-30'
                            : 'cursor-pointer opacity-100'
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
                        Page {pageIdx} of {maxPage}
                      </p>
                      <button
                        onClick={() => {
                          if (pageIdx < maxPage) {
                            handlePageChange(pageIdx + 1)
                          }
                        }}
                        className={`pagination-button transition-opacity hover:scale-110 ${
                          pageIdx === maxPage
                            ? 'opacity-30'
                            : 'cursor-pointer opacity-100'
                        }`}
                        disabled={pageIdx === maxPage}
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

        {/* Footer */}
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

export async function getServerSideProps() {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)

  try {
    // Get team table name and query
    const teamTableContract = getContract({
      client: serverClient,
      address: TEAM_TABLE_ADDRESSES[chainSlug],
      chain: chain,
      abi: TeamTableABI as any,
    })

    const teamTableName = await readContract({
      contract: teamTableContract,
      method: 'getTableName',
    })

    const teamRows = await queryTable(chain, `SELECT * FROM ${teamTableName}`)

    // Get citizen table name and query
    const citizenTableContract = getContract({
      client: serverClient,
      address: CITIZEN_TABLE_ADDRESSES[chainSlug],
      chain: chain,
      abi: CitizenTableABI as any,
    })
    
    const citizenTableName = await readContract({
      contract: citizenTableContract,
      method: 'getTableName',
    })
    
    const citizenRows: any = await queryTable(
      chain,
      `SELECT * FROM ${citizenTableName}`
    )

    // Get jobs table name and query
    const jobsTableContract = getContract({
      client: serverClient,
      address: JOBS_TABLE_ADDRESSES[chainSlug],
      chain: chain,
      abi: JobsABI as any,
    })

    const jobsTableName = await readContract({
      contract: jobsTableContract,
      method: 'getTableName',
    })

    const jobs = await queryTable(chain, `SELECT * FROM ${jobsTableName}`)

    // Get current timestamp for expiration checks
    const now = Math.floor(Date.now() / 1000)

    // Convert team rows to NFTs
    const teamNFTs: NFT[] = []
    if (teamRows && teamRows.length > 0) {
      for (const team of teamRows) {
        try {
          const teamNFT = teamRowToNFT(team)
          teamNFTs.push(teamNFT)
        } catch (error) {
          console.error(`Error converting team ${team.id}:`, error)
        }
      }
    }

    // Get team contract for expiration checks
    const teamContract = getContract({
      client: serverClient,
      address: TEAM_ADDRESSES[chainSlug],
      chain: chain,
      abi: TeamABI as any,
    })

    // Filter for public teams
    const filteredPublicTeams: any = teamNFTs?.filter(
      (nft: any) =>
        nft.metadata.attributes?.find((attr: any) => attr.trait_type === 'view')
          ?.value === 'public' && !blockedTeams.includes(nft.metadata.id)
    )

    // Filter for valid (non-expired) teams
    const filteredValidTeams: any = filteredPublicTeams?.filter(
      async (nft: any) => {
        try {
          const expiresAt = await readContract({
            contract: teamContract,
            method: 'expiresAt',
            params: [nft?.metadata?.id],
          })
          return +expiresAt.toString() > now
        } catch (error) {
          console.error(`Error checking expiration for team ${nft?.metadata?.id}:`, error)
          return false
        }
      }
    )

    // Sort teams with newest first and featured teams prioritized
    const filteredTeams = filteredValidTeams
      .reverse()
      .sort((a: any, b: any) => {
        const aIsFeatured = featuredTeams.includes(Number(a.metadata.id))
        const bIsFeatured = featuredTeams.includes(Number(b.metadata.id))

        if (aIsFeatured && bIsFeatured) {
          return (
            featuredTeams.indexOf(Number(a.metadata.id)) -
            featuredTeams.indexOf(Number(b.metadata.id))
          )
        } else if (aIsFeatured) {
          return -1
        } else if (bIsFeatured) {
          return 1
        } else {
          return 0
        }
      })

    // Convert citizen rows to NFTs
    const citizenNFTs: NFT[] = []
    if (citizenRows && citizenRows.length > 0) {
      for (const citizen of citizenRows) {
        try {
          const citizenNFT = citizenRowToNFT(citizen)
          citizenNFTs.push(citizenNFT)
        } catch (error) {
          console.error(`Error converting citizen ${citizen.id}:`, error)
        }
      }
    }

    // Get citizen contract for expiration checks
    const citizenContract = getContract({
      client: serverClient,
      address: CITIZEN_ADDRESSES[chainSlug],
      chain: chain,
      abi: CitizenABI as any,
    })

    // Filter for public citizens
    const filteredPublicCitizens: any = citizenNFTs?.filter(
      (nft: any) =>
        nft.metadata.attributes?.find((attr: any) => attr.trait_type === 'view')
          ?.value === 'public' && !blockedCitizens.includes(nft.metadata.id)
    )

    // Filter for valid (non-expired) citizens
    const filteredValidCitizens: any = filteredPublicCitizens?.filter(
      async (nft: any) => {
        try {
          const expiresAt = await readContract({
            contract: citizenContract,
            method: 'expiresAt',
            params: [nft?.metadata?.id],
          })
          return +expiresAt.toString() > now
        } catch (error) {
          console.error(`Error checking expiration for citizen ${nft?.metadata?.id}:`, error)
          return false
        }
      }
    )

    const filteredCitizens = filteredValidCitizens.reverse() // Show newest citizens first

    // Get citizens location data for the map
    let citizensLocationData: any[] = []
    
    if (process.env.NEXT_PUBLIC_ENV === 'prod' || process.env.NEXT_PUBLIC_TEST_ENV === 'true') {
      // Get location data for each citizen
      for (const citizen of filteredCitizens) {
        const citizenLocation = getAttribute(
          citizen?.metadata?.attributes as unknown as any[],
          'location'
        )?.value

        let locationData

        if (
          citizenLocation &&
          citizenLocation !== '' &&
          !citizenLocation?.startsWith('{')
        ) {
          locationData = {
            results: [
              {
                formatted_address: citizenLocation,
              },
            ],
          }
        } else if (citizenLocation?.startsWith('{')) {
          const parsedLocationData = JSON.parse(citizenLocation)
          locationData = {
            results: [
              {
                formatted_address: parsedLocationData.name,
                geometry: {
                  location: {
                    lat: parsedLocationData.lat,
                    lng: parsedLocationData.lng,
                  },
                },
              },
            ],
          }
        } else {
          locationData = {
            results: [
              {
                formatted_address: 'Antarctica',
                geometry: { location: { lat: -90, lng: 0 } },
              },
            ],
          }
        }

        citizensLocationData.push({
          id: citizen.metadata.id,
          name: citizen.metadata.name,
          location: citizenLocation,
          formattedAddress:
            locationData.results?.[0]?.formatted_address || 'Antarctica',
          image: citizen.metadata.image,
          lat: locationData.results?.[0]?.geometry?.location?.lat || -90,
          lng: locationData.results?.[0]?.geometry?.location?.lng || 0,
        })
      }

      // Group citizens by lat and lng
      const locationMap = new Map()

      for (const citizen of citizensLocationData) {
        const key = `${citizen.lat},${citizen.lng}`
        if (!locationMap.has(key)) {
          locationMap.set(key, {
            citizens: [citizen],
            names: [citizen.name],
            formattedAddress: citizen.formattedAddress,
            lat: citizen.lat,
            lng: citizen.lng,
          })
        } else {
          const existing = locationMap.get(key)
          existing.names.push(citizen.name)
          existing.citizens.push(citizen)
        }
      }

      // Convert the map back to an array
      citizensLocationData = Array.from(locationMap.values()).map(
        (entry: any) => ({
          ...entry,
          color:
            entry.citizens.length > 3
              ? '#6a3d79'
              : entry.citizens.length > 1
              ? '#5e4dbf'
              : '#5556eb',
          size:
            entry.citizens.length > 1
              ? Math.min(entry.citizens.length * 0.01, 0.4)
              : 0.01,
        })
      )
    }

    return {
      props: {
        filteredTeams,
        filteredCitizens,
        jobs,
        citizensLocationData,
      },
    }
  } catch (error) {
    console.error('Error in getServerSideProps:', error)
    return {
      props: {
        filteredTeams: [],
        filteredCitizens: [],
        jobs: [],
        citizensLocationData: [],
      },
    }
  }
}
