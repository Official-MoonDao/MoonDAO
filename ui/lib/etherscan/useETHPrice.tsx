import { useEffect, useState } from 'react'

type QuoteDirection = 'ETH_TO_USD' | 'USD_TO_ETH'

export default function useETHPrice(
  amount: number,
  direction: QuoteDirection = 'ETH_TO_USD'
) {
  const [convertedAmount, setConvertedAmount] = useState<number>(0)
  const [ethPrice, setEthPrice] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  async function fetchEthPrice() {
    try {
      setIsLoading(true)
      const response = await fetch('/api/etherscan/eth-price')
      const { result } = await response.json()
      if (result?.ethusd) {
        setEthPrice(parseFloat(result.ethusd))
      }
    } catch (error) {
      console.error('Error fetching ETH price:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function calculateQuote() {
    if (!ethPrice || !amount) return

    if (direction === 'ETH_TO_USD') {
      setConvertedAmount(amount * ethPrice)
    } else {
      setConvertedAmount(amount / ethPrice)
    }
  }

  // Fetch ETH price every minute
  useEffect(() => {
    fetchEthPrice()
    const interval = setInterval(() => {
      fetchEthPrice()
    }, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    calculateQuote()
  }, [ethPrice, amount, direction])

  return { data: convertedAmount, isLoading, refresh: calculateQuote }
}
