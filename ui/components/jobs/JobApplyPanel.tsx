import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatDeadlineCountdown, formatPostedAt } from '@/lib/jobs/jobMetadata'
import useCurrUnixTime from '@/lib/utils/hooks/useCurrUnixTime'
import ShareButtons from '@/components/layout/ShareButtons'

type JobApplyPanelProps = {
  applyUrl?: string
  deadline?: number
  postedAt?: number
  teamName?: string
  teamHref?: string
  shareUrl: string
  shareText: string
  otherRolesCount?: number
}

export default function JobApplyPanel({
  applyUrl,
  deadline,
  postedAt,
  teamName,
  teamHref,
  shareUrl,
  shareText,
  otherRolesCount,
}: JobApplyPanelProps) {
  const currTime = useCurrUnixTime(60000)

  // The page is served from an ISR cache, so anything relative to "now" would
  // disagree with the pre-rendered HTML on hydration.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const countdown = mounted ? formatDeadlineCountdown(deadline, currTime) : null
  const isClosed = countdown === 'Closed'

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-700/30 to-slate-800/40 backdrop-blur-xl p-5 flex flex-col gap-4">
      <div>
        <p className="font-GoodTimes text-white text-lg leading-tight">Apply for this role</p>
        {countdown && (
          <p className={`text-sm mt-1 ${isClosed ? 'text-red-400' : 'text-blue-300'}`}>
            {countdown}
          </p>
        )}
        {mounted && postedAt ? (
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

      <ShareButtons url={shareUrl} text={shareText} />

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
