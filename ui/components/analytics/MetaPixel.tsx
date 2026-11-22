import { useRouter } from 'next/router'
import { useEffect } from 'react'
import {
  CONSENT_CHANGE_EVENT,
  META_PIXEL_ID,
  isPixelPath,
  pixelPageView,
} from '@/lib/analytics/metaPixel'

/**
 * Sends a Meta Pixel PageView on funnel pages (see lib/analytics/metaPixel.ts
 * for the consent rules). Renders nothing, and does nothing when no pixel ID
 * is configured.
 */
export default function MetaPixel() {
  const router = useRouter()

  useEffect(() => {
    if (!META_PIXEL_ID) return
    let lastPath: string | null = null
    const onPath = (path: string) => {
      const pathname = path.split(/[?#]/)[0]
      if (!isPixelPath(pathname) || pathname === lastPath) return
      lastPath = pathname
      pixelPageView()
    }
    const onRoute = (url: string) => onPath(url)
    // Consent can arrive after the first render (cookie banner, geo lookup).
    const onConsent = () => {
      lastPath = null
      onPath(window.location.pathname)
    }

    onPath(window.location.pathname)
    router.events.on('routeChangeComplete', onRoute)
    window.addEventListener(CONSENT_CHANGE_EVENT, onConsent)
    return () => {
      router.events.off('routeChangeComplete', onRoute)
      window.removeEventListener(CONSENT_CHANGE_EVENT, onConsent)
    }
  }, [router])

  return null
}
