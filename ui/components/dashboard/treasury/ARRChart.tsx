import { ARRDataPoint } from '@/lib/covalent'
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
  const chartData: LineChartData[] = data.map((point) => ({
    timestamp: point.timestamp,
    arr: point.arr,
  }))

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
          valueLabel: 'USD',
          emptyMessage: 'No ARR Data',
        },
        styling: {
          stroke: '#8B5CF6',
          strokeWidth: 4,
          compactStrokeWidth: 1.5,
        },
        timeRange: {
          compactDays: 365,
        },
      }}
    />
  )
}
