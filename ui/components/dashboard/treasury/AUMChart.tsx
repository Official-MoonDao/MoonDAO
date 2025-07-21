// components/treasury/AUMChart.tsx
import LineChart, { LineChartData } from '@/components/layout/LineChart'

interface AUMChartProps {
  data: LineChartData[]
  compact?: boolean
  height?: number
  days?: number
  isLoading?: boolean
}

export function AUMChart({
  data,
  compact = false,
  height = 300,
  isLoading = false,
}: AUMChartProps) {
  return (
    <LineChart
      data={data}
      isLoading={isLoading}
      height={height}
      compact={compact}
      config={{
        timestampField: 'timestamp',
        valueField: 'aum',
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
      }}
    />
  )
}
