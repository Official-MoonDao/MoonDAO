import { FEATURED_MISSION, FREE_MINT_THRESHOLD_LABEL } from 'const/config'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'

export default function MissionBanner() {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(true)

  // Hide banner if user is on any mission page
  const isOnMissionPage = router.pathname === '/mission/[tokenId]'

  if (
    !isVisible ||
    isOnMissionPage ||
    process.env.NEXT_PUBLIC_HIDE_BANNER === 'true' ||
    !FEATURED_MISSION
  ) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#090D21]/95 backdrop-blur-md text-white border-t border-white/[0.06]">
      <div className="relative overflow-hidden h-11 sm:h-12 flex items-center w-full px-3 sm:px-4">
        {/* Close button */}
        <button
          onClick={() => setIsVisible(false)}
          className="flex-shrink-0 hover:bg-white/10 rounded-full p-1 transition-colors group"
          aria-label="Close banner"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5 text-white/30 group-hover:text-white/70 transition-colors"
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

        {/* Scrolling text */}
        <div className="flex-1 mx-3 relative min-w-0">
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#090D21] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#090D21] to-transparent z-10 pointer-events-none" />

          <div className="marquee-container overflow-hidden">
            <div className="marquee-content">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className="inline-flex items-center whitespace-nowrap px-6 sm:px-8 text-xs sm:text-sm"
                >
                  <span className="font-medium text-[#F9B95C]">
                    Featured Mission
                  </span>
                  <span className="mx-3 text-white/15">·</span>
                  <span className="font-medium text-white/90">
                    {FEATURED_MISSION.name}
                  </span>
                  <span className="mx-3 text-white/15">·</span>
                  <span className="text-white/50">
                    {FEATURED_MISSION.description}
                  </span>
                  <span className="mx-3 text-white/15">·</span>
                  <span className="text-white/50">
                    {`Contribute ${FREE_MINT_THRESHOLD_LABEL} for a free citizenship.`}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <Link
          href={`/mission/${FEATURED_MISSION.id}`}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 bg-gradient-to-r from-[#6C407D] to-[#5F4BA2] hover:from-[#7A4A8C] hover:to-[#6B57B7] text-white text-xs sm:text-sm font-medium rounded-full transition-colors whitespace-nowrap"
        >
          <span className="hidden sm:inline">Support Mission</span>
          <span className="sm:hidden">Support</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3"
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

      <style jsx>{`
        .marquee-container {
          width: 100%;
          overflow: hidden;
        }

        .marquee-content {
          display: inline-flex;
          animation: marquee 90s linear infinite;
        }

        @media (max-width: 640px) {
          .marquee-content {
            animation: marquee 60s linear infinite;
          }
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
