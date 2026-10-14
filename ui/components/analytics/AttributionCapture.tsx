import { useRouter } from 'next/router'
import { useEffect } from 'react'
import {
  captureClientAttribution,
  decorateRouterUrl,
  getPassthroughParams,
  withAttribution,
  type DecoratableUrl,
} from '@/lib/analytics/attribution'

/**
 * Records the landing touch and keeps campaign params on later funnel
 * navigations. Next.js Link and router.push both go through router.push, so
 * patching it covers the home to /join to /citizen path without rewriting
 * every CTA. Stored values remain the source of truth when a URL drops them.
 */
export default function AttributionCapture() {
  const router = useRouter()

  useEffect(() => {
    captureClientAttribution()

    const onRoute = () => captureClientAttribution()
    router.events.on('routeChangeComplete', onRoute)

    const mutable = router as typeof router & {
      push: typeof router.push
      replace: typeof router.replace
    }
    const originalPush = mutable.push.bind(router)
    const originalReplace = mutable.replace.bind(router)

    const decorate = (url: Parameters<typeof router.push>[0]) => {
      try {
        return decorateRouterUrl(url as DecoratableUrl, getPassthroughParams()) as Parameters<
          typeof router.push
        >[0]
      } catch {
        return url
      }
    }
    const decorateAs = (as: Parameters<typeof router.push>[1]) => {
      if (typeof as !== 'string') return as
      try {
        return withAttribution(as, getPassthroughParams())
      } catch {
        return as
      }
    }

    mutable.push = ((url, as, options) =>
      originalPush(decorate(url), decorateAs(as), options)) as typeof router.push
    mutable.replace = ((url, as, options) =>
      originalReplace(decorate(url), decorateAs(as), options)) as typeof router.replace

    return () => {
      router.events.off('routeChangeComplete', onRoute)
      mutable.push = originalPush
      mutable.replace = originalReplace
    }
  }, [router])

  return null
}
