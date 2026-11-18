import type { Chain } from 'thirdweb'
import { useForecastPredict } from '@/lib/forecasts/useForecastPredict'
import ForecastSharePrompt from '@/components/deprize/ForecastSharePrompt'
import { GuestConsentLine, GuestSaveNotice } from '@/components/deprize/GuestForecastNotice'
import PredictModal from '@/components/deprize/PredictModal'

/**
 * The DePrize predict window (free MOONEY forecast). Kept mounted for the
 * open prize so a saved pick and its undo survive closing the dialog.
 * A successful free forecast leaves the window open on the share prompt.
 * Guests still see how to keep the prediction.
 */
export default function ForecastPredictModal(props: {
  chain: Chain
  chainSlug: string
  deprizeId: number
  numOutcomes: number
  labels: readonly string[]
  reported: boolean
  marketLoading: boolean
  outcomeIndex: number | null
  teamName: string
  onClose: () => void
}) {
  const session = useForecastPredict({
    chain: props.chain,
    chainSlug: props.chainSlug,
    deprizeId: props.deprizeId,
    numOutcomes: props.numOutcomes,
    labels: props.labels,
    reported: props.reported,
    marketLoading: props.marketLoading,
  })

  if (props.outcomeIndex == null) {
    if (!session.shareOffer) return null
    return (
      <div className="border-t border-white/10 p-4">
        <ForecastSharePrompt />
      </div>
    )
  }
  const index = props.outcomeIndex
  const shares = session.votingPower
  const total = shares?.reduce((sum, value) => sum + value, 0) ?? 0
  const probability =
    session.chanceLoading || !shares ? NaN : total > 0 ? ((shares[index] ?? 0) / total) * 100 : 0

  return (
    <PredictModal
      mode="predict"
      teamName={props.teamName || 'this competitor'}
      probability={probability}
      chanceLoading={session.chanceLoading}
      regionRestricted={session.regionRestricted}
      connected={session.connected}
      citizenLoading={session.votingPowerLoading}
      isCitizen
      citizenNotice={
        session.votingPowerLoading ? (
          <p className="text-sm text-gray-300">Checking your voting power…</p>
        ) : null
      }
      saved={session.savedPick === index}
      offerShare={session.shareOffer && session.savedPick === index}
      writing={session.writing}
      error={session.blockedReason ?? session.error}
      predictEnabled={session.predictEnabled}
      undoEnabled={session.undoEnabled && session.savedPick === index}
      onPredict={() => {
        void session.predict(index)
      }}
      onUndo={session.undo}
      onConnect={session.onConnect}
      signedOutPredict={session.signedOutPredict}
      consentNotice={session.signedIn ? undefined : <GuestConsentLine />}
      guestNotice={
        session.isGuest && session.savedPick === index ? (
          <GuestSaveNotice
            onCreateAccount={session.onConnect}
            onExistingAccount={session.onExistingAccount}
          />
        ) : undefined
      }
      onClose={props.onClose}
      onAddEth={() => {
        // Moonbase opens the free forecast only. ETH staking stays on the DePrize page.
      }}
      outcomeIndex={index}
    />
  )
}
