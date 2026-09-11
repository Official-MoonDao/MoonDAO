import type { NextApiRequest } from 'next'
import { getClientIp, getCountryFromHeaders, getStateFromHeaders } from '@/lib/geo'
import {
  evaluateEligibility,
  isHexAddress,
  isNonProdBypassEnabled,
  type EligibilityDecision,
} from './eligibility'
import { screenWallet } from './sanctions'
import { checkVpnOrProxy } from './vpnCheck'

function regionFromHeaders(req: NextApiRequest): string | null {
  const h = req.headers
  const vercel = (h['x-vercel-ip-country-region'] as string | undefined)?.trim()
  if (vercel) return vercel
  const cf = (h['cf-region-code'] as string | undefined)?.trim()
  if (cf) return cf
  return getStateFromHeaders(req)
}

export async function runEligibilityChecks(
  req: NextApiRequest,
  wallet?: string | null
): Promise<EligibilityDecision> {
  if (isNonProdBypassEnabled()) {
    return {
      allowed: true,
      reason: 'dev-bypass',
      country: getCountryFromHeaders(req),
    }
  }

  const country = getCountryFromHeaders(req)
  const region = regionFromHeaders(req)
  const ip = getClientIp(req)
  const vpn = await checkVpnOrProxy(ip)
  const sanctions =
    wallet && isHexAddress(wallet)
      ? await screenWallet(wallet)
      : { isSanctioned: false, failed: false }

  return evaluateEligibility({
    country,
    region,
    wallet: wallet || null,
    isVpnOrProxy: vpn.isVpnOrProxy,
    isSanctioned: sanctions.isSanctioned,
    screeningFailed: vpn.failed || sanctions.failed,
  })
}
