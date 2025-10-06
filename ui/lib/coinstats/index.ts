import { ethereum, arbitrum, polygon } from '@/lib/infura/infuraChains'
import { LineChartData } from '@/components/layout/LineChart'

export const MOONDAO_SAFES = [
  {
    address: '0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9',
    chain: 'ethereum',
    name: 'ETH Treasury',
  },
  {
    address: '0xAF26a002d716508b7e375f1f620338442F5470c0',
    chain: 'arbitrum',
    name: 'Arbitrum Treasury',
  },
  {
    address: '0x8C0252c3232A2c7379DDC2E44214697ae8fF097a',
    chain: 'polygon',
    name: 'Polygon Treasury',
  },
  {
    address: '0x871e232Eb935E54Eb90B812cf6fe0934D45e7354',
    chain: 'base',
    name: 'Base Treasury',
  },
  {
    address: '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB45e4',
    chain: 'optimism',
    name: 'Optimism Treasury',
  },
  {
    address: '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB4537',
    chain: 'arbitrum',
    name: 'Arbitrum Multichain',
  },
  {
    address: '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB4537',
    chain: 'polygon',
    name: 'Polygon Multichain',
  },
  {
    address: '0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB4537',
    chain: 'base',
    name: 'Base Multichain',
  },
]
export interface AUMDataPoint {
  timestamp: number
  aum: number
  safeName?: string
}

interface WalletConfig {
  address: string
  chain: string
  name: string
}

interface TokenData {
  amount: string
  decimals: number
  price: number
  symbol: string
  name: string
}

interface DeFiData {
  totalAssets?: {
    USD: number
    BTC: number
    ETH: number
  }
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

async function getDeFiBalance(): Promise<DeFiData> {
  try {
    if (!process.env.COINSTATS_SHARE_TOKEN) {
      console.error('❌ COINSTATS_SHARE_TOKEN is required for DeFi API')
      return { balance: 0, firstPoolCreationTimestamp: 0, protocols: [] }
    }

    const response = await fetch(
      `https://openapiv1.coinstats.app/portfolio/defi?shareToken=${process.env.COINSTATS_SHARE_TOKEN}`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'X-API-KEY': process.env.COINSTATS_API_KEY || '',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()

      if (response.status === 403 || errorText.includes('subscription')) {
        console.warn('⚠️ DeFi API requires Degen plan subscription.')
      }

      return { balance: 0, firstPoolCreationTimestamp: 0, protocols: [] }
    }

    const data: DeFiData = await response.json()

    const poolCreationDates = await getPoolCreationTimestamps(data.protocols)
    const earliestPoolCreation = getEarliestPoolCreation(poolCreationDates)

    return {
      balance: data.totalAssets?.USD || 0,
      firstPoolCreationTimestamp: earliestPoolCreation,
      protocols: data.protocols || [],
    }
  } catch (error) {
    console.error('❌ Error fetching DeFi balance:', error)
    return { balance: 0, firstPoolCreationTimestamp: 0, protocols: [] }
  }
}

async function getPoolCreationTimestamps(
  protocols: DeFiData['protocols']
): Promise<Map<string, number>> {
  const poolCreationDates = new Map<string, number>()

  try {
    const poolAddresses: Array<{
      address: string
      chain: string
      symbols: string
      id: string
    }> = []

    for (const protocol of protocols) {
      for (const investment of protocol.investments) {
        if (investment.poolAddress) {
          poolAddresses.push({
            address: investment.poolAddress,
            chain: protocol.chain,
            symbols: investment.symbols || 'Unknown',
            id: investment.id,
          })
        }
      }
    }

    poolAddresses.forEach((pool) => {
      console.log(`  • ${pool.symbols} (${pool.chain}): ${pool.address}`)
    })

    for (const pool of poolAddresses) {
      try {
        const creationTimestamp = await getContractCreationTimestamp(
          pool.address,
          pool.chain
        )
        if (creationTimestamp > 0) {
          poolCreationDates.set(pool.id, creationTimestamp)
          console.log(
            `📅 ${pool.symbols} pool created: ${new Date(
              creationTimestamp
            ).toLocaleDateString()} (${pool.address})`
          )
        } else {
          console.warn(
            `⚠️ Could not find creation date for ${pool.symbols} pool: ${pool.address}`
          )
        }
      } catch (error) {
        console.warn(
          `❌ Error getting creation date for ${pool.symbols} pool:`,
          error
        )
      }
    }
  } catch (error) {
    console.error('Error getting pool creation timestamps:', error)
  }

  return poolCreationDates
}

async function makeRpcCall(
  rpcUrl: string,
  method: string,
  params: any[] = []
): Promise<any> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: 1,
    }),
  })

  if (!response.ok) {
    throw new Error(`RPC call failed: ${response.status}`)
  }

  const data = await response.json()
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`)
  }

  return data.result
}

function getInfuraRpcUrl(chainName: string): string | null {
  switch (chainName.toLowerCase()) {
    case 'ethereum':
      return ethereum.rpc
    case 'arbitrum':
      return arbitrum.rpc
    case 'polygon':
      return polygon.rpc
    default:
      console.warn(`Unknown chain: ${chainName}`)
      return null
  }
}

async function getContractCreationTimestamp(
  contractAddress: string,
  chainName: string
): Promise<number> {
  try {
    const rpcUrl = getInfuraRpcUrl(chainName)
    if (!rpcUrl) {
      console.warn(`⚠️ Chain not supported: ${chainName}`)
      return getFallbackCreationDate(contractAddress)
    }

    const creationTimestamp = await findContractCreationBlock(
      rpcUrl,
      contractAddress
    )

    if (creationTimestamp > 0) {
      return creationTimestamp
    }

    return getFallbackCreationDate(contractAddress)
  } catch (error) {
    console.error(
      `Error getting creation timestamp for ${contractAddress}:`,
      error
    )
    return getFallbackCreationDate(contractAddress)
  }
}

async function findContractCreationBlock(
  rpcUrl: string,
  contractAddress: string
): Promise<number> {
  try {
    const currentCode = await makeRpcCall(rpcUrl, 'eth_getCode', [
      contractAddress,
      'latest',
    ])

    if (currentCode === '0x') {
      return 0
    }

    const latestBlockHex = await makeRpcCall(rpcUrl, 'eth_blockNumber', [])
    const latestBlock = parseInt(latestBlockHex, 16)

    let low = 0
    let high = latestBlock
    let creationBlock = 0

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const midBlockHex = `0x${mid.toString(16)}`

      try {
        const code = await makeRpcCall(rpcUrl, 'eth_getCode', [
          contractAddress,
          midBlockHex,
        ])

        if (code === '0x') {
          // No code at this block, search higher
          low = mid + 1
        } else {
          // Code exists, this could be the creation block or later
          creationBlock = mid
          high = mid - 1
        }
      } catch (error) {
        // If block doesn't exist or RPC error, adjust search
        high = mid - 1
      }
    }

    if (creationBlock > 0) {
      const blockHex = `0x${creationBlock.toString(16)}`
      const block = await makeRpcCall(rpcUrl, 'eth_getBlockByNumber', [
        blockHex,
        false,
      ])

      if (block && block.timestamp) {
        const timestamp = parseInt(block.timestamp, 16) * 1000
        return timestamp
      }
    }

    return 0
  } catch (error) {
    console.error('Error in binary search for contract creation:', error)
    return 0
  }
}

// Get fallback creation dates for known pool addresses
function getFallbackCreationDate(contractAddress: string): number {
  const address = contractAddress.toLowerCase()

  const knownPools: Record<string, string> = {
    '0x6de28f1176311b7408329a4d21c2bd1441be157f': '2023-08-15', // Ethereum MOONEY/WETH pool
    '0xfee18cc35c4aebc2359439f1ab9e8cc897be0363': '2023-09-01', // Polygon MOONEY/WPOL pool
    '0xa0b937d5c8e32a80e3a8ed4227cd020221544ee6': '2022-09-15', // Safe vesting contract 1
    '0xc0fde70a65c7569fe919be57492228dee8cdb585': '2022-09-15', // Safe vesting contract 2
  }

  if (knownPools[address]) {
    const timestamp = new Date(knownPools[address]).getTime()
    return timestamp
  }

  // Default fallback - assume created 6 months ago
  const fallbackDate = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000
  return fallbackDate
}

// Get the earliest pool creation date to use as DeFi start date
function getEarliestPoolCreation(
  poolCreationDates: Map<string, number>
): number {
  if (poolCreationDates.size === 0) {
    console.log('⚠️ No pool creation dates found, using fallback date')
    return Date.now() - 6 * 30 * 24 * 60 * 60 * 1000
  }

  const timestamps = Array.from(poolCreationDates.values())
  const earliest = Math.min(...timestamps)
  return earliest
}

export async function getAUMHistory(
  days: number = 365
): Promise<{ aumHistory: LineChartData[]; aum: number; defiData: DeFiData }> {
  if (!process.env.COINSTATS_SHARE_TOKEN) {
    console.error(
      '❌ COINSTATS_SHARE_TOKEN is required for portfolio chart API'
    )
    return {
      aumHistory: [],
      aum: 0,
      defiData: {
        balance: 0,
        firstPoolCreationTimestamp: 0,
        protocols: [],
      },
    }
  }

  try {
    // Determine time range based on days
    let timeRange = '1y'
    if (days <= 1) timeRange = '24h'
    else if (days <= 7) timeRange = '1w'
    else if (days <= 30) timeRange = '1m'
    else if (days <= 90) timeRange = '3m'
    else if (days <= 365) timeRange = '1y'

    const [chartResponse, defiData] = await Promise.all([
      fetch(
        `https://openapiv1.coinstats.app/portfolio/chart?shareToken=${process.env.COINSTATS_SHARE_TOKEN}&type=${timeRange}`,
        {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'X-API-KEY': process.env.COINSTATS_API_KEY || '',
          },
        }
      ),
      getDeFiBalance(),
    ])

    if (!chartResponse.ok) {
      const errorText = await chartResponse.text()

      if (chartResponse.status === 403 || errorText.includes('subscription')) {
        console.warn('⚠️ Portfolio chart requires Degen plan subscription.')
      }

      return {
        aumHistory: [],
        aum: defiData.balance, // Return just DeFi balance if portfolio fails
        defiData,
      }
    }

    const data = await chartResponse.json()

    // Process CoinStats portfolio chart response
    // CoinStats returns data as: { result: [[timestamp, value, ?, ?], ...] }
    if (data && data.result && Array.isArray(data.result)) {
      const chartData: LineChartData[] = data.result.map((point: any[]) => {
        const timestampMs = point[0] // First value is timestamp in milliseconds
        const timestamp = Math.floor(timestampMs / 1000) // Convert to seconds for LineChart compatibility
        const portfolioValue = parseFloat(point[1] || '0') // Second value is USD portfolio value

        return {
          timestamp,
          value: portfolioValue,
          date: new Date(timestampMs).toISOString().split('T')[0], // Use original milliseconds for date
        }
      })

      // Get current portfolio value (latest data point)
      const currentPortfolioValue = chartData[chartData.length - 1]?.value || 0
      const totalCurrentValue = currentPortfolioValue + defiData.balance

      // Replace the enhanced chart data logic with this accurate version:
      const enhancedChartData: LineChartData[] = chartData.map((point) => {
        const pointTimestamp = point.timestamp * 1000 // Convert back to milliseconds for comparison

        // Only add DeFi balance if this data point is after pool creation
        const defiValue =
          pointTimestamp >= defiData.firstPoolCreationTimestamp
            ? defiData.balance
            : 0

        return {
          ...point,
          value: point.value + defiValue, // Add DeFi only after creation date
        }
      })

      return {
        aumHistory: enhancedChartData,
        aum: totalCurrentValue,
        defiData,
      }
    } else {
      console.warn('Unexpected portfolio response format:', data)
      return {
        aumHistory: [],
        aum: defiData.balance, // Return just DeFi balance if portfolio data is invalid
        defiData,
      }
    }
  } catch (error) {
    console.error('❌ Portfolio chart fetch failed:', error)

    // Try to get at least DeFi balance if portfolio fails
    try {
      const defiData = await getDeFiBalance()
      return {
        aumHistory: [],
        aum: defiData.balance,
        defiData,
      }
    } catch (defiError) {
      return {
        aumHistory: [],
        aum: 0,
        defiData: {
          balance: 0,
          firstPoolCreationTimestamp: 0,
          protocols: [],
        },
      }
    }
  }
}

// Placeholder functions to match Covalent interface
export async function getWalletTokens(address: string, chainString: string) {
  console.log('⚠️ getWalletTokens not yet implemented for CoinStats')
  return { data: [] }
}

export async function getWalletTransactions(
  address: string,
  chainString: string
) {
  console.log('⚠️ getWalletTransactions not yet implemented for CoinStats')
  return { data: [] }
}

// Cache functions (placeholder - implement localStorage caching later)
export function getCachedAUMHistory(): LineChartData[] | null {
  try {
    const cached = localStorage.getItem('coinstats-aum-history')
    return cached ? JSON.parse(cached) : null
  } catch {
    return null
  }
}

export function setCachedAUMHistory(data: LineChartData[]): void {
  try {
    localStorage.setItem('coinstats-aum-history', JSON.stringify(data))
  } catch {
    // Silently fail if localStorage is not available
  }
}

// Get current MOONEY token price from CoinStats API (for use in getStaticProps)
export async function getMooneyPrice(): Promise<{
  price: number
  priceChange24h: number
} | null> {
  try {
    const response = await fetch(
      'https://openapiv1.coinstats.app/coins?currency=USD&symbol=MOONEY&blockchains=ethereum&limit=1',
      {
        method: 'GET',
        headers: {
          'X-API-KEY': process.env.COINSTATS_API_KEY || '',
          accept: 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error(
        'Failed to fetch MOONEY price:',
        response.status,
        response.statusText
      )
      return null
    }

    const data = await response.json()

    if (data.result && data.result.length > 0) {
      const mooneyData = data.result[0]
      return {
        price: mooneyData.price || 0,
        priceChange24h: mooneyData.priceChange1d || 0,
      }
    }

    console.warn('No MOONEY price data found in response')
    return null
  } catch (error) {
    console.error('Error fetching MOONEY price:', error)
    return null
  }
}
