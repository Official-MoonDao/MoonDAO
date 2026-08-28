/**
 * Two separate notions of "network" (same split as MissionFundingChainBanner):
 * - **App selected chain** (`ChainContextV5.selectedChain`): the header network
 *   dropdown. DePrize resolves its contracts and builds transactions from this.
 * - **Wallet chain** (`wallet.chainId`): where the signer actually broadcasts.
 *
 * When these disagree, the bet is built against one chain and broadcast on the
 * other, so the nonce is read from a chain the receiving RPC knows nothing
 * about. The RPC rejects it as `nonce too high` (e.g. `nonce=154 maxNonce=69`),
 * which reads as a wallet bug rather than a network mismatch.
 */

/** Privy reports CAIP-2 (`eip155:42161`). Returns null when not yet connected. */
export function parseWalletChainId(raw?: string | null): number | null {
  if (!raw) return null
  const id = Number(String(raw).split(':').pop())
  return Number.isFinite(id) && id > 0 ? id : null
}

export function isWrongNetwork(
  walletChainId?: number | null,
  targetChainId?: number | null
): boolean {
  // An unknown wallet chain means Privy has not finished connecting. Blocking
  // there would strand a correctly-configured user behind a switch button.
  if (walletChainId == null || targetChainId == null) return false
  return walletChainId !== targetChainId
}
