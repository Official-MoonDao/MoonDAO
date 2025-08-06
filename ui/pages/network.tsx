import { PlusCircleIcon } from '@heroicons/react/20/solid'
import { GlobeAmericasIcon, ListBulletIcon } from '@heroicons/react/24/outline'
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
import NetworkSection from '@/components/home/NetworkSection'
import CreateCitizen from '@/components/onboarding/CreateCitizen'
import CreateTeam from '@/components/onboarding/CreateTeam'
import CitizenTier from '@/components/onboarding/CitizenTier'
import TeamTier from '@/components/onboarding/TeamTier'
import Job, { Job as JobType } from '../components/jobs/Job'
import CitizenABI from '../const/abis/Citizen.json'
import TeamABI from '../const/abis/Team.json'
import JobsABI from '../const/abis/JobBoardTable.json'

type NetworkProps = {
  filteredTeams: any[]
  filteredCitizens: any[]
  jobs: JobType[]
}

export default function Network({
  filteredTeams,
  filteredCitizens,
  jobs,
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
            <div className="w-full min-w-0 max-w-[250px] sm:max-w-[280px] md:max-w-[320px] bg-black/20 backdrop-blur-sm rounded-xl border border-white/10 px-3 py-1">
              <Search
                className="w-full flex-grow"
                input={input}
                setInput={setInput}
                placeholder={tab === 'teams' ? 'Search teams' : 'Search citizens'}
              />
            </div>

            <div
              id="filter-container"
              className="hidden min-[1150px]:block flex-shrink-0"
            >
              <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-white/10 p-1.5">
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
            <div className="w-fit max-w-[300px] sm:max-w-none h-fit bg-black/20 backdrop-blur-sm rounded-xl border border-white/10 p-1.5 overflow-x-auto">
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
          : generatePrettyLinkWithId(nft.metadata.name, nft.id.toString())
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
        {/* Hero Section */}
        <div className="relative w-full h-screen rounded-3xl overflow-hidden">
          <Image
            src="/assets/NetworkHero.png"
            alt="Space Acceleration Network"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center max-w-4xl px-8">
              <h1 className="header font-GoodTimes text-white drop-shadow-lg mb-4">
                Space Acceleration Network
              </h1>
              <p className="sub-header text-white/90 drop-shadow-lg">
                The Space Acceleration Network is an onchain startup society focused on building a permanent settlement on the Moon and beyond
              </p>
              <StandardButton
                className="gradient-2 hover:opacity-90 transition-opacity"
                textColor="text-white"
                borderRadius="rounded-xl"
                hoverEffect={false}
                link="/join"
              >
                Join the Network
              </StandardButton>
            </div>
          </div>
        </div>
      </Container>

      <Container>
      {/* Join MoonDAO Section */}
      <div id="join-moondao" className="relative w-full py-16 md:py-24">
        <div className="absolute inset-0">
          <Image
            src="/assets/JoinImage.png"
            alt="Join MoonDAO"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>
        
        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <div className="text-center mb-8">
            <h2 className="header font-GoodTimes text-white mb-4 drop-shadow-lg">
              Join MoonDAO
            </h2>
            <p className="sub-header text-white/90 max-w-3xl mx-auto drop-shadow-lg">
              Join our decentralized space collective and help accelerate humanity's expansion to the Moon and beyond
            </p>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 h-full">
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 mb-6 rounded-xl overflow-hidden">
                    <Image
                      src="/assets/citizen-default.png"
                      width={96}
                      height={96}
                      alt="Become a Citizen"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-2xl font-GoodTimes text-white mb-4">Become a Citizen</h3>
                  <p className="text-slate-300 mb-6 leading-relaxed">
                    Citizens are the trailblazers supporting the creation of off-world settlements. Whether you're already part of a team or seeking to join one, everyone has a crucial role to play in this mission.
                  </p>
                  <div className="flex flex-col items-center mb-6">
                    <div className="text-2xl font-semibold text-white">~$41 / Year</div>
                    <div className="text-sm text-slate-400">(0.0111 Arbitrum ETH)</div>
                    <div className="text-green-400 text-sm font-medium mt-2">✓ 12 Month Passport</div>
                  </div>
                  <StandardButton
                    className="gradient-2 hover:opacity-90 transition-opacity"
                    textColor="text-white"
                    borderRadius="rounded-xl"
                    hoverEffect={false}
                    link="/join"
                  >
                    Become a Citizen
                  </StandardButton>
                </div>
              </div>
            </div>
            
            <div className="flex-1">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 h-full">
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 mb-6 rounded-xl overflow-hidden">
                    <Image
                      src="/assets/team_image.png"
                      width={96}
                      height={96}
                      alt="Create a Team"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-2xl font-GoodTimes text-white mb-4">Create a Team</h3>
                  <p className="text-slate-300 mb-6 leading-relaxed">
                    Teams are driving innovation and tackling ambitious space challenges together. From non-profits to startups and university teams, every group has something to contribute to our multiplanetary future.
                  </p>
                  <div className="flex flex-col items-center mb-6">
                    <div className="text-2xl font-semibold text-white">~$122 / Year</div>
                    <div className="text-sm text-slate-400">(0.0333 Arbitrum ETH)</div>
                    <div className="text-green-400 text-sm font-medium mt-2">✓ 12 Month Passport</div>
                  </div>
                  <StandardButton
                    className="gradient-2 hover:opacity-90 transition-opacity"
                    textColor="text-white"
                    borderRadius="rounded-xl"
                    hoverEffect={false}
                    link="/join"
                  >
                    Create a Team
                  </StandardButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </Container>

      <Container>

        {/* Network Explainer Section */}
        <NetworkSection />

        {/* Explore the Network Header */}
        <div id="explore-network-header" className="max-w-6xl mx-auto mb-8 px-6 pt-16">
          <h2 className="header font-GoodTimes text-white text-center mb-4">
            Explore the Network
          </h2>
          <p className="sub-header text-white/80 text-center mb-12 max-w-3xl mx-auto">
            Discover and connect with citizens and teams building the future of space exploration
          </p>
        </div>

        {/* Controls Section */}
        <div id="network-controls" className="max-w-6xl mx-auto mb-8 px-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Search Bar */}
            <div className="w-full lg:w-auto min-w-0 max-w-[320px] bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 px-4 py-3">
              <Search
                className="w-full"
                input={input}
                setInput={setInput}
                placeholder={tab === 'teams' ? 'Search teams' : 'Search citizens'}
              />
            </div>

            {/* Tabs */}
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
                  setTab={() => {
                    router.push('/map')
                  }}
                  icon={<GlobeAmericasIcon width={20} height={20} />}
                >
                  Map
                </Tab>
              </div>
            </div>

            {/* Join Button */}
            <StandardButton
              className="gradient-2 rounded-2xl hover:scale-105 transition-transform"
              hoverEffect={false}
              link="/join"
            >
              <div className="flex items-center justify-start gap-2">
                <PlusCircleIcon width={20} height={20} />
                Join Network
              </div>
            </StandardButton>
          </div>
        </div>

        {/* Content Grid */}
        <div id="network-content-grid" className="max-w-6xl mx-auto px-6">
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

            {/* Pagination */}
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
          </div>
        </div>

        {/* Jobs Section */}
        <div id="space-careers" className="max-w-6xl mx-auto mb-16 px-6 pt-16">
          <div className="text-center mb-8">
            <h2 className="header font-GoodTimes text-white mb-4">
              Jobs Board
            </h2>
            <p className="sub-header text-white/80 max-w-3xl mx-auto mb-8">
              Join the mission to expand humanity to the Moon and beyond. Explore opportunities with teams in the Space Acceleration Network.
            </p>
          </div>

          <div className={`bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 md:p-8 relative ${!citizen ? 'overflow-hidden' : ''}`}>
            {!citizen && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-8">
                  <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-GoodTimes text-white mb-3">Citizen Access Required</h3>
                  <p className="text-slate-300 mb-6 leading-relaxed">
                    You must be a Citizen of the Space Acceleration Network to view the jobs board and explore career opportunities.
                  </p>
                  <StandardButton
                    className="gradient-2 hover:opacity-90 transition-opacity"
                    textColor="text-white"
                    borderRadius="rounded-xl"
                    hoverEffect={false}
                    link="/join"
                  >
                    Become a Citizen
                  </StandardButton>
                </div>
              </div>
            )}
            
            <div className={!citizen ? 'blur-sm pointer-events-none' : ''}>
              {jobs && jobs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {jobs.slice(0, 6).map((job: JobType, index: number) => (
                    <div key={`job-${job.id}`} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                          {job.tag || 'Open'}
                        </span>
                      </div>
                      <h3 className="text-lg font-GoodTimes text-white mb-2 line-clamp-1">
                        {job.title}
                      </h3>
                      <p className="text-slate-300 text-sm mb-4 line-clamp-3">
                        {job.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Team #{job.teamId}</span>
                        <StandardButton
                          backgroundColor="bg-blue-600 hover:bg-blue-700"
                          textColor="text-white"
                          borderRadius="rounded-lg"
                          hoverEffect={false}
                          link="/jobs"
                          className="text-sm py-2 px-4"
                        >
                          View Job
                        </StandardButton>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-GoodTimes text-white mb-2">No Jobs Available</h3>
                  <p className="text-slate-400 max-w-md mx-auto">
                    There are currently no open positions. Check back soon for new opportunities to join the space mission!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-center w-full">
          <NoticeFooter />
        </div>
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

    // Fetch jobs data
    const jobTableContract = getContract({
      client: serverClient,
      address: JOBS_TABLE_ADDRESSES[chainSlug],
      chain: chain,
      abi: JobsABI as any,
    })

    const jobBoardTableName = await readContract({
      contract: jobTableContract,
      method: 'getTableName',
    })

    const jobStatement = `SELECT * FROM ${jobBoardTableName} WHERE (endTime = 0 OR endTime >= ${now}) ORDER BY id DESC LIMIT 6`
    const jobs = await queryTable(chain, jobStatement)

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
        jobs: jobs || [],
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error(error)
    return {
      props: { filteredTeams: [], filteredCitizens: [], jobs: [] },
      revalidate: 60,
    }
  }
}
