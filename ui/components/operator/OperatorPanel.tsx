import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { useIsExecutive } from '@/lib/operator/useIsExecutive'
import { Project } from '@/lib/project/useProjectData'
import AddToRetroactivesModal from './AddToRetroactivesModal'

type Props = {
  proposals: Project[]
  currentProjects: Project[]
  pastProjects: Project[]
  onAfterChange?: () => void
}

// EB-only operator panel. Renders nothing for non-EB members.
//
// Phase flags (`IS_SENATE_VOTE`, `IS_MEMBER_VOTE`, `IS_REWARDS_CYCLE`) live in
// `const/config.ts` and are flipped by editing the file + redeploying. The
// only thing this panel does today is let an operator attach a final report
// and mark a project eligible for retroactive rewards.
export default function OperatorPanel({
  proposals,
  currentProjects,
  pastProjects,
  onAfterChange,
}: Props) {
  const { isExecutive } = useIsExecutive()
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [modalProject, setModalProject] = useState<Project | null>(null)

  const allProjects = useMemo(
    () => [...currentProjects, ...pastProjects, ...proposals],
    [currentProjects, pastProjects, proposals]
  )

  const projectMap = useMemo(() => {
    const m = new Map<string, Project>()
    for (const p of allProjects) m.set(String(p.id), p)
    return m
  }, [allProjects])

  if (!isExecutive) return null

  return (
    <div
      id="operator-panel"
      className="w-full min-w-0 max-w-full overflow-hidden bg-gradient-to-br from-purple-900/30 via-blue-900/20 to-black/40 border border-purple-400/30 rounded-xl p-4 sm:p-5"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-GoodTimes text-purple-200 uppercase tracking-wider">
            Operator Panel
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Visible only to Executive Branch members. Phase flags are managed
            in <code>const/config.ts</code>; this panel handles project-level
            actions signed by the GCP HSM owner wallet.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        {/* Add final report + add to retroactives */}
        <div className="min-w-0 bg-black/30 rounded-lg p-3 border border-white/10 flex flex-col gap-2">
          <h4 className="text-xs uppercase tracking-wider text-gray-300 font-RobotoMono">
            Add Final Report &amp; Mark Eligible
          </h4>
          <p className="text-xs text-gray-400">
            Pick a project, fill in its final report URL and reward split, then
            sign the owner-only updates with one click.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 mt-1 min-w-0">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="flex-1 min-w-0 max-w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-400/40 truncate"
            >
              <option value="">Select a project…</option>
              {allProjects
                .slice()
                .sort((a, b) => b.id - a.id)
                .map((p) => {
                  const label = `#${p.id} — ${p.name} (Q${p.quarter} ${p.year})`
                  const truncated =
                    label.length > 60 ? label.slice(0, 57) + '…' : label
                  return (
                    <option key={p.id} value={String(p.id)} title={label}>
                      {truncated}
                    </option>
                  )
                })}
            </select>
            <button
              type="button"
              onClick={() => {
                const proj = projectMap.get(selectedProjectId)
                if (!proj) {
                  toast.error('Pick a project first.', { style: toastStyle })
                  return
                }
                setModalProject(proj)
              }}
              className="shrink-0 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-xs font-RobotoMono shadow"
            >
              Open
            </button>
          </div>
        </div>
      </div>

      {modalProject && (
        <AddToRetroactivesModal
          project={modalProject}
          onClose={() => setModalProject(null)}
          onSuccess={() => {
            onAfterChange?.()
          }}
        />
      )}
    </div>
  )
}
