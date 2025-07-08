import { useInfiniteQuery } from '@tanstack/react-query'
import { SuckerPair } from 'juice-sdk-core'
import { projectEventsQuery } from './subgraph'

export type EventType =
  | 'payEvent'
  | 'addToBalanceEvent'
  | 'mintTokensEvent'
  | 'cashOutEvent'
  | 'deployedERC20Event'
  | 'projectCreateEvent'
  | 'distributePayoutsEvent'
  | 'distributeReservedTokensEvent'
  | 'distributeToReservedTokenSplitEvent'
  | 'distributeToPayoutSplitEvent'
  | 'useAllowanceEvent'
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
        return { data: { projectEvents: [] }, nextCursor: undefined }

      const query = projectEventsQuery(
        sucker?.projectId.toString() ?? projectId ?? '',
        filter,
        'timestamp',
        'desc',
        PAGE_SIZE,
        pageParam * PAGE_SIZE
      )

      const res = await fetch(`/api/juicebox/query?query=${query}`)
      const data = await res.json()

      const projectEvents = data.projectEvents?.items || []
      const mightHaveNextPage = projectEvents.length === PAGE_SIZE
      return {
        data: { ...data, projectEvents }, // Keep the same structure but use items
        nextCursor: mightHaveNextPage ? pageParam + PAGE_SIZE : undefined,
      }
    },
    getNextPageParam: (lastPage) => {
      return lastPage.nextCursor
    },
  })

  return result
}

export default useOmnichainSubgraphProjectEvents
