import { useRouter } from 'next/router'
import { useEffect } from 'react'
import {
  MOONBASE_ENGAGED_STORAGE_KEY,
  rememberEntryPath,
  trackMoonbaseEngaged,
} from '@/lib/analytics/ga4'
import {
  isDocumentActive,
  isSceneInteractionTarget,
  retainMoonbaseEngagement,
} from '@/lib/analytics/moonbaseEngagement'

/**
 * Sends moonbase_engaged once per tab: 10 seconds with the tab visible on
 * /moonbase, or the first trusted pointer, wheel, or touch on the globe.
 * Also stores the tab's first pathname for forecast_submitted.
 *
 * The effect depends on router.events, not the router object. Next 13's
 * AppContainer calls makePublicRouterInstance on every render, so useRouter()
 * is a new object whenever /moonbase shallow-replaces ?race= or ?year=.
 * Recreating the clock on that dependency reset the 10s timer. Phones show a
 * still instead of the canvas, so a panel tap is not a 3D interaction and the
 * timer was the only way they were counted.
 */
export function MoonbaseEngagement() {
  const { events } = useRouter()

  useEffect(() => {
    rememberEntryPath(window.location.pathname)
    const { engagement, release } = retainMoonbaseEngagement({
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

    const syncVisible = () => engagement.setVisible(isDocumentActive(document))
    const onInteract = (event: Event) => {
      if (!event.isTrusted) return
      if (!isSceneInteractionTarget(event.target)) return
      engagement.interact()
    }
    const onRoute = (url: string) => engagement.setRoute(pathnameOf(url))

    syncVisible()
    engagement.setRoute(window.location.pathname)

    document.addEventListener('visibilitychange', syncVisible)
    window.addEventListener('focus', syncVisible)
    window.addEventListener('blur', syncVisible)
    window.addEventListener('pageshow', syncVisible)
    window.addEventListener('pagehide', syncVisible)
    document.addEventListener('pointerdown', onInteract, true)
    document.addEventListener('wheel', onInteract, true)
    document.addEventListener('touchstart', onInteract, true)
    events.on('routeChangeComplete', onRoute)

    return () => {
      document.removeEventListener('visibilitychange', syncVisible)
      window.removeEventListener('focus', syncVisible)
      window.removeEventListener('blur', syncVisible)
      window.removeEventListener('pageshow', syncVisible)
      window.removeEventListener('pagehide', syncVisible)
      document.removeEventListener('pointerdown', onInteract, true)
      document.removeEventListener('wheel', onInteract, true)
      document.removeEventListener('touchstart', onInteract, true)
      events.off('routeChangeComplete', onRoute)
      release()
    }
  }, [events])

  return null
}
