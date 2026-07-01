import { useState } from 'react'
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'
import {
  PROJECT_TYPE_GLYPH,
  PROJECT_TYPE_LABEL,
  orgColor,
} from '@/lib/lunar-atlas/display'
import type {
  Organization,
  Project,
  ProjectType,
} from '@/lib/lunar-atlas/types'

type LegendProps = {
  organizations: Organization[]
  typesPresent: ProjectType[]
  selectedOrgIds: string[]
  selectedTypes: ProjectType[]
  onToggleOrg: (id: string) => void
  onToggleType: (type: ProjectType) => void
  onClear: () => void
  projects: Project[]
}

export default function Legend({
  organizations,
  typesPresent,
  selectedOrgIds,
  selectedTypes,
  onToggleOrg,
  onToggleType,
  onClear,
  projects,
}: LegendProps) {
  const [open, setOpen] = useState(true)
  const hasFilter = selectedOrgIds.length > 0 || selectedTypes.length > 0

  const countForOrg = (id: string) => projects.filter((p) => p.orgId === id).length
  const countForType = (t: ProjectType) => projects.filter((p) => p.type === t).length

  return (
    <div className="pointer-events-auto w-60 rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <AdjustmentsHorizontalIcon className="h-4 w-4 text-cyan-300" />
          Filters
        </span>
        <span className="text-xs text-white/40">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="space-y-4 px-4 pb-4">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
              Organizations
            </div>
            <div className="space-y-1">
              {organizations.map((org) => {
                const active =
                  selectedOrgIds.length === 0 || selectedOrgIds.includes(org.id)
                return (
                  <button
                    key={org.id}
                    onClick={() => onToggleOrg(org.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                      active ? 'text-white' : 'text-white/35'
                    } hover:bg-white/10`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: orgColor(org),
                        boxShadow: active ? `0 0 8px ${orgColor(org)}` : 'none',
                      }}
                    />
                    <span className="truncate">{org.name}</span>
                    <span className="ml-auto text-xs text-white/30">
                      {countForOrg(org.id)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
              Project type
            </div>
            <div className="flex flex-wrap gap-1.5">
              {typesPresent.map((t) => {
                const active =
                  selectedTypes.length === 0 || selectedTypes.includes(t)
                return (
                  <button
                    key={t}
                    onClick={() => onToggleType(t)}
                    title={PROJECT_TYPE_LABEL[t]}
                    className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs transition ${
                      active
                        ? 'border-white/20 bg-white/10 text-white'
                        : 'border-white/5 text-white/35'
                    } hover:bg-white/15`}
                  >
                    <span>{PROJECT_TYPE_GLYPH[t]}</span>
                    <span>{PROJECT_TYPE_LABEL[t]}</span>
                    <span className="text-white/30">{countForType(t)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {hasFilter && (
            <button
              onClick={onClear}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs text-white/70 transition hover:bg-white/10"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
