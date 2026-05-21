'use client'

import {
  BriefcaseIcon,
  DocumentTextIcon,
  NewspaperIcon,
  RocketLaunchIcon,
  TagIcon,
  UserPlusIcon,
  UserGroupIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import { useNewsletters } from '@/lib/home/useHomeData'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ActivityItemType =
  | 'citizen'
  | 'team'
  | 'job'
  | 'listing'
  | 'newsletter'
  | 'contribution'
  | 'donation'
  | 'proposal'
  | 'vote'

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
    case 'donation': return 'Mission Donation'
    case 'proposal': return 'New Proposal'
    case 'vote': return 'Vote Open'
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
    case 'donation': return <RocketLaunchIcon className={cls} />
    case 'proposal': return <DocumentTextIcon className={cls} />
    case 'vote': return <DocumentTextIcon className={cls} />
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
    case 'donation': return 'from-indigo-500 to-blue-600'
    case 'proposal': return 'from-purple-500 to-indigo-600'
    case 'vote': return 'from-green-500 to-emerald-600'
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface RecentActivityProps {
  newestCitizens?: any[]
  newestJobs?: any[]
  newestListings?: any[]
  newestTeams?: any[]
  missions?: any[]
  proposals?: any[]
  maxItems?: number
}

export default function RecentActivity({
  newestCitizens = [],
  newestJobs = [],
  newestListings = [],
  newestTeams = [],
  missions = [],
  proposals = [],
  maxItems = 8,
}: RecentActivityProps) {
  const { newsletters, isLoading: newslettersLoading } = useNewsletters()
  const [contributions, setContributions] = useState<any[]>([])
  const [contribLoading, setContribLoading] = useState(true)
  const [donations, setDonations] = useState<any[]>([])
  const [missionImages, setMissionImages] = useState<Record<string, string>>({})
  const [contribCitizenImages, setContribCitizenImages] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/contributions/feed')
      .then((r) => r.ok ? r.json() : { contributions: [] })
      .then((data) => {
        const contribs = data.contributions ?? []
        setContributions(contribs)
        // Fetch citizen images for all unique contributor wallet addresses
        const addresses = [...new Set<string>(
          contribs
            .map((c: any) => c.walletAddress?.trim().toLowerCase())
            .filter(Boolean)
        )]
        if (addresses.length > 0) {
          fetch(`/api/citizens/images-by-address?addresses=${addresses.join(',')}`)
            .then((r) => r.ok ? r.json() : {})
            .then((map) => setContribCitizenImages(map))
            .catch(() => {})
        }
      })
      .catch(() => setContributions([]))
      .finally(() => setContribLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/mission/recent-donations')
      .then((r) => r.ok ? r.json() : { donations: [] })
      .then((data) => {
        const d = data.donations ?? []
        setDonations(d)
        // Fetch mission metadata images for each unique missionId
        const ids = [...new Set<string>(d.map((x: any) => x.missionId).filter(Boolean))]
        if (ids.length > 0) {
          Promise.all(
            ids.map((id) =>
              fetch(`/api/mission/${id}`)
                .then((r) => r.ok ? r.json() : null)
                .then((m) => {
                  const img = m?.metadata?.logoUri || m?.metadata?.image || m?.logoUri || m?.image
                  return img ? [id, img] : null
                })
                .catch(() => null)
            )
          ).then((results) => {
            const map: Record<string, string> = {}
            for (const r of results) { if (r) map[r[0]] = r[1] }
            setMissionImages(map)
          })
        }
      })
      .catch(() => setDonations([]))
  }, [])

  const items = useMemo<ActivityItem[]>(() => {
    const list: ActivityItem[] = []
    // Cap each source to avoid unbounded sort as data grows
    const MAX_PER_SOURCE = 50

    // Newsletters
    for (const n of (newsletters ?? []).slice(0, MAX_PER_SOURCE)) {
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

    // Launchpad donations
    for (const d of donations.slice(0, MAX_PER_SOURCE)) {
      const mission = missions.find((m: any) => String(m.projectId) === String(d.projectId))
      const missionName = mission?.metadata?.name || d.missionName || `Mission #${d.missionId || d.projectId}`
      const ethAmt = Number(d.amountWei) / 1e18
      const ethLabel = ethAmt >= 1 ? ethAmt.toFixed(3) : ethAmt.toFixed(5)
      const shortAddr = d.from ? `${d.from.slice(0, 6)}…${d.from.slice(-4)}` : 'Someone'
      const rawImg = mission?.metadata?.logoUri || mission?.metadata?.image ||
        (d.missionId ? missionImages[d.missionId] : undefined)
      list.push({
        id: `donation-${d.projectId}-${d.timestamp}-${d.from}`,
        type: 'donation',
        title: missionName,
        subtitle: `${shortAddr} contributed ${ethLabel} ETH`,
        image: rawImg ? getIPFSGateway(rawImg) : undefined,
        link: d.missionId ? `/mission/${d.missionId}` : '/launch',
        timestamp: d.timestamp,
      })
    }

    // Proposals are shown in the dedicated Proposals section (ROW 2), not here

    // Build name → citizen image lookup (case-insensitive) from the already-fetched list
    const nameToCitizenImage: Record<string, string> = {}
    for (const c of newestCitizens.slice(0, MAX_PER_SOURCE)) {
      const citizenName = (c.name || c.metadata?.name || '').trim().toLowerCase()
      const img = c.image || c.metadata?.image
      if (citizenName && img) nameToCitizenImage[citizenName] = getIPFSGateway(img)
    }

    // Contributions
    for (const c of contributions.slice(0, MAX_PER_SOURCE)) {
      const ts = c.timestamp ? new Date(c.timestamp).getTime() : undefined
      const walletKey = c.walletAddress?.trim().toLowerCase()
      const citizenImage =
        (walletKey && contribCitizenImages[walletKey])
          ? getIPFSGateway(contribCitizenImages[walletKey])
          : (c.name ? nameToCitizenImage[c.name.trim().toLowerCase()] : undefined)
      list.push({
        id: `contribution-${c.walletAddress}-${c.timestamp}`,
        type: 'contribution',
        title: c.name || 'Anonymous',
        subtitle: c.description,
        image: citizenImage,
        link: `/contributions#contribution-${encodeURIComponent(c.name || 'Anonymous')}`,
        timestamp: ts && !isNaN(ts) ? ts : undefined,
      })
    }

    // Citizens — only include if we have a real mint timestamp
    for (const c of newestCitizens.slice(0, MAX_PER_SOURCE)) {
      if (!c.mintTimestamp) continue
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
        timestamp: c.mintTimestamp * 1000,
      })
    }

    // Teams — only include if we have a real mint timestamp
    for (const t of newestTeams.slice(0, MAX_PER_SOURCE)) {
      if (!t.mintTimestamp) continue
      const teamDesc = t.description || t.metadata?.description
      list.push({
        id: `team-${t.id}`,
        type: 'team',
        title: t.name || t.metadata?.name || `Team #${t.id}`,
        subtitle: teamDesc && typeof teamDesc === 'string' ? teamDesc : undefined,
        image: t.image || t.metadata?.image,
        link: `/team/${t.id}`,
        timestamp: t.mintTimestamp * 1000,
      })
    }

    // Jobs
    for (const j of newestJobs.slice(0, MAX_PER_SOURCE)) {
      list.push({
        id: `job-${j.id}`,
        type: 'job',
        title: j.title || 'Open Position',
        subtitle: j.description && typeof j.description === 'string' ? j.description : undefined,
        link: j.contactInfo || '/jobs',
        timestamp: j.timestamp ? Number(j.timestamp) * 1000 : undefined,
      })
    }

    // Listings
    for (const l of newestListings.slice(0, MAX_PER_SOURCE)) {
      list.push({
        id: `listing-${l.id}`,
        type: 'listing',
        title: l.name || l.title || `Listing #${l.id}`,
        subtitle: l.description && typeof l.description === 'string' ? l.description : undefined,
        image: l.image,
        link: `/marketplace/${l.id}`,
        timestamp: l.timestamp ? Number(l.timestamp) * 1000 : undefined,
      })
    }

    // Sort everything: timestamped items newest-first, then untimstamped
    const withTs = list.filter((x) => x.timestamp != null).sort((a, b) => b.timestamp! - a.timestamp!)
    const withoutTs = list.filter((x) => x.timestamp == null)

    return [...withTs, ...withoutTs].slice(0, maxItems)
  }, [newsletters, contributions, contribCitizenImages, donations, missionImages, missions, proposals, newestCitizens, newestTeams, newestJobs, newestListings, maxItems])


  const isLoading = newslettersLoading || contribLoading

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
            src={getIPFSGateway(item.image)}
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
