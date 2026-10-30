import { electionPhase, ELECTIONS, getElection } from '@/lib/elections/elections'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'

// Same reasoning as ProjectBanner: the moonbase docks its own controls along
// the bottom edge, where this banner would sit on top of them.
const FULLSCREEN_PAGES = ['/moonbase']

// The published election that is open right now. Companion elections are
// skipped because their ballot already appears on the main election's page.
function findOpenElection() {
  const companions = new Set(ELECTIONS.map((e) => e.companionSlug).filter(Boolean))
  return (
    ELECTIONS.find(
      (e) => e.published && !companions.has(e.slug) && electionPhase(e) === 'open'
    ) ?? null
  )
}

function formatCloseLabel(closesAt: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(closesAt))
}

function formatTimeLeft(closesAt: string) {
  const ms = Date.parse(closesAt) - Date.now()
  // Rounded, to match the "in N days" on the election page.
  const days = Math.round(ms / 86_400_000)
  if (days >= 2) return `${days} days left`
  const hours = Math.max(1, Math.floor(ms / 3_600_000))
  return hours === 1 ? 'Final hour' : `${hours} hours left`
}

export default function ElectionBanner() {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(true)

  const election = findOpenElection()

  const isOnElectionPage = router.pathname.startsWith('/elections')
  const isOnFullscreenPage = FULLSCREEN_PAGES.some(
    (page) => router.pathname === page || router.pathname.startsWith(`${page}/`)
  )

  if (
    !election ||
    !election.closesAt ||
    !isVisible ||
    isOnElectionPage ||
    isOnFullscreenPage ||
    process.env.NEXT_PUBLIC_HIDE_ELECTION_BANNER === 'true'
  ) {
    return null
  }

  // Local binding so TS keeps the null check inside the map callback below.
  const closesAt = election.closesAt
  const companion = election.companionSlug ? getElection(election.companionSlug) : null
  const href = `/elections/${election.slug}`

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-dark-cool text-white"
      data-testid="election-banner"
    >
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
                    Help Shape the Future of the DAO
                  </span>
                  <span className="mx-3 text-white/15">·</span>
                  <span className="font-medium text-white/90">{election.title}</span>
                  {!election.hideCloseTime && (
                    <>
                      <span className="mx-3 text-white/15">·</span>
                      <span className="font-medium text-white/90">
                        Voting closes {formatCloseLabel(closesAt)} ({formatTimeLeft(closesAt)})
                      </span>
                    </>
                  )}
                  {companion && (
                    <>
                      <span className="mx-3 text-white/15">·</span>
                      <span className="text-white/55">Also on the ballot: {companion.title}</span>
                    </>
                  )}
                  <span className="mx-3 text-white/15">·</span>
                  <span className="text-white/55">Every vMOONEY holder can vote</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-moon-gold px-3.5 py-1.5 text-xs font-semibold text-[#1c1408] transition duration-150 hover:brightness-105 sm:px-4 sm:text-sm"
        >
          <span className="hidden sm:inline">Cast Your Vote</span>
          <span className="sm:hidden">Vote</span>
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
