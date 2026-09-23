/**
 * Collapse per-token Safe and LP holdings into the few asset classes a
 * CFO actually asks about: ETH, BTC, stables, then everything else.
 */
export interface RawHolding {
  symbol: string
  amount: number
  usd: number
}

export interface AssetClass {
  label: string
  /** Token units when the class is a single asset (ETH, BTC, POL). */
  amount: number | null
  unit: string | null
  usd: number
}

const STABLES = new Set([
  'USDC',
  'USDT',
  'DAI',
  'BUSD',
  'FRAX',
  'LUSD',
  'USDE',
  'USDS',
  'PYUSD',
  'USDC.E',
  'USDT.E',
  'DAI.E',
  'SDAI',
  'USDTB',
])

const CLASS_ORDER = ['ETH', 'BTC', 'Stablecoins', 'POL']

function classify(symbol: string): { label: string; unit: string | null } {
  const s = (symbol || '').trim().toUpperCase()
  if (s === 'ETH' || s === 'WETH' || s === 'AETH') return { label: 'ETH', unit: 'ETH' }
  if (s === 'BTC' || s === 'WBTC' || s === 'CBBTC') return { label: 'BTC', unit: 'BTC' }
  if (s === 'MATIC' || s === 'POL' || s === 'WPOL') return { label: 'POL', unit: 'POL' }
  if (STABLES.has(s)) return { label: 'Stablecoins', unit: null }
  return { label: symbol || 'Other', unit: symbol || null }
}

export function aggregateHoldings(items: RawHolding[], dustUSD = 1): AssetClass[] {
  const map = new Map<string, { usd: number; amount: number; unit: string | null }>()

  for (const item of items) {
    if (!(item.usd > 0) && !(item.amount > 0)) continue
    const { label, unit } = classify(item.symbol)
    const prev = map.get(label) || { usd: 0, amount: 0, unit }
    prev.usd += item.usd
    prev.amount += item.amount
    if (!prev.unit) prev.unit = unit
    map.set(label, prev)
  }

  const rows: AssetClass[] = []
  for (const [label, v] of map) {
    if (v.usd < dustUSD) continue
    rows.push({
      label,
      amount: v.unit && label !== 'Stablecoins' ? v.amount : null,
      unit: label === 'Stablecoins' ? null : v.unit,
      usd: v.usd,
    })
  }

  rows.sort((a, b) => {
    const ai = CLASS_ORDER.indexOf(a.label)
    const bi = CLASS_ORDER.indexOf(b.label)
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    }
    return b.usd - a.usd
  })

  return rows
}
