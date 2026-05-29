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

/**
 * Normalizes a phone number to E.164 (`+` followed by digits only). Privy may
 * surface numbers with spaces / parens / dashes (e.g. "+1 (202) 555-0123"),
 * which fail Coinbase's strict E.164 check. Returns null if it can't produce a
 * plausible E.164 value.
 */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  const e164 = `+${digits}`
  return /^\+[1-9]\d{1,14}$/.test(e164) ? e164 : null
}

export interface PhoneState {
  phoneNumber: string | null
  isLinked: boolean
  isFresh: boolean
  isStale: boolean
  verifiedAt: Date | null
}

/**
 * Pure computation of the phone verification state. Extracted so it can be unit
 * tested deterministically (pass `now` to control the clock).
 *
 *  - No linked phone            -> not linked, not fresh, not stale
 *  - Linked, verified < 60d ago -> fresh
 *  - Linked, verified > 60d ago -> stale
 *  - Linked, no timestamp       -> stale. Coinbase REQUIRES a
 *                                  `phoneNumberVerifiedAt` within 60 days, so a
 *                                  number we can't timestamp must be re-verified
 *                                  via Privy to obtain a fresh one.
 */
export function computePhoneState(
  account: LinkedPhoneAccount | undefined,
  fallbackNumber: string | null,
  now: number = Date.now()
): PhoneState {
  const phoneNumber = normalizePhoneE164(account?.number ?? fallbackNumber ?? null)
  const verifiedAt = pickVerifiedAt(account)
  const isLinked = !!phoneNumber
  const isFresh = !!(
    verifiedAt && now - verifiedAt.getTime() < PHONE_REVERIFICATION_INTERVAL_MS
  )
  const isStale = isLinked && !isFresh
  return { phoneNumber, isLinked, isFresh, isStale, verifiedAt }
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

  const { phoneNumber, isLinked, isFresh, isStale, verifiedAt } = computePhoneState(
    phoneAccount,
    user?.phone?.number ?? null
  )

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
