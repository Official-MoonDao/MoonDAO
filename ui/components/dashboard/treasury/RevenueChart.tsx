import { RevenueDataPoint } from '@/lib/treasury/revenue'
import LineChart, { LineChartData } from '@/components/layout/LineChart'

interface RevenueChartProps {
  data: RevenueDataPoint[]
  dataCategories?: any[]
  compact?: boolean
  height?: number
  days?: number
  isLoading?: boolean
  defaultRange?: number
}

const DATA_CATEGORIES = [
  { name: 'Citizens' },
  { name: 'Teams' },
  { name: 'Pool Fees' },
  { name: 'Staked ETH Rewards' },
]

export function RevenueChart({
  data,
  dataCategories,
  compact = false,
  height = 300,
  isLoading = false,
  defaultRange,
}: RevenueChartProps) {
  const chartData: LineChartData[] =
    data?.map((point) => ({
      timestamp: Math.floor(point.timestamp / 1000),
      citizenRevenue: Math.round(point.citizenRevenue),
      teamRevenue: Math.round(point.teamRevenue),
      defiRevenue: Math.round(point.defiRevenue),
      stakingRevenue: Math.round(point.stakingRevenue),
      totalRevenue: Math.round(point.totalRevenue),
    })) || []

  return (
    <LineChart
      data={chartData}
      dataCategories={dataCategories || DATA_CATEGORIES}
      isLoading={isLoading}
      height={height}
      compact={compact}
      defaultRange={defaultRange}
      config={{
        timestampField: 'timestamp',
        valueField: 'totalRevenue',
        dataProcessing: 'direct',
        labels: {
          title: 'Annual Revenue',
          valueLabel: compact ? '' : 'USD',
          emptyMessage: 'No Revenue Data',
        },
        styling: {
          stroke: 'white',
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
