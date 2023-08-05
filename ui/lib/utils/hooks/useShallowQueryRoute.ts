import { useRouter } from 'next/router'

export function useShallowQueryRoute() {
  const router = useRouter()

  function shallowQueryRoute(query: any) {
    router.push(
      {
        query: query,
      },
      undefined,
      { shallow: true }
    )
  }

  return shallowQueryRoute
}
