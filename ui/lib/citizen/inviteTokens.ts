import { randomBytes } from 'crypto'
import { Redis } from '@upstash/redis'

/**
 * One-time "magic link" invite tokens for sponsored citizen mints.
 *
 * A token grants a single free (relayer-sponsored) citizen mint to whichever
 * wallet redeems it. Tokens live in Upstash Redis (the same store used for the
 * Typeform answer cache and rate limiting) so redemption can be enforced
 * exactly once across serverless invocations.
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
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days
const REDEEMED_AUDIT_TTL_SECONDS = 90 * 24 * 60 * 60 // keep an audit trail 90 days

export type CitizenInvite = {
  /** ms epoch the invite was created. */
  createdAt: number
  /** Optional human label, e.g. "ETHDenver booth" or a recipient name. */
  label?: string
  /** Optional creator note (who minted the link). */
  createdBy?: string
}

export type RedeemedInvite = CitizenInvite & {
  redeemedBy: string
  redeemedAt: number
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
 * Returns the invite record if the token exists and is unredeemed, else null.
 */
export async function peekInvite(token: string): Promise<CitizenInvite | null> {
  const client = getRedis()
  if (!client || !token) return null
  try {
    const invite = await client.get<CitizenInvite>(tokenKey(token))
    return invite ?? null
  } catch (err) {
    console.warn('[citizen-invite] peek failed:', err)
    return null
  }
}

/**
 * Atomically redeem an invite for `address`. Uses GETDEL so the token can only
 * be consumed once even under concurrent requests. Returns true if this call
 * won the redemption, false if the token was missing/expired/already used.
 *
 * The caller MUST have already verified that `address` belongs to the
 * authenticated Privy user before calling this.
 */
export async function consumeInvite(
  token: string,
  address: string
): Promise<boolean> {
  const client = getRedis()
  if (!client || !token || !address) return false
  let invite: CitizenInvite | null = null
  try {
    // GETDEL is atomic: the first caller gets the value, everyone else gets null.
    invite = await client.getdel<CitizenInvite>(tokenKey(token))
  } catch (err) {
    console.error('[citizen-invite] consume failed:', err)
    return false
  }
  if (!invite) return false

  // Best-effort audit record of who redeemed the link (does not gate success).
  try {
    const redeemed: RedeemedInvite = {
      ...invite,
      redeemedBy: address,
      redeemedAt: Date.now(),
    }
    await client.set(redeemedKey(token), redeemed, {
      ex: REDEEMED_AUDIT_TTL_SECONDS,
    })
  } catch (err) {
    console.warn('[citizen-invite] failed to write redeemed audit record:', err)
  }
  return true
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
