import { isLikelyEthAddress, type CitizenRow } from '@/lib/citizen/citizenLookup'
import type { ForecastCaller } from '@/lib/forecasts/consensusTypes'

/**
 * Citizen fields from the consensus leaderboard, used when the owner lookup
 * has no row. A name that is only the wallet address is not a citizen name.
 */
export function citizenFromCaller(caller: ForecastCaller | undefined): {
  citizen?: CitizenRow
  fallbackName?: string
} {
  if (!caller) return {}
  const name = caller.citizenName?.trim() ?? ''
  const address = caller.voterAddress.toLowerCase()
  if (!name || isLikelyEthAddress(name) || name.toLowerCase() === address) return {}
  const image = caller.citizenImage?.trim() ? caller.citizenImage : null
  const id = caller.citizenId
  if (id === '' || id == null) return { fallbackName: name }
  return {
    citizen: {
      id,
      name,
      owner: caller.voterAddress,
      image,
    },
  }
}
