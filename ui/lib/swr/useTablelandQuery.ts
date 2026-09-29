import useSWR from 'swr'
import { mutate as globalMutate } from 'swr'
import fetcher from './fetcher'

export type UseTablelandQueryOptions = {
  refreshInterval?: number
  revalidateOnFocus?: boolean
  revalidateOnReconnect?: boolean
  fallbackData?: any
  /** When set, `/api/tableland/query` reads this chain instead of the app default. */
  chainSlug?: string
}

export function useTablelandQuery(
  statement: string | null | undefined,
  options: UseTablelandQueryOptions = {}
) {
  const {
    refreshInterval,
    revalidateOnFocus = false,
    revalidateOnReconnect = false,
    fallbackData,
    chainSlug,
  } = options

  // Build the API URL with the statement parameter. Chain is appended only
  // when a caller asks for one, so existing cache keys stay the same.
  const chainParam = chainSlug?.trim() ? `&chain=${encodeURIComponent(chainSlug.trim())}` : ''
  const key = statement
    ? `/api/tableland/query?statement=${encodeURIComponent(statement)}${chainParam}`
    : null

  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    refreshInterval,
    revalidateOnFocus,
    revalidateOnReconnect,
    fallbackData,
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
