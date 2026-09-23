import type { EligibilityReason } from './eligibility'
import {
  execCompliancePipeline,
  getComplianceRedis,
  scanComplianceKeys,
} from './complianceStore'
import type { ConnectionKind } from './vpnCheck'

export type EligibilitySurface = 'eligibility' | 'accept-terms' | 'permit'

export type WalletObservation = {
  wallet: string
  country: string | null
  region: string | null
  ipHash: string | null
  connectionKind: ConnectionKind
  eligibilityReason: EligibilityReason
  surface: EligibilitySurface
  observedAt: string
}

export type WalletDenial = {
  wallet: string
  reason: 'restricted-jurisdiction' | 'sanctioned-wallet' | 'manual'
  deniedAt: string
  evidence: WalletObservation | null
}

export type DenialAuditEntry = {
  actor: string
  action: 'deny' | 'allow'
  wallet: string
  reason: string
  at: string
}

export function observationHistoryKey(wallet: string): string {
  return `deprize:observation:history:${wallet.toLowerCase()}`
}

export function observationCountriesKey(wallet: string): string {
  return `deprize:observation:countries:${wallet.toLowerCase()}`
}

export function deniedWalletKey(wallet: string): string {
  return `deprize:denied:${wallet.toLowerCase()}`
}

export const DENIED_AUDIT_KEY = 'deprize:denied:audit'

export function shouldCreatePermanentDenial(
  reason: EligibilityReason
): reason is 'restricted-jurisdiction' | 'sanctioned-wallet' {
  return reason === 'restricted-jurisdiction' || reason === 'sanctioned-wallet'
}

export async function recordObservation(value: WalletObservation): Promise<boolean> {
  return execCompliancePipeline((pipeline) => {
    pipeline.lpush(observationHistoryKey(value.wallet), value)
    if (value.country) {
      pipeline.sadd(observationCountriesKey(value.wallet), value.country)
    }
  })
}

export async function getWalletDenial(wallet: string): Promise<{
  denied: boolean
  failed: boolean
}> {
  const cache = getComplianceRedis()
  if (!cache) return { denied: false, failed: true }
  try {
    const record = await cache.get<WalletDenial>(deniedWalletKey(wallet))
    return { denied: Boolean(record), failed: false }
  } catch (err) {
    console.error('[deprize] wallet denial read failed', err)
    return { denied: false, failed: true }
  }
}

export async function denyWallet(
  wallet: string,
  reason: WalletDenial['reason'],
  evidence: WalletObservation | null,
  actor = 'system'
): Promise<{ created: boolean; failed: boolean }> {
  const cache = getComplianceRedis()
  if (!cache) return { created: false, failed: true }
  const denial: WalletDenial = {
    wallet: wallet.toLowerCase(),
    reason,
    deniedAt: new Date().toISOString(),
    evidence,
  }
  try {
    const created = await cache.set(deniedWalletKey(wallet), denial, { nx: true })
    if (!created) return { created: false, failed: false }
    const audit: DenialAuditEntry = {
      actor,
      action: 'deny',
      wallet: wallet.toLowerCase(),
      reason,
      at: denial.deniedAt,
    }
    await cache.lpush(DENIED_AUDIT_KEY, audit)
    return { created: true, failed: false }
  } catch (err) {
    console.error('[deprize] wallet denial write failed', err)
    return { created: false, failed: true }
  }
}

export async function clearWalletDenial(
  wallet: string,
  actor: string,
  reason: string
): Promise<{ cleared: boolean; failed: boolean }> {
  const cache = getComplianceRedis()
  if (!cache) return { cleared: false, failed: true }
  try {
    const removed = await cache.del(deniedWalletKey(wallet))
    const audit: DenialAuditEntry = {
      actor,
      action: 'allow',
      wallet: wallet.toLowerCase(),
      reason,
      at: new Date().toISOString(),
    }
    await cache.lpush(DENIED_AUDIT_KEY, audit)
    return { cleared: Number(removed) > 0, failed: false }
  } catch (err) {
    console.error('[deprize] wallet denial clear failed', err)
    return { cleared: false, failed: true }
  }
}

export async function listDeniedWallets(): Promise<WalletDenial[]> {
  const cache = getComplianceRedis()
  if (!cache) return []
  const keys = (await scanComplianceKeys('deprize:denied:*')).filter(
    (key) => key !== DENIED_AUDIT_KEY
  )
  const out: WalletDenial[] = []
  for (const key of keys) {
    const record = await cache.get<WalletDenial>(key)
    if (record) out.push(record)
  }
  return out
}
