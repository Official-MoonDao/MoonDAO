import Script from 'next/script'
import { useEffect } from 'react'
import {
  bindJoinCtaClicks,
  buildGtagInitScript,
  flushPendingGa4,
  installGa4HistoryGuards,
  safeMeasurementId,
} from '@/lib/analytics/ga4'

export default function GTag({ GTAG }: { GTAG: string }) {
  useEffect(() => {
    installGa4HistoryGuards()
    const unbind = bindJoinCtaClicks()
    const timers = [0, 250, 1000, 3000].map((ms) => window.setTimeout(flushPendingGa4, ms))
    return () => {
      unbind()
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  const measurementId = safeMeasurementId(GTAG)

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
        onLoad={() => {
          // gtag.js wraps history while it loads. Install after that so a
          // shallow Next.js update calls the original method and does not
          // add a page view.
          installGa4HistoryGuards()
          flushPendingGa4()
        }}
      />
      <Script
        id="gtag-init"
        strategy="afterInteractive"
        onLoad={() => {
          installGa4HistoryGuards()
          flushPendingGa4()
        }}
        dangerouslySetInnerHTML={{
          __html: buildGtagInitScript(measurementId),
        }}
      />
    </>
  )
}
