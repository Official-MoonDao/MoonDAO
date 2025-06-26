import HatsABI from 'const/abis/Hats.json'
import ProjectABI from 'const/abis/Project.json'
import { HATS_ADDRESS, PROJECT_ADDRESSES } from 'const/config'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useState, useEffect, useCallback, useContext, useMemo } from 'react'
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
  projects: Project[]
}

export default function PastProjects({ projects }: PastProjectProps) {
  const finalReportProjects = useMemo(
    () => projects.filter((p) => p.finalReportIPFS || p.finalReportLink),
    [projects]
  )
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
      input != ''
        ? filterBySearch(finalReportProjects).length
        : finalReportProjects.length

    setMaxPage(Math.ceil(totalProjects / 9))
  }, [input, finalReportProjects])

  const [cachedNFTs, setCachedNFTs] = useState<Project[]>([])

  const [pageIdx, setPageIdx] = useState(1)

  useEffect(() => {
    const { page: urlPage } = router.query
    if (urlPage && !isNaN(Number(urlPage))) {
      setPageIdx(Number(urlPage))
    }
  }, [router.query])

  useEffect(() => {
    setCachedNFTs(
      input != '' ? filterBySearch(finalReportProjects) : finalReportProjects
    )
  }, [input, finalReportProjects, router.query])

  useChainDefault()

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-GoodTimes text-white/80 text-xl mb-4">
          Past Projects
        </h1>
        <div className="bg-black/20 rounded-xl p-4 border border-white/10">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              className="w-full pl-10 pr-4 py-3 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
              onChange={({ target }) => setInput(target.value)}
              value={input}
              type="text"
              name="search"
              placeholder="Search projects..."
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {cachedNFTs?.[0] ? (
          cachedNFTs
            ?.slice((pageIdx - 1) * 9, pageIdx * 9)
            .map((project: any, I: number) => {
              return (
                <div
                  key={`project-card-${I}`}
                  className="bg-black/20 rounded-xl border border-white/10 overflow-hidden"
                >
                  <ProjectCard
                    key={`project-card-${I}`}
                    project={project}
                    projectContract={projectContract}
                    hatsContract={hatsContract}
                  />
                </div>
              )
            })
        ) : (
          <>
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={`card-skeleton-${i}`}
                className="bg-black/20 rounded-xl border border-white/10 overflow-hidden"
              >
                <CardSkeleton />
              </div>
            ))}
          </>
        )}
      </div>
      <div className="mt-6 bg-black/20 rounded-xl p-4 border border-white/10">
        <div
          id="pagination-container"
          className="w-full flex font-GoodTimes text-lg flex-row justify-center items-center gap-8"
        >
          <button
            onClick={() => {
              if (pageIdx > 1) {
                handlePageChange(pageIdx - 1)
              }
            }}
            className={`pagination-button p-2 rounded-lg transition-all duration-200 ${
              pageIdx === 1
                ? 'opacity-30 cursor-not-allowed'
                : 'cursor-pointer opacity-100 hover:bg-white/10 hover:scale-110'
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
          <p id="page-number" className="px-5 font-bold text-white/80">
            Page {pageIdx} of {maxPage}
          </p>
          <button
            onClick={() => {
              if (pageIdx < maxPage) {
                handlePageChange(pageIdx + 1)
              }
            }}
            className={`pagination-button p-2 rounded-lg transition-all duration-200 ${
              pageIdx === maxPage
                ? 'opacity-30 cursor-not-allowed'
                : 'cursor-pointer opacity-100 hover:bg-white/10 hover:scale-110'
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
  )
}
