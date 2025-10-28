import MissionTableABI from 'const/abis/MissionTable.json'
import JBV5Controller from 'const/abis/JBV5Controller.json'
import { DEFAULT_CHAIN_V5, FEATURED_MISSION_INDEX, MISSION_TABLE_ADDRESSES, JBV5_CONTROLLER_ADDRESS } from 'const/config'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { readContract } from 'thirdweb'

type MissionData = {
  id: string
  name: string
  description: string
}

export default function MissionBanner() {
  const [featuredMission, setFeaturedMission] = useState<MissionData | null>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  const selectedChain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(selectedChain)

  const missionTableContract = useContract({
    address: MISSION_TABLE_ADDRESSES[chainSlug],
    abi: MissionTableABI,
    chain: selectedChain,
  })

  const jbControllerContract = useContract({
    address: JBV5_CONTROLLER_ADDRESS,
    abi: JBV5Controller.abi,
    chain: selectedChain,
  })

  useEffect(() => {
    async function fetchFeaturedMission() {
      if (!missionTableContract || !jbControllerContract || isLoading) return

      try {
        setIsLoading(true)

        // Get mission table name
        const missionTableName = await readContract({
          contract: missionTableContract,
          method: 'getTableName' as string,
          params: [],
        })

        // Query missions ordered by ID desc to get latest
        const statement = `SELECT * FROM ${missionTableName} ORDER BY id DESC LIMIT ${FEATURED_MISSION_INDEX + 1}`
        const response = await fetch(`/api/tableland/query?statement=${encodeURIComponent(statement)}`)
        const missionRows = await response.json()

        if (missionRows && missionRows.length > FEATURED_MISSION_INDEX) {
          const mission = missionRows[FEATURED_MISSION_INDEX]

          // Get mission metadata
          const metadataURIResult = await readContract({
            contract: jbControllerContract,
            method: 'uriOf' as string,
            params: [mission.projectId],
          })

          let missionName = 'Featured Mission'
          // Handle the result - it might be an array or string
          const metadataURI = Array.isArray(metadataURIResult) ? metadataURIResult[0] : metadataURIResult
          
          if (metadataURI && typeof metadataURI === 'string') {
            try {
              const metadataResponse = await fetch(`https://ipfs.io/ipfs/${metadataURI.replace('ipfs://', '')}`)
              const metadata = await metadataResponse.json()
              missionName = metadata.name || 'Featured Mission'
            } catch (error) {
              console.error('Failed to fetch mission metadata:', error)
            }
          }

          setFeaturedMission({
            id: String(mission.id),
            name: missionName,
            description: 'Contribute to MoonDAO\'s featured mission today and help advance humanity\'s future in space',
          })
        }
      } catch (error) {
        console.error('Failed to fetch featured mission:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchFeaturedMission()
  }, [missionTableContract, jbControllerContract])

  if (!featuredMission || !isVisible) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl border-t border-slate-700/50 backdrop-blur-sm">
      <div className="relative overflow-hidden h-16 flex items-center w-full px-4">
        {/* Close button */}
        <button
          onClick={() => setIsVisible(false)}
          className="absolute left-4 z-10 hover:bg-white/10 rounded p-1.5 transition-colors group"
          aria-label="Close banner"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Scrolling text container with fade effects */}
        <div className="flex-1 ml-12 mr-2 relative min-w-0">
          {/* Left fade overlay */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-900 to-transparent z-10 pointer-events-none"></div>
          
          {/* Right fade overlay */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none"></div>
          
          <div className="marquee-container overflow-hidden">
            <div className="marquee-content">
              <span className="inline-flex items-center gap-3 whitespace-nowrap px-8">
                <span className="text-sm font-medium text-slate-300">Featured Mission:</span>
                <span className="text-base font-semibold">{featuredMission.name}</span>
                <span className="mx-2">•</span>
                <span className="text-sm text-slate-400">{featuredMission.description}</span>
              </span>
              {/* Duplicate for seamless loop */}
              <span className="inline-flex items-center gap-3 whitespace-nowrap px-8">
                <span className="text-sm font-medium text-slate-300">Featured Mission:</span>
                <span className="text-base font-semibold">{featuredMission.name}</span>
                <span className="mx-2">•</span>
                <span className="text-sm text-slate-400">{featuredMission.description}</span>
              </span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex-shrink-0 ml-2">
          <Link
            href={`/mission/${featuredMission.id}`}
            className="inline-flex items-center px-3 sm:px-5 py-2 bg-white text-slate-900 font-semibold text-xs sm:text-sm rounded-md hover:bg-slate-100 transition-all duration-200 shadow-sm whitespace-nowrap"
          >
            <span className="hidden sm:inline">Support Mission</span>
            <span className="sm:hidden">Support</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 ml-1 sm:ml-1.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </div>
      </div>

      <style jsx>{`
        .marquee-container {
          width: 100%;
          overflow: hidden;
        }

        .marquee-content {
          display: inline-flex;
          animation: marquee 120s linear infinite;
        }

        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .marquee-content:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}
