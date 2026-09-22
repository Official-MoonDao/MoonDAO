/**
 * Restricted is copy-only. The forecast panel always mounts.
 * Test 7 parameterizes this so a visibility gate cannot land silently.
 */
export function forecastPanelShouldMount(_restricted: boolean | undefined): boolean {
  return true
}
