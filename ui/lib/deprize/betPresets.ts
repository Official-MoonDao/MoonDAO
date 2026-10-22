const PRESET_USD = [10, 100, 1000]
const PRESET_SIG_FIGS = 2

/** Round to a fixed number of significant figures. 0.037202 → 0.037. */
function roundSigFigs(value: number, sigFigs: number): number {
  if (!(value > 0) || !Number.isFinite(value)) return value
  const exponent = Math.floor(Math.log10(value))
  const factor = 10 ** (sigFigs - 1 - exponent)
  return Math.round(value * factor) / factor
}

/**
 * ETH chip amounts near $10, $100, and $1000 at the live price, shown to two
 * significant figures. Amounts above the generation-1 cap clamp to that cap,
 * and a clamp that lands on an earlier chip is dropped so the row never
 * repeats a value.
 */
export function betPresetEthAmounts(ethPrice: number | null | undefined, maxEth = 1): number[] {
  if (ethPrice == null || !(ethPrice > 0) || !(maxEth > 0)) return []
  const seen = new Set<string>()
  const out: number[] = []
  for (const usd of PRESET_USD) {
    let eth = roundSigFigs(usd / ethPrice, PRESET_SIG_FIGS)
    if (eth > maxEth) eth = maxEth
    if (!(eth > 0)) continue
    const key = formatBetPresetEth(eth)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(Number(key))
  }
  return out
}

/** Same decimal string for the chip label and the bet input. Two significant figures. */
export function formatBetPresetEth(eth: number): string {
  if (!(eth > 0) || !Number.isFinite(eth)) return '0'
  const rounded = roundSigFigs(eth, PRESET_SIG_FIGS)
  const decimals = Math.max(0, PRESET_SIG_FIGS - 1 - Math.floor(Math.log10(rounded)))
  return rounded
    .toFixed(decimals)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*?)0+$/, '$1')
}
