// ---------------------------------------------------------------------------
// EXECUTIVE FINANCE — approved cost stack used for burn / runway reporting.
// ---------------------------------------------------------------------------
// Assets and revenue are read live on-chain (`lib/treasury/*`). Cost has no
// on-chain source: it comes from governance-approved budgets. This file is the
// one place those approved numbers live so the executive dashboard, and any
// future report, can't disagree about what the DAO has committed to spend.
//
// Two programs, matching the compiled burn report in
// `docs/FINANCIAL_DISCLOSURE_AND_BURN_REPORT_2026-08-14.md`:
//   1. Management & general — Executive Branch (MDP-249).
//   2. Program services — the quarterly projects system, derived from
//      `PROJECT_CYCLE.budgetUSD` so it follows the config forward instead of
//      being restated by hand every quarter.
//
// Rolling the EB envelope forward (new EB proposal passes):
//   1. Update `EB_BUDGET_SOURCE` (MDP number, term, IPFS hash).
//   2. Replace `EB_CORE_LINES` with the new proposal's monthly lines.
//   3. Set `EB_BONUS_POOL_MONTHLY_USD` to the new at-risk pool, or 0.
import { PROJECT_CYCLE } from './config'

export interface CostLine {
  label: string
  monthlyUSD: number
  // Why this number is what it is — a rate, a taper, a rounding.
  note?: string
}

// Provenance for every EB figure below, so the dashboard can cite its source.
export const EB_BUDGET_SOURCE = {
  mdp: 249,
  title: 'Executive Branch Q2–Q3 2026',
  termMonths: 5,
  projectId: 131,
  ipfsHash: 'QmRdCFFnXTYbYU4CvE8KjUBBE4ShdQAbsXVFm7QhrWnUoa',
} as const

// MDP-249 monthly lines. Miguel is full-time for 3 months and half-time for 2,
// so his line is the 5-month average ($5.5k × 3 + $2.75k × 2) / 5.
export const EB_CORE_LINES: CostLine[] = [
  { label: 'Executive Lead (Pablo)', monthlyUSD: 12000 },
  { label: 'Ryan', monthlyUSD: 7500 },
  {
    label: 'Miguel',
    monthlyUSD: 4400,
    note: '5-month average — full-time 3 months, half-time 2',
  },
  { label: 'Operations (tools, infra, subscriptions)', monthlyUSD: 1500 },
  { label: 'Flexible / discretionary', monthlyUSD: 1000 },
]

// At-risk milestone pool. Pays only on verified milestones, so it is a
// sensitivity on the base case rather than part of guaranteed burn.
export const EB_BONUS_POOL_MONTHLY_USD = 4800

// Revenue figure cited in MDP-249. Used only as a fallback when the live
// on-chain revenue pipeline is unavailable — it is a policy number, not a
// compiled trailing-twelve-month result.
export const STATED_ANNUAL_REVENUE_USD = 24500

export function getEbCoreMonthlyUSD(): number {
  return EB_CORE_LINES.reduce((sum, line) => sum + line.monthlyUSD, 0)
}

/**
 * Monthly equivalent of the quarterly projects budget. The projects line is
 * 5% of liquid non-MOONEY assets per quarter, so it is a third of that per
 * month. Defaults to the configured cycle budget.
 */
export function getProjectsMonthlyUSD(
  quarterlyProjectBudgetUSD: number = PROJECT_CYCLE.budgetUSD
): number {
  return quarterlyProjectBudgetUSD / 3
}

export interface BurnModel {
  ebCoreMonthlyUSD: number
  ebBonusMonthlyUSD: number
  projectsMonthlyUSD: number
  grossMonthlyUSD: number
  /** Revenue credited against gross burn, monthly. */
  revenueMonthlyUSD: number
  netMonthlyUSD: number
  /** Base case plus the full at-risk bonus pool. */
  netMonthlyWithBonusesUSD: number
  annual: {
    ebCoreUSD: number
    projectsUSD: number
    grossUSD: number
    revenueUSD: number
    netUSD: number
    netWithBonusesUSD: number
  }
}

/**
 * Assemble the burn model from the approved cost stack plus whatever revenue
 * the caller was able to measure. `annualRevenueUSD` should be live trailing
 * revenue; pass `STATED_ANNUAL_REVENUE_USD` when that is unavailable.
 */
export function computeBurnModel(params: {
  quarterlyProjectBudgetUSD?: number
  annualRevenueUSD: number
}): BurnModel {
  const ebCoreMonthlyUSD = getEbCoreMonthlyUSD()
  const projectsMonthlyUSD = getProjectsMonthlyUSD(params.quarterlyProjectBudgetUSD)
  const grossMonthlyUSD = ebCoreMonthlyUSD + projectsMonthlyUSD
  const annualRevenueUSD = Math.max(0, params.annualRevenueUSD)
  const revenueMonthlyUSD = annualRevenueUSD / 12
  const netMonthlyUSD = grossMonthlyUSD - revenueMonthlyUSD

  return {
    ebCoreMonthlyUSD,
    ebBonusMonthlyUSD: EB_BONUS_POOL_MONTHLY_USD,
    projectsMonthlyUSD,
    grossMonthlyUSD,
    revenueMonthlyUSD,
    netMonthlyUSD,
    netMonthlyWithBonusesUSD: netMonthlyUSD + EB_BONUS_POOL_MONTHLY_USD,
    annual: {
      ebCoreUSD: ebCoreMonthlyUSD * 12,
      projectsUSD: projectsMonthlyUSD * 12,
      grossUSD: grossMonthlyUSD * 12,
      revenueUSD: annualRevenueUSD,
      netUSD: netMonthlyUSD * 12,
      netWithBonusesUSD: (netMonthlyUSD + EB_BONUS_POOL_MONTHLY_USD) * 12,
    },
  }
}

/**
 * Months of runway. Returns null when net burn is zero or negative (revenue
 * covers costs) — the caller should render that as "cash-flow positive"
 * rather than as an infinite number.
 */
export function runwayMonths(assetsUSD: number, netMonthlyBurnUSD: number): number | null {
  if (!(netMonthlyBurnUSD > 0)) return null
  if (!(assetsUSD > 0)) return 0
  return assetsUSD / netMonthlyBurnUSD
}

/** Date the runway is exhausted at a constant net burn. */
export function runwayExhaustionDate(
  assetsUSD: number,
  netMonthlyBurnUSD: number,
  from: Date = new Date()
): Date | null {
  const months = runwayMonths(assetsUSD, netMonthlyBurnUSD)
  if (months === null) return null
  const out = new Date(from.getTime())
  out.setUTCMonth(out.getUTCMonth() + Math.floor(months))
  const dayFraction = months - Math.floor(months)
  out.setUTCDate(out.getUTCDate() + Math.round(dayFraction * 30))
  return out
}
