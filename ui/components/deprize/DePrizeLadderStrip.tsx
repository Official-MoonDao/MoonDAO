import {
  CAPABILITY_LADDER_SPEC_HREF,
  getLadderForCompetition,
  type DePrizeLadderStatus,
} from '@/lib/deprize/capabilityLadder'

const CHIP: Record<DePrizeLadderStatus, string> = {
  live: 'text-emerald-200 bg-emerald-500/10 border-emerald-400/40',
  planned: 'text-gray-300 bg-white/5 border-white/40',
  achieved: 'text-sky-200 bg-sky-500/10 border-sky-400/40',
}

const CHIP_LABEL: Record<DePrizeLadderStatus, string> = {
  live: 'Live',
  planned: 'Planned',
  achieved: 'Achieved',
}

function isOffsite(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://')
}

export default function DePrizeLadderStrip({ chainSlug }: { chainSlug: string }) {
  const { rungs } = getLadderForCompetition(chainSlug, undefined)

  return (
    <section aria-labelledby="deprize-ladder-heading" className="w-full">
      <h2 id="deprize-ladder-heading" className="sr-only">
        Capability ladder
      </h2>
      <ul className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {rungs.map((rung) => {
          const chip = (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${CHIP[rung.status]}`}
            >
              {CHIP_LABEL[rung.status]}
            </span>
          )
          const body = (
            <>
              <span className="text-xs text-gray-400 tabular-nums">{rung.rung}</span>
              <span className="text-sm font-semibold text-white">{rung.label}</span>
              <span className="text-xs text-gray-300 leading-snug">{rung.bar}</span>
              <span className="flex items-center gap-1.5">
                {chip}
                {rung.status === 'live' && <span className="sr-only">Current prize</span>}
              </span>
            </>
          )
          const innerClass = 'flex flex-col gap-1 min-h-full'
          const item = rung.href ? (
            <a
              href={rung.href}
              className={`${innerClass} hover:opacity-90`}
              {...(isOffsite(rung.href)
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              {body}
            </a>
          ) : (
            <span className={innerClass}>{body}</span>
          )
          return (
            <li
              key={rung.key}
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              {...(rung.status === 'live' ? { 'aria-current': true } : {})}
            >
              {item}
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-sm">
        <a
          href={CAPABILITY_LADDER_SPEC_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-300/90 underline-offset-2 hover:underline hover:text-indigo-200"
        >
          Read the capability ladder →
        </a>
      </p>
    </section>
  )
}
