const AMOUNT_RE = /^\d+(\.\d+)?$/
const MAX_AMOUNT_LENGTH = 24
const MAX_DECIMALS = 18

export type ParsedOnrampReturn =
  | { active: false }
  | { active: true; outcomeIndex: number; amountEth?: string }

export type MockOnrampScenario = 'instant' | 'short' | 'none' | 'stale' | 'closed'

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export function isSafeAmountString(value: string): boolean {
  if (!AMOUNT_RE.test(value)) return false
  if (value.length > MAX_AMOUNT_LENGTH) return false
  const dot = value.indexOf('.')
  if (dot >= 0 && value.length - dot - 1 > MAX_DECIMALS) return false
  return true
}

export function clampAmountEth(amountEth: string, capEth: string): string {
  const amount = Number(amountEth)
  const cap = Number(capEth)
  if (!Number.isFinite(amount) || amount < 0) return '0'
  if (!Number.isFinite(cap) || cap <= 0) return '0'
  if (amount > cap) return capEth
  return amountEth
}

export function buildOnrampReturnUrl(opts: {
  origin: string
  deprizeId: number
  outcomeIndex: number
  amountEth?: string
  capEth: string
}): string {
  const url = new URL(`/deprize/${opts.deprizeId}`, opts.origin)
  url.searchParams.set('onrampSuccess', 'true')
  url.searchParams.set('outcome', String(opts.outcomeIndex))
  if (opts.amountEth && isSafeAmountString(opts.amountEth)) {
    url.searchParams.set('amount', clampAmountEth(opts.amountEth, opts.capEth))
  }
  return url.toString()
}

export function parseOnrampReturn(
  query: Record<string, string | string[] | undefined>
): ParsedOnrampReturn {
  if (first(query.onrampSuccess) !== 'true') return { active: false }
  const outcomeRaw = first(query.outcome)
  if (!outcomeRaw || !/^\d+$/.test(outcomeRaw)) return { active: false }
  const outcomeIndex = Number(outcomeRaw)
  if (!Number.isInteger(outcomeIndex) || outcomeIndex < 0) return { active: false }

  const amountRaw = first(query.amount)
  if (amountRaw == null || amountRaw === '') {
    return { active: true, outcomeIndex }
  }
  if (!isSafeAmountString(amountRaw)) return { active: false }
  return { active: true, outcomeIndex, amountEth: amountRaw }
}

export function parseMockOnrampScenario(
  query: Record<string, string | string[] | undefined>
): MockOnrampScenario | null {
  const raw = first(query.mockOnramp)
  if (
    raw === 'instant' ||
    raw === 'short' ||
    raw === 'none' ||
    raw === 'stale' ||
    raw === 'closed'
  ) {
    return raw
  }
  return null
}

export function mockOnrampEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MOCK_ONRAMP === 'true'
}

export function jwtSnapshotId(token: string): string {
  return token.slice(-16)
}

export function snapshotStorageKey(jwtId: string): string {
  return `onrampReturn:deprize:${jwtId}`
}

export type OnrampSnapshot = {
  spendableEthAtReturn: number
  consumed: boolean
}

export function readOnrampSnapshot(jwtId: string): OnrampSnapshot | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(snapshotStorageKey(jwtId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.spendableEthAtReturn !== 'number') return null
    return {
      spendableEthAtReturn: parsed.spendableEthAtReturn,
      consumed: parsed.consumed === true,
    }
  } catch {
    return null
  }
}

export function writeOnrampSnapshot(jwtId: string, snapshot: OnrampSnapshot): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(snapshotStorageKey(jwtId), JSON.stringify(snapshot))
}

export function markOnrampSnapshotConsumed(jwtId: string): void {
  const existing = readOnrampSnapshot(jwtId)
  writeOnrampSnapshot(jwtId, {
    spendableEthAtReturn: existing?.spendableEthAtReturn ?? 0,
    consumed: true,
  })
}
