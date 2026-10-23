import type { Chain } from 'thirdweb'
import { useForecastPredict } from '@/lib/forecasts/useForecastPredict'
import CitizenPredictNotice from '@/components/deprize/CitizenPredictNotice'
import PredictModal from '@/components/deprize/PredictModal'

/**
 * The DePrize predict window (free MOONEY forecast). Kept mounted for the
 * open prize so a saved pick and its undo survive closing the dialog.
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

  if (props.outcomeIndex == null) return null
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
      citizenLoading={session.citizenLoading}
      isCitizen={session.isCitizen}
      citizenNotice={
        <CitizenPredictNotice
          loading={session.citizenLoading}
          isCitizen={session.isCitizen}
          lookupFailed={session.lookupFailed}
          expired={session.expired}
          linkedCitizenAddress={session.linkedCitizenAddress}
          chainLabel={session.chainLabel}
          canSwitch={session.canSwitch}
          onSwitch={session.onSwitch}
          onConnectLinked={session.onConnectLinked}
          onRetry={session.onRetry}
        />
      }
      saved={session.savedPick === index}
      writing={session.writing}
      error={session.blockedReason ?? session.error}
      predictEnabled={session.predictEnabled}
      undoEnabled={session.undoEnabled && session.savedPick === index}
      onPredict={() => {
        void session.predict(index).then((ok) => {
          if (ok) props.onClose()
        })
      }}
      onUndo={session.undo}
      onConnect={session.onConnect}
      onClose={props.onClose}
      onAddEth={() => {
        // Moonbase opens the free forecast only. ETH staking stays on the DePrize page.
      }}
      outcomeIndex={index}
    />
  )
}
