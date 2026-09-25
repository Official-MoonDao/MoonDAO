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

/** Ethereum Sepolia. Bets on this chain skip live screening outside production. */
export const SEPOLIA_CHAIN_ID = 11155111

/**
 * Sepolia is a testnet: skip geo, VPN, and sanctions there. A Vercel preview
 * may inherit production env vars; the bypass still applies only to Sepolia,
 * so an Arbitrum bet on that preview keeps the real checks. A production
 * deployment always screens, including a Sepolia chain id.
 */
export function shouldMockSepoliaEligibility(chainId: number): boolean {
  if (chainId !== SEPOLIA_CHAIN_ID) return false
  if (process.env.VERCEL_ENV === 'preview') return true
  if (process.env.NEXT_PUBLIC_ENV === 'prod') return false
  return true
}

/**
 * Skips geo, VPN and sanctions screening, and tolerates a missing country and
 * an unreachable compliance store. Never on a production deployment, and never
 * for a Vercel preview: those links test Sepolia through
 * `shouldMockSepoliaEligibility`, while Arbitrum on the same preview stays
 * screened. Otherwise on when DEPRIZE_ELIGIBILITY_BYPASS=1, or under
 * `next dev`: localhost sends no geo headers, so without this no bet can be
 * placed locally. Other deployed builds run with NODE_ENV=production.
 */
export function isNonProdBypassEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ENV === 'prod') return false
  if (process.env.VERCEL_ENV === 'preview') return false
  return (
    process.env.DEPRIZE_ELIGIBILITY_BYPASS === '1' || process.env.NODE_ENV === 'development'
  )
}
