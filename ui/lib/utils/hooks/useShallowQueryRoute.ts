import { useRouter } from 'next/router'
import { mergeAttributionQuery } from '@/lib/analytics/attribution'

export function useShallowQueryRoute() {
  const router = useRouter()

  function shallowQueryRoute(query: any) {
    router.push(
      {
        query: mergeAttributionQuery(router.query, query),
      },
      undefined,
      { shallow: true }
    )
  }

  return shallowQueryRoute
}
