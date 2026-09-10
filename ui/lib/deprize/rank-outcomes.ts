// Pure display ordering for DePrize outcomes. Dependency-free so the mocha
// unit runner can cover it without React.

export type RankableOutcome = { index: number; probability: number }

/**
 * Order outcomes for display: highest implied chance first. Ties (and NaN)
 * keep registry order. Outcomes flagged by `isField` (Open Field) are always
 * pinned to the end regardless of chance. When `winningIndex` is provided
 * (market resolved), that outcome is moved to the very top.
 *
 * Never sort `market.outcomes` in place — indices must stay contract-aligned.
 */
export function rankOutcomes<T extends RankableOutcome>(
  outcomes: T[],
  opts: { isField: (index: number) => boolean; winningIndex?: number },
): T[] {
  const score = (o: T) => (Number.isFinite(o.probability) ? o.probability : -1)
  return [...outcomes].sort((a, b) => {
    if (opts.winningIndex !== undefined) {
      if (a.index === opts.winningIndex) return -1
      if (b.index === opts.winningIndex) return 1
    }
    const af = opts.isField(a.index)
    const bf = opts.isField(b.index)
    if (af !== bf) return af ? 1 : -1
    const d = score(b) - score(a)
    return d !== 0 ? d : a.index - b.index
  })
}
