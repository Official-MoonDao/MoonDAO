import { forecastGasBudgetWei, forecastGasTopUpWei } from '@/lib/deprize/forecastGas'

// A submit is one Tableland insert, the same size of call as a forecast, plus
// up to ~9 KB of calldata. On Arbitrum that is still well inside the L2 budget.
export const contributionGasBudgetWei = forecastGasBudgetWei
export const contributionGasTopUpWei = forecastGasTopUpWei

// The contract caps a citizen at a few submissions per cycle. Five top-ups a
// day covers a submit plus retries without letting one wallet drain the HSM.
export const CONTRIBUTION_GAS_SPONSORSHIPS_PER_DAY = 5
export const CONTRIBUTION_GAS_SPONSOR_TTL_SECONDS = 24 * 60 * 60

export function contributionGasSponsorKey(chainId: number, wallet: string): string {
  return `contributions:gas:${chainId}:${wallet.toLowerCase()}`
}
