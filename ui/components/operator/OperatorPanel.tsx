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

type ClearProgress = {
  total: number
  done: number
  failed: Array<{ projectId: number; error: string }>
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
  const [clearProgress, setClearProgress] = useState<ClearProgress | null>(null)
  const [isClearing, setIsClearing] = useState(false)

  const allProjects = useMemo(
    () => [...currentProjects, ...pastProjects, ...proposals],
    [currentProjects, pastProjects, proposals]
  )

  const projectMap = useMemo(() => {
    const m = new Map<string, Project>()
    for (const p of allProjects) m.set(String(p.id), p)
    return m
  }, [allProjects])

  // Cohort = every project currently flagged eligible across both
  // currentProjects and pastProjects. Past quarters' projects can carry
  // a stale `eligible = 1` if the prior cycle was never explicitly
  // cleared, and the bulk action exists precisely to retire them.
  const eligibleCohort = useMemo(
    () =>
      [...currentProjects, ...pastProjects]
        .filter((p) => p.eligible === 1)
        .sort((a, b) => b.id - a.id),
    [currentProjects, pastProjects]
  )

  const clearCohort = async () => {
    if (eligibleCohort.length === 0) {
      toast.error('No projects currently have eligible = 1.', {
        style: toastStyle,
      })
      return
    }
    const confirmed = window.confirm(
      `Clear eligible flag (set to 0) on ${eligibleCohort.length} project(s)?\n\nEach project requires one HSM-signed transaction.`
    )
    if (!confirmed) return

    setIsClearing(true)
    setClearProgress({
      total: eligibleCohort.length,
      done: 0,
      failed: [],
    })

    // Sequential rather than parallel: the HSM signer rate-limits and
    // ordered submission keeps the on-chain history readable.
    for (const project of eligibleCohort) {
      try {
        const res = await fetch('/api/operator/project-add-to-retroactives', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            markEligible: false,
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          throw new Error(
            json?.error || `Request failed with status ${res.status}`
          )
        }
        setClearProgress((prev) =>
          prev
            ? { ...prev, done: prev.done + 1 }
            : { total: eligibleCohort.length, done: 1, failed: [] }
        )
      } catch (err: any) {
        console.error(`Clear cohort failed for project ${project.id}:`, err)
        setClearProgress((prev) =>
          prev
            ? {
                ...prev,
                done: prev.done + 1,
                failed: [
                  ...prev.failed,
                  {
                    projectId: project.id,
                    error: err?.message || 'unknown',
                  },
                ],
              }
            : prev
        )
      }
    }
    setIsClearing(false)
    setClearProgress((finalProgress) => {
      if (!finalProgress) return finalProgress
      const successCount = finalProgress.done - finalProgress.failed.length
      if (finalProgress.failed.length === 0) {
        toast.success(`Cleared eligible flag on ${successCount} project(s).`, {
          style: toastStyle,
        })
      } else {
        toast.error(
          `Cleared ${successCount}/${finalProgress.total}; ${finalProgress.failed.length} failed (see panel).`,
          { style: toastStyle }
        )
      }
      return finalProgress
    })
    onAfterChange?.()
  }

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

        {/* Clear retro cohort — end-of-cycle cleanup */}
        <div className="min-w-0 bg-black/30 rounded-lg p-3 border border-white/10 flex flex-col gap-2">
          <h4 className="text-xs uppercase tracking-wider text-gray-300 font-RobotoMono">
            Clear Retro Cohort
          </h4>
          <p className="text-xs text-gray-400">
            Sets <code>eligible = 0</code> on every project currently flagged
            <code className="mx-1">eligible = 1</code>. Run this once a cycle&apos;s
            retro voting has closed and payouts have been settled, before
            marking next cycle&apos;s projects eligible.
          </p>
          {eligibleCohort.length === 0 ? (
            <p className="text-[11px] text-gray-500 italic">
              No projects are currently eligible — nothing to clear.
            </p>
          ) : (
            <details className="text-[11px] text-gray-300">
              <summary className="cursor-pointer text-gray-400 hover:text-gray-200">
                {eligibleCohort.length} project(s) will be cleared
              </summary>
              <ul className="mt-1 ml-4 list-disc space-y-0.5">
                {eligibleCohort.map((p) => (
                  <li key={p.id}>
                    #{p.id} — {p.name}{' '}
                    <span className="text-gray-500">
                      (Q{p.quarter} {p.year})
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button
            type="button"
            onClick={clearCohort}
            disabled={isClearing || eligibleCohort.length === 0}
            className="self-start mt-1 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white text-xs font-RobotoMono shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isClearing
              ? `Clearing… ${clearProgress?.done ?? 0}/${
                  clearProgress?.total ?? 0
                }`
              : `Clear ${eligibleCohort.length} project(s)`}
          </button>
          {clearProgress && !isClearing && (
            <div className="mt-1 text-[11px] text-gray-300">
              <p>
                Done: {clearProgress.done - clearProgress.failed.length}/
                {clearProgress.total}
                {clearProgress.failed.length > 0 && (
                  <span className="text-rose-400">
                    {' '}
                    • {clearProgress.failed.length} failed
                  </span>
                )}
              </p>
              {clearProgress.failed.length > 0 && (
                <ul className="mt-1 ml-4 list-disc text-rose-300 space-y-0.5">
                  {clearProgress.failed.map((f) => (
                    <li key={f.projectId}>
                      #{f.projectId}: {f.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
