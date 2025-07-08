import EthDater from 'ethereum-block-by-date'
import { useEffect, useMemo, useState } from 'react'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { sepolia } from '@/lib/infura/infuraChains'
import client from '../thirdweb/client'
import { wadToFloat } from '../utils/numbers'
import { daysToMS, minutesToMS } from '../utils/timestamp'
import {
  projectTimelineQuery,
  testAllDataQuery,
  testProjectMomentsQuery,
} from './subgraph'
import { useJBProjectTimelineRange } from './useJBProjectTimelineRange'

export default function useJBProjectTimeline(
  selectedChain: any,
  projectId: number,
  projectCreatedAt: number
) {
  const [subgraphTimelinePoints, setSubgraphTimelinePoints] = useState<any[]>()
  const [isLoading, setIsLoading] = useState(false)

  const [range, setRange] = useJBProjectTimelineRange({
    createdAt: projectCreatedAt,
  })

  const { startTimestamp, endTimestamp } = useMemo(() => {
    if (!range) return { startTimestamp: 0, endTimestamp: 0 }

    // Remove the hardcoded timestamp - use real current time
    const now = Date.now().valueOf() - minutesToMS(5)
    const startMS = now - daysToMS(range)

    console.log('Debug timestamp calculation:', {
      range,
      now,
      startMS,
      currentDate: new Date(now).toISOString(),
      startDate: new Date(startMS).toISOString(),
    })

    return {
      startTimestamp: Math.floor(startMS / 1000), // Convert to seconds
      endTimestamp: Math.floor(now / 1000), // Convert to seconds
    }
  }, [range])

  const points = useMemo(() => {
    if (!subgraphTimelinePoints) return []

    // The new response structure has projectMoments.items
    const items = subgraphTimelinePoints

    const points: any[] = items.map((item: any) => ({
      timestamp: item.timestamp * 1000, // Convert back to milliseconds
      trendingScore: wadToFloat(item.trendingScore),
      balance: wadToFloat(item.balance),
      volume: wadToFloat(item.volume),
    }))

    setIsLoading(false)

    return points
  }, [subgraphTimelinePoints])

  useEffect(() => {
    async function getTimelinePoints() {
      if (!subgraphTimelinePoints) setIsLoading(true)
      if (projectId === undefined || !startTimestamp || !endTimestamp) return

      try {
        const query = testAllDataQuery() // Try this instead

        console.log('Sending query:', query)

        const res = await fetch(
          `/api/juicebox/query?query=${encodeURIComponent(query)}`,
          {
            method: 'GET', // Changed from POST to GET
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )

        console.log('Response status:', res.status)

        if (!res.ok) {
          const errorText = await res.text()
          console.error('API Error Response:', errorText)
          throw new Error(`HTTP error! Status: ${res.status}`)
        }

        const data = await res.json()
        console.log('Raw API response:', JSON.stringify(data, null, 2))
        console.log('Project moments items:', data?.projectMoments?.items)
        console.log('Items length:', data?.projectMoments?.items?.length)

        const items = data?.projectMoments?.items || []
        console.log('Setting timeline points to:', items)
        setSubgraphTimelinePoints(items)
      } catch (error) {
        console.error('Error fetching subgraph data:', error)
      }
    }

    if (
      projectId !== undefined &&
      startTimestamp &&
      endTimestamp &&
      selectedChain
    ) {
      getTimelinePoints()
    }
  }, [projectId, startTimestamp, endTimestamp, selectedChain])

  return { points, isLoading }
}
