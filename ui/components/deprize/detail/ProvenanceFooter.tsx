import Link from 'next/link'
import { DePrizeState } from '@/lib/deprize/constants'
import { isRaceBindingComplete, ROSTER_DISCLAIMER } from '@/lib/deprize/competitions'

export default function ProvenanceFooter(props: {
  hasLineage: boolean
  raceBinding: ReturnType<typeof import('@/lib/deprize/competitions').getDePrizeRaceBinding>
  state: DePrizeState
  supersededBy?: number
  supersedes?: number
  generationNumber: number
}) {
  if (!props.hasLineage && !isRaceBindingComplete(props.raceBinding?.outcomes)) return null
  return (
    <div className="flex flex-col gap-1.5 px-1">
      {props.state === DePrizeState.SUPERSEDED && (
        <p className="text-xs text-amber-200/90">
          Superseded
          {props.supersededBy ? (
            <>
              {' '}by{' '}
              <Link
                href={`/deprize/${props.supersededBy}`}
                className="underline underline-offset-2 hover:text-amber-100"
              >
                DePrize #{props.supersededBy}
              </Link>
            </>
          ) : null}
          {' '}— new bets happen there. You can still sell here.
        </p>
      )}
      {props.supersedes !== undefined && props.state !== DePrizeState.SUPERSEDED && (
        <p className="text-xs text-gray-500">
          Generation {props.generationNumber} · continues from{' '}
          <Link
            href={`/deprize/${props.supersedes}`}
            className="text-indigo-300/90 underline underline-offset-2 hover:text-indigo-200"
          >
            #{props.supersedes}
          </Link>
        </p>
      )}
      {isRaceBindingComplete(props.raceBinding?.outcomes) && (
        <p className="text-[11px] text-gray-600 leading-relaxed">{ROSTER_DISCLAIMER}</p>
      )}
    </div>
  )
}
