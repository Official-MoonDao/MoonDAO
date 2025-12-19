/**
 * Legacy wrapper for getCitizensLocationData
 * Maintained for backwards compatibility
 *
 * @deprecated Use fetchCitizensWithLocation from citizenDataService.ts instead
 */
import {
  fetchCitizensWithLocation,
  getDummyCitizenLocationData,
} from '@/lib/citizen/citizenDataService'
import { arbitrum } from '@/lib/rpc/chains'

export async function getCitizensLocationData() {
  try {
    if (process.env.NEXT_PUBLIC_ENV === 'prod' || process.env.NEXT_PUBLIC_TEST_ENV === 'true') {
      return await fetchCitizensWithLocation(arbitrum)
    } else {
      return getDummyCitizenLocationData()
    }
  } catch (error) {
    console.error('Error getting citizens location data:', error)
    return []
  }
}
