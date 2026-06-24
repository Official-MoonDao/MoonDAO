// Deterministic discrete-time simulation loop.
// Pure: no React/DOM/three. Runs identically in the browser Web Worker and Node.

import {
  flushCaches,
  stepFactory,
  stepRover,
  type SimContext,
  type SimCounters,
} from './behaviors'
import type { SimEvent } from './events'
import { PRNG } from './prng'
import { buildReport } from './report'
import { computeSimHash } from './simHash'
import type {
  AssetState,
  CommsWindow,
  Receipt,
  Scenario,
  SirosRegistry,
  SoarRegistry,
  WorldSnapshot,
} from './types'

function isCommsOpen(windows: CommsWindow[], timeSec: number): boolean {
  return windows.some((w) => timeSec >= w.startSec && timeSec < w.endSec)
}

function cloneStates(
  states: Record<string, AssetState>
): Record<string, AssetState> {
  const out: Record<string, AssetState> = {}
  for (const id of Object.keys(states)) {
    const s = states[id]
    out[id] = {
      id: s.id,
      pos: { x: s.pos.x, y: s.pos.y },
      phase: s.phase,
      cargoKg: s.cargoKg,
      allowanceRemaining: s.allowanceRemaining,
      pendingReceipts: [...s.pendingReceipts],
      cooldownSec: s.cooldownSec,
    }
  }
  return out
}

export function simulate(
  scenario: Scenario,
  soar: SoarRegistry,
  siros: SirosRegistry
) {
  const prng = new PRNG(scenario.seed)
  const tickSec = scenario.tickSec || 1

  const standardsById = Object.fromEntries(
    siros.standards.map((s) => [s.id, s])
  )
  const assetsById = Object.fromEntries(scenario.assets.map((a) => [a.id, a]))
  const sortedAssetIds = scenario.assets.map((a) => a.id).sort()

  const factory = scenario.assets.find(
    (a) => a.behaviorModule === 'isru_factory_v1'
  )
  if (!factory) {
    throw new Error('Scenario must include an isru_factory_v1 asset.')
  }
  const primaryDeposit = scenario.resources[0]
  if (!primaryDeposit) {
    throw new Error('Scenario must include at least one resource deposit.')
  }

  const states: Record<string, AssetState> = {}
  for (const id of sortedAssetIds) {
    const a = assetsById[id]
    states[id] = {
      id,
      pos: { x: a.pos.x, y: a.pos.y },
      phase: a.behaviorModule === 'isru_factory_v1' ? 'idle' : 'to_deposit',
      cargoKg: 0,
      allowanceRemaining: a.allowance.remaining,
      pendingReceipts: [],
      cooldownSec: 0,
    }
  }

  const depositsRemainingKg: Record<string, number> = {}
  for (const r of scenario.resources) depositsRemainingKg[r.id] = r.quantityKg

  const events: SimEvent[] = []
  const receipts: Receipt[] = []
  const snapshots: WorldSnapshot[] = []
  const counters: SimCounters = {
    receipts: 0,
    accepted: 0,
    rejected: 0,
    deliveredKg: 0,
    rejectionReasons: {},
  }

  const ctx: SimContext = {
    scenario,
    prng,
    standardsById,
    assetsById,
    states,
    depositsRemainingKg,
    receipts,
    events,
    factory,
    primaryDeposit,
    tick: 0,
    timeSec: 0,
    commsOpen: false,
    counters,
  }

  let commsWasOpen = false
  const totalTicks = Math.floor(scenario.durationSec / tickSec)

  for (let tick = 0; tick <= totalTicks; tick++) {
    const timeSec = tick * tickSec
    const commsOpen = isCommsOpen(scenario.commsWindows, timeSec)
    ctx.tick = tick
    ctx.timeSec = timeSec
    ctx.commsOpen = commsOpen

    if (commsOpen && !commsWasOpen) flushCaches(ctx)
    commsWasOpen = commsOpen

    for (const id of sortedAssetIds) {
      const a = assetsById[id]
      if (a.behaviorModule === 'isru_factory_v1') stepFactory(ctx, a)
      else stepRover(ctx, a)
    }

    snapshots.push({
      tick,
      timeSec,
      commsOpen,
      assets: cloneStates(states),
      depositsRemainingKg: { ...depositsRemainingKg },
    })
  }

  const simHash = computeSimHash(scenario, soar, siros, events)
  const report = buildReport(
    scenario,
    totalTicks,
    receipts,
    counters,
    states,
    simHash
  )

  return {
    simHash,
    scenarioId: scenario.id,
    events,
    snapshots,
    receipts,
    report,
  }
}
