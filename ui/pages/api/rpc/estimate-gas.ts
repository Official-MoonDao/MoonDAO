import {
  MOONDAO_ARBITRUM_TREASURY,
  MOONDAO_POLYGON_TREASURY,
  MOONDAO_TREASURY,
} from 'const/config'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'

type EstimateGasResponse = {
  gasEstimate: string // in hex
  gasEstimateDecimal: string
  chainId: number
  error?: string
}

const infuraKey = process.env.NEXT_PUBLIC_INFURA_KEY

const CHAIN_RPC_URLS: { [key: number]: string } = {
  1: `https://mainnet.infura.io/v3/${infuraKey}`,
  42161: `https://arbitrum-mainnet.infura.io/v3/${infuraKey}`,
  8453: `https://base-mainnet.infura.io/v3/${infuraKey}`,
  11155111: `https://sepolia.infura.io/v3/${infuraKey}`,
  421614: `https://arbitrum-sepolia.infura.io/v3/${infuraKey}`,
  11155420: `https://optimism-sepolia.infura.io/v3/${infuraKey}`,
}

const FROM_ADDRESSES: { [key: number]: string } = {
  1: MOONDAO_TREASURY, // Ethereum
  42161: MOONDAO_ARBITRUM_TREASURY, // Arbitrum
  8453: MOONDAO_TREASURY, // Base
  137: MOONDAO_POLYGON_TREASURY, // Polygon
  10: MOONDAO_TREASURY, // Optimism
}

export async function handler(
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

  const { chainId, to, data, value } = req.body

  const from = FROM_ADDRESSES[chainId]

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
      error: 'Chain not supported',
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

export default withMiddleware(handler, rateLimit)
