import { generateOnRampURL } from '@coinbase/cbpay-js'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid'
import { DEPLOYED_ORIGIN } from 'const/config'
import { useEffect, useState, useMemo } from 'react'
import { arbitrum } from '@/lib/rpc/chains'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

interface CBOnrampProps {
  address: string
  selectedChain: any
  ethAmount: number
  redirectUrl?: string
  onSuccess?: () => void
  onExit?: () => void
  onBeforeNavigate?: () => void
  onQuoteCalculated?: (
    ethAmount: number,
    paymentSubtotal: number,
    paymentTotal: number
  ) => void
}

export const CBOnramp: React.FC<CBOnrampProps> = ({
  address,
  selectedChain,
  ethAmount,
  redirectUrl,
  onSuccess,
  onExit,
  onBeforeNavigate,
  onQuoteCalculated,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLimits, setShowLimits] = useState(false)
  const [quoteData, setQuoteData] = useState<{
    ethAmount: number
    purchaseAmount: number
    totalAmount: number
    fees: number
    onrampUrl?: string
    quoteId?: string | null
  } | null>(null)

  // Check if current chain is Arbitrum
  const isArbitrum = useMemo(
    () =>
      selectedChain === arbitrum ||
      selectedChain?.id === 42161 ||
      selectedChain?.id === 421614,
    [selectedChain]
  )

  // Fetch quote on component load and calculate fees
  useEffect(() => {
    const fetchQuote = async () => {
      if (!address || !ethAmount || ethAmount <= 0) {
        setIsLoadingQuote(false)
        return
      }

      setError(null)
      setIsLoadingQuote(true)

      try {
        // For Arbitrum, use Ethereum quotes to estimate fees
        const quoteNetwork = isArbitrum
          ? 'ethereum'
          : getQuoteNetworkName(selectedChain)

        // Step 1: Get spot price as initial estimate
        const priceResponse = await fetch('/api/coinbase/eth-price')
        if (!priceResponse.ok) {
          throw new Error('Failed to fetch ETH price from Coinbase')
        }
        const priceData = await priceResponse.json()
        const spotPrice = priceData.price

        // Step 2: Request initial quote with FULL amount + buffer
        // Coinbase's actual rate includes spread (~3-5% above spot)
        // Add 4% buffer to account for spread and get closer on first attempt
        const { channelId } = await generateSessionToken()
        const initialEstimateUSD = ethAmount * spotPrice * 1.04

        let currentResponse = await fetch('/api/coinbase/buy-quote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentAmount: initialEstimateUSD,
            destinationAddress: address,
            purchaseNetwork: quoteNetwork,
            purchaseCurrency: 'ETH',
            channelId,
          }),
        })

        if (!currentResponse.ok) {
          const errorData = await currentResponse.json().catch(() => ({}))
          console.error('Coinbase quote error:', {
            status: currentResponse.status,
            statusText: currentResponse.statusText,
            error: errorData,
          })

          if (currentResponse.status === 400) {
            setError(
              `Unable to process this amount through Coinbase. Please try a smaller amount or contact info@moondao.com for alternative payment methods.`
            )
          } else {
            setError(`Unable to get quote from Coinbase. Please try again.`)
          }
          setIsLoadingQuote(false)
          onQuoteCalculated?.(0, 0, 0)
          return
        }

        let currentData = await currentResponse.json()
        let currentQuote = currentData.quote

        if (!currentQuote || typeof currentQuote !== 'object') {
          setError('Invalid quote response from Coinbase')
          setIsLoadingQuote(false)
          return
        }

        // Step 3: Check if we got enough ETH, if not adjust iteratively (max 3 attempts)
        let receivedEthAmount = parseFloat(
          currentQuote?.purchase_amount?.value || '0'
        )
        let paymentSubtotal = parseFloat(
          currentQuote?.payment_subtotal?.value || '0'
        )
        let paymentTotal = parseFloat(currentQuote?.payment_total?.value || '0')
        let quoteId = currentQuote?.quote_id || null

        let attempts = 0
        const maxAttempts = 3

        while (receivedEthAmount < ethAmount && attempts < maxAttempts) {
          attempts++

          const ethShortfall = ethAmount - receivedEthAmount
          const effectiveRateTotal = paymentTotal / receivedEthAmount // USD (total) per ETH
          const additionalUsdTotal = ethShortfall * effectiveRateTotal

          // Add 1% buffer for non-linear spread scaling
          let adjustedUsd = paymentTotal + additionalUsdTotal * 1.01

          if (adjustedUsd <= paymentTotal) {
            adjustedUsd = paymentTotal + Math.max(1, paymentTotal * 0.005) // +0.5%
          }

          const adjustedResponse = await fetch('/api/coinbase/buy-quote', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              paymentAmount: adjustedUsd,
              destinationAddress: address,
              purchaseNetwork: quoteNetwork,
              purchaseCurrency: 'ETH',
            }),
          })

          if (!adjustedResponse.ok) {
            console.warn('Adjusted quote failed, using previous quote')
            break
          }

          const adjustedData = await adjustedResponse.json()
          const adjustedQuote = adjustedData.quote

          if (!adjustedQuote) {
            console.warn('Invalid adjusted quote, using previous quote')
            break
          }

          // Update with new quote values
          receivedEthAmount = parseFloat(
            adjustedQuote?.purchase_amount?.value || receivedEthAmount
          )
          const newPaymentSubtotal = parseFloat(
            adjustedQuote?.payment_subtotal?.value || paymentSubtotal
          )
          const newPaymentTotal = parseFloat(
            adjustedQuote?.payment_total?.value || paymentTotal
          )
          // Only move forward if totals increased
          if (
            newPaymentTotal <= paymentTotal &&
            receivedEthAmount <=
              parseFloat((paymentTotal / effectiveRateTotal).toFixed(8))
          ) {
            console.warn(
              'No improvement from adjusted quote, stopping iterations'
            )
            break
          }
          paymentSubtotal = newPaymentSubtotal
          paymentTotal = newPaymentTotal
          quoteId = adjustedQuote?.quote_id || quoteId
        }

        const totalFees = paymentTotal - paymentSubtotal

        if (receivedEthAmount > 0 && paymentTotal > 0) {
          setQuoteData({
            ethAmount: receivedEthAmount,
            purchaseAmount: paymentSubtotal,
            totalAmount: paymentTotal,
            fees: totalFees,
            quoteId,
          })
          onQuoteCalculated?.(receivedEthAmount, paymentSubtotal, paymentTotal)
          setIsLoadingQuote(false)
        } else {
          onQuoteCalculated?.(0, 0, 0)
          setError('Invalid final quote data from Coinbase')
          setIsLoadingQuote(false)
        }
      } catch (error) {
        console.error('Error fetching quote:', error)
        onQuoteCalculated?.(0, 0, 0)
        setError('Failed to fetch quote from Coinbase. Please try again.')
        setIsLoadingQuote(false)
      }
    }

    fetchQuote()
  }, [address, ethAmount, selectedChain, isArbitrum, onQuoteCalculated])

  // Map chain to network name for Coinbase QUOTE API
  // Quote API only supports: ethereum, base, polygon
  const getQuoteNetworkName = (chain: any) => {
    const chainName = chain?.name?.toLowerCase() || 'ethereum'
    const chainId = chain?.id

    // Map to Coinbase supported networks for quotes
    switch (chainName) {
      case 'base':
      case 'base sepolia':
      case 'base sepolia testnet':
        return 'base'
      case 'polygon':
        return 'polygon'
      default:
        // Handle by chain ID
        switch (chainId) {
          case 8453: // Base mainnet
          case 84532: // Base Sepolia
            return 'base'
          case 137: // Polygon mainnet
            return 'polygon'
          // All others default to ethereum for quotes
          default:
            return 'ethereum'
        }
    }
  }

  // Map chain to network name for Coinbase ONRAMP widget
  // Onramp supports more networks including arbitrum
  const getOnrampNetworkName = (chain: any) => {
    const chainName = chain?.name?.toLowerCase() || 'ethereum'
    const chainId = chain?.id

    switch (chainName) {
      case 'arbitrum':
      case 'arbitrum one':
        return 'arbitrum'
      case 'arbitrum sepolia':
        return 'arbitrum'
      case 'base':
      case 'base sepolia':
      case 'base sepolia testnet':
        return 'base'
      case 'polygon':
        return 'polygon'
      case 'optimism':
        return 'optimism'
      case 'ethereum':
      case 'mainnet':
      case 'sepolia':
        return 'ethereum'
      default:
        // Handle by chain ID
        switch (chainId) {
          case 42161: // Arbitrum mainnet
          case 421614: // Arbitrum Sepolia
            return 'arbitrum'
          case 8453: // Base mainnet
          case 84532: // Base Sepolia
            return 'base'
          case 137: // Polygon mainnet
            return 'polygon'
          case 10: // Optimism mainnet
          case 11155420: // Optimism Sepolia
            return 'optimism'
          case 1: // Ethereum mainnet
          case 11155111: // Sepolia
          default:
            return 'ethereum'
        }
    }
  }

  // Generate session token for secure init mode
  const generateSessionToken = async () => {
    try {
      const networkName = getOnrampNetworkName(selectedChain)

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
      return { token: data.sessionToken, channelId: data.channelId }
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

    if (!quoteData?.purchaseAmount) {
      setError('Please wait for quote to load')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const { token } = await generateSessionToken()

      const widgetParams: any = {
        appId: projectId,
        sessionToken: token,
        addresses: {
          [address]: [getOnrampNetworkName(selectedChain)],
        },
        defaultNetwork: getOnrampNetworkName(selectedChain),
        defaultAsset: 'ETH',
        redirectUrl: redirectUrl || `${DEPLOYED_ORIGIN}/`,
      }

      const paymentTotal = quoteData.purchaseAmount || 0
      if (paymentTotal > 0) {
        widgetParams.presetFiatAmount = quoteData.purchaseAmount
        widgetParams.fiatCurrency = 'USD'
      } else {
        widgetParams.presetFiatAmount = 20
        widgetParams.fiatCurrency = 'USD'
      }

      const url = generateOnRampURL(widgetParams)

      onBeforeNavigate?.()
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
            {isLoadingQuote ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
                <span className="ml-2 text-gray-400 text-sm">
                  Getting quote...
                </span>
              </div>
            ) : quoteData?.purchaseAmount ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">
                    Coinbase Fees
                    {isArbitrum && <span className="text-xs ml-1">(est.)</span>}
                    :
                  </span>
                  <span className="text-orange-400 font-medium">
                    $
                    {quoteData.fees.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    USD
                  </span>
                </div>
                {isArbitrum && (
                  <div className="text-xs text-gray-500 italic">
                    * Fees estimated using Ethereum rates. Actual fees may vary
                    slightly.
                  </div>
                )}
                <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                  <span className="text-gray-400 text-sm font-semibold">
                    Total
                    {isArbitrum && (
                      <span className="text-xs ml-1 font-normal">(est.)</span>
                    )}
                    :
                  </span>
                  <span className="text-white font-bold">
                    $
                    {quoteData.totalAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    USD
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">ETH Amount:</span>
                <span className="text-white font-medium">
                  {ethAmount.toFixed(6)} ETH
                </span>
              </div>
            )}

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
              : isLoadingQuote
              ? 'Getting quote...'
              : quoteData?.purchaseAmount
              ? `Buy $${quoteData.purchaseAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} of ETH with Coinbase`
              : `Buy ETH with Coinbase`
          }
          showSignInLabel={false}
          action={handleOpenOnramp}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-4 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          skipNetworkCheck={true}
          isDisabled={isLoading || isLoadingQuote || !quoteData?.purchaseAmount}
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

        {/* Purchase Limits Info */}
        <div className="bg-black/10 rounded-lg border border-white/5">
          <button
            type="button"
            onClick={() => setShowLimits(!showLimits)}
            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors rounded-lg"
          >
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Purchase Limits
            </span>
            {showLimits ? (
              <ChevronUpIcon className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {showLimits && (
            <div className="mt-2 px-3 pb-3 space-y-2 text-xs text-gray-300">
              <div className="flex items-start space-x-2">
                <span className="text-gray-500 mt-0.5">•</span>
                <p>
                  <span className="text-white font-medium">Minimum:</span> $2
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-gray-500 mt-0.5">•</span>
                <p>
                  <span className="text-white font-medium">
                    Guest checkout:
                  </span>{' '}
                  $500/week
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-gray-500 mt-0.5">•</span>
                <p>
                  <span className="text-white font-medium">
                    Coinbase account:
                  </span>{' '}
                  Up to $25k/day for verified U.S. accounts (varies by
                  verification level & payment method)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Additional info */}
        <div className="bg-black/10 rounded-lg p-4 border border-white/5">
          <div className="flex items-center justify-center space-x-2 text-gray-400 mb-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 6 16 0z"
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
