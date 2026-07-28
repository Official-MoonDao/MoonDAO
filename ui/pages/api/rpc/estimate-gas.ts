import {
  MOONDAO_ARBITRUM_TREASURY,
  MOONDAO_POLYGON_TREASURY,
  MOONDAO_TREASURY,
} from 'const/config'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  isSupportedRpcChain,
  jsonRpcWithFallback,
} from '@/lib/rpc/serverJsonRpc'

type EstimateGasResponse = {
  gasEstimate: string // in hex
  gasEstimateDecimal: string
  chainId: number
  error?: string
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

  if (!isSupportedRpcChain(chainId)) {
    return res.status(400).json({
      gasEstimate: '0x0',
      gasEstimateDecimal: '0',
      chainId,
      error: `Unsupported chain ID: ${chainId}`,
    })
  }

  try {
    // A node-level error (execution revert) would be identical on every
    // endpoint, so abort instead of retrying the fallbacks.
    const result: string = await jsonRpcWithFallback(
      chainId,
      'eth_estimateGas',
      [
        {
          from,
          to,
          data,
          ...(value && { value }),
        },
      ],
      { abortOnNodeError: true }
    )

    const gasEstimateDecimal = BigInt(result).toString()

    return res.status(200).json({
      gasEstimate: result,
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
