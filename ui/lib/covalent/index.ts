// lib/covalent/getAUMHistory.ts
import { Chain, GoldRushClient } from '@covalenthq/client-sdk'
import { LineChartData } from '@/components/layout/LineChart'

export const MOONDAO_SAFES = [
  {
    address: '0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9',
    chain: 'eth-mainnet' as Chain,
    name: 'ETH Treasury',
  },
  {
    address: '0xAF26a002d716508b7e375f1f620338442F5470c0',
    chain: 'arbitrum-mainnet' as Chain,
    name: 'Arbitrum Treasury',
  },
  {
    address: '0x8C0252c3232A2c7379DDC2E44214697ae8fF097a',
    chain: 'matic-mainnet' as Chain,
    name: 'Polygon Treasury',
  },
  {
    address: '0x871e232Eb935E54Eb90B812cf6fe0934D45e7354',
    chain: 'base-mainnet' as Chain,
    name: 'Base Treasury',
  },
  {
    address: '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB4537',
    chain: 'arbitrum-mainnet' as Chain,
    name: 'Arbitrum Multichain',
  },
  {
    address: '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB4537',
    chain: 'matic-mainnet' as Chain,
    name: 'Polygon Multichain',
  },
  {
    address: '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB4537',
    chain: 'base-mainnet' as Chain,
    name: 'Base Multichain',
  },
] as const

export interface AUMDataPoint {
  timestamp: number
  aum: number
  safeName?: string
}

// Initialize the GoldRush client
const client = new GoldRushClient(process.env.COVALENT_API_KEY || '')

async function getWalletCurrentValue(
  safe: (typeof MOONDAO_SAFES)[0]
): Promise<number> {
  try {
    const resp = await client.BalanceService.getTokenBalancesForWalletAddress(
      safe.chain,
      safe.address,
      { nft: false }
    )

    if (!resp.data || !resp.data.items) {
      console.error(`No balance data for ${safe.name}`)
      return 0
    }

    // Sum up all token values in USD
    const totalValue = resp.data.items.reduce((sum, token) => {
      return sum + (token.quote || 0)
    }, 0)

    console.log(
      `Portfolio value for ${safe.name}: $${totalValue.toLocaleString()}`
    )
    return totalValue
  } catch (error) {
    console.error(`Error fetching portfolio for ${safe.name}:`, error)
    return 0
  }
}

// Generate historical portfolio data using Covalent's historical portfolio endpoint
async function generateHistoricalData(
  safe: (typeof MOONDAO_SAFES)[0],
  currentValue: number,
  days: number
): Promise<LineChartData[]> {
  try {
    console.log(
      `Attempting to fetch historical portfolio data for ${safe.name} over ${days} days`
    )

    // Try to use Covalent's historical portfolio endpoint
    const historicalPortfolio = await getWalletPortfolioHistory(
      safe.address,
      safe.chain,
      days
    )

    console.log(
      `Raw historical portfolio data for ${safe.name}:`,
      historicalPortfolio.slice(0, 3)
    )

    if (historicalPortfolio.length > 0) {
      console.log(
        `Found ${historicalPortfolio.length} tokens with historical price data for ${safe.name}`
      )
      console.log(`Sample data structure:`, Object.keys(historicalPortfolio[0]))

      // First, get current token quantities for the wallet
      const currentTokens = await getWalletTokens(safe.address, safe.chain)
      const tokenQuantities = new Map<string, number>()

      currentTokens.forEach((token: any) => {
        const balance = token.balance
          ? Number(token.balance) / Math.pow(10, token.contract_decimals)
          : 0
        tokenQuantities.set(token.contract_address.toLowerCase(), balance)
        console.log(
          `Current holding: ${balance.toLocaleString()} ${
            token.contract_ticker_symbol
          } (raw balance: ${token.balance}, decimals: ${
            token.contract_decimals
          })`
        )
      })

      // The data structure is: tokens -> each token has holdings array with historical PRICE data
      // We need to calculate portfolio value = quantity × historical_price for each day
      const aggregatedData = new Map<string, number>()

      // Process each token's price history
      historicalPortfolio.forEach((token: any) => {
        const tokenAddress = token.contract_address?.toLowerCase()
        const tokenSymbol = token.contract_ticker_symbol || 'Unknown Token'
        const quantity = tokenQuantities.get(tokenAddress) || 0

        if (quantity === 0) {
          console.log(`Skipping ${tokenSymbol} - no current holdings`)
          return
        }

        if (token.holdings && Array.isArray(token.holdings)) {
          console.log(
            `Processing ${
              token.holdings.length
            } price data points for ${quantity.toLocaleString()} ${tokenSymbol}`
          )

          let validDataPoints = 0
          let sampleCalculations = 0

          token.holdings.forEach((holding: any) => {
            // Extract timestamp
            let dateStr = ''
            if (holding.timestamp) {
              const date = new Date(holding.timestamp)
              dateStr = date.toISOString().split('T')[0]
            } else {
              console.warn(
                `No timestamp found in price data for ${tokenSymbol}`
              )
              return
            }

            // Extract price (use quote_rate as the USD price)
            let price = 0
            if (
              holding.quote_rate !== undefined &&
              holding.quote_rate !== null
            ) {
              price =
                typeof holding.quote_rate === 'bigint'
                  ? Number(holding.quote_rate)
                  : holding.quote_rate
            } else if (holding.close !== undefined && holding.close !== null) {
              price =
                typeof holding.close === 'bigint'
                  ? Number(holding.close)
                  : holding.close
            } else {
              if (sampleCalculations < 3) {
                console.warn(
                  `No price found in holding for ${tokenSymbol}:`,
                  Object.keys(holding),
                  'Sample values:',
                  { quote_rate: holding.quote_rate, close: holding.close }
                )
                sampleCalculations++
              }
              return
            }

            // Calculate portfolio value for this token on this date
            const tokenValue = quantity * price

            // Debug the first few calculations
            if (validDataPoints < 3) {
              console.log(
                `${tokenSymbol} calculation: ${quantity} × ${price} = ${tokenValue} (date: ${dateStr})`
              )
            }

            if (isNaN(tokenValue)) {
              if (validDataPoints < 3) {
                console.error(
                  `NaN detected! ${tokenSymbol}: quantity=${quantity}, price=${price}, result=${tokenValue}`
                )
              }
              return
            }

            validDataPoints++

            // Aggregate by date string to combine all tokens' values
            const currentTotal = aggregatedData.get(dateStr) || 0
            aggregatedData.set(dateStr, currentTotal + tokenValue)
          })

          console.log(
            `${tokenSymbol}: ${validDataPoints} valid data points out of ${token.holdings.length}`
          )
        }
      })

      // Convert aggregated data to chart format
      const chartData: LineChartData[] = Array.from(aggregatedData.entries())
        .map(([dateStr, totalValue]) => ({
          timestamp: Math.floor(new Date(dateStr).getTime() / 1000),
          aum: Math.round(totalValue),
        }))
        .sort((a, b) => a.timestamp - b.timestamp) // Sort by timestamp

      if (chartData.length === 0) {
        throw new Error(
          `No valid portfolio data points could be calculated for ${safe.name}`
        )
      }

      console.log(
        `Successfully calculated ${
          chartData.length
        } portfolio value data points with AUM range: $${Math.min(
          ...chartData.map((p) => p.aum)
        ).toLocaleString()} - $${Math.max(
          ...chartData.map((p) => p.aum)
        ).toLocaleString()}`
      )

      return chartData
    }

    // If no historical portfolio data available, throw an error explaining the limitation
    throw new Error(
      `Historical portfolio data not available for ${safe.name} on ${safe.chain}. ` +
        `Covalent's historical portfolio endpoint may not support this chain or wallet. ` +
        `Current portfolio value: $${currentValue.toLocaleString()}`
    )
  } catch (error) {
    console.error(`Error generating historical data for ${safe.name}:`, error)
    throw error
  }
}

export async function getAUMHistory(
  days: number = 365
): Promise<{ aumHistory: LineChartData[]; aum: number }> {
  try {
    if (!process.env.COVALENT_API_KEY) {
      throw new Error('COVALENT_API_KEY not configured')
    }

    // Get current values for all safes
    const currentValues = await Promise.all(
      MOONDAO_SAFES.map((safe: any) => getWalletCurrentValue(safe))
    )

    const totalCurrentAUM = currentValues.reduce((sum, value) => sum + value, 0)

    console.log(`Total current AUM: $${totalCurrentAUM.toLocaleString()}`)

    // Use the primary treasury (ETH) for historical transaction analysis
    const primarySafe = MOONDAO_SAFES[0]
    const primaryValue = currentValues[0]

    if (primaryValue === 0) {
      throw new Error(
        'Primary treasury wallet has no value - cannot generate historical data'
      )
    }

    // Get real historical data based on actual transactions
    const primaryHistorical = await generateHistoricalData(
      primarySafe,
      primaryValue,
      days
    )

    if (primaryHistorical.length === 0) {
      throw new Error(
        'No historical transaction data available for the specified time period'
      )
    }

    // Scale the primary wallet's historical trend to represent total AUM
    const scaleFactor = totalCurrentAUM / primaryValue
    const aumHistory: LineChartData[] = primaryHistorical.map((point) => ({
      timestamp: point.timestamp,
      aum: Math.round(point.aum * scaleFactor),
    }))

    console.log(
      `Generated ${aumHistory.length} real data points for ${days} days`
    )
    console.log(
      `AUM range: $${Math.min(
        ...aumHistory.map((p) => p.aum)
      ).toLocaleString()} - $${Math.max(
        ...aumHistory.map((p) => p.aum)
      ).toLocaleString()}`
    )

    return {
      aumHistory,
      aum: totalCurrentAUM,
    }
  } catch (error) {
    console.error('Failed to fetch AUM history from Covalent:', error)
    throw error // Throw the error instead of returning mock data
  }
}

// Enhanced function for individual wallet tracking
export async function getWalletAUMHistory(
  address: string,
  chainString: string,
  days: number = 365
): Promise<{ aumHistory: LineChartData[]; aum: number }> {
  try {
    const safe = { address, chain: chainString, name: 'Custom Wallet' }
    const currentValue = await getWalletCurrentValue(safe as any)
    const aumHistory = await generateHistoricalData(
      safe as any,
      currentValue,
      days
    )

    return {
      aumHistory,
      aum: currentValue,
    }
  } catch (error) {
    console.error(`Failed to fetch wallet AUM history for ${address}:`, error)
    throw error // Throw error instead of returning fallback data
  }
}

// Get detailed token holdings for any wallet
export async function getWalletTokens(address: string, chainString: Chain) {
  try {
    const resp = await client.BalanceService.getTokenBalancesForWalletAddress(
      chainString,
      address,
      { nft: false }
    )

    return resp.data?.items || []
  } catch (error) {
    console.error(`Error fetching tokens for ${address}:`, error)
    return []
  }
}

// Get transaction history for any wallet
export async function getWalletTransactions(
  address: string,
  chainString: Chain,
  pageSize: number = 100
) {
  try {
    const transactions: any[] = []
    let pageCount = 0
    const maxPages = 5 // Limit to avoid too many requests

    for await (const resp of client.TransactionService.getAllTransactionsForAddress(
      chainString,
      address,
      {
        quoteCurrency: 'USD',
      }
    )) {
      if (resp.data?.items) {
        transactions.push(...resp.data.items)
      }

      pageCount++
      if (pageCount >= maxPages) break
    }

    return {
      items: transactions,
      pagination: { has_more: transactions.length >= pageSize * maxPages },
    }
  } catch (error) {
    console.error(`Error fetching transactions for ${address}:`, error)
    return { items: [], pagination: null }
  }
}

// Get wallet activity summary using the new non-deprecated method
export async function getWalletActivity(address: string) {
  try {
    const resp = await client.AllChainsService.getAddressActivity(address, {
      testnets: false,
    })
    return resp.data || {}
  } catch (error) {
    console.error(`Error fetching wallet activity for ${address}:`, error)
    return {}
  }
}

// Get historical portfolio value (if Covalent supports it)
export async function getWalletPortfolioHistory(
  address: string,
  chainString: Chain,
  days: number = 30
) {
  try {
    // Note: This endpoint may not be available for all chains
    const resp =
      await client.BalanceService.getHistoricalPortfolioForWalletAddress(
        chainString,
        address,
        { days: days }
      )

    return resp.data?.items || []
  } catch (error) {
    console.warn(
      `Portfolio history not available for ${address} on ${chainString}:`,
      error
    )
    return []
  }
}

// Get NFT balances for a wallet
export async function getWalletNFTs(address: string, chainString: Chain) {
  try {
    const resp = await client.NftService.getNftsForAddress(
      chainString,
      address,
      { withUncached: true }
    )

    return resp.data?.items || []
  } catch (error) {
    console.error(`Error fetching NFTs for ${address}:`, error)
    return []
  }
}

// Get log events for a wallet address - Fixed type and iteration
export async function getWalletLogEvents(
  address: string,
  chainString: Chain, // Fixed type from string to Chain
  startingBlock?: number,
  endingBlock?: number
) {
  try {
    const logEvents: any[] = []
    let pageCount = 0
    const maxPages = 3 // Limit to avoid too many requests

    // Fixed: Iterate through AsyncIterable properly
    for await (const resp of client.BaseService.getLogEventsByAddress(
      chainString,
      address,
      {
        startingBlock,
        endingBlock,
        pageSize: 1000,
      }
    )) {
      if (resp.data?.items) {
        logEvents.push(...resp.data.items)
      }
      pageCount++
      if (pageCount >= maxPages) break
    }

    return logEvents
  } catch (error) {
    console.error(`Error fetching log events for ${address}:`, error)
    return []
  }
}

// Get ERC20 token transfers for a wallet - Fixed iteration
export async function getWalletTokenTransfers(
  address: string,
  chainString: Chain,
  contractAddress?: string
) {
  try {
    const options: any = { pageSize: 1000 }

    // Only add contractAddress if it's provided and not empty
    if (contractAddress && contractAddress.trim() !== '') {
      options.contractAddress = contractAddress
    }

    const transfers: any[] = []
    let pageCount = 0
    const maxPages = 3 // Limit to avoid too many requests

    // Fixed: Iterate through AsyncIterable properly
    for await (const resp of client.BalanceService.getErc20TransfersForWalletAddress(
      chainString,
      address,
      options
    )) {
      if (resp.data?.items) {
        transfers.push(...resp.data.items)
      }
      pageCount++
      if (pageCount >= maxPages) break
    }

    return transfers
  } catch (error) {
    console.error(`Error fetching token transfers for ${address}:`, error)
    return []
  }
}

// Caching functionality
const AUM_CACHE_KEY = 'moondao-covalent-aum-history'
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

export async function getCachedAUMHistory(
  days: number
): Promise<LineChartData[] | null> {
  if (typeof window === 'undefined') return null // Server-side

  try {
    const cached = localStorage.getItem(`${AUM_CACHE_KEY}-${days}`)
    if (!cached) return null

    const { data, timestamp } = JSON.parse(cached)
    const isExpired = Date.now() - timestamp > CACHE_DURATION

    if (isExpired) {
      localStorage.removeItem(`${AUM_CACHE_KEY}-${days}`)
      return null
    }

    return data
  } catch {
    return null
  }
}

export async function cacheAUMHistory(
  data: LineChartData[],
  days: number
): Promise<void> {
  if (typeof window === 'undefined') return // Server-side

  try {
    const cacheData = {
      data,
      timestamp: Date.now(),
    }
    localStorage.setItem(`${AUM_CACHE_KEY}-${days}`, JSON.stringify(cacheData))
  } catch (error) {
    console.warn('Failed to cache AUM history:', error)
  }
}
