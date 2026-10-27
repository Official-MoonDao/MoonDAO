export type ForecastSession = {
  address?: string | null
  chainSlug: string
  deprizeId: number
}

/**
 * A forecast write can finish after the viewer changes wallet, chain, or prize.
 * Local saved-pick state belongs to the session that is on screen now.
 */
export function sameForecastSession(active: ForecastSession, started: ForecastSession): boolean {
  const activeAddress = active.address?.trim().toLowerCase()
  const startedAddress = started.address?.trim().toLowerCase()
  if (!activeAddress || !startedAddress) return false
  return (
    activeAddress === startedAddress &&
    active.chainSlug === started.chainSlug &&
    active.deprizeId === started.deprizeId
  )
}
