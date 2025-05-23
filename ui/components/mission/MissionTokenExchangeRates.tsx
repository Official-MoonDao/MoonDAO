function Rate({
  title,
  rate,
  tokenSymbol,
  active,
}: {
  title: string
  rate: number
  tokenSymbol: string
  active?: boolean
}) {
  return (
    <div
      className={`${
        active ? '' : ' opacity-30'
      } flex items-center gap-2 rounded-full`}
    >
      <div>
        <h3 className="opacity-60 text-sm">{title}</h3>
        <p>
          {`1 ETH = `}
          {rate && tokenSymbol && (
            <span className="font-bold">
              {rate.toLocaleString()} ${tokenSymbol}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

export default function MissionTokenExchangeRates({
  tokenSymbol,
}: {
  currentStage: number
  tokenSymbol: string
}) {
  return (
    <div id="mission-token-exchange-rates">
      <Rate
        title={`Exchange Rate`}
        rate={1000}
        tokenSymbol={tokenSymbol}
        active
      />
    </div>
  )
}
