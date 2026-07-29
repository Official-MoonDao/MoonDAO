import { fmt } from '@/lib/deprize/format'
import type { Outcome } from '@/lib/deprize/useDePrizeMarket'
import DePrizeTeamLink from '@/components/deprize/DePrizeTeamLink'
import StandardButton from '@/components/layout/StandardButton'

type DePrizeTeamCardProps = {
  outcome: Outcome
  teamId: bigint
  teamContract: any
  color: string
  loading: boolean
  // Lifecycle-derived display flags
  resolved: boolean
  isRefundVector: boolean
  isWinningSlot: boolean
  // Value display (ETH). redeemValue set once resolved; sellQuote while trading.
  redeemValueEth?: number
  sellQuoteEth?: number
  investedEth: number
  // Actions + gating
  bettingOpen: boolean
  tradingHalted: boolean
  busy: boolean
  userConnected: boolean
  onBet: (index: number) => void
  onCashOut: (index: number) => void
  /** Open Field slot — render overrides + tooltip instead of a Team NFT. */
  isField?: boolean
  /** Disclosure: competitor marked withdrawn on-chain. Slot stays tradable. */
  withdrawn?: boolean
  /**
   * Link target for a bound competitor (e.g. `/moonbase/{projectId}`), for
   * organizations that will never hold a Team NFT. Ignored for field slots,
   * which keep their own target. Defaults to `/team/{id}`.
   */
  hrefOverride?: string
  /** Atlas org display name, for competitors with no Team NFT. */
  nameOverride?: string
  /** Atlas org logo. Suppressed when `unclaimed`. */
  imageOverride?: string
  /**
   * Competitor has not claimed its listing: show the name but no logo, so the
   * listing never reads as an endorsement. See ROSTER_DISCLAIMER.
   */
  unclaimed?: boolean
}

/** Dashed-circle mark for the Open Field slot, which has no Team NFT. */
const FIELD_AVATAR =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="#1e293b"/><circle cx="20" cy="20" r="10" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 3"/></svg>`
  )

function PnlSuffix({ pnl }: { pnl: number | undefined }) {
  if (pnl === undefined) return null
  return (
    <span className={`ml-1.5 font-medium ${pnl >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
      ({pnl >= 0 ? '+' : ''}
      {fmt(pnl)} ETH)
    </span>
  )
}

export default function DePrizeTeamCard({
  outcome,
  teamId,
  teamContract,
  color,
  loading,
  resolved,
  isRefundVector,
  isWinningSlot,
  redeemValueEth,
  sellQuoteEth,
  investedEth,
  bettingOpen,
  tradingHalted,
  busy,
  userConnected,
  onBet,
  onCashOut,
  isField = false,
  withdrawn = false,
  hrefOverride,
  nameOverride,
  imageOverride,
  unclaimed = false,
}: DePrizeTeamCardProps) {
  const holding = Number.isFinite(outcome.balance) && outcome.balance > 0
  const realizedValue = resolved ? redeemValueEth : sellQuoteEth
  const pnl =
    realizedValue !== undefined && investedEth > 0
      ? realizedValue - investedEth
      : undefined
  const canCashOut = holding && !tradingHalted && !resolved
  const showWinSubtitle = holding && !resolved

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border shadow-lg ${
        resolved && isWinningSlot
          ? 'border-emerald-400/40 ring-1 ring-emerald-400/20'
          : 'border-white/[0.08]'
      }`}
    >
      {/* Top row: chance/result · team (+ if-wins subtitle) · bet CTA */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-[96px]">
          <span
            className="inline-block w-1.5 h-10 rounded-full shrink-0"
            style={{ background: color }}
          />
          <div>
            <p
              className={`text-2xl font-bold leading-none tabular-nums ${
                resolved
                  ? isWinningSlot
                    ? 'text-emerald-400'
                    : isRefundVector
                      ? 'text-white'
                      : 'text-gray-500'
                  : 'text-white'
              }`}
            >
              {resolved
                ? isWinningSlot
                  ? 'WON'
                  : isRefundVector
                    ? 'Refund'
                    : 'Lost'
                : Number.isNaN(outcome.probability)
                  ? loading
                    ? '…'
                    : '—'
                  : `${fmt(outcome.probability, 0)}%`}
            </p>
            {!resolved && (
              <p className="text-gray-500 text-[10px] mt-1 uppercase tracking-wide">chance</p>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-[150px] flex flex-col gap-1">
          <DePrizeTeamLink
            teamId={teamId}
            teamContract={teamContract}
            color={color}
            size={40}
            className="text-base font-semibold text-white hover:text-indigo-200"
            nameOverride={isField ? 'Open Field' : nameOverride}
            imageOverride={isField ? FIELD_AVATAR : imageOverride}
            hrefOverride={isField ? '/deprize#open-field' : hrefOverride}
            // The field slot is not an organization, so its own placeholder mark
            // must survive the unclaimed logo suppression.
            unclaimed={!isField && unclaimed}
          />
          {isField && (
            <p
              className="text-xs text-gray-400 pl-12"
              title="Pays if any qualifying entrant not listed above is selected as the winner. The Senate names the entity; the admin Safe records the payout address in the same settlement batch."
            >
              Any qualifying entrant not listed above
            </p>
          )}
          {withdrawn && !isField && (
            <p className="text-xs text-amber-400/90 pl-12">
              Withdrawn — you can still sell your position
            </p>
          )}
          {showWinSubtitle && (
            // Align under the team name (avatar 40px + gap-2 8px).
            <p className="text-xs text-gray-500 pl-12">
              If wins ·{' '}
              <span className="text-emerald-400/90 font-medium tabular-nums">
                {fmt(outcome.balance)} ETH
              </span>
            </p>
          )}
        </div>

        {bettingOpen && !tradingHalted && (
          <StandardButton
            onClick={() => onBet(outcome.index)}
            disabled={busy || !userConnected}
            className="rounded-xl shadow-purple-500/10"
          >
            {isField ? 'Back the field' : 'Back this team'}
          </StandardButton>
        )}
      </div>

      {/* Single holdings line — one exit quote + action (Polymarket-style) */}
      {holding && (
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">
              {resolved ? 'Claimable' : 'Cash out'}
            </p>
            <p className="text-sm font-semibold text-white tabular-nums mt-0.5">
              {resolved ? (
                redeemValueEth !== undefined ? (
                  <>
                    {fmt(redeemValueEth)} ETH
                    <PnlSuffix pnl={pnl} />
                  </>
                ) : (
                  '—'
                )
              ) : tradingHalted ? (
                '—'
              ) : sellQuoteEth !== undefined ? (
                <>
                  ≈ {fmt(sellQuoteEth)} ETH
                  <PnlSuffix pnl={pnl} />
                </>
              ) : (
                '…'
              )}
            </p>
          </div>
          {canCashOut && (
            <button
              type="button"
              onClick={() => onCashOut(outcome.index)}
              disabled={busy || !userConnected || sellQuoteEth === undefined}
              className="shrink-0 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide
                bg-white/5 hover:bg-indigo-500/15 text-white border border-white/10 hover:border-indigo-400/35
                transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cash out
            </button>
          )}
        </div>
      )}
    </div>
  )
}
