import { createHash } from 'crypto'
import type { DePrizeAttestations } from './attestations'
import { execCompliancePipeline } from './complianceStore'

export type AcceptanceSurface = 'accept-terms' | 'permit'

export type AcceptanceRecord = {
  wallet: string
  termsVersion: string
  timestamp: string
  country: string | null
  region: string | null
  userAgent: string
  ipHash: string | null
  attestations: DePrizeAttestations
  surface: AcceptanceSurface
}

export function hashIp(ip: string | null): string | null {
  if (!ip) return null
  return createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

export function acceptanceLatestKey(wallet: string, termsVersion: string): string {
  return `deprize:accept:latest:${wallet.toLowerCase()}:${termsVersion}`
}

export function acceptanceHistoryKey(wallet: string): string {
  return `deprize:accept:history:${wallet.toLowerCase()}`
}

export async function recordTermsAcceptance(record: AcceptanceRecord): Promise<boolean> {
  return execCompliancePipeline((pipeline) => {
    pipeline.set(acceptanceLatestKey(record.wallet, record.termsVersion), record)
    pipeline.lpush(acceptanceHistoryKey(record.wallet), record)
  })
}
