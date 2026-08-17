import { ArrowTopRightOnSquareIcon, LinkIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatDeadlineCountdown, formatPostedAt } from '@/lib/jobs/jobMetadata'
import useCurrUnixTime from '@/lib/utils/hooks/useCurrUnixTime'

type JobApplyPanelProps = {
  title: string
  applyUrl?: string
  deadline?: number
  postedAt?: number
  teamName?: string
  teamHref?: string
  shareUrl: string
  shareText: string
  otherRolesCount?: number
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export default function JobApplyPanel({
  title,
  applyUrl,
  deadline,
  postedAt,
  teamName,
  teamHref,
  shareUrl,
  shareText,
  otherRolesCount,
}: JobApplyPanelProps) {
  const currTime = useCurrUnixTime()
  const countdown = formatDeadlineCountdown(deadline, currTime)
  const isClosed = countdown === 'Closed'

  const xShareHref = `https://x.com/intent/tweet?text=${encodeURIComponent(
    shareText
  )}&url=${encodeURIComponent(shareUrl)}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-700/30 to-slate-800/40 backdrop-blur-xl p-5 flex flex-col gap-4">
      <div>
        <p className="font-GoodTimes text-white text-lg leading-tight">Apply for this role</p>
        {countdown && (
          <p className={`text-sm mt-1 ${isClosed ? 'text-red-400' : 'text-blue-300'}`}>
            {countdown}
          </p>
        )}
        {postedAt ? (
          <p className="text-xs text-slate-400 mt-1">{formatPostedAt(postedAt, currTime)}</p>
        ) : null}
      </div>

      {applyUrl ? (
        <a
          id="job-apply-button"
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
        >
          Apply now
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </a>
      ) : (
        <p className="text-sm text-slate-400">
          No application link was provided for this role. Reach out to the team directly.
        </p>
      )}

      <div className="flex gap-2">
        <a
          href={xShareHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
        >
          <XIcon className="h-4 w-4" />
          Share
        </a>
        <button
          type="button"
          onClick={copyLink}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
        >
          <LinkIcon className="h-4 w-4" />
          Copy link
        </button>
      </div>

      {teamName && teamHref && (
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs uppercase tracking-wide text-slate-400">Posted by</p>
          <Link href={teamHref} className="text-sm text-blue-400 hover:text-blue-300">
            {teamName}
          </Link>
        </div>
      )}

      {otherRolesCount ? (
        <Link
          href="/jobs"
          className="text-sm text-blue-400 hover:text-blue-300"
        >{`See ${otherRolesCount} other open role${otherRolesCount === 1 ? '' : 's'} →`}</Link>
      ) : (
        <Link href="/jobs" className="text-sm text-blue-400 hover:text-blue-300">
          Browse the full jobs board →
        </Link>
      )}

      <p className="text-xs text-slate-500 leading-relaxed">
        Applications are handled by the posting team. MoonDAO Citizens get the full board plus early
        access to new roles.
      </p>
    </div>
  )
}
