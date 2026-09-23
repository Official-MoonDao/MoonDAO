import Link from 'next/link'
import type { ReactNode } from 'react'
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
  saved: boolean
  writing: boolean
  predictEnabled: boolean
  undoEnabled: boolean
  onPredict: () => void
  onUndo: () => void
  onConnect: () => void
  onClose: () => void
  /** Bet form. Omitted when this visitor is not allowed to bet. */
  bet?: ReactNode
}) {
  const predictLabel = props.writing ? 'Predicting…' : props.saved ? 'Predicted' : 'Predict'

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

        {props.connected && props.citizenLoading && (
          <p className="text-sm text-gray-300">Checking your Citizen…</p>
        )}

        {props.connected && !props.citizenLoading && !props.isCitizen && (
          <p className="text-sm text-amber-200">
            Predictions count for Citizens.{' '}
            <Link href="/join" className="text-indigo-300 underline">
              Mint a Citizen
            </Link>
          </p>
        )}

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
            <p className="text-xs text-gray-400">No bet attached.</p>
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
            <div>
              <h3 className="text-sm font-semibold text-white">Add a bet</h3>
              <p className="mt-1 text-xs text-gray-400">
                Optional. This spends ETH and changes the odds.
              </p>
            </div>
            {props.bet}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
