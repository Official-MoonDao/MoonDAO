// Close & Tally button for non-project proposals.
//
// Visible only to MoonDAO Executive Leads (the OPERATORS allowlist), and
// only after the 5-day voting window has elapsed. Hits the
// /api/proposals/nonProjectVote endpoint, which runs the quadratic vMOONEY
// tally and flips the project's `active` column to PROJECT_ACTIVE or
// PROJECT_VOTE_FAILED on-chain.
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import { OPERATORS } from 'const/config'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'

const VOTING_WINDOW_SECONDS = 60 * 60 * 24 * 5
// 30s is fine — countdown granularity is minutes/hours/days.
const TICK_MS = 30 * 1000

export default function CloseAndTallyButton({
  mdp,
  tempCheckApprovedTimestamp,
}: {
  mdp: number
  tempCheckApprovedTimestamp?: string
}) {
  const router = useRouter()
  const account = useActiveAccount()
  const address = account?.address
  const [submitting, setSubmitting] = useState(false)

  const isOperator = useMemo(() => {
    if (!address) return false
    return OPERATORS.includes(address.toLowerCase())
  }, [address])

  const closesAt = useMemo(() => {
    const ts = parseInt(tempCheckApprovedTimestamp || '0', 10)
    if (!ts) return 0
    return ts + VOTING_WINDOW_SECONDS
  }, [tempCheckApprovedTimestamp])

  // Tick the clock so the button enables and the countdown updates without
  // requiring a manual page refresh. Stop the timer as soon as the window has
  // elapsed (or if there's no window at all).
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  const windowEnded = closesAt > 0 && nowSec > closesAt
  useEffect(() => {
    if (closesAt === 0 || windowEnded) return
    const id = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [closesAt, windowEnded])

  if (!isOperator) return null

  const handleClose = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/proposals/nonProjectVote', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mdp }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to tally votes')
      }
      toast.success(
        data?.passed ? 'Vote tallied — proposal passed.' : 'Vote tallied — proposal did not pass.',
        { style: toastStyle }
      )
      router.replace(router.asPath)
    } catch (err: any) {
      console.error('Close & tally failed:', err)
      toast.error(err?.message || 'Failed to close & tally vote.', {
        style: toastStyle,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const remainingLabel = (() => {
    if (windowEnded || closesAt === 0) return null
    const remaining = closesAt - nowSec
    const days = Math.floor(remaining / 86400)
    const hours = Math.floor((remaining % 86400) / 3600)
    if (days > 0) return `${days}d ${hours}h remaining`
    const minutes = Math.floor((remaining % 3600) / 60)
    return `${hours}h ${minutes}m remaining`
  })()

  return (
    <div className="flex flex-col items-start gap-2 mt-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
      <div className="text-[11px] uppercase tracking-wider text-yellow-300/80">
        Executive Lead Controls
      </div>
      <button
        type="button"
        onClick={handleClose}
        disabled={!windowEnded || submitting}
        className="px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black disabled:from-gray-600 disabled:to-gray-700 disabled:text-white/60 disabled:cursor-not-allowed"
      >
        {submitting
          ? 'Tallying...'
          : windowEnded
          ? 'Close & Tally Member Vote'
          : 'Voting window not yet ended'}
      </button>
      {remainingLabel && (
        <p className="text-[11px] text-white/60">{remainingLabel}</p>
      )}
    </div>
  )
}
