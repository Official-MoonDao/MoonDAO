import { ArrowDownIcon } from '@heroicons/react/24/outline'
import {
  CHAIN_TOKEN_NAMES,
  MOONEY_ADDRESSES,
  FEE_HOOK_ADDRESSES,
  TICK_SPACING,
} from 'const/config'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import { useUniswapV4 } from '../../lib/uniswap/hooks/useUniswapV4'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import GasIcon from '../assets/GasIcon'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export default function NativeToMooney({ selectedChain }: any) {
  const chainSlug = getChainSlug(selectedChain)

  const nativeBalance = useNativeBalance()

  const account = useActiveAccount()
  const address = account?.address

  const [amount, setAmount] = useState<string>('')
  const [output, setOutput] = useState<string>('0')
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false)
  const [estimatedGasUsedUSD, setEstimatedGasUsedUSD] = useState<any>(0)
  const [usdCost, setUSDCost] = useState<string>()
  const [hasValidRoute, setHasValidRoute] = useState(false)

  const mooneyAddress = MOONEY_ADDRESSES[chainSlug]
  const { quote, swap } = useUniswapV4(
    mooneyAddress,
    18,
    TICK_SPACING,
    FEE_HOOK_ADDRESSES[chainSlug]
  )

  useEffect(() => {
    const numAmount = parseFloat(amount) || 0
    if (numAmount > 0 && mooneyAddress) {
      setIsGeneratingRoute(true)
      quote(amount)
        .then((quotedAmount) => {
          setOutput(quotedAmount)
          setHasValidRoute(parseFloat(quotedAmount) > 0)
          setEstimatedGasUsedUSD('2.50')
          setIsGeneratingRoute(false)
        })
        .catch((error) => {
          console.error('Quote error:', error)
          setOutput('0')
          setHasValidRoute(false)
          setIsGeneratingRoute(false)
        })
    } else {
      setOutput('0')
      setHasValidRoute(false)
    }
  }, [amount, mooneyAddress, quote])

  useEffect(() => {
    async function getUSDCost() {
      try {
        const numAmount = parseFloat(amount) || 0
        // Simplified USD cost calculation - in a real implementation,
        // you'd want to get the actual price from a price oracle
        // For now, using a rough estimate based on ETH price
        const ethPriceUSD = 2000 // Rough estimate, should be fetched from API
        const cost = numAmount * ethPriceUSD

        if (cost < 0.01) setUSDCost('<0.01')
        else if (cost < 1) setUSDCost(cost.toFixed(2))
        else setUSDCost(String(Math.ceil(cost)))
      } catch (err) {
        console.log(err)
        setUSDCost('0')
      }
    }

    const numAmount = parseFloat(amount) || 0
    if (numAmount > 0) {
      getUSDCost()
    }
  }, [amount])

  return (
    <div className="w-full max-w-2xl mt-6 px-4">
      <div className="text-sm font-RobotoMono rounded-2xl animate-fadeIn p-4 md:p-6 flex flex-col bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl text-white">
        {/* Header Section */}
        <div className="mb-6">
          <h3 className="font-semibold text-xl text-white">Swap Tokens</h3>
          <p className="text-gray-300 text-sm">
            Get MOONEY on {selectedChain.name}
          </p>
        </div>

        {/* Main Swap Section - Vertical Layout */}
        <div className="space-y-4 mb-6">
          {/* Input Section */}
          <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                  <Image
                    src={`/icons/networks/${getChainSlug(selectedChain)}.svg`}
                    width={24}
                    height={24}
                    alt=""
                    className="object-contain"
                    onError={(e) => {
                      console.log(
                        `Failed to load icon for chain: ${
                          selectedChain.name
                        }, slug: ${getChainSlug(selectedChain)}`
                      )
                      // Fallback to showing the first letter of the chain name
                      const target = e.target as HTMLImageElement
                      const parent = target.parentElement
                      if (parent) {
                        parent.innerHTML = `<div class="text-white text-sm font-bold">${
                          selectedChain.name?.charAt(0) || '?'
                        }</div>`
                      }
                    }}
                  />
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                    You Pay
                  </p>
                  <p className="font-medium text-white text-base">
                    {CHAIN_TOKEN_NAMES[selectedChain?.slug]}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {address && (
                  <p className="text-gray-400 text-xs">
                    Balance: {Number(nativeBalance).toFixed(4)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <input
                className="text-white bg-transparent text-2xl lg:text-3xl font-RobotoMono placeholder-gray-500 focus:outline-none flex-1"
                placeholder="0.0"
                pattern="[0-9]*[.,]?[0-9]*"
                value={amount}
                onChange={({ target }) => {
                  // Allow decimal input by keeping it as string
                  let value = target.value.replace(/[^0-9.]/g, '') // Only allow numbers and decimal point

                  // Prevent negative values (though regex above should handle this)
                  if (parseFloat(value) < 0) {
                    value = '0'
                  }

                  const parts = value.split('.')
                  if (parts.length <= 2) {
                    // Only allow one decimal point
                    setAmount(value)
                  }
                }}
              />
              {parseFloat(amount) > 0 && (
                <button
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors px-3 py-1 bg-blue-400/10 hover:bg-blue-400/20 rounded-lg border border-blue-400/20"
                  onClick={() => setAmount(nativeBalance)}
                >
                  MAX
                </button>
              )}
            </div>
            <div className="mt-2">
              {usdCost && (
                <p className="text-gray-400 text-sm">{`≈ $${usdCost.toLocaleString()} USD`}</p>
              )}
            </div>
          </div>

          {/* Arrow Separator */}
          <div className="w-full flex justify-center">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-lg transform hover:scale-110 transition-transform duration-200 cursor-pointer">
              <ArrowDownIcon width={14} height={14} className="text-white" />
            </div>
          </div>

          {/* Output Section */}
          <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 p-1">
                  <Image
                    src={`/Original.png`}
                    width={24}
                    height={24}
                    alt=""
                    className="rounded-full"
                  />
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                    You Receive
                  </p>
                  <p className="font-medium text-white text-base">MOONEY</p>
                </div>
              </div>
              {output && (
                <div className="text-right">
                  <p className="text-gray-400 text-xs">Governance</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-white text-2xl lg:text-3xl font-RobotoMono">
                {isGeneratingRoute ? (
                  <span className="text-gray-400 text-lg">Calculating...</span>
                ) : (
                  parseFloat(output).toLocaleString() || '0.0'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Transaction Details and Action Button */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
          {/* Transaction Details */}
          {(parseFloat(amount) > 0 || hasValidRoute) && (
            <div className="lg:col-span-2 space-y-3">
              <h4 className="text-gray-300 font-medium text-xs uppercase tracking-wide">
                Details
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/10 rounded-xl p-3 border border-white/5 hover:bg-black/20 transition-colors duration-200">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-400 text-xs">Gas</p>
                    <div className="flex gap-1 items-center">
                      <GasIcon />
                      <p className="text-white text-xs font-medium">{`$${estimatedGasUsedUSD}`}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-black/10 rounded-xl p-3 border border-white/5 hover:bg-black/20 transition-colors duration-200">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-400 text-xs">Impact</p>
                    <p className="text-xs font-medium text-green-400">
                      {hasValidRoute ? '<0.1%' : '0%'}
                    </p>
                  </div>
                </div>
              </div>

              {(selectedChain.slug === 'arbitrum' ||
                selectedChain.slug === 'base') && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                    <p className="text-orange-400 font-medium text-xs">
                      Low Liquidity
                    </p>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed">
                    Limited liquidity may affect swap output on{' '}
                    {selectedChain.name}.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <div className="flex flex-col justify-end">
            <PrivyWeb3Button
              v5
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:from-gray-500 disabled:to-gray-600"
              label={
                isGeneratingRoute
                  ? 'Finding Route...'
                  : !amount || parseFloat(amount) === 0
                  ? 'Enter Amount'
                  : !hasValidRoute
                  ? 'No Route Available'
                  : 'Swap'
              }
              action={async () => {
                const numAmount = parseFloat(amount) || 0
                if (numAmount === 0) return toast.error('Enter an amount.')
                if (!hasValidRoute) return toast.error('No route found.')

                // check native balance
                if (numAmount > +nativeBalance) {
                  return toast.error('Insufficient balance.')
                }

                try {
                  const minOut = (parseFloat(output) * 0.95).toString() // 5% slippage
                  await swap(amount, minOut)
                  toast.success('Swap completed successfully!')
                } catch (error) {
                  console.error('Swap error:', error)
                  toast.error('Swap failed. Please try again.')
                }
              }}
              isDisabled={
                isGeneratingRoute ||
                !amount ||
                parseFloat(amount) === 0 ||
                !hasValidRoute
              }
            />

            {/* Additional Info */}
            <div className="text-center mt-3">
              <p className="text-gray-400 text-xs">Powered by Uniswap v4</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
