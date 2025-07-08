import EthDater from 'ethereum-block-by-date'
import { useEffect, useMemo, useState } from 'react'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { sepolia } from '@/lib/infura/infuraChains'
import client from '../thirdweb/client'
import { wadToFloat } from '../utils/numbers'
import { daysToMS, minutesToMS } from '../utils/timestamp'
import { projectTimelineQuery } from './subgraph'
import { useJBProjectTimelineRange } from './useJBProjectTimelineRange'

// Test query to see all available projects
function testAllProjectsQuery() {
  return `
    query {
      projects(limit: 1000) {
        items {
          id
          projectId
          handle
          volume
          trendingScore
        }
      }
    }
  `
}

// Test query to see all projectMoments without filters
function testAllProjectMomentsQuery() {
  return `
    query {
      projectMoments(limit: 1000) {
        items {
          chainId
          projectId
          balance
          volume
          timestamp
        }
      }
    }
  `
}

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

    const points: any[] = subgraphTimelinePoints.map((item: any) => ({
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

      console.log('=== DEBUGGING TIMELINE QUERY ===')
      console.log('Project ID:', projectId)
      console.log('Chain ID:', selectedChain?.id)
      console.log('Start timestamp:', startTimestamp)
      console.log('End timestamp:', endTimestamp)

      try {
        // First, test what projects are available
        console.log('\n--- Testing available projects ---')
        const allProjectsQuery = testAllProjectsQuery()
        const projectsRes = await fetch('/api/juicebox/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: allProjectsQuery, variables: {} }),
        })
        const projectsData = await projectsRes.json()
        console.log('Available projects:', projectsData?.projects?.items || [])

        // Then test what projectMoments are available
        console.log('\n--- Testing available projectMoments ---')
        const allMomentsQuery = testAllProjectMomentsQuery()
        const momentsRes = await fetch('/api/juicebox/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: allMomentsQuery, variables: {} }),
        })
        const momentsData = await momentsRes.json()
        console.log(
          'Available projectMoments:',
          momentsData?.projectMoments?.items || []
        )

        // Check if our specific project exists
        const ourProject = projectsData?.projects?.items?.find(
          (p: any) => p.projectId == projectId
        )
        console.log('Our project found:', ourProject)

        // Check if any projectMoments exist for our project
        const ourMoments = momentsData?.projectMoments?.items?.filter(
          (m: any) => m.projectId == projectId
        )
        console.log('ProjectMoments for our project:', ourMoments)

        // Now try the actual timeline query
        console.log('\n--- Running actual timeline query ---')
        const query = projectTimelineQuery()
        const requestBody = {
          query,
          variables: {
            chainId: selectedChain?.id,
            projectId,
            startTimestamp,
            endTimestamp,
          },
        }

        console.log(
          'Timeline request body:',
          JSON.stringify(requestBody, null, 2)
        )

        const res = await fetch('/api/juicebox/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        console.log('Timeline response status:', res.status)

        if (!res.ok) {
          const errorText = await res.text()
          console.error('Timeline API Error Response:', errorText)
          throw new Error(`HTTP error! Status: ${res.status}`)
        }

        const data = await res.json()
        console.log('Timeline API response:', JSON.stringify(data, null, 2))
        console.log('Timeline items:', data?.projectMoments?.items)
        console.log(
          'Timeline items length:',
          data?.projectMoments?.items?.length
        )

        const items = data?.projectMoments?.items || []
        console.log('Setting timeline points to:', items)
        setSubgraphTimelinePoints(items)
      } catch (error) {
        console.error('Error fetching timeline data:', error)
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
