import { isRestrictedJurisdiction, normalizeCountry } from './restrictedJurisdictions'

export type EligibilityReason =
  | 'ok'
  | 'dev-bypass'
  | 'invalid-wallet'
  | 'country-unknown'
  | 'restricted-jurisdiction'
  | 'vpn-or-proxy'
  | 'sanctioned-wallet'
  | 'screening-unavailable'
  | 'terms-not-accepted'
  | 'permit-unavailable'
  | 'wallet-denied'
  | 'insider-wallet'
  | 'over-cap'

export type EligibilityInput = {
  country: string | null
  region?: string | null
  wallet?: string | null
  isVpnOrProxy: boolean
  isSanctioned: boolean
  screeningFailed: boolean
  isDeniedWallet?: boolean
  isInsiderWallet?: boolean
}

export type EligibilityDecision = {
  allowed: boolean
  reason: EligibilityReason
  country: string | null
}

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/

export function isHexAddress(value: string | null | undefined): value is string {
  return Boolean(value && WALLET_RE.test(value))
}

export function evaluateEligibility(input: EligibilityInput): EligibilityDecision {
  const country = normalizeCountry(input.country)

  if (input.wallet && !isHexAddress(input.wallet)) {
    return { allowed: false, reason: 'invalid-wallet', country }
  }
  if (input.isInsiderWallet) {
    return { allowed: false, reason: 'insider-wallet', country }
  }
  if (input.isDeniedWallet) {
    return { allowed: false, reason: 'wallet-denied', country }
  }
  if (input.screeningFailed) {
    return { allowed: false, reason: 'screening-unavailable', country }
  }
  if (!country) {
    return { allowed: false, reason: 'country-unknown', country: null }
  }
  if (isRestrictedJurisdiction(country, input.region)) {
    return { allowed: false, reason: 'restricted-jurisdiction', country }
  }
  if (input.isVpnOrProxy) {
    return { allowed: false, reason: 'vpn-or-proxy', country }
  }
  if (input.isSanctioned) {
    return { allowed: false, reason: 'sanctioned-wallet', country }
  }
  return { allowed: true, reason: 'ok', country }
}

export function eligibilityMessage(reason: EligibilityReason): string {
  switch (reason) {
    case 'ok':
    case 'dev-bypass':
      return 'Eligible to bet.'
    case 'invalid-wallet':
      return 'Connect a valid wallet to bet.'
    case 'country-unknown':
      return 'We could not confirm your location, so betting is unavailable.'
    case 'restricted-jurisdiction':
      return 'DePrize is not available in your location.'
    case 'vpn-or-proxy':
      return 'Turn off any VPN, proxy, or Tor connection and try again.'
    case 'wallet-denied':
      return 'This wallet is not eligible to place new bets.'
    case 'insider-wallet':
      return 'This wallet is associated with prize administration and cannot place bets.'
    case 'over-cap':
      return 'This bet is above the generation-1 per-bet limit.'
    case 'sanctioned-wallet':
      return 'This wallet cannot participate.'
    case 'screening-unavailable':
      return 'Eligibility checks are temporarily unavailable. Try again shortly.'
    case 'terms-not-accepted':
      return 'Accept the DePrize Terms to continue.'
    case 'permit-unavailable':
      return 'Could not authorize this bet. Try again shortly.'
  }
}

export function isNonProdBypassEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENV !== 'prod' && process.env.DEPRIZE_ELIGIBILITY_BYPASS === '1'
}
