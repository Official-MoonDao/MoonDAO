import { ARRDataPoint } from '@/lib/treasury/arr'
import LineChart, { LineChartData } from '@/components/layout/LineChart'

interface ARRChartProps {
  data: ARRDataPoint[]
  compact?: boolean
  height?: number
  days?: number
  isLoading?: boolean
}

export function ARRChart({
  data,
  compact = false,
  height = 300,
  isLoading = false,
}: ARRChartProps) {
  // Transform ARR data to LineChart format
  // Convert timestamps from milliseconds to seconds for LineChart compatibility
  const chartData: LineChartData[] =
    data?.map((point) => ({
      timestamp: Math.floor(point.timestamp / 1000), // Convert to seconds
      arr: Math.round(point.arr), // Round to nearest dollar for cleaner display
    })) || []

  return (
    <LineChart
      data={chartData}
      isLoading={isLoading}
      height={height}
      compact={compact}
      config={{
        timestampField: 'timestamp',
        valueField: 'arr',
        dataProcessing: 'direct',
        labels: {
          title: 'Annual Recurring Revenue',
          valueLabel: compact ? '' : 'USD', // Hide label in compact mode
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
