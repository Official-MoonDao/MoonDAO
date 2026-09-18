import { LockClosedIcon } from '@heroicons/react/24/outline'
import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { CITIZEN_GATED_ROUTES } from '@/lib/citizen/citizenSubscription'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import Modal from '../layout/Modal'
import { SubscriptionModal } from './SubscriptionModal'

// Dismissals last for the browser session so the dialog doesn't reappear on
// every navigation — but landing on a citizen-gated route overrides it, since
// there the user is actively reaching for something they've lost.
const DISMISSED_KEY = 'moondao_citizen_renewal_dismissed'

const LOCKED_FEATURES = [
  'Your citizen dashboard',
  'Quests and XP rewards',
  'Applying to jobs on the job board',
  'Citizen pricing in the marketplace',
  'Submitting contributions for rewards',
]

/**
 * Global renewal prompt for citizens whose subscription has lapsed. Mounted
 * once in Layout; any page can bring it up with `openRenewalModal()`.
 */
export default function CitizenExpiredModal() {
  const router = useRouter()
  const {
    expiredCitizen,
    isExpired,
    subscriptionExpiresAt,
    isRenewalModalOpen,
    openRenewalModal,
    closeRenewalModal,
  } = useContext(CitizenContext)

  const [isRenewing, setIsRenewing] = useState(false)

  const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const citizenContract = useContract({
    address: CITIZEN_ADDRESSES[chainSlug],
    chain: DEFAULT_CHAIN_V5,
    abi: CitizenABI as any,
  })

  useEffect(() => {
    if (!isExpired) return

    if (CITIZEN_GATED_ROUTES.includes(router.pathname)) {
      openRenewalModal()
      return
    }

    if (sessionStorage.getItem(DISMISSED_KEY)) return
    openRenewalModal()
  }, [isExpired, router.pathname, openRenewalModal])

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Private browsing — the dialog just reappears on the next navigation.
    }
    setIsRenewing(false)
    closeRenewalModal()
  }

  if (!isRenewalModalOpen || !expiredCitizen) return null

  if (isRenewing) {
    return (
      <SubscriptionModal
        selectedChain={DEFAULT_CHAIN_V5}
        setEnabled={dismiss}
        nft={expiredCitizen}
        subscriptionContract={citizenContract}
        validPass={false}
        expiresAt={subscriptionExpiresAt}
        type="citizen"
      />
    )
  }

  const expirationDate = subscriptionExpiresAt
    ? new Date(subscriptionExpiresAt * 1000).toLocaleDateString()
    : null

  return (
    <Modal
      id="citizen-expired-modal"
      setEnabled={dismiss}
      title="Your Citizenship Has Expired"
      size="lg"
    >
      <div data-testid="citizen-expired-content" className="flex flex-col gap-6">
        <div className="flex gap-4">
          <LockClosedIcon className="w-8 h-8 text-moon-orange flex-shrink-0" />
          <p className="text-gray-300">
            {expirationDate
              ? `Your citizenship lapsed on ${expirationDate}. `
              : 'Your citizenship has lapsed. '}
            Renew it to restore access to everything the Space Acceleration
            Network unlocks.
          </p>
        </div>

        <div className="bg-darkest-cool p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            Currently locked
          </h3>
          <ul className="flex flex-col gap-2">
            {LOCKED_FEATURES.map((feature) => (
              <li key={feature} className="text-gray-400 text-sm flex gap-2">
                <span aria-hidden>•</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            data-testid="renew-citizenship-button"
            onClick={() => setIsRenewing(true)}
            className="flex-1 gradient-2 rounded-full py-3 px-6 text-white font-medium"
          >
            Renew Citizenship
          </button>
          <button
            data-testid="dismiss-renewal-button"
            onClick={dismiss}
            className="flex-1 rounded-full py-3 px-6 text-gray-300 border border-white/10 hover:bg-white/5 transition-colors"
          >
            Not Now
          </button>
        </div>
      </div>
    </Modal>
  )
}
