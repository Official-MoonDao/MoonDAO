import { BugAntIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { buildBugReportHref, formatBugReportEnvironment } from '@/lib/github/bugReport'

type ReportBugButtonProps = {
  className?: string
}

export default function ReportBugButton({ className = '' }: ReportBugButtonProps) {
  const router = useRouter()
  const chain = process.env.NEXT_PUBLIC_CHAIN || 'unknown'
  const asPath = router.asPath || '/'

  const [href, setHref] = useState(() =>
    buildBugReportHref({
      pageUrl: asPath,
      environment: formatBugReportEnvironment({ chain }),
    })
  )

  useEffect(() => {
    setHref(
      buildBugReportHref({
        pageUrl: window.location.href,
        environment: formatBugReportEnvironment({
          chain,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          userAgent: navigator.userAgent,
        }),
      })
    )
  }, [asPath, chain])

  return (
    <Link
      id="report-bug-button"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Report a bug on GitHub"
      className={`inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:border-white/40 hover:bg-white/10 transition-all duration-300 ${className}`}
    >
      <BugAntIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Report a Bug</span>
    </Link>
  )
}
