import { CurrencyDollarIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
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
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  useEffect(() => {
    if (!isManager) return

    // Clear old rewards immediately when selection changes
    setRewards(null)

    const fetchRewards = async () => {
      setLoading(true)
      setError(null)
      try {
        const nocache = refreshTrigger > 0 ? '&nocache=1' : ''
        const response = await fetch(
          `/api/eb/rewards?quarter=${selectedQuarter}&year=${selectedYear}${nocache}`
        )

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('Access denied: Executive Branch membership required')
          }
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to fetch rewards')
        }
        const data = await response.json()

        // Verify the response matches what we requested
        if (data.quarter !== selectedQuarter || data.year !== selectedYear) {
          console.error(
            `[EB Rewards UI] MISMATCH! Requested Q${selectedQuarter} ${selectedYear} but got Q${data.quarter} ${data.year}`
          )
        }

        setRewards(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load rewards')
      } finally {
        setLoading(false)
      }
    }

    fetchRewards()
  }, [selectedQuarter, selectedYear, isManager, refreshTrigger])

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

  const isIncompleteQuarter = () => {
    const now = new Date()
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1
    const currentYear = now.getFullYear()
    return selectedQuarter === currentQuarter && selectedYear === currentYear
  }

  if (!isManager) {
    return null
  }

  return (
    <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-white">Rewards</h2>
        <div className="flex gap-3">
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
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="bg-slate-700/50 border border-slate-600 text-white rounded-lg px-4 py-2 hover:bg-slate-600/50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Refresh data (bypass cache)"
          >
            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
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
          {(rewards.quarter !== selectedQuarter || rewards.year !== selectedYear) && (
            <div className="bg-red-900/30 backdrop-blur-md border border-red-700/50 rounded-xl p-4 text-red-200 text-sm">
              <p className="font-semibold">Data Mismatch Warning</p>
              <p className="mt-1">
                Selected: Q{selectedQuarter} {selectedYear} | Displaying: Q{rewards.quarter}{' '}
                {rewards.year}
              </p>
              <p className="mt-1 text-xs">Try clicking the refresh button to reload the data.</p>
            </div>
          )}
          {isIncompleteQuarter() && (
            <div className="bg-yellow-900/30 backdrop-blur-md border border-yellow-700/50 rounded-xl p-4 text-yellow-200 text-sm">
              <p className="font-semibold">Note: Incomplete Quarter</p>
              <p className="mt-1">
                You're viewing the current quarter which is still in progress. The data shown
                reflects the partial quarter and will change as more data becomes available.
              </p>
            </div>
          )}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <CurrencyDollarIcon className="w-6 h-6 text-green-400" />
              <h3 className="text-lg font-semibold text-white">Treasury Growth (Capital Gains)</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-200">
                <span>
                  Previous Quarter (Q{selectedQuarter === 1 ? 4 : selectedQuarter - 1}{' '}
                  {selectedQuarter === 1 ? selectedYear - 1 : selectedYear}) Avg:
                </span>
                <span className="text-white">
                  {formatUSD(rewards.treasuryGrowth.previousQuarterAvgUSD)}
                </span>
              </div>
              <div className="flex justify-between text-slate-200">
                <span>
                  Current Quarter (Q{selectedQuarter} {selectedYear}) Avg:
                </span>
                <span className="text-white">
                  {formatUSD(rewards.treasuryGrowth.currentQuarterAvgUSD)}
                </span>
              </div>
              <div className="flex justify-between text-slate-200">
                <span>Capital Gains (Growth - Revenue):</span>
                <span className="text-white">{formatUSD(rewards.treasuryGrowth.growthUSD)}</span>
              </div>
              <div className="pt-2 border-t border-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-200">Reward (2% of Capital Gains):</span>
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

          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <CurrencyDollarIcon className="w-6 h-6 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Revenue</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-200">
                <span>Quarterly Revenue (Q{selectedQuarter} {selectedYear}):</span>
                <span className="text-white">
                  {formatUSD(rewards.revenue.annualRevenueUSD)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-200">Reward (10% of Revenue):</span>
                  <span className="text-blue-400 font-semibold">
                    {formatETH(rewards.revenue.rewardETH)} ETH
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  {formatUSD(rewards.revenue.rewardUSD)}
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
                  <p className="font-semibold text-slate-300 mb-2">4. Revenue Calculation</p>
                  <p>
                    Quarterly revenue is calculated from all revenue sources (subscriptions, DeFi
                    fees, staking) by taking the difference between cumulative revenue at the end and
                    start of the quarter.
                  </p>
                  <p className="mt-1">
                    Revenue includes: Citizen subscriptions, Team subscriptions, DeFi protocol fees,
                    and ETH staking rewards.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-300 mb-2">5. Capital Gains Calculation</p>
                  <p>
                    Capital gains (market appreciation) is calculated by subtracting revenue from
                    raw treasury growth:{' '}
                    <code className="bg-slate-900/50 px-1 rounded">
                      Capital Gains = (Current Quarter Avg - Previous Quarter Avg) - Quarterly
                      Revenue
                    </code>
                  </p>
                  <p className="mt-1">
                    This separates market appreciation from operational revenue, so ETH price
                    changes don't affect revenue calculations.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-300 mb-2">6. Reward Calculation</p>
                  <p>The EB receives two separate rewards:</p>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                    <li>
                      <strong>Capital Gains Reward:</strong> 2% of positive capital gains{' '}
                      <code className="bg-slate-900/50 px-1 rounded">
                        Reward = Capital Gains × 0.02
                      </code>
                    </li>
                    <li>
                      <strong>Revenue Reward:</strong> 10% of quarterly revenue{' '}
                      <code className="bg-slate-900/50 px-1 rounded">
                        Reward = Quarterly Revenue × 0.10
                      </code>
                    </li>
                  </ul>
                  <p className="mt-1">
                    Both rewards are converted to ETH using the current ETH price and added
                    together for the total reward.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-300 mb-2">7. ETH Price Fetching</p>
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
