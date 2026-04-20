import { useState } from 'react'
import toast from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { Project } from '@/lib/project/useProjectData'
import Modal from '@/components/layout/Modal'

type Props = {
  project: Project
  onClose: () => void
  onSuccess?: () => void
}

type SignStatus = 'idle' | 'submitting' | 'success' | 'error'

function tryParseJson(value: string): unknown | null {
  if (!value?.trim()) return null
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

export default function AddToRetroactivesModal({ project, onClose, onSuccess }: Props) {
  const [finalReportLink, setFinalReportLink] = useState(project.finalReportLink || '')
  const [rewardDistribution, setRewardDistribution] = useState(
    project.rewardDistribution || ''
  )
  const [upfrontPayments, setUpfrontPayments] = useState(project.upfrontPayments || '')
  const [markEligible, setMarkEligible] = useState(project.eligible !== 1)
  const [markActive, setMarkActive] = useState(project.active !== 2)
  const [status, setStatus] = useState<SignStatus>('idle')
  const [resultTxs, setResultTxs] = useState<Array<{ label: string; hash: string }>>([])

  const distroParsed = rewardDistribution ? tryParseJson(rewardDistribution) : null
  const distroInvalid = rewardDistribution.trim().length > 0 && distroParsed === undefined
  const upfrontParsed = upfrontPayments ? tryParseJson(upfrontPayments) : null
  const upfrontInvalid = upfrontPayments.trim().length > 0 && upfrontParsed === undefined

  const submit = async () => {
    if (distroInvalid) {
      toast.error('Reward distribution must be valid JSON.', { style: toastStyle })
      return
    }
    if (upfrontInvalid) {
      toast.error('Upfront payments must be valid JSON.', { style: toastStyle })
      return
    }
    if (
      !finalReportLink &&
      !rewardDistribution &&
      !upfrontPayments &&
      !markEligible &&
      !markActive
    ) {
      toast.error('Nothing to update — fill in at least one field or toggle.', {
        style: toastStyle,
      })
      return
    }

    setStatus('submitting')
    setResultTxs([])
    try {
      const body: Record<string, any> = {
        projectId: project.id,
        markEligible,
        markActive,
      }
      if (finalReportLink) body.finalReportLink = finalReportLink
      if (rewardDistribution) body.rewardDistribution = rewardDistribution
      if (upfrontPayments) body.upfrontPayments = upfrontPayments

      const res = await fetch('/api/operator/project-add-to-retroactives', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error || `Request failed with status ${res.status}`)
      }
      setResultTxs(json.txs || [])
      setStatus('success')
      toast.success(`Submitted ${json.txs?.length || 0} transaction(s).`, {
        style: toastStyle,
      })
      onSuccess?.()
    } catch (err: any) {
      console.error('AddToRetroactivesModal submit failed:', err)
      toast.error(err?.message || 'Failed to submit operator transactions.', {
        style: toastStyle,
      })
      setStatus('error')
    }
  }

  const isSubmitting = status === 'submitting'

  return (
    <Modal
      id="add-to-retroactives-modal"
      setEnabled={(open) => {
        if (!open) onClose()
      }}
      title={`Add Project #${project.id} to Retroactives`}
      size="lg"
    >
      <div className="flex flex-col gap-5 text-sm">
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <p className="text-gray-300">
            <span className="font-semibold text-white">{project.name}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Q{project.quarter} {project.year} • active={project.active} • eligible={project.eligible}
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-gray-400">
            Final Report Link (Google Doc URL)
          </span>
          <input
            type="url"
            value={finalReportLink}
            onChange={(e) => setFinalReportLink(e.target.value)}
            placeholder="https://docs.google.com/document/d/..."
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-400/40"
            disabled={isSubmitting}
          />
          {project.finalReportLink && (
            <span className="text-[11px] text-gray-500">
              Existing: {project.finalReportLink}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-gray-400">
            Reward Distribution JSON (optional)
          </span>
          <textarea
            value={rewardDistribution}
            onChange={(e) => setRewardDistribution(e.target.value)}
            rows={3}
            placeholder={'{"0xabc...":60,"0xdef...":40}'}
            className={`bg-black/40 border rounded-lg px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none font-mono text-xs ${
              distroInvalid ? 'border-red-400/60' : 'border-white/10 focus:border-blue-400/40'
            }`}
            disabled={isSubmitting}
          />
          {distroInvalid && (
            <span className="text-[11px] text-red-400">Invalid JSON</span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-gray-400">
            Upfront Payments JSON (optional)
          </span>
          <textarea
            value={upfrontPayments}
            onChange={(e) => setUpfrontPayments(e.target.value)}
            rows={3}
            placeholder={'{"0xabc...":10,"0xdef...":5,"vMOONEY":{"0xabc...":10000}}'}
            className={`bg-black/40 border rounded-lg px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none font-mono text-xs ${
              upfrontInvalid ? 'border-red-400/60' : 'border-white/10 focus:border-blue-400/40'
            }`}
            disabled={isSubmitting}
          />
          {upfrontInvalid && (
            <span className="text-[11px] text-red-400">Invalid JSON</span>
          )}
        </label>

        <div className="flex flex-col gap-2 bg-white/5 rounded-lg p-4 border border-white/10">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markEligible}
              onChange={(e) => setMarkEligible(e.target.checked)}
              disabled={isSubmitting}
            />
            <span className="text-gray-200">Set <code>eligible = 1</code></span>
            {project.eligible === 1 && (
              <span className="text-[11px] text-green-400">already eligible</span>
            )}
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markActive}
              onChange={(e) => setMarkActive(e.target.checked)}
              disabled={isSubmitting}
            />
            <span className="text-gray-200">
              Set <code>active = 2</code> (PROJECT_ACTIVE — required so it appears in the
              current pool)
            </span>
            {project.active === 2 && (
              <span className="text-[11px] text-green-400">already active</span>
            )}
          </label>
        </div>

        {resultTxs.length > 0 && (
          <div className="bg-green-500/10 border border-green-400/30 rounded-lg p-3">
            <p className="text-green-300 text-xs font-semibold mb-2">
              Submitted {resultTxs.length} transaction(s):
            </p>
            <ul className="space-y-1 text-xs">
              {resultTxs.map((t) => (
                <li key={t.hash} className="text-gray-200">
                  <span className="text-gray-400">{t.label}</span> →{' '}
                  <a
                    href={`https://arbiscan.io/tx/${t.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:underline break-all"
                  >
                    {t.hash}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-300 hover:text-white transition"
            disabled={isSubmitting}
          >
            Close
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending…' : 'Sign & Submit (HSM)'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
