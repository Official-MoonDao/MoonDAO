export const DEFAULT_DEPRIZE_PRIZE_ID = 22
export const DEFAULT_DEPRIZE_CHAIN = 'sepolia'

export function parsePrizeArg(
  raw: string | undefined
): { ok: true; id: number } | { ok: false } {
  const value = (raw ?? String(DEFAULT_DEPRIZE_PRIZE_ID)).trim()
  if (/^\d+$/.test(value)) return { ok: true, id: Number(value) }
  if (/^touchdown$/i.test(value)) return { ok: true, id: DEFAULT_DEPRIZE_PRIZE_ID }
  return { ok: false }
}
