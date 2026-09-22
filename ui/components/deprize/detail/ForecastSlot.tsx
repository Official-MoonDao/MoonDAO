import type { ComponentProps } from 'react'
import ForecastPanel from '@/components/deprize/ForecastPanel'

/** Competitors and predictions are one panel; this is where the page mounts it. */
export default function ForecastSlot(props: ComponentProps<typeof ForecastPanel>) {
  return (
    <div className="flex flex-col gap-4">
      <ForecastPanel {...props} />
    </div>
  )
}
