import { ChevronRightIcon } from '@heroicons/react/20/solid'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fmt } from '@/lib/deprize/format'
import {
  BetPrimaryActionContext,
  predictionActionLabel,
  type BetPrimaryAction,
} from '@/components/deprize/betPrimaryAction'
import { TOUCH } from '@/components/deprize/detail/primitives'
import Modal from '@/components/layout/Modal'

export default function PredictModal(props: {
  teamName: string
  probability: number
  chanceLoading?: boolean
  /** Betting is open for this prize, even if the wallet is not connected yet. */
  bettingAvailable?: boolean
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
  /** Bet form. Omitted when this visitor is not allowed to bet. */
  bet?: ReactNode
  /**
   * Which competitor this window is for. The modal stays mounted across
   * switches, and a late roster name (`Team #N` → NFT metadata) is not a switch.
   */
  outcomeIndex: number
  /**
   * Open the bet form immediately. An onramp return carries the funded amount
   * inside that form, so leaving it collapsed hides the bet they just paid for.
   */
  resumeBet?: boolean
}) {
  const [betOpen, setBetOpen] = useState(!!props.resumeBet)
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
  const activeBet = betOpen ? betAction : null
  const primaryLabel = predictionActionLabel({
    writing: props.writing,
    saved: props.saved,
    bet: activeBet,
  })

  useEffect(() => {
    setBetOpen(!!props.resumeBet)
    setBetAction(null)
  }, [props.outcomeIndex, props.resumeBet])

  return (
    <Modal
      id="deprize-predict"
      setEnabled={(open) => !open && props.onClose()}
      title={`Predict ${props.teamName}`}
      size="xl"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Chance</span>
          <span className="text-white font-semibold tabular-nums">
            {Number.isFinite(props.probability)
              ? `${fmt(props.probability, 0)}%`
              : props.chanceLoading
              ? '…'
              : '—'}
          </span>
        </div>
        <p className="text-sm text-gray-300">
          {props.bet
            ? 'Predict with no bet, or add one below. A prediction does not change the ETH odds. A bet does.'
            : props.bettingAvailable
            ? 'Connect to predict. You can add a bet once your wallet is connected.'
            : 'This prediction has no bet attached, and it does not change the ETH odds.'}
        </p>

        {!props.connected && (
          <button
            type="button"
            onClick={props.onConnect}
            className={`w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 ${TOUCH}`}
          >
            Connect wallet
          </button>
        )}

        {props.connected && props.citizenNotice}

        {props.connected && props.error && (
          <p className="text-xs text-amber-200">{props.error}</p>
        )}

        {props.bet ? (
          <div
            data-testid="deprize-predict-bet"
            className="overflow-hidden rounded-xl border border-white/15 bg-white/5"
          >
            <button
              type="button"
              aria-expanded={betOpen}
              aria-controls="deprize-predict-bet-panel"
              onClick={() => setBetOpen((open) => !open)}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-white/10 ${TOUCH}`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">Attach a bet</span>
                <span className="mt-0.5 block text-xs font-normal text-gray-400">
                  {betOpen ? 'Hide the ETH bet' : 'Optional. Open to add an ETH bet.'}
                </span>
              </span>
              <ChevronRightIcon
                className={`h-5 w-5 shrink-0 text-gray-300 transition-transform ${betOpen ? 'rotate-90' : ''}`}
                aria-hidden
              />
            </button>
            <BetPrimaryActionContext.Provider value={betActionApi}>
              {betOpen ? (
                <div
                  id="deprize-predict-bet-panel"
                  className="border-t border-white/10 px-3 pb-4 pt-3"
                >
                  {props.bet}
                </div>
              ) : null}
            </BetPrimaryActionContext.Provider>
          </div>
        ) : null}

        {props.connected && (activeBet || (!props.citizenLoading && props.isCitizen)) && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                if (activeBet) betRunRef.current()
                else props.onPredict()
              }}
              disabled={
                activeBet
                  ? activeBet.disabled || props.writing
                  : !props.predictEnabled || props.writing || props.saved
              }
              aria-pressed={!activeBet && props.saved}
              className={`w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-40 ${TOUCH}`}
            >
              {primaryLabel}
            </button>
            {props.saved && props.undoEnabled && !activeBet && (
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
