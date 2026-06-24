// Stable, dependency-free hash of the simulation inputs + ordered event log.
// Used for reproducibility checks and future onchain anchoring.

import type { SimEvent } from './events'
import type { Scenario, SirosRegistry, SoarRegistry } from './types'

// Deterministic JSON stringify with sorted object keys.
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map((v) => stableStringify(v)).join(',') + ']'
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k]))
      .join(',') +
    '}'
  )
}

// 64-bit FNV-1a expressed as a 16-char hex string (two 32-bit halves).
export function hashHex(input: string): string {
  let h1 = 2166136261 >>> 0
  let h2 = 0x811c9dc5 >>> 0
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    h1 ^= c
    h1 = Math.imul(h1, 16777619)
    h2 ^= c + i
    h2 = Math.imul(h2, 16777619)
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0')
  return hex(h1) + hex(h2)
}

export function computeSimHash(
  scenario: Scenario,
  soar: SoarRegistry,
  siros: SirosRegistry,
  events: SimEvent[]
): string {
  const canonical = stableStringify({
    scenario,
    soarVersion: soar.version,
    sirosVersion: siros.version,
    events,
  })
  return hashHex(canonical)
}
