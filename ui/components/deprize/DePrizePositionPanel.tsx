import type { ActivityRow, BetRow, SellRow } from '@/lib/deprize/activity-math'
import { userActiveOutcomes, userActivity, userPosition, userSummary } from '@/lib/deprize/activity-math'
import { fmt } from '@/lib/deprize/format'
import type { Outcome } from '@/lib/deprize/useDePrizeMarket'
import EthUsd from '@/components/deprize/EthUsd'

type Props = {
  outcomes: Outcome[]
  labels: string[]
  /** Color per outcome index (same source as the cards and the chart). */
  colors: string[]
  bets: BetRow[]
  sells: SellRow[]
  user: string
  /** Live cash-out value per outcome index while trading. */
  sellQuotes: Map<number, number>
  /** Redeem value per outcome index once resolved. */
  redeemValues?: Map<number, number>
  resolved: boolean
  isRefundVector: boolean
  winningIndex: number
  tradingHalted: boolean
  explorerTxBase: string
  onCashOut: (index: number) => void
  loading: boolean
}

const CARD =
  'p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] shadow-lg'

function Mini({ label, title, children }: { label: string; title?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={`text-xs text-gray-400 ${title ? 'cursor-help' : ''}`} title={title}>
        {label}
      </p>
      <p className="text-sm font-semibold text-white tabular-nums">{children}</p>
    </div>
  )
}

function fmtWhen(ms: number): string {
  if (!Number.isFinite(ms)) return ''
  return new Date(ms).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * The connected wallet's money on this prize, in one place: net result so far,
 * spent / current value / cashed out / best-case payout, per-outcome rows with
 * cash-out, and the on-chain activity feed. Renders nothing for wallets with no
 * activity and no balance.
 */
export default function DePrizePositionPanel({
  outcomes,
  labels,
  colors,
  bets,
  sells,
  user,
  sellQuotes,
  redeemValues,
  resolved,
  isRefundVector,
  winningIndex,
  tradingHalted,
  explorerTxBase,
  onCashOut,
  loading,
}: Props) {
  const active = userActiveOutcomes(bets, sells, user)
  const heldIdx = outcomes.filter((o) => Number.isFinite(o.balance) && o.balance > 0).map((o) => o.index)
  const rowsIdx = Array.from(new Set([...active, ...heldIdx])).sort((a, b) => a - b)
  if (rowsIdx.length === 0) return null

  const valueByIndex = new Map<number, number>()
  for (const i of rowsIdx) {
    const v = resolved ? redeemValues?.get(i) : sellQuotes.get(i)
    if (v !== undefined && Number.isFinite(v)) valueByIndex.set(i, v)
  }
  const summary = userSummary(bets, sells, user, valueByIndex)
  const valueKnown = rowsIdx.every((i) => {
    const held = outcomes[i]?.balance ?? 0
    return !(held > 0) || valueByIndex.has(i)
  })

  // Best case: the single largest held position pays 1 ETH per token.
  const bestCase = heldIdx.reduce((m, i) => Math.max(m, outcomes[i]?.balance ?? 0), 0)
  const positive = summary.netPnlEth >= 0

  const rows = rowsIdx
    .map((i) => ({
      index: i,
      pos: userPosition(bets, sells, user, i),
      held: outcomes[i]?.balance ?? 0,
      value: valueByIndex.get(i),
    }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || b.held - a.held)

  const feed: ActivityRow[] = userActivity(bets, sells, user)

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-white font-semibold">Your position</p>
        <div
          className={`px-3 py-1 rounded-full text-sm font-semibold tabular-nums border ${
            positive
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
          } ${valueKnown ? '' : 'opacity-60'}`}
          title="Current value of your shares plus what you've already cashed out, minus everything you've spent (including the 5% prize slice)."
        >
          {valueKnown || loading ? (
            <>
              <EthUsd eth={summary.netPnlEth} signed usdClassName="opacity-70 font-normal" />
              <span className="ml-1.5 text-xs font-normal opacity-70">so far</span>
            </>
          ) : (
            '…'
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Mini label="Spent" title="Everything you've paid in, including the 5% that went to the prize pool.">
          <EthUsd eth={summary.totalSpentEth} />
        </Mini>
        <Mini
          label={resolved ? 'Claimable' : 'Current value'}
          title={resolved ? 'What your shares redeem for now.' : 'What the market would pay you to sell everything right now.'}
        >
          {valueKnown ? <EthUsd eth={summary.currentValueEth} approx={!resolved} /> : '…'}
        </Mini>
        <Mini label="Cashed out">
          <EthUsd eth={summary.realizedEth} />
        </Mini>
        <Mini
          label={resolved ? 'Result' : 'If your pick wins'}
          title={resolved ? undefined : 'Each share pays 1 ETH if its team is selected as the winner. Paid from the betting market, not the prize pool.'}
        >
          {resolved ? (
            isRefundVector ? 'Refund' : heldIdx.includes(winningIndex) ? 'Won' : 'Lost'
          ) : (
            <span className="text-emerald-300">
              <EthUsd eth={bestCase} usdClassName="text-emerald-300/70 font-normal" />
            </span>
          )}
        </Mini>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {rows.map(({ index, pos, held, value }) => {
          const canSell = !resolved && !tradingHalted && held > 0
          return (
            <div
              key={index}
              className="flex items-center justify-between gap-3 flex-wrap rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="inline-block w-1.5 h-8 rounded-full shrink-0"
                  style={{ background: colors[index % colors.length] }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{labels[index]}</p>
                  <p className="text-xs text-gray-500 tabular-nums">
                    {fmt(held, 4)} shares
                    {pos.qtyBought > 0 && (
                      <>
                        {' · '}avg {fmt(pos.avgCostEth, 3)} ETH/share
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">
                    {resolved ? (isRefundVector ? 'Refund' : index === winningIndex ? 'Won' : 'Lost') : 'Now worth'}
                  </p>
                  <p className="text-sm font-semibold text-white tabular-nums">
                    {held > 0 ? (
                      value !== undefined ? (
                        <EthUsd eth={value} approx={!resolved} />
                      ) : (
                        '…'
                      )
                    ) : (
                      <span className="text-gray-500">sold</span>
                    )}
                  </p>
                </div>
                {canSell && (
                  <button
                    type="button"
                    onClick={() => onCashOut(index)}
                    disabled={value === undefined}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide bg-white/5 hover:bg-indigo-500/15 text-white border border-white/10 hover:border-indigo-400/35 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Cash out
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {feed.length > 0 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer list-none text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1">
            Activity
            <span className="inline-block transition-transform group-open:rotate-180">▾</span>
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {feed.map((r) => (
              <li
                key={`${r.txHash}-${r.logIndex}`}
                className="flex items-center justify-between gap-3 text-xs text-gray-300"
              >
                <span className="truncate">
                  {r.kind === 'bet' ? (
                    <>
                      Backed <span className="text-white">{labels[r.outcomeIndex]}</span> ·{' '}
                      <EthUsd eth={r.costEth + r.sliceEth} />
                    </>
                  ) : (
                    <>
                      Cashed out {fmt(r.qty, 4)} shares of{' '}
                      <span className="text-white">{labels[r.outcomeIndex]}</span> ·{' '}
                      <EthUsd eth={r.proceedsEth} signed />
                    </>
                  )}
                </span>
                <a
                  href={`${explorerTxBase}${r.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-gray-500 hover:text-indigo-300 tabular-nums"
                >
                  {fmtWhen(r.timestampMs)} ↗
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
