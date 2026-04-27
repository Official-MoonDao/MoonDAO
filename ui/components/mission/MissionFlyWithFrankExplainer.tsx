import Link from 'next/link'

type MissionFlyWithFrankExplainerProps = {
  /** Total $OVERVIEW backing the candidate currently sitting in 25th place
   *  on the leaderboard. `null` (or `<= 0`) means there are fewer than 25
   *  ranked candidates yet, so any positive backing qualifies. */
  top25Threshold: number | null
  /** Total citizens currently on the leaderboard. Drives accurate empty-
   *  state copy when the top 25 isn't filled yet — without it we can't
   *  distinguish "genuinely <25 ranked" from "fetch came back partial",
   *  so we'd risk falsely claiming "fewer than 25 citizens are ranked". */
  rankedCount?: number
  /** Mission ID used to thread "from" context into the leaderboard CTA so
   *  the destination page can render its "back to mission" affordance. */
  missionId?: string | number
}

const STEPS: {
  title: string
  description: string
  href?: string
  cta?: string
}[] = [
  {
    title: 'Contribute to the campaign',
    description:
      'Every contribution earns $OVERVIEW — your voting power for who flies with Frank.',
  },
  {
    title: 'Become a citizen',
    description:
      'Mint your Citizen NFT to be eligible to fly. Without it, you can\u2019t be backed.',
    href: '/join',
    cta: 'Become a citizen \u2192',
  },
  {
    title: 'Back a citizen\u2019s candidacy',
    description:
      'Pledge your $OVERVIEW to the citizen you want to send to space.',
  },
]

function formatThreshold(amount: number): string {
  return amount.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

/**
 * Compact 3-step explainer surfaced on the Overview Mission page directly
 * under the support tiers. Walks contributors through what it takes to put
 * a citizen on the "Fly with Frank" leaderboard, and shows the live
 * minimum $OVERVIEW backing required to crack the top 25.
 */
export default function MissionFlyWithFrankExplainer({
  top25Threshold,
  rankedCount,
  missionId,
}: MissionFlyWithFrankExplainerProps) {
  const leaderboardHref = `/overview-vote${
    missionId != null ? `?from=mission&missionId=${missionId}` : ''
  }`

  const hasThreshold =
    top25Threshold != null && Number.isFinite(top25Threshold) && top25Threshold > 0
  // Three "no threshold" cases we need to distinguish so we never lie:
  //   1. Genuinely <25 ranked AND we know it (rankedCount provided & <25)
  //   2. Fetch returned 0/undefined entries (we can't claim anything)
  //   3. Top 25 IS filled but threshold is 0 (effectively the same as #1
  //      from the contributor's POV: any backing qualifies)
  // A `rankedCount` of 0 almost always means the leaderboard fetch failed
  // for the Overview Mission (it has had real backers from launch), so we
  // don't trust it as a "genuinely empty leaderboard" signal — fall through
  // to the neutral "Live" copy in that case.
  const knowsCount = typeof rankedCount === 'number' && rankedCount > 0
  const top25Full = knowsCount && (rankedCount as number) >= 25

  // Step 3 routes to the leaderboard so users can pledge immediately. We
  // can't bake this into the static STEPS array because it depends on the
  // mission ID prop.
  const steps = STEPS.map((step, index) =>
    index === 2
      ? { ...step, href: leaderboardHref, cta: 'Back a candidate \u2192' }
      : step
  )

  return (
    <section
      data-testid="mission-fly-with-frank-explainer"
      className="mt-4 pt-4 border-t border-white/[0.08] space-y-4"
      aria-label="How to fly with Frank"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-gray-400 font-medium text-xs uppercase tracking-wider">
          How to fly with Frank
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-indigo-300/80">
          3 steps
        </span>
      </div>

      <ol className="flex flex-col gap-2.5 list-none m-0 p-0">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="relative w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 flex items-start gap-3"
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 ring-1 ring-indigo-300/30 flex items-center justify-center text-indigo-100 text-[11px] font-bold leading-none">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-medium text-xs sm:text-sm leading-snug">
                {step.title}
              </p>
              <p className="text-gray-500 text-[11px] sm:text-xs leading-relaxed mt-0.5">
                {step.description}
              </p>
              {step.href && step.cta ? (
                <Link
                  href={step.href}
                  className="inline-block mt-1.5 text-[11px] sm:text-xs font-semibold text-indigo-300 hover:text-indigo-200 transition-colors"
                >
                  {step.cta}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-wider text-indigo-200/80 font-semibold">
          Top 25 threshold
        </p>
        {hasThreshold ? (
          <>
            <p className="mt-1 text-white font-GoodTimes text-base sm:text-lg tabular-nums leading-tight">
              {formatThreshold(top25Threshold as number)}
              <span className="ml-1.5 text-[11px] sm:text-xs uppercase tracking-wide text-indigo-200/80">
                $OVERVIEW
              </span>
            </p>
            <p className="text-gray-500 text-[11px] sm:text-xs leading-relaxed mt-1">
              {knowsCount
                ? `${rankedCount} citizens ranked. Your candidate needs more than this to crack the top 25 and advance to Round 2.`
                : 'Your candidate needs more than this to crack the top 25 and advance to Round 2.'}
            </p>
          </>
        ) : top25Full ? (
          // We know the top 25 is filled but couldn't compute a numeric
          // threshold (e.g. RPC hiccup). Be neutral instead of claiming
          // "Open" which would be misleading.
          <>
            <p className="mt-1 text-white font-GoodTimes text-base sm:text-lg leading-tight">
              {rankedCount} ranked
            </p>
            <p className="text-gray-500 text-[11px] sm:text-xs leading-relaxed mt-1">
              Top 25 is contested. Check the leaderboard for the live minimum
              backing required to crack it.
            </p>
          </>
        ) : knowsCount ? (
          // Genuinely fewer than 25 ranked candidates.
          <>
            <p className="mt-1 text-white font-GoodTimes text-base sm:text-lg leading-tight">
              Open
            </p>
            <p className="text-gray-500 text-[11px] sm:text-xs leading-relaxed mt-1">
              {`${rankedCount} of 25 slots filled — any $OVERVIEW backing currently puts your candidate in the top 25.`}
            </p>
          </>
        ) : (
          // We don't know the count at all. Stay neutral.
          <>
            <p className="mt-1 text-white font-GoodTimes text-base sm:text-lg leading-tight">
              Live
            </p>
            <p className="text-gray-500 text-[11px] sm:text-xs leading-relaxed mt-1">
              Check the leaderboard for the current top 25 and the minimum
              backing required to break in.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
