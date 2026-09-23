import DePrizeAdminPanel from '@/components/deprize/DePrizeAdminPanel'
import type { DePrizeState } from '@/lib/deprize/constants'

export default function AdminSection(props: {
  deprizeId: number
  chain: any
  account: any
  state: DePrizeState
  teamIds: readonly bigint[]
  cancellationPending: boolean
  marketAddress?: string
  numOutcomes: number
  stage?: number
  resolved: boolean
  marketFeesWei?: bigint
  onDone: () => void
}) {
  return (
    <DePrizeAdminPanel
      deprizeId={props.deprizeId}
      chain={props.chain}
      account={props.account}
      state={props.state}
      teamIds={props.teamIds}
      cancellationPending={props.cancellationPending}
      marketAddress={props.marketAddress}
      numOutcomes={props.numOutcomes}
      stage={props.stage}
      resolved={props.resolved}
      marketFeesWei={props.marketFeesWei}
      onDone={props.onDone}
    />
  )
}
