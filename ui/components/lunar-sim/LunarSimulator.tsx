// Client orchestrator for the lunar simulator: runs the engine via useSimulation
// and lays the 3D viewport + panels + controls into a fullscreen workspace.
// Rendering is decoupled from the engine — panels and the scene both read the
// same precomputed snapshots/events.

import { useMemo } from 'react'
import type {
  Scenario,
  SirosRegistry,
  SoarRegistry,
} from '@/lib/lunar-sim/engine/types'
import useSimulation from '@/lib/lunar-sim/useSimulation'
import SimViewport from './SimViewport'
import AssetDrawer from './panels/AssetDrawer'
import Controls from './panels/Controls'
import LedgerPanel from './panels/LedgerPanel'
import RunReport from './panels/RunReport'
import StandardsPanel from './panels/StandardsPanel'

type LunarSimulatorProps = {
  scenario: Scenario
  soar: SoarRegistry
  siros: SirosRegistry
}

export default function LunarSimulator({
  scenario,
  soar,
  siros,
}: LunarSimulatorProps) {
  const sim = useSimulation(scenario, soar, siros)
  const atEnd = useMemo(
    () => !!sim.result && sim.tickIndex >= sim.totalTicks && sim.totalTicks > 0,
    [sim.result, sim.tickIndex, sim.totalTicks]
  )

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#05060a]">
      <SimViewport
        scenario={scenario}
        currentSnapshot={sim.currentSnapshot}
        nextSnapshot={sim.nextSnapshot}
        subTick={sim.subTick}
        isComputing={sim.isComputing}
      />

      {/* Overlay layer: transparent to pointer events except on panels. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        {/* Title */}
        <div className="flex justify-center pt-4">
          <div className="pointer-events-auto rounded-full border border-white/10 bg-black/50 px-4 py-1.5 text-center backdrop-blur-md">
            <span className="text-sm font-medium text-white">
              {scenario.name}
            </span>
          </div>
        </div>

        <div className="flex flex-1 gap-4 overflow-hidden p-4">
          {/* Left column: assets + standards */}
          <div className="hidden w-72 flex-col gap-4 md:flex">
            <div className="min-h-0 flex-1">
              <AssetDrawer scenario={scenario} sim={sim} />
            </div>
            <div className="min-h-0 flex-1">
              <StandardsPanel
                soar={soar}
                siros={siros}
                activeStandardIds={scenario.standardIds}
              />
            </div>
          </div>

          <div className="flex-1" />

          {/* Right column: ledger */}
          <div className="hidden w-80 md:block">
            <LedgerPanel sim={sim} />
          </div>
        </div>

        {/* Bottom controls */}
        <div className="flex justify-center px-4 pb-4">
          <div className="w-full max-w-2xl">
            <Controls sim={sim} scenario={scenario} />
          </div>
        </div>
      </div>

      {/* Errors */}
      {sim.error && (
        <div className="pointer-events-auto absolute left-1/2 top-1/2 w-96 max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-red-500/30 bg-black/80 p-5 text-center backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-red-300">
            Simulation error
          </h3>
          <p className="mt-1 text-xs text-white/60">{sim.error}</p>
        </div>
      )}

      {/* End-of-run report */}
      {atEnd && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <RunReport sim={sim} onReplay={sim.restart} />
        </div>
      )}
    </div>
  )
}
