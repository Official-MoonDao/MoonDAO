import { useInfiniteQuery } from '@tanstack/react-query'
import { SuckerPair } from 'juice-sdk-core'
import { projectEventsQuery } from './subgraph'

export type EventType =
  | 'payEvent'
  | 'addToBalanceEvent'
  | 'mintTokensEvent'
  | 'deployErc20Event'
  | 'projectCreateEvent'
  | 'burnEvent'

type ProjectEventFilter = 'all' | EventType | ''

const PAGE_SIZE = 10

const useOmnichainSubgraphProjectEvents = ({
  filter,
  sucker,
  projectId,
}: {
  filter?: ProjectEventFilter
  sucker: SuckerPair | undefined
  projectId?: string
}) => {
  const result = useInfiniteQuery({
    queryKey: [
      'projectEvents',
      filter,
      sucker?.projectId.toString(),
      projectId,
    ],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!sucker && !projectId)
        return {
          data: { activityEvents: { items: [] } },
          nextCursor: undefined,
        }

      try {
        const query = projectEventsQuery(
          sucker?.projectId
            ? Number(sucker.projectId.toString())
            : projectId
            ? Number(projectId)
            : 0,
          filter,
          'timestamp',
          'desc',
          PAGE_SIZE
        )

        const res = await fetch('/api/juicebox/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        })

        const data = await res.json()

        const activityEvents = data.activityEvents?.items || []
        // Note: Pagination with skip is not supported in the new schema
        // For now, we only load the first page
        const mightHaveNextPage = false // activityEvents.length === PAGE_SIZE && pageParam === 0
        return {
          data: { activityEvents: { items: activityEvents } },
          nextCursor: mightHaveNextPage ? pageParam + 1 : undefined,
        }
      } catch (error) {
        console.error('Error fetching project events:', error)
        return {
          data: { activityEvents: { items: [] } },
          nextCursor: undefined,
        }
      }
    },
    getNextPageParam: (lastPage) => {
      return lastPage.nextCursor
    },
  })

  return result
}

export default useOmnichainSubgraphProjectEvents
