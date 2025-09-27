import { useEffect, useMemo, useState } from 'react'
import { wadToFloat } from '../utils/numbers'
import { minutesToMS } from '../utils/timestamp'
import { projectQuery, suckerGroupMomentsQuery } from './subgraph'
import { useJBProjectTimelineRange } from './useJBProjectTimelineRange'

export default function useJBProjectTimeline(
  selectedChain: any,
  projectCreatedAt: number,
  suckerGroupId?: string,
  projectId?: number
) {
  const [suckerGroupTimelineData, setSuckerGroupTimelineData] = useState<{
    previous: { items: any[] }
    range: { items: any[] }
  }>()
  const [isLoading, setIsLoading] = useState(false)

  const [range, setRange] = useJBProjectTimelineRange({
    createdAt: projectCreatedAt,
  })

  // Match official Juicebox timestamp calculation
  const { startTimestamp, endTimestamp } = useMemo(() => {
    if (!range) return { startTimestamp: 0, endTimestamp: 0 }

    // Use official Juicebox pattern: Date.now() - minutesToMS(5)
    const daysToMS = (days: number) => days * 24 * 60 * 60 * 1000
    const nowMs = Date.now().valueOf() - minutesToMS(5)
    const startMs = nowMs - daysToMS(range)

    return {
      startTimestamp: Math.floor(startMs / 1000),
      endTimestamp: Math.floor(nowMs / 1000),
    }
  }, [range])

  const points = useMemo(() => {
    if (!suckerGroupTimelineData || !startTimestamp || !endTimestamp) {
      return []
    }

    // Generate points based on range - one point per day for shorter ranges
    const COUNT = Math.min(+range, 30) // Use range for short periods, max 30 for long periods
    const timestamps: number[] = []

    // Generate evenly spaced timestamps from start to end
    for (let i = 0; i < COUNT; i++) {
      const coeff = i / (COUNT - 1)
      const timestamp = Math.round(
        (endTimestamp - startTimestamp) * coeff + startTimestamp
      )
      timestamps.push(timestamp)
    }

    // Extract previous and range data
    const previous = suckerGroupTimelineData.previous.items.length
      ? suckerGroupTimelineData.previous.items[0]
      : undefined

    // Sort range items by timestamp to ensure proper order
    const rangeItems = [...suckerGroupTimelineData.range.items].sort(
      (a, b) => a.timestamp - b.timestamp
    )

    // Create data points for ALL 30 timestamps (official Juicebox pattern)
    const points = timestamps.map((timestamp) => {
      // Default values (before project creation or if no data)
      let volume = 0
      let balance = 0
      let trendingScore = 0

      // If project was created before this timestamp, use baseline from previous data
      if (projectCreatedAt <= timestamp && previous) {
        volume = wadToFloat(previous.volume)
        balance = wadToFloat(previous.balance)
        trendingScore = wadToFloat(previous.trendingScore)
      }

      // Update with any actual data changes at or before this timestamp
      for (const item of rangeItems) {
        if (item.timestamp <= timestamp) {
          volume = wadToFloat(item.volume)
          balance = wadToFloat(item.balance)
          trendingScore = wadToFloat(item.trendingScore)
        } else {
          break // Items are sorted by timestamp
        }
      }

      return {
        timestamp,
        volume,
        balance,
        trendingScore,
      }
    })

    setIsLoading(false)
    return points
  }, [suckerGroupTimelineData, startTimestamp, endTimestamp, projectCreatedAt])

  useEffect(() => {
    async function getTimelinePoints() {
      if (!suckerGroupTimelineData) setIsLoading(true)
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

          setSuckerGroupTimelineData({
            previous: data?.previous || { items: [] },
            range: data?.range || { items: [] },
          })
        } else {
          console.error('API request failed:', res.status, res.statusText)
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

  return { points, isLoading, range, setRange }
}
