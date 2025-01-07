import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import { useContract } from '@thirdweb-dev/react'
import HatsABI from 'const/abis/Hats.json'
import ProjectABI from 'const/abis/Project.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  HATS_ADDRESS,
  PROJECT_ADDRESSES,
  PROJECT_TABLE_ADDRESSES,
  TABLELAND_ENDPOINT,
} from 'const/config'
import { blockedProjects } from 'const/whitelist'
import Image from 'next/image'
import { useRouter } from 'next/router'
import React, { useState, useEffect, useCallback, useContext } from 'react'
import { Project } from '@/lib/project/useProjectData'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import CardGridContainer from '@/components/layout/CardGridContainer'
import CardSkeleton from '@/components/layout/CardSkeleton'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import Search from '@/components/layout/Search'
import Tab from '@/components/layout/Tab'
import ProjectCard from '@/components/project/ProjectCard'

type NetworkProps = {
  activeProjects: Project[]
  inactiveProjects: Project[]
}

export default function Projects({
  activeProjects,
  inactiveProjects,
}: NetworkProps) {
  const { selectedChain } = useContext(ChainContext)
  const router = useRouter()
  const shallowQueryRoute = useShallowQueryRoute()

  //Contracts
  const { contract: projectContract } = useContract(
    PROJECT_ADDRESSES[selectedChain.slug],
    ProjectABI
  )
  const { contract: hatsContract } = useContract(HATS_ADDRESS, HatsABI)

  const [input, setInput] = useState('')
  function filterBySearch(projects: Project[]) {
    return projects.filter((project) => {
      return project.name
        ?.toString()
        .toLowerCase()
        .includes(input.toLowerCase())
    })
  }

  const [tab, setTab] = useState<string>('active')
  function loadByTab(tab: string) {
    if (tab === 'active') {
      setCachedNFTs(
        input != '' ? filterBySearch(activeProjects) : activeProjects
      )
    } else if (tab === 'inactive') {
      setCachedNFTs(
        input != '' ? filterBySearch(inactiveProjects) : inactiveProjects
      )
    } else {
      const nfts =
        activeProjects?.[0] && inactiveProjects?.[0]
          ? [...activeProjects, ...inactiveProjects]
          : activeProjects?.[0]
          ? activeProjects
          : inactiveProjects?.[0]
          ? inactiveProjects
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
    const totalActiveProjects =
      input != ''
        ? filterBySearch(activeProjects).length
        : activeProjects.length
    const totalInactiveProjects =
      input != ''
        ? filterBySearch(inactiveProjects).length
        : inactiveProjects.length

    if (tab === 'active') setMaxPage(Math.ceil(totalActiveProjects / 9))
    if (tab === 'inactive') setMaxPage(Math.ceil(totalInactiveProjects / 9))
  }, [tab, input, activeProjects, inactiveProjects])

  const [cachedNFTs, setCachedNFTs] = useState<Project[]>([])

  const [pageIdx, setPageIdx] = useState(1)

  useEffect(() => {
    const { tab: urlTab, page: urlPage } = router.query
    if (urlTab && (urlTab === 'active' || urlTab === 'inactive')) {
      setTab(urlTab as string)
    }
    if (urlPage && !isNaN(Number(urlPage))) {
      setPageIdx(Number(urlPage))
    }
  }, [router.query])

  useEffect(() => {
    loadByTab(tab)
  }, [tab, input, activeProjects, inactiveProjects, router.query])

  useChainDefault()

  const description =
    'Discover active and archived projects advancing our multiplanetary mission. Have an idea? Submit your proposal and help shape the future of space exploration!'

  const descriptionSection = (
    <div className="pt-2">
      <div className="mb-4">{description}</div>
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
                Inactive
              </Tab>
            </div>
          </Frame>
        </div>
      </div>
    </div>
  )

  return (
    <section id="network-container" className="overflow-hidden">
      <Head
        title={'Projects'}
        description={description}
        image="https://ipfs.io/ipfs/QmbExwDgVoDYpThFaVRRxUkusHnXxMj3Go8DdWrXg1phxi"
      />
      <Container>
        <ContentLayout
          header="Projects"
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
                  .map((project: any, I: number) => {
                    return (
                      <ProjectCard
                        key={`project-card-${I}`}
                        project={project}
                        projectContract={projectContract}
                        hatsContract={hatsContract}
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

export async function getStaticProps() {
  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
  const sdk = initSDK(chain)

  const projectTableContract = await sdk.getContract(
    PROJECT_TABLE_ADDRESSES[chain.slug],
    ProjectTableABI
  )

  const projectTableName = await projectTableContract.call('getTableName')
  const projectStatement = `SELECT * FROM ${projectTableName}`
  const projectsRes = await fetch(
    `${TABLELAND_ENDPOINT}?statement=${projectStatement}`
  )
  const projects = await projectsRes.json()

  const activeProjects = []
  const inactiveProjects = []
  for (let i = 0; i < projects.length; i++) {
    if (!blockedProjects.includes(i)) {
      const active = projects[i].active
      if (!active || active === 0) {
        inactiveProjects.push(projects[i])
      } else if (active === 1) {
        activeProjects.push(projects[i])
      }
    }
  }

  return {
    props: {
      activeProjects: activeProjects.reverse(),
      inactiveProjects: inactiveProjects.reverse(),
    },
    revalidate: 60,
  }
}
