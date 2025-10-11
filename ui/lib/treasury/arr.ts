import CitizenABI from 'const/abis/Citizen.json'
import TeamABI from 'const/abis/Team.json'
import { TEAM_ADDRESSES, CITIZEN_ADDRESSES } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import { CitizenTransfer, TeamTransfer } from '@/lib/network/networkSubgraph'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { arbitrum } from '../infura/infuraChains'

export interface ARRDataPoint {
  timestamp: number
  totalARR: number
  citizenARR: number
  teamARR: number
  ethPrice?: number
}

export interface ARRResult {
  arrHistory: ARRDataPoint[]
  currentARR: number
  citizenARR: number
  teamARR: number
}

interface SANSubscription {
  timestamp: number
  type: 'citizen' | 'team'
  annualValue: number
  tokenId: string
}

interface DeFiData {
  balance: number
  protocols: Array<{
    investments: Array<{
      poolAddress?: string
    }>
  }>
}

const TEAM_DISCOUNT = 0.067

async function getEthPrice(): Promise<number> {
  try {
    const response = await fetch(
      `https://api.etherscan.io/v2/api?module=stats&action=ethprice&chainId=1&apikey=${process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY}`
    )
    const data = await response.json()
    if (data.message !== 'OK') throw new Error('Failed to fetch ETH price')
    const price = parseFloat(data.result?.ethusd)
    return isNaN(price) ? 0 : price
  } catch (error) {
    console.error('Failed to fetch ETH price:', error)
    return 0
  }
}

async function getSANContractPrices() {
  const chain = arbitrum
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
      readContract({ contract: citizenContract, method: 'pricePerSecond' }),
      readContract({ contract: teamContract, method: 'pricePerSecond' }),
    ])

    const citizenPrice = Number(citizenPricePerSecond)
    const teamPrice = Number(teamPricePerSecond) * TEAM_DISCOUNT

    return {
      citizenPricePerSecond: isNaN(citizenPrice) ? 351978691 : citizenPrice,
      teamPricePerSecond: isNaN(teamPrice)
        ? 15854895991 * TEAM_DISCOUNT
        : teamPrice,
    }
  } catch (error) {
    console.error('Failed to fetch SAN contract prices:', error)
    return {
      citizenPricePerSecond: 351978691,
      teamPricePerSecond: 15854895991 * TEAM_DISCOUNT,
    }
  }
}

function convertTransfersToSANSubscriptions(
  transfers: (CitizenTransfer | TeamTransfer)[],
  type: 'citizen' | 'team',
  pricePerSecond: number,
  ethPrice: number
): SANSubscription[] {
  const subscriptions: SANSubscription[] = []

  transfers.forEach((transfer, index) => {
    try {
      const timestamp = parseInt(transfer.blockTimestamp) * 1000
      if (isNaN(timestamp) || !transfer.blockTimestamp) {
        console.warn(
          `Invalid timestamp for ${type} transfer ${index}:`,
          transfer.blockTimestamp
        )
        return
      }

      const annualValueETH = (pricePerSecond * 365.25 * 24 * 60 * 60) / 1e18
      const annualValueUSD = annualValueETH * ethPrice

      subscriptions.push({
        timestamp,
        type,
        annualValue: annualValueUSD,
        tokenId: transfer.tokenId,
      })
    } catch (error) {
      console.warn(
        `Error processing ${type} transfer ${index}:`,
        error,
        transfer
      )
    }
  })

  return subscriptions
}

function calculateSANARRAtTimestamp(
  timestamp: number,
  subscriptions: SANSubscription[]
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

  subscriptions.forEach((subscription) => {
    if (subscription.timestamp <= timestamp) {
      if (subscription.type === 'citizen') {
        citizenARR += subscription.annualValue
        citizenCount++
      } else {
        teamARR += subscription.annualValue
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

export async function getHistoricalARR(
  citizenTransfers: CitizenTransfer[],
  teamTransfers: TeamTransfer[],
  defiData: DeFiData,
  days: number = 365
): Promise<ARRResult> {
  try {
    if (citizenTransfers.length === 0 && teamTransfers.length === 0) {
      return {
        arrHistory: [],
        currentARR: 0,
        citizenARR: 0,
        teamARR: 0,
      }
    }

    if (citizenTransfers.length < 148 || teamTransfers.length < 18) {
      return {
        arrHistory: [],
        currentARR: 0,
        citizenARR: 0,
        teamARR: 0,
      }
    }

    const [contractPrices, ethPrice] = await Promise.all([
      getSANContractPrices(),
      getEthPrice(),
    ])

    if (ethPrice === 0) {
      return {
        arrHistory: [],
        currentARR: 0,
        citizenARR: 0,
        teamARR: 0,
      }
    }

    const citizenSubscriptions = convertTransfersToSANSubscriptions(
      citizenTransfers,
      'citizen',
      contractPrices.citizenPricePerSecond,
      ethPrice
    )

    const teamSubscriptions = convertTransfersToSANSubscriptions(
      teamTransfers,
      'team',
      contractPrices.teamPricePerSecond,
      ethPrice
    )

    const allSubscriptions = [...citizenSubscriptions, ...teamSubscriptions]
    allSubscriptions.sort((a, b) => a.timestamp - b.timestamp)

    const arrHistory: ARRDataPoint[] = []
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

    for (
      let date = new Date(startDate);
      date <= endDate;
      date.setDate(date.getDate() + 7)
    ) {
      const timestamp = date.getTime()
      const arrData = calculateSANARRAtTimestamp(timestamp, allSubscriptions)

      arrHistory.push({
        timestamp: timestamp,
        totalARR: arrData.totalARR,
        citizenARR: arrData.citizenARR,
        teamARR: arrData.teamARR,
        ethPrice,
      })

      console.log(
        `ARR History Point: totalARR=${arrData.totalARR}, citizenARR=${arrData.citizenARR}, teamARR=${arrData.teamARR}`
      )
    }

    const currentTimestamp = Date.now()
    const currentARRData = calculateSANARRAtTimestamp(
      currentTimestamp,
      allSubscriptions
    )

    return {
      arrHistory,
      currentARR: currentARRData.totalARR,
      citizenARR: currentARRData.citizenARR,
      teamARR: currentARRData.teamARR,
    }
  } catch (error) {
    console.error('Failed to calculate SAN ARR:', error)
    return {
      arrHistory: [],
      currentARR: 0,
      citizenARR: 0,
      teamARR: 0,
    }
  }
}
