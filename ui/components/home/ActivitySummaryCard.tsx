import {
  BriefcaseIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  PlayCircleIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
  UserGroupIcon,
  UserCircleIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import useSWR from 'swr'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import { ACTIVITY_SUMMARY_VERSION } from '@/lib/activity-summary/prompt'
import type {
  ActivitySummary,
  ActivitySummarySection,
  SectionKind,
  SummaryLink,
} from '@/lib/activity-summary/prompt'

const SECTION_STYLES: Record<
  SectionKind,
  { label: string; spotlightLabel?: string; icon: typeof SparklesIcon; gradient: string; text: string }
> = {
  governance: {
    label: 'Governance',
    spotlightLabel: 'Project Spotlight',
    icon: CheckBadgeIcon,
    gradient: 'from-emerald-500 to-green-600',
    text: 'text-emerald-300',
  },
  events: {
    label: 'Upcoming',
    icon: CalendarDaysIcon,
    gradient: 'from-pink-500 to-rose-600',
    text: 'text-pink-300',
  },
  townhall: {
    label: 'Town Hall',
    icon: PlayCircleIcon,
    gradient: 'from-blue-600 to-indigo-600',
    text: 'text-blue-300',
  },
  citizens: {
    label: 'New Citizens',
    icon: UserPlusIcon,
    gradient: 'from-green-500 to-teal-600',
    text: 'text-teal-300',
  },
  citizenSpotlight: {
    label: 'Citizen Spotlight',
    spotlightLabel: 'Citizen Spotlight',
    icon: UserCircleIcon,
    gradient: 'from-sky-500 to-indigo-600',
    text: 'text-sky-300',
  },
  teams: {
    label: 'New Teams',
    spotlightLabel: 'Team Spotlight',
    icon: UserGroupIcon,
    gradient: 'from-purple-500 to-indigo-600',
    text: 'text-purple-300',
  },
  jobs: {
    label: 'Jobs',
    spotlightLabel: 'Job Spotlight',
    icon: BriefcaseIcon,
    gradient: 'from-blue-500 to-cyan-600',
    text: 'text-cyan-300',
  },
  marketplace: {
    label: 'Marketplace',
    spotlightLabel: 'Marketplace Spotlight',
    icon: TagIcon,
    gradient: 'from-orange-500 to-amber-600',
    text: 'text-amber-300',
  },
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

function formatEventTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function SummarySkeleton() {
  return (
    <div className="animate-pulse space-y-2.5" aria-hidden="true">
      <div className="h-4 bg-white/10 rounded w-3/4" />
      <div className="h-3 bg-white/5 rounded w-full" />
      <div className="h-3 bg-white/5 rounded w-5/6" />
    </div>
  )
}

function LinkTarget({
  link,
  className,
  children,
}: {
  link: SummaryLink
  className: string
  children: ReactNode
}) {
  if (link.href.startsWith('http')) {
    return (
      <a href={link.href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link href={link.href} className={className}>
      {children}
    </Link>
  )
}

function LinkChip({ link, gradient }: { link: SummaryLink; gradient: string }) {
  if (link.more) {
    return (
      <LinkTarget
        link={link}
        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs text-white/60 hover:text-white bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 hover:border-white/20 transition-colors"
      >
        {link.label}
      </LinkTarget>
    )
  }
  const isEvent = Boolean(link.startAt)
  const detail = isEvent
    ? [formatEventTime(link.startAt!), link.detail].filter(Boolean).join(' · ')
    : link.detail

  return (
    <LinkTarget
      link={link}
      className="group inline-flex items-center gap-2 max-w-full pl-1 pr-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 hover:border-white/20 transition-colors"
    >
      <span
        className={`${isEvent ? 'w-9 h-6 rounded-md' : 'w-6 h-6 rounded-full'} flex-shrink-0 overflow-hidden bg-gradient-to-br ${gradient} flex items-center justify-center`}
      >
        {link.image ? (
          <Image
            src={getIPFSGateway(link.image)}
            alt=""
            width={isEvent ? 36 : 24}
            height={24}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <span className="text-white text-[10px] font-bold">
            {link.label?.[0]?.toUpperCase() ?? '?'}
          </span>
        )}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-xs text-white/85 group-hover:text-white truncate">
          {link.label}
        </span>
        {detail && <span className="block text-[10px] text-white/40 truncate">{detail}</span>}
      </span>
    </LinkTarget>
  )
}

function SectionRow({ section }: { section: ActivitySummarySection }) {
  const style = SECTION_STYLES[section.kind]
  const Icon = style.icon
  const label = (section.spotlight && style.spotlightLabel) || style.label
  // The governance section links once to the vote page; show it as a button.
  const voteLink =
    section.kind === 'governance' && !section.spotlight && section.links[0]?.href === '/projects'
      ? section.links[0]
      : null

  return (
    <li className="flex gap-3">
      <span
        className={`w-7 h-7 mt-0.5 rounded-lg bg-gradient-to-br ${style.gradient} flex items-center justify-center flex-shrink-0 shadow-lg shadow-black/20`}
      >
        <Icon className="w-4 h-4 text-white" />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${style.text}`}
        >
          {section.spotlight && <StarIcon className="w-3 h-3" />}
          {label}
        </p>
        <p className="text-sm text-white/75 leading-snug mt-0.5">{section.summary}</p>
        {voteLink ? (
          <Link
            href={voteLink.href}
            className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-400/30 transition-colors"
          >
            {voteLink.label} →
          </Link>
        ) : (
          section.links.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {section.links.map((link) => (
                <LinkChip key={link.href} link={link} gradient={style.gradient} />
              ))}
            </div>
          )
        )}
      </div>
    </li>
  )
}

/**
 * Compact AI summary of the past week, shown at the top of the dashboard's
 * Recent Activity panel: just the sections, since the panel's own header
 * already says what this is. Renders nothing when the summary can't be
 * loaded, so the activity feed below simply moves up.
 */
export default function ActivitySummaryCard() {
  const { data, error, isLoading } = useSWR(
    `/api/activity-summary?v=${ACTIVITY_SUMMARY_VERSION}`,
    fetchSummary,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  )

  if (error || (!isLoading && !data)) return null

  // Every section is shown: the panel scrolls, so the summary reads as the
  // top news and the activity feed continues below it.
  return (
    <div className="mb-3 rounded-xl border border-purple-400/15 bg-gradient-to-br from-indigo-500/[0.10] via-purple-500/[0.04] to-transparent px-3.5 py-3">
      {!data ? (
        <SummarySkeleton />
      ) : (
        <>
          <ul className="space-y-3">
            {data.sections.map((section) => (
              <SectionRow key={section.kind} section={section} />
            ))}
          </ul>
          <p className="flex items-center gap-1 mt-2.5 text-[10px] text-white/30">
            <SparklesIcon className="w-3 h-3" />
            AI summary, {formatDay(data.periodStart)} – {formatDay(data.periodEnd)} · may contain
            mistakes
          </p>
        </>
      )}
    </div>
  )
}
