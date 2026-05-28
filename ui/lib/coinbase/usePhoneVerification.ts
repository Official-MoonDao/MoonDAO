import { usePrivy } from '@privy-io/react-auth'
import { useCallback, useMemo } from 'react'

// Coinbase Headless Onramp requires the phone number to be re-verified at
// least every 60 days. We treat anything older as stale and force the user to
// re-verify by unlinking + re-linking via Privy.
export const PHONE_REVERIFICATION_INTERVAL_MS = 60 * 24 * 60 * 60 * 1000

type LinkedPhoneAccount = {
  type: 'phone'
  number: string
  // Privy exposes these as Date | string depending on SDK version
  verifiedAt?: string | Date | null
  firstVerifiedAt?: string | Date | null
  latestVerifiedAt?: string | Date | null
}

function pickVerifiedAt(account: LinkedPhoneAccount | undefined): Date | null {
  if (!account) return null
  const raw =
    account.latestVerifiedAt ??
    account.verifiedAt ??
    account.firstVerifiedAt ??
    null
  if (!raw) return null
  const d = raw instanceof Date ? raw : new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export interface UsePhoneVerificationReturn {
  /** E.164 phone number from Privy, e.g. "+12345678901" */
  phoneNumber: string | null
  /** True when the user has any linked phone account */
  isLinked: boolean
  /** True when the linked phone has been verified within the 60-day window */
  isFresh: boolean
  /** True when linked but the last verification is older than 60 days */
  isStale: boolean
  /** Timestamp of the most recent Privy verification, if available */
  verifiedAt: Date | null
  /** Triggers Privy's linkPhone UI to add or re-verify the phone */
  requestVerification: () => Promise<void> | void
  /** Forces a fresh verification flow (unlink then link). Useful when stale. */
  refreshVerification: () => Promise<void>
}

/**
 * Wraps Privy's phone primitives for the Coinbase Headless Onramp flow.
 *
 * Headless Onramp requires:
 *  - A real US cell phone number (not VoIP)
 *  - Verified ownership via OTP
 *  - Re-verification at least every 60 days
 *
 * We reuse Privy as the OTP provider (it already supports SMS login + linkPhone),
 * so no Twilio integration is needed.
 */
export function usePhoneVerification(): UsePhoneVerificationReturn {
  const { user, linkPhone, unlinkPhone } = usePrivy()

  const phoneAccount = useMemo<LinkedPhoneAccount | undefined>(() => {
    const accounts = (user?.linkedAccounts ?? []) as any[]
    return accounts.find((a) => a?.type === 'phone') as LinkedPhoneAccount | undefined
  }, [user?.linkedAccounts])

  const phoneNumber = phoneAccount?.number ?? user?.phone?.number ?? null
  const verifiedAt = pickVerifiedAt(phoneAccount)
  const isLinked = !!phoneNumber
  const isFresh =
    // If verifiedAt is available, check within 60-day window
    verifiedAt
      ? Date.now() - verifiedAt.getTime() < PHONE_REVERIFICATION_INTERVAL_MS
      : // No timestamp from Privy (older linked accounts) — treat as fresh to
        // avoid blocking valid users. Coinbase will reject the order itself
        // if the number is unverified.
        isLinked
  const isStale = isLinked && !isFresh

  const requestVerification = useCallback(() => {
    return linkPhone()
  }, [linkPhone])

  const refreshVerification = useCallback(async () => {
    if (phoneNumber) {
      try {
        await unlinkPhone(phoneNumber)
      } catch (error) {
        console.error('[usePhoneVerification] unlink failed', error)
      }
    }
    return linkPhone()
  }, [phoneNumber, unlinkPhone, linkPhone])

  return {
    phoneNumber,
    isLinked,
    isFresh,
    isStale,
    verifiedAt,
    requestVerification,
    refreshVerification,
  }
}

export default usePhoneVerification
