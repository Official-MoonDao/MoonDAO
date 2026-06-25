// End-of-run report builder.

import type { SimCounters } from './behaviors'
import type { AssetState, Receipt, RunReport, Scenario } from './types'

export function buildReport(
  scenario: Scenario,
  ticks: number,
  receipts: Receipt[],
  counters: SimCounters,
  states: Record<string, AssetState>,
  simHash: string
): RunReport {
  let settledValue = 0
  let unsettledValue = 0
  let regolithDeliveredKg = 0
  for (const r of receipts) {
    regolithDeliveredKg += r.quantityKg
    if (r.settlementStatus === 'settled') settledValue += r.price
    else unsettledValue += r.price
  }

  const allowanceRemaining: Record<string, number> = {}
  for (const id of Object.keys(states).sort()) {
    allowanceRemaining[id] = states[id].allowanceRemaining
  }

  return {
    simHash,
    durationSec: scenario.durationSec,
    ticks,
    acceptedTx: counters.accepted,
    rejectedTx: counters.rejected,
    regolithDeliveredKg,
    settledValue,
    unsettledValue,
    allowanceRemaining,
    rejectionReasons: counters.rejectionReasons,
  }
}
