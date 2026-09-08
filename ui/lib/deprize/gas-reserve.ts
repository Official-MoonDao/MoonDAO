import { L2_GAS_BUDGET_WEI } from '@/lib/rpc/gasBudget'

/**
 * Native ETH held back from the "spendable" figure so placing a bet can never
 * consume the gas needed to send it.
 *
 * This has to be chain-aware. A bet is ~1.3M gas; on Arbitrum at ~0.02 gwei
 * that is ~0.000026 ETH. Subtracting an L1-sized 0.001 ETH reserve from a real
 * L2 balance reports it as "0 ETH available" and blocks bets that would have
 * succeeded comfortably.
 */

/** Conservative default for L1-style gas markets. */
export const DEFAULT_GAS_RESERVE_WEI = 10n ** 15n // 0.001 ETH

/** Shared L2 budget — covers the observed ~0.00012 ETH wallet lock. */
export const L2_GAS_RESERVE_WEI = L2_GAS_BUDGET_WEI

const GAS_RESERVE_WEI_BY_CHAIN: Record<number, bigint> = {
  42161: L2_GAS_RESERVE_WEI, // Arbitrum One
  421614: L2_GAS_RESERVE_WEI, // Arbitrum Sepolia
}

export function gasReserveWei(chainId?: number | null): bigint {
  if (chainId == null) return DEFAULT_GAS_RESERVE_WEI
  return GAS_RESERVE_WEI_BY_CHAIN[chainId] ?? DEFAULT_GAS_RESERVE_WEI
}

export function gasReserveEth(chainId?: number | null): number {
  return Number(gasReserveWei(chainId)) / 1e18
}

/** Balance minus the chain's gas reserve, floored at zero. */
export function spendableFromBalanceEth(
  balanceEth: number | undefined | null,
  chainId?: number | null
): number {
  return Math.max(0, (balanceEth ?? 0) - gasReserveEth(chainId))
}
