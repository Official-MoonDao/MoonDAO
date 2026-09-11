import { randomUUID } from 'crypto'
import type { Hex } from 'viem'
import type { DePrizeAttestations } from './attestations'
import { hashCompliancePermit } from './compliancePermit'
import { execCompliancePipeline, getComplianceRedis } from './complianceStore'
import type { EligibilityReason } from './eligibility'
import type { ConnectionKind } from './vpnCheck'

export type PermitIssuanceRecord = {
  recordId: string
  permitHash: Hex
  wallet: string
  deprizeId: number
  chainId: number
  mintAddress: string
  issuedAt: string
  deadline: string
  country: string
  region: string | null
  ipHash: string
  connectionKind: ConnectionKind
  eligibilityReason: EligibilityReason
  termsVersion: string
  attestations: DePrizeAttestations
}

export function permitRecordKey(recordId: string): string {
  return `deprize:permit:record:${recordId}`
}

export function permitHistoryKey(): string {
  return 'deprize:permit:history'
}

export function permitByWalletKey(wallet: string): string {
  return `deprize:permit:by-wallet:${wallet.toLowerCase()}`
}

export function permitByHashKey(permitHash: string): string {
  return `deprize:permit:by-hash:${permitHash.toLowerCase()}`
}

export function buildPermitIssuanceRecord(args: {
  wallet: Hex
  deprizeId: bigint
  deadline: bigint
  chainId: number
  mintAddress: Hex
  issuedAt: string
  country: string
  region: string | null
  ipHash: string
  connectionKind: ConnectionKind
  eligibilityReason: EligibilityReason
  termsVersion: string
  attestations: DePrizeAttestations
}): PermitIssuanceRecord {
  const permitHash = hashCompliancePermit({
    wallet: args.wallet,
    deprizeId: args.deprizeId,
    deadline: args.deadline,
    chainId: args.chainId,
    mintAddress: args.mintAddress,
  })
  return {
    recordId: randomUUID(),
    permitHash,
    wallet: args.wallet,
    deprizeId: Number(args.deprizeId),
    chainId: args.chainId,
    mintAddress: args.mintAddress,
    issuedAt: args.issuedAt,
    deadline: args.deadline.toString(),
    country: args.country,
    region: args.region,
    ipHash: args.ipHash,
    connectionKind: args.connectionKind,
    eligibilityReason: args.eligibilityReason,
    termsVersion: args.termsVersion,
    attestations: args.attestations,
  }
}

export async function recordPermitIssuance(record: PermitIssuanceRecord): Promise<boolean> {
  return execCompliancePipeline((pipeline) => {
    pipeline.set(permitRecordKey(record.recordId), record)
    pipeline.lpush(permitHistoryKey(), record.recordId)
    pipeline.lpush(permitByWalletKey(record.wallet), record.recordId)
    pipeline.lpush(permitByHashKey(record.permitHash), record.recordId)
  })
}

/** Chain timestamps can lag the server clock that stamped `issuedAt`. */
export const PERMIT_MATCH_CLOCK_SKEW_SECONDS = 60

export function permitCoversBet(args: {
  record: Pick<PermitIssuanceRecord, 'wallet' | 'deprizeId' | 'chainId' | 'issuedAt' | 'deadline'>
  wallet: string
  deprizeId: number
  chainId: number
  blockTimestampSec: number
}): boolean {
  if (args.record.wallet.toLowerCase() !== args.wallet.toLowerCase()) return false
  if (args.record.deprizeId !== args.deprizeId) return false
  if (args.record.chainId !== args.chainId) return false
  const issuedAtSec = Math.floor(Date.parse(args.record.issuedAt) / 1000)
  const deadlineSec = Number(args.record.deadline)
  if (!Number.isFinite(issuedAtSec) || !Number.isFinite(deadlineSec)) return false
  return (
    issuedAtSec - PERMIT_MATCH_CLOCK_SKEW_SECONDS <= args.blockTimestampSec &&
    args.blockTimestampSec <= deadlineSec
  )
}

export async function getPermitRecordsForWallet(wallet: string): Promise<{
  records: PermitIssuanceRecord[]
  failed: boolean
}> {
  const cache = getComplianceRedis()
  if (!cache) return { records: [], failed: true }
  try {
    const ids = await cache.lrange<string>(permitByWalletKey(wallet), 0, -1)
    const records: PermitIssuanceRecord[] = []
    for (const id of ids ?? []) {
      if (!id) continue
      const record = await cache.get<PermitIssuanceRecord>(permitRecordKey(id))
      if (record) records.push(record)
    }
    return { records, failed: false }
  } catch (err) {
    console.error('[deprize] permit lookup failed', err)
    return { records: [], failed: true }
  }
}
