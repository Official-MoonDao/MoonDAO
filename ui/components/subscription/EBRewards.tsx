import { CurrencyDollarIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { LoadingSpinner } from '../layout/LoadingSpinner'

interface EBRewardResult {
  quarter: number
  year: number
  treasuryGrowth: {
    currentQuarterAvgUSD: number
    previousQuarterAvgUSD: number
    growthUSD: number
    rewardUSD: number
    rewardETH: number
  }
  revenue: {
    annualRevenueUSD: number
    rewardUSD: number
    rewardETH: number
  }
  totalRewardETH: number
  memberAllocations: Array<{
    address: string
    name: string
    rewardPercentage: number
    rewardETH: number
  }>
  ethPrice: number
  calculatedAt: string
}

interface EBRewardsProps {
  isManager: boolean
  teamId: string | number
}

export default function EBRewards({ isManager, teamId }: EBRewardsProps) {
  const [selectedQuarter, setSelectedQuarter] = useState<number>(() => {
    const now = new Date()
    return Math.floor(now.getMonth() / 3) + 1
  })
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return new Date().getFullYear()
  })
  const [rewards, setRewards] = useState<EBRewardResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isManager) return

    const fetchRewards = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/eb/rewards?quarter=${selectedQuarter}&year=${selectedYear}`
        )
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('Access denied: Executive Branch membership required')
          }
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to fetch rewards')
        }
        const data = await response.json()
        setRewards(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load rewards')
      } finally {
        setLoading(false)
      }
    }

    fetchRewards()
  }, [selectedQuarter, selectedYear, isManager])

  const formatETH = (value: number) => {
    return value.toFixed(4)
  }

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  if (!isManager) {
    return null
  }

  return (
    <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-white">Rewards</h2>
        <div className="flex gap-4">
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(parseInt(e.target.value, 10))}
            className="bg-slate-700/50 border border-slate-600 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={1}>Q1</option>
            <option value={2}>Q2</option>
            <option value={3}>Q3</option>
            <option value={4}>Q4</option>
          </select>
          <input
            type="number"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            min={2020}
            max={2100}
            className="bg-slate-700/50 border border-slate-600 text-white rounded-lg px-4 py-2 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner width="w-8" height="h-8" />
          <span className="ml-3 text-slate-200">Loading rewards...</span>
        </div>
      ) : error ? (
        <div className="bg-red-900/30 backdrop-blur-md border border-red-700/50 rounded-2xl p-6 text-red-200 shadow-xl">
          <p className="font-semibold mb-2">Error loading rewards</p>
          <p>{error}</p>
        </div>
      ) : rewards ? (
        <div className="space-y-6">
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <CurrencyDollarIcon className="w-6 h-6 text-green-400" />
              <h3 className="text-lg font-semibold text-white">Treasury Growth</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-200">
                <span>Previous Quarter Avg:</span>
                <span className="text-white">
                  {formatUSD(rewards.treasuryGrowth.previousQuarterAvgUSD)}
                </span>
              </div>
              <div className="flex justify-between text-slate-200">
                <span>Current Quarter Avg:</span>
                <span className="text-white">
                  {formatUSD(rewards.treasuryGrowth.currentQuarterAvgUSD)}
                </span>
              </div>
              <div className="flex justify-between text-slate-200">
                <span>Growth:</span>
                <span className="text-white">{formatUSD(rewards.treasuryGrowth.growthUSD)}</span>
              </div>
              <div className="pt-2 border-t border-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-200">Reward (2%):</span>
                  <span className="text-green-400 font-semibold">
                    {formatETH(rewards.treasuryGrowth.rewardETH)} ETH
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  {formatUSD(rewards.treasuryGrowth.rewardUSD)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-900/30 backdrop-blur-md border border-blue-700/50 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Total Reward</h3>
                <p className="text-sm text-blue-200">
                  Q{rewards.quarter} {rewards.year}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-white">
                  {formatETH(rewards.totalRewardETH)} ETH
                </div>
                <div className="text-sm text-blue-200 mt-1">
                  ETH Price: {formatUSD(rewards.ethPrice)}
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-300 text-center">
            Calculated at: {new Date(rewards.calculatedAt).toLocaleString()}
          </div>

          <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 mt-6">
            <details className="cursor-pointer">
              <summary className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">
                How Rewards Are Calculated
              </summary>
              <div className="mt-4 space-y-3 text-xs text-slate-400 leading-relaxed">
                <div>
                  <p className="font-semibold text-slate-300 mb-2">1. API Request Flow</p>
                  <p>
                    When you select a quarter and year, the component calls{' '}
                    <code className="bg-slate-900/50 px-1 rounded">/api/eb/rewards</code> with the
                    selected parameters. The API endpoint is protected by manager authentication
                    middleware.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-300 mb-2">2. Treasury Data Fetching</p>
                  <p>
                    The calculation starts by fetching treasury AUM (Assets Under Management)
                    history from CoinStats API using{' '}
                    <code className="bg-slate-900/50 px-1 rounded">getAUMHistory()</code>. This
                    retrieves daily portfolio value snapshots for the last 365 days, including:
                  </p>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                    <li>Portfolio value from CoinStats (includes all tracked assets)</li>
                    <li>DeFi balance from Uniswap pools and other protocols</li>
                    <li>Historical data points with timestamps and USD values</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-slate-300 mb-2">
                    3. Quarterly Average Calculation
                  </p>
                  <p>For both the current and previous quarters, the system:</p>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                    <li>
                      Determines the quarter date range (e.g., Q4 2025 = Oct 1 - Dec 31, 2025)
                    </li>
                    <li>
                      Filters AUM history data points that fall within each quarter's timeframe
                    </li>
                    <li>
                      Calculates the average USD value by summing all data points and dividing by
                      the count
                    </li>
                    <li>
                      If no data points exist for a quarter, uses the closest available data point
                    </li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-slate-300 mb-2">4. Growth Calculation</p>
                  <p>
                    Treasury growth is calculated as:{' '}
                    <code className="bg-slate-900/50 px-1 rounded">
                      Growth = Current Quarter Avg - Previous Quarter Avg
                    </code>
                  </p>
                  <p className="mt-1">
                    If growth is negative (treasury decreased), the reward is $0. Only positive
                    growth generates rewards.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-300 mb-2">5. Reward Calculation</p>
                  <p>
                    The EB reward is 2% of the positive growth:{' '}
                    <code className="bg-slate-900/50 px-1 rounded">Reward USD = Growth × 0.02</code>
                  </p>
                  <p className="mt-1">
                    The USD reward is then converted to ETH using the current ETH price.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-300 mb-2">6. ETH Price Fetching</p>
                  <p>ETH price is fetched from either:</p>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                    <li>
                      Etherscan API (if{' '}
                      <code className="bg-slate-900/50 px-1 rounded">
                        NEXT_PUBLIC_ETHERSCAN_API_KEY
                      </code>{' '}
                      is configured)
                    </li>
                    <li>Coinbase API as a fallback (no API key required)</li>
                  </ul>
                  <p className="mt-1">
                    The ETH price is used to convert the USD reward amount to ETH:{' '}
                    <code className="bg-slate-900/50 px-1 rounded">
                      Reward ETH = Reward USD ÷ ETH Price
                    </code>
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-700/50">
                  <p className="text-slate-300 font-semibold">Key Files:</p>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                    <li>
                      <code className="bg-slate-900/50 px-1 rounded">
                        ui/pages/api/eb/rewards.ts
                      </code>{' '}
                      - API endpoint
                    </li>
                    <li>
                      <code className="bg-slate-900/50 px-1 rounded">
                        ui/lib/treasury/eb-rewards.ts
                      </code>{' '}
                      - Calculation logic
                    </li>
                    <li>
                      <code className="bg-slate-900/50 px-1 rounded">
                        ui/lib/coinstats/index.ts
                      </code>{' '}
                      - Treasury data fetching
                    </li>
                    <li>
                      <code className="bg-slate-900/50 px-1 rounded">
                        ui/lib/etherscan/index.ts
                      </code>{' '}
                      - ETH price fetching
                    </li>
                  </ul>
                </div>
              </div>
            </details>
          </div>
        </div>
      ) : null}
    </div>
  )
}
