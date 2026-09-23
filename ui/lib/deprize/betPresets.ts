const PRESET_USD = [10, 100, 1000]

/**
 * ETH chip amounts near $10, $100, and $1000 at the live price.
 * Amounts above the generation-1 cap clamp to that cap, and a clamp that
 * lands on an earlier chip is dropped so the row never repeats a value.
 */
export function betPresetEthAmounts(ethPrice: number | null | undefined, maxEth = 1): number[] {
  if (ethPrice == null || !(ethPrice > 0) || !(maxEth > 0)) return []
  const seen = new Set<string>()
  const out: number[] = []
  for (const usd of PRESET_USD) {
    let eth = Math.round((usd / ethPrice) * 1e6) / 1e6
    if (eth > maxEth) eth = Math.floor(maxEth * 1e6) / 1e6
    if (!(eth > 0)) continue
    const key = eth.toFixed(6)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(Number(key))
  }
  return out
}

/** Same decimal string for the chip label and the bet input. */
export function formatBetPresetEth(eth: number): string {
  return eth
    .toFixed(6)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*?)0+$/, '$1')
}
