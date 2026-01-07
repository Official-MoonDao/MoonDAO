import { PROJECT_SYSTEM_CONFIG } from 'const/config'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'

interface ProjectBannerProps {
  ethBudget?: number
  usdBudget?: number
}

export default function ProjectBanner({ ethBudget, usdBudget }: ProjectBannerProps) {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(true)

  // Hide banner if user is on project-related pages
  const isOnProjectPage = 
    router.pathname === '/projects-overview' ||
    router.pathname === '/projects' ||
    router.pathname === '/proposals' ||
    router.pathname === '/submit'

  if (
    !isVisible ||
    isOnProjectPage ||
    process.env.NEXT_PUBLIC_HIDE_PROJECT_BANNER === 'true'
  ) {
    return null
  }

  const budgetDisplay = ethBudget && usdBudget
    ? `${ethBudget.toFixed(2)} ETH ($${usdBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })})`
    : '7.83 ETH'

  const maxBudgetETH = ethBudget 
    ? (ethBudget * PROJECT_SYSTEM_CONFIG.maxBudgetPercentage).toFixed(2)
    : '2.08 ETH'

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-blue-900 via-purple-900 to-blue-900 text-white shadow-2xl border-t border-blue-700/50 backdrop-blur-sm">
      <div className="relative overflow-hidden h-16 flex items-center w-full px-4">
        {/* Close button */}
        <button
          onClick={() => setIsVisible(false)}
          className="absolute left-2 sm:left-4 z-10 hover:bg-white/10 rounded p-1 sm:p-1.5 transition-colors group"
          aria-label="Close banner"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-blue-300 group-hover:text-white transition-colors"
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
        <div className="flex-1 ml-8 sm:ml-12 mr-2 relative min-w-0">
          {/* Left fade overlay */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-blue-900 to-transparent z-10 pointer-events-none"></div>

          {/* Right fade overlay */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-blue-900 to-transparent z-10 pointer-events-none"></div>

          <div className="marquee-container overflow-hidden">
            <div className="marquee-content">
              <span className="inline-flex items-center gap-2 sm:gap-3 whitespace-nowrap px-6 sm:px-8">
                <span className="text-xs sm:text-sm font-medium text-blue-200">
                  🚀 Project Proposals Open
                </span>
                <span className="mx-1 sm:mx-2">•</span>
                <span className="text-sm sm:text-base font-semibold">
                  Deadline: {PROJECT_SYSTEM_CONFIG.submissionDeadline}
                </span>
                <span className="mx-1 sm:mx-2">•</span>
                <span className="text-xs sm:text-sm text-blue-200">
                  Total Budget: {budgetDisplay}
                </span>
                <span className="mx-1 sm:mx-2">•</span>
                <span className="text-xs sm:text-sm text-blue-200">
                  Max per project: {maxBudgetETH} ETH
                </span>
              </span>
              {/* Duplicate for seamless loop */}
              <span className="inline-flex items-center gap-2 sm:gap-3 whitespace-nowrap px-6 sm:px-8">
                <span className="text-xs sm:text-sm font-medium text-blue-200">
                  🚀 Project Proposals Open
                </span>
                <span className="mx-1 sm:mx-2">•</span>
                <span className="text-sm sm:text-base font-semibold">
                  Deadline: {PROJECT_SYSTEM_CONFIG.submissionDeadline}
                </span>
                <span className="mx-1 sm:mx-2">•</span>
                <span className="text-xs sm:text-sm text-blue-200">
                  Total Budget: {budgetDisplay}
                </span>
                <span className="mx-1 sm:mx-2">•</span>
                <span className="text-xs sm:text-sm text-blue-200">
                  Max per project: {maxBudgetETH} ETH
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex-shrink-0 ml-2">
          <Link
            href={PROJECT_SYSTEM_CONFIG.submissionUrl}
            className="inline-flex items-center px-3 sm:px-5 py-2 bg-white text-blue-900 font-semibold text-xs sm:text-sm rounded-md hover:bg-blue-50 transition-all duration-200 shadow-sm whitespace-nowrap"
          >
            <span className="hidden sm:inline">Submit Proposal</span>
            <span className="sm:hidden">Submit</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 sm:ml-1.5"
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

        @media (max-width: 640px) {
          .marquee-content {
            animation: marquee 40s linear infinite;
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
