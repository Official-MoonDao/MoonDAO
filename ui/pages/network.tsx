import { MapIcon } from '@heroicons/react/24/outline'
import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import { NFT } from '@thirdweb-dev/react'
import { CITIZEN_ADDRESSES, TEAM_ADDRESSES } from 'const/config'
import {
  blockedCitizens,
  blockedTeams,
  featuredEntities,
} from 'const/whitelist'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useState, useEffect, useCallback } from 'react'
import { generatePrettyLinks } from '@/lib/subscription/pretty-links'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { initSDK } from '@/lib/thirdweb/thirdweb'
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
import Tab from '@/components/layout/Tab'

type NetworkProps = {
  filteredTeams: NFT[]
  filteredCitizens: NFT[]
  prettyLinks: {
    team: Record<number, string>
    citizen: Record<number, string>
  }
}

export default function Network({
  filteredTeams,
  filteredCitizens,
  prettyLinks,
}: NetworkProps) {
  const router = useRouter()
  const shallowQueryRoute = useShallowQueryRoute()

  const [input, setInput] = useState('')
  function filterBySearch(nfts: NFT[]) {
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

  const [cachedNFTs, setCachedNFTs] = useState<NFT[]>([])

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
            </div>
          </Frame>
        </div>

        <StandardButton
          className="gradient-2 h-[40px]"
          onClick={() => router.push('/map')}
        >
          <MapIcon width={20} height={20} />
        </StandardButton>
      </div>
    </div>
  )

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
            <CardGridContainer>
              {cachedNFTs?.[0] ? (
                cachedNFTs
                  ?.slice((pageIdx - 1) * 9, pageIdx * 9)
                  .map((nft: any, I: number) => {
                    if (nft.metadata.name !== 'Failed to load NFT metadata') {
                      const type = nft.metadata.attributes.find(
                        (attr: any) => attr.trait_type === 'communications'
                      )
                        ? 'team'
                        : 'citizen'
                      return (
                        <div
                          className="justify-center mt-5 flex"
                          key={'team-citizen-' + I}
                        >
                          <Card
                            inline
                            metadata={nft.metadata}
                            owner={nft.owner}
                            type={type}
                            hovertext="Explore Profile"
                            prettyLink={prettyLinks?.[type]?.[nft.metadata.id]}
                          />
                        </div>
                      )
                    }
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

export async function getStaticProps() {
  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
  const sdk = initSDK(chain)
  const now = Math.floor(Date.now() / 1000)

  const teamContract = await sdk.getContract(TEAM_ADDRESSES[chain.slug])
  const totalTeams = await teamContract.call('totalSupply')

  const teams = [] //replace with teamContract.erc721.getAll() if all teams load
  for (let i = 0; i < totalTeams; i++) {
    if (!blockedTeams.includes(i)) {
      const team = await teamContract.erc721.get(i)
      teams.push(team)
    }
  }

  const filteredPublicTeams: any = teams?.filter(
    (nft: any) =>
      nft.metadata.attributes?.find((attr: any) => attr.trait_type === 'view')
        .value === 'public' && !blockedTeams.includes(nft.metadata.id)
  )

  const filteredValidTeams: any = filteredPublicTeams?.filter(
    async (nft: any) => {
      const expiresAt = await teamContract.call('expiresAt', [
        nft?.metadata?.id,
      ])

      return expiresAt.toNumber() > now
    }
  )

  const citizenContract = await sdk.getContract(CITIZEN_ADDRESSES[chain.slug])
  const totalCitizens = await citizenContract.call('totalSupply')

  const citizens = [] //replace with citizenContract.erc721.getAll() if all citizens load
  for (let i = 0; i < totalCitizens.toNumber(); i++) {
    if (!blockedCitizens.includes(i)) {
      const citizen = await citizenContract.erc721.get(i)
      citizens.push(citizen)
    }
  }

  const filteredPublicCitizens: any = citizens?.filter(
    (nft: any) =>
      nft.metadata.attributes?.find((attr: any) => attr.trait_type === 'view')
        .value === 'public' && !blockedCitizens.includes(nft.metadata.id)
  )

  const filteredValidCitizens: any = filteredPublicCitizens?.filter(
    async (nft: any) => {
      const expiresAt = await citizenContract.call('expiresAt', [
        nft?.metadata?.id,
      ])

      return expiresAt.toNumber() > now
    }
  )

  //Generate pretty links
  const prettyLinks = {
    team: {},
    citizen: {},
  }
  const teamPrettyLinkData = filteredValidTeams.map((nft: any) => ({
    name: nft?.metadata?.name,
    id: nft?.metadata?.id,
  }))
  const { idToPrettyLink: teamIdToPrettyLink } =
    generatePrettyLinks(teamPrettyLinkData)

  prettyLinks.team = teamIdToPrettyLink

  const citizenPrettyLinkData = filteredValidCitizens.map((nft: any) => ({
    name: nft?.metadata?.name,
    id: nft?.metadata?.id,
  }))
  const { idToPrettyLink: citizenIdToPrettyLink } = generatePrettyLinks(
    citizenPrettyLinkData
  )

  prettyLinks.citizen = citizenIdToPrettyLink

  return {
    props: {
      filteredTeams: filteredValidTeams.reverse(),
      filteredCitizens: filteredValidCitizens.reverse(),
      prettyLinks,
    },
    revalidate: 60,
  }
}
