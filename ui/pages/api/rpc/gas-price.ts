import type { NextApiRequest, NextApiResponse } from 'next'

type GasPriceResponse = {
  gasPrice: string // in wei (hex string)
  gasPriceGwei: string
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
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_gasPrice',
        params: [],
        id: 1,
      }),
    })

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.message || 'RPC error')
    }

    if (!data.result) {
      throw new Error('No gas price returned from RPC')
    }

    const gasPriceWei = BigInt(data.result)
    const gasPriceGwei = Number(gasPriceWei) / 1e9

    return res.status(200).json({
      gasPrice: data.result,
      gasPriceGwei: gasPriceGwei.toFixed(2),
      chainId: chainIdNum,
    })
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
