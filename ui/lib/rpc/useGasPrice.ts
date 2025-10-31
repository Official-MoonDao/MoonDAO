import { useState, useEffect, useCallback } from 'react'
import { Chain } from '../rpc/chains'

type UseGasPriceReturn = {
  gasPrice: bigint
  maxFeePerGas?: bigint // EIP-1559 max fee per gas
  maxPriorityFeePerGas?: bigint // EIP-1559 priority fee
  effectiveGasPrice: bigint // The actual gas price that will be used (baseFee + priorityFee, matches wallet display)
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

type UseGasPriceOptions = {
  bufferPercent?: number
}

export function useGasPrice(
  chain: Chain | undefined,
  options: UseGasPriceOptions = {}
): UseGasPriceReturn {
  const { bufferPercent = 0 } = options

  const [gasPrice, setGasPrice] = useState<bigint>(BigInt(0))
  const [maxFeePerGas, setMaxFeePerGas] = useState<bigint | undefined>()
  const [maxPriorityFeePerGas, setMaxPriorityFeePerGas] = useState<
    bigint | undefined
  >()
  const [effectiveGasPrice, setEffectiveGasPrice] = useState<bigint>(BigInt(0))
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
      // Always use API for consistent fee estimation (matches what wallets display)
      // Wallet provider's getFeeData() may return inflated values that don't match
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

      if (
        data.maxFeePerGas &&
        data.maxPriorityFeePerGas &&
        data.baseFeePerGas
      ) {
        const maxFee = BigInt(data.maxFeePerGas)
        const priorityFee = BigInt(data.maxPriorityFeePerGas)
        const baseFee = BigInt(data.baseFeePerGas)
        setMaxFeePerGas(maxFee)
        setMaxPriorityFeePerGas(priorityFee)

        // Actual effective gas price = baseFee + priorityFee (matches wallet display)
        const actualEffectiveGasPrice = baseFee + priorityFee
        setEffectiveGasPrice(actualEffectiveGasPrice)
      } else if (data.maxFeePerGas && data.maxPriorityFeePerGas) {
        // If we have maxFee but not baseFee, estimate baseFee
        const maxFee = BigInt(data.maxFeePerGas)
        const priorityFee = BigInt(data.maxPriorityFeePerGas)
        setMaxFeePerGas(maxFee)
        setMaxPriorityFeePerGas(priorityFee)

        const estimatedBaseFee =
          maxFee > priorityFee
            ? ((maxFee - priorityFee) * BigInt(100)) / BigInt(240)
            : maxFee
        const actualEffectiveGasPrice = estimatedBaseFee + priorityFee
        setEffectiveGasPrice(actualEffectiveGasPrice)
      } else {
        setEffectiveGasPrice(gasPriceWithBuffer)
      }

      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('Error fetching gas price:', errorMessage)
      setError(err instanceof Error ? err : new Error(errorMessage))
      setGasPrice(BigInt(0))
      setEffectiveGasPrice(BigInt(0))
    } finally {
      setIsLoading(false)
    }
  }, [chain, bufferPercent])

  useEffect(() => {
    fetchGasPrice()
  }, [fetchGasPrice, chain])

  return {
    gasPrice,
    maxFeePerGas,
    maxPriorityFeePerGas,
    effectiveGasPrice,
    isLoading,
    error,
    refetch: fetchGasPrice,
  }
}
