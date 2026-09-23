/**
 * Pure helpers for partial-discount citizen invites.
 *
 * A 1000 bps invite is the existing fully sponsored magic link. 200 and 500
 * mean the recipient pays 80% or 50% of getRenewalPrice and the relayer covers
 * the rest. The rate uses the same parts-per-thousand units as MoonDAOCitizen.
 */

export const DISCOUNT_PRESETS = [200, 500, 1000] as const

export type DiscountBps = (typeof DISCOUNT_PRESETS)[number]

export const FULL_DISCOUNT_BPS: DiscountBps = 1000

const BPS_DENOMINATOR = 1000

export function isDiscountBps(value: number): value is DiscountBps {
  return value === 200 || value === 500 || value === 1000
}

/**
 * Read a stored invite rate. Missing values are legacy fully sponsored links.
 * Any other number is corrupt and must not be treated as a discount.
 */
export function resolveDiscountBps(value: unknown): DiscountBps | null {
  if (value === undefined || value === null || value === '') return FULL_DISCOUNT_BPS
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(numeric) || !isDiscountBps(numeric)) return null
  return numeric
}

/** Parse an issuer-supplied rate. Empty means "use the default" when allowed. */
export function parseDiscountBps(
  value: unknown,
  options?: { defaultFull?: boolean }
): DiscountBps | null {
  if (value === undefined || value === null || value === '') {
    return options?.defaultFull ? FULL_DISCOUNT_BPS : null
  }
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(numeric) || !isDiscountBps(numeric)) return null
  return numeric
}

export function isFullDiscount(discountBps: DiscountBps): boolean {
  return discountBps === FULL_DISCOUNT_BPS
}

/** Map 20 / 50 / 100 percent-off to parts per thousand. */
export function percentOffToBps(percentOff: number): DiscountBps | null {
  if (percentOff === 20) return 200
  if (percentOff === 50) return 500
  if (percentOff === 100) return 1000
  return null
}

export function percentOffFromBps(discountBps: number): number {
  return discountBps / 10
}

export function discountOfferLabel(discountBps: number): string {
  if (discountBps === 1000) return '100% off (free)'
  if (discountBps === 500) return '50% off'
  if (discountBps === 200) return '20% off'
  return `${percentOffFromBps(discountBps)}% off`
}

/**
 * Recipient's share of `fullPriceWei`. Truncates the remainder the same way
 * Solidity does (`price * (1000 - discount) / 1000`), so the quote can be at
 * most 999 wei under the exact fraction.
 */
export function dueWei(fullPriceWei: bigint, discountBps: number): bigint {
  if (discountBps <= 0) return fullPriceWei
  if (discountBps >= BPS_DENOMINATOR) return BigInt(0)
  return (fullPriceWei * BigInt(BPS_DENOMINATOR - discountBps)) / BigInt(BPS_DENOMINATOR)
}

export type InviteQuote =
  | { sponsored: true; discountBps: DiscountBps }
  | {
      sponsored: false
      discountBps: DiscountBps
      fullPriceWei: string
      dueWei: string
      payTo: string
    }

/**
 * A partial invite still mints free when the wallet already qualifies through
 * contributions or an allowlist. Otherwise the recipient pays `dueWei` to `payTo`.
 */
export function buildInviteQuote(params: {
  discountBps: DiscountBps
  alreadyFreeEligible: boolean
  fullPriceWei: bigint
  payTo: string
}): InviteQuote {
  if (params.alreadyFreeEligible || isFullDiscount(params.discountBps)) {
    return { sponsored: true, discountBps: params.discountBps }
  }
  return {
    sponsored: false,
    discountBps: params.discountBps,
    fullPriceWei: params.fullPriceWei.toString(),
    dueWei: dueWei(params.fullPriceWei, params.discountBps).toString(),
    payTo: params.payTo,
  }
}

/**
 * Fully sponsored redemptions are added to the on-chain discount list so
 * renewals stay free. Partial discounts must not, or a 20% link would zero
 * every future renewal (the list's only rate is 100% off).
 */
export function shouldAddInviteToDiscountList(options: {
  partialDiscount: boolean
  consumedInvite: boolean
}): boolean {
  return options.consumedInvite && !options.partialDiscount
}

export function isPaymentTxHash(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value)
}

export type DiscountPaymentCode =
  | 'not_found'
  | 'failed'
  | 'wrong_sender'
  | 'wrong_recipient'
  | 'underpaid'
  | 'invalid'

export type DiscountPaymentResult =
  | { ok: true; paidWei: bigint }
  | { ok: false; code: DiscountPaymentCode; message: string; paidWei?: bigint }

function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * A usable discount payment is a successful transfer from the mint wallet to
 * the sponsor wallet for at least the quoted amount. The transaction is loaded
 * from the citizenship chain, so a hash that does not exist there is simply
 * not found.
 */
export function validateDiscountPayment(params: {
  from?: string | null
  to?: string | null
  valueWei?: bigint | null
  status?: number | null
  payer: string
  payTo: string
  dueWei: bigint
}): DiscountPaymentResult {
  if (!params.from || !params.to || params.valueWei == null || params.valueWei < BigInt(0)) {
    return { ok: false, code: 'invalid', message: 'Payment transaction is invalid.' }
  }
  if (params.status == null) {
    return {
      ok: false,
      code: 'failed',
      message: 'Payment is not confirmed yet. Wait for it to confirm and try again.',
    }
  }
  if (Number(params.status) !== 1) {
    return { ok: false, code: 'failed', message: 'Payment transaction failed.' }
  }
  if (!sameAddress(params.from, params.payer)) {
    return {
      ok: false,
      code: 'wrong_sender',
      message: 'Payment must come from the wallet that will receive the citizenship.',
    }
  }
  if (!sameAddress(params.to, params.payTo)) {
    return {
      ok: false,
      code: 'wrong_recipient',
      message: 'Payment was sent to the wrong address.',
    }
  }
  if (params.valueWei < params.dueWei) {
    return {
      ok: false,
      code: 'underpaid',
      message: 'Payment is less than the current discounted price.',
      paidWei: params.valueWei,
    }
  }
  return { ok: true, paidWei: params.valueWei }
}
