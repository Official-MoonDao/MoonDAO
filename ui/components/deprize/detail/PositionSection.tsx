import DePrizePositionPanel from '@/components/deprize/DePrizePositionPanel'

export default function PositionSection(props: {
  userAddress?: string
  numOutcomes: number
  outcomes: any
  labels: string[]
  colors: string[]
  bets: any
  sells: any
  sellQuotes: Map<number, number>
  redeemValues: Map<number, number>
  showResolved: boolean
  isRefundVector: boolean
  winningIndex: number
  tradingHalted: boolean
  explorerTxBase: string
  onCashOut: (index: number) => void
  loading: boolean
}) {
  if (!props.userAddress || props.numOutcomes <= 0) return null
  return (
    <DePrizePositionPanel
      outcomes={props.outcomes}
      labels={props.labels}
      colors={props.colors}
      bets={props.bets}
      sells={props.sells}
      user={props.userAddress}
      sellQuotes={props.sellQuotes}
      redeemValues={props.redeemValues}
      resolved={props.showResolved}
      isRefundVector={props.isRefundVector}
      winningIndex={props.winningIndex}
      tradingHalted={props.tradingHalted}
      explorerTxBase={props.explorerTxBase}
      onCashOut={props.onCashOut}
      loading={props.loading}
    />
  )
}
