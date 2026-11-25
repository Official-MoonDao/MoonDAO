// Shown to Executive Leads on a decided member vote that has no snapshot row,
// which happens when the snapshot write fails during Close & Tally. Hits
// /api/proposals/nonProjectVoteSnapshot; the pass/fail decision is untouched.
import { OPERATORS } from 'const/config'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'

export default function WriteVoteSnapshotButton({ mdp }: { mdp: number }) {
  const router = useRouter()
  const account = useActiveAccount()
  const address = account?.address
  const [submitting, setSubmitting] = useState(false)

  const isOperator = useMemo(() => {
    if (!address) return false
    return OPERATORS.includes(address.toLowerCase())
  }, [address])

  if (!isOperator) return null

  const handleWrite = async () => {
    if (submitting) return
    setSubmitting(true)
    const toastId = toast.loading('Writing vote snapshot...', { style: toastStyle })
    try {
      const res = await fetch('/api/proposals/nonProjectVoteSnapshot', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mdp }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to write vote snapshot')
      }
      toast.success(
        data?.alreadyExisted ? 'A vote snapshot already exists.' : 'Vote snapshot saved.',
        { id: toastId, style: toastStyle }
      )
      router.replace(router.asPath)
    } catch (err: any) {
      console.error('Write vote snapshot failed:', err)
      toast.error(err?.message || 'Failed to write vote snapshot.', {
        id: toastId,
        style: toastStyle,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 mt-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
      <div className="text-[11px] uppercase tracking-wider text-yellow-300/80">
        Executive Lead Controls
      </div>
      <p className="text-[11px] text-white/60">
        No vote snapshot was saved, so this tally uses live voting power.
      </p>
      <button
        type="button"
        onClick={handleWrite}
        disabled={submitting}
        className="px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black disabled:from-gray-600 disabled:to-gray-700 disabled:text-white/60 disabled:cursor-not-allowed"
      >
        {submitting ? 'Writing...' : 'Write vote snapshot'}
      </button>
    </div>
  )
}
