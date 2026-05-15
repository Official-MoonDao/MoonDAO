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
    // Clear old rewards immediately when selection changes
    setRewards(null)

    const fetchRewards = async () => {
      setLoading(true)
      setError(null)
      try {
        if (isManager) {
          // Managers use the gated /api/eb/rewards endpoint (cached, full result)
          const nocache = refreshTrigger > 0 ? '&nocache=1' : ''
          const response = await fetch(
            `/api/eb/rewards?quarter=${selectedQuarter}&year=${selectedYear}${nocache}`
          )
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || 'Failed to fetch rewards')
          }
          const data = await response.json()
          if (data.quarter !== selectedQuarter || data.year !== selectedYear) {
            console.error(
              `[EB Rewards UI] MISMATCH! Requested Q${selectedQuarter} ${selectedYear} but got Q${data.quarter} ${data.year}`
            )
          }
          setRewards(data)
        } else {
          // Community members use the public /api/eb/audit endpoint and we
          // normalise the shape to match EBRewardResult.
          const response = await fetch(
            `/api/eb/audit?quarter=${selectedQuarter}&year=${selectedYear}`
          )
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || 'Failed to fetch audit data')
          }
          const audit = await response.json()
          // Map audit shape → EBRewardResult shape
          const mapped: EBRewardResult = {
            quarter: audit.meta.quarter,
            year: audit.meta.year,
            treasuryGrowth: {
              currentQuarterAvgUSD: audit.currentQuarter.averageUSD,
              previousQuarterAvgUSD: audit.previousQuarter.averageUSD,
              growthUSD: audit.result.capitalGainsUSD,
              rewardUSD: audit.result.treasuryRewardUSD,
              rewardETH: audit.result.treasuryRewardETH,
            },
            revenue: {
              annualRevenueUSD: audit.result.annualRevenueUSD,
              rewardUSD: audit.result.revenueRewardUSD,
              rewardETH: audit.result.revenueRewardETH,
            },
            totalRewardETH: audit.result.totalRewardETH,
            ethPrice: audit.meta.ethPriceUSD,
            calculatedAt: audit.meta.calculatedAt,
          }
          setRewards(mapped)
        }
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

  return (
    <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-white">Rewards</h2>
          {!isManager && (
            <p className="text-xs text-slate-400 mt-1">Read-only view — sourced from the public audit endpoint</p>
          )}
        </div>
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
          {isManager && (
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="bg-slate-700/50 border border-slate-600 text-white rounded-lg px-4 py-2 hover:bg-slate-600/50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Refresh data (bypass cache)"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Public audit link — visible to everyone */}
      <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
        <span>🔍</span>
        <span>Verify this calculation:</span>
        <a
          href={`/api/eb/audit?quarter=${selectedQuarter}&year=${selectedYear}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
        >
          /api/eb/audit?quarter={selectedQuarter}&amp;year={selectedYear}
        </a>
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
                    Daily AUM is reconstructed from on-chain transfer history via Etherscan v2,
                    with prices sourced from DefiLlama (<code className="bg-slate-900/50 px-1 rounded">coins.llama.fi</code>).
                    Uniswap V3 LP positions are valued from live pool slot0 + liquidity reads.
                    MOONEY token holdings are excluded from AUM.
                  </p>
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
                    Subscription revenue is pulled directly from Arbitrum internal transactions on
                    Etherscan v2 — filtering ETH flows from the Citizen NFT and Team NFT contracts
                    to the Arbitrum treasury. Every individual transaction hash is included in the
                    audit endpoint response.
                  </p>
                  <p className="mt-1">
                    DeFi fees come from the Uniswap V3 subgraph. Staking rewards are sourced from
                    the beacon chain. The revenue reward uses the trailing 365-day total anchored
                    to the end of the selected quarter.
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
                      <strong>Revenue Reward:</strong> 10% of trailing 365-day annual revenue{' '}
                      <code className="bg-slate-900/50 px-1 rounded">
                        Reward = Annual Revenue × 0.10
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
                      <code className="bg-slate-900/50 px-1 rounded">ui/pages/api/eb/audit.ts</code>{' '}
                      - Public audit endpoint (all intermediate values)
                    </li>
                    <li>
                      <code className="bg-slate-900/50 px-1 rounded">ui/pages/api/eb/rewards.ts</code>{' '}
                      - Gated rewards API (manager only)
                    </li>
                    <li>
                      <code className="bg-slate-900/50 px-1 rounded">ui/lib/treasury/eb-rewards.ts</code>{' '}
                      - Calculation logic
                    </li>
                    <li>
                      <code className="bg-slate-900/50 px-1 rounded">ui/lib/treasury/canonicalRevenue.ts</code>{' '}
                      - On-chain subscription revenue
                    </li>
                    <li>
                      <code className="bg-slate-900/50 px-1 rounded">ui/lib/treasury/aum-onchain.ts</code>{' '}
                      - Daily AUM reconstruction
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
