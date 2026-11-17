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
 * Some in-app browsers report visibilityState 'hidden' while the page is on
 * screen. A focused document is showing. A background tab is hidden and not
 * focused, so it still does not count.
 */
export function isDocumentActive(doc: {
  visibilityState?: string
  hasFocus?: () => boolean
}): boolean {
  if (doc.visibilityState === 'visible') return true
  try {
    return typeof doc.hasFocus === 'function' && doc.hasFocus()
  } catch {
    return false
  }
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

type RetainedEngagement = {
  engagement: MoonbaseEngagement
  refs: number
  drop: unknown
  clear: (id: unknown) => void
}

let retained: RetainedEngagement | null = null

/** Test hook. Production clears the clock by releasing the last subscriber. */
export function resetMoonbaseEngagementState() {
  if (!retained) return
  if (retained.drop != null) {
    try {
      retained.clear(retained.drop)
    } catch {
      // The scheduler may already have dropped the id.
    }
  }
  retained.engagement.dispose()
  retained = null
}

/**
 * One clock per tab. Next's pages router builds a new useRouter() object on
 * every render, and the /moonbase effect used to depend on it. Cleanup then
 * ran on each shallow ?race= / ?year= replace and the 10s timer started over.
 * Release defers dispose by one turn so a synchronous re-subscribe keeps the
 * time already accumulated.
 */
export function retainMoonbaseEngagement(options: {
  now: () => number
  schedule: (ms: number, callback: () => void) => unknown
  clear: (id: unknown) => void
  hasFired: () => boolean
  fire: () => void
}): { engagement: MoonbaseEngagement; release: () => void } {
  if (!retained) {
    retained = {
      engagement: createMoonbaseEngagement(options),
      refs: 0,
      drop: null,
      clear: options.clear,
    }
  } else if (retained.drop != null) {
    retained.clear(retained.drop)
    retained.drop = null
    retained.clear = options.clear
  }
  const current = retained
  current.refs += 1
  let released = false
  return {
    engagement: current.engagement,
    release() {
      if (released) return
      released = true
      current.refs -= 1
      if (current.refs > 0 || retained !== current) return
      current.drop = options.schedule(0, () => {
        current.drop = null
        if (retained !== current || current.refs > 0) return
        current.engagement.dispose()
        retained = null
      })
    },
  }
}
