import { useLogin } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import type { Chain } from 'thirdweb'
import {
  DEPRIZE_FUND_ENABLED,
  DEPRIZE_PATRONS_ENABLED,
  FUND_GEO_OPEN,
  PATRONS_PENDING_TTL_MS,
} from '@/lib/deprize/constants'
import { useDePrizeRestricted } from '@/lib/deprize/deprizeRestrictedContext'
import { usePrizePatrons } from '@/lib/deprize/usePrizePatrons'
import { getChainSlug } from '@/lib/thirdweb/chain'
import DePrizeCallers from '@/components/deprize/DePrizeCallers'
import DePrizePatrons from '@/components/deprize/DePrizePatrons'
import EthUsd from '@/components/deprize/EthUsd'
import FundPrizeModal from '@/components/deprize/FundPrizeModal'
import { CARD, TOUCH } from './primitives'

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
  labels?: string[]
  bettorAddresses?: readonly string[]
}) {
  const restricted = useDePrizeRestricted()
  const { login } = useLogin()
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
    DEPRIZE_FUND_ENABLED && fundAllowed && props.jbProjectId != null && !!props.chain

  function onFund() {
    if (!props.account) {
      login()
      return
    }
    setFundOpen(true)
  }

  return (
    <section id="deprize-prize-pool" className={`${CARD} space-y-4`}>
      <div>
        <h3 className="text-white text-sm font-semibold">Prize pool</h3>
        <p className="mt-1" title={props.asOf ? `As of ${props.asOf}` : undefined}>
          <EthUsd eth={props.poolEth} prize />
        </p>
        {showFund && (
          <button
            type="button"
            className={`mt-3 w-full sm:w-auto rounded-full border border-white/20 px-4 py-2 text-sm text-white ${TOUCH}`}
            onClick={onFund}
          >
            Fund the prize
          </button>
        )}
      </div>

      {DEPRIZE_PATRONS_ENABLED && (
        <DePrizePatrons
          patrons={patrons}
          pendingOwn={Boolean(pendingPayer)}
          chainSlug={props.chain ? getChainSlug(props.chain) : undefined}
        />
      )}

      <DePrizeCallers
        chainSlug={props.chain ? getChainSlug(props.chain) : 'arbitrum'}
        deprizeId={props.deprizeId}
        labels={props.labels ?? []}
        bettorAddresses={props.bettorAddresses ?? []}
      />

      {fundOpen && props.jbProjectId != null && props.chain && props.deprizeId != null && props.account && (
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
