import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  isSupportedRpcChain,
  jsonRpcWithFallback,
} from '@/lib/rpc/serverJsonRpc'

type GasPriceResponse = {
  gasPrice: string // in wei (hex string)
  gasPriceGwei: string
  // EIP-1559 fee data
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
  baseFeePerGas?: string
  maxFeePerGasGwei?: string
  maxPriorityFeePerGasGwei?: string
  baseFeePerGasGwei?: string
  chainId: number
  error?: string
}

export async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GasPriceResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      gasPrice: '0',
      gasPriceGwei: '0',
      chainId: 0,
      error: 'Method not allowed',
    })
  }

  const { chainId } = req.query

  if (!chainId || typeof chainId !== 'string') {
    return res.status(400).json({
      gasPrice: '0',
      gasPriceGwei: '0',
      chainId: 0,
      error: 'Chain ID is required',
    })
  }

  const chainIdNum = parseInt(chainId)

  if (!isSupportedRpcChain(chainIdNum)) {
    return res.status(400).json({
      gasPrice: '0',
      gasPriceGwei: '0',
      chainId: chainIdNum,
      error: `Unsupported chain ID: ${chainId}`,
    })
  }

  try {
    const gasPriceResult: string = await jsonRpcWithFallback(
      chainIdNum,
      'eth_gasPrice',
      []
    )

    const gasPriceWei = BigInt(gasPriceResult)
    const gasPriceGwei = Number(gasPriceWei) / 1e9

    // Fetch EIP-1559 fee data for chains that support it
    let maxFeePerGas: bigint | undefined
    let maxPriorityFeePerGas: bigint | undefined
    let baseFeePerGas: bigint | undefined

    try {
      // Get latest block for base fee
      const block = await jsonRpcWithFallback(chainIdNum, 'eth_getBlockByNumber', [
        'latest',
        false,
      ])
      if (block?.baseFeePerGas) {
        baseFeePerGas = BigInt(block.baseFeePerGas)
      }

      // Get max priority fee per gas recommendation
      const priorityFee = await jsonRpcWithFallback(
        chainIdNum,
        'eth_maxPriorityFeePerGas',
        []
      )
      if (priorityFee) {
        maxPriorityFeePerGas = BigInt(priorityFee)
      }

      // If both base fee and priority fee are available, calculate max fee
      // Max fee = base fee * 2 + priority fee (standard wallet formula)
      if (baseFeePerGas && maxPriorityFeePerGas) {
        // Add 20% buffer to account for base fee fluctuations
        maxFeePerGas =
          (baseFeePerGas * BigInt(240)) / BigInt(100) + maxPriorityFeePerGas
      }
    } catch (eip1559Error) {
      // EIP-1559 not supported or failed
      console.warn('EIP-1559 fee data not available:', eip1559Error)
    }

    const response: GasPriceResponse = {
      gasPrice: gasPriceResult,
      gasPriceGwei: gasPriceGwei.toFixed(2),
      chainId: chainIdNum,
    }

    if (maxFeePerGas) {
      response.maxFeePerGas = `0x${maxFeePerGas.toString(16)}`
      response.maxFeePerGasGwei = (Number(maxFeePerGas) / 1e9).toFixed(2)
    }

    if (maxPriorityFeePerGas) {
      response.maxPriorityFeePerGas = `0x${maxPriorityFeePerGas.toString(16)}`
      response.maxPriorityFeePerGasGwei = (
        Number(maxPriorityFeePerGas) / 1e9
      ).toFixed(2)
    }

    if (baseFeePerGas) {
      response.baseFeePerGas = `0x${baseFeePerGas.toString(16)}`
      response.baseFeePerGasGwei = (Number(baseFeePerGas) / 1e9).toFixed(2)
    }

    return res.status(200).json(response)
  } catch (error) {
    console.error(
      `Gas price API error for chain ${chainIdNum}:`,
      error instanceof Error ? error.message : 'Unknown error'
    )
    return res.status(500).json({
      gasPrice: '0',
      gasPriceGwei: '0',
      chainId: chainIdNum,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export default withMiddleware(handler, rateLimit)
