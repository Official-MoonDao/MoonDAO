import LineChart, { LineChartData } from '@/components/layout/LineChart'

interface AUMChartProps {
  data: LineChartData[]
  compact?: boolean
  height?: number
  days?: number
  isLoading?: boolean
  defaultRange?: number
}

export function AUMChart({
  data,
  compact = false,
  height = 300,
  isLoading = false,
  defaultRange,
}: AUMChartProps) {
  return (
    <LineChart
      data={data}
      isLoading={isLoading}
      height={height}
      compact={compact}
      defaultRange={defaultRange}
      config={{
        timestampField: 'timestamp',
        valueField: 'value',
        dataProcessing: 'direct',
        labels: {
          title: 'Assets Under Management',
          valueLabel: 'USD',
          emptyMessage: 'No AUM Data',
        },
        styling: {
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
