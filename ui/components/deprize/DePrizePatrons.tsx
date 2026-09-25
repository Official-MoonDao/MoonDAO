import EthUsd from '@/components/deprize/EthUsd'
import { SCROLL_LIST, TOUCH } from '@/components/deprize/detail/primitives'
import CitizenIdentity from '@/components/layout/CitizenIdentity'
import { useCitizenRowsByOwners } from '@/lib/citizen/useCitizenRowsByOwners'
import { PATRONS_STALE_AFTER_MS, UNIT } from '@/lib/deprize/constants'
import type { PrizePatronsState } from '@/lib/deprize/usePrizePatrons'

function relativeAsOf(asOf: number): string {
  const delta = Date.now() - asOf
  if (delta < 60_000) return 'just now'
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m ago`
  return `${Math.round(delta / 3_600_000)}h ago`
}

export default function DePrizePatrons(props: {
  patrons: PrizePatronsState
  pendingOwn?: boolean
  chainSlug?: string
}) {
  const { patrons, pendingOwn, chainSlug = 'arbitrum' } = props
  const citizens = useCitizenRowsByOwners(
    patrons.patrons.map((row) => row.payer),
    chainSlug
  )
  const stale =
    patrons.status === 'ready' &&
    patrons.patronCount > 0 &&
    patrons.asOf != null &&
    Date.now() - patrons.asOf > PATRONS_STALE_AFTER_MS

  if (patrons.status === 'loading') {
    return (
      <div className="space-y-2" aria-busy="true">
        <div className="h-4 w-32 rounded bg-white/10" />
        <div className="h-3 w-full rounded bg-white/5" />
        <div className="h-3 w-5/6 rounded bg-white/5" />
      </div>
    )
  }

  if (patrons.status === 'error') {
    return (
      <div className="space-y-2">
        <p className="text-amber-300 text-sm">Couldn&apos;t load patrons right now.</p>
        <button
          type="button"
          className={`inline-flex items-center text-sm text-indigo-300 underline ${TOUCH}`}
          onClick={() => patrons.refresh()}
        >
          Retry
        </button>
      </div>
    )
  }

  if (patrons.status === 'incomplete' || !patrons.complete) {
    return (
      <div className="space-y-2">
        <p className="text-amber-300 text-sm">
          This prize has more contributions than we can list right now.
        </p>
        <button
          type="button"
          className={`inline-flex items-center text-sm text-indigo-300 underline ${TOUCH}`}
          onClick={() => patrons.refresh({ fresh: true })}
        >
          Retry
        </button>
      </div>
    )
  }

  if (patrons.patronCount === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-[15px] font-semibold text-white">Patrons</h3>
        <p className="text-gray-400 text-sm">Be the first patron.</p>
        {pendingOwn && (
          <p className="text-indigo-200 text-xs">
            Your contribution is confirming — the wall updates within a minute.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-white">Patrons</h3>
        <p className="text-xs text-[#8b93a7]">
          <EthUsd eth={patrons.totalDirectEth} prize /> · {patrons.patronCount}{' '}
          {patrons.patronCount === 1 ? 'patron' : 'patrons'}
        </p>
      </div>
      {pendingOwn && (
        <p className="text-indigo-200 text-xs">
          Your contribution is confirming — the wall updates within a minute.
        </p>
      )}
      <ul className={`space-y-1.5 ${SCROLL_LIST}`}>
        {patrons.patrons.map((row) => (
          <li
            key={row.payer}
            className="flex items-center justify-between gap-2 sm:gap-3 text-sm"
          >
            <span className="min-w-0 flex-1">
              <CitizenIdentity
                address={row.payer}
                citizen={citizens.get(row.payer.toLowerCase())}
                fallbackName={row.displayName}
              />
            </span>
            <span className="shrink-0 text-[15px] font-semibold tabular-nums text-white">
              <EthUsd eth={Number(BigInt(row.totalWei)) / Number(UNIT)} prize />
            </span>
          </li>
        ))}
      </ul>
      {patrons.asOf != null && (
        <p className={`text-xs ${stale ? 'text-amber-300' : 'text-gray-500'}`}>
          Updated {relativeAsOf(patrons.asOf)}
          {stale && (
            <>
              {' '}
              <button type="button" className="underline" onClick={() => patrons.refresh({ fresh: true })}>
                Refresh
              </button>
            </>
          )}
        </p>
      )}
    </div>
  )
}
