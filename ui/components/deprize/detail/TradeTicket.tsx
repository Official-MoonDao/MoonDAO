// Polymarket-style order ticket for the prize page rail. It only picks the
// competitor (and, in the ETH market, a starting amount); the button opens the
// same window as tapping a competitor row in the selected market.
import { useEffect, useState } from 'react'
import { DEPRIZE_PREDICT_CTA } from '@/lib/deprize/constants'
import { fmt } from '@/lib/deprize/format'
import EthUsd from '@/components/deprize/EthUsd'
import { payoutMultiple } from '@/components/deprize/MarketOutcomeRow'
import type { MarketMode } from './MarketModeTabs'
import { TOUCH } from './primitives'

const QUICK_ADD_ETH = [0.001, 0.01, 0.05]

export default function TradeTicket({
  mode,
  title,
  labels,
  colors,
  probabilities,
  order,
  resolved,
  bettingAllowed,
  betUnavailableReason,
  amountEth,
  onAmountChange,
  onPredict,
  onModeChange,
}: {
  mode: MarketMode
  title: string
  labels: string[]
  colors: string[]
  /** Percent per outcome, outcome-index order: ETH chance or voting-power share. */
  probabilities: number[]
  /** Outcome indexes, best first. */
  order: number[]
  resolved: boolean
  bettingAllowed: boolean
  /** Why the ETH market is closed to this visitor, without a trailing period. */
  betUnavailableReason?: string
  amountEth: string
  onAmountChange: (eth: string) => void
  onPredict: (index: number) => void
  onModeChange: (mode: MarketMode) => void
}) {
  const isBet = mode === 'bet'
  const [selected, setSelected] = useState<number | null>(null)
  useEffect(() => {
    if (selected === null && order.length) setSelected(order[0])
  }, [order, selected])

  if (!order.length) return null
  const index = selected ?? order[0]
  const name = labels[index] || 'this competitor'
  const probability = probabilities[index]
  const multiple = payoutMultiple(probability)
  const amount = Number(amountEth)
  const payout =
    isBet && bettingAllowed && amount > 0 && Number.isFinite(probability) && probability > 0
      ? (amount * 100) / probability
      : undefined

  const addAmount = (delta: number) => {
    const next = (Number.isFinite(amount) ? amount : 0) + delta
    onAmountChange(String(Number(next.toFixed(6))))
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-gray-400">{title}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            isBet ? 'bg-emerald-400/15 text-emerald-300' : 'bg-indigo-400/15 text-indigo-200'
          }`}
        >
          {isBet ? 'ETH market' : 'MOONEY forecast'}
        </span>
      </div>
      <p className="mt-0.5 truncate text-base font-semibold text-white">{name}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {order.map((i) => {
          const active = i === index
          const pct = probabilities[i]
          return (
            <button
              key={i}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(i)}
              className={`flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${TOUCH} ${
                active
                  ? 'border-transparent text-white'
                  : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/25 hover:text-white'
              }`}
              style={active ? { background: colors[i] } : undefined}
            >
              <span className="truncate">{labels[i] || `Outcome ${i + 1}`}</span>
              <span className="shrink-0 tabular-nums">
                {Number.isFinite(pct) ? `${fmt(pct, 0)}%` : '—'}
              </span>
            </button>
          )
        })}
      </div>

      {isBet && bettingAllowed && !resolved && (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="deprize-ticket-amount" className="text-sm text-gray-300">
              Amount
            </label>
            <div className="flex min-w-0 items-baseline gap-1">
              <input
                id="deprize-ticket-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.001"
                placeholder="0"
                value={amountEth}
                onChange={(e) => onAmountChange(e.target.value)}
                className="w-28 bg-transparent text-right text-2xl sm:text-3xl font-semibold tabular-nums text-white placeholder-gray-600 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-sm text-gray-400">ETH</span>
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            {QUICK_ADD_ETH.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => addAmount(d)}
                className={`rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-gray-300 hover:border-white/25 hover:text-white ${TOUCH}`}
              >
                +{d}
              </button>
            ))}
          </div>
        </div>
      )}

      {!resolved && !isBet && (
        <p className="mt-4 text-xs leading-snug text-gray-400">
          Free. Your pick is weighted by your Citizen voting power and does not touch the ETH odds.
        </p>
      )}

      {!resolved && isBet && (
        <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
          <span>{payout !== undefined ? 'To win' : 'Payout per 1 ETH'}</span>
          <span className="tabular-nums text-gray-200">
            {payout !== undefined ? (
              <span className="text-emerald-300">
                <EthUsd eth={payout} />
              </span>
            ) : (
              multiple ?? '—'
            )}
          </span>
        </div>
      )}

      {resolved ? (
        <p className="mt-5 rounded-lg bg-white/[0.04] px-3 py-3 text-center text-sm text-gray-400">
          This market has resolved.
        </p>
      ) : isBet && !bettingAllowed ? (
        <div className="mt-4 rounded-lg bg-white/[0.04] px-3 py-3 text-center text-sm text-gray-400">
          {betUnavailableReason ? (
            <p>{betUnavailableReason}.</p>
          ) : (
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[15px] font-semibold text-gray-500"
            >
              Add ETH
            </button>
          )}
          <button
            type="button"
            onClick={() => onModeChange('predict')}
            className={`mt-2 font-semibold text-indigo-300 hover:text-indigo-200 ${TOUCH}`}
          >
            Make a free MOONEY prediction →
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onPredict(index)}
          className={`mt-4 w-full rounded-lg px-4 py-3 text-[15px] font-semibold text-white transition-[filter] hover:brightness-110 ${TOUCH}`}
          style={{ background: colors[index] }}
        >
          {isBet ? `Bet on ${name}` : `${DEPRIZE_PREDICT_CTA} ${name}`}
        </button>
      )}
    </section>
  )
}
