import { useEffect, useState } from 'react'
import type { Chain } from 'thirdweb'
import DePrizePatrons from '@/components/deprize/DePrizePatrons'
import FundPrizeModal from '@/components/deprize/FundPrizeModal'
import {
  DEPRIZE_FUND_ENABLED,
  DEPRIZE_PATRONS_ENABLED,
  FUND_GEO_OPEN,
  PATRONS_PENDING_TTL_MS,
} from '@/lib/deprize/constants'
import { useDePrizeRestricted } from '@/lib/deprize/deprizeRestrictedContext'
import { usePrizePatrons } from '@/lib/deprize/usePrizePatrons'

export default function PrizePoolSlot(props: {
  poolUsd?: number | null
  asOf?: string | null
  poolEth?: number | null
  deprizeId?: number
  jbProjectId?: number
  prizeTitle?: string
  chain?: Chain
  account?: any
  refreshNonce?: number
  onFunded?: () => void
}) {
  const restricted = useDePrizeRestricted()
  const fundAllowed = FUND_GEO_OPEN || !restricted
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

  const showFund =
    DEPRIZE_FUND_ENABLED && fundAllowed && props.jbProjectId != null && props.chain && props.account

  return (
    <section
      id="deprize-prize-pool"
      className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 space-y-4"
    >
      {DEPRIZE_PATRONS_ENABLED && (
        <DePrizePatrons
          patrons={patrons}
          pendingOwn={Boolean(pendingPayer)}
        />
      )}

      {showFund && (
        <button
          type="button"
          className="rounded-full border border-white/20 px-4 py-2 text-sm text-white"
          onClick={() => setFundOpen(true)}
        >
          Fund the prize
        </button>
      )}

      {fundOpen && props.jbProjectId != null && props.chain && props.deprizeId != null && (
        <FundPrizeModal
          deprizeId={props.deprizeId}
          jbProjectId={props.jbProjectId}
          prizeTitle={props.prizeTitle || `DePrize #${props.deprizeId}`}
          chain={props.chain}
          account={props.account}
          onClose={() => setFundOpen(false)}
          onDone={(payer) => {
            setPendingPayer(payer.toLowerCase())
            patrons.refresh({ fresh: true })
            props.onFunded?.()
          }}
        />
      )}
    </section>
  )
}
