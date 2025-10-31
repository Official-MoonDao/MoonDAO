import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'

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
  const rpcUrl = CHAIN_RPC_URLS[chainIdNum]

  if (!infuraKey) {
    console.error('NEXT_PUBLIC_INFURA_KEY is not set')
    return res.status(500).json({
      gasPrice: '0',
      gasPriceGwei: '0',
      chainId: chainIdNum,
      error: 'Infura API key not configured',
    })
  }

  if (!rpcUrl) {
    return res.status(400).json({
      gasPrice: '0',
      gasPriceGwei: '0',
      chainId: chainIdNum,
      error: `Unsupported chain ID: ${chainId}`,
    })
  }

  try {
    const gasPriceResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_gasPrice',
        params: [],
        id: 1,
      }),
    })

    if (!gasPriceResponse.ok) {
      throw new Error(`RPC request failed: ${gasPriceResponse.status}`)
    }

    const gasPriceData = await gasPriceResponse.json()

    if (gasPriceData.error) {
      throw new Error(gasPriceData.error.message || 'RPC error')
    }

    if (!gasPriceData.result) {
      throw new Error('No gas price returned from RPC')
    }

    const gasPriceWei = BigInt(gasPriceData.result)
    const gasPriceGwei = Number(gasPriceWei) / 1e9

    // Fetch EIP-1559 fee data for chains that support it
    let maxFeePerGas: bigint | undefined
    let maxPriorityFeePerGas: bigint | undefined
    let baseFeePerGas: bigint | undefined

    try {
      // Get latest block for base fee
      const blockResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBlockByNumber',
          params: ['latest', false],
          id: 2,
        }),
      })

      if (blockResponse.ok) {
        const blockData = await blockResponse.json()
        if (blockData.result?.baseFeePerGas) {
          baseFeePerGas = BigInt(blockData.result.baseFeePerGas)
        }
      }

      // Get max priority fee per gas recommendation
      const priorityFeeResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_maxPriorityFeePerGas',
          params: [],
          id: 3,
        }),
      })

      if (priorityFeeResponse.ok) {
        const priorityFeeData = await priorityFeeResponse.json()
        if (priorityFeeData.result) {
          maxPriorityFeePerGas = BigInt(priorityFeeData.result)
        }
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
      gasPrice: gasPriceData.result,
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
