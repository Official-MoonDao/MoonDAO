import {
  ArrowPathIcon,
  BanknotesIcon,
  ClockIcon,
  FireIcon,
  WalletIcon,
} from '@heroicons/react/24/outline'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AUMChart } from '@/components/dashboard/treasury/AUMChart'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'

type Stream = {
  label: string
  annualUSD: number
  txCount?: number
  available?: boolean
  cash?: boolean
  basis?: string
}

type UnattributedInflows = {
  totalUSD: number
  txCount: number
  topSources: { address: string; totalUSD: number; txCount: number }[]
  note: string
}

type Uncollected = {
  receivableUSD: number
  contingentUSD: number
  lines: {
    label: string
    kind: 'receivable' | 'contingent'
    eth: number
    usd: number
    raisedETH?: number
    raisedUSD?: number
    pledgedUSD?: number
    detail: string
    available: boolean
  }[]
  missionsConsidered: number
  note: string
}

type RunwayScenario = {
  label?: string
  assetsUSD: number
  netMonthlyBurnUSD: number
  months: number | null
  exhaustionDate: string | null
}

type AssetClass = {
  label: string
  amount: number | null
  unit: string | null
  usd: number
}

type Wallet = {
  name: string
  address: string
  chain: string
  usd: number
}

type FinancialSummary = {
  meta: {
    calculatedAt: string
    ethPriceUSD: number
    basis: string
    warnings: string[]
  }
  assets: {
    liquidUSD: number
    defiLpUSD: number
    breakdown: AssetClass[]
    wallets: Wallet[]
    history: { timestamp: number; value: number }[]
  }
  revenue: {
    annualUSD: number
    monthlyUSD: number
    isMeasured: boolean
    statedAnnualUSD: number
    coverageOfGrossBurn: number
    streams: Stream[]
    cashAnnualUSD?: number
    accruedAnnualUSD?: number
    unattributedInflows?: UnattributedInflows
    uncollected?: Uncollected | null
    excluded?: { label: string; reason: string }[]
    methodology?: string
  }
  burn: {
    ebCoreMonthlyUSD: number
    ebBonusMonthlyUSD: number
    projectsMonthlyUSD: number
    grossMonthlyUSD: number
    revenueMonthlyUSD: number
    netMonthlyUSD: number
    netMonthlyWithBonusesUSD: number
    annual: {
      grossUSD: number
      netUSD: number
      netWithBonusesUSD: number
    }
    ebCoreLines: { label: string; monthlyUSD: number; note?: string }[]
    ebBudgetSource: { mdp: number; title: string; termMonths: number }
    projectsBasis: {
      quarterlyBudgetUSD: number
      quarter: number
      year: number
      note: string
    }
  }
  runway: {
    primary: RunwayScenario
    scenarios: RunwayScenario[]
  }
}

function usd(value: number, opts: { decimals?: number } = {}) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts.decimals ?? 0,
    maximumFractionDigits: opts.decimals ?? 0,
  })
}

function months(value: number | null) {
  if (value === null) return 'Cash-flow positive'
  return `${value.toFixed(1)} months`
}

function shortAddr(address: string) {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function holdingLabel(row: AssetClass) {
  if (row.amount != null && row.unit) {
    return `${row.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${row.unit}`
  }
  return row.label
}

const PANEL = 'bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 shadow-xl'

const ASSET_BAR: Record<string, string> = {
  ETH: 'bg-indigo-400/80',
  BTC: 'bg-amber-400/80',
  Stablecoins: 'bg-emerald-400/80',
  POL: 'bg-violet-400/70',
}

function MetricTile({
  icon,
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone?: 'neutral' | 'positive' | 'caution' | 'critical'
}) {
  const toneClasses = {
    neutral: 'text-white',
    positive: 'text-emerald-300',
    caution: 'text-amber-300',
    critical: 'text-rose-300',
  }[tone]

  return (
    <div className={PANEL}>
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={`mt-3 text-3xl font-GoodTimes leading-tight ${toneClasses}`}>{value}</p>
      {sub && <p className="mt-2 text-xs text-slate-400 leading-relaxed">{sub}</p>}
    </div>
  )
}

function Row({
  label,
  value,
  note,
  share,
  barClass = 'bg-blue-400/70',
  emphasis = false,
  muted = false,
}: {
  label: string
  value: string
  note?: string
  share?: number
  barClass?: string
  emphasis?: boolean
  muted?: boolean
}) {
  return (
    <div className={emphasis ? 'pt-3 border-t border-slate-700' : ''}>
      <div className="flex justify-between items-baseline gap-3">
        <span className={emphasis ? 'text-white font-semibold' : 'text-slate-300'}>{label}</span>
        <span
          className={
            muted
              ? 'text-slate-500 text-xs'
              : emphasis
              ? 'text-white font-semibold'
              : 'text-slate-100'
          }
        >
          {value}
        </span>
      </div>
      {typeof share === 'number' && share > 0 && (
        <div className="mt-1.5 h-1 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full ${barClass}`}
            style={{ width: `${Math.min(100, share * 100)}%` }}
          />
        </div>
      )}
      {note && <p className="mt-1 text-[11px] text-slate-500">{note}</p>}
    </div>
  )
}

export default function ExecutiveFinancials() {
  const [data, setData] = useState<FinancialSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const fetchIdRef = useRef(0)

  const load = useCallback(async () => {
    const fetchId = ++fetchIdRef.current
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/eb/financial-summary', { credentials: 'include' })
      const json = await res.json()
      if (fetchId !== fetchIdRef.current) return
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)
      setData(json)
    } catch (err: any) {
      if (fetchId !== fetchIdRef.current) return
      setError(err?.message || 'Could not load financial summary.')
    } finally {
      if (fetchId === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    load()
    return () => {
      fetchIdRef.current += 1
    }
  }, [load])

  if (isLoading && !data) {
    return (
      <div className={`${PANEL} flex items-center justify-center gap-3 text-slate-300`}>
        <LoadingSpinner />
        <span className="text-sm">Reading treasury positions on-chain…</span>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="bg-rose-900/20 border border-rose-700/50 rounded-xl p-6 text-rose-200">
        <p className="font-semibold">Could not load financial summary</p>
        <p className="mt-1 text-sm">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-4 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const { assets, revenue, burn, runway, meta } = data
  const primaryMonths = runway.primary.months
  const runwayTone =
    primaryMonths === null
      ? 'positive'
      : primaryMonths < 6
      ? 'critical'
      : primaryMonths < 12
      ? 'caution'
      : 'neutral'

  const grossMonthly = burn.grossMonthlyUSD
  const maxStream = Math.max(...revenue.streams.map((s) => s.annualUSD), 1)
  const wallets = (assets.wallets || []).filter((w) => w.usd >= 1)
  const lpNote =
    assets.defiLpUSD > 0 ? `${usd(assets.defiLpUSD)} in Uniswap LP (non-MOONEY side)` : undefined

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="bg-rose-900/20 border border-rose-700/50 rounded-xl p-4 text-rose-200 text-sm">
          <p className="font-semibold">Could not refresh financial summary</p>
          <p className="mt-1 text-xs">{error}</p>
        </div>
      )}
      {meta.warnings.length > 0 && (
        <div className="bg-amber-900/25 border border-amber-700/50 rounded-xl p-4 text-amber-200 text-sm">
          <p className="font-semibold">Data quality</p>
          <ul className="mt-1 list-disc list-inside space-y-1 text-xs">
            {meta.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricTile
          icon={<WalletIcon className="w-4 h-4" />}
          label="Assets"
          value={usd(assets.liquidUSD)}
          sub={lpNote}
        />
        <MetricTile
          icon={<FireIcon className="w-4 h-4" />}
          label="Net burn / month"
          value={usd(burn.netMonthlyUSD)}
          sub={`${usd(grossMonthly)} gross less ${usd(burn.revenueMonthlyUSD)} cash revenue`}
        />
        <MetricTile
          icon={<ClockIcon className="w-4 h-4" />}
          label="Runway"
          value={months(primaryMonths)}
          tone={runwayTone as any}
          sub={
            runway.primary.exhaustionDate
              ? `Exhausted ${runway.primary.exhaustionDate} at constant burn`
              : 'Revenue covers approved costs'
          }
        />
        <MetricTile
          icon={<BanknotesIcon className="w-4 h-4" />}
          label="Revenue (trailing year)"
          value={usd(revenue.cashAnnualUSD ?? revenue.annualUSD)}
          sub={`Covers ${(revenue.coverageOfGrossBurn * 100).toFixed(1)}% of gross cost`}
        />
      </div>

      <div className={PANEL}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="font-GoodTimes text-white text-sm">Assets</h2>
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">By asset</h3>
            <div className="space-y-3 text-sm">
              {(assets.breakdown || []).map((row) => (
                <Row
                  key={row.label}
                  label={`${row.label}${
                    row.amount != null && row.unit ? ` · ${holdingLabel(row)}` : ''
                  }`}
                  value={usd(row.usd)}
                  share={assets.liquidUSD > 0 ? row.usd / assets.liquidUSD : 0}
                  barClass={ASSET_BAR[row.label] || 'bg-slate-400/70'}
                />
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">Wallets</h3>
            <div className="space-y-2 text-sm">
              {wallets.map((w) => (
                <div key={`${w.chain}:${w.address}`} className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-slate-300 truncate">{w.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {w.chain} · {shortAddr(w.address)}
                    </p>
                  </div>
                  <span className="text-slate-100 shrink-0">{usd(w.usd)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <AUMChart data={assets.history} height={280} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={PANEL}>
          <h2 className="font-GoodTimes text-white text-sm mb-4">Monthly cost</h2>
          <div className="space-y-3 text-sm">
            {burn.ebCoreLines.map((line) => (
              <Row
                key={line.label}
                label={line.label}
                value={usd(line.monthlyUSD)}
                note={line.note}
                share={line.monthlyUSD / grossMonthly}
                barClass="bg-indigo-400/70"
              />
            ))}
            <Row
              label={`Projects (Q${burn.projectsBasis.quarter} ${burn.projectsBasis.year})`}
              value={usd(burn.projectsMonthlyUSD)}
              note={`${usd(burn.projectsBasis.quarterlyBudgetUSD)} this quarter`}
              share={burn.projectsMonthlyUSD / grossMonthly}
              barClass="bg-emerald-400/70"
            />
            <Row label="Gross burn" value={usd(grossMonthly)} emphasis />
            <Row label="Cash revenue" value={`(${usd(burn.revenueMonthlyUSD)})`} />
            <Row label="Net burn" value={usd(burn.netMonthlyUSD)} emphasis />
            <Row
              label="If all bonuses pay"
              value={usd(burn.netMonthlyWithBonusesUSD)}
              note={`Adds the ${usd(burn.ebBonusMonthlyUSD)} monthly milestone pool`}
            />
          </div>
          <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
            MDP-{burn.ebBudgetSource.mdp} · {usd(burn.annual.grossUSD)} gross /{' '}
            {usd(burn.annual.netUSD)} net annualized.
          </p>
        </div>

        <div className={PANEL}>
          <h2 className="font-GoodTimes text-white text-sm mb-4">Revenue</h2>
          <div className="space-y-3 text-sm">
            {revenue.streams.map((stream) => (
              <Row
                key={stream.label}
                label={stream.label}
                value={stream.available === false ? 'Not live' : usd(stream.annualUSD)}
                muted={stream.available === false}
                note={[
                  stream.cash === false ? 'Accrued in the LP, not cash' : null,
                  typeof stream.txCount === 'number' && stream.available !== false
                    ? `${stream.txCount} payment${stream.txCount === 1 ? '' : 's'}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                share={stream.annualUSD / maxStream}
                barClass={stream.cash === false ? 'bg-slate-400/50' : 'bg-sky-400/70'}
              />
            ))}
            <Row
              label="Cash into the treasury"
              value={usd(revenue.cashAnnualUSD ?? revenue.annualUSD)}
              emphasis
            />
          </div>
          <p className="mt-5 pt-4 border-t border-slate-700 text-xs text-slate-400 leading-relaxed">
            Cash covers{' '}
            <span className="text-white font-semibold">
              {(revenue.coverageOfGrossBurn * 100).toFixed(1)}%
            </span>{' '}
            of gross cost. Gap to break-even:{' '}
            <span className="text-white font-semibold">
              {usd(Math.max(0, burn.annual.grossUSD - (revenue.cashAnnualUSD ?? revenue.annualUSD)))}
            </span>
            /year.
          </p>
          {!revenue.isMeasured && (
            <p className="mt-2 text-[11px] text-amber-300/80">
              Nothing measured on-chain — showing the stated {usd(revenue.statedAnnualUSD)} figure.
            </p>
          )}

          {revenue.unattributedInflows && revenue.unattributedInflows.txCount > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <h3 className="text-amber-300 text-xs font-semibold mb-1">
                Unattributed inflows — {usd(revenue.unattributedInflows.totalUSD)}
              </h3>
              <ul className="mt-2 space-y-1">
                {revenue.unattributedInflows.topSources.map((s) => (
                  <li key={s.address} className="flex justify-between gap-3 text-[11px]">
                    <span className="font-mono text-slate-400 truncate">{shortAddr(s.address)}</span>
                    <span className="text-slate-300 shrink-0">{usd(s.totalUSD)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {revenue.uncollected && (
        <div className={PANEL}>
          <h2 className="font-GoodTimes text-white text-sm mb-1">Uncollected revenue</h2>
          <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
            {revenue.uncollected.note}
          </p>
          <div className="space-y-3 text-sm">
            {revenue.uncollected.lines.map((line) => (
              <Row
                key={line.label}
                label={line.label}
                value={line.available ? usd(line.usd) : 'Not live'}
                muted={!line.available}
                note={
                  typeof line.raisedUSD === 'number'
                    ? `${line.kind === 'receivable' ? 'Earned' : 'Contingent'} · ${
                        line.detail
                      }`
                    : `${line.kind === 'receivable' ? 'Earned' : 'Contingent'} · ${line.detail}`
                }
              />
            ))}
            <Row
              label="Receivable"
              value={usd(revenue.uncollected.receivableUSD)}
              emphasis
            />
            <Row
              label="Contingent"
              value={usd(revenue.uncollected.contingentUSD)}
            />
          </div>
        </div>
      )}

      <div className={PANEL}>
        <h2 className="font-GoodTimes text-white text-sm mb-4">Runway</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-slate-400 text-[11px] uppercase tracking-wider">
                <th className="text-left font-normal pb-2">Basis</th>
                <th className="text-right font-normal pb-2">Assets</th>
                <th className="text-right font-normal pb-2">Net burn / mo</th>
                <th className="text-right font-normal pb-2">Runway</th>
                <th className="text-right font-normal pb-2">Exhausted</th>
              </tr>
            </thead>
            <tbody>
              {runway.scenarios.map((s) => (
                <tr key={s.label} className="border-t border-slate-700/60">
                  <td className="py-2.5 text-slate-300">{s.label}</td>
                  <td className="py-2.5 text-right text-slate-100">{usd(s.assetsUSD)}</td>
                  <td className="py-2.5 text-right text-slate-100">{usd(s.netMonthlyBurnUSD)}</td>
                  <td className="py-2.5 text-right text-white font-semibold">{months(s.months)}</td>
                  <td className="py-2.5 text-right text-slate-400">{s.exhaustionDate || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        ETH at {usd(meta.ethPriceUSD, { decimals: 2 })}. Read{' '}
        {new Date(meta.calculatedAt).toLocaleString()}. Point-in-time, not an audited statement.
      </p>
    </div>
  )
}
