'use client'

import {
  BriefcaseIcon,
  NewspaperIcon,
  TagIcon,
  UserPlusIcon,
  UserGroupIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useNewsletters } from '@/lib/home/useHomeData'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ActivityItemType =
  | 'citizen'
  | 'team'
  | 'job'
  | 'listing'
  | 'newsletter'
  | 'contribution'

export interface ActivityItem {
  id: string
  type: ActivityItemType
  title: string
  subtitle?: string
  image?: string
  link?: string
  /** Unix milliseconds; undefined = unknown (shown as "Recently") */
  timestamp?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function typeLabel(type: ActivityItemType): string {
  switch (type) {
    case 'citizen': return 'New Citizen'
    case 'team': return 'New Team'
    case 'job': return 'Job Posted'
    case 'listing': return 'Marketplace'
    case 'newsletter': return 'Newsletter'
    case 'contribution': return 'Contribution'
  }
}

function TypeIcon({ type, className }: { type: ActivityItemType; className?: string }) {
  const cls = className ?? 'w-5 h-5'
  switch (type) {
    case 'citizen': return <UserPlusIcon className={cls} />
    case 'team': return <UserGroupIcon className={cls} />
    case 'job': return <BriefcaseIcon className={cls} />
    case 'listing': return <TagIcon className={cls} />
    case 'newsletter': return <NewspaperIcon className={cls} />
    case 'contribution': return <TagIcon className={cls} />
  }
}

const CONTRIB_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-teal-500 to-cyan-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-yellow-600',
  'from-emerald-500 to-green-600',
  'from-sky-500 to-blue-600',
  'from-fuchsia-500 to-violet-600',
]

function contribGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return CONTRIB_GRADIENTS[hash % CONTRIB_GRADIENTS.length]
}

function typeBg(type: ActivityItemType, title?: string): string {
  switch (type) {
    case 'citizen': return 'from-green-500 to-teal-600'
    case 'team': return 'from-purple-500 to-indigo-600'
    case 'job': return 'from-blue-500 to-cyan-600'
    case 'listing': return 'from-orange-500 to-amber-600'
    case 'newsletter': return 'from-blue-600 to-blue-700'
    case 'contribution': return contribGradient(title ?? '')
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface RecentActivityProps {
  newestCitizens?: any[]
  newestJobs?: any[]
  newestListings?: any[]
  newestTeams?: any[]
  maxItems?: number
}

export default function RecentActivity({
  newestCitizens = [],
  newestJobs = [],
  newestListings = [],
  newestTeams = [],
  maxItems = 8,
}: RecentActivityProps) {
  const { newsletters, isLoading: newslettersLoading } = useNewsletters()
  const [contributions, setContributions] = useState<any[]>([])
  const [contribLoading, setContribLoading] = useState(true)

  useEffect(() => {
    fetch('/api/contributions/feed')
      .then((r) => r.ok ? r.json() : { contributions: [] })
      .then((data) => setContributions(data.contributions ?? []))
      .catch(() => setContributions([]))
      .finally(() => setContribLoading(false))
  }, [])

  const items = useMemo<ActivityItem[]>(() => {
    const list: ActivityItem[] = []

    // Newsletters (have publishedAt)
    for (const n of (newsletters ?? []).slice(0, 5)) {
      list.push({
        id: `newsletter-${n.id}`,
        type: 'newsletter',
        title: n.title || 'Newsletter Update',
        subtitle: n.description,
        image: n.image,
        link: n.url && n.url.includes('http') && !n.url.endsWith('/posts') ? n.url : 'https://news.moondao.com/posts',
        timestamp: n.publishedAt ? new Date(n.publishedAt).getTime() : undefined,
      })
    }

    // Contributions (have timestamp string like "2/19/2025 10:30:00")
    for (const c of contributions.slice(0, 8)) {
      const ts = c.timestamp ? new Date(c.timestamp).getTime() : undefined
      list.push({
        id: `contribution-${c.walletAddress}-${c.timestamp}`,
        type: 'contribution',
        title: c.name || 'Anonymous',
        subtitle: c.description,
        link: `/contributions#contribution-${encodeURIComponent(c.name || 'Anonymous')}`,
        timestamp: ts && !isNaN(ts) ? ts : undefined,
      })
    }

    // Citizens (no timestamp — use position)
    for (let i = 0; i < Math.min(newestCitizens.length, 5); i++) {
      const c = newestCitizens[i]
      const rawLoc = c.location ?? c.metadata?.attributes?.find((a: any) => a.trait_type === 'location')?.value
      let locationStr: string | undefined
      if (rawLoc && typeof rawLoc === 'object' && rawLoc.name) {
        locationStr = String(rawLoc.name)
      } else if (typeof rawLoc === 'string') {
        try {
          const parsed = JSON.parse(rawLoc)
          locationStr = parsed?.name ? String(parsed.name) : rawLoc
        } catch {
          locationStr = rawLoc
        }
      }
      list.push({
        id: `citizen-${c.id}`,
        type: 'citizen',
        title: c.name || c.metadata?.name || `Citizen #${c.id}`,
        subtitle: locationStr,
        image: c.image || c.metadata?.image,
        link: `/citizen/${c.id}`,
        timestamp: undefined,
      })
    }

    // Teams (no timestamp)
    for (let i = 0; i < Math.min(newestTeams.length, 3); i++) {
      const t = newestTeams[i]
      const teamDesc = t.description || t.metadata?.description
      list.push({
        id: `team-${t.id}`,
        type: 'team',
        title: t.name || t.metadata?.name || `Team #${t.id}`,
        subtitle: teamDesc && typeof teamDesc === 'string' ? teamDesc : undefined,
        image: t.image || t.metadata?.image,
        link: `/team/${t.id}`,
        timestamp: undefined,
      })
    }

    // Jobs (no timestamp)
    for (let i = 0; i < Math.min(newestJobs.length, 4); i++) {
      const j = newestJobs[i]
      list.push({
        id: `job-${j.id}`,
        type: 'job',
        title: j.title || 'Open Position',
        subtitle: j.description && typeof j.description === 'string' ? j.description : undefined,
        link: j.contactInfo || '/jobs',
        timestamp: undefined,
      })
    }

    // Listings (no timestamp)
    for (let i = 0; i < Math.min(newestListings.length, 3); i++) {
      const l = newestListings[i]
      list.push({
        id: `listing-${l.id}`,
        type: 'listing',
        title: l.name || l.title || `Listing #${l.id}`,
        subtitle: l.description && typeof l.description === 'string' ? l.description : undefined,
        image: l.image,
        link: `/marketplace/${l.id}`,
        timestamp: undefined,
      })
    }

    // Sort: items with timestamps first (newest first), then the rest
    const withTs = list.filter((x) => x.timestamp != null).sort((a, b) => b.timestamp! - a.timestamp!)
    const withoutTs = list.filter((x) => x.timestamp == null)

    return [...withTs, ...withoutTs].slice(0, maxItems)
  }, [newsletters, contributions, newestCitizens, newestTeams, newestJobs, newestListings, maxItems])

  const isLoading = newslettersLoading && contribLoading

  return (
    <div className="space-y-2">
      {isLoading && items.length === 0 ? (
        <div className="text-center py-10 text-white/50 text-sm">Loading activity…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-white/50 text-sm">No recent activity yet.</div>
      ) : (
        items.map((item) => <ActivityRow key={item.id} item={item} />)
      )}
    </div>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function ActivityRow({ item }: { item: ActivityItem }) {
  const inner = (
    <div className="flex items-center gap-3 group">
      {/* Avatar / icon */}
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${typeBg(item.type, item.title)} flex items-center justify-center flex-shrink-0 overflow-hidden`}>
        {item.image ? (
          <Image
            src={item.image}
            alt={item.title}
            width={40}
            height={40}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : item.type === 'contribution' ? (
          <span className="text-white font-bold text-sm">{item.title?.[0]?.toUpperCase() ?? '?'}</span>
        ) : (
          <TypeIcon type={item.type} className="w-5 h-5 text-white" />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            {typeLabel(item.type)}
          </span>
        </div>
        <p className="text-white text-sm font-medium truncate leading-tight">{item.title}</p>
        {item.subtitle && (
          <p className="text-white/40 text-xs truncate mt-0.5 leading-tight">{item.subtitle}</p>
        )}
      </div>

      {/* Timestamp + external link icon */}
      <div className="flex items-center gap-1.5 flex-shrink-0 text-right">
        <span className="text-white/30 text-xs">
          {item.timestamp ? relativeTime(item.timestamp) : 'Recently'}
        </span>
        {item.link && (
          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 text-white/20 group-hover:text-white/60 transition-colors" />
        )}
      </div>
    </div>
  )

  const cls =
    'block px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5'

  if (!item.link) return <div className={cls}>{inner}</div>

  const isExternal = item.link.startsWith('http')
  if (isExternal) {
    return (
      <a href={item.link} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    )
  }
  return (
    <Link href={item.link} className={cls}>
      {inner}
    </Link>
  )
}
