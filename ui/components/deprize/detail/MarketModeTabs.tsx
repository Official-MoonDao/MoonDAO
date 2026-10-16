import { TOUCH } from './primitives'

export type MarketMode = 'bet' | 'predict'

const TABS: { mode: MarketMode; title: string; detail: string }[] = [
  { mode: 'bet', title: 'ETH market', detail: 'Bet real ETH. Odds move with every bet.' },
  {
    mode: 'predict',
    title: 'MOONEY forecast',
    detail: "Free. Citizens' picks, weighted by voting power.",
  },
]

/**
 * The race page's two markets, side by side. Everything below follows the
 * selected one: the chart, the competitor rows, the rail and the click action.
 */
export default function MarketModeTabs(props: {
  mode: MarketMode
  onChange: (mode: MarketMode) => void
  /** Shown under the ETH tab when this visitor can't bet. */
  betUnavailable?: string
}) {
  return (
    <div role="tablist" aria-label="Market" className="grid grid-cols-2 gap-2">
      {TABS.map((tab) => {
        const active = props.mode === tab.mode
        const detail = tab.mode === 'bet' && props.betUnavailable ? props.betUnavailable : tab.detail
        return (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => props.onChange(tab.mode)}
            className={`rounded-xl border px-3 py-2.5 text-left transition-colors sm:px-4 sm:py-3 ${TOUCH} ${
              active
                ? tab.mode === 'bet'
                  ? 'border-emerald-400/50 bg-emerald-400/[0.08]'
                  : 'border-indigo-400/50 bg-indigo-400/[0.08]'
                : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20'
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  tab.mode === 'bet' ? 'bg-emerald-400' : 'bg-indigo-400'
                } ${active ? '' : 'opacity-40'}`}
              />
              <span className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-300'}`}>
                {tab.title}
              </span>
            </span>
            <span className="mt-1 block text-xs leading-snug text-gray-400">{detail}</span>
          </button>
        )
      })}
    </div>
  )
}
