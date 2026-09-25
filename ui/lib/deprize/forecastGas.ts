import { L2_GAS_BUDGET_WEI } from '@/lib/rpc/gasBudget'

// A Sepolia Tableland write is cheap in gas, but the wallet locks
// gasLimit * maxFeePerGas before it will send. 0.001 ETH covers that lock.
const SEPOLIA_FORECAST_GAS_WEI = 10n ** 15n

export const FORECAST_GAS_SPONSORSHIPS_PER_DAY = 3
export const FORECAST_GAS_SPONSOR_TTL_SECONDS = 24 * 60 * 60

export function forecastGasBudgetWei(chainId: number): bigint {
  if (chainId === 11155111) return SEPOLIA_FORECAST_GAS_WEI
  return L2_GAS_BUDGET_WEI
}

/** Wei the HSM should send. Zero when the wallet can already pay gas. */
export function forecastGasTopUpWei(balanceWei: bigint, budgetWei: bigint): bigint {
  if (budgetWei <= 0n) return 0n
  if (balanceWei >= budgetWei) return 0n
  const shortfall = budgetWei - (balanceWei > 0n ? balanceWei : 0n)
  return shortfall > 0n ? shortfall : 0n
}

export function forecastGasSponsorKey(chainId: number, wallet: string): string {
  return `deprize:forecast-gas:${chainId}:${wallet.toLowerCase()}`
}
