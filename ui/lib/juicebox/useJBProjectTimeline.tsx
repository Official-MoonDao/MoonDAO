import { useEffect, useMemo, useState } from 'react'
import { wadToFloat } from '../utils/numbers'
import { daysToMS, minutesToMS } from '../utils/timestamp'
import { projectQuery, suckerGroupMomentsQuery } from './subgraph'
import { useJBProjectTimelineRange } from './useJBProjectTimelineRange'

export default function useJBProjectTimeline(
  selectedChain: any,
  projectCreatedAt: number,
  suckerGroupId?: string,
  projectId?: number
) {
  const [suckerGroupTimelinePoints, setSuckerGroupTimelinePoints] =
    useState<any[]>()
  const [isLoading, setIsLoading] = useState(false)

  const [range, setRange] = useJBProjectTimelineRange({
    createdAt: projectCreatedAt,
  })

  const { startTimestamp, endTimestamp } = useMemo(() => {
    if (!range) return { startTimestamp: 0, endTimestamp: 0 }

    const now = Date.now().valueOf() - minutesToMS(5)
    const startMS = now - daysToMS(range)

    return {
      startTimestamp: Math.floor(startMS / 1000), // Convert to seconds
      endTimestamp: Math.floor(now / 1000), // Convert to seconds
    }
  }, [range])

  const points = useMemo(() => {
    // Map sucker group moments to timeline points
    const suckerGroupPoints =
      suckerGroupTimelinePoints?.map((item: any) => ({
        timestamp: item.timestamp, // Remove the * 1000 since API returns seconds and chart expects seconds
        volume: wadToFloat(item.volume),
        balance: wadToFloat(item.balance || 0),
        trendingScore: wadToFloat(item.trendingScore || 0),
      })) || []

    setIsLoading(false)
    return suckerGroupPoints
  }, [suckerGroupTimelinePoints])

  useEffect(() => {
    async function getTimelinePoints() {
      if (!suckerGroupTimelinePoints) setIsLoading(true)
      if (
        !startTimestamp ||
        !endTimestamp ||
        !selectedChain ||
        projectId === undefined
      )
        return

      let sgId

      if (suckerGroupId === undefined) {
        const pQ = projectQuery(+projectId)
        const res = await fetch('/api/juicebox/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: pQ }),
        })

        const data = await res.json()
        sgId = data?.projects?.items[0]?.suckerGroupId
      } else {
        sgId = suckerGroupId
      }

      try {
        const query = suckerGroupMomentsQuery(
          selectedChain?.id,
          sgId,
          startTimestamp,
          endTimestamp
        )
        const requestBody = {
          query,
        }

        const res = await fetch('/api/juicebox/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        if (res.ok) {
          const data = await res.json()
          const items = data?.suckerGroupMoments?.items || []
          setSuckerGroupTimelinePoints(items)
        }
      } catch (error) {
        console.error('Error fetching timeline data:', error)
      }
    }

    if (
      startTimestamp &&
      endTimestamp &&
      selectedChain &&
      projectId !== undefined
    ) {
      getTimelinePoints()
    }
  }, [suckerGroupId, startTimestamp, endTimestamp, selectedChain, projectId])

  return { points, isLoading }
}
