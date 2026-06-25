// MoonSim Web Worker entry point.
//
// Runs the deterministic engine off the main thread. This module is a valid,
// self-contained worker: it imports only the pure engine (no React/DOM/three).
// The host hook (useSimulation) currently computes on the main thread because
// the engine completes in well under a second for MVP scenarios; this file is
// the drop-in offload target when scenarios grow large enough to need it.
//
// Usage (when enabled):
//   const worker = new Worker(new URL('./sim.worker.ts', import.meta.url))
//   worker.postMessage({ scenario, soar, siros })
//   worker.onmessage = (e) => { /* e.data: { ok, result } | { ok:false, error } */ }

import { simulate } from './engine/loop'
import type { Scenario, SirosRegistry, SoarRegistry } from './engine/types'

type SimRequest = {
  scenario: Scenario
  soar: SoarRegistry
  siros: SirosRegistry
}

self.onmessage = (event: MessageEvent<SimRequest>) => {
  const { scenario, soar, siros } = event.data || ({} as SimRequest)
  try {
    const result = simulate(scenario, soar, siros)
    self.postMessage({ ok: true, result })
  } catch (err) {
    self.postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export {}
