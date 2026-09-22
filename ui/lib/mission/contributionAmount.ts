/** Suggested starting USD amount for the Overview Flight contribute form.
 *  Matches the $100 Overview Crew support tier. Other missions stay blank. */
export const OVERVIEW_DEFAULT_CONTRIBUTION_USD = '100'

const OVERVIEW_MISSION_ID = 4

export function defaultContributionUsd(missionId: unknown): string {
  const id = Number(missionId)
  if (id === OVERVIEW_MISSION_ID) return OVERVIEW_DEFAULT_CONTRIBUTION_USD
  return ''
}

export function parseContributionUsd(usdInput: string | undefined | null): number {
  if (usdInput == null) return NaN
  const cleaned = String(usdInput).replace(/,/g, '').trim()
  if (!cleaned) return NaN
  return parseFloat(cleaned)
}

export function hasPositiveContributionUsd(usdInput: string | undefined | null): boolean {
  const amount = parseContributionUsd(usdInput)
  return Number.isFinite(amount) && amount > 0
}

/** Label for the button that opens the contribute modal.
 *  Price loading must not block this — the modal quotes ETH itself. */
export function contributeOpenButtonLabel(usdInput: string | undefined | null): string {
  if (!hasPositiveContributionUsd(usdInput)) return 'Enter an amount'
  return 'Contribute'
}

export const CONTRIBUTE_SIGN_IN_LABEL = 'Sign in to contribute'

/** Shown under the contribute button so guests know card and ETH both need a wallet. */
export const CONTRIBUTE_PAYMENT_HINT = 'Sign in to pay with card, Apple Pay, or ETH'
