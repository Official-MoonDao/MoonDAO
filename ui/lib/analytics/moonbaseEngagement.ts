import { isMoonbasePath } from '@/lib/analytics/ga4'

/** Ten seconds with the tab visible, matching GA4's engaged-session threshold. */
export const MOONBASE_VISIBLE_MS = 10_000

export type MoonbaseEngagement = {
  setRoute: (pathname: string) => void
  setVisible: (visible: boolean) => void
  interact: () => void
  dispose: () => void
}

/**
 * True when the event target is the WebGL canvas or sits inside it.
 * Panels and links on the same page are not a 3D interaction.
 */
export function isSceneInteractionTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false
  const element = target as { closest?: (selector: string) => unknown; tagName?: string }
  if (typeof element.closest === 'function') {
    try {
      return Boolean(element.closest('canvas'))
    } catch {
      return false
    }
  }
  return String(element.tagName || '').toUpperCase() === 'CANVAS'
}

/**
 * Fires once. Visible time counts only while the tab is in the foreground and
 * the route is /moonbase. Leaving the page or hiding the tab pauses the clock.
 * A trusted canvas interaction fires immediately.
 */
export function createMoonbaseEngagement(options: {
  now: () => number
  schedule: (ms: number, callback: () => void) => unknown
  clear: (id: unknown) => void
  hasFired: () => boolean
  fire: () => void
}): MoonbaseEngagement {
  let fired = false
  try {
    fired = options.hasFired()
  } catch {
    fired = false
  }
  let onMoonbase = false
  let visible = false
  let accumulated = 0
  let visibleSince: number | null = null
  let timer: unknown = null

  function elapsed() {
    if (visibleSince == null) return accumulated
    return accumulated + Math.max(0, options.now() - visibleSince)
  }

  function stopClock() {
    if (visibleSince != null) {
      accumulated += Math.max(0, options.now() - visibleSince)
      visibleSince = null
    }
    if (timer != null) {
      options.clear(timer)
      timer = null
    }
  }

  function arm() {
    if (fired || !onMoonbase || !visible) return
    if (visibleSince == null) visibleSince = options.now()
    const remain = MOONBASE_VISIBLE_MS - elapsed()
    if (remain <= 0) {
      maybeFire(false)
      return
    }
    if (timer != null) options.clear(timer)
    timer = options.schedule(remain, () => {
      timer = null
      maybeFire(false)
    })
  }

  function maybeFire(interaction: boolean) {
    if (fired || !onMoonbase) return
    if (!interaction && elapsed() + 5 < MOONBASE_VISIBLE_MS) {
      arm()
      return
    }
    fired = true
    stopClock()
    try {
      options.fire()
    } catch {
      // Measurement must not break the page.
    }
  }

  return {
    setRoute(pathname: string) {
      const next = isMoonbasePath(pathname)
      if (next === onMoonbase) return
      stopClock()
      onMoonbase = next
      arm()
    },
    setVisible(next: boolean) {
      if (next === visible) return
      if (!next) stopClock()
      visible = next
      arm()
    },
    interact() {
      maybeFire(true)
    },
    dispose() {
      stopClock()
    },
  }
}
