import { track } from '@vercel/analytics'

export interface NextWebVitalsMetric {
  id: string
  name: string
  value: number
  label: 'web-vital' | 'custom'
  startTime?: number
  rating?: 'good' | 'needs-improvement' | 'poor'
}

function getConnectionSpeed(): string {
  if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    const conn = (navigator as any).connection
    return conn?.effectiveType || 'unknown'
  }
  return 'unknown'
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
  // Vercel Analytics automatically captures web vitals (CLS, FCP, FID, LCP, TTFB, INP)
  // We only track custom metrics explicitly
  if (metric.label === 'custom') {
    track(metric.name, {
      value: metric.value,
      id: metric.id,
    })
  }

  if (process.env.NODE_ENV === 'development') {
    const connectionSpeed = getConnectionSpeed()
    const navigationType =
      typeof performance !== 'undefined'
        ? (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type ||
          'unknown'
        : 'unknown'

    console.log('[Web Vitals]', {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      label: metric.label,
      connectionSpeed,
      navigationType,
      url: typeof window !== 'undefined' ? window.location.href : '',
    })
  }
}

// Monitor long tasks (>50ms)
export function monitorLongTasks() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[Performance] Long task detected:', {
              duration: entry.duration,
              startTime: entry.startTime,
            })
          }

          // Send custom metric to Vercel Analytics
          track('long_task', {
            duration: entry.duration,
            startTime: entry.startTime,
            url: window.location.pathname,
          })
        }
      }
    })

    observer.observe({ entryTypes: ['longtask'] })
  } catch (error) {
    // PerformanceObserver not fully supported
  }
}

export function monitorPageVisibility(onVisibilityChange?: (hidden: boolean) => void) {
  if (typeof document === 'undefined') return

  let hiddenTime = 0
  let visibleTime = Date.now()

  const handleVisibilityChange = () => {
    if (document.hidden) {
      hiddenTime = Date.now()
      const timeVisible = hiddenTime - visibleTime

      if (timeVisible > 5000) {
        track('time_visible', {
          duration: timeVisible,
          url: window.location.pathname,
        })
      }

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
