// Public entry point for the pure MoonSim engine.
// No React/DOM/three imports anywhere in this module graph.

export * from './types'
export { SIM_EVENT_TYPES, makeEvent } from './events'
export { PRNG, hashStringToInt } from './prng'
export { simulate } from './loop'
export { computeSimHash, stableStringify, hashHex } from './simHash'
export { buildReport } from './report'
export {
  attemptTransaction,
  stepRover,
  stepFactory,
  flushCaches,
} from './behaviors'
export type { SimContext, SimCounters } from './behaviors'
