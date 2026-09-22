import type { CapabilityCriterion } from '@/lib/lunar-atlas/types'

type Props = {
  description?: string
  criteria?: CapabilityCriterion[]
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

/** Win criteria for a prize. The market question lives on the odds chart. */
export default function DePrizeQuestionCard({ description, criteria }: Props) {
  const hasCriteria = !!criteria && criteria.length > 0
  if (!description && !hasCriteria) return null
  return (
    <div className={CARD}>
      <details className="group" open>
        <summary className="cursor-pointer list-none text-sm font-semibold text-white flex items-center justify-between gap-3">
          <span>{hasCriteria ? 'What counts as winning' : 'About this prize'}</span>
          <span className="text-gray-500 text-xs font-normal shrink-0">
            {hasCriteria ? `${criteria!.length} criteria` : null}
            <span className="ml-1 inline-block transition-transform group-open:rotate-180">▾</span>
          </span>
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          {description && <p className="text-gray-400 text-sm">{description}</p>}
          {hasCriteria && <CriteriaList criteria={criteria!} />}
        </div>
      </details>
    </div>
  )
}
