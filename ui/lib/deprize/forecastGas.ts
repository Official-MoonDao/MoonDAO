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

/**
 * Guest accounts are free to create, so per-wallet limits do not bound them.
 * Each guest top-up also counts against its IP and a daily ETH cap per chain.
 */
export const FORECAST_GUEST_TOPUPS_PER_IP_PER_DAY = 10
const FORECAST_GUEST_DAILY_TOPUPS = 100n

/** Default: 100 full top-ups a day (0.025 ETH on Arbitrum). `FORECAST_GUEST_DAILY_CAP_WEI` overrides. */
export function forecastGuestDailyCapWei(chainId: number, override?: string): bigint {
  if (override && /^\d+$/.test(override.trim())) return BigInt(override.trim())
  return forecastGasBudgetWei(chainId) * FORECAST_GUEST_DAILY_TOPUPS
}

/** UTC day, so the cap resets at one moment for every server instance. */
export function forecastGuestDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export function forecastGuestIpKey(chainId: number, ip: string, day: string): string {
  return `deprize:forecast-gas:guest-ip:${chainId}:${day}:${ip}`
}

export function forecastGuestSpendKey(chainId: number, day: string): string {
  return `deprize:forecast-gas:guest-wei:${chainId}:${day}`
}

export type GuestGasCheck = 'ok' | 'ip-capped' | 'budget-capped'

export function guestGasCheck(input: {
  ipCount: number
  spentWei: bigint
  capWei: bigint
}): GuestGasCheck {
  if (input.ipCount > FORECAST_GUEST_TOPUPS_PER_IP_PER_DAY) return 'ip-capped'
  if (input.spentWei > input.capWei) return 'budget-capped'
  return 'ok'
}
