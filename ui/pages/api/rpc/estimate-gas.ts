import type { NextApiRequest, NextApiResponse } from 'next'

type EstimateGasResponse = {
  gasEstimate: string // in hex
  gasEstimateDecimal: string
  chainId: number
  error?: string
}

// Construct RPC URLs directly to ensure env vars work in API routes
const infuraKey = process.env.NEXT_PUBLIC_INFURA_KEY

const CHAIN_RPC_URLS: { [key: number]: string } = {
  1: `https://mainnet.infura.io/v3/${infuraKey}`,
  42161: `https://arbitrum-mainnet.infura.io/v3/${infuraKey}`,
  8453: `https://base-mainnet.infura.io/v3/${infuraKey}`,
  11155111: `https://sepolia.infura.io/v3/${infuraKey}`,
  421614: `https://arbitrum-sepolia.infura.io/v3/${infuraKey}`,
  11155420: `https://optimism-sepolia.infura.io/v3/${infuraKey}`,
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EstimateGasResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      gasEstimate: '0x0',
      gasEstimateDecimal: '0',
      chainId: 0,
      error: 'Method not allowed',
    })
  }

  const { chainId, from, to, data, value } = req.body

  if (!chainId) {
    return res.status(400).json({
      gasEstimate: '0x0',
      gasEstimateDecimal: '0',
      chainId: 0,
      error: 'Missing chainId',
    })
  }
  if (!from) {
    return res.status(400).json({
      gasEstimate: '0x0',
      gasEstimateDecimal: '0',
      chainId,
      error: 'Missing from address (wallet not connected?)',
    })
  }
  if (!to) {
    return res.status(400).json({
      gasEstimate: '0x0',
      gasEstimateDecimal: '0',
      chainId,
      error: 'Missing to address',
    })
  }
  if (!data) {
    return res.status(400).json({
      gasEstimate: '0x0',
      gasEstimateDecimal: '0',
      chainId,
      error: 'Missing data',
    })
  }

  const rpcUrl = CHAIN_RPC_URLS[chainId]

  if (!infuraKey) {
    console.error('NEXT_PUBLIC_INFURA_KEY is not set')
    return res.status(500).json({
      gasEstimate: '0x0',
      gasEstimateDecimal: '0',
      chainId,
      error: 'Infura API key not configured',
    })
  }

  if (!rpcUrl) {
    return res.status(400).json({
      gasEstimate: '0x0',
      gasEstimateDecimal: '0',
      chainId,
      error: `Unsupported chain ID: ${chainId}`,
    })
  }

  try {
    // First attempt: try with the full value
    let response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_estimateGas',
        params: [
          {
            from,
            to,
            data,
            ...(value && { value }),
          },
        ],
        id: 1,
      }),
    })

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status}`)
    }

    let responseData = await response.json()

    // If estimation fails due to insufficient funds, retry without value
    // Gas usage is the same regardless of the value sent (for most contracts)
    if (
      responseData.error &&
      responseData.error.message &&
      (responseData.error.message.includes('insufficient funds') ||
        responseData.error.message.includes('insufficient balance'))
    ) {
      console.log(
        'Gas estimation failed due to insufficient funds, retrying without value...'
      )

      // Retry without the value parameter
      response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_estimateGas',
          params: [
            {
              from,
              to,
              data,
              // Don't include value - we just want gas estimate
            },
          ],
          id: 1,
        }),
      })

      if (!response.ok) {
        throw new Error(`RPC request failed: ${response.status}`)
      }

      responseData = await response.json()

      // If retry also fails with "Insufficient ETH sent", it means the contract
      // requires a specific value (like LayerZero). Return error to use fallback estimate.
      if (
        responseData.error &&
        responseData.error.message &&
        responseData.error.message.includes('Insufficient ETH sent')
      ) {
        console.log(
          'Contract requires specific ETH value, frontend will use fallback estimate'
        )
        throw new Error(responseData.error.message)
      }
    }

    if (responseData.error) {
      throw new Error(responseData.error.message || 'RPC error')
    }

    if (!responseData.result) {
      throw new Error('No gas estimate returned from RPC')
    }

    const gasEstimateDecimal = BigInt(responseData.result).toString()

    return res.status(200).json({
      gasEstimate: responseData.result,
      gasEstimateDecimal,
      chainId,
    })
  } catch (error) {
    console.error('Error estimating gas:', error)
    return res.status(500).json({
      gasEstimate: '0x0',
      gasEstimateDecimal: '0',
      chainId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
