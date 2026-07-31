// Panel for a tech-tree category that has no capability race declared yet:
// the member projects and an honest "no market yet" note. Categories WITH a
// race open SharedGoalPanel (the prediction-market view) instead.

import { Squares2X2Icon, XMarkIcon } from '@heroicons/react/24/outline'
import {
  PROJECT_TYPE_GLYPH,
  PROJECT_TYPE_LABEL,
  orgColor,
} from '@/lib/lunar-atlas/display'
import type { TechTree } from '@/lib/lunar-atlas/selectors'
import type { Organization } from '@/lib/lunar-atlas/types'

type TechTreePanelProps = {
  tree: TechTree
  organizations: Organization[]
  onClose: () => void
  onSelectProject: (id: string) => void
}

export default function TechTreePanel({
  tree,
  organizations,
  onClose,
  onSelectProject,
}: TechTreePanelProps) {
  const orgMap = new Map(organizations.map((o) => [o.id, o]))

  return (
    <div className="pointer-events-auto flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0a0c14]/95 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Squares2X2Icon className="h-4 w-4 shrink-0 text-cyan-300" />
            <span className="text-xs font-medium uppercase tracking-wide text-cyan-200/80">
              Tech tree
            </span>
          </div>
          <h2 className="mt-1 text-lg font-semibold leading-snug text-white">
            {PROJECT_TYPE_GLYPH[tree.category]}{' '}
            {PROJECT_TYPE_LABEL[tree.category]}
          </h2>
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
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
            Projects ({tree.projects.length})
          </h3>
          <div className="space-y-2">
            {tree.projects.map((project) => {
              const organization = orgMap.get(project.orgId)
              const color = orgColor(organization)
              return (
                <button
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:border-cyan-400/40 hover:bg-white/10"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: color,
                      boxShadow: `0 0 10px ${color}`,
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
                </button>
              )
            })}
          </div>
        </div>

        <p className="border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/35">
          No MoonDAO capability race or prediction market is defined for this
          tech tree yet. Select a project to view its timeline and sources.
        </p>
      </div>
    </div>
  )
}
