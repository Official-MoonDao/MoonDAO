import HatsABI from 'const/abis/Hats.json'
import ProjectABI from 'const/abis/Project.json'
import { HATS_ADDRESS, PROJECT_ADDRESSES } from 'const/config'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, useEffect, useCallback, useContext } from 'react'
import { Project } from '@/lib/project/useProjectData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import CardGridContainer from '@/components/layout/CardGridContainer'
import CardSkeleton from '@/components/layout/CardSkeleton'
import Frame from '@/components/layout/Frame'
import Search from '@/components/layout/Search'
import ProjectCard from '@/components/project/ProjectCard'

type PastProjectProps = {
  projects: Project[] | undefined
}

export default function PastProjects({ projects }: PastProjectProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const router = useRouter()
  const shallowQueryRoute = useShallowQueryRoute()

  //Contracts
  const projectContract = useContract({
    address: PROJECT_ADDRESSES[chainSlug],
    abi: ProjectABI as any,
    chain: selectedChain,
  })

  const hatsContract = useContract({
    address: HATS_ADDRESS,
    abi: HatsABI as any,
    chain: selectedChain,
  })

  const [input, setInput] = useState('')
  function filterBySearch(projects: Project[]) {
    return projects.filter((project) => {
      return project.name
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
    const totalProjects =
      input != '' ? filterBySearch(projects).length : projects.length

    setMaxPage(Math.ceil(totalProjects / 9))
  }, [input, projects])

  const [cachedNFTs, setCachedNFTs] = useState<Project[]>([])

  const [pageIdx, setPageIdx] = useState(1)

  useEffect(() => {
    const { page: urlPage } = router.query
    if (urlPage && !isNaN(Number(urlPage))) {
      setPageIdx(Number(urlPage))
    }
  }, [router.query])

  useEffect(() => {
    setCachedNFTs(input != '' ? filterBySearch(projects) : projects)
  }, [input, projects, router.query])

  useChainDefault()

  return (
    <>
      <div className="pt-2">
        <h1 className="font-GoodTimes opacity-60 text-2xl">Past Projects</h1>
        <br />
        <Frame bottomLeft="20px" topLeft="5vmax" marginBottom="10px" noPadding>
          <Search input={input} setInput={setInput} />
        </Frame>
      </div>
      <CardGridContainer maxCols={2}>
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
              pageIdx === maxPage ? 'opacity-10' : 'cursor-pointer opacity-100'
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
  )
}
