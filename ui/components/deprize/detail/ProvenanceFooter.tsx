import Link from 'next/link'
import { deprizePrefixedHref } from '@/lib/deprize/competitions'
import { DePrizeState } from '@/lib/deprize/constants'

export default function ProvenanceFooter(props: {
  hasLineage: boolean
  chainSlug: string
  state: DePrizeState
  supersededBy?: number
}) {
  if (!props.hasLineage || props.state !== DePrizeState.SUPERSEDED) return null
  return (
    <div className="flex flex-col gap-1.5 px-1">
      <p className="text-xs text-amber-200/90">
        Superseded
        {props.supersededBy ? (
          <>
            {' '}
            by{' '}
            <Link
              href={deprizePrefixedHref(props.chainSlug, props.supersededBy)}
              className="underline underline-offset-2 hover:text-amber-100"
            >
              DePrize #{props.supersededBy}
            </Link>
          </>
        ) : null}{' '}
        — new bets happen there. You can still sell here.
      </p>
    </div>
  )
}
