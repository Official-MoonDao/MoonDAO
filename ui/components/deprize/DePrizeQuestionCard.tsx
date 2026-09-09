import Link from 'next/link'
import type { CapabilityCriterion } from '@/lib/lunar-atlas/types'

type Props = {
  /** The market's question, e.g. "Which company lands on the Moon next?" */
  tagline: string
  description?: string
  criteria?: CapabilityCriterion[]
  /** Deep link into Moon Base Zero for this race. */
  moonbaseHref?: string
}

const CARD =
  'p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] shadow-lg'

function CriteriaList({ criteria }: { criteria: CapabilityCriterion[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {criteria.map((c, i) => (
        <li key={c.id} className="text-sm text-gray-300">
          <span className="text-gray-500 mr-2 tabular-nums">{i + 1}</span>
          {c.statement}
          {c.threshold && <p className="text-xs text-gray-500 mt-0.5 pl-5">{c.threshold}</p>}
        </li>
      ))}
    </ol>
  )
}

/**
 * What the prize is about, above the fold: the question, the one-paragraph
 * description, and the criteria a competitor must meet to win.
 */
export default function DePrizeQuestionCard({ tagline, description, criteria, moonbaseHref }: Props) {
  const hasCriteria = !!criteria && criteria.length > 0
  // Taglines carry a trailing call to action ("Back a team — every bet grows
  // the prize pool."). Only the question belongs here.
  const q = tagline.indexOf('?')
  const question = q >= 0 ? tagline.slice(0, q + 1) : tagline
  return (
    <div className={CARD}>
      <p className="text-white text-base font-semibold leading-snug">{question}</p>
      {description && <p className="text-gray-400 text-sm mt-2">{description}</p>}

      {hasCriteria && (
        <>
          {/* Always expanded on sm+; collapsible on phones to keep odds in view. */}
          <div className="hidden sm:block mt-4">
            <p className="text-white text-sm font-semibold mb-2">What counts as winning</p>
            <CriteriaList criteria={criteria!} />
          </div>
          <details className="sm:hidden mt-3 group">
            <summary className="cursor-pointer list-none text-sm font-semibold text-white flex items-center justify-between">
              What counts as winning
              <span className="text-gray-500 text-xs font-normal">
                {criteria!.length} criteria
                <span className="ml-1 inline-block transition-transform group-open:rotate-180">▾</span>
              </span>
            </summary>
            <div className="mt-2">
              <CriteriaList criteria={criteria!} />
            </div>
          </details>
        </>
      )}

      {moonbaseHref && (
        <p className="mt-4 text-xs">
          <Link
            href={moonbaseHref}
            className="text-indigo-300/90 underline-offset-2 hover:underline hover:text-indigo-200"
          >
            See this race on Moon Base Zero →
          </Link>
        </p>
      )}
    </div>
  )
}
