import {
  ANNOUNCE_PROJECT_BUDGET,
  PROJECT_SYSTEM_CONFIG,
  NEXT_QUARTER_BUDGET_USD,
  MAX_BUDGET_USD,
} from 'const/config'
import { endOfConfigDeadline } from '@/lib/utils/dates'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'

const PROJECT_PAGES = [
  '/projects-overview',
  '/projects',
  '/proposals',
  '/proposal-template',
  '/submit',
]

// Routes this banner must never appear on, whatever the deadline says. The
// moonbase is a fixed, fullscreen scene that docks its own controls along the
// bottom edge; this banner is fixed to that same edge at z-40 and lands squarely
// on the year scrubber. Matched by prefix so /moonbase/[projectId] is covered
// as well as /moonbase itself.
const FULLSCREEN_PAGES = ['/moonbase']

// Check if deadline has passed (computed once on module load)
const SUBMISSION_DEADLINE = endOfConfigDeadline(PROJECT_SYSTEM_CONFIG.submissionDeadline)

export default function ProjectBanner() {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(true)

  // Hide banner if user is on project-related pages
  const isOnProjectPage = PROJECT_PAGES.includes(router.pathname)

  const isOnFullscreenPage = FULLSCREEN_PAGES.some(
    (page) =>
      router.pathname === page || router.pathname.startsWith(`${page}/`)
  )

  // Hide banner if submission deadline has passed
  const isDeadlinePassed = new Date() > SUBMISSION_DEADLINE

  if (
    !ANNOUNCE_PROJECT_BUDGET ||
    !isVisible ||
    isOnProjectPage ||
    isOnFullscreenPage ||
    isDeadlinePassed ||
    process.env.NEXT_PUBLIC_HIDE_PROJECT_BANNER === 'true'
  ) {
    return null
  }

  const budgetDisplay = `$${NEXT_QUARTER_BUDGET_USD.toLocaleString()}`

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-dark-cool text-white">
      <div className="relative flex h-12 w-full items-center overflow-hidden px-3 sm:px-4">
        <button
          onClick={() => setIsVisible(false)}
          className="shrink-0 rounded-full p-1 text-white/30 transition-colors hover:bg-white/10 hover:text-white/70"
          aria-label="Close banner"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
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

        <div className="relative mx-3 min-w-0 flex-1">
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-8 bg-gradient-to-r from-dark-cool to-transparent" />
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-8 bg-gradient-to-l from-dark-cool to-transparent" />

          <div className="marquee-container overflow-hidden">
            <div className="marquee-content">
              {[0, 1].map((i) => (
                <span
                  key={i}
                  className="inline-flex items-center whitespace-nowrap px-6 text-xs sm:px-8 sm:text-sm"
                >
                  <span className="font-medium text-moon-gold">
                    Project Proposals Open
                  </span>
                  <span className="mx-3 text-white/15">·</span>
                  <span className="font-medium text-white/90">
                    Deadline: {PROJECT_SYSTEM_CONFIG.submissionDeadline}
                  </span>
                  <span className="mx-3 text-white/15">·</span>
                  <span className="text-white/55">
                    Total Budget: {budgetDisplay}
                  </span>
                  <span className="mx-3 text-white/15">·</span>
                  <span className="text-white/55">
                    Max per project: ${MAX_BUDGET_USD.toLocaleString()}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <Link
          href={PROJECT_SYSTEM_CONFIG.submissionUrl}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-moon-gold px-3.5 py-1.5 text-xs font-semibold text-[#1c1408] transition duration-150 hover:brightness-105 sm:px-4 sm:text-sm"
        >
          <span className="hidden sm:inline">Submit Proposal</span>
          <span className="sm:hidden">Submit</span>
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
