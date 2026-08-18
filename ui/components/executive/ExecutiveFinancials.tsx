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

// Shape of GET /api/eb/financial-summary. Kept local to the consumer — the
// route is the contract, and mirroring it here keeps the fetch typed without
// exporting server types into the client bundle.
type Stream = {
  label: string
  annualUSD: number
  txCount?: number
  available?: boolean
  /** False for income that accrues inside a position rather than reaching a Safe. */
  cash?: boolean
  basis?: string
}

type UnattributedInflows = {
  totalUSD: number
  txCount: number
  topSources: { address: string; totalUSD: number; txCount: number }[]
  note: string
}

type RunwayScenario = {
  label?: string
  assetsUSD: number
  netMonthlyBurnUSD: number
  months: number | null
  exhaustionDate: string | null
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
    stakedEth: {
      ethStaked: number
      activeValidators: number
      usd: number
      note: string
    }
    defiLpUSD: number
    totalRecognizedUSD: number
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

const PANEL = 'bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 shadow-xl'

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

/** Labelled amount row with an optional proportional bar. */
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

  // Runway is the headline risk metric, so it gets a colour: under 6 months is
  // critical, under 12 is worth flagging.
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
          label="Liquid assets"
          value={usd(assets.liquidUSD)}
          sub={`${usd(assets.totalRecognizedUSD)} including ${assets.stakedEth.ethStaked.toFixed(
            0
          )} staked ETH`}
        />
        <MetricTile
          icon={<FireIcon className="w-4 h-4" />}
          label="Net burn / month"
          value={usd(burn.netMonthlyUSD)}
          sub={`${usd(grossMonthly)} gross less ${usd(burn.revenueMonthlyUSD)} revenue`}
        />
        <MetricTile
          icon={<ClockIcon className="w-4 h-4" />}
          label="Runway"
          value={months(primaryMonths)}
          tone={runwayTone as any}
          sub={
            runway.primary.exhaustionDate
              ? `Liquid assets exhausted ${runway.primary.exhaustionDate} at constant burn`
              : 'Revenue covers approved costs'
          }
        />
        <MetricTile
          icon={<BanknotesIcon className="w-4 h-4" />}
          label="Revenue (trailing year)"
          value={usd(revenue.annualUSD)}
          sub={`Covers ${(revenue.coverageOfGrossBurn * 100).toFixed(1)}% of gross cost${
            revenue.isMeasured ? '' : ' — stated figure, not measured'
          }`}
        />
      </div>

      <div className={PANEL}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <h2 className="font-GoodTimes text-white text-sm">Assets under management</h2>
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
        <AUMChart data={assets.history} height={280} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={PANEL}>
          <h2 className="font-GoodTimes text-white text-sm mb-4">Monthly cost stack</h2>
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
              label={`Projects system (Q${burn.projectsBasis.quarter} ${burn.projectsBasis.year})`}
              value={usd(burn.projectsMonthlyUSD)}
              note={`${usd(burn.projectsBasis.quarterlyBudgetUSD)} per quarter — ${
                burn.projectsBasis.note
              }`}
              share={burn.projectsMonthlyUSD / grossMonthly}
              barClass="bg-emerald-400/70"
            />
            <Row label="Gross burn" value={usd(grossMonthly)} emphasis />
            <Row label="Revenue credit" value={`(${usd(burn.revenueMonthlyUSD)})`} />
            <Row label="Net burn" value={usd(burn.netMonthlyUSD)} emphasis />
            <Row
              label="If all at-risk bonuses pay"
              value={usd(burn.netMonthlyWithBonusesUSD)}
              note={`Adds the ${usd(burn.ebBonusMonthlyUSD)} monthly milestone pool`}
            />
          </div>
          <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
            Executive Branch lines are MDP-{burn.ebBudgetSource.mdp} ({burn.ebBudgetSource.title},{' '}
            {burn.ebBudgetSource.termMonths}-month term). Annualized: {usd(burn.annual.grossUSD)}{' '}
            gross, {usd(burn.annual.netUSD)} net.
          </p>
        </div>

        <div className={PANEL}>
          <h2 className="font-GoodTimes text-white text-sm mb-4">Revenue by stream</h2>
          <div className="space-y-3 text-sm">
            {revenue.streams.map((stream) => (
              <Row
                key={stream.label}
                label={stream.label}
                value={stream.available === false ? 'Not live' : usd(stream.annualUSD)}
                muted={stream.available === false}
                note={[
                  stream.cash === false ? 'Accrued, not cash' : null,
                  typeof stream.txCount === 'number' && stream.available !== false
                    ? `${stream.txCount} payment${
                        stream.txCount === 1 ? '' : 's'
                      } in the trailing year`
                    : null,
                  stream.basis,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                share={stream.annualUSD / maxStream}
                barClass={stream.cash === false ? 'bg-slate-400/50' : 'bg-sky-400/70'}
              />
            ))}
            {typeof revenue.cashAnnualUSD === 'number' && (
              <Row
                label="Cash into the treasury"
                value={usd(revenue.cashAnnualUSD)}
                note="The part that can actually pay salaries"
              />
            )}
            {typeof revenue.accruedAnnualUSD === 'number' && revenue.accruedAnnualUSD > 0 && (
              <Row
                label="Accrued (raises AUM)"
                value={usd(revenue.accruedAnnualUSD)}
                note="Earned inside LP and validator positions, not withdrawn"
              />
            )}
            <Row label="Total (trailing year)" value={usd(revenue.annualUSD)} emphasis />
          </div>
          <div className="mt-5 pt-4 border-t border-slate-700">
            <p className="text-xs text-slate-400 leading-relaxed">
              Revenue covers{' '}
              <span className="text-white font-semibold">
                {(revenue.coverageOfGrossBurn * 100).toFixed(1)}%
              </span>{' '}
              of gross operating cost. Closing the gap needs roughly{' '}
              <span className="text-white font-semibold">
                {usd(Math.max(0, burn.annual.grossUSD - revenue.annualUSD))}
              </span>{' '}
              of additional annual revenue, or an equivalent cost reduction.
            </p>
            {!revenue.isMeasured && (
              <p className="mt-2 text-[11px] text-amber-300/80">
                No on-chain revenue measured for this window — showing the stated{' '}
                {usd(revenue.statedAnnualUSD)} policy figure.
              </p>
            )}
            {revenue.methodology && (
              <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
                <span className="text-slate-400">How this is measured:</span> {revenue.methodology}
              </p>
            )}
          </div>

          {revenue.unattributedInflows && revenue.unattributedInflows.txCount > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <h3 className="text-amber-300 text-xs font-semibold mb-1">
                Unattributed inflows — {usd(revenue.unattributedInflows.totalUSD)} across{' '}
                {revenue.unattributedInflows.txCount} transfer
                {revenue.unattributedInflows.txCount === 1 ? '' : 's'}
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {revenue.unattributedInflows.note}
              </p>
              <ul className="mt-2 space-y-1">
                {revenue.unattributedInflows.topSources.map((s) => (
                  <li key={s.address} className="flex justify-between gap-3 text-[11px]">
                    <span className="font-mono text-slate-400 truncate">{s.address}</span>
                    <span className="text-slate-300 shrink-0">
                      {usd(s.totalUSD)} · {s.txCount}×
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {revenue.excluded && revenue.excluded.length > 0 && (
            <details className="mt-4 pt-4 border-t border-slate-700">
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-white">
                Deliberately excluded from revenue ({revenue.excluded.length})
              </summary>
              <ul className="mt-3 space-y-2">
                {revenue.excluded.map((item) => (
                  <li key={item.label} className="text-[11px] leading-relaxed">
                    <span className="text-slate-300">{item.label}</span>
                    <span className="text-slate-500"> — {item.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      <div className={PANEL}>
        <h2 className="font-GoodTimes text-white text-sm mb-4">Runway scenarios</h2>
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
        <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
          Staked ETH ({assets.stakedEth.ethStaked.toFixed(0)} ETH across{' '}
          {assets.stakedEth.activeValidators} validators, {usd(assets.stakedEth.usd)}) is excluded
          from liquid assets. {assets.stakedEth.note} Exiting it also shrinks the base the projects
          budget is drawn from.
        </p>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        {meta.basis} ETH at {usd(meta.ethPriceUSD, { decimals: 2 })}. Read{' '}
        {new Date(meta.calculatedAt).toLocaleString()}. Balances move continuously; this is a
        point-in-time view, not an audited statement.
      </p>
    </div>
  )
}
