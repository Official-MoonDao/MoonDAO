import { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'
import type { DiscountBps } from '@/lib/citizen/discountInvite'

/**
 * One-time "magic link" invite tokens for citizen mints.
 *
 * A token grants a single mint to whichever wallet redeems it. `discountBps`
 * 1000 (or a missing value on older tokens) is a fully sponsored mint. 200 and
 * 500 mean the recipient pays the remainder and the relayer covers the
 * discount. Tokens live in Upstash Redis (the same store used for the Typeform
 * answer cache and rate limiting) so redemption can be enforced exactly once
 * across serverless invocations.
 *
 * Security model:
 *  - Tokens are high-entropy random strings (unguessable).
 *  - `peekInvite` is a read-only check used for UI eligibility; it never
 *    consumes the token.
 *  - `consumeInvite` performs an atomic GETDEL so two concurrent requests can
 *    never both redeem the same token. Redemption is also bound to the
 *    redeeming wallet address, which the caller must verify belongs to the
 *    authenticated Privy user before calling.
 *  - If Redis is not configured, invites are treated as disabled (peek →
 *    null, consume → false) so the feature fails closed.
 */

const TOKEN_PREFIX = 'citizen:invite:'
const REDEEMED_PREFIX = 'citizen:invite:redeemed:'
const PAYMENT_PREFIX = 'citizen:discount:payment:'
const PAYMENT_LOCK_PREFIX = 'citizen:discount:payment-lock:'
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days
const REDEEMED_AUDIT_TTL_SECONDS = 90 * 24 * 60 * 60 // keep an audit trail 90 days
const PAYMENT_TTL_SECONDS = REDEEMED_AUDIT_TTL_SECONDS
const PAYMENT_LOCK_TTL_SECONDS = 180

export type CitizenInvite = {
  /** ms epoch the invite was created. */
  createdAt: number
  /** Optional human label, e.g. "ETHDenver booth" or a recipient name. */
  label?: string
  /** Optional creator note (who minted the link). */
  createdBy?: string
  /**
   * Parts-per-thousand taken off the first year. 1000 is fully sponsored.
   * Missing on invites created before partial discounts existed.
   */
  discountBps?: DiscountBps
}

export type RedeemedInvite = CitizenInvite & {
  redeemedBy: string
  redeemedAt: number
  /** Wei the recipient paid toward a partial discount. Absent on free mints. */
  paidWei?: string
  /** Transaction hash of that payment. */
  paymentTx?: string
}

export type DiscountPaymentStatus = 'open' | 'refunded' | 'spent'

export type DiscountPaymentRecord = {
  status: DiscountPaymentStatus
  payer: string
  token: string
  valueWei: string
  updatedAt: number
}

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

function tokenKey(token: string): string {
  return `${TOKEN_PREFIX}${token}`
}

function redeemedKey(token: string): string {
  return `${REDEEMED_PREFIX}${token}`
}

function paymentKey(txHash: string): string {
  return `${PAYMENT_PREFIX}${txHash.toLowerCase()}`
}

function paymentLockKey(txHash: string): string {
  return `${PAYMENT_LOCK_PREFIX}${txHash.toLowerCase()}`
}

/** Generate an unguessable invite token (URL-safe base64, ~256 bits). */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Create a new invite token in Redis. Returns the created record, or null when
 * Redis is unavailable. `ttlSeconds` controls how long the link stays valid.
 */
export async function createInvite(
  token: string,
  meta: CitizenInvite,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<CitizenInvite | null> {
  const client = getRedis()
  if (!client || !token) return null
  await client.set(tokenKey(token), meta, { ex: ttlSeconds })
  return meta
}

/**
 * Read an invite without consuming it (used for UI eligibility checks).
 * Returns the invite record if the token exists and is unredeemed, null if
 * the token is missing/expired/consumed. Throws on Redis errors so callers
 * can distinguish transient failures from invalid invites.
 */
export async function peekInvite(token: string): Promise<CitizenInvite | null> {
  const client = getRedis()
  if (!client || !token) return null
  const invite = await client.get<CitizenInvite>(tokenKey(token))
  return invite ?? null
}

/**
 * Atomically redeem an invite for `address`. Uses GETDEL so the token can only
 * be consumed once even under concurrent requests. Returns the consumed invite
 * when this call won the redemption, or null if the token was missing, expired,
 * already used, or Redis errored.
 *
 * The caller MUST have already verified that `address` belongs to the
 * authenticated Privy user before calling this. The returned record includes
 * `discountBps`, which matters when an earlier peek missed.
 */
export async function consumeInvite(
  token: string,
  address: string,
  payment?: { paidWei: string; paymentTx: string }
): Promise<CitizenInvite | null> {
  const client = getRedis()
  if (!client || !token || !address) return null
  let invite: CitizenInvite | null = null
  try {
    // GETDEL is atomic: the first caller gets the value, everyone else gets null.
    invite = await client.getdel<CitizenInvite>(tokenKey(token))
  } catch (err) {
    console.error('[citizen-invite] consume failed:', err)
    return null
  }
  if (!invite) return null

  // Best-effort audit record of who redeemed the link (does not gate success).
  try {
    const redeemed: RedeemedInvite = {
      ...invite,
      redeemedBy: address,
      redeemedAt: Date.now(),
      ...(payment ? { paidWei: payment.paidWei, paymentTx: payment.paymentTx } : {}),
    }
    await client.set(redeemedKey(token), redeemed, {
      ex: REDEEMED_AUDIT_TTL_SECONDS,
    })
  } catch (err) {
    console.warn('[citizen-invite] failed to write redeemed audit record:', err)
  }
  return invite
}

export type DiscountPaymentClaim =
  | 'claimed'
  | 'locked'
  | 'spent'
  | 'refunded'
  | 'mismatch'
  | 'unavailable'

/**
 * Claim a discount payment tx so two requests cannot both mint or both refund
 * it. The record is kept for the audit TTL. A short lock stops a second
 * request while the first is still minting; if that request dies, the lock
 * expires and the same wallet can retry.
 */
export async function claimDiscountPayment(input: {
  txHash: string
  payer: string
  token: string
  valueWei: string
}): Promise<DiscountPaymentClaim> {
  const client = getRedis()
  if (!client || !input.txHash || !input.payer || !input.token) return 'unavailable'

  const key = paymentKey(input.txHash)
  try {
    let existing = await client.get<DiscountPaymentRecord>(key)
    if (!existing) {
      const created: DiscountPaymentRecord = {
        status: 'open',
        payer: input.payer,
        token: input.token,
        valueWei: input.valueWei,
        updatedAt: Date.now(),
      }
      const wrote = await client.set(key, created, { nx: true, ex: PAYMENT_TTL_SECONDS })
      if (wrote !== 'OK') {
        existing = await client.get<DiscountPaymentRecord>(key)
      }
    }

    if (existing) {
      if (existing.status === 'spent') return 'spent'
      if (existing.status === 'refunded') return 'refunded'
      if (
        existing.payer.toLowerCase() !== input.payer.toLowerCase() ||
        existing.token !== input.token
      ) {
        return 'mismatch'
      }
    }

    const locked = await client.set(
      paymentLockKey(input.txHash),
      { payer: input.payer, at: Date.now() },
      { nx: true, ex: PAYMENT_LOCK_TTL_SECONDS }
    )
    if (locked !== 'OK') return 'locked'
    return 'claimed'
  } catch (err) {
    console.error('[citizen-invite] payment claim failed:', err)
    return 'unavailable'
  }
}

export async function setDiscountPaymentStatus(
  txHash: string,
  status: 'refunded' | 'spent'
): Promise<void> {
  const client = getRedis()
  if (!client || !txHash) return
  const key = paymentKey(txHash)
  try {
    const existing = await client.get<DiscountPaymentRecord>(key)
    if (!existing) return
    const next: DiscountPaymentRecord = {
      ...existing,
      status,
      updatedAt: Date.now(),
    }
    await client.set(key, next, { ex: PAYMENT_TTL_SECONDS })
  } catch (err) {
    console.warn('[citizen-invite] failed to update payment status:', err)
    throw err
  }
}

export async function releaseDiscountPaymentLock(txHash: string): Promise<void> {
  const client = getRedis()
  if (!client || !txHash) return
  try {
    await client.del(paymentLockKey(txHash))
  } catch (err) {
    console.warn('[citizen-invite] failed to release payment lock:', err)
  }
}

/**
 * Restore a previously consumed invite. Best-effort compensation used when a
 * mint fails after the token was consumed, so a valid recipient isn't left
 * with a burned link.
 */
export async function restoreInvite(
  token: string,
  meta: CitizenInvite,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  const client = getRedis()
  if (!client || !token) return
  try {
    await client.set(tokenKey(token), meta, { ex: ttlSeconds })
    await client.del(redeemedKey(token))
  } catch (err) {
    console.warn('[citizen-invite] failed to restore invite after error:', err)
  }
}
