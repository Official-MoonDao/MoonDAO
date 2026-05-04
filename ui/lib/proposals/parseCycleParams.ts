/**
 * Shared `?quarter=&year=` validator for the retro/member-vote API
 * endpoints. Intentionally distinguishes "missing → fall back to the
 * caller's default" from "present but invalid → return a 400" so:
 *   - bare `/api/proposals/retro-results` (the panel's hot path) keeps
 *     hitting the same edge-cache key,
 *   - typos like `?quarter=foo` or `?year=2019` surface immediately
 *     instead of silently returning `outcome: null`.
 *
 * Mirrors the same `1 <= quarter <= 4` / `year >= 2020` ranges
 * `computeRetroactiveOutcome` already enforces internally — keeping
 * them in sync here means the caller gets a clean error message
 * rather than an opaque `null` payload that's expensive to debug.
 */
import type { NextApiRequest } from 'next'

const MIN_YEAR = 2020

export type CycleParams = { quarter: number; year: number }

export type CycleParamsResult =
  | { ok: true; params: CycleParams }
  | { ok: false; error: string }

/**
 * Coerce a raw query value (`string | string[] | undefined`) to its
 * first string entry. Multiple `?quarter=1&quarter=2` rarely happens
 * in practice but is well-defined behavior in Next.js — fall back to
 * the first occurrence so a stray duplicate param doesn't 400.
 */
function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export function parseCycleParams(
  req: NextApiRequest,
  fallback: CycleParams
): CycleParamsResult {
  const rawQuarter = firstParam(req.query.quarter)
  const rawYear = firstParam(req.query.year)

  let quarter = fallback.quarter
  if (rawQuarter !== undefined && rawQuarter !== '') {
    const parsed = Number(rawQuarter)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) {
      return {
        ok: false,
        error: `quarter must be an integer 1-4 (got "${rawQuarter}")`,
      }
    }
    quarter = parsed
  }

  let year = fallback.year
  if (rawYear !== undefined && rawYear !== '') {
    const parsed = Number(rawYear)
    if (!Number.isInteger(parsed) || parsed < MIN_YEAR) {
      return {
        ok: false,
        error: `year must be an integer >= ${MIN_YEAR} (got "${rawYear}")`,
      }
    }
    year = parsed
  }

  return { ok: true, params: { quarter, year } }
}
