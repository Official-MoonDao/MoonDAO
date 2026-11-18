import { trackForecastShared } from '@/lib/analytics/ga4'
import { forecastShareText, forecastShareUrl } from '@/lib/forecasts/forecastShare'
import { TOUCH } from '@/components/deprize/detail/primitives'
import ShareButtons from '@/components/layout/ShareButtons'

function currentPath(): string {
  if (typeof window === 'undefined') return '/deprize'
  return window.location.pathname || '/deprize'
}

/**
 * Small prompt after a free forecast is saved. The X link opens the composer;
 * nothing is posted on the visitor's behalf.
 */
export default function ForecastSharePrompt(props: { pick?: string | null }) {
  const path = currentPath()
  return (
    <div
      data-testid="forecast-share"
      className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
    >
      <p className="text-sm font-semibold text-white">Share your forecast</p>
      <ShareButtons
        className="mt-3"
        url={forecastShareUrl(path, 'x')}
        copyUrl={forecastShareUrl(path, 'copy')}
        text={forecastShareText(props.pick)}
        intent="post"
        shareLabel="Share on X"
        buttonClassName={TOUCH}
        onShareClick={() => trackForecastShared('x')}
        onCopied={() => trackForecastShared('copy')}
      />
    </div>
  )
}
