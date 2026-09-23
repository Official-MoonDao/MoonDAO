import { useEffect, useState, type ReactNode } from 'react'
import { fmt } from '@/lib/deprize/format'
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
   * Open the bet form immediately. An onramp return carries the funded amount
   * inside that form, so leaving it collapsed hides the bet they just paid for.
   */
  resumeBet?: boolean
}) {
  const predictLabel = props.writing ? 'Predicting…' : props.saved ? 'Predicted' : 'Predict'
  const [betOpen, setBetOpen] = useState(!!props.resumeBet)

  useEffect(() => {
    setBetOpen(!!props.resumeBet)
  }, [props.teamName, props.resumeBet])

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

        {props.connected && !props.citizenLoading && props.isCitizen && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={props.onPredict}
              disabled={!props.predictEnabled || props.writing || props.saved}
              aria-pressed={props.saved}
              className={`w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-40 ${TOUCH}`}
            >
              {predictLabel}
            </button>
            {props.error && <p className="text-xs text-amber-200">{props.error}</p>}
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

        {props.bet ? (
          <div
            data-testid="deprize-predict-bet"
            className="flex flex-col gap-3 border-t border-white/10 pt-4"
          >
            {betOpen ? (
              <h3 className="text-sm font-semibold text-white">Attach a bet</h3>
            ) : (
              <button
                type="button"
                aria-expanded={false}
                onClick={() => setBetOpen(true)}
                className={`w-full text-left text-sm font-semibold text-white ${TOUCH}`}
              >
                Attach a bet
              </button>
            )}
            {betOpen ? props.bet : null}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
