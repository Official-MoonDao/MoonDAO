/**
 * Post-sell `sweepFees` is only valid when the v1 fee router owns the market.
 * v2 markets are owned by the executive-branch Safe. Calling the v1 router
 * with a v2 id reverts after a wallet prompt.
 */
export function shouldSweepSellFee(
  marketOwner: string | undefined,
  feeRouter: string | undefined
): boolean {
  if (!marketOwner || !feeRouter) return false
  return marketOwner.toLowerCase() === feeRouter.toLowerCase()
}
