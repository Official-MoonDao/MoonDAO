import Link from 'next/link'
import { DEPRIZE_TERMS_URL } from '@/lib/deprize/constants'

/** Shown wherever a signed-out visitor can predict. The tap itself is the agreement. */
export function GuestConsentLine() {
  return (
    <p className="text-center text-[11px] text-gray-400" data-testid="guest-consent">
      By predicting, you agree to the{' '}
      <Link href={DEPRIZE_TERMS_URL} className="underline hover:text-gray-200">
        DePrize Terms
      </Link>
      .
    </p>
  )
}

/** A guest's prediction lives on this device until it is saved to an account. */
export function GuestSaveNotice(props: {
  onCreateAccount: () => void
  onExistingAccount: () => void
}) {
  return (
    <p className="text-xs text-gray-300" data-testid="guest-save-notice">
      Saved on this device.{' '}
      <button type="button" onClick={props.onCreateAccount} className="text-indigo-300 underline">
        Create an account
      </button>{' '}
      to keep it, or{' '}
      <button type="button" onClick={props.onExistingAccount} className="text-indigo-300 underline">
        sign in
      </button>{' '}
      if you already have one.
    </p>
  )
}
