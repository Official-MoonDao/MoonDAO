import type { NextApiRequest } from 'next'
import { getClientIp, getCountryFromHeaders, getRegionFromHeaders } from '@/lib/geo'
import { hashIp } from './acceptanceLog'
import {
  evaluateEligibility,
  isHexAddress,
  isNonProdBypassEnabled,
  type EligibilityDecision,
} from './eligibility'
import { screenWallet } from './sanctions'
import { checkVpnOrProxy, type ConnectionKind } from './vpnCheck'
import {
  denyWallet,
  getWalletDenial,
  recordObservation,
  shouldCreatePermanentDenial,
  type EligibilitySurface,
} from './walletObservations'

export type { EligibilitySurface }

export type EligibilityRunResult = EligibilityDecision & {
  region: string | null
  connectionKind: ConnectionKind
}

export async function runEligibilityChecks(
  req: NextApiRequest,
  wallet: string | null | undefined,
  options: { surface: EligibilitySurface }
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
  const validWallet = wallet && isHexAddress(wallet) ? wallet : null
  const [vpn, sanctions, denial] = await Promise.all([
    checkVpnOrProxy(ip),
    validWallet
      ? screenWallet(validWallet)
      : Promise.resolve({ isSanctioned: false, failed: false }),
    validWallet
      ? getWalletDenial(validWallet)
      : Promise.resolve({ denied: false, failed: false }),
  ])

  const decision = evaluateEligibility({
    country,
    region,
    wallet: wallet || null,
    isVpnOrProxy: vpn.isVpnOrProxy,
    isSanctioned: sanctions.isSanctioned,
    screeningFailed: vpn.failed || sanctions.failed || denial.failed,
    isDeniedWallet: denial.denied,
  })

  if (validWallet) {
    const observation = {
      wallet: validWallet,
      country: decision.country,
      region,
      ipHash: hashIp(ip),
      connectionKind: vpn.kind,
      eligibilityReason: decision.reason,
      surface: options.surface,
      observedAt: new Date().toISOString(),
    }
    if (shouldCreatePermanentDenial(decision.reason)) {
      await denyWallet(validWallet, decision.reason, observation)
    }
    await recordObservation(observation)
  }

  return {
    ...decision,
    region,
    connectionKind: vpn.kind,
  }
}
