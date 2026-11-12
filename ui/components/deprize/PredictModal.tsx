import { XMarkIcon } from '@heroicons/react/20/solid'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { FORECAST_COPY } from '@/lib/forecasts/forecastCopy'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import {
  BetPrimaryActionContext,
  predictionActionLabel,
  type BetPrimaryAction,
} from '@/components/deprize/betPrimaryAction'
import { TOUCH } from '@/components/deprize/detail/primitives'
import Modal from '@/components/layout/Modal'

/**
 * Predict records the free pick. "Add ETH to your prediction" opens the ETH
 * form when this visitor can stake, or toasts when their region cannot.
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
  /**
   * Signed out, and Predict saves without a login: the site creates a guest
   * wallet on the tap. "Sign in" stays available as the secondary action.
   */
  signedOutPredict?: boolean
  /** Terms line shown under Predict for a visitor who has not signed in. */
  consentNotice?: ReactNode
  /** How a guest keeps a saved prediction. */
  guestNotice?: ReactNode
  onClose: () => void
  /** Switch this window to the ETH form. Called only when staking is allowed. */
  onAddEth: () => void
  /**
   * Eligible visitors see the ETH form already open. Predict stakes that ETH
   * and records the pick in one click.
   */
  combineEth?: boolean
  /** Bet form, bet mode only. Omitted when this visitor cannot bet yet. */
  bet?: ReactNode
  /**
   * Which competitor this window is for. The modal stays mounted across
   * switches, and a late roster name (`Team #N` → NFT metadata) is not a switch.
   */
  outcomeIndex: number
}) {
  const isBet = props.mode === 'bet'
  const wantCombined = !!props.combineEth && !props.regionRestricted
  const ethOffered = !!props.bet && !props.regionRestricted && (isBet || wantCombined)
  const combineEth = wantCombined && ethOffered && props.connected
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

  function addEth() {
    if (props.regionRestricted) {
      toast.error(FORECAST_COPY.restrictedNote, { style: toastStyle })
      return
    }
    if (!props.bettingAvailable) {
      toast.error('Adding ETH is unavailable right now.', { style: toastStyle })
      return
    }
    props.onAddEth()
  }

  return (
    // Own frame instead of the default modal: the panel never grows past the
    // screen, the bet form scrolls, and the action button stays in view.
    <Modal
      id="deprize-predict"
      setEnabled={(open) => !open && props.onClose()}
      className="fixed inset-0 z-[9999] flex flex-col justify-center bg-[#00000080] bg-gradient-to-t from-[#3F3FA690] via-[#00000080] to-transparent p-2 backdrop-blur-sm animate-fadeIn sm:p-4"
      showCloseButton={false}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deprize-predict-title"
        className="mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col rounded-lg bg-dark-cool shadow-xl sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
          <h2
            id="deprize-predict-title"
            className="text-xl font-semibold text-white"
            data-testid="modal-title"
          >
            {isBet ? `Add ETH to ${props.teamName}` : `Predict ${props.teamName}`}
          </h2>
          <button
            type="button"
            onClick={props.onClose}
            className={`-mr-2 grid place-items-center text-gray-400 transition-colors hover:text-white ${TOUCH}`}
            aria-label="Close modal"
            data-testid="modal-close"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4">
            {!wantCombined && (
              <div className="flex items-center gap-3 text-sm">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isBet
                      ? 'bg-emerald-400/15 text-emerald-300'
                      : 'bg-indigo-400/15 text-indigo-200'
                  }`}
                >
                  {isBet ? 'ETH market' : 'MOONEY forecast · free'}
                </span>
              </div>
            )}
            {(combineEth || isBet) && (
              <p className="text-sm text-gray-300">
                {combineEth
                  ? 'Your pick is weighted by your voting power. Adding ETH is optional and backs this competitor in the market.'
                  : 'Real ETH. Each share pays 1 ETH if this team wins. This does not save a MOONEY prediction.'}
              </p>
            )}

            {!props.connected && !(props.signedOutPredict && !isBet) && (
              <button
                type="button"
                onClick={props.onConnect}
                className={`w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 ${TOUCH}`}
              >
                {isBet ? 'Connect wallet to add ETH' : 'Connect wallet to predict'}
              </button>
            )}

            {isBet &&
              props.connected &&
              !props.bet &&
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

            {!isBet && props.guestNotice}

            {props.connected && props.error && !isBet && (
              <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {props.error}
              </p>
            )}

            {ethOffered ? (
              <BetPrimaryActionContext.Provider value={betActionApi}>
                <div data-testid="deprize-bet-form">{props.bet}</div>
              </BetPrimaryActionContext.Provider>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-white/10 px-4 py-3 empty:hidden sm:px-6">
          {ethOffered && props.connected && !combineEth && (
            <button
              type="button"
              onClick={() => betRunRef.current()}
              disabled={!activeBet || activeBet.disabled}
              className={`w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-40 ${TOUCH}`}
            >
              {activeBet?.label ?? 'Add ETH'}
            </button>
          )}

          {!isBet && !combineEth && props.connected && !props.citizenLoading && (
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

          {!isBet && !props.connected && props.signedOutPredict && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={props.onPredict}
                disabled={!props.predictEnabled || props.writing}
                className={`w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-40 ${TOUCH}`}
                data-testid="guest-predict"
              >
                {props.writing ? 'Predicting…' : `Predict ${props.teamName}`}
              </button>
              {props.error && (
                <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {props.error}
                </p>
              )}
              {props.consentNotice}
              <button
                type="button"
                onClick={props.onConnect}
                className="text-xs text-gray-400 underline hover:text-gray-200"
              >
                Sign in instead
              </button>
            </div>
          )}

          {!isBet && props.connected && !props.saved && props.consentNotice}

          {!isBet && props.regionRestricted && (
            <button
              type="button"
              onClick={addEth}
              className={`w-full rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10 ${TOUCH}`}
            >
              Add ETH to your prediction
            </button>
          )}

          {combineEth && props.connected && (
            <button
              type="button"
              onClick={() => {
                // No ETH amount: save the prediction only. An amount stakes and records the pick.
                if (!activeBet) {
                  props.onPredict()
                  return
                }
                void betRunRef.current()
              }}
              disabled={
                props.writing ||
                activeBet?.label.startsWith('Placing') ||
                (!activeBet && (!props.predictEnabled || props.saved))
              }
              className={`w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-40 ${TOUCH}`}
            >
              {activeBet?.kind === 'fund'
                ? activeBet.label
                : !activeBet
                ? predictLabel
                : props.writing || activeBet.label.startsWith('Placing')
                ? 'Predicting…'
                : 'Predict'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
