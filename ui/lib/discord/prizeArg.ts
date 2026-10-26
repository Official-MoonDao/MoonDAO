import { findDePrizeIdForGoal } from '@/lib/deprize/competitions'

export const DEFAULT_DEPRIZE_CHAIN = 'arbitrum'

/** Touchdown's goal. Ids are per chain and change on redeploy, so resolve through it. */
export const DEFAULT_DEPRIZE_GOAL = 'shared-next-landing'

export function defaultDePrizeId(chainSlug: string = DEFAULT_DEPRIZE_CHAIN): number | undefined {
  return findDePrizeIdForGoal(chainSlug, DEFAULT_DEPRIZE_GOAL)
}

export function parsePrizeArg(
  raw: string | undefined,
  chainSlug: string = DEFAULT_DEPRIZE_CHAIN
): { ok: true; id: number } | { ok: false } {
  const fallback = defaultDePrizeId(chainSlug)
  const value = (raw ?? (fallback != null ? String(fallback) : '')).trim()
  if (/^\d+$/.test(value)) return { ok: true, id: Number(value) }
  if (/^touchdown$/i.test(value) && fallback != null) return { ok: true, id: fallback }
  return { ok: false }
}
