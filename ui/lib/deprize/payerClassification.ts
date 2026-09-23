import {
  DEPRIZE_FEE_ROUTER_ADDRESSES,
  DEPRIZE_MINT_ADDRESSES,
} from 'const/config'

/** Lowercase 0x-prefixed 20-byte address, or null if the input is not an address. */
export function normalizeProtocolAddress(
  address: string | null | undefined
): string | null {
  if (!address) return null
  const trimmed = address.trim()
  if (!trimmed) return null
  const withPrefix = /^0x/i.test(trimmed) ? trimmed : `0x${trimmed}`
  if (!/^0x[0-9a-fA-F]{40}$/i.test(withPrefix)) return null
  return withPrefix.toLowerCase()
}

/**
 * True when `address` is DePrizeMint or DePrizeFeeRouter on `chainSlug`.
 * Checksum, case, and missing 0x are ignored. Empty config slots never match.
 */
export function isProtocolPayer(
  address: string | null | undefined,
  chainSlug: string
): boolean {
  const normalized = normalizeProtocolAddress(address)
  if (!normalized) return false
  const mint = normalizeProtocolAddress(DEPRIZE_MINT_ADDRESSES[chainSlug])
  const feeRouter = normalizeProtocolAddress(DEPRIZE_FEE_ROUTER_ADDRESSES[chainSlug])
  return normalized === mint || normalized === feeRouter
}
