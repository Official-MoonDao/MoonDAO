// One outcome on an index market, Polymarket-style: a colored initial tile,
// the name over a thin probability bar, the payout multiple, and the price
// pill. When betting is open the pill is the Predict control.
import { DEPRIZE_PREDICT_CTA } from '@/lib/deprize/constants'
import { fmt } from '@/lib/deprize/format'
import { TOUCH } from '@/components/deprize/detail/primitives'

type Props = {
  name: string
  color: string
  /** Percent, 0–100. */
  probability: number | undefined
  /** False for a race with no market yet — names only, no prices. */
  showOdds: boolean
  heldQty?: number
  /** Set only while this outcome can be bet on. */
  onPredict?: () => void
  onCashOut?: () => void
  size?: 'hero' | 'card'
}

/** ETH back per 1 ETH at the current marginal price, before slippage and fees. */
export function payoutMultiple(probability: number | undefined): string | undefined {
  if (probability == null || !Number.isFinite(probability) || probability <= 0) return undefined
  const x = 100 / probability
  return x >= 100 ? '>100x' : `${x.toFixed(2)}x`
}

export default function MarketOutcomeRow({
  name,
  color,
  probability,
  showOdds,
  heldQty,
  onPredict,
  onCashOut,
  size = 'card',
}: Props) {
  const hero = size === 'hero'
  const pct = probability != null && Number.isFinite(probability) ? `${fmt(probability, 0)}%` : '—'
  const multiple = showOdds ? payoutMultiple(probability) : undefined
  const pill = `shrink-0 rounded-lg border text-center font-semibold tabular-nums ${
    hero ? 'w-16 py-1.5 text-sm' : 'w-14 py-1 text-xs'
  }`

  return (
    <div className={`flex items-center ${hero ? 'gap-3 py-1.5' : 'gap-2.5 py-1'}`}>
      <span
        aria-hidden
        className={`shrink-0 rounded-lg grid place-items-center font-bold uppercase ${
          hero ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[10px]'
        }`}
        style={{ background: `${color}26`, color }}
      >
        {name.trim().charAt(0) || '?'}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-white/90 ${hero ? 'text-sm font-medium' : 'text-[13px]'}`}>
          {name}
        </p>
        {showOdds && (
          <div className="mt-1 h-0.5 w-full max-w-[9rem] rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(0, Math.min(100, probability ?? 0))}%`,
                background: color,
              }}
            />
          </div>
        )}
        {!!heldQty && (
          <p className="mt-0.5 text-[10px] font-medium text-moon-green">
            Holding {fmt(heldQty, 3)}
          </p>
        )}
      </div>
      {multiple && (
        <span
          className="shrink-0 text-xs tabular-nums text-gray-400"
          title="ETH paid per 1 ETH predicted if this wins, at the current price"
        >
          {multiple}
        </span>
      )}
      {onPredict ? (
        <button
          type="button"
          onClick={onPredict}
          aria-label={`${DEPRIZE_PREDICT_CTA} ${name}`}
          className={`group ${pill} ${TOUCH} border-white/15 bg-white/[0.04] text-white transition-colors
            hover:border-blue-500 hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60`}
        >
          <span className="group-hover:hidden group-focus-visible:hidden">
            {showOdds ? pct : DEPRIZE_PREDICT_CTA}
          </span>
          <span className="hidden group-hover:inline group-focus-visible:inline">
            {DEPRIZE_PREDICT_CTA}
          </span>
        </button>
      ) : showOdds ? (
        <span className={`${pill} border-white/10 text-gray-200`}>{pct}</span>
      ) : null}
      {onCashOut && (
        <button
          type="button"
          onClick={onCashOut}
          className={`shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white transition-colors hover:border-indigo-400/35 hover:bg-indigo-500/15 ${TOUCH}`}
        >
          Cash out
        </button>
      )}
    </div>
  )
}
