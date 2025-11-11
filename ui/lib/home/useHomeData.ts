import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { getAUMHistory } from '@/lib/coinstats'
import { getCitizensLocationData } from '@/lib/map'
import { getHistoricalRevenue } from '@/lib/treasury/revenue'
import fetcher from '../swr/fetcher'

export function useCitizensLocationData() {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    getCitizensLocationData()
      .then((locationData) => {
        if (isMounted) {
          setData(locationData)
          setIsLoading(false)
        }
      })
      .catch((error) => {
        console.error('Failed to fetch citizens location data:', error)
        if (isMounted) {
          setData([])
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  return { data, isLoading }
}

export function useDetailedAUMData(initialData?: any) {
  const [data, setData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(!initialData)

  useEffect(() => {
    if (initialData) return

    let isMounted = true

    getAUMHistory(365)
      .then((aumData) => {
        if (isMounted) {
          setData(aumData)
          setIsLoading(false)
        }
      })
      .catch((error) => {
        console.error('Failed to fetch AUM data:', error)
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [initialData])

  return { data, isLoading }
}

export function useDetailedRevenueData(defiData?: any, initialData?: any) {
  const [data, setData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(!initialData)

  useEffect(() => {
    if (initialData || !defiData) return

    let isMounted = true

    getHistoricalRevenue(defiData, 365)
      .then((revenueData) => {
        if (isMounted) {
          setData(revenueData)
          setIsLoading(false)
        }
      })
      .catch((error) => {
        console.error('Failed to fetch revenue data:', error)
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [defiData, initialData])

  return { data, isLoading }
}

export function useNewsletters() {
  const { data, error, isLoading } = useSWR('/api/newsletters', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

  return {
    newsletters: data?.newsletters || [],
    isLoading,
    error,
  }
}
