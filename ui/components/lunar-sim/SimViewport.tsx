// Lazy, client-only mount of the 3D scene. three.js/R3F cannot server-render,
// so the scene is dynamically imported with ssr:false and only mounted once
// the host has produced a simulation result.

import dynamic from 'next/dynamic'
import type {
  Scenario,
  WorldSnapshot,
} from '@/lib/lunar-sim/engine/types'

const SimScene = dynamic(() => import('./scene/SimScene'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#05060a] text-white/60">
      Loading lunar scene…
    </div>
  ),
})

type SimViewportProps = {
  scenario?: Scenario
  currentSnapshot?: WorldSnapshot
  nextSnapshot?: WorldSnapshot
  subTick: number
  isComputing?: boolean
}

export default function SimViewport({
  scenario,
  currentSnapshot,
  nextSnapshot,
  subTick,
  isComputing,
}: SimViewportProps) {
  if (!scenario || isComputing) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#05060a] text-white/60">
        {isComputing ? 'Running simulation…' : 'No scenario loaded.'}
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <SimScene
        scenario={scenario}
        currentSnapshot={currentSnapshot}
        nextSnapshot={nextSnapshot}
        subTick={subTick}
      />
    </div>
  )
}
