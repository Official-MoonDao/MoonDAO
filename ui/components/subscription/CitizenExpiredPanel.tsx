import { LockClosedIcon } from '@heroicons/react/24/outline'
import { useContext } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'

type CitizenExpiredPanelProps = {
  feature?: string
}

/**
 * Placeholder shown in place of a citizen-gated feature when the viewer's
 * citizenship has lapsed. The renewal dialog itself lives in Layout; this just
 * explains the empty page and offers a way back to it once dismissed.
 */
export default function CitizenExpiredPanel({
  feature = 'This feature',
}: CitizenExpiredPanelProps) {
  const { subscriptionExpiresAt, openRenewalModal } = useContext(CitizenContext)

  const expirationDate = subscriptionExpiresAt
    ? new Date(subscriptionExpiresAt * 1000).toLocaleDateString()
    : null

  return (
    <div
      data-testid="citizen-expired-panel"
      className="w-full max-w-2xl mx-auto my-16 p-8 rounded-2xl bg-gradient-to-b from-slate-700/20 to-slate-800/30 border border-slate-600/30 flex flex-col items-center text-center gap-4"
    >
      <LockClosedIcon className="w-10 h-10 text-moon-orange" />
      <h1 className="font-GoodTimes text-2xl text-white">
        Your Citizenship Has Expired
      </h1>
      <p className="text-slate-300 max-w-md">
        {expirationDate
          ? `Your citizenship lapsed on ${expirationDate}. `
          : 'Your citizenship has lapsed. '}
        {feature} is available to active citizens of the Space Acceleration
        Network.
      </p>
      <button
        data-testid="open-renewal-modal-button"
        onClick={openRenewalModal}
        className="gradient-2 rounded-full py-3 px-8 text-white font-medium"
      >
        Renew Citizenship
      </button>
    </div>
  )
}
