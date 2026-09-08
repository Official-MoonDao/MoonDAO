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
  if (n < 0.0001) return fmt(n, 6)
  if (n < 0.01) return fmt(n, 4)
  return fmt(n, 3)
}

/**
 * USD label used next to ETH amounts. Mirrors MissionActivityList so DePrize
 * and the launchpad read as the same denomination.
 */
export function formatUsd(amount: number, opts?: { signed?: boolean }): string {
  if (!Number.isFinite(amount)) return '—'
  const abs = Math.abs(amount)
  let body: string
  if (abs >= 100_000) {
    body = `$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  } else if (abs >= 1) {
    body = `$${abs.toLocaleString('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}`
  } else {
    body = `$${abs.toLocaleString('en-US', {
      maximumFractionDigits: 4,
      minimumFractionDigits: 2,
    })}`
  }
  if (opts?.signed) {
    if (amount > 0) return `+${body}`
    if (amount < 0) return `-${body}`
    return body
  }
  return amount < 0 ? `-${body}` : body
}

export function fmtUsdFromEth(
  eth: number | undefined | null,
  ethPrice: number | null | undefined,
  opts?: { signed?: boolean }
): string | undefined {
  if (eth == null || !Number.isFinite(eth) || ethPrice == null || ethPrice <= 0) {
    return undefined
  }
  return formatUsd(eth * ethPrice, opts)
}

/** Toast / button copy: `0.01 ETH (~$30.00)`. Omits USD when the price is missing. */
export function fmtEthWithUsd(
  eth: number | undefined | null,
  ethPrice: number | null | undefined,
  opts?: {
    decimals?: number
    prize?: boolean
    approx?: boolean
    signed?: boolean
    unit?: string
  }
): string {
  if (eth == null || !Number.isFinite(eth)) return '—'
  const unit = opts?.unit ?? 'ETH'
  const ethStr = opts?.prize ? fmtPrizeEth(Math.abs(eth)) : fmt(Math.abs(eth), opts?.decimals)
  const sign = opts?.signed ? (eth > 0 ? '+' : eth < 0 ? '-' : '') : eth < 0 ? '-' : ''
  const prefix = opts?.approx ? '≈ ' : ''
  const ethLabel = `${prefix}${sign}${ethStr} ${unit}`
  const usd = fmtUsdFromEth(eth, ethPrice, { signed: opts?.signed })
  return usd ? `${ethLabel} (~${usd})` : ethLabel
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
