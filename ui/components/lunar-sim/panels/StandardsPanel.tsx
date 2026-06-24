// SIROS standards + SOAR asset classes in effect for this scenario.

import type {
  SirosRegistry,
  SoarRegistry,
} from '@/lib/lunar-sim/engine/types'

type StandardsPanelProps = {
  soar: SoarRegistry
  siros: SirosRegistry
  activeStandardIds: string[]
}

const STATUS_TONE: Record<string, string> = {
  adopted: 'bg-emerald-500/20 text-emerald-300',
  proposed: 'bg-amber-500/20 text-amber-300',
  draft: 'bg-white/10 text-white/50',
}

export default function StandardsPanel({
  soar,
  siros,
  activeStandardIds,
}: StandardsPanelProps) {
  return (
    <div className="pointer-events-auto flex h-full flex-col rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Standards & Registry</h3>
        <p className="text-xs text-white/40">
          SIROS v{siros.version} · SOAR v{soar.version}
        </p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <div>
          <h4 className="mb-1 px-1 text-[11px] uppercase tracking-wide text-white/40">
            Standards (SIROS)
          </h4>
          {siros.standards.map((s) => {
            const active = activeStandardIds.includes(s.id)
            return (
              <div
                key={s.id}
                className={`mb-1.5 rounded-lg border px-2.5 py-2 ${
                  active
                    ? 'border-cyan-400/40 bg-cyan-500/5'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-white">
                    {s.name}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      STATUS_TONE[s.status] || STATUS_TONE.draft
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-white/40">
                  {s.id}
                </div>
                {s.requiredStamps.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.requiredStamps.map((st) => (
                      <span
                        key={st}
                        className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60"
                      >
                        {st}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div>
          <h4 className="mb-1 px-1 text-[11px] uppercase tracking-wide text-white/40">
            Asset Classes (SOAR)
          </h4>
          {soar.classes.map((c) => (
            <div
              key={c.id}
              className="mb-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-white">{c.name}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                  {c.category}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-white/40">
                {c.id}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
