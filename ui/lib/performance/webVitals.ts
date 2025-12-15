// Type definition for Next.js Web Vitals
export interface NextWebVitalsMetric {
  id: string
  name: string
  value: number
  label: 'web-vital' | 'custom'
  startTime?: number
}

const vitalsUrl = '/api/vitals'

function getConnectionSpeed(): string {
  if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    const conn = (navigator as any).connection
    return conn?.effectiveType || 'unknown'
  }
  return 'unknown'
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
  const body = {
    id: metric.id,
    name: metric.name,
    value: metric.value,
    label: metric.label,
    url: typeof window !== 'undefined' ? window.location.href : '',
    connectionSpeed: getConnectionSpeed(),
    navigationType: typeof performance !== 'undefined' 
      ? (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type || 'unknown'
      : 'unknown',
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Web Vitals]', body.name, body.value, body.label)
  }

  // Send to analytics endpoint
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(vitalsUrl, JSON.stringify(body))
  } else if (typeof fetch !== 'undefined') {
    fetch(vitalsUrl, {
      body: JSON.stringify(body),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(console.error)
  }
}

// Monitor long tasks (>50ms)
export function monitorLongTasks() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          console.warn('[Performance] Long task detected:', {
            duration: entry.duration,
            startTime: entry.startTime,
          })

          // Send to analytics
          fetch('/api/vitals', {
            body: JSON.stringify({
              name: 'LONG_TASK',
              value: entry.duration,
              url: window.location.href,
            }),
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
          }).catch(() => {})
        }
      }
    })

    observer.observe({ entryTypes: ['longtask'] })
  } catch (error) {
    // PerformanceObserver not fully supported
  }
}

// Monitor page visibility for battery optimization
export function monitorPageVisibility(onVisibilityChange?: (hidden: boolean) => void) {
  if (typeof document === 'undefined') return

  let hiddenTime = 0
  let visibleTime = Date.now()

  const handleVisibilityChange = () => {
    if (document.hidden) {
      hiddenTime = Date.now()
      const timeVisible = hiddenTime - visibleTime

      // Report time visible
      fetch('/api/vitals', {
        body: JSON.stringify({
          name: 'TIME_VISIBLE',
          value: timeVisible,
          url: window.location.href,
        }),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {})

      onVisibilityChange?.(true)
    } else {
      visibleTime = Date.now()
      onVisibilityChange?.(false)
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}

