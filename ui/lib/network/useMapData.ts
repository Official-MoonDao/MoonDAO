/**
 * Simplified client-side map data hook
 *
 * This hook is now optimized to work with pre-validated data from static props.
 * It no longer performs subscription validation client-side to avoid RPC rate limiting.
 *
 * Use initialData from static props for optimal performance.
 */
import { useMemo } from 'react'
import { getDummyCitizenLocationData } from '@/lib/citizen/citizenDataService'
import { GroupedLocationData } from './types'

export type UseMapDataOptions = {
  enabled?: boolean
  initialData?: GroupedLocationData[]
}

export function useMapData(enabled: boolean = true, options: UseMapDataOptions = {}) {
  const { initialData } = options

  // If we have initial data from static props, use it
  // This data is already validated and processed server-side
  const data = useMemo(() => {
    if (!enabled) {
      return []
    }

    // Use initial data if available (from static props)
    if (initialData && initialData.length > 0) {
      return initialData
    }

    // Fall back to dummy data in development
    if (process.env.NEXT_PUBLIC_ENV !== 'prod' && process.env.NEXT_PUBLIC_TEST_ENV !== 'true') {
      return getDummyCitizenLocationData()
    }

    return []
  }, [enabled, initialData])

  return {
    data,
    isLoading: false, // No loading since we're using static props
    error: null,
  }
}
