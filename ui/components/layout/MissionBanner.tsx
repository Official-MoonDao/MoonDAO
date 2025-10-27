import Link from 'next/link'
import { useEffect, useState } from 'react'

type MissionData = {
  id: string
  name: string
  description: string
}

type MissionBannerProps = {
  missions?: any[]
}

export default function MissionBanner({ missions }: MissionBannerProps) {
  const [latestMission, setLatestMission] = useState<MissionData | null>(null)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (missions && missions.length > 0) {
      const mission = missions[0]
      setLatestMission({
        id: String(mission.id),
        name: mission.metadata?.name || 'Featured Mission',
        description: mission.metadata?.description || mission.metadata?.tagline || 'Support this mission',
      })
    }
  }, [missions])

  if (!latestMission || !isVisible) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl border-t border-slate-700/50 backdrop-blur-sm">
      <div className="relative overflow-hidden h-16 flex items-center max-w-7xl mx-auto px-4">
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

        {/* Scrolling text container */}
        <div className="flex-1 ml-12 mr-4 overflow-hidden">
          <div className="marquee-container">
            <div className="marquee-content">
              <span className="inline-flex items-center gap-3 whitespace-nowrap px-8">
                <span className="text-sm font-medium text-slate-300">Featured Mission:</span>
                <span className="text-base font-semibold">{latestMission.name}</span>
                <span className="mx-2">•</span>
                <span className="text-sm text-slate-400">{latestMission.description}</span>
              </span>
              {/* Duplicate for seamless loop */}
              <span className="inline-flex items-center gap-3 whitespace-nowrap px-8">
                <span className="text-sm font-medium text-slate-300">Featured Mission:</span>
                <span className="text-base font-semibold">{latestMission.name}</span>
                <span className="mx-2">•</span>
                <span className="text-sm text-slate-400">{latestMission.description}</span>
              </span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="pr-4 flex-shrink-0">
          <Link
            href={`/mission/${latestMission.id}`}
            className="inline-flex items-center px-5 py-2 bg-white text-slate-900 font-semibold text-sm rounded-md hover:bg-slate-100 transition-all duration-200 shadow-sm"
          >
            Support Mission
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 ml-1.5"
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
          animation: marquee 60s linear infinite;
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
