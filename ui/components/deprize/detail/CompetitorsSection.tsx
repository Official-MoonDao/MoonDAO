import { SEED_ATLAS, orgById, projectById } from '@/lib/lunar-atlas'
import { isCompetitorClaimed } from '@/lib/deprize/competitions'
import DePrizeTeamCard from '@/components/deprize/DePrizeTeamCard'

export default function CompetitorsSection(props: {
  numOutcomes: number
  rankedOutcomes: Array<{ index: number; [key: string]: any }>
  teamIds: readonly bigint[]
  raceBinding: ReturnType<typeof import('@/lib/deprize/competitions').getDePrizeRaceBinding>
  teamContract: any
  outcomeColors: string[]
  marketLoading: boolean
  showResolved: boolean
  isRefundVector: boolean
  winningIndex: number
  bettingOpen: boolean
  tradingHalted: boolean
  userAddress?: string
  withdrawnByTeamId: Record<string, boolean>
  onBet: (index: number) => void
}) {
  if (props.numOutcomes <= 0) return null
  return (
    <div className="flex flex-col gap-3">
      <h3 className="title-text-colors text-lg font-GoodTimes">Competitors</h3>
      {props.rankedOutcomes.map((o) => {
        const teamId = props.teamIds[o.index] ?? 0n
        const outcomeBinding = props.raceBinding?.outcomes[o.index]
        const isField = !!outcomeBinding?.field
        const atlasProject =
          !isField && outcomeBinding?.projectId
            ? projectById(SEED_ATLAS, outcomeBinding.projectId)
            : undefined
        const atlasOrg = atlasProject
          ? orgById(SEED_ATLAS, atlasProject.orgId)
          : undefined
        const claimed = isCompetitorClaimed(outcomeBinding)
        return (
          <div id={`deprize-outcome-${o.index}`} key={o.index}>
            <DePrizeTeamCard
              outcome={o as any}
              teamId={teamId}
              teamContract={props.teamContract}
              color={props.outcomeColors[o.index]}
              loading={props.marketLoading}
              resolved={props.showResolved}
              isRefundVector={props.isRefundVector}
              isWinningSlot={props.showResolved && o.index === props.winningIndex}
              bettingOpen={props.bettingOpen}
              tradingHalted={props.tradingHalted}
              busy={false}
              userConnected={!!props.userAddress}
              onBet={props.onBet}
              isField={isField}
              withdrawn={!!props.withdrawnByTeamId[teamId.toString()]}
              hrefOverride={
                outcomeBinding?.projectId
                  ? `/moonbase/${outcomeBinding.projectId}`
                  : undefined
              }
              nameOverride={atlasOrg?.name || atlasProject?.name}
              vehicleLabel={outcomeBinding?.vehicleLabel}
              backLabel={
                isField
                  ? 'Back the field'
                  : atlasOrg?.name || atlasProject?.name
                    ? `Back ${atlasOrg?.name || atlasProject?.name}`
                    : undefined
              }
              imageOverride={claimed ? atlasOrg?.logoURI : undefined}
              unclaimed={!isField && !!outcomeBinding && !claimed}
              participation={
                isField || !outcomeBinding
                  ? undefined
                  : claimed
                    ? 'official'
                    : 'unofficial'
              }
            />
          </div>
        )
      })}
    </div>
  )
}
