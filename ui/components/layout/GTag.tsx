import Script from 'next/script'
import { useEffect } from 'react'
import {
  bindJoinCtaClicks,
  buildGtagInitScript,
  flushPendingGa4,
  safeMeasurementId,
} from '@/lib/analytics/ga4'

export default function GTag({ GTAG }: { GTAG: string }) {
  useEffect(() => {
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
      />
      <Script
        id="gtag-init"
        strategy="afterInteractive"
        onLoad={() => flushPendingGa4()}
        dangerouslySetInnerHTML={{
          __html: buildGtagInitScript(measurementId),
        }}
      />
    </>
  )
}
