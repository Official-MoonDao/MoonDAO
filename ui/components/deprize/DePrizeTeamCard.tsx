import type { KeyboardEvent, ReactNode } from 'react'
import { DEPRIZE_PREDICT_CTA } from '@/lib/deprize/constants'
import { fmt } from '@/lib/deprize/format'
import type { Outcome } from '@/lib/deprize/useDePrizeMarket'
import DePrizeTeamLink from '@/components/deprize/DePrizeTeamLink'
import EthUsd from '@/components/deprize/EthUsd'
import { payoutMultiple } from '@/components/deprize/MarketOutcomeRow'
import { TOUCH } from '@/components/deprize/detail/primitives'

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
  /**
   * Inline holdings (payout line + cash-out quote). Only rendered when
   * `onCashOut` is provided — the live prize page shows holdings in the
   * position panel instead and omits these.
   */
  redeemValueEth?: number
  sellQuoteEth?: number
  investedEth?: number
  onCashOut?: (index: number) => void
  // Actions + gating
  bettingOpen: boolean
  tradingHalted: boolean
  busy: boolean
  userConnected: boolean
  onBet: (index: number) => void
  /**
   * The card opens the prediction window even when ETH betting is closed.
   * `bettingOpen` alone is the bet gate and would leave the card inert.
   */
  selectable?: boolean
  /** This competitor is the viewer's saved prediction. */
  highlighted?: boolean
  /** Short status under the name, such as "Your Prediction". */
  badge?: string
  /** Caption under the percent. ETH odds say "chance"; MOONEY ranking says "share". */
  chanceLabel?: string
  /** ETH bet into this outcome on the market. Shown above the voting-power line. */
  stakedEth?: number
  /**
   * Citizen-prediction voting power behind this option. Omit while consensus
   * is still loading so the card does not flash a fake zero.
   */
  citizenVotingPower?: number
  /** Citizens with any allocation on this option. Omit while consensus is loading. */
  predictionCount?: number
  /**
   * Citizen forecast controls for this competitor. Stop their clicks from
   * also placing a bet, since the card itself is the bet control.
   */
  actions?: ReactNode
  /** Open Field slot — render overrides instead of a Team NFT. */
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
  /**
   * Lander or vehicle. When set, this is the card title and `nameOverride`
   * (the company) drops to the subtitle.
   */
  vehicleLabel?: string
  /** Atlas org logo. Suppressed when `unclaimed`. */
  imageOverride?: string
  /**
   * Competitor has not claimed its listing: show the name but no logo, so the
   * listing never reads as an endorsement. See ROSTER_DISCLAIMER.
   */
  unclaimed?: boolean
  /**
   * 'bet' opens the ETH bet. 'predict' saves a free prediction. The row still
   * shows ETH bet, voting power, and prediction count whenever those are passed.
   */
  mode?: 'bet' | 'predict'
}

/** Dashed-circle mark for the Open Field slot, which has no Team NFT. */
const FIELD_AVATAR =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="#1e293b"/><circle cx="20" cy="20" r="10" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 3"/></svg>`
  )

/** Same grouping the callers list uses for a citizen's voting power. */
function formatVotingPower(vp: number): string {
  if (!Number.isFinite(vp) || vp <= 0) return '0'
  return vp.toLocaleString(undefined, { maximumFractionDigits: vp < 10 ? 1 : 0 })
}

function PnlSuffix({ pnl }: { pnl: number | undefined }) {
  if (pnl === undefined) return null
  return (
    <span className={`ml-1.5 font-medium ${pnl >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
      (
      <EthUsd eth={pnl} signed usdClassName="opacity-80 font-normal" />)
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
  investedEth = 0,
  bettingOpen,
  tradingHalted,
  busy,
  userConnected,
  onBet,
  selectable = false,
  highlighted = false,
  badge,
  chanceLabel = 'chance',
  stakedEth,
  citizenVotingPower,
  predictionCount,
  actions,
  onCashOut,
  isField = false,
  withdrawn = false,
  hrefOverride,
  nameOverride,
  vehicleLabel,
  imageOverride,
  unclaimed = false,
  mode,
}: DePrizeTeamCardProps) {
  const holding = Number.isFinite(outcome.balance) && outcome.balance > 0
  const showHoldings = !!onCashOut && holding
  const headline = !isField && vehicleLabel ? vehicleLabel : nameOverride
  const orgSubtitle = !isField && vehicleLabel ? nameOverride : undefined
  const realizedValue = resolved ? redeemValueEth : sellQuoteEth
  const pnl =
    realizedValue !== undefined && investedEth > 0 ? realizedValue - investedEth : undefined
  const canCashOut = showHoldings && !tradingHalted && !resolved
  const canPredict = !resolved && !busy && (selectable || (bettingOpen && !tradingHalted))
  const predictName = isField ? 'Other' : headline || 'this competitor'
  const predict = () => onBet(outcome.index)
  // Cash-out and forecast actions are their own buttons. A card that also
  // contains one cannot be a button itself, so that case stays a clickable div.
  const cardIsButton = canPredict && !canCashOut && !actions
  const votingPowerText =
    citizenVotingPower === undefined ? undefined : formatVotingPower(citizenVotingPower)
  const predictionNoun = predictionCount === 1 ? 'prediction' : 'predictions'
  const ctaLabel = mode === 'bet' ? 'Bet' : DEPRIZE_PREDICT_CTA
  const predictAria = !cardIsButton
    ? undefined
    : mode === 'bet'
    ? `Bet ETH on ${predictName}`
    : votingPowerText === undefined
    ? `Predict ${predictName} as the winner`
    : predictionCount
    ? `Predict ${predictName} as the winner, ${votingPowerText} voting power from ${predictionCount} ${predictionNoun}`
    : `Predict ${predictName} as the winner, ${votingPowerText} voting power`

  const onCardKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!canPredict || e.target !== e.currentTarget) return
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    predict()
  }

  return (
    <div
      role={cardIsButton ? 'button' : undefined}
      tabIndex={cardIsButton ? 0 : undefined}
      aria-label={predictAria}
      aria-pressed={cardIsButton ? highlighted : undefined}
      className={`relative w-full overflow-hidden px-3 py-3 sm:px-4 rounded-xl border border-transparent transition-colors ${
        resolved && isWinningSlot
          ? 'border-emerald-400/40 bg-emerald-500/[0.06]'
          : highlighted
          ? 'border-amber-300/70 bg-amber-300/[0.05]'
          : ''
      } ${
        canPredict
          ? `group cursor-pointer hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${
              highlighted ? 'hover:border-amber-300' : ''
            }`
          : ''
      }`}
      onClick={canPredict ? predict : undefined}
      onKeyDown={canPredict ? onCardKeyDown : undefined}
    >
      {/* Polymarket-style row: team · chance · payout · predict pill. The
          whole row is the predict control; the pill is only its label. */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0 sm:min-w-[150px] flex flex-col gap-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <DePrizeTeamLink
              teamId={teamId}
              teamContract={teamContract}
              color={color}
              size={32}
              className="text-base font-semibold text-white"
              nameOverride={isField ? 'Other' : headline}
              imageOverride={isField ? FIELD_AVATAR : imageOverride}
              hrefOverride={isField ? '/deprize#open-field' : hrefOverride}
              // The field slot is not an organization, so its own placeholder mark
              // must survive the unclaimed logo suppression.
              unclaimed={!isField && unclaimed}
              plain={canPredict}
            />
          </div>
          {isField && <p className="text-xs leading-tight text-gray-400 pl-10">Any other team</p>}
          {orgSubtitle && (
            <p className="text-xs leading-tight text-gray-400 pl-10">{orgSubtitle}</p>
          )}
          {badge && <p className="text-xs leading-tight text-amber-200 pl-10">{badge}</p>}
          {withdrawn && !isField && (
            <p className="text-xs leading-tight text-amber-400/90 pl-10">Withdrawn — sell only</p>
          )}
          {showHoldings && !resolved && (
            <p
              className="text-xs leading-tight text-gray-500 pl-10"
              title="Each share you hold pays 1 ETH if this competitor is selected as the winner. Paid from the betting market, not from the prize pool."
            >
              Your payout if wins ·{' '}
              <span className="text-emerald-400/90 font-medium tabular-nums">
                <EthUsd eth={outcome.balance} usdClassName="text-emerald-400/70 font-normal" />
              </span>
            </p>
          )}
        </div>

        {stakedEth !== undefined && (
          <>
            <div className="hidden w-24 shrink-0 text-right md:block" data-staked-eth={stakedEth}>
              <p className="text-sm font-semibold leading-none tabular-nums text-white">
                <EthUsd
                  eth={stakedEth}
                  layout="below"
                  usdClassName="text-[11px] font-normal text-gray-500"
                />
              </p>
            </div>
            <div
              className="hidden w-28 shrink-0 text-right md:block"
              data-citizen-voting-power={citizenVotingPower}
            >
              <p className="text-sm font-semibold leading-none tabular-nums text-white">
                {votingPowerText ?? '…'}
              </p>
            </div>
            <div
              className="hidden w-[5.5rem] shrink-0 text-right md:block"
              data-prediction-count={predictionCount}
            >
              <p className="text-sm font-semibold leading-none tabular-nums text-white">
                {predictionCount ?? '…'}
              </p>
            </div>
          </>
        )}

        <div className="shrink-0 w-16 sm:w-20 text-right">
          <p
            className={`text-xl sm:text-2xl font-bold leading-none tabular-nums ${
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
            <p className="text-gray-500 text-[10px] mt-1 uppercase tracking-wide">{chanceLabel}</p>
          )}
        </div>

        {!resolved && (
          <span
            className="hidden sm:block shrink-0 w-12 text-right text-xs tabular-nums text-gray-400"
            title="ETH paid per 1 ETH predicted if this wins, at the current price"
          >
            {payoutMultiple(outcome.probability) ?? ''}
          </span>
        )}

        {canPredict && !actions && (
          <span
            aria-hidden
            className="shrink-0 rounded-lg px-3 sm:px-5 py-2 text-sm font-semibold text-white shadow-sm transition-[filter] group-hover:brightness-110"
            style={{ background: color }}
          >
            {ctaLabel}
          </span>
        )}

        {actions ? (
          <div
            className="flex flex-wrap items-center gap-2 w-full sm:w-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        ) : null}
      </div>

      {stakedEth !== undefined && (
        <div className="mt-2 grid grid-cols-3 gap-2 pl-10 md:hidden">
          <div data-staked-eth={stakedEth}>
            <p className="text-[10px] uppercase tracking-wide text-gray-500">ETH bet</p>
            <p className="text-sm font-semibold tabular-nums text-white">
              <EthUsd eth={stakedEth} />
            </p>
          </div>
          <div data-citizen-voting-power={citizenVotingPower}>
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Voting power</p>
            <p className="text-sm font-semibold tabular-nums text-white">
              {votingPowerText ?? '…'}
            </p>
          </div>
          <div data-prediction-count={predictionCount}>
            <p className="text-[10px] uppercase tracking-wide text-gray-500"># predictions</p>
            <p className="text-sm font-semibold tabular-nums text-white">
              {predictionCount ?? '…'}
            </p>
          </div>
        </div>
      )}

      {showHoldings && (
        <div
          className="mt-2.5 flex items-center justify-between gap-3 flex-wrap rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">
              {resolved ? 'Claimable' : 'Cash out'}
            </p>
            <p className="text-sm font-semibold text-white tabular-nums mt-0.5">
              {resolved ? (
                redeemValueEth !== undefined ? (
                  <>
                    <EthUsd eth={redeemValueEth} />
                    <PnlSuffix pnl={pnl} />
                  </>
                ) : (
                  '—'
                )
              ) : tradingHalted ? (
                '—'
              ) : sellQuoteEth !== undefined ? (
                <>
                  <EthUsd eth={sellQuoteEth} />
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
              onClick={() => onCashOut?.(outcome.index)}
              disabled={busy || !userConnected || sellQuoteEth === undefined}
              className={`shrink-0 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide
                bg-white/5 hover:bg-indigo-500/15 text-white border border-white/10 hover:border-indigo-400/35
                transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${TOUCH}`}
            >
              Cash out
            </button>
          )}
        </div>
      )}
    </div>
  )
}
