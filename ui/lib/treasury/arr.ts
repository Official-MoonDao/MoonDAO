import CitizenABI from 'const/abis/Citizen.json'
import TeamABI from 'const/abis/Team.json'
import {
  CITIZEN_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
  DEFAULT_CHAIN_V5,
  CITIZEN_ADDRESSES,
} from 'const/config'
import { getContract, readContract } from 'thirdweb'
import {
  getAllNetworkTransfers,
  CitizenTransfer,
  TeamTransfer,
} from '@/lib/network/networkSubgraph'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'

export interface ARRDataPoint {
  timestamp: number
  arr: number
  citizenARR: number
  teamARR: number
  ethPrice?: number
}

export interface ARRHistoryResult {
  arrHistory: ARRDataPoint[]
  currentARR: number
  citizenARR: number
  teamARR: number
}

interface SubscriptionEvent {
  timestamp: number
  type: 'citizen' | 'team'
  annualValue: number // USD per year
  tokenId: string
}

// Helper function to get ETH price - server-side compatible
async function getEthPrice(): Promise<number> {
  try {
    // For server-side rendering, directly call the Etherscan API
    const response = await fetch(
      `https://api.etherscan.io/api?module=stats&action=ethprice&apikey=${process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY}`
    )
    const data = await response.json()
    const price = parseFloat(data.result?.ethusd)
    return isNaN(price) ? 3000 : price // Fallback to $3000 if invalid
  } catch (error) {
    console.error('Failed to fetch ETH price:', error)
    return 3000 // Fallback price
  }
}

// Helper function to get price per second from contracts
async function getContractPrices() {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)

  try {
    const citizenContract = getContract({
      client: serverClient,
      address: CITIZEN_ADDRESSES[chainSlug],
      chain: chain,
      abi: CitizenABI as any,
    })

    const teamContract = getContract({
      client: serverClient,
      address: TEAM_ADDRESSES[chainSlug],
      chain: chain,
      abi: TeamABI as any,
    })

    const [citizenPricePerSecond, teamPricePerSecond] = await Promise.all([
      readContract({
        contract: citizenContract,
        method: 'pricePerSecond',
      }),
      readContract({
        contract: teamContract,
        method: 'pricePerSecond',
      }),
    ])

    const citizenPrice = Number(citizenPricePerSecond)
    const teamPrice = Number(teamPricePerSecond) * (7 / 1000) // always apply discount to team price

    return {
      citizenPricePerSecond: citizenPrice,
      teamPricePerSecond: teamPrice,
    }
  } catch (error) {}
}

// Convert transfers to subscription events (each transfer = new subscription)
function convertTransfersToEvents(
  transfers: (CitizenTransfer | TeamTransfer)[],
  type: 'citizen' | 'team',
  pricePerSecond: number,
  ethPrice: number
): SubscriptionEvent[] {
  console.log(`\n=== Processing ${transfers.length} ${type} transfers ===`)

  const events: SubscriptionEvent[] = []

  transfers.forEach((transfer, index) => {
    try {
      const timestamp = parseInt(transfer.blockTimestamp) * 1000 // Convert to milliseconds

      if (isNaN(timestamp) || !transfer.blockTimestamp) {
        console.warn(
          `Invalid timestamp for ${type} transfer ${index}:`,
          transfer.blockTimestamp
        )
        return
      }

      // Calculate annual value: pricePerSecond * seconds per year * ETH price
      const annualValueETH = (pricePerSecond * 365.25 * 24 * 60 * 60) / 1e18 // Convert to ETH
      const annualValueUSD = annualValueETH * ethPrice

      const event: SubscriptionEvent = {
        timestamp,
        type,
        annualValue: annualValueUSD,
        tokenId: transfer.tokenId,
      }

      events.push(event)

      // Log first few for debugging
      if (index < 3) {
        console.log(`${type} subscription ${index}:`, {
          tokenId: transfer.tokenId,
          date: new Date(timestamp).toISOString().split('T')[0],
          annualValueUSD: annualValueUSD.toFixed(2),
        })
      }
    } catch (error) {
      console.warn(
        `Error processing ${type} transfer ${index}:`,
        error,
        transfer
      )
    }
  })

  console.log(`Created ${events.length} ${type} subscription events`)
  return events
}

// Calculate cumulative ARR at a specific timestamp
function calculateCumulativeARR(
  timestamp: number,
  allEvents: SubscriptionEvent[]
): {
  totalARR: number
  citizenARR: number
  teamARR: number
  citizenCount: number
  teamCount: number
} {
  let citizenARR = 0
  let teamARR = 0
  let citizenCount = 0
  let teamCount = 0

  // Sum up all subscriptions that started before or at this timestamp
  allEvents.forEach((event) => {
    if (event.timestamp <= timestamp) {
      if (event.type === 'citizen') {
        citizenARR += event.annualValue
        citizenCount++
      } else {
        teamARR += event.annualValue
        teamCount++
      }
    }
  })

  return {
    totalARR: citizenARR + teamARR,
    citizenARR,
    teamARR,
    citizenCount,
    teamCount,
  }
}

// New function that accepts transfer data as parameters
export async function calculateARRFromTransfers(
  citizenTransfers: CitizenTransfer[],
  teamTransfers: TeamTransfer[],
  days: number = 365
): Promise<ARRHistoryResult> {
  try {
    console.log('Starting ARR calculation with provided transfers...')

    console.log(
      `Found ${citizenTransfers.length} citizen transfers and ${teamTransfers.length} team transfers`
    )

    // If no transfers, return empty result
    if (citizenTransfers.length === 0 && teamTransfers.length === 0) {
      console.log('No transfers found, returning empty ARR data')
      return {
        arrHistory: [],
        currentARR: 0,
        citizenARR: 0,
        teamARR: 0,
      }
    }

    // Get contract prices and ETH price
    const [contractPrices, ethPrice] = await Promise.all([
      getContractPrices(),
      getEthPrice(),
    ])

    // Convert transfers to subscription events
    const citizenEvents = convertTransfersToEvents(
      citizenTransfers,
      'citizen',
      contractPrices.citizenPricePerSecond,
      ethPrice
    )

    const teamEvents = convertTransfersToEvents(
      teamTransfers,
      'team',
      contractPrices.teamPricePerSecond,
      ethPrice
    )

    const allEvents = [...citizenEvents, ...teamEvents]
    // Sort events by timestamp
    allEvents.sort((a, b) => a.timestamp - b.timestamp)

    console.log(
      `Total subscription events: ${allEvents.length} (${citizenEvents.length} citizens, ${teamEvents.length} teams)`
    )

    // Generate ARR history data points
    const arrHistory: ARRDataPoint[] = []
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

    // Generate weekly data points
    for (
      let date = new Date(startDate);
      date <= endDate;
      date.setDate(date.getDate() + 7)
    ) {
      const timestamp = date.getTime()
      const arrData = calculateCumulativeARR(timestamp, allEvents)

      arrHistory.push({
        timestamp: timestamp,
        arr: arrData.totalARR,
        citizenARR: arrData.citizenARR,
        teamARR: arrData.teamARR,
        ethPrice,
      })

      // Log significant milestones
      if (
        arrData.totalARR > 0 &&
        (arrData.citizenCount + arrData.teamCount) % 10 === 0
      ) {
        console.log(
          `Week ${
            date.toISOString().split('T')[0]
          }: Total ARR=$${arrData.totalARR.toFixed(0)}, Subscribers: ${
            arrData.citizenCount + arrData.teamCount
          } (${arrData.citizenCount} citizens, ${arrData.teamCount} teams)`
        )
      }
    }

    // Calculate current ARR
    const currentTimestamp = Date.now()
    const currentARRData = calculateCumulativeARR(currentTimestamp, allEvents)

    return {
      arrHistory,
      currentARR: currentARRData.totalARR,
      citizenARR: currentARRData.citizenARR,
      teamARR: currentARRData.teamARR,
    }
  } catch (error) {
    console.error('Failed to calculate ARR from transfers:', error)

    // Return fallback data
    return {
      arrHistory: [],
      currentARR: 0,
      citizenARR: 0,
      teamARR: 0,
    }
  }
}

// Original function that fetches its own data (for backward compatibility)
export async function getARRHistoryFromSubgraph(
  days: number = 365
): Promise<ARRHistoryResult> {
  try {
    console.log('Starting ARR calculation from subgraph...')

    // Get all transfers from subgraph
    const { citizenTransfers, teamTransfers } = await getAllNetworkTransfers()

    return calculateARRFromTransfers(citizenTransfers, teamTransfers, days)
  } catch (error) {
    console.error('Failed to calculate ARR from subgraph:', error)

    // Return fallback data
    return {
      arrHistory: [],
      currentARR: 0,
      citizenARR: 0,
      teamARR: 0,
    }
  }
}

// Enhanced function that provides more detailed analytics
export async function getDetailedARRAnalytics(days: number = 365) {
  const result = await getARRHistoryFromSubgraph(days)

  try {
    const { citizenTransfers, teamTransfers } = await getAllNetworkTransfers()

    const citizenTotal =
      citizenTransfers.reduce((sum, t) => sum + parseFloat(t.ethValue), 0) /
      1e18
    const teamTotal =
      teamTransfers.reduce((sum, t) => sum + parseFloat(t.ethValue), 0) / 1e18

    return {
      ...result,
      analytics: {
        totalCitizenTransfers: citizenTransfers.length,
        totalTeamTransfers: teamTransfers.length,
        totalRevenue: {
          citizen: citizenTotal,
          team: teamTotal,
          combined: citizenTotal + teamTotal,
        },
        averageTransactionValue: {
          citizen:
            citizenTransfers.length > 0
              ? citizenTotal / citizenTransfers.length
              : 0,
          team: teamTransfers.length > 0 ? teamTotal / teamTransfers.length : 0,
        },
        growth: {
          weeklyGrowthRate:
            result.arrHistory.length > 1
              ? ((result.arrHistory[result.arrHistory.length - 1].arr -
                  result.arrHistory[result.arrHistory.length - 2].arr) /
                  Math.max(
                    result.arrHistory[result.arrHistory.length - 2].arr,
                    1
                  )) *
                100
              : 0,
        },
      },
    }
  } catch (error) {
    console.error('Failed to calculate analytics:', error)
    return result
  }
}
