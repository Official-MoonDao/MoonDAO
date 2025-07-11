import { PlusCircleIcon } from '@heroicons/react/20/solid'
import { GlobeAmericasIcon, ListBulletIcon } from '@heroicons/react/24/outline'
import CitizenTableABI from 'const/abis/CitizenTable.json'
import TeamTableABI from 'const/abis/TeamTable.json'
import {
  CITIZEN_ADDRESSES,
  CITIZEN_TABLE_ADDRESSES,
  DEFAULT_CHAIN_V5,
  TEAM_ADDRESSES,
  TEAM_TABLE_ADDRESSES,
} from 'const/config'
import { blockedCitizens, blockedTeams, featuredTeams } from 'const/whitelist'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useState, useEffect, useCallback } from 'react'
import { getContract, NFT, readContract } from 'thirdweb'
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
import Card from '../components/layout/Card'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
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
import CitizenABI from '../const/abis/Citizen.json'
import TeamABI from '../const/abis/Team.json'

type NetworkProps = {
  filteredTeams: any[]
  filteredCitizens: any[]
}

export default function Network({
  filteredTeams,
  filteredCitizens,
}: NetworkProps) {
  const router = useRouter()
  const shallowQueryRoute = useShallowQueryRoute()

  const [input, setInput] = useState('')
  function filterBySearch(nfts: any[]) {
    return nfts.filter((nft) => {
      return nft.metadata.name
        ?.toString()
        .toLowerCase()
        .includes(input.toLowerCase())
    })
  }

  const [tab, setTab] = useState<string>('teams')
  function loadByTab(tab: string) {
    if (tab === 'teams') {
      setCachedNFTs(input != '' ? filterBySearch(filteredTeams) : filteredTeams)
    } else if (tab === 'citizens') {
      setCachedNFTs(
        input != '' ? filterBySearch(filteredCitizens) : filteredCitizens
      )
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
    },
    [shallowQueryRoute]
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
    if (tab === 'citizens') setMaxPage(Math.ceil(totalCitizens / 10))
  }, [tab, input, filteredCitizens, filteredTeams])

  const [cachedNFTs, setCachedNFTs] = useState<any[]>([])

  const [pageIdx, setPageIdx] = useState(1)

  useEffect(() => {
    const { tab: urlTab, page: urlPage } = router.query
    if (urlTab && (urlTab === 'teams' || urlTab === 'citizens')) {
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

  const descriptionSection = (
    <div className="pt-2">
      <div className="mb-4">
        The Space Acceleration Network is an onchain startup society focused on
        building a permanent settlement on the Moon and beyond. Help build our
        multiplanetary future and{' '}
        <u>
          <Link href="/join">join the network</Link>
        </u>
        .
      </div>
      <div className="relative w-full flex flex-col gap-3">
        {/* Search Bar and Tabs - Same Row */}
        <div className="flex w-full md:w-5/6 flex-col min-[1200px]:flex-row md:gap-2">
          <div className="w-full flex flex-row min-[800px]:flex-row gap-4 items-center overflow-hidden">
            {/* Search Bar */}
            <div className="w-full min-w-0 max-w-[250px] sm:max-w-[280px] md:max-w-[320px] bg-gradient-to-b from-slate-700/30 to-slate-800/40 rounded-xl border border-slate-600/30 px-3 py-1">
              <Search
                className="w-full flex-grow"
                input={input}
                setInput={setInput}
                placeholder="Search..."
              />
            </div>

            <div
              id="filter-container"
              className="hidden min-[1150px]:block flex-shrink-0"
            >
              <div 
                className="bg-gradient-to-b from-slate-700/30 to-slate-800/40 rounded-xl border border-slate-600/30 p-1.5"
              >
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
                    setTab={() => {
                      router.push('/map')
                    }}
                    icon={<GlobeAmericasIcon width={20} height={20} />}
                  >
                    Map
                  </Tab>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 flex justify-end md:justify-start">
              <StandardButton
                className="gradient-2 rounded-2xl hover:scale-105 transition-transform"
                hoverEffect={false}
                link="/join"
              >
                <div className="flex items-center justify-start gap-2">
                  <PlusCircleIcon width={20} height={20} />
                  {'Join'}
                </div>
              </StandardButton>
            </div>
          </div>
          <div
            id="filter-container"
            className="min-[1150px]:hidden mt-4 min-[900px]:mt-2"
          >
            <div className="w-fit max-w-[300px] sm:max-w-none h-fit bg-gradient-to-b from-slate-700/30 to-slate-800/40 rounded-xl border border-slate-600/30 p-1.5 overflow-x-auto">
              <div className="flex text-sm gap-1 min-w-fit">
                <Tab
                  tab="teams"
                  currentTab={tab}
                  setTab={handleTabChange}
                  icon="/assets/icon-org.svg"
                >
                  Teams
                </Tab>
                <Tab
                  tab="citizens"
                  currentTab={tab}
                  setTab={handleTabChange}
                  icon="/assets/icon-passport.svg"
                >
                  Citizens
                </Tab>
                <Tab
                  tab="map"
                  currentTab={tab}
                  setTab={() => {
                    router.push('/map')
                  }}
                  icon={<GlobeAmericasIcon width={20} height={20} />}
                >
                  Map
                </Tab>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderNFTs = () => {
    if (!cachedNFTs?.[0]) {
      return (
        <>
          {Array.from({ length: 10 }).map((_, i) => (
            <CardSkeleton key={`card-skeleton-${i}`} />
          ))}
        </>
      )
    }

    // Always try to show 10 items on each full page
    const startIndex = (pageIdx - 1) * 10
    let endIndex = pageIdx * 10

    // On the last page, show all remaining items
    if (pageIdx === maxPage) {
      endIndex = cachedNFTs.length
    }

    const nftsToShow = cachedNFTs?.slice(startIndex, endIndex)

    // Fill the last row with empty divs if needed on non-last pages
    const itemsToRender = [...nftsToShow]
    if (pageIdx !== maxPage && itemsToRender.length < 10) {
      const emptyCount = 10 - itemsToRender.length
      for (let i = 0; i < emptyCount; i++) {
        itemsToRender.push({ empty: true })
      }
    }

    return itemsToRender.map((nft: any, i: number) => {
      if (nft.empty) {
        return <div key={`empty-${i}`} className="invisible" />
      }

      if (nft.metadata.name === 'Failed to load NFT metadata') return null

      const type = nft.metadata.attributes.find(
        (attr: any) => attr.trait_type === 'communications'
      )
        ? 'team'
        : 'citizen'

      const link = `/${type === 'team' ? 'team' : 'citizen'}/${
        type === 'team'
          ? generatePrettyLink(nft.metadata.name)
          : generatePrettyLinkWithId(nft.metadata.name, nft.metadata.id)
      }`

      return (
        <div className="w-full h-full" key={'team-citizen-' + i}>
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
    <section id="network-container" className="overflow-hidden">
      <Head
        title={'Space Acceleration Network'}
        description={
          'The Space Acceleration Network is an onchain startup society focused on building a permanent settlement on the Moon and beyond.'
        }
        image="https://ipfs.io/ipfs/QmbExwDgVoDYpThFaVRRxUkusHnXxMj3Go8DdWrXg1phxi"
      />
      <Container>
        <ContentLayout
          logo={
            <Image
              src="/assets/san-logo.svg"
              alt="SAN Logo"
              width={275}
              height={275}
            />
          }
          header={
            <div className="flex flex-row items-center">
              <Image
                src="/assets/network-title.svg"
                alt="Org"
                width={300}
                height={300}
              />
            </div>
          }
          headerSize="max(20px, 3vw)"
          description={descriptionSection}
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="flex flex-row w-full">
            <div className="px-8 bg-gradient-to-b from-slate-800/90 to-slate-900/95 backdrop-blur-xl border border-slate-700/50 lg:p-8 rounded-[2vmax] shadow-2xl md:m-5 mb-0 md:mb-0 w-full flex flex-col lg:max-w-[1400px]">
              <CardGridContainer
                xsCols={1}
                smCols={1}
                mdCols={1}
                lgCols={2}
                maxCols={2}
                center
              >
                {renderNFTs()}
              </CardGridContainer>

              <div className="w-full rounded-[2vmax] bg-gradient-to-b from-slate-700/20 to-slate-800/30 border border-slate-600/30 p-6 mt-8">
                <div
                  id="pagination-container"
                  className="w-full flex font-GoodTimes text-2xl flex-row justify-center items-center lg:space-x-8"
                >
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
                      src="/../.././assets/icon-left.svg"
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
                      src="/../.././assets/icon-right.svg"
                      alt="Right Arrow"
                      width={35}
                      height={35}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}

export async function getStaticProps() {
  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const now = Math.floor(Date.now() / 1000)

    const teamContract = getContract({
      client: serverClient,
      address: TEAM_ADDRESSES[chainSlug],
      chain: chain,
      abi: TeamABI as any,
    })

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

    const teams: NFT[] = []
    for (const row of teamRows) {
      teams.push(teamRowToNFT(row))
    }

    const filteredPublicTeams: any = teams?.filter(
      (nft: any) =>
        nft.metadata.attributes?.find((attr: any) => attr.trait_type === 'view')
          .value === 'public' && !blockedTeams.includes(nft.metadata.id)
    )

    const filteredValidTeams: any = filteredPublicTeams?.filter(
      async (nft: any) => {
        const expiresAt = await readContract({
          contract: teamContract,
          method: 'expiresAt',
          params: [nft?.metadata?.id],
        })

        return +expiresAt.toString() > now
      }
    )

    const sortedValidTeams = filteredValidTeams
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

    const citizenContract = getContract({
      client: serverClient,
      address: CITIZEN_ADDRESSES[chainSlug],
      chain: chain,
      abi: CitizenABI as any,
    })

    const citizens: NFT[] = []
    for (const row of citizenRows) {
      citizens.push(citizenRowToNFT(row))
    }

    const filteredPublicCitizens: any = citizens?.filter(
      (nft: any) =>
        nft.metadata.attributes?.find((attr: any) => attr.trait_type === 'view')
          .value === 'public' && !blockedCitizens.includes(nft.metadata.id)
    )

    const filteredValidCitizens: any = filteredPublicCitizens?.filter(
      async (nft: any) => {
        const expiresAt = await readContract({
          contract: citizenContract,
          method: 'expiresAt',
          params: [nft?.metadata?.id],
        })

        return +expiresAt.toString() > now
      }
    )

    return {
      props: {
        filteredTeams: sortedValidTeams,
        filteredCitizens: filteredValidCitizens.reverse(),
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error(error)
    return {
      props: { filteredTeams: [], filteredCitizens: [] },
      revalidate: 60,
    }
  }
}
