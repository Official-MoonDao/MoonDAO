import { useState, useEffect, useCallback } from 'react'
import { Chain } from '../infura/infuraChains'

interface UseGasPriceReturn {
  gasPrice: bigint
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

interface UseGasPriceOptions {
  bufferPercent?: number
}

export function useGasPrice(
  chain: Chain | undefined,
  options: UseGasPriceOptions = {}
): UseGasPriceReturn {
  const { bufferPercent = 20 } = options

  const [gasPrice, setGasPrice] = useState<bigint>(BigInt(0))
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchGasPrice = useCallback(async () => {
    if (!chain?.id) {
      setError(new Error('No chain ID provided'))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Use API route to avoid CORS issues
      const response = await fetch(`/api/rpc/gas-price?chainId=${chain.id}`)

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      if (!data.gasPrice) {
        throw new Error('No gas price returned from API')
      }

      const baseGasPrice = BigInt(data.gasPrice)
      const gasPriceWithBuffer =
        (baseGasPrice * BigInt(100 + (bufferPercent || 0))) / BigInt(100)

      setGasPrice(gasPriceWithBuffer)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('Error fetching gas price:', errorMessage)
      setError(err instanceof Error ? err : new Error(errorMessage))

      // Use empirical fallback when fetch fails (network issues, etc.)
      // 20 gwei is a reasonable conservative estimate for most chains
      const fallbackGasPrice = BigInt(20 * 1e9) // 20 gwei
      const fallbackWithBuffer =
        (fallbackGasPrice * BigInt(100 + bufferPercent)) / BigInt(100)
      setGasPrice(fallbackWithBuffer)
    } finally {
      setIsLoading(false)
    }
  }, [chain, bufferPercent])

  useEffect(() => {
    fetchGasPrice()
  }, [fetchGasPrice, chain])

  return {
    gasPrice,
    isLoading,
    error,
    refetch: fetchGasPrice,
  }
}
