import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import type { RetroCycleOverride } from '@/lib/operator/retroCycle'
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
export default function OperatorPanel({
  proposals,
  currentProjects,
  pastProjects,
  onAfterChange,
}: Props) {
  const { isExecutive } = useIsExecutive()
  const [override, setOverride] = useState<RetroCycleOverride | null>(null)
  const [overrideLoading, setOverrideLoading] = useState(false)
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

  useEffect(() => {
    if (!isExecutive) return
    let cancelled = false
    fetch('/api/operator/retro-cycle-status')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setOverride(data)
      })
      .catch((err) => console.warn('retro-cycle-status fetch failed:', err))
    return () => {
      cancelled = true
    }
  }, [isExecutive])

  if (!isExecutive) return null

  const handleStartCycle = async () => {
    setOverrideLoading(true)
    try {
      const res = await fetch('/api/operator/set-retro-cycle', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          note: 'Started from operator panel',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to start cycle')
      setOverride(json)
      toast.success('Retroactive rewards cycle is now LIVE.', { style: toastStyle })
      onAfterChange?.()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start cycle.', { style: toastStyle })
    } finally {
      setOverrideLoading(false)
    }
  }

  const handleStopCycle = async () => {
    setOverrideLoading(true)
    try {
      const res = await fetch('/api/operator/set-retro-cycle', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: false,
          note: 'Stopped from operator panel',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to stop cycle')
      setOverride(json)
      toast.success('Retroactive rewards cycle override turned OFF.', {
        style: toastStyle,
      })
      onAfterChange?.()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to stop cycle.', { style: toastStyle })
    } finally {
      setOverrideLoading(false)
    }
  }

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
            Visible only to Executive Branch members. All actions are signed by the GCP
            HSM owner wallet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {override?.enabled ? (
            <span className="inline-flex items-center gap-2 text-xs bg-green-500/10 text-green-300 border border-green-400/30 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Retro cycle override: ON
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-xs bg-white/5 text-gray-400 border border-white/10 px-3 py-1.5 rounded-full">
              Retro cycle override: off
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Start / Stop retroactives cycle */}
        <div className="min-w-0 bg-black/30 rounded-lg p-3 border border-white/10 flex flex-col gap-2">
          <h4 className="text-xs uppercase tracking-wider text-gray-300 font-RobotoMono">
            Retroactives Cycle
          </h4>
          <p className="text-xs text-gray-400">
            Force the retroactive rewards UI live regardless of the date-based default in{' '}
            <code>isRewardsCycle</code>. Toggle off to revert.
          </p>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={handleStartCycle}
              disabled={overrideLoading || override?.enabled}
              className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xs font-RobotoMono shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {override?.enabled ? 'Cycle Live' : 'Start Cycle'}
            </button>
            <button
              type="button"
              onClick={handleStopCycle}
              disabled={overrideLoading || !override?.enabled}
              className="flex-1 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-gray-200 text-xs font-RobotoMono shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Stop Cycle
            </button>
          </div>
          {override?.setBy && (
            <p className="text-[11px] text-gray-500 mt-1 break-all">
              Last toggled by {override.setBy}
              {override.setAt
                ? ` at ${new Date(override.setAt).toLocaleString()}`
                : ''}
            </p>
          )}
        </div>

        {/* Add final report + add to retroactives */}
        <div className="min-w-0 bg-black/30 rounded-lg p-3 border border-white/10 flex flex-col gap-2">
          <h4 className="text-xs uppercase tracking-wider text-gray-300 font-RobotoMono">
            Add Final Report &amp; Mark Eligible
          </h4>
          <p className="text-xs text-gray-400">
            Pick a project, fill in its final report URL and reward split, then sign the
            owner-only updates with one click.
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
