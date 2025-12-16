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

export interface EBMemberAllocation {
  address: string
  name: string
  rewardPercentage: number
  rewardETH: number
}

export interface EBRewardResult {
  quarter: number
  year: number
  treasuryGrowth: TreasuryGrowthReward
  revenue: RevenueReward
  totalRewardETH: number
  memberAllocations: EBMemberAllocation[]
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

export async function calculateTreasuryGrowthReward(
  currentQuarter: number,
  currentYear: number,
  ethPrice: number
): Promise<TreasuryGrowthReward> {
  try {
    const previousQuarterInfo = getPreviousQuarter(currentQuarter, currentYear)

    const [currentQuarterData, previousQuarterData] = await Promise.all([
      getQuarterlyAverageValue(currentQuarter, currentYear),
      getQuarterlyAverageValue(previousQuarterInfo.quarter, previousQuarterInfo.year),
    ])

    const currentQuarterAvgUSD = currentQuarterData.averageValueUSD
    const previousQuarterAvgUSD = previousQuarterData.averageValueUSD
    const growthUSD = currentQuarterAvgUSD - previousQuarterAvgUSD

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

export function distributeRewardsToMembers(totalRewardETH: number): EBMemberAllocation[] {
  // Member allocations removed - only showing total rewards
  return []
}

export async function calculateEBRewards(quarter: number, year: number): Promise<EBRewardResult> {
  try {
    const ethPrice = await getETHPrice()

    if (ethPrice === 0) {
      throw new Error('Unable to fetch ETH price')
    }

    const treasuryGrowth = await calculateTreasuryGrowthReward(quarter, year, ethPrice)

    // Revenue rewards removed - only using treasury growth
    const revenue = {
      annualRevenueUSD: 0,
      rewardUSD: 0,
      rewardETH: 0,
    }

    const totalRewardETH = treasuryGrowth.rewardETH

    const memberAllocations = distributeRewardsToMembers(totalRewardETH)

    return {
      quarter,
      year,
      treasuryGrowth,
      revenue,
      totalRewardETH,
      memberAllocations,
      ethPrice,
      calculatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error(`Error calculating EB rewards for Q${quarter} ${year}:`, error)
    throw error
  }
}
