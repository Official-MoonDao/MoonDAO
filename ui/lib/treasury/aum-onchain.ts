/**
 * Free replacement for CoinStats getAUMHistory.
 * Reconstructs daily treasury AUM using:
 * - Etherscan free API (transaction history to replay balances)
 * - CoinGecko free API (daily ETH prices, up to 365 days)
 */

import { MOONDAO_TREASURY, MOONDAO_ARBITRUM_TREASURY } from 'const/config'
import { LineChartData } from '@/components/layout/LineChart'

const ETHERSCAN_API = 'https://api.etherscan.io/v2/api'
const ETHERSCAN_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || ''

interface TxEntry {
  timestamp: number
  delta: number // ETH change (positive = in, negative = out)
}

async function fetchAllEthTxs(address: string): Promise<TxEntry[]> {
  const entries: TxEntry[] = []

  try {
    // Normal txs (ETH sent/received directly)
    const normalUrl = `${ETHERSCAN_API}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&sort=asc&chainId=1&apikey=${ETHERSCAN_KEY}`
    const normalRes = await fetch(normalUrl)
    const normalData = await normalRes.json()

    if (normalData.status === '1') {
      for (const tx of normalData.result) {
        const value = parseInt(tx.value) / 1e18
        if (value === 0) continue
        const ts = parseInt(tx.timeStamp) * 1000
        const isIncoming = tx.to?.toLowerCase() === address.toLowerCase()
        entries.push({ timestamp: ts, delta: isIncoming ? value : -value })
      }
    }

    // Internal txs (ETH from contracts)
    const internalUrl = `${ETHERSCAN_API}?module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&sort=asc&chainId=1&apikey=${ETHERSCAN_KEY}`
    const internalRes = await fetch(internalUrl)
    const internalData = await internalRes.json()

    if (internalData.status === '1') {
      for (const tx of internalData.result) {
        const value = parseInt(tx.value) / 1e18
        if (value === 0) continue
        const ts = parseInt(tx.timeStamp) * 1000
        const isIncoming = tx.to?.toLowerCase() === address.toLowerCase()
        entries.push({ timestamp: ts, delta: isIncoming ? value : -value })
      }
    }
  } catch (err) {
    console.error(`Error fetching txs for ${address}:`, err)
  }

  return entries.sort((a, b) => a.timestamp - b.timestamp)
}

async function getEthPriceHistory(
  fromMs: number,
  toMs: number
): Promise<Map<string, number>> {
  const priceByDate = new Map<string, number>()
  try {
    const fromSec = Math.floor(fromMs / 1000)
    const toSec = Math.floor(toMs / 1000)
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/ethereum/market_chart/range?vs_currency=usd&from=${fromSec}&to=${toSec}`
    )
    const data = await res.json()
    if (data.prices) {
      for (const [ts, price] of data.prices) {
        const date = new Date(ts).toISOString().split('T')[0]
        // Keep the last price seen per date (most complete)
        priceByDate.set(date, price)
      }
    }
  } catch (err) {
    console.error('Error fetching CoinGecko ETH prices:', err)
  }
  return priceByDate
}

async function getCurrentEthBalance(address: string): Promise<number> {
  try {
    const res = await fetch(
      `${ETHERSCAN_API}?module=account&action=balance&address=${address}&chainId=1&apikey=${ETHERSCAN_KEY}`
    )
    const data = await res.json()
    return parseInt(data.result) / 1e18
  } catch {
    return 0
  }
}

export async function getAUMHistoryOnchain(
  days: number = 365,
  fromMs?: number,
  toMs?: number
): Promise<{
  aumHistory: LineChartData[]
  aum: number
  defiData: { balance: number; firstPoolCreationTimestamp: number; protocols: any[] }
}> {
  const emptyResult = {
    aumHistory: [] as LineChartData[],
    aum: 0,
    defiData: { balance: 0, firstPoolCreationTimestamp: 0, protocols: [] },
  }

  if (!ETHERSCAN_KEY) {
    console.error('NEXT_PUBLIC_ETHERSCAN_API_KEY is required for on-chain AUM history')
    return emptyResult
  }

  try {
    const now = Date.now()
    const cutoffMs = fromMs ?? now - days * 24 * 60 * 60 * 1000
    const endMs = toMs ?? now

    // Fetch tx history + current balance + ETH prices in parallel
    const [txEntries, ethPrices, currentBalance] = await Promise.all([
      fetchAllEthTxs(MOONDAO_TREASURY),
      getEthPriceHistory(cutoffMs, endMs),
      getCurrentEthBalance(MOONDAO_TREASURY),
    ])

    if (ethPrices.size === 0) {
      console.error('No ETH price data available')
      return emptyResult
    }

    // Sort dates ascending
    const priceEntries = Array.from(ethPrices.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    )

    // Work backwards: start from current balance and subtract txs
    // to reconstruct historical balances day by day
    const dailyBalances = new Map<string, number>()

    // Find what the balance was at cutoff by undoing all txs after cutoff
    let balance = currentBalance
    const txsAfterCutoff = txEntries.filter((tx) => tx.timestamp > cutoffMs)

    // Work backwards through post-cutoff txs
    for (const tx of [...txsAfterCutoff].reverse()) {
      balance -= tx.delta // undo the tx
    }

    // Now replay forward through the period
    let runningBalance = balance
    const txsInPeriod = txEntries.filter((tx) => tx.timestamp >= cutoffMs && tx.timestamp <= endMs)
    let txIndex = 0

    for (const [date, ethPrice] of priceEntries) {
      const dayEndMs = new Date(date + 'T23:59:59Z').getTime()

      // Apply all txs up to end of this day
      while (txIndex < txsInPeriod.length && txsInPeriod[txIndex].timestamp <= dayEndMs) {
        runningBalance += txsInPeriod[txIndex].delta
        txIndex++
      }

      const usdValue = Math.max(0, runningBalance) * ethPrice
      dailyBalances.set(date, usdValue)
    }

    const aumHistory: LineChartData[] = Array.from(dailyBalances.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        timestamp: Math.floor(new Date(date + 'T12:00:00Z').getTime() / 1000),
        value,
        date,
      }))

    const latestPrice = priceEntries[priceEntries.length - 1]?.[1] || 0
    const currentAUM = currentBalance * latestPrice

    console.log(
      `[AUM On-chain] ${aumHistory.length} daily points. ETH balance: ${currentBalance.toFixed(4)}, AUM: $${currentAUM.toFixed(2)}`
    )

    return {
      aumHistory,
      aum: currentAUM,
      defiData: { balance: 0, firstPoolCreationTimestamp: 0, protocols: [] },
    }
  } catch (err) {
    console.error('Error building on-chain AUM history:', err)
    return emptyResult
  }
}
