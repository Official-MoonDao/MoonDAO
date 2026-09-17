/** v1 has exactly one season. A second season is an explicit key addition. */
export const FORECAST_SEASON = '2026'

export const FORECAST_SCHEMA_VERSION = 1

export const FORECAST_COOLDOWN_MS = 30_000
export const FORECAST_MAX_ENTRIES_PER_UTC_DAY = 20
export const FORECAST_CROWD_MIN = 5
export const FORECAST_WEIGHT_MAX = 1e6
export const FORECAST_WEIGHT_MIN_LEN = 2
export const FORECAST_WEIGHT_MAX_LEN = 12

export function forecastEnv(): string {
  return process.env.NEXT_PUBLIC_ENV || 'dev'
}

export function forecastChainId(chainSlug: string): number | undefined {
  if (chainSlug === 'sepolia') return 11155111
  if (chainSlug === 'arbitrum') return 42161
  if (chainSlug === 'arbitrum-sepolia') return 421614
  return undefined
}
