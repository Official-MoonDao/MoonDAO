// Asset roster with live state (phase, cargo, allowance) pulled from the
// current snapshot, plus static identity (class, stamps, supported standards).

import type { Scenario } from '@/lib/lunar-sim/engine/types'
import type { UseSimulationResult } from '@/lib/lunar-sim/useSimulation'

type AssetDrawerProps = {
  scenario: Scenario
  sim: UseSimulationResult
}

const PHASE_LABEL: Record<string, string> = {
  idle: 'Idle',
  to_deposit: 'Heading to deposit',
  mining: 'Mining',
  to_factory: 'Heading to factory',
  trading: 'Trading',
}

const DOT: Record<string, string> = {
  worker_rover_v1: 'bg-emerald-400',
  lurker_rover_v1: 'bg-red-400',
  isru_factory_v1: 'bg-slate-300',
}

export default function AssetDrawer({ scenario, sim }: AssetDrawerProps) {
  return (
    <div className="pointer-events-auto flex h-full flex-col rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Assets</h3>
        <p className="text-xs text-white/40">{scenario.assets.length} on surface</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {scenario.assets.map((a) => {
          const state = sim.currentSnapshot?.assets[a.id]
          return (
            <div
              key={a.id}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    DOT[a.behaviorModule] || 'bg-white/40'
                  }`}
                />
                <span className="text-sm font-medium text-white">{a.name}</span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-white/40">
                {a.class}
              </div>

              {state && (
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-white/40">Phase</span>
                  <span className="text-right text-white/80">
                    {PHASE_LABEL[state.phase] || state.phase}
                  </span>
                  {a.cargoCapacityKg > 0 && (
                    <>
                      <span className="text-white/40">Cargo</span>
                      <span className="text-right text-white/80">
                        {Math.round(state.cargoKg)} / {a.cargoCapacityKg} kg
                      </span>
                    </>
                  )}
                  <span className="text-white/40">Allowance</span>
                  <span className="text-right text-white/80">
                    {Math.round(state.allowanceRemaining)} cr
                  </span>
                  <span className="text-white/40">Pending</span>
                  <span className="text-right text-white/80">
                    {state.pendingReceipts.length} receipt(s)
                  </span>
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-1">
                {a.stamps.length === 0 && (
                  <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-300">
                    no credentials
                  </span>
                )}
                {a.stamps.map((s) => (
                  <span
                    key={s}
                    className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
