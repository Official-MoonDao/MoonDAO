import {
  MISSION_STAGE_NAMES,
  MISSION_TOKEN_WEIGHTS,
} from '@/lib/mission/missionConfig'

function Rate({
  title,
  rate,
  stage,
  currentStage,
  tokenSymbol,
}: {
  title: string
  rate: number
  stage: number
  currentStage: number
  tokenSymbol: string
}) {
  return (
    <div
      className={`${
        stage === currentStage
          ? 'bg-darkest-cool'
          : 'bg-darkest-cool/50 opacity-30'
      } flex items-center gap-2 rounded-full p-2`}
    >
      <div
        className={`w-8 h-8 rounded-full ${
          stage === currentStage
            ? 'bg-moon-green'
            : 'bg-darkest-cool/50 border-grey-400 border-2'
        }`}
      />
      <div>
        <h3 className="opacity-60">{title}</h3>
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
  currentStage,
  tokenSymbol,
}: {
  currentStage: number
  tokenSymbol: string
}) {
  // Default to stage 1 if currentStage is undefined
  const stage = currentStage || 1

  return (
    <div id="mission-token-exchange-rates">
      <Rate
        title={`Stage 1: ${MISSION_STAGE_NAMES?.[1] ?? ''}`}
        rate={MISSION_TOKEN_WEIGHTS[0]}
        stage={1}
        currentStage={stage}
        tokenSymbol={tokenSymbol}
      />
      <Rate
        title={`Stage 2: ${MISSION_STAGE_NAMES?.[2] ?? ''}`}
        rate={MISSION_TOKEN_WEIGHTS[1]}
        stage={2}
        currentStage={stage}
        tokenSymbol={tokenSymbol}
      />
      <Rate
        title={`Stage 3: ${MISSION_STAGE_NAMES?.[3] ?? ''}`}
        rate={MISSION_TOKEN_WEIGHTS[2]}
        stage={3}
        currentStage={stage}
        tokenSymbol={tokenSymbol}
      />
    </div>
  )
}
