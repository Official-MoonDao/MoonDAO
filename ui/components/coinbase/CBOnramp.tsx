import { generateOnRampURL } from '@coinbase/cbpay-js'
import { DEPLOYED_ORIGIN } from 'const/config'
import { useEffect, useState } from 'react'
import useETHPrice from '../../lib/etherscan/useETHPrice'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

interface CBOnrampProps {
  address: string
  selectedChain: any
  usdInput: string
  redirectUrl?: string
  onSuccess?: () => void
  onExit?: () => void
}

export const CBOnramp: React.FC<CBOnrampProps> = ({
  address,
  selectedChain,
  usdInput,
  redirectUrl,
  onSuccess,
  onExit,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quoteData, setQuoteData] = useState<{
    ethAmount: number
    actualUsdValue: number
    fees: number
    onrampUrl?: string
  } | null>(null)

  // Convert ETH purchase amount to USD value
  const { data: ethToUsdValue } = useETHPrice(
    quoteData?.ethAmount || 0,
    'ETH_TO_USD'
  )

  // Fetch quote on component load
  useEffect(() => {
    const fetchQuote = async () => {
      if (!address || !usdInput || parseFloat(usdInput) <= 0) return

      try {
        const paymentAmount = parseFloat(usdInput)
        const quoteResponse = await fetch('/api/coinbase/buy-quote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentAmount,
            destinationAddress: address,
            purchaseNetwork: getNetworkName(selectedChain),
            purchaseCurrency: 'ETH',
          }),
        })

        if (quoteResponse.ok) {
          const data = await quoteResponse.json()
          const quote = data.quote

          // Extract values from Coinbase quote response (nested under 'quote')
          const ethAmount = parseFloat(quote?.purchase_amount?.value || '0')
          const paymentSubtotal = parseFloat(
            quote?.payment_subtotal?.value || '0'
          )
          const coinbaseFee = parseFloat(quote?.coinbase_fee?.value || '0')
          const networkFee = parseFloat(quote?.network_fee?.value || '0')
          const totalFees = coinbaseFee + networkFee

          if (ethAmount > 0) {
            setQuoteData({
              ethAmount,
              actualUsdValue: paymentSubtotal,
              fees: totalFees,
            })
          }
        }
      } catch (error) {
        // Silently handle initial quote fetch errors
      }
    }

    fetchQuote()
  }, [address, usdInput, selectedChain])

  // Map chain name to supported network format
  const getNetworkName = (chain: any) => {
    const chainName = chain?.name?.toLowerCase() || 'ethereum'
    const chainId = chain?.id

    // Map common chain names to Coinbase supported networks
    switch (chainName) {
      case 'arbitrum':
      case 'arbitrum one':
        return 'arbitrum'
      case 'arbitrum sepolia':
        return 'arbitrum' // Testnet maps to mainnet network for Coinbase
      case 'base':
        return 'base'
      case 'base sepolia':
        return 'base' // Testnet maps to mainnet network for Coinbase
      case 'sepolia':
      case 'ethereum':
      case 'mainnet':
        return 'ethereum'
      case 'optimism':
        return 'optimism'
      case 'optimism sepolia':
        return 'optimism' // Optimism testnet maps to mainnet
      case 'polygon':
        return 'polygon'
      default:
        // Handle by chain ID if name doesn't match
        switch (chainId) {
          case 11155111: // Sepolia
            return 'ethereum'
          case 421614: // Arbitrum Sepolia
            return 'arbitrum'
          case 84532: // Base Sepolia
            return 'base'
          case 11155420: // Optimism Sepolia
            return 'optimism'
          default:
            return 'ethereum' // fallback
        }
    }
  }

  // Generate session token for secure init mode
  const generateSessionToken = async () => {
    try {
      const networkName = getNetworkName(selectedChain)

      const response = await fetch('/api/coinbase/session-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          blockchains: [networkName],
          assets: ['ETH', 'USDC'],
        }),
      })

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(
          errorData.error ||
            `HTTP ${response.status}: Failed to generate session token`
        )
      }

      const data = await response.json()
      if (!data.sessionToken) {
        throw new Error('No session token received from API')
      }
      return data.sessionToken
    } catch (error: any) {
      throw error
    }
  }

  const handleOpenOnramp = async () => {
    if (!address) {
      setError('Wallet address required')
      return
    }

    const projectId = process.env.NEXT_PUBLIC_CB_PROJECT_ID
    if (!projectId) {
      setError('Configuration error: Missing project ID')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Get quote from Coinbase to calculate actual ETH amount user will receive
      const paymentAmount = parseFloat(usdInput || '20')

      if (paymentAmount > 0) {
        try {
          const quoteResponse = await fetch('/api/coinbase/buy-quote', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              paymentAmount,
              destinationAddress: address,
              purchaseNetwork: getNetworkName(selectedChain),
              purchaseCurrency: 'ETH',
            }),
          })

          if (quoteResponse.ok) {
            const data = await quoteResponse.json()

            // Extract values from Coinbase quote response (nested under 'quote')
            const quote = data.quote

            const ethAmount = parseFloat(quote?.purchase_amount?.value || '0')
            const paymentTotal = parseFloat(quote?.payment_total?.value || '0')
            const paymentSubtotal = parseFloat(
              quote?.payment_subtotal?.value || '0'
            )
            const coinbaseFee = parseFloat(quote?.coinbase_fee?.value || '0')
            const networkFee = parseFloat(quote?.network_fee?.value || '0')
            const totalFees = coinbaseFee + networkFee

            // Store the onramp URL from Coinbase for direct use
            const coinbaseOnrampUrl = quote?.onramp_url

            if (ethAmount > 0) {
              // Store quote data for display
              const newQuoteData = {
                ethAmount,
                actualUsdValue: paymentSubtotal,
                fees: totalFees,
                onrampUrl: coinbaseOnrampUrl,
              }

              setQuoteData(newQuoteData)

              // If we have a pre-built onramp URL from the quote, use it directly
              if (coinbaseOnrampUrl) {
                let finalUrl = coinbaseOnrampUrl

                // Add redirect URL
                if (redirectUrl) {
                  const separator = finalUrl.includes('?') ? '&' : '?'
                  finalUrl += `${separator}redirectUrl=${encodeURIComponent(
                    redirectUrl
                  )}`
                }

                window.location.href = finalUrl
                return
              }
            }
          } else {
            // Failed to get buy quote, using original amount
          }
        } catch (quoteError) {
          // Quote calculation failed, using original amount
        }
      }

      // Fallback: Generate session token and create URL manually
      const token = await generateSessionToken()

      const url = generateOnRampURL({
        appId: projectId,
        sessionToken: token,
        addresses: {
          [address]: [getNetworkName(selectedChain)],
        },
        ...(usdInput &&
          parseFloat(usdInput) > 0 && {
            presetFiatAmount: parseFloat(usdInput),
            fiatCurrency: 'USD',
          }),
        defaultNetwork: getNetworkName(selectedChain),
        defaultAsset: 'ETH',
        redirectUrl: redirectUrl || `${DEPLOYED_ORIGIN}/`,
      })

      window.location.href = url
    } catch (error: any) {
      setError('Failed to initialize payment system: ' + error.message)
      setIsLoading(false)
    }
  }

  // Error state
  if (error) {
    return (
      <div className="w-full max-w-md mx-auto bg-gradient-to-br from-gray-900 via-red-900/30 to-purple-900/20 backdrop-blur-xl border border-red-500/20 rounded-2xl shadow-2xl text-white p-6">
        <div className="flex flex-col items-center justify-center space-y-4 min-h-[200px]">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-red-400">Error</h3>
            <p className="text-gray-300 text-sm">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  // Ready state - no loading spinner on component mount
  return (
    <div className="w-full max-w-md mx-auto bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Buy Crypto</h2>
            <p className="text-gray-300 text-xs">
              {selectedChain?.name || 'Ethereum'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Purchase details */}
        <div>
          <h4 className="text-gray-300 font-medium text-sm uppercase tracking-wide mb-3">
            Purchase Details
          </h4>
          <div className="bg-black/20 rounded-lg p-4 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Payment Amount:</span>
              <span className="text-white font-medium">
                $
                {usdInput && !isNaN(parseFloat(usdInput))
                  ? parseFloat(usdInput).toLocaleString()
                  : '20'}{' '}
                USD
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Asset:</span>
              <span className="text-white font-medium">ETH</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Network:</span>
              <span className="text-white font-medium">
                {selectedChain?.name || 'Ethereum'}
              </span>
            </div>
          </div>
        </div>

        {/* Purchase button */}
        <PrivyWeb3Button
          label={
            isLoading
              ? 'Launching Coinbase...'
              : `Buy $${
                  usdInput ? parseFloat(usdInput).toLocaleString() : '20'
                } of ETH with Coinbase`
          }
          action={handleOpenOnramp}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-4 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          skipNetworkCheck={true}
          isDisabled={isLoading}
        />

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center space-x-2 text-gray-400">
            <LoadingSpinner />
            <span className="text-sm">
              Getting quote and launching Coinbase...
            </span>
          </div>
        )}

        {/* Additional info */}
        <div className="bg-black/10 rounded-lg p-4 border border-white/5">
          <div className="flex items-center justify-center space-x-2 text-gray-400 mb-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 616 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs font-medium uppercase tracking-wide">
              Secured by Coinbase
            </span>
          </div>
          <p className="text-gray-300 text-xs text-center leading-relaxed">
            You'll be redirected to Coinbase to complete your purchase securely
          </p>
        </div>
      </div>
    </div>
  )
}
