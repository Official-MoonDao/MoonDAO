import EthDater from 'ethereum-block-by-date'
import { useEffect, useMemo, useState } from 'react'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { sepolia } from '@/lib/infura/infuraChains'
import client from '../thirdweb/client'
import { wadToFloat } from '../utils/numbers'
import { daysToMS, minutesToMS } from '../utils/timestamp'
import { projectTimelineQuery } from './subgraph'
import { useJBProjectTimelineRange } from './useJBProjectTimelineRange'

const COUNT = 30

export default function useJBProjectTimeline(
  selectedChain: any,
  projectId: number,
  projectCreatedAt: number
) {
  const [subgraphTimelinePoints, setSubgraphTimelinePoints] = useState<any[]>()
  const [isLoading, setIsLoading] = useState(false)

  const [blockData, setBlockData] = useState<{
    startBlock: { block: number; timestamp: number }
    endBlock: { block: number; timestamp: number }
  } | null>(null)
  const [isLoadingBlockNumbers, setIsLoadingBlockNumbers] = useState(false)

  const [range, setRange] = useJBProjectTimelineRange({
    createdAt: projectCreatedAt,
  })

  const { blocks, timestamps } = useMemo(() => {
    if (!blockData) return { blocks: {}, timestamps: [] }

    const start = blockData.startBlock
    const end = blockData.endBlock

    const blocks: Record<`block${number}`, number> = {
      block0: start.block,
    }
    const timestamps: number[] = [start.timestamp]

    // Calculate evenly distributed `count` (arbitrary) steps in between start and end. Timestamps are estimated and not guaranteed to match the actual timestamp for a block number, but this is good enough to show a trend.
    for (let i = 1; i < COUNT; i++) {
      const coeff = i / (COUNT - 1)

      blocks[`block${i}`] = Math.round(
        (end.block - start.block) * coeff + start.block
      )
      timestamps.push(
        Math.round((end.timestamp - start.timestamp) * coeff + start.timestamp)
      )
    }

    return { blocks, timestamps }
  }, [blockData])

  const points = useMemo(() => {
    if (!subgraphTimelinePoints) return []

    const queryResult = subgraphTimelinePoints

    const points: any[] = []

    for (let i = 0; i < COUNT; i++) {
      const point = queryResult[`p${i}` as keyof typeof queryResult]

      if (!point) continue

      const volume = point.volume

      points.push({
        timestamp: timestamps[i],
        trendingScore: wadToFloat(point.trendingScore),
        balance: wadToFloat(point.currentBalance),
        volume: wadToFloat(volume),
      })
    }

    setIsLoading(false)

    return points
  }, [timestamps, subgraphTimelinePoints])

  useEffect(() => {
    async function getBlockData() {
      setIsLoadingBlockNumbers(true)
      try {
        const provider = ethers5Adapter.provider.toEthers({
          client,
          chain: sepolia,
        })
        const dater = new EthDater(provider)

        const now = Date.now().valueOf() - minutesToMS(5)
        const startMS = now - daysToMS(range)

        const [startBlock, endBlock] = await Promise.all([
          dater.getDate(new Date(startMS).toISOString()),
          dater.getDate(new Date(now).toISOString()),
        ])
        if (
          startBlock !== blockData?.startBlock ||
          endBlock !== blockData?.endBlock
        ) {
          setBlockData({ startBlock, endBlock })
        }
      } catch (error) {
        console.error('Error fetching block data:', error)
      } finally {
        setIsLoadingBlockNumbers(false)
      }
    }

    if (range && selectedChain) getBlockData()

    const intervalId = setInterval(() => {
      if (range && selectedChain) getBlockData()
    }, minutesToMS(5))

    return () => clearInterval(intervalId)
  }, [range, selectedChain])

  useEffect(() => {
    async function getTimelinePoints() {
      if (!subgraphTimelinePoints) setIsLoading(true)
      if (projectId === undefined || !blocks) return
      try {
        const query = projectTimelineQuery(projectId?.toString(), blocks)
        const res = await fetch(`/api/juicebox/query?query=${query}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        if (!res.ok) {
          const errorText = await res.text()
          console.error('API Error Response:', errorText)
          throw new Error(`HTTP error! Status: ${res.status}`)
        }
        const data = await res.json()
        setSubgraphTimelinePoints(data)
      } catch (error) {
        console.error('Error fetching subgraph data:', error)
      }
    }

    if (projectId !== undefined && blocks) {
      getTimelinePoints()
    }
  }, [projectId, blockData])

  return { points, isLoading }
}
