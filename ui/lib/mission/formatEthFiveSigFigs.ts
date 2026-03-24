/** ETH amounts in the mission contribute UI: 5 significant figures, grouped; avoids layout ellipsis. */
export function formatEthFiveSigFigs(eth: number): string {
  if (!Number.isFinite(eth) || eth < 0) return '0'
  if (eth === 0) return '0'
  const s = eth.toPrecision(5)
  if (/[eE]/.test(s)) {
    return s
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 18,
    useGrouping: true,
  })
}
