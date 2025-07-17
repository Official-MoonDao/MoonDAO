import { generateOnRampURL } from '@coinbase/cbpay-js'
import { useEffect, useState } from 'react'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

interface CBOnrampProps {
  address: string
  selectedChain: any
  usdInput: string
  onSuccess: () => void
  onExit: () => void
}

export const CBOnramp: React.FC<CBOnrampProps> = ({
  address,
  selectedChain,
  usdInput,
  onSuccess,
  onExit,
}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [onrampUrl, setOnrampUrl] = useState<string | null>(null)

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
      console.error('Session token generation error:', error)
      throw error
    }
  }

  // Initialize onramp with session token (required by CDP)
  useEffect(() => {
    if (!address) {
      setError('Wallet address required')
      setIsLoading(false)
      return
    }

    const projectId = process.env.NEXT_PUBLIC_CB_PROJECT_ID
    if (!projectId) {
      setError('Configuration error: Missing project ID')
      setIsLoading(false)
      return
    }

    const initializeOnramp = async () => {
      try {
        setIsLoading(true)

        // Generate session token as required by CDP documentation
        const token = await generateSessionToken()

        // Generate URL with session token and correct addresses format
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
          redirectUrl: window.location.origin + '/mission?onramp=success',
        })

        setOnrampUrl(url)
        setIsLoading(false)
      } catch (error: any) {
        console.error('Onramp initialization error:', error)
        setError('Failed to initialize payment system: ' + error.message)
        setIsLoading(false)
      }
    }

    initializeOnramp()
  }, [address, selectedChain, usdInput])

  const handleOpenOnramp = () => {
    if (!onrampUrl) {
      setError('Onramp URL not available')
      return
    }

    // Open URL in popup
    const popup = window.open(
      onrampUrl,
      'coinbase-onramp',
      'width=500,height=700,scrollbars=yes,resizable=yes'
    )

    if (!popup) {
      setError('Popup blocked. Please allow popups for this site.')
      return
    }

    // Listen for completion
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed)
        // Check if success by looking for redirect parameter
        const urlParams = new URLSearchParams(window.location.search)
        if (urlParams.get('onramp') === 'success') {
          onSuccess()
        } else {
          onExit()
        }
      }
    }, 1000)

    // Also listen for message events from the popup
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://pay.coinbase.com') return

      if (event.data.type === 'onramp_success') {
        popup.close()
        clearInterval(checkClosed)
        onSuccess()
      } else if (event.data.type === 'onramp_exit') {
        popup.close()
        clearInterval(checkClosed)
        onExit()
      }
    }

    window.addEventListener('message', handleMessage)

    // Cleanup
    setTimeout(() => {
      window.removeEventListener('message', handleMessage)
    }, 300000) // 5 minutes timeout
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full max-w-md mx-auto bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white p-6">
        <div className="flex flex-col items-center justify-center space-y-6 min-h-[200px]">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
            <LoadingSpinner />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-white">
              Initializing Payment
            </h3>
            <p className="text-gray-300 text-sm">
              Generating secure session...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Success state - ready to purchase
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
              <span className="text-gray-400 text-sm">Amount:</span>
              <span className="text-white font-medium">
                ${usdInput || '20'} USD
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
          label={`Buy $${usdInput || '20'} of ETH with Coinbase`}
          action={handleOpenOnramp}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-4 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
          skipNetworkCheck={true}
        />

        {/* Additional info */}
        <div className="bg-black/10 rounded-lg p-4 border border-white/5">
          <div className="flex items-center justify-center space-x-2 text-gray-400 mb-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
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
