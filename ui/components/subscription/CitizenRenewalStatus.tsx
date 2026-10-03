import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { useContext, useState } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'
import {
  citizenshipRenewalLabel,
  isCitizenshipRenewalUrgent,
} from '@/lib/citizen/citizenSubscription'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { SubscriptionModal } from './SubscriptionModal'

type CitizenRenewalStatusViewProps = {
  expiresAt: number
  onRenew: () => void
  className?: string
  nowMs?: number
}

/**
 * Expiration date plus a Renew button. Always visible for an active citizen.
 * Within 30 days the button turns into a red alert.
 */
export function CitizenRenewalStatusView({
  expiresAt,
  onRenew,
  className,
  nowMs,
}: CitizenRenewalStatusViewProps) {
  const urgent = isCitizenshipRenewalUrgent(expiresAt, nowMs)
  const label = citizenshipRenewalLabel(expiresAt, nowMs)

  return (
    <div
      data-testid="citizen-renewal-status"
      data-urgent={urgent ? 'true' : 'false'}
      className={`inline-flex max-w-full items-center gap-2 rounded-xl border pl-3 pr-1.5 py-1.5 ${
        urgent
          ? 'w-full justify-between border-red-400/50 bg-red-500/15'
          : 'border-white/10 bg-white/5'
      } ${className ?? ''}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {urgent && (
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 text-red-300" aria-hidden />
        )}
        <span
          data-testid="citizen-renewal-date"
          className={`min-w-0 truncate text-sm ${
            urgent ? 'font-medium text-red-100' : 'text-white/70'
          }`}
        >
          {label}
        </span>
      </div>
      <button
        type="button"
        data-testid="citizen-renew-button"
        onClick={onRenew}
        className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
          urgent
            ? 'bg-red-600 text-white shadow-lg shadow-red-900/40 hover:bg-red-500'
            : 'border border-white/10 bg-white/10 text-white hover:bg-white/15'
        }`}
      >
        Renew
      </button>
    </div>
  )
}

/**
 * Dashboard control for renewing citizenship before it lapses. Opens the same
 * extend-subscription dialog the expired flow uses.
 */
export default function CitizenRenewalStatus({ className }: { className?: string }) {
  const { citizen, subscriptionExpiresAt } = useContext(CitizenContext)
  const [open, setOpen] = useState(false)

  const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const citizenContract = useContract({
    address: CITIZEN_ADDRESSES[chainSlug],
    chain: DEFAULT_CHAIN_V5,
    abi: CitizenABI as any,
  })

  const tokenId = citizen?.metadata?.id ?? citizen?.id
  if (typeof subscriptionExpiresAt !== 'number') return null
  if (tokenId === undefined || tokenId === null || tokenId === '') return null

  return (
    <>
      <CitizenRenewalStatusView
        expiresAt={subscriptionExpiresAt}
        onRenew={() => setOpen(true)}
        className={className}
      />
      {open && (
        <SubscriptionModal
          selectedChain={DEFAULT_CHAIN_V5}
          setEnabled={setOpen}
          nft={citizen}
          subscriptionContract={citizenContract}
          validPass
          expiresAt={subscriptionExpiresAt}
          type="citizen"
        />
      )}
    </>
  )
}
