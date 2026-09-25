import { useEffect, useState } from 'react'
import type { Chain } from 'thirdweb'
import {
  DEPRIZE_FUND_ENABLED,
  DEPRIZE_PATRONS_ENABLED,
  PATRONS_PENDING_TTL_MS,
} from '@/lib/deprize/constants'
import { usePrizePatrons } from '@/lib/deprize/usePrizePatrons'
import { getChainSlug } from '@/lib/thirdweb/chain'
import DePrizeCallers from '@/components/deprize/DePrizeCallers'
import DePrizePatrons from '@/components/deprize/DePrizePatrons'
import EthUsd from '@/components/deprize/EthUsd'
import DePrizeLaunchpadContribute from '@/components/deprize/DePrizeLaunchpadContribute'
import { CARD, TOUCH } from './primitives'

function PoolFigure({ eth, loading }: { eth?: number | null; loading?: boolean }) {
  if (loading) {
    return (
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white align-[-2px]"
        role="status"
        aria-label="Loading"
      />
    )
  }
  return (
    <EthUsd
      eth={eth}
      prize
      className="text-[17px] font-semibold tracking-tight text-white"
      usdClassName="text-[15px] font-medium text-[#9aa3b2]"
    />
  )
}

export default function PrizePoolSlot(props: {
  poolUsd?: number | null
  asOf?: string | null
  poolEth?: number | null
  poolLoading?: boolean
  /** Sum of bets placed into the market (`totalStaked`). Not the prize pool. */
  volumeEth?: number | null
  volumeLoading?: boolean
  deprizeId?: number
  jbProjectId?: number
  prizeTitle?: string
  chain?: Chain
  account?: any
  refreshNonce?: number
  onFunded?: () => void
  labels?: string[]
  bettorAddresses?: readonly string[]
}) {
  const [fundOpen, setFundOpen] = useState(false)
  const [pendingPayer, setPendingPayer] = useState<string | null>(null)

  const patrons = usePrizePatrons({
    deprizeId: props.deprizeId,
    chainId: props.chain?.id,
    jbProjectId: props.jbProjectId,
    refreshNonce: props.refreshNonce,
    enabled: DEPRIZE_PATRONS_ENABLED && props.jbProjectId != null && props.deprizeId != null,
  })

  useEffect(() => {
    if (!pendingPayer) return
    const found = patrons.patrons.some((row) => row.payer === pendingPayer.toLowerCase())
    if (found) {
      setPendingPayer(null)
      return
    }
    const t = setTimeout(() => setPendingPayer(null), PATRONS_PENDING_TTL_MS)
    return () => clearTimeout(t)
  }, [pendingPayer, patrons.patrons])

  const showFund = DEPRIZE_FUND_ENABLED && props.jbProjectId != null && !!props.chain

  function onFund() {
    // Always open the contribution window. A signed-in session with no
    // thirdweb account used to make this click a no-op.
    setFundOpen(true)
  }

  return (
    <section
      id="deprize-prize-pool"
      className={CARD}
    >
      <div>
        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <h3 className="text-[13px] font-medium text-[#c5cad3]">Prize pool</h3>
            <p className="mt-1" title={props.asOf ? `As of ${props.asOf}` : undefined}>
              <PoolFigure eth={props.poolEth} loading={props.poolLoading} />
            </p>
          </div>
          <div className="min-w-0">
            <h3 className="text-[13px] font-medium text-[#c5cad3]">Betting volume</h3>
            <p
              className="mt-1"
              title="Sum of bets placed into this market. Separate from the prize pool."
            >
              <PoolFigure eth={props.volumeEth} loading={props.volumeLoading} />
            </p>
          </div>
        </div>
        {showFund && (
          <button
            type="button"
            className={`mt-4 w-full rounded-lg bg-[#2f5bff] px-4 py-3 text-[15px] font-semibold text-white shadow-[0_3px_0_0_#1e3a8a] ${TOUCH}`}
            onClick={onFund}
          >
            Fund the prize
          </button>
        )}
      </div>

      {DEPRIZE_PATRONS_ENABLED && (
        <div className="mt-4 border-t border-white/10 pt-4">
        <DePrizePatrons
          patrons={patrons}
          pendingOwn={Boolean(pendingPayer)}
          chainSlug={props.chain ? getChainSlug(props.chain) : undefined}
        />
        </div>
      )}

      <div className="mt-4 border-t border-white/10 pt-4">
      <DePrizeCallers
        chainSlug={props.chain ? getChainSlug(props.chain) : 'arbitrum'}
        deprizeId={props.deprizeId}
        labels={props.labels ?? []}
        bettorAddresses={props.bettorAddresses ?? []}
      />
      </div>

      {props.jbProjectId != null && props.chain && props.deprizeId != null && (
        <DePrizeLaunchpadContribute
          jbProjectId={props.jbProjectId}
          chainId={props.chain.id}
          open={fundOpen}
          onClose={() => setFundOpen(false)}
          onFunded={() => {
            const payer = props.account?.address
            if (typeof payer === 'string') setPendingPayer(payer.toLowerCase())
            patrons.refresh({ fresh: true })
            props.onFunded?.()
          }}
        />
      )}
    </section>
  )
}
