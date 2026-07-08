const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * Extract the active ruleset dataHook from a `currentRulesetOf` result.
 * thirdweb may return either a 2-tuple `[ruleset, metadata]` or a named
 * object `{ ruleset, metadata }`, and the metadata itself may be a named
 * object or a positional array.
 */
export function extractActiveDataHook(ruleset: any): string | undefined {
  if (!ruleset) return undefined
  const metadata = Array.isArray(ruleset)
    ? ruleset[1]
    : ruleset?.metadata ?? ruleset?.[1] ?? null
  if (!metadata) return undefined
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    const hook = metadata.dataHook
    return typeof hook === 'string' ? hook : hook?.toString?.()
  }
  if (Array.isArray(metadata)) {
    // JBRulesetMetadata: dataHook is the 18th field (index 17).
    const hook = metadata[17]
    return typeof hook === 'string' ? hook : hook?.toString?.()
  }
  return undefined
}

export function isZeroAddress(addr: string | null | undefined): boolean {
  if (!addr) return true
  return addr.toLowerCase() === ZERO_ADDRESS
}

export { ZERO_ADDRESS }
