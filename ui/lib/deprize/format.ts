import { COLLATERAL_DECIMALS } from 'const/config'
import { UNIT } from './constants'

// Compact number formatter used across the DePrize UI.
export const fmt = (n: number, d = 4) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: d })
    : '—'

/** Prize-pool amounts are often ≪ 0.01 ETH on testnets — avoid rounding to "0.00". */
export const fmtPrizeEth = (n: number) => {
  if (!Number.isFinite(n)) return '—'
  if (n === 0) return '0'
  if (n < 0.01) return fmt(n, 4)
  return fmt(n, 3)
}

// Parse a decimal ETH string into wei, tolerant of empty/invalid input.
export const toWei = (v: string): bigint => {
  if (!v || Number(v) <= 0) return 0n
  const [whole, frac = ''] = v.split('.')
  const fracPadded = (frac + '0'.repeat(COLLATERAL_DECIMALS)).slice(
    0,
    COLLATERAL_DECIMALS
  )
  try {
    return BigInt(whole || '0') * UNIT + BigInt(fracPadded || '0')
  } catch {
    return 0n
  }
}

// wei -> float ETH (display only; never used for on-chain amounts).
export const toEth = (wei: bigint | undefined): number | undefined =>
  wei === undefined ? undefined : Number(wei) / Number(UNIT)

/** `$FRANKT` when known; otherwise a generic label (never hardcode OVERVIEW). */
export function formatPrizeTokenLabel(symbol: string | undefined): string {
  const s = symbol?.trim()
  if (!s) return 'prize-pool tokens'
  return s.startsWith('$') ? s : `$${s}`
}
