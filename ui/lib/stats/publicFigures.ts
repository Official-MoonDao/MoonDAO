/** Public stats rendered before a live read arrives. Never a literal zero. */

/** Last-known ballpark when Citizen totalSupply cannot be read. */
export const FALLBACK_CITIZEN_COUNT = 260

export function resolveCitizenCount(count: number | null | undefined): number {
  if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
    return Math.floor(count)
  }
  return FALLBACK_CITIZEN_COUNT
}

/** Empty string when `value` is not a positive finite number, so callers cannot paint "0". */
export function formatCountStat(value: number, prefix = '', suffix = ''): string {
  const rounded = Math.round(value)
  if (!Number.isFinite(rounded) || rounded <= 0) return ''
  return `${prefix}${rounded.toLocaleString('en-US')}${suffix}`
}
