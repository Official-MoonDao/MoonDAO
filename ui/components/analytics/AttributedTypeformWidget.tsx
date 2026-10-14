import { Widget } from '@typeform/embed-react'
import { ComponentProps, useEffect, useState } from 'react'
import { getAttribution, typeformHiddenFields } from '@/lib/analytics/attribution'

type WidgetProps = ComponentProps<typeof Widget>

type AttributedTypeformWidgetProps = {
  id: string
  onSubmit: WidgetProps['onSubmit']
  height: number
  className?: string
}

export default function AttributedTypeformWidget({
  id,
  onSubmit,
  height,
  className,
}: AttributedTypeformWidgetProps) {
  const [hidden, setHidden] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    setHidden(typeformHiddenFields(getAttribution()))
  }, [])

  if (!hidden) {
    return <div style={{ width: '100%', height }} />
  }

  return (
    <Widget
      className={className}
      id={id}
      onSubmit={onSubmit}
      height={height}
      hidden={Object.keys(hidden).length ? hidden : undefined}
    />
  )
}
