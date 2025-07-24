import { useState, useEffect } from 'react'

interface TokenData {
  marketCap: string
  marketCapChange: string
  totalSupply: string
  circulatingSupply: string
  circulatingPercent: string
  volume24h: string
  volumeChange: string
  price: string
  priceChange: string
  lastUpdated: string
}

export function useMooneyTokenData() {
  const [tokenData, setTokenData] = useState<TokenData>({
    marketCap: '---',
    marketCapChange: '---',
    totalSupply: '---',
    circulatingSupply: '---',
    circulatingPercent: '---',
    volume24h: '---',
    volumeChange: '---',
    price: '---',
    priceChange: '---',
    lastUpdated: 'Never'
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTokenData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      console.log('Fetching MOONEY data from CoinGecko API...')
      
      // Use CoinGecko's free API which works without API key and doesn't have CORS issues
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/mooney?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false'
      )
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('CoinGecko API response:', data)
      
      if (!data.market_data) {
        throw new Error('MOONEY market data not found in API response')
      }
      
      const marketData = data.market_data
      
      console.log('Processing MOONEY data:', marketData)
      
      // Extract data from CoinGecko API response
      const price = marketData.current_price?.usd || 0
      const priceChange24h = marketData.price_change_percentage_24h || 0
      const volume24h = marketData.total_volume?.usd || 0
      const marketCapFromAPI = marketData.market_cap?.usd || 0
      const totalSupply = marketData.total_supply || 0
      let circulatingSupply = marketData.circulating_supply || 0
      
      // If circulating supply is 0 but we have total supply, use a reasonable estimate
      // For many tokens, circulating supply might not be tracked accurately
      if (circulatingSupply === 0 && totalSupply > 0) {
        // For MOONEY, use the official distribution: 54% is circulating supply according to MoonDAO's tokenomics
        // This is shown in the Token Distribution section of the MOONEY page
        circulatingSupply = totalSupply * 0.54 // 54% is circulating (community allocation)
      }
      
      // Calculate market cap if not provided (price * circulating supply)
      let calculatedMarketCap = marketCapFromAPI
      if (calculatedMarketCap === 0 && price > 0 && circulatingSupply > 0) {
        calculatedMarketCap = price * circulatingSupply
      }
      
      console.log('Extracted CoinGecko data:', {
        price,
        priceChange24h,
        volume24h,
        marketCapFromAPI,
        calculatedMarketCap,
        totalSupply,
        circulatingSupply
      })
      
      // Format numbers nicely
      const formatMarketCap = (value: number) => {
        if (!value || value === 0) return 'N/A'
        if (value >= 1000000) {
          return `$${(value / 1000000).toFixed(2)}M`
        } else if (value >= 1000) {
          return `$${(value / 1000).toFixed(1)}K`
        } else if (value >= 1) {
          return `$${value.toFixed(0)}`
        } else {
          return `$${value.toFixed(2)}`
        }
      }
      
      const formatSupply = (value: number) => {
        if (!value || value === 0) return 'N/A'
        if (value >= 1000000000) {
          return `${(value / 1000000000).toFixed(2)}B`
        } else if (value >= 1000000) {
          return `${(value / 1000000).toFixed(1)}M`
        } else if (value >= 1000) {
          return `${(value / 1000).toFixed(1)}K`
        }
        return value.toLocaleString()
      }
      
      const formatPercent = (value: number) => {
        if (value === null || value === undefined || isNaN(value)) return 'N/A'
        const sign = value >= 0 ? '+' : ''
        return `${sign}${value.toFixed(2)}%`
      }
      
      const formatPrice = (value: number) => {
        if (!value || value === 0) return '$0.000000'
        if (value >= 1) {
          return `$${value.toFixed(4)}`
        } else if (value >= 0.01) {
          return `$${value.toFixed(6)}`
        } else {
          return `$${value.toFixed(8)}`
        }
      }

      setTokenData({
        marketCap: formatMarketCap(calculatedMarketCap),
        marketCapChange: formatPercent(priceChange24h),
        totalSupply: formatSupply(totalSupply),
        circulatingSupply: formatSupply(circulatingSupply),
        circulatingPercent: totalSupply ? `${((circulatingSupply / totalSupply) * 100).toFixed(1)}%` : 'N/A',
        volume24h: formatMarketCap(volume24h),
        volumeChange: 'N/A', // CoinGecko doesn't provide volume change in this endpoint
        price: formatPrice(price),
        priceChange: formatPercent(priceChange24h),
        lastUpdated: new Date().toLocaleTimeString()
      })
      
      console.log('Token data updated successfully from CoinGecko live API')
      
      console.log('Token data updated successfully')
      
    } catch (err) {
      console.error('Error fetching token data:', err)
      setError(`API Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
      
      // Don't update data on error - keep showing "---" or last known values
      setTokenData(prev => ({
        ...prev,
        lastUpdated: `Error at ${new Date().toLocaleTimeString()}`
      }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Fetch immediately
    fetchTokenData()
    
    // Then fetch every 30 seconds
    const interval = setInterval(fetchTokenData, 30000)
    
    return () => clearInterval(interval)
  }, [])

  return { tokenData, loading, error, refetch: fetchTokenData }
}
