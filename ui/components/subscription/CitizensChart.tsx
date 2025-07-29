import LineChart from '../layout/LineChart'

export type CitizensChartProps = {
  transfers: {
    id: string
    from: string
    blockTimestamp: string
  }[]
  isLoading: boolean
  height: number
  compact?: boolean
  createdAt?: number
  defaultRange?: number
}

export default function CitizensChart({
  transfers,
  isLoading,
  height,
  compact = false,
  createdAt = 0,
  defaultRange,
}: CitizensChartProps) {
  return (
    <LineChart
      data={transfers}
      isLoading={isLoading}
      height={height}
      compact={compact}
      createdAt={createdAt}
      defaultRange={defaultRange}
      config={{
        timestampField: 'blockTimestamp',
        valueField: 'citizens',
        dataProcessing: 'cumulative',
        labels: {
          title: 'Citizens',
          valueLabel: 'Citizens',
          emptyMessage: 'No Citizens Yet',
        },
        styling: {
          stroke: 'white',
          color: 'white',
          backgroundColor: 'black',
          fontSize: '0.75rem',
          strokeWidth: 4,
          compactStrokeWidth: 1.5,
        },
        timeRange: {
          compactDays: 365,
        },
        fillMissingDays: true,
      }}
    />
  )
}
