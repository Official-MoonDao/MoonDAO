import { usePrivy } from '@privy-io/react-auth'
import { useCallback, useMemo } from 'react'

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000

function toMillis(value: any): number | null {
  if (!value) return null
  if (value instanceof Date) return value.getTime()
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

export interface OnrampVerification {
  /** Verified E.164 phone number, if present and fresh enough. */
  phoneNumber: string | null
  /** ISO timestamp of the latest phone verification, if any. */
  phoneVerifiedAt: string | null
  /** Verified email address (from email or Google login), if present. */
  email: string | null
  /** True when a phone is linked but its verification is older than 60 days. */
  phoneVerificationStale: boolean
  hasPhone: boolean
  hasEmail: boolean
  /** True when both a fresh phone and an email are available. */
  isReady: boolean
  /** Trigger Privy's phone link/verify flow (refreshes the timestamp). */
  linkPhone: () => void
  /** Trigger Privy's email link flow. */
  linkEmail: () => void
}

/**
 * Reads the user's Privy-linked phone and email to satisfy Coinbase Headless
 * Onramp's verification requirement (US phone verified within 60 days + email).
 * We rely on Privy's own OTP flows for linking/verification.
 */
export default function useOnrampVerification(): OnrampVerification {
  const { user, linkPhone, linkEmail } = usePrivy()

  return useMemo(() => {
    const accounts: any[] = (user?.linkedAccounts as any[]) || []

    const phoneAccount = accounts.find((a) => a.type === 'phone')
    const emailAccount = accounts.find((a) => a.type === 'email')
    const googleAccount = accounts.find(
      (a) => a.type === 'google_oauth' || a.type === 'google'
    )

    const phoneNumberRaw: string | null = phoneAccount?.number || null
    const phoneVerifiedMs =
      toMillis(phoneAccount?.latestVerifiedAt) ??
      toMillis(phoneAccount?.verifiedAt) ??
      toMillis(phoneAccount?.firstVerifiedAt)

    const phoneVerificationStale =
      !!phoneNumberRaw &&
      (phoneVerifiedMs == null || Date.now() - phoneVerifiedMs > SIXTY_DAYS_MS)

    const email: string | null =
      emailAccount?.address || googleAccount?.email || null

    const hasPhone = !!phoneNumberRaw && !phoneVerificationStale
    const hasEmail = !!email

    return {
      phoneNumber: hasPhone ? phoneNumberRaw : null,
      phoneVerifiedAt:
        hasPhone && phoneVerifiedMs != null
          ? new Date(phoneVerifiedMs).toISOString()
          : null,
      email,
      phoneVerificationStale,
      hasPhone,
      hasEmail,
      isReady: hasPhone && hasEmail,
      linkPhone,
      linkEmail,
    }
  }, [user?.linkedAccounts, linkPhone, linkEmail])
}
