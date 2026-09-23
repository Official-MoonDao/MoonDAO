import { fmtOddsPct } from '@/lib/deprize/format'

/** Gap, in percentage points, below which the row stays quiet. */
export const ODDS_GAP_THRESHOLD = 10

export function oddsRowView(input: {
  marketPct: number
  daoPct: number | null
  pooledPct: number | null
}): {
  marketLabel: string
  daoLabel: string
  pooledLabel: string | null
  showBracket: boolean
  bracketLo: number
  bracketHi: number
  bracketWidth: number
  gapCaption: string | null
} {
  const marketLabel = fmtOddsPct(input.marketPct)
  const pooledLabel = input.pooledPct == null ? null : fmtOddsPct(input.pooledPct)
  if (input.daoPct == null) {
    return {
      marketLabel,
      daoLabel: '—',
      pooledLabel,
      showBracket: false,
      bracketLo: 0,
      bracketHi: 0,
      bracketWidth: 0,
      gapCaption: null,
    }
  }

  const bracketLo = Math.min(input.marketPct, input.daoPct)
  const bracketHi = Math.max(input.marketPct, input.daoPct)
  const gap = Math.abs(input.marketPct - input.daoPct)
  const points = Number.isInteger(gap) ? String(gap) : gap.toFixed(1)
  const higher = input.marketPct >= input.daoPct ? 'Market' : 'DAO'
  return {
    marketLabel,
    daoLabel: fmtOddsPct(input.daoPct),
    pooledLabel,
    showBracket: true,
    bracketLo,
    bracketHi,
    bracketWidth: Math.max(1, gap),
    gapCaption: gap < ODDS_GAP_THRESHOLD ? null : `${higher} is ahead by ${points} points`,
  }
}
