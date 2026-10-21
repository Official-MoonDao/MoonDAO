import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/solid'
import type { RankedChoice } from '@/lib/elections/rankedChoice'

export default function RankedBallot({
  choices,
  value,
  onChange,
  disabled = false,
}: {
  choices: RankedChoice[]
  value: number[]
  onChange: (value: number[]) => void
  disabled?: boolean
}) {
  const labelFor = (key: number) => choices.find((c) => c.key === key)?.label ?? `Choice ${key}`
  const unranked = choices.filter((c) => !value.includes(c.key))

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return
    const next = [...value]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  const iconButton =
    'p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors'

  return (
    <div className="space-y-4">
      {value.length > 0 ? (
        <ol className="space-y-2" aria-label="Your ranking">
          {value.map((key, rank) => (
            <li
              key={key}
              className="flex items-center justify-between gap-2 rounded-xl p-3 border bg-blue-500/15 border-blue-400/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 shrink-0 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {rank + 1}
                </span>
                <p className="font-medium text-white break-words min-w-0">{labelFor(key)}</p>
              </div>
              {!disabled && (
                <div className="flex items-center gap-1 shrink-0">
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
                    className="p-1.5 rounded-md hover:bg-red-500/20 transition-colors"
                    onClick={() => onChange(value.filter((k) => k !== key))}
                    aria-label={`Remove ${labelFor(key)} from your ranking`}
                  >
                    <XMarkIcon className="h-4 w-4 text-red-400" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-gray-400 text-xs sm:text-sm">
          Tap choices below in order of preference, starting with your favorite.
        </p>
      )}

      {!disabled && unranked.length > 0 && (
        <div className="space-y-2">
          {value.length > 0 && (
            <p className="text-gray-400 text-xs uppercase tracking-wide">Add more (optional)</p>
          )}
          {unranked.map((choice) => (
            <button
              type="button"
              key={choice.key}
              onClick={() => onChange([...value, choice.key])}
              className="w-full text-left rounded-xl p-3 border bg-black/20 border-white/10 hover:bg-black/30 hover:border-white/20 font-medium text-white transition-colors"
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
