import { useLayoutEffect, useState } from 'react'
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'
import { PROJECT_TYPE_GLYPH, orgColor } from '@/lib/lunar-atlas/display'
import type {
  Organization,
  Project,
  ProjectType,
} from '@/lib/lunar-atlas/types'

// One row of the race list: a capability race, the size of its field, and who
// the market currently has in front.
export type RaceEntry = {
  category: ProjectType
  label: string
  count: number
  leaderName?: string
  leaderColor?: string
}

type LegendProps = {
  races: RaceEntry[]
  // The open race — the district at full strength on the surface.
  selectedRace: ProjectType | null
  onSelectRace: (category: ProjectType) => void
  onHoverRace: (category: ProjectType | null) => void
  organizations: Organization[]
  selectedOrgIds: string[]
  onToggleOrg: (id: string) => void
  onClear: () => void
  projects: Project[]
}

// The scene's primary axis is the RACE, not the company. Every capability on the
// Moon is a field of two to four competitors, and the interesting question is
// always "who is winning this one" — so the races are the list you land on, and
// pressing one opens it on the surface as well as in the panel. Organizations
// are still here, one level down, for when the question is the other way round:
// everything one company is building.
export default function Legend({
  races,
  selectedRace,
  onSelectRace,
  onHoverRace,
  organizations,
  selectedOrgIds,
  onToggleOrg,
  onClear,
  projects,
}: LegendProps) {
  const [open, setOpen] = useState(true)
  const [orgsOpen, setOrgsOpen] = useState(false)
  const hasFilter = selectedOrgIds.length > 0

  // On mobile the info card and this legend stack (rather than sit side by
  // side), so an expanded-by-default race list — fine on desktop, where the
  // globe has room to spare — ends up covering the whole viewport and leaves
  // nothing to pan/look around on. Collapse it by default below `sm`; a tap
  // on "Show" still opens it. useLayoutEffect (not a lazy useState initializer)
  // so the collapse happens before paint without disagreeing with the SSR
  // markup and tripping a hydration mismatch.
  useLayoutEffect(() => {
    if (window.matchMedia('(max-width: 639px)').matches) setOpen(false)
  }, [])

  const countForOrg = (id: string) => projects.filter((p) => p.orgId === id).length

  return (
    <div className="pointer-events-auto w-full sm:w-64 rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <AdjustmentsHorizontalIcon className="h-4 w-4 text-cyan-300" />
          Capability races
        </span>
        <span className="text-xs text-white/40">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="space-y-4 px-4 pb-4">
          <div className="space-y-1">
            {races.map((race) => {
              const active = selectedRace === race.category
              return (
                <button
                  key={race.category}
                  onClick={() => onSelectRace(race.category)}
                  onMouseEnter={() => onHoverRace(race.category)}
                  onMouseLeave={() => onHoverRace(null)}
                  className={`flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                    active
                      ? 'border-cyan-300/40 bg-cyan-300/10'
                      : 'border-transparent hover:bg-white/10'
                  }`}
                >
                  <span className="mt-px shrink-0 text-sm leading-none">
                    {PROJECT_TYPE_GLYPH[race.category]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm ${
                        active ? 'text-white' : 'text-white/80'
                      }`}
                    >
                      {race.label}
                    </span>
                    {race.leaderName && (
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/40">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: race.leaderColor }}
                        />
                        <span className="truncate">
                          {race.leaderName} leading
                        </span>
                      </span>
                    )}
                  </span>
                  <span className="mt-px shrink-0 text-xs text-white/30">
                    {race.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="border-t border-white/10 pt-3">
            <button
              onClick={() => setOrgsOpen((o) => !o)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                Organizations
              </span>
              <span className="text-[11px] text-white/30">
                {selectedOrgIds.length
                  ? `${selectedOrgIds.length} filtered`
                  : orgsOpen
                  ? 'Hide'
                  : 'Show'}
              </span>
            </button>

            {(orgsOpen || selectedOrgIds.length > 0) && (
              <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
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
            )}
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
