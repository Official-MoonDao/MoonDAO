import { ARRDataPoint } from '@/lib/treasury/arr'
import LineChart, { LineChartData } from '@/components/layout/LineChart'

interface ARRChartProps {
  data: ARRDataPoint[]
  compact?: boolean
  height?: number
  days?: number
  isLoading?: boolean
  defaultRange?: number
}

export function ARRChart({
  data,
  compact = false,
  height = 300,
  isLoading = false,
  defaultRange,
}: ARRChartProps) {
  // Convert timestamps from milliseconds to seconds for LineChart compatibility
  const chartData: LineChartData[] =
    data?.map((point) => ({
      timestamp: Math.floor(point.timestamp / 1000),
      subscriptionARR: Math.round(point.citizenARR + point.teamARR),
      totalARR: Math.round(point.totalARR),
    })) || []

  return (
    <LineChart
      data={chartData}
      isLoading={isLoading}
      height={height}
      compact={compact}
      defaultRange={defaultRange}
      config={{
        timestampField: 'timestamp',
        valueField: 'totalARR',
        dataProcessing: 'direct',
        labels: {
          title: 'Estimated Annual Recurring Revenue',
          valueLabel: compact ? '' : 'USD',
          emptyMessage: 'No ARR Data',
        },
        styling: {
          stroke: '#8B5CF6',
          strokeWidth: compact ? 2 : 4,
          compactStrokeWidth: 2,
        },
        timeRange: {
          compactDays: 365,
        },
        fillMissingDays: true,
      }}
    />
  )
}
