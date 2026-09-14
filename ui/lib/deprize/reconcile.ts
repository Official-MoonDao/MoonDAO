import type { NextApiRequest } from 'next'
import { permitCoversBet, type PermitIssuanceRecord } from './permitLog'

export type LmsrTradeClass = 'ignored-mint' | 'ignored-sell' | 'direct-buy-review-required'

export function classifyLmsrTrade(args: {
  transactor: string
  mintAddress: string
  outcomeTokenAmounts: ReadonlyArray<bigint | number | string>
}): LmsrTradeClass {
  if (args.transactor.toLowerCase() === args.mintAddress.toLowerCase()) {
    return 'ignored-mint'
  }
  let anyPositive = false
  for (const raw of args.outcomeTokenAmounts) {
    const amount = typeof raw === 'bigint' ? raw : BigInt(raw)
    if (amount > 0n) anyPositive = true
  }
  return anyPositive ? 'direct-buy-review-required' : 'ignored-sell'
}

export function betHasMatchingPermit(
  permits: Array<
    Pick<PermitIssuanceRecord, 'wallet' | 'deprizeId' | 'chainId' | 'issuedAt' | 'deadline'>
  >,
  bet: {
    wallet: string
    deprizeId: number
    chainId: number
    blockTimestampSec: number
  }
): boolean {
  return permits.some((record) =>
    permitCoversBet({
      record,
      wallet: bet.wallet,
      deprizeId: bet.deprizeId,
      chainId: bet.chainId,
      blockTimestampSec: bet.blockTimestampSec,
    })
  )
}

export function reconcileCursorKey(chainId: number): string {
  return `deprize:reconcile:last-block:${chainId}`
}

export function parseReconcileStartBlock(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) return null
  return value
}

export function resolveReconcileWindow(args: {
  lastProcessedBlock: number | null
  startBlock: number | null
  latestBlock: number
}):
  | { ok: true; empty: true }
  | { ok: true; empty: false; fromBlock: number; toBlock: number }
  | { ok: false; error: string } {
  const fromBlock =
    args.lastProcessedBlock === null ? args.startBlock : args.lastProcessedBlock + 1
  if (fromBlock === null) {
    return { ok: false, error: 'DEPRIZE_RECONCILE_START_BLOCK is required on the first run' }
  }
  if (!Number.isInteger(fromBlock) || fromBlock < 0) {
    return { ok: false, error: 'invalid reconcile start block' }
  }
  if (!Number.isInteger(args.latestBlock) || args.latestBlock < 0) {
    return { ok: false, error: 'latest block is unavailable' }
  }
  if (fromBlock > args.latestBlock) {
    return { ok: true, empty: true }
  }
  return { ok: true, empty: false, fromBlock, toBlock: args.latestBlock }
}

/** On failure the previous cursor is kept so the next run retries the same range. */
export function nextReconcileCursor(args: {
  lastProcessedBlock: number | null
  succeeded: boolean
  processedThrough: number | null
}): number | null {
  if (!args.succeeded) return args.lastProcessedBlock
  return args.processedThrough
}

export function parseStoredCursor(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

export function uniqueConfiguredAddresses(
  addresses: Array<string | null | undefined>
): string[] {
  const out = new Set<string>()
  for (const raw of addresses) {
    if (!raw || !/^0x[a-fA-F0-9]{40}$/.test(raw)) continue
    if (/^0x0{40}$/i.test(raw)) continue
    out.add(raw.toLowerCase())
  }
  return [...out]
}

export function authorizeCronRequest(args: {
  production: boolean
  expectedSecret: string | undefined
  providedSecret: string | undefined
}): { ok: true } | { ok: false; status: 401 | 503; message: string } {
  if (args.production && !args.expectedSecret) {
    return { ok: false, status: 503, message: 'CRON_SECRET is not configured' }
  }
  if (args.expectedSecret && args.providedSecret !== args.expectedSecret) {
    return { ok: false, status: 401, message: 'Unauthorized' }
  }
  return { ok: true }
}

export function cronSecretFromRequest(req: NextApiRequest): string | undefined {
  const first = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value
  const authHeader = first(req.headers.authorization)
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined
  return bearer || first(req.headers['x-cron-secret']) || first(req.query.secret)
}
