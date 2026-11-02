import { useRouter } from 'next/router'
import { useEffect } from 'react'
import {
  MOONBASE_ENGAGED_STORAGE_KEY,
  rememberEntryPath,
  trackMoonbaseEngaged,
} from '@/lib/analytics/ga4'
import {
  createMoonbaseEngagement,
  isSceneInteractionTarget,
} from '@/lib/analytics/moonbaseEngagement'

/**
 * Sends moonbase_engaged once per tab: 10 seconds with the tab visible on
 * /moonbase, or the first trusted pointer, wheel, or touch on the globe.
 * Also stores the tab's first pathname for forecast_submitted.
 */
export function MoonbaseEngagement() {
  const router = useRouter()

  useEffect(() => {
    rememberEntryPath(window.location.pathname)
    const engagement = createMoonbaseEngagement({
      now: () => Date.now(),
      schedule: (ms, callback) => window.setTimeout(callback, ms),
      clear: (id) => window.clearTimeout(id as ReturnType<typeof window.setTimeout>),
      hasFired: () => {
        try {
          return window.sessionStorage.getItem(MOONBASE_ENGAGED_STORAGE_KEY) === '1'
        } catch {
          return false
        }
      },
      fire: () => trackMoonbaseEngaged(),
    })

    const pathnameOf = (url: string) => {
      try {
        return new URL(url, window.location.origin).pathname
      } catch {
        return window.location.pathname
      }
    }

    engagement.setVisible(document.visibilityState === 'visible')
    engagement.setRoute(window.location.pathname)

    const onVisible = () => engagement.setVisible(document.visibilityState === 'visible')
    const onInteract = (event: Event) => {
      if (!event.isTrusted) return
      if (!isSceneInteractionTarget(event.target)) return
      engagement.interact()
    }
    const onRoute = (url: string) => engagement.setRoute(pathnameOf(url))

    document.addEventListener('visibilitychange', onVisible)
    document.addEventListener('pointerdown', onInteract, true)
    document.addEventListener('wheel', onInteract, true)
    document.addEventListener('touchstart', onInteract, true)
    router.events.on('routeChangeComplete', onRoute)

    return () => {
      engagement.dispose()
      document.removeEventListener('visibilitychange', onVisible)
      document.removeEventListener('pointerdown', onInteract, true)
      document.removeEventListener('wheel', onInteract, true)
      document.removeEventListener('touchstart', onInteract, true)
      router.events.off('routeChangeComplete', onRoute)
    }
  }, [router])

  return null
}
