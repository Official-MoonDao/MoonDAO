import { isProtocolPayer, normalizeProtocolAddress } from './payerClassification'

export type PayEventLike = {
  id?: string
  from?: string | null
  beneficiary?: string | null
  amount?: string | number | null
  timestamp?: number | null
}

export type PatronRow = {
  payer: string
  totalWei: bigint
  count: number
  firstTs: number
  lastTs: number
}

export type PatronExclusionReason =
  | 'protocolPayer'
  | 'mismatchedBeneficiary'
  | 'zeroAmount'
  | 'malformed'

function parseAmount(value: string | number | null | undefined): bigint | null {
  if (value == null || value === '') return null
  try {
    const asBig = typeof value === 'number' ? BigInt(Math.trunc(value)) : BigInt(value)
    return asBig
  } catch {
    return null
  }
}

export function classifyPayEvent(
  ev: PayEventLike,
  chainSlug: string
): { kind: 'patron' } | { kind: 'other' } | { kind: 'excluded'; reason: PatronExclusionReason } {
  const from = normalizeProtocolAddress(ev.from)
  const beneficiary = normalizeProtocolAddress(ev.beneficiary)
  const amount = parseAmount(ev.amount)
  if (!from || !beneficiary || amount == null) return { kind: 'excluded', reason: 'malformed' }
  if (amount <= 0n) return { kind: 'excluded', reason: 'zeroAmount' }
  if (isProtocolPayer(from, chainSlug)) return { kind: 'excluded', reason: 'protocolPayer' }
  if (from !== beneficiary) return { kind: 'other' }
  return { kind: 'patron' }
}

export function isDirectPatronPay(ev: PayEventLike, chainSlug: string): boolean {
  return classifyPayEvent(ev, chainSlug).kind === 'patron'
}

export function aggregatePatrons(
  events: readonly PayEventLike[],
  chainSlug: string
): {
  patrons: PatronRow[]
  totalDirectWei: bigint
  patronCount: number
  otherRoutes: { count: number; totalWei: bigint }
  excluded: {
    protocolPayer: number
    mismatchedBeneficiary: number
    zeroAmount: number
    malformed: number
  }
} {
  const byPayer = new Map<string, PatronRow>()
  let totalDirectWei = 0n
  const otherRoutes = { count: 0, totalWei: 0n }
  const excluded = {
    protocolPayer: 0,
    mismatchedBeneficiary: 0,
    zeroAmount: 0,
    malformed: 0,
  }

  for (const ev of events) {
    const classified = classifyPayEvent(ev, chainSlug)
    const amount = parseAmount(ev.amount) ?? 0n
    const ts = typeof ev.timestamp === 'number' && Number.isFinite(ev.timestamp) ? ev.timestamp : 0
    if (classified.kind === 'excluded') {
      excluded[classified.reason] += 1
      continue
    }
    if (classified.kind === 'other') {
      otherRoutes.count += 1
      otherRoutes.totalWei += amount
      excluded.mismatchedBeneficiary += 1
      continue
    }
    const payer = normalizeProtocolAddress(ev.from) as string
    const existing = byPayer.get(payer)
    if (!existing) {
      byPayer.set(payer, {
        payer,
        totalWei: amount,
        count: 1,
        firstTs: ts,
        lastTs: ts,
      })
    } else {
      existing.totalWei += amount
      existing.count += 1
      existing.firstTs = Math.min(existing.firstTs, ts)
      existing.lastTs = Math.max(existing.lastTs, ts)
    }
    totalDirectWei += amount
  }

  const patrons = [...byPayer.values()].sort((a, b) => {
    if (a.totalWei === b.totalWei) return a.firstTs - b.firstTs
    return a.totalWei > b.totalWei ? -1 : 1
  })

  return {
    patrons,
    totalDirectWei,
    patronCount: patrons.length,
    otherRoutes,
    excluded,
  }
}

export function applyPatronSuppression(
  result: ReturnType<typeof aggregatePatrons>,
  suppressed: ReadonlySet<string>
): ReturnType<typeof aggregatePatrons> {
  if (suppressed.size === 0) return result
  const kept: PatronRow[] = []
  let removedCount = 0
  let removedWei = 0n
  for (const row of result.patrons) {
    if (suppressed.has(row.payer)) {
      removedCount += 1
      removedWei += row.totalWei
    } else {
      kept.push(row)
    }
  }
  return {
    ...result,
    patrons: kept,
    patronCount: kept.length,
    totalDirectWei: result.totalDirectWei - removedWei,
    otherRoutes: {
      count: result.otherRoutes.count + removedCount,
      totalWei: result.otherRoutes.totalWei + removedWei,
    },
  }
}
