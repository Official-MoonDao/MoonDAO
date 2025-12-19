import { useRouter } from 'next/router'
import { useEffect, useCallback, useState } from 'react'

export interface UseOnrampRedirectReturn {
  isReturningFromOnramp: boolean
  clearRedirectParams: () => void
  generateRedirectUrl: (additionalParams?: Record<string, string>) => string
}

export function useOnrampRedirect(): UseOnrampRedirectReturn {
  const router = useRouter()
  const [isReturningFromOnramp, setIsReturningFromOnramp] = useState(false)

  useEffect(() => {
    if (router.isReady) {
      setIsReturningFromOnramp(router.query.onrampSuccess === 'true')
    }
  }, [router.isReady, router.query.onrampSuccess])

  const clearRedirectParams = useCallback(() => {
    if (router.query.onrampSuccess) {
      const { onrampSuccess, ...restQuery } = router.query
      router.replace(
        {
          pathname: router.pathname,
          query: restQuery,
        },
        undefined,
        { shallow: true }
      )
      setIsReturningFromOnramp(false)
    }
  }, [router])

  const generateRedirectUrl = useCallback(
    (additionalParams?: Record<string, string>) => {
      const currentPath = router.asPath.split('?')[0]
      const currentQuery = { ...router.query }
      currentQuery.onrampSuccess = 'true'

      if (additionalParams) {
        Object.entries(additionalParams).forEach(([key, value]) => {
          currentQuery[key] = value
        })
      }

      const queryString = new URLSearchParams(
        Object.entries(currentQuery).reduce((acc, [key, value]) => {
          // Filter out Privy OAuth params
          if (key.startsWith('privy_')) {
            return acc
          }
          if (value !== undefined && value !== null) {
            acc[key] = String(value)
          }
          return acc
        }, {} as Record<string, string>)
      ).toString()

      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://moondao.com'
      return `${origin}${currentPath}${queryString ? `?${queryString}` : ''}`
    },
    [router]
  )

  return {
    isReturningFromOnramp,
    clearRedirectParams,
    generateRedirectUrl,
  }
}
