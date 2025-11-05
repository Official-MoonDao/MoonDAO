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
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }: { pageParam: number | null }) => {
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
          PAGE_SIZE,
          pageParam // Pass the timestamp cursor for filtering
        )

        const res = await fetch('/api/juicebox/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        })

        console.log('RES', res)

        const data = await res.json()

        console.log('DATA', data)

        const activityEvents = data.activityEvents?.items || []

        // Use the timestamp of the last item as the next cursor
        const nextCursor =
          activityEvents.length === PAGE_SIZE
            ? getTimestampFromLastEvent(
                activityEvents[activityEvents.length - 1]
              )
            : undefined

        return {
          data: { activityEvents: { items: activityEvents } },
          nextCursor,
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

// Helper function to extract timestamp from the last event
function getTimestampFromLastEvent(event: any): number | null {
  if (!event) return null

  // Extract timestamp from the nested event objects
  const eventData =
    event.payEvent ||
    event.addToBalanceEvent ||
    event.mintTokensEvent ||
    event.deployErc20Event ||
    event.projectCreateEvent ||
    event.burnEvent

  return eventData?.timestamp ? Number(eventData.timestamp) : null
}

export default useOmnichainSubgraphProjectEvents
