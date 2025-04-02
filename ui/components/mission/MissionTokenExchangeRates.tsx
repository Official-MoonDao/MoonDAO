import { useState } from 'react'
import { missionTokenWeights } from '@/lib/mission/missionConfig'

function Rate({
  title,
  rate,
  cycle,
  currentCycle,
  tokenSymbol,
}: {
  title: string
  rate: number
  cycle: number
  currentCycle: number
  tokenSymbol: string
}) {
  return (
    <div
      className={`${
        cycle === currentCycle
          ? 'bg-darkest-cool'
          : 'bg-darkest-cool/50 opacity-30'
      } flex items-center gap-2 rounded-full p-2`}
    >
      <div
        className={`w-8 h-8 rounded-full ${
          cycle === currentCycle
            ? 'bg-moon-green'
            : 'bg-darkest-cool/50 border-grey-400 border-2'
        }`}
      />
      <div>
        <h3 className="opacity-60">{title}</h3>
        <p>
          {`1 ETH =`}
          {rate && tokenSymbol && (
            <span className="font-bold">
              {rate.toLocaleString()} {tokenSymbol}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

export default function MissionTokenExchangeRates({
  ruleset,
  tokenSymbol,
}: {
  ruleset: any
  tokenSymbol: string
}) {
  const currentCycle = ruleset?.[0].cycleNumber

  return (
    <div id="mission-token-exchange-rates">
      <Rate
        title="Stage 1: Early Bird Rate"
        rate={missionTokenWeights[0]}
        cycle={0}
        currentCycle={currentCycle}
        tokenSymbol={tokenSymbol}
      />
      <Rate
        title="Stage 2: Main Event Rate"
        rate={missionTokenWeights[1]}
        cycle={1}
        currentCycle={currentCycle}
        tokenSymbol={tokenSymbol}
      />
      <Rate
        title="Stage 3: Closing Window Rate"
        rate={missionTokenWeights[2]}
        cycle={2}
        currentCycle={currentCycle}
        tokenSymbol={tokenSymbol}
      />
    </div>
  )
}
