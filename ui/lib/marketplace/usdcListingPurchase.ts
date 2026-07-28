/**
 * Pure helpers for the marketplace USDC onramp flow in BuyTeamListingModal.
 * Extracted so the purchase-gating rules (markup, unresolved-balance handling,
 * deficit computation) are unit-testable without React.
 */

export const NON_CITIZEN_MARKUP = 1.1

/** Numeric listing price, tolerant of thousands separators ("1,000"). */
export function parseListingPrice(price: string | number): number {
  return parseFloat(String(price).replace(/,/g, ''))
}

/**
 * Final amount the buyer pays. Gifted citizenship and citizen buyers pay the
 * flat listing price; non-citizens pay a 10% markup.
 */
export function computePurchasePrice(params: {
  price: string | number
  isGift: boolean
  isCitizen: boolean
}): number {
  const numericPrice = parseListingPrice(params.price)
  if (params.isGift || params.isCitizen) return numericPrice
  return numericPrice * NON_CITIZEN_MARKUP
}

/** Parse a wallet balance display value; null when unresolved/invalid. */
export function parseUsdcBalance(
  displayValue: string | undefined | null
): number | null {
  if (!displayValue) return null
  const n = Number(displayValue)
  return Number.isFinite(n) ? n : null
}

export type UsdcPurchaseGate = {
  /** True when the Buy button may be shown. */
  hasEnoughUsdc: boolean
  /** USDC still needed to cover the purchase (0 when sufficient). */
  usdcDeficit: number
}

/**
 * Decide whether the buyer can purchase a USDC-priced listing or must onramp
 * first. An unresolved balance (null) is treated as insufficient so we show
 * the onramp instead of a Buy button that would fail — mirrors the mission
 * fund-UI pattern. Non-USDC listings always pass.
 */
export function evaluateUsdcPurchase(params: {
  isUsdcListing: boolean
  usdcBalance: number | null
  purchasePrice: number
}): UsdcPurchaseGate {
  if (!params.isUsdcListing) {
    return { hasEnoughUsdc: true, usdcDeficit: 0 }
  }
  if (params.usdcBalance == null) {
    return { hasEnoughUsdc: false, usdcDeficit: params.purchasePrice }
  }
  return {
    hasEnoughUsdc: params.usdcBalance >= params.purchasePrice,
    usdcDeficit: Math.max(0, params.purchasePrice - params.usdcBalance),
  }
}
