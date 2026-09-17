import EthUsd from '@/components/deprize/EthUsd'
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
  poolEth?: number | null
  pendingOwn?: boolean
}) {
  const { patrons, poolEth, pendingOwn } = props
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

  if (patrons.status === 'error' || !patrons.complete) {
    return (
      <div className="space-y-2">
        <p className="text-amber-300 text-sm">Couldn&apos;t load patrons right now.</p>
        <button
          type="button"
          className="text-sm text-indigo-300 underline"
          onClick={() => patrons.refresh()}
        >
          Retry
        </button>
      </div>
    )
  }

  if (patrons.patronCount === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-white text-sm font-semibold">Patrons</h3>
        <p className="text-gray-400 text-sm">Be the first patron.</p>
        {pendingOwn && (
          <p className="text-indigo-200 text-xs">
            Your contribution is confirming — the wall updates within a minute.
          </p>
        )}
      </div>
    )
  }

  const feeEth =
    poolEth != null && Number.isFinite(poolEth)
      ? Math.max(0, poolEth - patrons.totalDirectEth)
      : null

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-white text-sm font-semibold">Patrons</h3>
        <p className="text-gray-400 text-xs">
          <EthUsd eth={patrons.totalDirectEth} prize /> · {patrons.patronCount}{' '}
          {patrons.patronCount === 1 ? 'patron' : 'patrons'}
        </p>
      </div>
      {pendingOwn && (
        <p className="text-indigo-200 text-xs">
          Your contribution is confirming — the wall updates within a minute.
        </p>
      )}
      <ul className="space-y-1.5">
        {patrons.patrons.map((row) => (
          <li key={row.payer} className="flex justify-between gap-3 text-sm">
            <span className="text-gray-200 truncate">{row.displayName}</span>
            <EthUsd eth={Number(BigInt(row.totalWei)) / Number(UNIT)} prize />
          </li>
        ))}
      </ul>
      {patrons.otherRoutes.count > 0 && (
        <p className="text-gray-500 text-xs">
          plus {patrons.otherRoutes.count} contributions via other routes ·{' '}
          {patrons.otherRoutes.totalEth.toFixed(4)} ETH. Gift pays and smart-account
          pays are counted in the pool but not attributed by name.
        </p>
      )}
      {feeEth != null && (
        <p className="text-gray-500 text-xs">
          The prize pool also includes {feeEth.toFixed(4)} ETH from bet fees. Patrons
          are direct contributions only.
        </p>
      )}
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
