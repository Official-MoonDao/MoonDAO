import { ChevronDownIcon, ChevronUpIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/solid'
import type { RankedChoice } from '@/lib/elections/rankedChoice'

export type BallotChoice = RankedChoice & {
  handle?: string
  bio?: string
  platformUrl?: string
}

const ORDINALS = ['1st', '2nd', '3rd']
export function ordinal(n: number) {
  return ORDINALS[n - 1] ?? `${n}th`
}

function ChoiceDetails({ choice }: { choice: BallotChoice }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold text-white text-sm sm:text-base break-words">
        {choice.label}
        {choice.handle && (
          <span className="ml-2 text-gray-400 font-normal text-xs sm:text-sm">{choice.handle}</span>
        )}
      </p>
      {choice.bio && (
        <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mt-0.5">{choice.bio}</p>
      )}
      {choice.platformUrl && (
        <a
          href={choice.platformUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-1 inline-block text-xs sm:text-sm text-indigo-300 hover:underline"
        >
          Read platform
        </a>
      )}
    </div>
  )
}

export default function RankedBallot({
  choices,
  value,
  onChange,
  disabled = false,
}: {
  choices: BallotChoice[]
  value: number[]
  onChange: (value: number[]) => void
  disabled?: boolean
}) {
  const byKey = (key: number) => choices.find((c) => c.key === key)
  const labelFor = (key: number) => byKey(key)?.label ?? `Choice ${key}`
  const unranked = choices.filter((c) => !value.includes(c.key))

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return
    const next = [...value]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  const iconButton =
    'p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:hover:bg-transparent transition-colors'

  if (disabled) {
    return (
      <ul className="space-y-2">
        {choices.map((choice) => (
          <li key={choice.key} className="rounded-xl p-3 sm:p-4 border bg-black/20 border-white/10">
            <ChoiceDetails choice={choice} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Your ranking
          </h3>
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        {value.length > 0 ? (
          <ol className="space-y-2" aria-label="Your ranking">
            {value.map((key, rank) => (
              <li
                key={key}
                className="flex items-center justify-between gap-2 rounded-xl py-2 pl-3 pr-1.5 border bg-blue-500/15 border-blue-400/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 shrink-0 text-center text-xs font-bold uppercase text-blue-200 bg-blue-500/30 rounded-md py-1">
                    {ordinal(rank + 1)}
                  </span>
                  <p className="font-medium text-white break-words min-w-0">{labelFor(key)}</p>
                </div>
                <div className="flex items-center shrink-0">
                  <button
                    type="button"
                    className={iconButton}
                    onClick={() => move(rank, rank - 1)}
                    disabled={rank === 0}
                    aria-label={`Move ${labelFor(key)} up`}
                  >
                    <ChevronUpIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    onClick={() => move(rank, rank + 1)}
                    disabled={rank === value.length - 1}
                    aria-label={`Move ${labelFor(key)} down`}
                  >
                    <ChevronDownIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg text-red-400/80 hover:text-red-300 hover:bg-red-500/15 transition-colors"
                    onClick={() => onChange(value.filter((k) => k !== key))}
                    aria-label={`Remove ${labelFor(key)} from your ranking`}
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl border border-dashed border-white/15 p-4 text-center text-gray-400 text-xs sm:text-sm">
            Tap a choice below to make it your 1st choice.
          </p>
        )}
      </section>

      {unranked.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            {value.length === 0 ? 'Choices' : 'Add more (optional)'}
          </h3>
          <ul className="space-y-2">
            {unranked.map((choice) => (
              <li key={choice.key}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Rank ${choice.label} ${ordinal(value.length + 1)}`}
                  onClick={() => onChange([...value, choice.key])}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onChange([...value, choice.key])
                    }
                  }}
                  className="group flex items-center justify-between gap-3 rounded-xl p-3 sm:p-4 border bg-black/20 border-white/10 hover:bg-white/5 hover:border-blue-400/40 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <ChoiceDetails choice={choice} />
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-white/80 group-hover:border-blue-400/60 group-hover:text-white transition-colors">
                    <PlusIcon className="h-3.5 w-3.5" />
                    {ordinal(value.length + 1)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
