/** v1 has exactly one season. A second season is an explicit key addition. */
export const FORECAST_SEASON = '2026'

export const FORECAST_SCHEMA_VERSION = 1

/** Hide the DAO number until at least this many Citizens have called it. */
export const FORECAST_DAO_MIN_PARTICIPANTS = 3
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
