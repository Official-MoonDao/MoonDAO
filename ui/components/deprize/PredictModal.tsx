import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fmt } from '@/lib/deprize/format'
import { FORECAST_COPY } from '@/lib/forecasts/forecastCopy'
import {
  BetPrimaryActionContext,
  predictionActionLabel,
  type BetPrimaryAction,
} from '@/components/deprize/betPrimaryAction'
import { TOUCH } from '@/components/deprize/detail/primitives'
import Modal from '@/components/layout/Modal'

/**
 * One window per market. 'bet' is the ETH bet form only; 'predict' is the
 * free MOONEY prediction only. Neither one triggers the other.
 */
export default function PredictModal(props: {
  mode: 'bet' | 'predict'
  teamName: string
  /** ETH market chance for this competitor. */
  probability: number
  chanceLoading?: boolean
  /** Betting is open for this prize, even if the wallet is not connected yet. */
  bettingAvailable?: boolean
  /** Schedule A blocks ETH bets. Shown only while placing a free prediction. */
  regionRestricted?: boolean
  connected: boolean
  /** True while the Citizen lookup for this network is still running. */
  citizenLoading?: boolean
  isCitizen: boolean
  /** Why predict is unavailable: still checking, switch wallets, or mint. */
  citizenNotice?: ReactNode
  saved: boolean
  writing: boolean
  predictEnabled: boolean
  undoEnabled: boolean
  /** Shown beside the button. The page error sits under the modal. */
  error?: string | null
  onPredict: () => void
  onUndo: () => void
  onConnect: () => void
  onClose: () => void
  /** Bet form, bet mode only. Omitted when this visitor cannot bet yet. */
  bet?: ReactNode
  /**
   * Which competitor this window is for. The modal stays mounted across
   * switches, and a late roster name (`Team #N` → NFT metadata) is not a switch.
   */
  outcomeIndex: number
}) {
  const isBet = props.mode === 'bet'
  const ethOffered = !!props.bet && !props.regionRestricted
  const [betAction, setBetAction] = useState<BetPrimaryAction | null>(null)
  const betRunRef = useRef<() => void>(() => {})
  const reportBetAction = useCallback((action: BetPrimaryAction | null) => {
    setBetAction((prev) => {
      if (!prev && !action) return prev
      if (
        prev &&
        action &&
        prev.kind === action.kind &&
        prev.label === action.label &&
        prev.disabled === action.disabled
      ) {
        return prev
      }
      return action
    })
  }, [])
  const betActionApi = useMemo(
    () => ({
      report: reportBetAction,
      setRun(run: () => void) {
        betRunRef.current = run
      },
    }),
    [reportBetAction]
  )
  const activeBet = ethOffered ? betAction : null
  const predictLabel = predictionActionLabel({
    writing: props.writing,
    saved: props.saved,
    bet: null,
  })

  useEffect(() => {
    setBetAction(null)
  }, [props.outcomeIndex, props.mode])

  const pct = Number.isFinite(props.probability)
    ? `${fmt(props.probability, 0)}%`
    : props.chanceLoading
    ? '…'
    : '—'

  return (
    <Modal
      id="deprize-predict"
      setEnabled={(open) => !open && props.onClose()}
      title={`Predict ${props.teamName}`}
      size="xl"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isBet ? 'bg-emerald-400/15 text-emerald-300' : 'bg-indigo-400/15 text-indigo-200'
            }`}
          >
            {isBet ? 'ETH market' : 'MOONEY forecast · free'}
          </span>
          <span className="text-gray-400">
            Chance <span className="font-semibold tabular-nums text-white">{pct}</span>
          </span>
        </div>
        <p className="text-sm text-gray-300">
          {isBet
            ? 'Real ETH. Your bet moves the odds and each share pays 1 ETH if this team wins. It does not save a MOONEY prediction.'
            : 'Free. This records your prediction, weighted by your vMOONEY. It does not change the ETH odds.'}
        </p>
        {!isBet && props.regionRestricted && (
          <>
            <p className="text-sm text-amber-200">{FORECAST_COPY.restrictedNote}</p>
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-500"
            >
              Add ETH
            </button>
          </>
        )}

        {!props.connected && (
          <button
            type="button"
            onClick={props.onConnect}
            className={`w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 ${TOUCH}`}
          >
            Connect wallet to predict
          </button>
        )}

        {isBet && props.connected && !props.bet &&
          (props.regionRestricted ? (
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-500"
            >
              Add ETH
            </button>
          ) : (
            <p className="text-sm text-amber-200">
              {props.bettingAvailable
                ? 'The bet form is loading.'
                : 'Betting is not available for you right now.'}
            </p>
          ))}

        {!isBet && props.connected && props.citizenNotice}

        {props.connected && props.error && !isBet && (
          <p className="text-xs text-amber-200">{props.error}</p>
        )}

        {ethOffered ? (
          <BetPrimaryActionContext.Provider value={betActionApi}>
            <div data-testid="deprize-bet-form">{props.bet}</div>
          </BetPrimaryActionContext.Provider>
        ) : null}

        {ethOffered && props.connected && (
          <button
            type="button"
            onClick={() => betRunRef.current()}
            disabled={!activeBet || activeBet.disabled}
            className={`w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-40 ${TOUCH}`}
          >
            {activeBet?.label ?? 'Add ETH'}
          </button>
        )}

        {!isBet && props.connected && !props.citizenLoading && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={props.onPredict}
              disabled={!props.predictEnabled || props.writing || props.saved}
              aria-pressed={props.saved}
              className={`w-full rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40 ${TOUCH} ${
                ethOffered
                  ? 'border border-white/15 text-gray-200 hover:bg-white/10'
                  : 'bg-white text-slate-900'
              }`}
            >
              {predictLabel}
            </button>
            {props.saved && props.undoEnabled && (
              <button
                type="button"
                onClick={props.onUndo}
                className={`w-full rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10 ${TOUCH}`}
              >
                Undo
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
