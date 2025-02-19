import {
  GlobeAmericasIcon,
  MapIcon,
  ListBulletIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline'
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

    if (tab === 'teams') setMaxPage(Math.ceil(totalTeams / 9))
    if (tab === 'citizens') setMaxPage(Math.ceil(totalCitizens / 9))
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

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

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
      <Frame bottomLeft="20px" topLeft="5vmax" marginBottom="10px" noPadding>
        <Search input={input} setInput={setInput} />
      </Frame>
      <div className="w-full flex gap-4">
        <div
          id="filter-container"
          className="max-w-[350px] border-b-5 border-black"
        >
          <Frame noPadding>
            <div className="flex flex-wrap text-sm bg-filter">
              <Tab
                tab="teams"
                currentTab={tab}
                setTab={handleTabChange}
                icon="/../.././assets/icon-org.svg"
              >
                Teams
              </Tab>
              <Tab
                tab="citizens"
                currentTab={tab}
                setTab={handleTabChange}
                icon="/../.././assets/icon-passport.svg"
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
          </Frame>
        </div>
      </div>
      <div className="flex gap-2">
        <StandardButton
          className={`h-[40px] flex items-center justify-center ${
            viewMode === 'grid'
              ? 'gradient-2 opacity-100'
              : 'bg-mid-cool opacity-50'
          }`}
          onClick={() => setViewMode('grid')}
          hoverEffect={false}
        >
          <Squares2X2Icon width={30} height={30} />
        </StandardButton>

        <StandardButton
          className={`h-[40px] flex items-center justify-center ${
            viewMode === 'list'
              ? 'gradient-2 opacity-100'
              : 'bg-mid-cool opacity-50'
          }`}
          onClick={() => setViewMode('list')}
          hoverEffect={false}
        >
          <ListBulletIcon width={30} height={30} />
        </StandardButton>
      </div>
    </div>
  )

  const renderNFTs = () => {
    if (!cachedNFTs?.[0]) {
      return (
        <>
          {Array.from({ length: 9 }).map((_, i) => (
            <CardSkeleton key={`card-skeleton-${i}`} />
          ))}
        </>
      )
    }

    const nftsToShow = cachedNFTs?.slice((pageIdx - 1) * 9, pageIdx * 9)

    return nftsToShow.map((nft: any, I: number) => {
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
        <div className="justify-center flex" key={'team-citizen-' + I}>
          {viewMode === 'grid' ? (
            <Card
              inline
              metadata={nft.metadata}
              type={type}
              hovertext="Explore Profile"
              link={link}
            />
          ) : (
            <StandardDetailCard
              title={nft.metadata.name}
              paragraph={nft.metadata.description}
              image={nft.metadata.image}
            />
          )}
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
          header="The Network"
          headerSize="max(20px, 3vw)"
          description={descriptionSection}
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <>
            {viewMode === 'grid' ? (
              <CardGridContainer xsCols={1} smCols={2} mdCols={3} maxCols={3}>
                {renderNFTs()}
              </CardGridContainer>
            ) : (
              <CardGridContainer
                xsCols={1}
                smCols={1}
                mdCols={1}
                maxCols={2}
                noGap
              >
                {renderNFTs()}
              </CardGridContainer>
            )}

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

export async function getStaticProps() {
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
}
