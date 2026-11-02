/** Public subscription price math. No RPC and no thirdweb client. */

export const SECONDS_PER_YEAR = 365 * 24 * 60 * 60

/** Last-known public citizen year, including the MOONEY quarter (0.027 * 4/3). */
export const FALLBACK_CITIZEN_YEAR_ETH = 0.036
/** Last-known public team year. */
export const FALLBACK_TEAM_YEAR_ETH = 0.36
/** Spot used only when a live ETH/USD quote is unavailable. */
export const FALLBACK_ETH_USD = 3_500

export const FALLBACK_CITIZEN_YEAR_USD = Math.round(FALLBACK_CITIZEN_YEAR_ETH * FALLBACK_ETH_USD)
export const FALLBACK_TEAM_YEAR_USD = Math.round(FALLBACK_TEAM_YEAR_ETH * FALLBACK_ETH_USD)

/** Wallet total is 4/3 of the treasury share, so one quarter buys MOONEY. */
export function withMooneyQuarter(treasuryWei: bigint): bigint {
  if (treasuryWei <= BigInt(0)) return BigInt(0)
  return (treasuryWei * BigInt(4)) / BigInt(3)
}

export function publicYearWei(input: {
  kind: 'citizen' | 'team'
  pricePerSecond: bigint
  teamDiscount?: bigint
  citizenCheckoutLive: boolean
}): bigint {
  if (input.pricePerSecond <= BigInt(0)) return BigInt(0)
  let year = input.pricePerSecond * BigInt(SECONDS_PER_YEAR)
  if (input.kind === 'team') {
    const discount = input.teamDiscount ?? BigInt(0)
    year = (year * (BigInt(1000) - discount)) / BigInt(1000)
  } else if (input.citizenCheckoutLive) {
    year = withMooneyQuarter(year)
  }
  return year > BigInt(0) ? year : BigInt(0)
}

/**
 * USD for a public year. Prefers the on-chain ETH amount and a live spot,
 * then the last-known ETH amount with that spot, then the frozen USD fallback.
 */
export function yearlyUsd(input: {
  yearEth?: number | null
  ethUsd?: number | null
  fallbackEth: number
  fallbackUsd: number
}): number {
  const yearEth =
    typeof input.yearEth === 'number' && Number.isFinite(input.yearEth) && input.yearEth > 0
      ? input.yearEth
      : input.fallbackEth
  const ethUsd =
    typeof input.ethUsd === 'number' && Number.isFinite(input.ethUsd) && input.ethUsd > 0
      ? input.ethUsd
      : FALLBACK_ETH_USD
  if (yearEth > 0 && ethUsd > 0) {
    const usd = Math.round(yearEth * ethUsd)
    if (usd > 0) return usd
  }
  return input.fallbackUsd
}

/** Live client quote, then the server-rendered quote, then the frozen fallback. Zero is never a price. */
export function displayedYearUsd(
  live: number | null | undefined,
  server: number | null | undefined,
  fallback: number
): number {
  for (const candidate of [live, server, fallback]) {
    if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate <= 0) continue
    const rounded = Math.round(candidate)
    if (rounded > 0) return rounded
  }
  return fallback
}

export function formatYearlyUsd(usd: number, fallback = FALLBACK_CITIZEN_YEAR_USD): string {
  const rounded = Math.round(usd)
  const safe = Number.isFinite(rounded) && rounded > 0 ? rounded : fallback
  return `~$${safe.toLocaleString('en-US')} / Year`
}
