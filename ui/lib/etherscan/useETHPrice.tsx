import { useMemo } from 'react'
import useSWR from 'swr'
import fetcher from '@/lib/swr/fetcher'

type QuoteDirection = 'ETH_TO_USD' | 'USD_TO_ETH'

export default function useETHPrice(
  amount: number,
  direction: QuoteDirection = 'ETH_TO_USD'
) {
  const {
    data: ethPriceData,
    isLoading: isLoadingPrice,
    error,
  } = useSWR('/api/etherscan/eth-price', fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 30000,
  })

  const ethPrice = useMemo(() => {
    if (ethPriceData?.result?.ethusd) {
      const price = parseFloat(ethPriceData.result.ethusd)
      // Validate
      if (!isNaN(price) && price > 0) {
        return price
      }
    }
    return null
  }, [ethPriceData])

  const convertedAmount = useMemo(() => {
    if (!ethPrice || !amount) return 0

    if (direction === 'ETH_TO_USD') {
      return amount * ethPrice
    } else {
      return amount / ethPrice
    }
  }, [ethPrice, amount, direction])

  const isLoading = isLoadingPrice && !ethPriceData

  return { data: convertedAmount, isLoading, error, ethPrice }
}
