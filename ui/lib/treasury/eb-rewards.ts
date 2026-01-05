import { getAUMHistory } from '../coinstats'
import { getETHPrice } from '../etherscan'
import { getHistoricalRevenue } from './revenue'

export interface QuarterlyData {
  quarter: number
  year: number
  averageValueUSD: number
  startDate: Date
  endDate: Date
  dataPoints: number
}

export interface TreasuryGrowthReward {
  currentQuarterAvgUSD: number
  previousQuarterAvgUSD: number
  growthUSD: number
  rewardUSD: number
  rewardETH: number
}

export interface RevenueReward {
  annualRevenueUSD: number
  rewardUSD: number
  rewardETH: number
}

export interface EBRewardResult {
  quarter: number
  year: number
  treasuryGrowth: TreasuryGrowthReward
  revenue: RevenueReward
  totalRewardETH: number
  ethPrice: number
  calculatedAt: string
}

function getQuarterDateRange(quarter: number, year: number): { startDate: Date; endDate: Date } {
  if (quarter < 1 || quarter > 4) {
    throw new Error('Quarter must be between 1 and 4')
  }

  const startMonth = (quarter - 1) * 3
  const endMonth = startMonth + 3

  const startDate = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0))
  const endDate = new Date(Date.UTC(year, endMonth, 0, 23, 59, 59, 999))

  return { startDate, endDate }
}

function getPreviousQuarter(quarter: number, year: number): { quarter: number; year: number } {
  if (quarter === 1) {
    return { quarter: 4, year: year - 1 }
  }
  return { quarter: quarter - 1, year }
}

export async function getQuarterlyAverageValue(
  quarter: number,
  year: number
): Promise<QuarterlyData> {
  const { startDate, endDate } = getQuarterDateRange(quarter, year)

  const startTimestamp = startDate.getTime()
  const endTimestamp = endDate.getTime()
  const daysInRange = Math.ceil((endTimestamp - startTimestamp) / (1000 * 60 * 60 * 24))

  try {
    const { aumHistory } = await getAUMHistory(Math.max(daysInRange + 30, 365))

    const relevantDataPoints = aumHistory.filter((point) => {
      const pointTimestamp = point.timestamp * 1000
      return pointTimestamp >= startTimestamp && pointTimestamp <= endTimestamp
    })

    if (relevantDataPoints.length === 0) {
      console.warn(`No data points found for Q${quarter} ${year}. Using closest available data.`)

      if (aumHistory.length === 0) {
        console.warn(`No AUM history available. Returning zero value.`)
        return {
          quarter,
          year,
          averageValueUSD: 0,
          startDate,
          endDate,
          dataPoints: 0,
        }
      }

      const closestPoint = aumHistory.reduce((prev, curr) => {
        const prevDiff = Math.abs(prev.timestamp * 1000 - startTimestamp)
        const currDiff = Math.abs(curr.timestamp * 1000 - startTimestamp)
        return currDiff < prevDiff ? curr : prev
      })

      return {
        quarter,
        year,
        averageValueUSD: closestPoint?.value || 0,
        startDate,
        endDate,
        dataPoints: 1,
      }
    }

    const totalValue = relevantDataPoints.reduce((sum, point) => sum + point.value, 0)
    const averageValueUSD = totalValue / relevantDataPoints.length

    return {
      quarter,
      year,
      averageValueUSD,
      startDate,
      endDate,
      dataPoints: relevantDataPoints.length,
    }
  } catch (error) {
    console.error(`Error fetching quarterly average for Q${quarter} ${year}:`, error)
    throw error
  }
}

async function getQuarterlyRevenue(quarter: number, year: number): Promise<number> {
  const { startDate, endDate } = getQuarterDateRange(quarter, year)
  const startTimestamp = startDate.getTime()
  const endTimestamp = endDate.getTime()
  const now = Date.now()

  try {
    const { defiData } = await getAUMHistory(365)
    const revenueData = await getHistoricalRevenue(defiData, 365)

    if (revenueData.revenueHistory.length === 0) {
      console.warn(`No revenue history data available for Q${quarter} ${year}`)
      return 0
    }

    // For future quarters, use the most recent available data
    const effectiveEndTimestamp = Math.min(endTimestamp, now)

    // Revenue history is cumulative, so we need the difference between end and start
    // Find the last point before the quarter starts
    const pointsBeforeQuarter = revenueData.revenueHistory.filter(
      (point) => point.timestamp < startTimestamp
    )
    
    let revenueAtQuarterStart = 0
    if (pointsBeforeQuarter.length > 0) {
      revenueAtQuarterStart = pointsBeforeQuarter[pointsBeforeQuarter.length - 1].totalRevenue
    } else {
      // If no points before quarter start, check if first point is before or after quarter start
      const firstPoint = revenueData.revenueHistory[0]
      if (firstPoint && firstPoint.timestamp >= startTimestamp) {
        // First point is at or after quarter start, so revenue at start is 0
        revenueAtQuarterStart = 0
      } else if (firstPoint && firstPoint.timestamp < startTimestamp) {
        // First point is before quarter start but wasn't caught by filter (shouldn't happen)
        revenueAtQuarterStart = firstPoint.totalRevenue
      }
    }

    // Find the last point up to the quarter end (or current time if quarter is in future)
    const pointsUpToQuarterEnd = revenueData.revenueHistory.filter(
      (point) => point.timestamp <= effectiveEndTimestamp
    )

    if (pointsUpToQuarterEnd.length === 0) {
      // If no data up to quarter end, but we have data before quarter start, revenue is 0
      if (pointsBeforeQuarter.length > 0) {
        return 0
      }
      // Otherwise, use the first available point as baseline
      const firstPoint = revenueData.revenueHistory[0]
      if (firstPoint && firstPoint.timestamp > effectiveEndTimestamp) {
        // All data is after the quarter, so no revenue in this quarter
        return 0
      }
      // If we have data but it's all before the quarter, return 0
      return 0
    }

    const revenueAtQuarterEnd = pointsUpToQuarterEnd[pointsUpToQuarterEnd.length - 1].totalRevenue

    // Quarter revenue = cumulative at end - cumulative at start
    const quarterRevenue = revenueAtQuarterEnd - revenueAtQuarterStart

    // Debug logging
    const startDateStr = new Date(startTimestamp).toLocaleDateString()
    const endDateStr = new Date(effectiveEndTimestamp).toLocaleDateString()
    const startPointDate = pointsBeforeQuarter.length > 0 
      ? new Date(pointsBeforeQuarter[pointsBeforeQuarter.length - 1].timestamp).toLocaleDateString()
      : 'none'
    const endPointDate = new Date(pointsUpToQuarterEnd[pointsUpToQuarterEnd.length - 1].timestamp).toLocaleDateString()
    
    console.log(
      `Q${quarter} ${year} Revenue Calculation:`
    )
    console.log(`  Quarter: ${startDateStr} to ${endDateStr}`)
    console.log(`  Points before quarter: ${pointsBeforeQuarter.length} (last: ${startPointDate})`)
    console.log(`  Points up to quarter end: ${pointsUpToQuarterEnd.length} (last: ${endPointDate})`)
    console.log(`  Revenue at quarter start: $${revenueAtQuarterStart.toFixed(2)}`)
    console.log(`  Revenue at quarter end: $${revenueAtQuarterEnd.toFixed(2)}`)
    console.log(`  Q${quarter} ${year} Revenue: $${quarterRevenue.toFixed(2)}`)

    return Math.max(0, quarterRevenue)
  } catch (error) {
    console.error(`Error fetching quarterly revenue for Q${quarter} ${year}:`, error)
    return 0
  }
}

export async function calculateTreasuryGrowthReward(
  currentQuarter: number,
  currentYear: number,
  ethPrice: number,
  quarterRevenue?: number
): Promise<TreasuryGrowthReward> {
  try {
    const previousQuarterInfo = getPreviousQuarter(currentQuarter, currentYear)

    const [currentQuarterData, previousQuarterData, calculatedQuarterRevenue] = await Promise.all([
      getQuarterlyAverageValue(currentQuarter, currentYear),
      getQuarterlyAverageValue(previousQuarterInfo.quarter, previousQuarterInfo.year),
      quarterRevenue !== undefined ? Promise.resolve(quarterRevenue) : getQuarterlyRevenue(currentQuarter, currentYear),
    ])

    const currentQuarterAvgUSD = currentQuarterData.averageValueUSD
    const previousQuarterAvgUSD = previousQuarterData.averageValueUSD

    // Raw treasury value change includes both revenue inflows and capital gains
    const rawGrowthUSD = currentQuarterAvgUSD - previousQuarterAvgUSD

    // Capital gains = treasury value change - revenue inflows
    // This isolates market appreciation from operational revenue
    const growthUSD = rawGrowthUSD - calculatedQuarterRevenue

    const rewardUSD = growthUSD > 0 ? growthUSD * 0.02 : 0
    const rewardETH = ethPrice > 0 ? rewardUSD / ethPrice : 0

    return {
      currentQuarterAvgUSD,
      previousQuarterAvgUSD,
      growthUSD,
      rewardUSD,
      rewardETH,
    }
  } catch (error) {
    console.error('Error calculating treasury growth reward:', error)
    throw error
  }
}

export async function calculateRevenueReward(
  year: number,
  ethPrice: number
): Promise<RevenueReward> {
  try {
    const { aumHistory, defiData } = await getAUMHistory(365)

    const revenueData = await getHistoricalRevenue(defiData, 365)

    const currentYear = new Date().getFullYear()

    // If selected year is in the future, use current year's data
    const yearToUse = year > currentYear ? currentYear : year

    // Use the annual totals directly from getHistoricalRevenue
    // These represent the total revenue from all available history (last 365 days)
    // For annual revenue, we use the sum of all revenue components
    const annualRevenueUSD =
      revenueData.citizenRevenue +
      revenueData.teamRevenue +
      revenueData.defiRevenue +
      revenueData.stakingRevenue

    // If we have revenue history points, we can filter by year
    // Otherwise, use the annual totals (which represent the last 365 days)
    let annualRevenueFromHistory = 0
    if (revenueData.revenueHistory.length > 0) {
      const yearStart = new Date(Date.UTC(yearToUse, 0, 1, 0, 0, 0, 0)).getTime()
      const yearEnd =
        yearToUse === currentYear
          ? new Date().getTime()
          : new Date(Date.UTC(yearToUse, 11, 31, 23, 59, 59, 999)).getTime()

      const relevantRevenue = revenueData.revenueHistory.filter((point) => {
        return point.timestamp >= yearStart && point.timestamp <= yearEnd
      })

      annualRevenueFromHistory = relevantRevenue.reduce((sum, point) => sum + point.totalRevenue, 0)
    }

    // Use history-based calculation if available, otherwise use annual totals
    const finalAnnualRevenueUSD =
      annualRevenueFromHistory > 0 ? annualRevenueFromHistory : annualRevenueUSD

    const rewardUSD = finalAnnualRevenueUSD * 0.1
    const rewardETH = ethPrice > 0 ? rewardUSD / ethPrice : 0

    return {
      annualRevenueUSD: finalAnnualRevenueUSD,
      rewardUSD,
      rewardETH,
    }
  } catch (error) {
    console.error('Error calculating revenue reward:', error)
    throw error
  }
}

export async function convertUSDToETH(usdAmount: number): Promise<number> {
  try {
    const ethPrice = await getETHPrice()
    if (ethPrice === 0) {
      throw new Error('ETH price is 0 or unavailable')
    }
    return usdAmount / ethPrice
  } catch (error) {
    console.error('Error converting USD to ETH:', error)
    throw error
  }
}

export async function calculateEBRewards(quarter: number, year: number): Promise<EBRewardResult> {
  try {
    const ethPrice = await getETHPrice()

    if (ethPrice === 0) {
      throw new Error('Unable to fetch ETH price')
    }

    // Calculate quarterly revenue once and use it for both calculations
    const quarterRevenueUSD = await getQuarterlyRevenue(quarter, year)
    
    const treasuryGrowth = await calculateTreasuryGrowthReward(
      quarter,
      year,
      ethPrice,
      quarterRevenueUSD
    )

    // EB gets 10% of quarterly revenue
    const revenueRewardUSD = quarterRevenueUSD * 0.1
    const revenueRewardETH = ethPrice > 0 ? revenueRewardUSD / ethPrice : 0

    const revenue = {
      annualRevenueUSD: quarterRevenueUSD,
      rewardUSD: revenueRewardUSD,
      rewardETH: revenueRewardETH,
    }

    // Total reward = 2% of capital gains + 10% of quarterly revenue
    const totalRewardETH = treasuryGrowth.rewardETH + revenueRewardETH

    return {
      quarter,
      year,
      treasuryGrowth,
      revenue,
      totalRewardETH,
      ethPrice,
      calculatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error(`Error calculating EB rewards for Q${quarter} ${year}:`, error)
    throw error
  }
}
