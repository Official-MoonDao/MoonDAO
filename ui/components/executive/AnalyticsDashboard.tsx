import {
  ArrowPathIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  CursorArrowRaysIcon,
  DocumentTextIcon,
  SignalIcon,
  UserPlusIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AnalyticsReport, RangeKey } from '@/lib/analytics/ga4DataApi'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'

type ApiResponse =
  | { configured: false; missing: string[] }
  | { configured: true; report: AnalyticsReport }

const PANEL = 'bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 shadow-xl'

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '28d', label: '28 days' },
  { key: '90d', label: '90 days' },
]

const num = (n: number) => Math.round(n).toLocaleString('en-US')
const compact = (n: number) =>
  n >= 10_000 ? Intl.NumberFormat('en-US', { notation: 'compact' }).format(n) : num(n)
const pct = (n: number) => `${(n * 100).toFixed(1)}%`
const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const duration = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
const shortDate = (yyyymmdd: string) =>
  new Date(
    Number(yyyymmdd.slice(0, 4)),
    Number(yyyymmdd.slice(4, 6)) - 1,
    Number(yyyymmdd.slice(6, 8))
  ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function change(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0
  return (current - previous) / previous
}

function ChangeBadge({
  value,
  lowerIsBetter = false,
}: {
  value: number | null
  lowerIsBetter?: boolean
}) {
  if (value === null) return <span className="text-xs text-slate-400">new</span>
  const up = value >= 0
  const good = up !== lowerIsBetter
  const Icon = up ? ArrowTrendingUpIcon : ArrowTrendingDownIcon
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        Math.abs(value) < 0.005 ? 'text-slate-400' : good ? 'text-emerald-400' : 'text-rose-400'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {up ? '+' : ''}
      {(value * 100).toFixed(0)}%
    </span>
  )
}

function Kpi({
  icon,
  label,
  value,
  delta,
  help,
}: {
  icon: React.ReactNode
  label: string
  value: string
  delta: number | null
  help: string
}) {
  return (
    <div className={`${PANEL} !p-5`}>
      <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wide">
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        <ChangeBadge value={delta} />
      </div>
      <p className="mt-2 text-3xl font-GoodTimes text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{help}</p>
    </div>
  )
}

function BarList({
  title,
  subtitle,
  rows,
  valueLabel,
  format = num,
}: {
  title: string
  subtitle?: string
  rows: { name: string; value: number; note?: string }[]
  valueLabel: string
  format?: (n: number) => string
}) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  const total = rows.reduce((sum, r) => sum + r.value, 0) || 1
  return (
    <div className={PANEL}>
      <h3 className="text-white font-semibold">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      <div className="mt-4 flex justify-between text-[11px] uppercase tracking-wide text-slate-500">
        <span>&nbsp;</span>
        <span>{valueLabel}</span>
      </div>
      {rows.length === 0 && <p className="mt-2 text-sm text-slate-500">No data for this period.</p>}
      <ul className="mt-1 space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex justify-between gap-3 text-sm">
              <span className="truncate text-slate-200" title={r.name}>
                {r.name || '(not set)'}
              </span>
              <span className="shrink-0 text-slate-300 tabular-nums">
                {format(r.value)}
                <span className="ml-2 text-slate-500 text-xs">{pct(r.value / total)}</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </div>
            {r.note && <p className="mt-0.5 text-[11px] text-slate-500">{r.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Funnel({ report }: { report: AnalyticsReport }) {
  const byName = Object.fromEntries(report.events.map((e) => [e.name, e]))
  const steps = [
    { label: 'Clicked a Join button', users: byName.join_cta_click?.users ?? 0 },
    { label: 'Started checkout', users: byName.begin_checkout?.users ?? 0 },
    { label: 'Completed purchase', users: byName.purchase?.users ?? 0 },
  ]
  // A later step can outnumber the one before it (checkout can start
  // without the tracked Join click), so scale to the largest step.
  const scale = Math.max(...steps.map((step) => step.users), 1)
  return (
    <div className={PANEL}>
      <h3 className="text-white font-semibold">Join funnel</h3>
      <p className="text-xs text-slate-400 mt-0.5">
        Unique people at each step of becoming a Citizen or Team. The percentage shows how many made
        it from the previous step.
      </p>
      <div className="mt-5 space-y-4">
        {steps.map((step, i) => {
          const prev = i === 0 ? null : steps[i - 1].users
          return (
            <div key={step.label}>
              <div className="flex justify-between text-sm">
                <span className="text-slate-200">
                  {i + 1}. {step.label}
                </span>
                <span className="text-white tabular-nums">
                  {num(step.users)}
                  {prev !== null && (
                    <span className="ml-2 text-xs text-slate-400">
                      {prev ? pct(step.users / prev) : '—'} of previous step
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                  style={{ width: `${(step.users / scale) * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      {report.summary.current.totalRevenue > 0 && (
        <p className="mt-4 text-sm text-slate-300">
          Revenue reported to Google Analytics:{' '}
          <span className="text-white font-semibold">
            {usd(report.summary.current.totalRevenue)}
          </span>
        </p>
      )}
    </div>
  )
}

function buildInsights(report: AnalyticsReport): string[] {
  const { current, previous } = report.summary
  const period = `the previous ${report.days} days`
  const lines: string[] = []

  const userChange = change(current.activeUsers, previous.activeUsers)
  if (userChange !== null) {
    lines.push(
      `${num(current.activeUsers)} people visited, ${
        Math.abs(userChange) < 0.005
          ? 'about the same as'
          : `${Math.abs(userChange * 100).toFixed(0)}% ${userChange > 0 ? 'more' : 'fewer'} than`
      } ${period}.`
    )
  }
  if (current.activeUsers > 0) {
    lines.push(`${pct(current.newUsers / current.activeUsers)} of visitors were new to the site.`)
  }

  const channelTotal = report.channels.reduce((s, c) => s + c.sessions, 0)
  const topChannel = report.channels[0]
  if (topChannel && channelTotal) {
    lines.push(
      `Most visits came from ${topChannel.name} (${pct(
        topChannel.sessions / channelTotal
      )} of sessions).`
    )
  }

  const topPage = report.pages[0]
  if (topPage) {
    const page = topPage.path === '/' ? 'the homepage' : topPage.path
    lines.push(`The most viewed page was ${page} with ${num(topPage.views)} views.`)
  }

  const purchases = report.events.find((e) => e.name === 'purchase')
  const joins = report.events.find((e) => e.name === 'join_cta_click')
  if (purchases && joins && joins.users > 0) {
    lines.push(
      `${num(purchases.users)} people made a purchase, ${pct(
        purchases.users / joins.users
      )} of the ${num(joins.users)} who clicked Join.`
    )
  }

  const mobile = report.devices.find((d) => d.name === 'mobile')
  const deviceTotal = report.devices.reduce((s, d) => s + d.users, 0)
  if (mobile && deviceTotal)
    lines.push(`${pct(mobile.users / deviceTotal)} of visitors were on a phone.`)

  return lines
}

function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <div className="bg-amber-900/25 border border-amber-700/50 rounded-xl p-6 text-amber-100">
      <p className="font-semibold">Google Analytics isn&apos;t connected yet</p>
      <p className="mt-2 text-sm">
        Add these environment variables to the deployment, then redeploy:
      </p>
      <ul className="mt-2 list-disc list-inside text-sm font-mono">
        {missing.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  )
}

export default function AnalyticsDashboard() {
  const [range, setRange] = useState<RangeKey>('28d')
  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const fetchIdRef = useRef(0)

  const load = useCallback(async (selected: RangeKey, fresh = false) => {
    const fetchId = ++fetchIdRef.current
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/operator/analytics?range=${selected}${fresh ? '&fresh=1' : ''}`,
        { credentials: 'include' }
      )
      const json = await res.json()
      if (fetchId !== fetchIdRef.current) return
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)
      setData(json)
    } catch (err: any) {
      if (fetchId !== fetchIdRef.current) return
      setError(err?.message || 'Could not load analytics.')
    } finally {
      if (fetchId === fetchIdRef.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load(range)
    return () => {
      fetchIdRef.current += 1
    }
  }, [load, range])

  if (isLoading && !data) {
    return (
      <div className={`${PANEL} flex items-center justify-center gap-3 text-slate-300`}>
        <LoadingSpinner />
        <span className="text-sm">Loading Google Analytics…</span>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="bg-rose-900/20 border border-rose-700/50 rounded-xl p-6 text-rose-200">
        <p className="font-semibold">Could not load analytics</p>
        <p className="mt-1 text-sm">{error}</p>
        <button
          type="button"
          onClick={() => load(range)}
          className="mt-4 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null
  if (!data.configured) return <SetupNotice missing={data.missing} />

  const { report } = data
  const { current, previous } = report.summary
  const insights = buildInsights(report)
  const chartData = report.daily.map((d) => ({ ...d, label: shortDate(d.date) }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-white/5 p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                range === r.key ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Last {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-400">
          {report.realtimeActiveUsers !== null && (
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-white">{num(report.realtimeActiveUsers)}</span> on the site now
            </span>
          )}
          <button
            type="button"
            onClick={() => load(range, true)}
            disabled={isLoading}
            className="flex items-center gap-1.5 hover:text-white disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-900/20 border border-rose-700/50 rounded-xl p-4 text-rose-200 text-sm">
          Could not refresh: {error}
        </div>
      )}

      {insights.length > 0 && (
        <div className={PANEL}>
          <h3 className="text-white font-semibold">At a glance</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-200 list-disc list-inside">
            {insights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <Kpi
          icon={<UsersIcon className="w-4 h-4" />}
          label="Visitors"
          value={compact(current.activeUsers)}
          delta={change(current.activeUsers, previous.activeUsers)}
          help="Unique people who used the site"
        />
        <Kpi
          icon={<UserPlusIcon className="w-4 h-4" />}
          label="New visitors"
          value={compact(current.newUsers)}
          delta={change(current.newUsers, previous.newUsers)}
          help="First time on the site"
        />
        <Kpi
          icon={<SignalIcon className="w-4 h-4" />}
          label="Visits"
          value={compact(current.sessions)}
          delta={change(current.sessions, previous.sessions)}
          help="Sessions; one person can visit many times"
        />
        <Kpi
          icon={<DocumentTextIcon className="w-4 h-4" />}
          label="Page views"
          value={compact(current.screenPageViews)}
          delta={change(current.screenPageViews, previous.screenPageViews)}
          help={`${(current.screenPageViews / Math.max(current.sessions, 1)).toFixed(
            1
          )} pages per visit`}
        />
        <Kpi
          icon={<CursorArrowRaysIcon className="w-4 h-4" />}
          label="Engaged visits"
          value={pct(current.engagementRate)}
          delta={change(current.engagementRate, previous.engagementRate)}
          help="Stayed 10s+, viewed 2+ pages, or took an action"
        />
        <Kpi
          icon={<ClockIcon className="w-4 h-4" />}
          label="Avg. visit length"
          value={duration(current.averageSessionDuration)}
          delta={change(current.averageSessionDuration, previous.averageSessionDuration)}
          help="Average time per session"
        />
      </div>
      <p className="-mt-3 text-xs text-slate-500">
        Percent changes compare with the previous {report.days} days.
      </p>

      <div className={PANEL}>
        <h3 className="text-white font-semibold">Traffic over time</h3>
        <p className="text-xs text-slate-400 mt-0.5">Daily visitors and visits</p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gaUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gaSessions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={24} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="sessions"
                name="Visits"
                stroke="#14b8a6"
                fill="url(#gaSessions)"
              />
              <Area
                type="monotone"
                dataKey="users"
                name="Visitors"
                stroke="#6366f1"
                fill="url(#gaUsers)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Funnel report={report} />
        <div className={PANEL}>
          <h3 className="text-white font-semibold">Key actions</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Times each action happened, compared with the previous {report.days} days
          </p>
          <ul className="mt-4 divide-y divide-white/5">
            {report.events.map((e) => (
              <li key={e.name} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-200">{e.label}</p>
                  <p className="text-[11px] text-slate-500 truncate">{e.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white tabular-nums">{num(e.count)}</p>
                  <ChangeBadge
                    value={change(e.count, e.previousCount)}
                    lowerIsBetter={e.name === 'mint_error'}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarList
          title="How people find us"
          subtitle="Organic Search is Google, Direct is typed URLs or bookmarks, Referral is links from other sites"
          valueLabel="Visits"
          rows={report.channels.map((c) => ({
            name: c.name,
            value: c.sessions,
            note: `${pct(c.engagementRate)} engaged`,
          }))}
        />
        <BarList
          title="Top sources"
          subtitle="The specific site or campaign that sent each visit"
          valueLabel="Visits"
          rows={report.sources.map((s) => ({ name: s.name, value: s.sessions }))}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarList
          title="Most viewed pages"
          valueLabel="Views"
          rows={report.pages.map((p) => ({
            name: p.path,
            value: p.views,
            note: `${num(p.users)} visitors · ${duration(p.avgEngagementSec)} avg. time`,
          }))}
        />
        <BarList
          title="Where visits start"
          subtitle="The first page people land on"
          valueLabel="Visits"
          rows={report.landingPages.map((p) => ({
            name: p.path,
            value: p.sessions,
            note: `${pct(p.engagementRate)} engaged · ${num(p.keyEvents)} key actions`,
          }))}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarList
          title="Top countries"
          valueLabel="Visitors"
          rows={report.countries.map((c) => ({ name: c.name, value: c.users }))}
        />
        <BarList
          title="Devices"
          valueLabel="Visitors"
          rows={report.devices.map((d) => ({
            name: d.name.charAt(0).toUpperCase() + d.name.slice(1),
            value: d.users,
          }))}
        />
      </div>

      <p className="text-xs text-slate-500">
        Source: Google Analytics 4. Updated{' '}
        {new Date(report.generatedAt).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}
        ; cached for up to 10 minutes. Visitors who decline analytics cookies aren&apos;t counted.
      </p>
    </div>
  )
}
