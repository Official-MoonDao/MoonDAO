import { MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useMemo } from 'react'
import { parseAtlasYear } from '@/lib/lunar-atlas/selectors'
import {
  LOCATION_PRECISION_LABEL,
  MILESTONE_STATUS_CLASSES,
  MILESTONE_STATUS_LABEL,
  PROJECT_TYPE_GLYPH,
  PROJECT_TYPE_LABEL,
  ROSTER_STATUS_CLASSES,
  ROSTER_STATUS_LABEL,
  orgColor,
} from '@/lib/lunar-atlas/display'
import type {
  Organization,
  Project,
  SharedGoal,
} from '@/lib/lunar-atlas/types'
import SourceBadge from './SourceBadge'

type ProjectPanelProps = {
  project: Project
  organization?: Organization
  sharedGoals: SharedGoal[]
  onClose: () => void
  onFocusRegion?: (project: Project) => void
  onSelectSharedGoal?: (goalId: string) => void
}

export default function ProjectPanel({
  project,
  organization,
  sharedGoals,
  onClose,
  onFocusRegion,
  onSelectSharedGoal,
}: ProjectPanelProps) {
  const color = orgColor(organization)
  const approximate = project.locationPrecision !== 'exact'

  const milestones = useMemo(
    () =>
      [...project.milestones].sort(
        (a, b) => (parseAtlasYear(a.targetDate) ?? 0) - (parseAtlasYear(b.targetDate) ?? 0)
      ),
    [project.milestones]
  )

  return (
    <div className="pointer-events-auto flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0c14]/95 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
            />
            <span className="truncate text-xs font-medium uppercase tracking-wide text-white/60">
              {organization?.name ?? project.orgId}
              {organization?.kind ? ` · ${organization.kind}` : ''}
            </span>
          </div>
          <h2 className="mt-1 truncate text-lg font-semibold text-white">
            {project.name}
          </h2>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-white/60">
            <span>{PROJECT_TYPE_GLYPH[project.type]}</span>
            <span>{PROJECT_TYPE_LABEL[project.type]}</span>
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
        {/* Location */}
        <div className="flex flex-wrap items-center gap-2">
          {approximate && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-200">
              <MapPinIcon className="h-3.5 w-3.5" />
              {LOCATION_PRECISION_LABEL[project.locationPrecision]}
            </span>
          )}
          {project.regionLabel && (
            <span className="text-xs text-white/50">{project.regionLabel}</span>
          )}
          {project.location && onFocusRegion && (
            <button
              onClick={() => onFocusRegion(project)}
              className="ml-auto rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition hover:border-cyan-400/40 hover:text-cyan-200"
            >
              Fly to location
            </button>
          )}
        </div>

        {/* Summary */}
        <p className="text-sm leading-relaxed text-white/80">{project.summary}</p>

        {/* DePrize roster status — honest consent state, not implied endorsement */}
        {project.rosterStatus && (
          <span
            className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${ROSTER_STATUS_CLASSES[project.rosterStatus]}`}
          >
            {ROSTER_STATUS_LABEL[project.rosterStatus]}
          </span>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
              Timeline
            </h3>
            <ol className="space-y-3 border-l border-white/10 pl-4">
              {milestones.map((m) => (
                <li key={m.id} className="relative">
                  <span
                    className="absolute -left-[21px] top-1 h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-white">{m.title}</span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${MILESTONE_STATUS_CLASSES[m.status]}`}
                    >
                      {MILESTONE_STATUS_LABEL[m.status]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-white/50">
                    {m.targetDate}
                    {m.datePrecision === 'estimated' ? ' (est.)' : ''}
                  </div>
                  {m.sources.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.sources.map((s, i) => (
                        <SourceBadge key={i} source={s} />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Shared goals */}
        {sharedGoals.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
              Shared goals
            </h3>
            <div className="space-y-2">
              {sharedGoals.map((g) =>
                // Only render an interactive affordance when there is a real
                // handler — a button that does nothing reads as broken.
                onSelectSharedGoal ? (
                  <button
                    key={g.id}
                    onClick={() => onSelectSharedGoal(g.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-fuchsia-400/40 hover:bg-white/10"
                  >
                    <span className="text-sm text-white/85">{g.title}</span>
                    <MarketPill status={g.market?.status ?? 'none'} />
                  </button>
                ) : (
                  <div
                    key={g.id}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left"
                  >
                    <span className="text-sm text-white/85">{g.title}</span>
                    <MarketPill status={g.market?.status ?? 'none'} />
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Sources */}
        {project.sources.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
              Sources
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {project.sources.map((s, i) => (
                <SourceBadge key={i} source={s} />
              ))}
            </div>
          </div>
        )}

        <p className="border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/35">
          Publicly-stated goals compiled by MoonDAO from the sources above. Not an
          endorsement, guarantee, or prediction of outcomes.
        </p>
      </div>
    </div>
  )
}

export function MarketPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    none: { label: 'Market TBD', cls: 'text-white/40 border-white/10 bg-white/5' },
    planned: {
      label: 'Market planned',
      cls: 'text-fuchsia-200 border-fuchsia-400/30 bg-fuchsia-500/10',
    },
    live: {
      label: 'Market live',
      cls: 'text-emerald-200 border-emerald-400/30 bg-emerald-500/10',
    },
    resolved: {
      label: 'Resolved',
      cls: 'text-white/60 border-white/15 bg-white/5',
    },
  }
  const s = map[status] ?? map.none
  return (
    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}
