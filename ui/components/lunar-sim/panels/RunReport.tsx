// End-of-run summary overlay. Surfaces the deterministic outcome: accepted vs
// rejected transactions, regolith delivered, settled/unsettled value, why the
// rejections happened, and the reproducibility hash.

import type { UseSimulationResult } from '@/lib/lunar-sim/useSimulation'

type RunReportProps = {
  sim: UseSimulationResult
  onReplay: () => void
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-white/40">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-semibold ${tone || 'text-white'}`}>
        {value}
      </div>
    </div>
  )
}

export default function RunReport({ sim, onReplay }: RunReportProps) {
  const report = sim.result?.report
  if (!report) return null

  const reasons = Object.entries(report.rejectionReasons)

  return (
    <div className="pointer-events-auto w-[420px] max-w-[90vw] rounded-2xl border border-white/10 bg-black/80 p-5 backdrop-blur-xl">
      <h3 className="text-lg font-semibold text-white">Run Report</h3>
      <p className="text-xs text-white/40">
        Deterministic outcome for this scenario + seed.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat
          label="Accepted"
          value={String(report.acceptedTx)}
          tone="text-emerald-300"
        />
        <Stat
          label="Rejected"
          value={String(report.rejectedTx)}
          tone="text-red-300"
        />
        <Stat
          label="Regolith delivered"
          value={`${Math.round(report.regolithDeliveredKg)} kg`}
        />
        <Stat
          label="Settled value"
          value={`${report.settledValue} cr`}
          tone="text-emerald-300"
        />
        <Stat
          label="Unsettled (offline)"
          value={`${report.unsettledValue} cr`}
          tone="text-amber-300"
        />
        <Stat label="Ticks" value={String(report.ticks)} />
      </div>

      {reasons.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-wide text-white/40">
            Rejection reasons
          </div>
          <div className="mt-1 space-y-1">
            {reasons.map(([reason, count]) => (
              <div
                key={reason}
                className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5 text-xs"
              >
                <span className="font-mono text-red-300">{reason}</span>
                <span className="text-white/60">×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="truncate font-mono text-[10px] text-white/30">
          simHash: {report.simHash}
        </div>
        <button
          onClick={onReplay}
          className="shrink-0 rounded-lg bg-cyan-500/30 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-500/40"
        >
          Replay
        </button>
      </div>
    </div>
  )
}
