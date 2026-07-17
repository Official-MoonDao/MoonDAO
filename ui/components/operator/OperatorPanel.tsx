import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import type { ProjectCyclePhase } from 'const/config'
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

type PhaseInfo = {
  configPhase: ProjectCyclePhase
  livePhase: ProjectCyclePhase
  nextPhase: ProjectCyclePhase | null
  quarter: number
  year: number
  override?: {
    phase: ProjectCyclePhase | null
    setBy?: string
    setAt?: string
    note?: string
  }
}

type SenateTallyRow = {
  mdp: number
  projectId: number | string
  name?: string
  status: string
  voteCount?: number
  approvalCount?: number
  quorum?: number
  txHash?: string
  error?: string
}

function phaseLabel(phase: ProjectCyclePhase | null | undefined): string {
  switch (phase) {
    case 'senate':
      return 'Senate Vote'
    case 'member':
      return 'Member Vote + Retroactive Rewards'
    case 'idle':
      return 'Idle (between cycles)'
    default:
      return 'Unknown'
  }
}

// EB-only operator panel. Renders nothing for non-EB members.
//
// The per-cycle defaults live in `PROJECT_CYCLE` (`const/config.ts`). This
// panel lets an operator advance the LIVE cycle phase (Senate → Member →
// wrap-up) without a redeploy — the "Cycle Phase" card runs the required
// on-chain calls (Senate `tallyVotes`, Member Vote tally) and flips a phase
// override stored in Upstash KV (see `lib/operator/cyclePhase.ts`). It also
// lets an operator attach a final report and mark projects eligible for
// retroactive rewards.
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

  // Cycle phase advance
  const [phaseInfo, setPhaseInfo] = useState<PhaseInfo | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [tallying, setTallying] = useState(false)
  const [advanceResult, setAdvanceResult] = useState<any | null>(null)

  const loadPhase = () => {
    fetch('/api/operator/phase-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setPhaseInfo(data as PhaseInfo)
      })
      .catch((err) => console.warn('phase-status fetch failed:', err))
  }

  useEffect(() => {
    if (!isExecutive) return
    loadPhase()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExecutive])

  const previewAdvance = async () => {
    setAdvancing(true)
    setAdvanceResult(null)
    try {
      const res = await fetch('/api/operator/advance-phase', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      })
      const json = await res.json()
      setAdvanceResult(json)
      if (!res.ok) throw new Error(json?.error || 'Preview failed')
      toast.success('Preview ready — review below before advancing.', {
        style: toastStyle,
      })
    } catch (err: any) {
      toast.error(err?.message || 'Preview failed.', { style: toastStyle })
    } finally {
      setAdvancing(false)
    }
  }

  const doAdvance = async (force = false) => {
    const phase = phaseInfo?.livePhase
    const confirmMsg =
      phase === 'senate'
        ? 'Close the Senate Vote ON-CHAIN (tally every pending proposal), then open the Member Vote + Retroactive rewards?'
        : phase === 'member'
        ? 'Wrap up the cycle (close the Member Vote UI)? Make sure the Member Vote on-chain tally has already been run.'
        : 'Advance the cycle phase?'
    if (!window.confirm(confirmMsg + (force ? '\n\nFORCING past blockers.' : '')))
      return
    setAdvancing(true)
    try {
      const res = await fetch('/api/operator/advance-phase', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const json = await res.json()
      setAdvanceResult(json)
      if (!res.ok) {
        if (res.status === 409) {
          toast.error(
            'Blocked: some proposals are not closed. Review below, then Force if intended.',
            { style: toastStyle }
          )
          return
        }
        throw new Error(json?.error || 'Advance failed')
      }
      toast.success(`Phase advanced to ${phaseLabel(json.newPhase)}.`, {
        style: toastStyle,
        duration: 5000,
      })
      loadPhase()
      onAfterChange?.()
    } catch (err: any) {
      toast.error(err?.message || 'Advance failed.', { style: toastStyle })
    } finally {
      setAdvancing(false)
    }
  }

  const runMemberTally = async () => {
    if (
      !window.confirm(
        'Run the Member Vote on-chain tally now? This flips winning projects to active on-chain.'
      )
    )
      return
    setTallying(true)
    try {
      const res = await fetch('/api/proposals/vote', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Tally failed')
      toast.success('Member Vote tallied on-chain.', {
        style: toastStyle,
        duration: 5000,
      })
      onAfterChange?.()
    } catch (err: any) {
      toast.error(err?.message || 'Member Vote tally failed.', {
        style: toastStyle,
      })
    } finally {
      setTallying(false)
    }
  }

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
            Visible only to Executive Branch members. Advance the cycle phase
            and run project-level actions — all on-chain calls are signed by
            the GCP HSM owner wallet.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        {/* Cycle phase advance — one-click Senate → Member → wrap-up */}
        <div className="min-w-0 bg-black/30 rounded-lg p-3 border border-emerald-400/20 flex flex-col gap-2">
          <h4 className="text-xs uppercase tracking-wider text-emerald-200 font-RobotoMono">
            Cycle Phase
          </h4>
          {!phaseInfo ? (
            <p className="text-[11px] text-gray-500 italic">Loading phase…</p>
          ) : (
            <>
              <p className="text-xs text-gray-300">
                Live phase:{' '}
                <span className="font-semibold text-white">
                  {phaseLabel(phaseInfo.livePhase)}
                </span>{' '}
                <span className="text-gray-500">
                  (Q{phaseInfo.quarter} {phaseInfo.year})
                </span>
              </p>
              {phaseInfo.livePhase !== phaseInfo.configPhase && (
                <p className="text-[11px] text-amber-300">
                  Runtime override active — config default is{' '}
                  {phaseLabel(phaseInfo.configPhase)}.
                  {phaseInfo.override?.setBy
                    ? ` Set by ${phaseInfo.override.setBy.slice(0, 6)}…`
                    : ''}
                </p>
              )}

              {phaseInfo.livePhase === 'senate' && (
                <>
                  <p className="text-xs text-gray-400">
                    Closes the Senate Vote on-chain (signs{' '}
                    <code>tallyVotes(mdp)</code> for every pending proposal in
                    Q{phaseInfo.quarter} {phaseInfo.year}), then opens the
                    Member Vote + Retroactive rewards.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <button
                      type="button"
                      onClick={previewAdvance}
                      disabled={advancing}
                      className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-gray-200 text-xs font-RobotoMono shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {advancing ? 'Working…' : 'Preview (dry run)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => doAdvance(false)}
                      disabled={advancing}
                      className="px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-RobotoMono shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {advancing
                        ? 'Advancing…'
                        : 'Close Senate & Open Member Vote'}
                    </button>
                  </div>
                </>
              )}

              {phaseInfo.livePhase === 'member' && (
                <>
                  <p className="text-xs text-gray-400">
                    Run the Member Vote on-chain tally first (flips winners to
                    active), then wrap up the cycle UI.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <button
                      type="button"
                      onClick={runMemberTally}
                      disabled={tallying}
                      className="px-3 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-xs font-RobotoMono shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {tallying ? 'Tallying…' : 'Run Member Vote Tally'}
                    </button>
                    <button
                      type="button"
                      onClick={() => doAdvance(false)}
                      disabled={advancing}
                      className="px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white text-xs font-RobotoMono shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {advancing ? 'Wrapping…' : 'Wrap Up Cycle'}
                    </button>
                  </div>
                </>
              )}

              {phaseInfo.livePhase === 'idle' && (
                <p className="text-xs text-gray-400">
                  Cycle is idle. Start the next cycle by editing{' '}
                  <code>PROJECT_CYCLE</code> in <code>const/config.ts</code>{' '}
                  (new quarter, budget, retro pool) and deploying.
                </p>
              )}

              {advanceResult?.blockers?.length > 0 && (
                <div className="mt-1">
                  <p className="text-[11px] text-rose-300">
                    {advanceResult.blockers.length} proposal(s) block the
                    advance (below quorum or errored):
                  </p>
                  <ul className="mt-1 ml-4 list-disc text-[11px] text-rose-200 space-y-0.5">
                    {(advanceResult.blockers as SenateTallyRow[]).map((b) => (
                      <li key={b.mdp}>
                        MDP-{b.mdp} {b.name ? `“${b.name}” ` : ''}— {b.status}
                        {b.status === 'below-quorum' &&
                        b.voteCount != null &&
                        b.quorum != null
                          ? ` (${b.voteCount}/${b.quorum})`
                          : ''}
                        {b.error ? `: ${b.error}` : ''}
                      </li>
                    ))}
                  </ul>
                  {phaseInfo.livePhase === 'senate' && (
                    <button
                      type="button"
                      onClick={() => doAdvance(true)}
                      disabled={advancing}
                      className="mt-2 px-3 py-2 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-RobotoMono shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Force advance past blockers
                    </button>
                  )}
                </div>
              )}

              {advanceResult?.senateTally?.length > 0 && (
                <details className="mt-1 text-[11px] text-gray-300">
                  <summary className="cursor-pointer text-gray-400 hover:text-gray-200">
                    Senate tally detail ({advanceResult.senateTally.length})
                    {advanceResult.dryRun ? ' — preview' : ''}
                  </summary>
                  <ul className="mt-1 ml-4 list-disc space-y-0.5">
                    {(advanceResult.senateTally as SenateTallyRow[]).map((r) => (
                      <li key={r.mdp}>
                        MDP-{r.mdp}: {r.status}
                        {r.approvalCount != null && r.voteCount != null
                          ? ` (${r.approvalCount}/${r.voteCount})`
                          : ''}
                        {r.txHash ? ' ✓' : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>

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
