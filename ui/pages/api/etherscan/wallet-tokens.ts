import {
  MOONEY_ADDRESSES,
  VMOONEY_ADDRESSES,
  DAI_ADDRESSES,
  USDC_ADDRESSES,
  USDT_ADDRESSES,
} from 'const/config'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'

// Cache for wallet tokens (keyed by wallet-chain combination)
let tokenCache: Map<
  string,
  {
    data: any
    timestamp: number
  }
> = new Map()

const CACHE_DURATION = 60 * 1000 // 1 minute cache

// Function to get legitimate token addresses for filtering
function getLegitimateTokenAddresses(chain: string): Set<string> {
  const legitimateTokens = new Set<string>()

  // Add MOONEY addresses
  if (MOONEY_ADDRESSES[chain]) {
    legitimateTokens.add(MOONEY_ADDRESSES[chain].toLowerCase())
  }

  // Add vMOONEY addresses
  if (VMOONEY_ADDRESSES[chain]) {
    legitimateTokens.add(VMOONEY_ADDRESSES[chain].toLowerCase())
  }

  // Add DAI addresses
  if (DAI_ADDRESSES[chain]) {
    legitimateTokens.add(DAI_ADDRESSES[chain].toLowerCase())
  }

  // Add USDC addresses
  if (USDC_ADDRESSES[chain]) {
    legitimateTokens.add(USDC_ADDRESSES[chain].toLowerCase())
  }

  // Add USDT addresses
  if (USDT_ADDRESSES[chain]) {
    legitimateTokens.add(USDT_ADDRESSES[chain].toLowerCase())
  }

  return legitimateTokens
}

// Function to detect if a token name/symbol contains URL patterns (likely scam)
function containsUrlPattern(text: string): boolean {
  if (!text) return false

  const urlPatterns = [
    // Domain extensions
    /\.(com|io|org|net|co|me|ly|to|cc|tk|ml|ga|cf|info|biz|xyz|top|click|online|site|website|app|tech|crypto|finance|exchange|swap|defi|nft)(\b|$)/i,
    // Protocol patterns
    /(https?:\/\/|www\.)/i,
    // Short link services
    /(bit\.ly|t\.ly|tinyurl|short\.link|rebrand\.ly|cutt\.ly|is\.gd|ow\.ly)/i,
    // Common scam patterns
    /(\w+\.\w{2,4}\/\w+)/i, // domain/path pattern
  ]

  return urlPatterns.some((pattern) => pattern.test(text))
}

// Supported chain IDs for Etherscan V2 API
const SUPPORTED_CHAINS: Record<string, number> = {
  ethereum: 1,
  polygon: 137,
  bsc: 56,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  avalanche: 43114,
  sepolia: 11155111,
  'arbitrum-sepolia': 421614,
  'optimism-sepolia': 11155420,
}

async function fetchTokenBalance(
  contractAddress: string,
  walletAddress: string,
  chainId: number,
  apiKey: string
): Promise<string> {
  try {
    const balanceUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${walletAddress}&tag=latest&apikey=${apiKey}`

    const response = await fetch(balanceUrl)
    const data = await response.json()

    if (data.status === '1') {
      return data.result || '0'
    }
    return '0'
  } catch (error) {
    return '0'
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { address, chain = 'ethereum', page = '1', offset = '50' } = req.query

    // Validate required parameters
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Wallet address is required' })
    }

    if (!SUPPORTED_CHAINS[chain as string]) {
      return res.status(400).json({
        error: `Unsupported chain. Supported chains: ${Object.keys(
          SUPPORTED_CHAINS
        ).join(', ')}`,
      })
    }

    const chainId = SUPPORTED_CHAINS[chain as string]
    const cacheKey = `${address}-${chain}-${page}-${offset}`
    const now = Date.now()

    // Check cache
    const cached = tokenCache.get(cacheKey)
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      return res.status(200).json(cached.data)
    }

    const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY

    if (!apiKey) {
      return res.status(500).json({
        error: 'Etherscan API key not configured',
      })
    }

    // Step 1: Get token transfer events to discover tokens using V2 API
    const tokentxUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokentx&address=${address}&page=1&offset=10000&sort=desc&apikey=${apiKey}`

    const response = await fetch(tokentxUrl)

    if (!response.ok) {
      return res.status(500).json({
        error: `HTTP ${response.status}: ${response.statusText}`,
      })
    }

    const data = await response.json()

    // Check if the API returned an error
    if (data.status === '0' && data.message !== 'OK') {
      return res.status(400).json({
        error: `Etherscan API Error: ${data.message}`,
      })
    }

    // Step 2: Process token transfers to get unique tokens
    const tokenMap = new Map()

    if (data.result && Array.isArray(data.result)) {
      // Group by contract address and get token details
      data.result.forEach((tx: any) => {
        const contractAddress = tx.contractAddress
        if (contractAddress && !tokenMap.has(contractAddress)) {
          tokenMap.set(contractAddress, {
            contractAddress,
            tokenName: tx.tokenName,
            tokenSymbol: tx.tokenSymbol,
            tokenDecimal: tx.tokenDecimal || '18',
          })
        }
      })
    }

    // Step 3: Get legitimate token addresses for this chain
    const legitimateTokens = getLegitimateTokenAddresses(chain as string)

    // Step 4: Fetch current balance for each token using V2 API
    const tokensWithBalances = []

    for (const [contractAddress, tokenInfo] of tokenMap) {
      // Filter out tokens that are not in our legitimate tokens list
      if (!legitimateTokens.has(contractAddress.toLowerCase())) {
        continue
      }

      const balance = await fetchTokenBalance(
        contractAddress,
        address as string,
        chainId,
        apiKey
      )

      // Filter out tokens with URL patterns in name or symbol (likely scams)
      const hasUrlInName = containsUrlPattern(tokenInfo.tokenName)
      const hasUrlInSymbol = containsUrlPattern(tokenInfo.tokenSymbol)

      if (hasUrlInName || hasUrlInSymbol) {
        continue
      }

      // Only include tokens with non-zero balance
      if (balance !== '0') {
        tokensWithBalances.push({
          TokenAddress: contractAddress,
          TokenName: tokenInfo.tokenName,
          TokenSymbol: tokenInfo.tokenSymbol,
          TokenDivisor: tokenInfo.tokenDecimal,
          TokenBalance: balance,
        })
      }
    }

    const responseData = {
      status: '1',
      message: 'OK',
      result: tokensWithBalances,
    }

    // Cache the result
    tokenCache.set(cacheKey, {
      data: responseData,
      timestamp: now,
    })

    res.status(200).json(responseData)
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch wallet tokens',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export default withMiddleware(handler, rateLimit)
