import type { NextApiRequest } from 'next'
import { getClientIp, getCountryFromHeaders, getRegionFromHeaders } from '@/lib/geo'
import {
  evaluateEligibility,
  isHexAddress,
  isNonProdBypassEnabled,
  type EligibilityDecision,
} from './eligibility'
import { screenWallet } from './sanctions'
import { checkVpnOrProxy, type ConnectionKind } from './vpnCheck'

export type EligibilityRunResult = EligibilityDecision & {
  region: string | null
  connectionKind: ConnectionKind
}

export async function runEligibilityChecks(
  req: NextApiRequest,
  wallet?: string | null
): Promise<EligibilityRunResult> {
  const country = getCountryFromHeaders(req)
  const region = getRegionFromHeaders(req)

  if (isNonProdBypassEnabled()) {
    return {
      allowed: true,
      reason: 'dev-bypass',
      country,
      region,
      connectionKind: 'clear',
    }
  }

  const ip = getClientIp(req)
  const vpn = await checkVpnOrProxy(ip)
  const sanctions =
    wallet && isHexAddress(wallet)
      ? await screenWallet(wallet)
      : { isSanctioned: false, failed: false }

  const decision = evaluateEligibility({
    country,
    region,
    wallet: wallet || null,
    isVpnOrProxy: vpn.isVpnOrProxy,
    isSanctioned: sanctions.isSanctioned,
    screeningFailed: vpn.failed || sanctions.failed,
  })

  return {
    ...decision,
    region,
    connectionKind: vpn.kind,
  }
}
