import StakedEthABI from 'const/abis/StakingContract.json'
import {
  STAKED_ETH_ADDRESS,
  MOONDAO_TREASURY,
  CITIZEN_ADDRESSES,
  TEAM_ADDRESSES,
  MOONDAO_ARBITRUM_TREASURY,
} from 'const/config'
import { Contract } from 'ethers'
import client from 'lib/thirdweb/client'
import { Chain } from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { getRpcClient, eth_getBlockByNumber } from 'thirdweb/rpc'
import { LineChartData } from '@/components/layout/LineChart'
import { getValidatorIndicesFromPubKeys, getValidatorPerformance } from '../beaconchain'
import { MOONDAO_SAFES } from '../coinstats'
import { fetchInternalTransactions, getETHPrice } from '../etherscan'
import { arbitrum, ethereum } from '../rpc/chains'
import { getUniswapHistoricalPoolData, PoolSubgraphQueryData } from '../uniswap/subgraph'
import {
  withIncrementalCache,
  getIncrementalCacheKey,
  withSimpleCache,
  getSimpleCacheKey,
  hashObject,
  getIncrementalCacheStats,
  clearExpiredIncrementalCache,
} from './incrementalCache'

const INTERNAL_TREASURY_ADDRESSES = MOONDAO_SAFES.map((s) => s.address.toLowerCase())

export interface RevenueDataPoint {
  timestamp: number
  totalRevenue: number
  citizenRevenue: number
  teamRevenue: number
  defiRevenue: number
  stakingRevenue: number
  ethPrice?: number
}

export interface RevenueResult {
  revenueHistory: RevenueDataPoint[]
  currentRevenue: number
  citizenRevenue: number
  teamRevenue: number
  defiRevenue: number
  stakingRevenue: number
}

interface DeFiData {
  balance: number
  firstPoolCreationTimestamp: number
  protocols: Array<{
    id: string
    name: string
    totalValue: {
      USD: number
      ETH: number
      BTC: number
    }
    chain: string
    investments: Array<{
      id: string
      name: string
      value: {
        USD: number
        ETH: number
        BTC: number
      }
      symbols: string
      assets: Array<{
        symbol: string
        amount: number
        price: {
          USD: number
        }
      }>
      poolAddress?: string
    }>
  }>
}

const CITIZEN_ADDRESS = CITIZEN_ADDRESSES['arbitrum']
const TEAM_ADDRESS = TEAM_ADDRESSES['arbitrum']

async function getEthTransfersToTreasury(
  chain: Chain,
  fromContract: string,
  treasuryAddress: string
): Promise<Array<{ timestamp: number; value: number }>> {
  const transfers: Array<{ timestamp: number; value: number }> = []

  try {
    const cacheKey = getIncrementalCacheKey.internalTransactions(
      chain.name || 'unknown',
      fromContract,
      treasuryAddress
    )

    const internalTxs = await withIncrementalCache(
      cacheKey,
      'internalTransactions',
      // Full fetch function
      () => fetchInternalTransactions(chain, treasuryAddress, 0, 99999999),
      // Incremental fetch function (fetch new transactions since last block)
      async (since) => {
        if (since.blockNumber) {
          return fetchInternalTransactions(chain, treasuryAddress, since.blockNumber + 1, 99999999)
        }
        return []
      },
      {
        getTimestamp: (tx: any) => parseInt(tx.timeStamp) * 1000,
        getBlockNumber: (tx: any) => parseInt(tx.blockNumber),
        getTransactionHash: (tx: any) => tx.hash,
        logPrefix: `Internal transactions (${fromContract}): `,
      }
    )

    const relevantTxs = internalTxs.filter(
      (tx: any) =>
        tx.from?.toLowerCase() === fromContract.toLowerCase() &&
        tx.to?.toLowerCase() === treasuryAddress.toLowerCase() &&
        parseFloat(tx.value) > 0
    )

    // Exclude internal treasury transfers (transfers between MoonDAO safes)
    const externalTxsOnly = relevantTxs.filter(
      (tx: any) => !INTERNAL_TREASURY_ADDRESSES.includes(tx.from?.toLowerCase())
    )

    // Filter transactions to last 365 days only
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000
    const recentTxs = externalTxsOnly.filter((tx: any) => {
      const txTimestamp = parseInt(tx.timeStamp) * 1000
      return txTimestamp >= oneYearAgo
    })

    //Format
    for (const tx of recentTxs) {
      const valueInEth = parseFloat(tx.value) / 1e18
      const timestamp = parseInt(tx.timeStamp) * 1000

      transfers.push({
        timestamp,
        value: valueInEth,
      })
    }

    console.log(`✅ Total ETH transfers from ${fromContract}: ${transfers.length}`)
    return transfers
  } catch (error) {
    console.error(`❌ Error fetching ETH transfers from ${fromContract}:`, error)
    return []
  }
}

async function getSubscriptionRevenue(): Promise<{
  citizenRevenue: number
  teamRevenue: number
  revenueHistory: Array<{
    timestamp: number
    citizenRevenue: number
    teamRevenue: number
  }>
}> {
  try {
    const chain = arbitrum

    const [citizenTxs, teamTxs] = await Promise.all([
      getEthTransfersToTreasury(chain, CITIZEN_ADDRESS, MOONDAO_ARBITRUM_TREASURY),
      getEthTransfersToTreasury(chain, TEAM_ADDRESS, MOONDAO_ARBITRUM_TREASURY),
    ])

    const citizenRevenue = citizenTxs
    const teamRevenue = teamTxs

    const allRevenue = [
      ...citizenRevenue.map((r) => ({ ...r, type: 'citizen' as const })),
      ...teamRevenue.map((r) => ({ ...r, type: 'team' as const })),
    ].sort((a, b) => a.timestamp - b.timestamp)

    // Create weekly aggregated history
    const revenueHistory = aggregateSubscriptionRevenueByWeek(allRevenue)

    const totalCitizenRevenue = citizenRevenue.reduce((sum, r) => sum + r.value, 0)
    const totalTeamRevenue = teamRevenue.reduce((sum, r) => sum + r.value, 0)

    return {
      citizenRevenue: totalCitizenRevenue,
      teamRevenue: totalTeamRevenue,
      revenueHistory,
    }
  } catch (error) {
    console.error('Failed to get subscription revenue:', error)
    return { citizenRevenue: 0, teamRevenue: 0, revenueHistory: [] }
  }
}

function aggregateSubscriptionRevenueByWeek(
  allRevenue: Array<{
    timestamp: number
    value: number
    type: 'citizen' | 'team'
  }>
): Array<{ timestamp: number; citizenRevenue: number; teamRevenue: number }> {
  const weeklyData = new Map<number, { citizenRevenue: number; teamRevenue: number }>()

  for (const revenue of allRevenue) {
    // Round down to start of week (Sunday)
    const weekStart = new Date(revenue.timestamp)
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay())
    weekStart.setUTCHours(0, 0, 0, 0)
    const weekTimestamp = weekStart.getTime()

    if (!weeklyData.has(weekTimestamp)) {
      weeklyData.set(weekTimestamp, { citizenRevenue: 0, teamRevenue: 0 })
    }

    const weekData = weeklyData.get(weekTimestamp)!
    if (revenue.type === 'citizen') {
      weekData.citizenRevenue += revenue.value
    } else {
      weekData.teamRevenue += revenue.value
    }
  }

  return Array.from(weeklyData.entries())
    .map(([timestamp, data]) => ({ timestamp, ...data }))
    .sort((a, b) => a.timestamp - b.timestamp)
}

async function getDeFiRevenue(defiData: DeFiData): Promise<{
  defiRevenue: number
  revenueHistory: Array<{ timestamp: number; defiRevenue: number }>
}> {
  try {
    // Extract Uniswap pools from DeFi data with MoonDAO's position values
    const uniswapPools: (PoolSubgraphQueryData & {
      moonDAOValueUSD: number
    })[] = []

    for (const protocol of defiData.protocols) {
      const protocolName = protocol.name?.toLowerCase() || ''

      if (protocolName.includes('uniswap')) {
        for (const investment of protocol.investments) {
          if (investment.poolAddress) {
            let chainName = protocol.chain?.toLowerCase()
            if (chainName === 'eth' || chainName === 'mainnet') {
              chainName = 'ethereum'
            }

            const version = protocolName.includes('v4') ? 'v4' : 'v3'

            const poolData = {
              address: investment.poolAddress.toLowerCase(),
              chain: chainName || 'ethereum',
              version: version as 'v3' | 'v4',
              moonDAOValueUSD: investment.value.USD,
            }

            uniswapPools.push(poolData)
          }
        }
      } else {
        console.log(`⏭️  Skipping non-Uniswap protocol: ${protocol.name}`)
      }
    }

    if (uniswapPools.length === 0) {
      console.log('No Uniswap pools found in DeFi data')
      return { defiRevenue: 0, revenueHistory: [] }
    }

    // Get historical pool data for the last year (365 days)
    const poolsHash = hashObject(uniswapPools)
    const poolDataCacheKey = getIncrementalCacheKey.uniswapPoolData(poolsHash, 365)

    const poolData = await withIncrementalCache(
      poolDataCacheKey,
      'uniswapPoolData',
      // Full fetch function
      () => getUniswapHistoricalPoolData(uniswapPools, 365),
      // Incremental fetch function (fetch new days since last update)
      async (since) => {
        if (since.timestamp) {
          const daysSinceLastUpdate = Math.ceil(
            (Date.now() - since.timestamp) / (24 * 60 * 60 * 1000)
          )
          if (daysSinceLastUpdate > 0) {
            return getUniswapHistoricalPoolData(uniswapPools, daysSinceLastUpdate)
          }
        }
        return []
      },
      {
        getTimestamp: (dayData: any) => dayData.date * 1000,
        logPrefix: 'Uniswap pool data: ',
      }
    )

    if (poolData.length === 0) {
      console.log('No pool data returned from Uniswap subgraph')
      return { defiRevenue: 0, revenueHistory: [] }
    }

    // Calculate total fees earned and create historical data
    const revenueHistory: Array<{
      timestamp: number
      defiRevenue: number
    }> = []
    const dailyRevenue = new Map<number, number>()

    // Track fees by pool for debugging
    const poolFeeContributions = new Map<string, number>()

    // Process pool data to calculate daily fees (MoonDAO's proportional share only)
    for (const dayData of poolData) {
      const timestamp = dayData.date * 1000
      const totalFeesUSD = parseFloat(dayData.feesUSD) || 0
      const totalTvlUSD = parseFloat(dayData.tvlUSD) || 0
      const poolAddress = dayData.pool.id

      // Find MoonDAO's current position value for this pool
      const poolInfo = uniswapPools.find(
        (p) => p.address.toLowerCase() === poolAddress.toLowerCase()
      )

      if (!poolInfo) {
        continue
      }

      let moonDAOFeesUSD = 0
      if (poolInfo && totalTvlUSD > 0) {
        // Calculate MoonDAO's percentage of the pool
        let moonDAOPercentage = poolInfo.moonDAOValueUSD / totalTvlUSD

        // Apply percentage to total fees
        moonDAOFeesUSD = totalFeesUSD * moonDAOPercentage
      }

      // Track MoonDAO's fees per pool
      if (!poolFeeContributions.has(poolAddress)) {
        poolFeeContributions.set(poolAddress, 0)
      }
      poolFeeContributions.set(poolAddress, poolFeeContributions.get(poolAddress)! + moonDAOFeesUSD)

      if (!dailyRevenue.has(timestamp)) {
        dailyRevenue.set(timestamp, 0)
      }
      dailyRevenue.set(timestamp, dailyRevenue.get(timestamp)! + moonDAOFeesUSD)
    }

    const poolAnalysis = new Map<
      string,
      {
        moonDAOPosition: number
        minTVL: number
        maxTVL: number
        avgTVL: number
        dataPoints: number
        mismatchCount: number
        chain: string
      }
    >()

    // Analyze each pool's data consistency
    for (const dayData of poolData) {
      const poolAddress = dayData.pool.id
      const totalTvlUSD = parseFloat(dayData.tvlUSD) || 0
      const poolInfo = uniswapPools.find(
        (p) => p.address.toLowerCase() === poolAddress.toLowerCase()
      )

      if (!poolInfo) continue

      if (!poolAnalysis.has(poolAddress)) {
        poolAnalysis.set(poolAddress, {
          moonDAOPosition: poolInfo.moonDAOValueUSD,
          minTVL: totalTvlUSD,
          maxTVL: totalTvlUSD,
          avgTVL: 0,
          dataPoints: 0,
          mismatchCount: 0,
          chain: poolInfo.chain,
        })
      }

      const analysis = poolAnalysis.get(poolAddress)!
      analysis.minTVL = Math.min(analysis.minTVL, totalTvlUSD)
      analysis.maxTVL = Math.max(analysis.maxTVL, totalTvlUSD)
      analysis.avgTVL =
        (analysis.avgTVL * analysis.dataPoints + totalTvlUSD) / (analysis.dataPoints + 1)
      analysis.dataPoints++

      if (poolInfo.moonDAOValueUSD > totalTvlUSD) {
        analysis.mismatchCount++
      }
    }

    // Convert daily data to weekly aggregates for consistency with other revenue streams
    const sortedDays = Array.from(dailyRevenue.entries()).sort((a, b) => a[0] - b[0])
    const weeklyRevenue = new Map<number, number>()

    for (const [timestamp, fees] of sortedDays) {
      // Round down to start of week (Sunday)
      const weekStart = new Date(timestamp)
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay())
      weekStart.setUTCHours(0, 0, 0, 0)
      const weekTimestamp = weekStart.getTime()

      if (!weeklyRevenue.has(weekTimestamp)) {
        weeklyRevenue.set(weekTimestamp, 0)
      }
      weeklyRevenue.set(weekTimestamp, weeklyRevenue.get(weekTimestamp)! + fees)
    }

    for (const [timestamp, defiRevenue] of weeklyRevenue.entries()) {
      revenueHistory.push({ timestamp, defiRevenue })
    }

    revenueHistory.sort((a, b) => a.timestamp - b.timestamp)

    // Calculate total annual revenue (sum of last 52 weeks or available data)
    const totalAnnualRevenue = revenueHistory
      .slice(-52)
      .reduce((sum, week) => sum + week.defiRevenue, 0)

    console.log(`Processed ${uniswapPools.length} Uniswap pools, ${poolData.length} data points`)

    return {
      defiRevenue: totalAnnualRevenue,
      revenueHistory,
    }
  } catch (error) {
    console.error('Failed to calculate DeFi revenue from Uniswap subgraph:', error)
    return { defiRevenue: 0, revenueHistory: [] }
  }
}

async function getStakingRevenue(): Promise<{
  stakingRevenue: number
  revenueHistory: Array<{ timestamp: number; stakingRevenue: number }>
}> {
  try {
    const provider = ethers5Adapter.provider.toEthers({
      client,
      chain: ethereum,
    })
    const rpcRequest = getRpcClient({ client, chain: ethereum })
    const ethersContract = new Contract(STAKED_ETH_ADDRESS, StakedEthABI, provider)

    // Get deposit events from the staking contract
    const initialStakeBlockNumber = 21839730

    const filter = ethersContract.filters.Deposit(null, MOONDAO_TREASURY)

    const events = await ethersContract.queryFilter(filter, initialStakeBlockNumber, 'latest')

    const pubKeys = events.map((e) => e?.args?.publicKey).filter(Boolean)
    const deposits = await Promise.all(
      events.map(async (event) => {
        const block = await eth_getBlockByNumber(rpcRequest, {
          blockNumber: BigInt(event.blockNumber),
        })
        return {
          timestamp: Number(block.timestamp) * 1000,
          pubKey: event?.args?.publicKey,
        }
      })
    )

    if (events.length === 0 || pubKeys.length === 0) {
      console.warn('⚠️ No deposit events or public keys found')
      return { stakingRevenue: 0, revenueHistory: [] }
    }

    const pubKeysHash = hashObject(pubKeys)
    const validatorIndicesCacheKey = getIncrementalCacheKey.validatorIndices(pubKeysHash)

    const validatorIndices = await withIncrementalCache(
      validatorIndicesCacheKey,
      'validatorIndices',
      () => getValidatorIndicesFromPubKeys(pubKeys),
      undefined, // No incremental fetch - validator indices rarely change
      { logPrefix: 'Validator indices: ' }
    )

    if (validatorIndices.length === 0) {
      console.warn('⚠️ No validator indices found')
      return { stakingRevenue: 0, revenueHistory: [] }
    }

    const indicesHash = hashObject(validatorIndices)
    const performanceCacheKey = getIncrementalCacheKey.validatorPerformance(indicesHash)

    const performanceData = await withIncrementalCache(
      performanceCacheKey,
      'validatorPerformance',
      () => getValidatorPerformance(validatorIndices),
      undefined, // No incremental fetch - performance is a snapshot, not historical
      { logPrefix: 'Validator performance: ' }
    )

    if (performanceData.length === 0) {
      console.warn('⚠️ No performance data found, falling back to estimated rewards')
      return { stakingRevenue: 0, revenueHistory: [] }
    }

    const revenueHistory: Array<{
      timestamp: number
      stakingRevenue: number
    }> = []

    let annualizedRevenue = 0

    for (const validator of performanceData) {
      if (
        validator.performance365d !== undefined &&
        validator.performance365d !== null &&
        validator.performance365d !== 0
      ) {
        // performance365d is actual 365-day performance in Gwei, convert to ETH
        const annualRevenueFromAPI = validator.performance365d / 1e9
        annualizedRevenue += annualRevenueFromAPI
      } else {
        console.log(`❌ No performance data available`)
      }
    }

    const now = Date.now()
    const oneWeek = 7 * 24 * 60 * 60 * 1000
    const earliestDeposit = Math.min(...deposits.map((d) => d.timestamp))
    const weeklyRevenue = annualizedRevenue / 52

    for (let timestamp = earliestDeposit; timestamp <= now; timestamp += oneWeek) {
      const activeAtTime = deposits.filter((d) => d.timestamp <= timestamp).length

      const scaledWeeklyRevenue = (weeklyRevenue * activeAtTime) / deposits.length

      revenueHistory.push({
        timestamp,
        stakingRevenue: scaledWeeklyRevenue,
      })
    }

    return {
      stakingRevenue: annualizedRevenue,
      revenueHistory: revenueHistory.slice(-52), // Keep last 52 weeks
    }
  } catch (error) {
    console.error('Failed to get staking revenue from beacon chain API:', error)
    return { stakingRevenue: 0, revenueHistory: [] }
  }
}

export function revenueToLineChartData(revenueHistory: RevenueDataPoint[]): LineChartData[] {
  return revenueHistory.map((point) => ({
    timestamp: Math.floor(point.timestamp / 1000), // Convert to seconds
    value: point.totalRevenue,
    date: new Date(point.timestamp).toISOString().split('T')[0],
  }))
}

function convertToCumulativeRevenue(weeklyData: RevenueDataPoint[]): RevenueDataPoint[] {
  const cumulativeData: RevenueDataPoint[] = []
  let cumulativeCitizenRevenue = 0
  let cumulativeTeamRevenue = 0
  let cumulativeDefiRevenue = 0
  let cumulativeStakingRevenue = 0

  for (const point of weeklyData) {
    cumulativeCitizenRevenue += point.citizenRevenue
    cumulativeTeamRevenue += point.teamRevenue
    cumulativeDefiRevenue += point.defiRevenue
    cumulativeStakingRevenue += point.stakingRevenue

    const cumulativeTotalRevenue =
      cumulativeCitizenRevenue +
      cumulativeTeamRevenue +
      cumulativeDefiRevenue +
      cumulativeStakingRevenue

    cumulativeData.push({
      timestamp: point.timestamp,
      totalRevenue: cumulativeTotalRevenue,
      citizenRevenue: cumulativeCitizenRevenue,
      teamRevenue: cumulativeTeamRevenue,
      defiRevenue: cumulativeDefiRevenue,
      stakingRevenue: cumulativeStakingRevenue,
      ethPrice: point.ethPrice,
    })
  }

  return cumulativeData
}

export async function getHistoricalRevenue(
  defiData: DeFiData,
  days: number = 365
): Promise<RevenueResult> {
  try {
    // Log cache statistics at the start
    const cacheStats = getIncrementalCacheStats()
    console.log(
      `📊 Incremental cache stats: ${cacheStats.entries} entries, ${
        cacheStats.totalItems
      } total items, ${Math.round(cacheStats.memorySize / 1024)}KB`
    )

    // Clear very old cache entries periodically
    clearExpiredIncrementalCache()

    const [ethPrice, subscriptionData, defiRevenueData, stakingRevenueData] = await Promise.all([
      withSimpleCache(getSimpleCacheKey.ethPrice(), 'ethPrice', getETHPrice, {
        logPrefix: 'ETH price: ',
      }),
      getSubscriptionRevenue(),
      getDeFiRevenue(defiData),
      getStakingRevenue(),
    ])

    if (ethPrice === 0) {
      return {
        revenueHistory: [],
        currentRevenue: 0,
        citizenRevenue: 0,
        teamRevenue: 0,
        defiRevenue: 0,
        stakingRevenue: 0,
      }
    }

    const combinedHistory = new Map<number, RevenueDataPoint>()

    // Add subscription revenue
    subscriptionData.revenueHistory.forEach((point) => {
      const existing = combinedHistory.get(point.timestamp) || {
        timestamp: point.timestamp,
        totalRevenue: 0,
        citizenRevenue: 0,
        teamRevenue: 0,
        defiRevenue: 0,
        stakingRevenue: 0,
        ethPrice,
      }
      existing.citizenRevenue = point.citizenRevenue * ethPrice
      existing.teamRevenue = point.teamRevenue * ethPrice
      existing.totalRevenue =
        existing.citizenRevenue +
        existing.teamRevenue +
        existing.defiRevenue +
        existing.stakingRevenue
      combinedHistory.set(point.timestamp, existing)
    })

    // Add DeFi revenue
    defiRevenueData.revenueHistory.forEach((point) => {
      const existing = combinedHistory.get(point.timestamp) || {
        timestamp: point.timestamp,
        totalRevenue: 0,
        citizenRevenue: 0,
        teamRevenue: 0,
        defiRevenue: 0,
        stakingRevenue: 0,
        ethPrice,
      }
      existing.defiRevenue = point.defiRevenue
      existing.totalRevenue =
        existing.citizenRevenue +
        existing.teamRevenue +
        existing.defiRevenue +
        existing.stakingRevenue
      combinedHistory.set(point.timestamp, existing)
    })

    // Add staking revenue
    stakingRevenueData.revenueHistory.forEach((point) => {
      const existing = combinedHistory.get(point.timestamp) || {
        timestamp: point.timestamp,
        totalRevenue: 0,
        citizenRevenue: 0,
        teamRevenue: 0,
        defiRevenue: 0,
        stakingRevenue: 0,
        ethPrice,
      }
      existing.stakingRevenue = point.stakingRevenue * ethPrice
      existing.totalRevenue =
        existing.citizenRevenue +
        existing.teamRevenue +
        existing.defiRevenue +
        existing.stakingRevenue
      combinedHistory.set(point.timestamp, existing)
    })

    // Calculate annual totals from ALL revenue history (not filtered by days)
    // This ensures we get the full annual revenue regardless of chart range
    const allWeeklyRevenueHistory = Array.from(combinedHistory.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    )

    const finalCitizenRevenue = allWeeklyRevenueHistory.reduce(
      (sum, point) => sum + point.citizenRevenue,
      0
    )
    const finalTeamRevenue = allWeeklyRevenueHistory.reduce(
      (sum, point) => sum + point.teamRevenue,
      0
    )
    const finalDefiRevenue = allWeeklyRevenueHistory.reduce(
      (sum, point) => sum + point.defiRevenue,
      0
    )
    const finalStakingRevenue = allWeeklyRevenueHistory.reduce(
      (sum, point) => sum + point.stakingRevenue,
      0
    )
    const finalTotalRevenue =
      finalCitizenRevenue + finalTeamRevenue + finalDefiRevenue + finalStakingRevenue

    // Convert ALL history to cumulative
    const revenueHistory = convertToCumulativeRevenue(allWeeklyRevenueHistory)

    console.log(`\n📊 FINAL REVENUE SUMMARY (ETH Price: $${ethPrice.toFixed(2)})`)
    console.log(`💰 Citizen Revenue: $${finalCitizenRevenue.toFixed(2)}`)
    console.log(`👥 Team Revenue: $${finalTeamRevenue.toFixed(2)}`)
    console.log(`🏦 DeFi Revenue: $${finalDefiRevenue.toFixed(2)}`)
    console.log(`🥩 Staking Revenue: $${finalStakingRevenue.toFixed(2)}`)
    console.log(`🎯 TOTAL REVENUE: $${finalTotalRevenue.toFixed(2)}`)
    console.log(`📈 Revenue History Points (All Time): ${revenueHistory.length}`)

    // Verify that the last chart point matches the annual calculation
    if (revenueHistory.length > 0) {
      const lastPoint = revenueHistory[revenueHistory.length - 1]
      const tolerance = 0.01

      if (Math.abs(lastPoint.totalRevenue - finalTotalRevenue) > tolerance) {
        console.warn(`⚠️ Chart and annual calculations still don't match:`)
        console.warn(`  Chart: $${lastPoint.totalRevenue.toFixed(2)}`)
        console.warn(`  Annual: $${finalTotalRevenue.toFixed(2)}`)
        console.warn(`  Difference: $${(finalTotalRevenue - lastPoint.totalRevenue).toFixed(2)}`)
      } else {
        console.log(`✅ Chart and annual calculations are consistent`)
      }
    }

    // On mainnet, require all revenue sources to be present for accurate calculations
    // On testnet, allow missing sources (only require total > 0)
    const hasRequiredRevenue =
      process.env.NEXT_PUBLIC_CHAIN !== 'mainnet'
        ? finalTotalRevenue > 0
        : finalCitizenRevenue > 0 &&
          finalTeamRevenue > 0 &&
          finalDefiRevenue > 0 &&
          finalStakingRevenue > 0

    return {
      revenueHistory: hasRequiredRevenue ? revenueHistory : [],
      currentRevenue: hasRequiredRevenue ? finalTotalRevenue : 0,
      citizenRevenue: finalCitizenRevenue,
      teamRevenue: finalTeamRevenue,
      defiRevenue: finalDefiRevenue,
      stakingRevenue: finalStakingRevenue,
    }
  } catch (error) {
    console.error('Failed to calculate historical revenue:', error)
    return {
      revenueHistory: [],
      currentRevenue: 0,
      citizenRevenue: 0,
      teamRevenue: 0,
      defiRevenue: 0,
      stakingRevenue: 0,
    }
  }
}
