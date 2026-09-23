/**
 * Native ETH we budget for a typical Arbitrum / Base contract call.
 *
 * Wallets and nodes lock `gasLimit * maxFeePerGas` *before* the tx lands, and
 * refund the unused reserve. A real L2 call often costs ~0.00001–0.00003 ETH,
 * but conservative limits (and a 2.4× EIP-1559 cap) have required ~0.00012 ETH
 * up front. 0.00025 ETH covers that lock with room for a busy-network spike.
 */
export const L2_GAS_BUDGET_WEI = 25n * 10n ** 13n // 0.00025 ETH

export const L2_GAS_BUDGET_ETH = Number(L2_GAS_BUDGET_WEI) / 1e18
