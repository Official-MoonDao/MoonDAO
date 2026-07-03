import { CITIZENSHIP_GIFT_TAG, EB_TEAM_ID } from 'const/config'

/**
 * Pure validation logic for the "gift a citizenship" marketplace flow.
 *
 * The purchase API issues a one-time, fully-sponsored citizen invite link when
 * a buyer pays for a gift listing on the EB team. Because the invite is minted
 * server-side purely on the strength of an on-chain payment, the accept/reject
 * decision is security-critical: it must bind the payment to *this specific
 * listing* so a buyer can't pay for some other (e.g. cheaper or pricier)
 * EB-team ETH listing and redeem it as a citizenship gift.
 *
 * This module is intentionally free of any I/O (no chain / Tableland / Redis)
 * so the decision can be unit-tested exhaustively. The API handler is
 * responsible for fetching the listing row, the on-chain paid value, and the
 * team token id, then delegating the decision here.
 */

export type GiftListingRow = {
  id?: number | string
  teamId?: number | string
  tag?: string
  currency?: string
  price?: string | number
}

export type GiftValidationParams = {
  /** Token id of the team that received the payment (tx `to` → team NFT). */
  teamTokenId: string | undefined
  /** Listing id claimed by the buyer. */
  listingId: unknown
  /** The listing row fetched from the marketplace table (if any). */
  listing: GiftListingRow | undefined
  /** ETH value (wei) actually transferred by the purchase transaction. */
  paidValueWei: bigint
}

export type GiftValidationResult =
  | { ok: true; expectedWei: bigint; minWei: bigint; maxWei: bigint }
  | { ok: false; status: number; message: string }

// Tolerance band around the listing price. The buy modal sends exactly the
// listing price, so the band only needs to absorb float/rounding noise — it is
// deliberately tight so a payment for a differently-priced listing is rejected.
// Built via BigInt() rather than `n` literals so the module also type-checks
// under the repo's es2016 ts-node test target (it still runs on Node 18+).
const MIN_BPS = BigInt(99)
const MAX_BPS = BigInt(101)
const BPS_DENOMINATOR = BigInt(100)

/**
 * Convert a human price string/number (e.g. "0.0111" or "1,000") to wei.
 * Returns null for non-positive or non-finite prices.
 */
export function priceToWei(price: string | number | undefined): bigint | null {
  const priceNum = parseFloat(String(price ?? '').replace(/,/g, ''))
  if (!Number.isFinite(priceNum) || priceNum <= 0) return null
  return BigInt(Math.floor(priceNum * 1e18))
}

/**
 * Decide whether a gift-citizenship purchase is valid. Returns either an `ok`
 * result with the computed price band, or a `{ status, message }` describing
 * exactly why it was rejected (mirrors the HTTP responses the API sends).
 */
export function validateGiftPurchase(
  params: GiftValidationParams
): GiftValidationResult {
  const { teamTokenId, listingId, listing, paidValueWei } = params

  if (String(teamTokenId) !== EB_TEAM_ID) {
    return {
      ok: false,
      status: 400,
      message: 'Gift purchases are only available on the EB team',
    }
  }

  const numericListingId = Number(listingId)
  if (!Number.isInteger(numericListingId) || numericListingId < 0) {
    return { ok: false, status: 400, message: 'Invalid listing' }
  }

  if (!listing || listing.tag !== CITIZENSHIP_GIFT_TAG) {
    return {
      ok: false,
      status: 400,
      message: 'Listing is not a gift citizenship listing',
    }
  }

  // Defense in depth: the queried row must be the listing the buyer claimed.
  if (listing.id !== undefined && Number(listing.id) !== numericListingId) {
    return { ok: false, status: 400, message: 'Invalid listing' }
  }

  if (listing.currency !== 'ETH') {
    return {
      ok: false,
      status: 400,
      message: 'Gift purchases must be paid in ETH',
    }
  }

  const expectedWei = priceToWei(listing.price)
  if (expectedWei === null) {
    return { ok: false, status: 400, message: 'Listing has an invalid price' }
  }

  const minWei = (expectedWei * MIN_BPS) / BPS_DENOMINATOR
  const maxWei = (expectedWei * MAX_BPS) / BPS_DENOMINATOR
  if (paidValueWei < minWei || paidValueWei > maxWei) {
    return {
      ok: false,
      status: 400,
      message: 'Payment does not match the listing price',
    }
  }

  return { ok: true, expectedWei, minWei, maxWei }
}
