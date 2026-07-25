import crypto from 'crypto'
import { ARBITRUM_CAIP2 } from './swapTokens'

// SERVER-ONLY. This module talks to the Privy REST API using the app secret.
// It must never be imported into client bundles. All exported functions assume
// they run inside an API route.

const PRIVY_API_BASE = 'https://api.privy.io'
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID as string
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET as string
// Optional. Required only when the app's embedded wallets have explicit owners
// or signers (Privy then mandates a request authorization signature). Stored as
// the raw "wallet-auth:<base64-pkcs8>" string from the Privy dashboard.
const PRIVY_AUTHORIZATION_KEY = process.env.PRIVY_AUTHORIZATION_KEY

const REQUEST_TIMEOUT_MS = 12000

export type WalletActionStatus =
  | 'created'
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'rejected'

export const TERMINAL_STATUSES: WalletActionStatus[] = ['succeeded', 'failed', 'rejected']

export interface SwapAsset {
  caip2: string
  // 'native' or a 0x ERC-20 address
  asset_address: string
}

export interface SwapQuoteResult {
  estOutputAmount: string | null
  minimumOutputAmount: string | null
  gasEstimate: string | null
  inputAmount: string | null
  inputToken: string | null
  outputToken: string | null
  caip2: string | null
  expiresAt: number | null
  // Pass-through of any sponsorship/fee metadata Privy returns, untrusted shape.
  raw: Record<string, any>
}

export interface SwapExecuteResult {
  actionId: string
  status: WalletActionStatus
  walletId: string
  inputToken: string | null
  outputToken: string | null
  caip2: string | null
}

export interface WalletActionResult {
  actionId: string
  status: WalletActionStatus
  walletId: string | null
  type: string | null
  failureReason: string | null
  raw: Record<string, any>
}

/**
 * A swap error that carries a user-safe message and an HTTP-ish status the API
 * route can forward. `userMessage` is always safe to show in the browser.
 */
export class PrivySwapError extends Error {
  status: number
  userMessage: string
  constructor(userMessage: string, status = 400) {
    super(userMessage)
    this.name = 'PrivySwapError'
    this.status = status
    this.userMessage = userMessage
  }
}

function assertServerConfig() {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    // Never echo the values — just fail closed with a generic message.
    throw new PrivySwapError('Swaps are temporarily unavailable. Please try again later.', 503)
  }
}

// ---------------------------------------------------------------------------
// Authorization signature (RFC 8785 canonicalize + ECDSA P-256, DER, base64)
// ---------------------------------------------------------------------------

// Minimal RFC 8785 (JCS) canonicalizer for the plain JSON payloads Privy signs.
// Handles objects (sorted keys), arrays, strings, finite numbers, booleans and
// null — which is all the authorization payload ever contains.
function canonicalize(value: any): string {
  if (value === null) return 'null'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Cannot canonicalize non-finite number')
    return JSON.stringify(value)
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalize(v)).join(',')}]`
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort()
    const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`)
    return `{${entries.join(',')}}`
  }
  throw new Error(`Cannot canonicalize value of type ${typeof value}`)
}

/**
 * Build the `privy-authorization-signature` header for a POST request, if an
 * authorization key is configured. Returns undefined when no key is set so the
 * caller can attempt the request without it (Privy only requires it for wallets
 * with explicit owners/signers). Never throws on a missing key.
 */
function buildAuthorizationSignature(
  url: string,
  body: Record<string, any>,
  extraHeaders: Record<string, string> = {}
): string | undefined {
  if (!PRIVY_AUTHORIZATION_KEY) return undefined
  try {
    const headers: Record<string, string> = { 'privy-app-id': PRIVY_APP_ID, ...extraHeaders }
    const payload = { version: 1, method: 'POST', url, body, headers }
    const serialized = canonicalize(payload)

    const keyString = PRIVY_AUTHORIZATION_KEY.replace('wallet-auth:', '')
    const pem = `-----BEGIN PRIVATE KEY-----\n${keyString}\n-----END PRIVATE KEY-----`
    const privateKey = crypto.createPrivateKey({ key: pem, format: 'pem' })
    // crypto.sign with a P-256 key produces a DER-encoded ECDSA signature.
    const signature = crypto.sign('sha256', Buffer.from(serialized), privateKey)
    return signature.toString('base64')
  } catch (err) {
    // Signing is best-effort; log the failure without leaking the key material.
    console.error('[privy/swaps] failed to build authorization signature')
    return undefined
  }
}

function basicAuthHeader(): string {
  return `Basic ${Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64')}`
}

function baseHeaders(): Record<string, string> {
  return {
    Authorization: basicAuthHeader(),
    'privy-app-id': PRIVY_APP_ID,
    'Content-Type': 'application/json',
  }
}

async function privyFetch(
  path: string,
  init: { method: 'GET' | 'POST'; headers?: Record<string, string>; body?: string }
): Promise<{ ok: boolean; status: number; data: any }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${PRIVY_API_BASE}${path}`, {
      method: init.method,
      headers: init.headers,
      body: init.body,
      signal: controller.signal,
    })
    let data: any = null
    try {
      data = await res.json()
    } catch {
      data = null
    }
    return { ok: res.ok, status: res.status, data }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new PrivySwapError('Privy did not respond in time. Please try again.', 504)
    }
    throw new PrivySwapError('Could not reach the swap service. Please try again.', 502)
  } finally {
    clearTimeout(timeout)
  }
}

// Translate a Privy error response into a user-safe message. We intentionally
// avoid forwarding raw Privy text in most cases, but surface a few well-known
// conditions (gas sponsorship, slippage, liquidity, insufficient balance).
function toUserSafeError(status: number, data: any): PrivySwapError {
  const rawMessage: string =
    (typeof data?.error === 'string' && data.error) ||
    (typeof data?.message === 'string' && data.message) ||
    ''
  const lower = rawMessage.toLowerCase()

  if (
    lower.includes('sponsor') ||
    lower.includes('gas credit') ||
    lower.includes('credit limit') ||
    lower.includes('paymaster')
  ) {
    return new PrivySwapError(
      'Gas sponsorship is temporarily unavailable. Please try again later or fund your wallet with a little ETH for gas.',
      503
    )
  }
  if (lower.includes('insufficient') && lower.includes('balance')) {
    return new PrivySwapError('Insufficient balance for this swap.', 400)
  }
  if (lower.includes('slippage')) {
    return new PrivySwapError('Price moved beyond your slippage tolerance. Try again or raise slippage slightly.', 400)
  }
  if (lower.includes('liquidity') || lower.includes('no route') || lower.includes('route not found')) {
    return new PrivySwapError('No swap route is available for this token pair right now.', 400)
  }
  if (status === 401 || status === 403) {
    // Most likely the wallet needs an authorization signature this app can't
    // currently produce, or the app secret is wrong. Keep it generic.
    return new PrivySwapError('This wallet is not authorized for swaps. Please contact support.', 403)
  }
  if (status === 404) {
    return new PrivySwapError('Swap could not be found.', 404)
  }
  if (status === 429) {
    return new PrivySwapError('Too many requests. Please wait a moment and try again.', 429)
  }
  if (status >= 500) {
    return new PrivySwapError('The swap service is having trouble. Please try again later.', 502)
  }
  return new PrivySwapError('We could not get a swap quote for this pair. Please try a different amount or pair.', 400)
}

function coerceStatus(value: unknown): WalletActionStatus {
  if (
    value === 'created' ||
    value === 'pending' ||
    value === 'succeeded' ||
    value === 'failed' ||
    value === 'rejected'
  ) {
    return value
  }
  // Unknown/missing status → treat as still pending so the client keeps polling
  // rather than wrongly reporting success/failure.
  return 'pending'
}

// ---------------------------------------------------------------------------
// Wallet ID resolution
// ---------------------------------------------------------------------------

/**
 * Pull a Privy wallet ID for `address` out of a raw user object's linked
 * accounts. NOTE: Privy only populates `id` on embedded-wallet linked accounts
 * when the wallet is delegated, so this can legitimately return null even for a
 * wallet the user owns. Callers should fall back to getWalletIdByAddress.
 */
export function extractWalletIdFromUser(rawUser: any, address: string): string | null {
  const lower = address.toLowerCase()
  const accounts: any[] = Array.isArray(rawUser?.linked_accounts) ? rawUser.linked_accounts : []
  for (const account of accounts) {
    if (
      account?.type === 'wallet' &&
      typeof account?.address === 'string' &&
      account.address.toLowerCase() === lower &&
      typeof account?.id === 'string' &&
      account.id.length > 0
    ) {
      return account.id
    }
  }
  return null
}

/** Look up a wallet ID by address via the Privy wallets API. */
export async function getWalletIdByAddress(address: string): Promise<string | null> {
  assertServerConfig()
  const { ok, data } = await privyFetch('/v1/wallets/address', {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ address }),
  })
  if (!ok) return null
  return typeof data?.id === 'string' && data.id.length > 0 ? data.id : null
}

/**
 * Resolve the Privy wallet ID for an address that has already been confirmed to
 * belong to the authenticated user. Tries the user object first, then the
 * address lookup. Throws a clear PrivySwapError if neither yields an ID.
 */
export async function resolveWalletId(rawUser: any, address: string): Promise<string> {
  const fromUser = extractWalletIdFromUser(rawUser, address)
  if (fromUser) return fromUser

  const fromLookup = await getWalletIdByAddress(address)
  if (fromLookup) return fromLookup

  throw new PrivySwapError(
    'We could not find a Privy-managed wallet for this address. Swaps are only available for embedded Privy wallets.',
    400
  )
}

// ---------------------------------------------------------------------------
// Quote / Execute / Status
// ---------------------------------------------------------------------------

export async function getSwapQuote(params: {
  walletId: string
  source: SwapAsset
  destination: SwapAsset
  baseAmount: string
}): Promise<SwapQuoteResult> {
  assertServerConfig()
  const { walletId, source, destination, baseAmount } = params

  const body = {
    source,
    destination,
    base_amount: baseAmount,
    amount_type: 'exact_input' as const,
  }

  const { ok, status, data } = await privyFetch(
    `/v1/wallets/${encodeURIComponent(walletId)}/swap/quote`,
    { method: 'POST', headers: baseHeaders(), body: JSON.stringify(body) }
  )

  if (!ok) {
    // Log status only — never the request headers or body (which carry secrets).
    console.error(`[privy/swaps] quote failed with status ${status}`)
    throw toUserSafeError(status, data)
  }

  return {
    estOutputAmount: data?.est_output_amount ?? null,
    minimumOutputAmount: data?.minimum_output_amount ?? null,
    gasEstimate: data?.gas_estimate ?? null,
    inputAmount: data?.input_amount ?? baseAmount,
    inputToken: data?.input_token ?? source.asset_address,
    outputToken: data?.output_token ?? destination.asset_address,
    caip2: data?.caip2 ?? source.caip2,
    expiresAt: typeof data?.expires_at === 'number' ? data.expires_at : null,
    raw: data && typeof data === 'object' ? data : {},
  }
}

export async function executeSwap(params: {
  walletId: string
  source: SwapAsset
  destination: SwapAsset
  baseAmount: string
  slippageBps: number
  idempotencyKey: string
}): Promise<SwapExecuteResult> {
  assertServerConfig()
  const { walletId, source, destination, baseAmount, slippageBps, idempotencyKey } = params

  const body = {
    source,
    destination,
    base_amount: baseAmount,
    amount_type: 'exact_input' as const,
    slippage_bps: slippageBps,
  }

  const url = `/v1/wallets/${encodeURIComponent(walletId)}/swap`
  const headers = baseHeaders()
  headers['privy-idempotency-key'] = idempotencyKey

  // The idempotency key participates in the authorization signature payload.
  const signature = buildAuthorizationSignature(`${PRIVY_API_BASE}${url}`, body, {
    'privy-app-id': PRIVY_APP_ID,
    'privy-idempotency-key': idempotencyKey,
  })
  if (signature) headers['privy-authorization-signature'] = signature

  const { ok, status, data } = await privyFetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!ok) {
    console.error(`[privy/swaps] execute failed with status ${status}`)
    throw toUserSafeError(status, data)
  }

  if (!data?.id) {
    throw new PrivySwapError('Swap was submitted but no action ID was returned. Check your balances in a moment.', 502)
  }

  return {
    actionId: data.id,
    status: coerceStatus(data.status),
    walletId: data.wallet_id ?? walletId,
    inputToken: data?.input_token ?? source.asset_address,
    outputToken: data?.output_token ?? destination.asset_address,
    caip2: data?.caip2 ?? source.caip2,
  }
}

export async function getWalletActionStatus(params: {
  walletId: string
  actionId: string
}): Promise<WalletActionResult> {
  assertServerConfig()
  const { walletId, actionId } = params

  const { ok, status, data } = await privyFetch(
    `/v1/wallets/${encodeURIComponent(walletId)}/actions/${encodeURIComponent(actionId)}?include=steps`,
    { method: 'GET', headers: baseHeaders() }
  )

  if (!ok) {
    console.error(`[privy/swaps] action status failed with status ${status}`)
    throw toUserSafeError(status, data)
  }

  // Try to surface a readable failure reason from the steps, if present.
  let failureReason: string | null = null
  const steps: any[] = Array.isArray(data?.steps) ? data.steps : []
  for (const step of steps) {
    if (step?.status === 'failed' && typeof step?.error === 'string') {
      failureReason = step.error
      break
    }
    if (typeof step?.failure_reason === 'string') {
      failureReason = step.failure_reason
      break
    }
  }
  if (!failureReason && typeof data?.error === 'string') failureReason = data.error

  return {
    actionId: data?.id ?? actionId,
    status: coerceStatus(data?.status),
    walletId: data?.wallet_id ?? walletId,
    type: typeof data?.type === 'string' ? data.type : null,
    failureReason,
    raw: data && typeof data === 'object' ? data : {},
  }
}

/** Convenience: build an Arbitrum swap asset from an allowlisted asset address. */
export function arbitrumAsset(assetAddress: string): SwapAsset {
  return { caip2: ARBITRUM_CAIP2, asset_address: assetAddress }
}
