import { PlusIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { FORECAST_COPY } from '@/lib/forecasts/forecastCopy'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import ForecastSharePrompt from '@/components/deprize/ForecastSharePrompt'
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
  /**
   * Free-forecast success in this visit. Hidden on the ETH bet window so the
   * prompt does not sit in the paid flow.
   */
  offerShare?: boolean
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
      className="fixed inset-0 z-[9999] flex flex-col justify-center bg-black/60 p-3 backdrop-blur-sm animate-fadeIn sm:p-4"
      showCloseButton={false}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deprize-predict-title"
        className={`mx-auto flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-mid-cool-2 to-dark-cool shadow-2xl shadow-black/60 sm:max-h-[calc(100dvh-2rem)] ${
          ethOffered ? 'max-w-md' : 'max-w-sm'
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {!wantCombined && (
              <p
                className={`text-xs font-semibold uppercase tracking-wider ${
                  isBet ? 'text-emerald-300' : 'text-indigo-300'
                }`}
              >
                {isBet ? 'ETH market' : 'MOONEY forecast · Free'}
              </p>
            )}
            <h2
              id="deprize-predict-title"
              className="mt-1 break-words text-lg font-semibold leading-snug text-white"
              data-testid="modal-title"
            >
              {isBet ? `Add ETH to ${props.teamName}` : `Predict ${props.teamName}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className={`-mr-2 -mt-1 grid shrink-0 place-items-center rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white ${TOUCH}`}
            aria-label="Close modal"
            data-testid="modal-close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-3 empty:hidden">
          <div className="flex flex-col gap-4 empty:hidden">
            {(combineEth || isBet) && (
              <p className="text-sm leading-relaxed text-gray-400">
                {combineEth
                  ? 'Your pick is weighted by your voting power. Adding ETH is optional and backs this competitor in the market.'
                  : 'Real ETH. Each share pays 1 ETH if this team wins. This does not save a MOONEY prediction.'}
              </p>
            )}

            {isBet &&
              props.connected &&
              !props.bet &&
              (props.regionRestricted ? (
                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-500"
                >
                  Add ETH
                </button>
              ) : (
                <p className="text-sm text-amber-200">
                  {props.bettingAvailable
                    ? 'The bet form is loading.'
                    : 'Adding ETH is not available for you right now.'}
                </p>
              ))}

            {!isBet && props.connected && props.citizenNotice}

            {!isBet && props.guestNotice}

            {props.connected && props.error && !isBet && (
              <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
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

        <div
          className={`flex shrink-0 flex-col gap-1.5 px-5 pb-5 empty:hidden ${
            ethOffered ? 'border-t border-white/10 pt-4' : ''
          }`}
        >
          {!isBet && props.saved && props.offerShare ? <ForecastSharePrompt /> : null}
          {!props.connected && !(props.signedOutPredict && !isBet) && (
            <button
              type="button"
              onClick={props.onConnect}
              className={`w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-gray-200 ${TOUCH}`}
            >
              {isBet ? 'Connect wallet to add ETH' : 'Connect wallet to predict'}
            </button>
          )}

          {ethOffered && props.connected && !combineEth && (
            <button
              type="button"
              onClick={() => betRunRef.current()}
              disabled={!activeBet || activeBet.disabled}
              className={`w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-white ${TOUCH}`}
            >
              {activeBet?.label ?? 'Add ETH'}
            </button>
          )}

          {!isBet && !combineEth && props.connected && !props.citizenLoading && (
            <>
              <button
                type="button"
                onClick={props.onPredict}
                disabled={!props.predictEnabled || props.writing || props.saved}
                aria-pressed={props.saved}
                className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 ${TOUCH} ${
                  ethOffered
                    ? 'border border-white/15 text-gray-200 hover:bg-white/10'
                    : 'bg-white text-slate-900 hover:bg-gray-200 disabled:hover:bg-white'
                }`}
              >
                {predictLabel}
              </button>
              {props.saved && props.undoEnabled && (
                <button
                  type="button"
                  onClick={props.onUndo}
                  className={`w-full rounded-xl px-4 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white ${TOUCH}`}
                >
                  Undo
                </button>
              )}
            </>
          )}

          {!isBet && !props.connected && props.signedOutPredict && (
            <>
              <button
                type="button"
                onClick={props.onPredict}
                disabled={!props.predictEnabled || props.writing}
                className={`w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-white ${TOUCH}`}
                data-testid="guest-predict"
              >
                {props.writing ? 'Predicting…' : `Predict ${props.teamName}`}
              </button>
              {props.error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-500/10 px-3 py-2.5 text-xs text-red-200"
                >
                  {props.error}
                </p>
              )}
              {props.consentNotice}
              <button
                type="button"
                onClick={props.onConnect}
                className={`w-full rounded-xl px-4 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white ${TOUCH}`}
              >
                Sign in instead
              </button>
            </>
          )}

          {!isBet && props.connected && !props.saved && props.consentNotice}

          {!isBet && props.regionRestricted && (
            <button
              type="button"
              onClick={addEth}
              className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white ${TOUCH}`}
            >
              <PlusIcon className="h-4 w-4" aria-hidden />
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
              className={`w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-white ${TOUCH}`}
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
