import Link from 'next/link'
import type { ReactNode } from 'react'
import useSWR from 'swr'
import type { ActivitySummary, SectionKind } from '@/lib/activity-summary/prompt'

const SECTION_LABELS: Record<SectionKind, string> = {
  governance: 'Governance',
  events: 'Events',
  townhall: 'Town Hall',
  citizens: 'New Citizens',
  teams: 'New Teams',
  jobs: 'Jobs',
  marketplace: 'Marketplace',
}

// Used when a section features a spotlight because nothing new happened in
// its category this week.
const SPOTLIGHT_LABELS: Partial<Record<SectionKind, string>> = {
  governance: 'Project Spotlight',
  citizens: 'Citizen Spotlight',
  teams: 'Team Spotlight',
  jobs: 'Job Spotlight',
  marketplace: 'Marketplace Spotlight',
}

async function fetchSummary(url: string): Promise<ActivitySummary> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Activity summary request failed: ${res.status}`)
  return res.json()
}

function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function SummarySkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-hidden="true">
      <div className="h-5 bg-white/10 rounded w-3/4" />
      <div className="h-4 bg-white/5 rounded w-full" />
      <div className="h-4 bg-white/5 rounded w-5/6" />
      <div className="h-4 bg-white/5 rounded w-2/3" />
    </div>
  )
}

// "This week in MoonDAO" dashboard section. Renders nothing when the summary
// can't be loaded, so the section is omitted rather than shown broken.
export default function ActivitySummaryCard({ header }: { header: ReactNode }) {
  const { data, error, isLoading } = useSWR('/api/activity-summary', fetchSummary, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  if (error || (!isLoading && !data)) return null

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 mt-6">
      {header}
      {data ? <SummaryBody data={data} /> : <SummarySkeleton />}
    </div>
  )
}

function SummaryBody({ data }: { data: ActivitySummary }) {
  return (
    <div>
      <p className="text-white text-base sm:text-lg font-semibold leading-snug">{data.headline}</p>
      <ul className="mt-4 space-y-4">
        {data.sections.map((section) => (
          <li key={section.kind}>
            <p className="text-[11px] uppercase tracking-wide text-white/45 font-semibold">
              {(section.spotlight && SPOTLIGHT_LABELS[section.kind]) || SECTION_LABELS[section.kind]}
            </p>
            <p className="text-sm text-white/80 leading-relaxed mt-1">{section.summary}</p>
            {section.links.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {section.links.map((link) =>
                  link.href.startsWith('http') ? (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/75 transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/75 transition-colors"
                    >
                      {link.label}
                    </Link>
                  )
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[11px] text-white/35">
        AI-generated from on-chain and community data, {formatDay(data.periodStart)} to{' '}
        {formatDay(data.periodEnd)}. May contain mistakes.
      </p>
    </div>
  )
}
