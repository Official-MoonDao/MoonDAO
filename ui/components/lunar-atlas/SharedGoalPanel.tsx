// Race view for a DePrize-shaped shared goal: the competitor roster (with
// honest consent badges), the draft capability criteria, market structure,
// and sources. Opened from a shared-goal row in ProjectPanel or by clicking
// the goal's region marker on the globe.

import { FlagIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import type { MouseEvent } from 'react'
import {
  OPEN_FIELD_PROJECT_ID,
  ROSTER_DISCLAIMER,
  findDePrizeIdForGoal,
  getDePrizeRaceBinding,
  isCompetitorClaimed,
  isDePrizeGoalMarketBound,
} from '@/lib/deprize/competitions'
import { DEPRIZE_TERMS_URL } from '@/lib/deprize/constants'
import {
  ROSTER_STATUS_CLASSES,
  ROSTER_STATUS_LABEL,
  orgColor,
} from '@/lib/lunar-atlas/display'
import type {
  Organization,
  Project,
  SharedGoal,
} from '@/lib/lunar-atlas/types'
import { MarketPill } from './ProjectPanel'
import SourceBadge from './SourceBadge'

type Competitor = {
  project: Project
  organization?: Organization
}

type SharedGoalPanelProps = {
  goal: SharedGoal
  competitors: Competitor[]
  onClose: () => void
  onSelectProject: (id: string) => void
  /** Bound DePrize id when this race has an on-chain market. */
  deprizeId?: number
  /** Chain slug for the binding lookup (branding + disclaimer). */
  chainSlug?: string
  /** Formatted prize-pool total, e.g. "0.042 ETH". */
  prizePoolLabel?: string
  prizePoolLoading?: boolean
}

const NEUTRAL_ACCENT = '#9ca3af'

function oddsCaption(status: string | undefined): string {
  if (status === 'live') return 'Odds are live market-implied probabilities.'
  if (status === 'resolved') {
    return 'Final market-implied probabilities from the resolved market.'
  }
  return 'Illustrative curator priors — live odds replace these when the prediction market opens.'
}

function stopRowNav(e: MouseEvent) {
  e.stopPropagation()
}

export default function SharedGoalPanel({
  goal,
  competitors,
  onClose,
  onSelectProject,
  deprizeId,
  chainSlug,
  prizePoolLabel,
  prizePoolLoading = false,
}: SharedGoalPanelProps) {
  // A registry id alone is not enough — incomplete race bindings must not
  // show bound chrome (market CTA / ROSTER_DISCLAIMER). Match the bridge gate.
  const bound = !!chainSlug && isDePrizeGoalMarketBound(chainSlug, goal.id)
  const marketDeprizeId = bound
    ? deprizeId ?? findDePrizeIdForGoal(chainSlug!, goal.id)
    : undefined
  const binding =
    marketDeprizeId !== undefined && chainSlug
      ? getDePrizeRaceBinding(chainSlug, marketDeprizeId)
      : undefined
  const anyUnconfirmed = competitors.some(
    (c) =>
      c.project.rosterStatus === 'listed' ||
      c.project.rosterStatus === 'invited'
  )
  const split = goal.market?.payoutSplit
  const odds = goal.market?.impliedOdds
  const fieldOdds = odds?.[OPEN_FIELD_PROJECT_ID]
  // Highest-odds competitor first; ties and odds-less entries keep seed order.
  const ranked = odds
    ? [...competitors].sort(
        (a, b) => (odds[b.project.id] ?? -1) - (odds[a.project.id] ?? -1)
      )
    : competitors

  const outcomeIndexFor = (projectId: string): number | undefined => {
    if (!binding) return undefined
    const i = binding.outcomes.findIndex(
      (o) => !o.field && o.projectId === projectId
    )
    return i >= 0 ? i : undefined
  }

  // Brand color is withheld only from competitors that are actually outcomes in
  // the market and have not claimed their listing. A competitor the atlas lists
  // but the market does not price is not being bet on, so greying it would just
  // read as a rendering bug.
  const accentFor = (projectId: string, organization?: Organization) => {
    if (!binding) return orgColor(organization)
    const outcome = binding.outcomes.find((o) => o.projectId === projectId)
    if (!outcome) return orgColor(organization)
    return isCompetitorClaimed(outcome) ? orgColor(organization) : NEUTRAL_ACCENT
  }

  const marketStatus = goal.market?.status ?? 'none'
  const showNoMarketFooter =
    !bound && (marketStatus === 'none' || marketStatus === 'planned')
  const fieldOutcomeIndex =
    binding?.outcomes.findIndex((o) => o.field) ?? -1

  return (
    <div className="pointer-events-auto flex h-full w-full flex-col overflow-hidden rounded-2xl border border-fuchsia-400/20 bg-[#0a0c14]/95 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FlagIcon className="h-4 w-4 shrink-0 text-fuchsia-300" />
            <span className="text-xs font-medium uppercase tracking-wide text-fuchsia-200/80">
              Capability race
            </span>
            <MarketPill status={marketStatus} />
          </div>
          <h2 className="mt-1 text-lg font-semibold leading-snug text-white">
            {goal.title}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
            {goal.targetWindow && (
              <span>
                Target window: {goal.targetWindow.from ?? '?'} –{' '}
                {goal.targetWindow.to ?? '?'}
              </span>
            )}
            {bound && (
              <span className="tabular-nums text-emerald-200/90">
                Prize pool:{' '}
                {prizePoolLoading
                  ? '…'
                  : prizePoolLabel ?? '—'}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Region anchor */}
        {goal.regionLabel && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60">
              <MapPinIcon className="h-3.5 w-3.5" />
              {goal.regionLabel}
            </span>
          </div>
        )}

        {/* Description */}
        <p className="text-sm leading-relaxed text-white/80">{goal.description}</p>

        {/* Competitors */}
        {competitors.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
              Competitors ({competitors.length})
            </h3>
            <div className="space-y-2">
              {ranked.map(({ project, organization }) => {
                const color = accentFor(project.id, organization)
                const p = odds?.[project.id]
                const outcomeIndex = outcomeIndexFor(project.id)
                const canBack =
                  marketDeprizeId !== undefined && outcomeIndex !== undefined
                return (
                  <div
                    key={project.id}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 transition hover:border-cyan-400/40 hover:bg-white/10"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectProject(project.id)}
                      className="w-full text-left"
                    >
                      <span className="flex w-full items-center gap-3">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: color,
                            boxShadow:
                              color === NEUTRAL_ACCENT
                                ? undefined
                                : `0 0 10px ${color}`,
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-white">
                            {project.name}
                          </span>
                          <span className="block truncate text-xs text-white/50">
                            {organization?.name ?? project.orgId}
                          </span>
                        </span>
                        {p != null && (
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-cyan-200">
                            {Math.round(p * 100)}%
                          </span>
                        )}
                        {project.rosterStatus && (
                          <span
                            className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${ROSTER_STATUS_CLASSES[project.rosterStatus]}`}
                            title={ROSTER_STATUS_LABEL[project.rosterStatus]}
                          >
                            {project.rosterStatus}
                          </span>
                        )}
                      </span>
                      {p != null && (
                        <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-white/10">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${Math.round(p * 100)}%`,
                              backgroundColor: color,
                            }}
                          />
                        </span>
                      )}
                    </button>
                    {canBack && (
                      <div className="mt-2.5 flex justify-end">
                        <Link
                          href={`/deprize/${marketDeprizeId}?outcome=${outcomeIndex}`}
                          onClick={stopRowNav}
                          className="rounded border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-200 transition hover:border-emerald-300/50 hover:bg-emerald-500/20"
                        >
                          Back this team
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })}
              {fieldOdds != null && Number.isFinite(fieldOdds) && (
                <div className="w-full rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-3 py-2.5">
                  <span className="flex w-full items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border border-dashed border-white/40"
                      style={{ backgroundColor: 'transparent' }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white/80">
                        Other entrants
                      </span>
                      <span className="block truncate text-xs text-white/40">
                        Any qualifying entrant not listed above
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-cyan-200/80">
                      {Math.round(fieldOdds * 100)}%
                    </span>
                  </span>
                  <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <span
                      className="block h-full rounded-full bg-white/30"
                      style={{ width: `${Math.round(fieldOdds * 100)}%` }}
                    />
                  </span>
                  {marketDeprizeId !== undefined && fieldOutcomeIndex >= 0 && (
                    <div className="mt-2.5 flex justify-end">
                      <Link
                        href={`/deprize/${marketDeprizeId}?outcome=${fieldOutcomeIndex}`}
                        className="rounded border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-200 transition hover:border-emerald-300/50 hover:bg-emerald-500/20"
                      >
                        Back the field
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {marketDeprizeId !== undefined && (
              <Link
                href={`/deprize/${marketDeprizeId}`}
                className="mt-3 flex w-full items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/85 transition hover:border-fuchsia-400/40 hover:bg-white/10 hover:text-white"
              >
                See all competitors
              </Link>
            )}

            {odds && (
              <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                {oddsCaption(marketStatus)}
              </p>
            )}
            {bound ? (
              <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                {ROSTER_DISCLAIMER}
              </p>
            ) : (
              anyUnconfirmed && (
                <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                  &ldquo;Listed&rdquo; reflects MoonDAO&apos;s curatorial judgment
                  of credible competitors. It does not imply these organizations
                  have agreed to participate in any MoonDAO prize.
                </p>
              )
            )}
          </div>
        )}

        {/* Capability criteria */}
        {goal.criteria && goal.criteria.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
              Capability criteria (draft)
            </h3>
            <ol className="space-y-2.5">
              {goal.criteria.map((c, i) => (
                <li key={c.id} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 text-[11px] font-semibold text-fuchsia-200">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm leading-snug text-white/85">
                      {c.statement}
                    </span>
                    {c.threshold && (
                      <span className="mt-0.5 block text-xs text-white/50">
                        {c.threshold}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] leading-relaxed text-white/40">
              Draft criteria — the binding spec is frozen and pinned publicly
              when a market opens.
            </p>
          </div>
        )}

        {/* Market structure */}
        {goal.market && (split || goal.market.budgetGate) && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
              Prize structure
            </h3>
            {split && (
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-lg font-semibold text-white">
                    {Math.round(split.capability * 100)}%
                  </div>
                  <div className="text-xs text-white/50">
                    Capability demo confirmed
                  </div>
                </div>
                <div className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-lg font-semibold text-white">
                    {Math.round(split.flight * 100)}%
                  </div>
                  <div className="text-xs text-white/50">
                    Flight / surface milestone
                  </div>
                </div>
              </div>
            )}
            {goal.market.budgetGate && (
              <p className="mt-2 text-xs leading-relaxed text-white/50">
                Budget gate: {goal.market.budgetGate}
              </p>
            )}
          </div>
        )}

        {/* Sources */}
        {goal.sources.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
              Sources
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {goal.sources.map((s, i) => (
                <SourceBadge key={i} source={s} />
              ))}
            </div>
          </div>
        )}

        {showNoMarketFooter ? (
          <p className="border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/35">
            A concept for a future MoonDAO DePrize. No market exists yet; nothing
            here is an offer, endorsement, or prediction of outcomes.
          </p>
        ) : (
          <p className="border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/35">
            Nothing here is an offer, endorsement, or prediction of outcomes. See
            the{' '}
            <a
              href={DEPRIZE_TERMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-white/20 underline-offset-2 hover:text-white/60"
            >
              DePrize Terms &amp; Conditions
            </a>{' '}
            before placing a bet.
          </p>
        )}
      </div>
    </div>
  )
}
