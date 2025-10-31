import useSWR from 'swr'
import { mutate as globalMutate } from 'swr'
import fetcher from './fetcher'

export type UseTablelandQueryOptions = {
  refreshInterval?: number
  revalidateOnFocus?: boolean
  revalidateOnReconnect?: boolean
}

export function useTablelandQuery(
  statement: string | null | undefined,
  options: UseTablelandQueryOptions = {}
) {
  const {
    refreshInterval,
    revalidateOnFocus = false,
    revalidateOnReconnect = false,
  } = options

  const key = statement
    ? `/api/tableland/query?statement=${encodeURIComponent(statement)}`
    : null

  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    refreshInterval,
    revalidateOnFocus,
    revalidateOnReconnect,
  })

  return {
    data,
    isLoading,
    error,
    mutate,
  }
}

export function mutateTablelandQuery(statement: string, data?: any) {
  const key = `/api/tableland/query?statement=${encodeURIComponent(statement)}`
  return globalMutate(key, data)
}
