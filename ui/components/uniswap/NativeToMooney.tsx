import { CHAIN_TOKEN_NAMES, MOONEY_ADDRESSES, FEE_HOOK_ADDRESSES, TICK_SPACING } from 'const/config'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import { useUniswapV4 } from '../../lib/uniswap/hooks/useUniswapV4'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { useGasPrice } from '@/lib/rpc/useGasPrice'
import GasIcon from '../assets/GasIcon'
import Input from '../layout/Input'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'

export default function NativeToMooney({ selectedChain }: any) {
  const chainSlug = getChainSlug(selectedChain)

  const { nativeBalance } = useNativeBalance()

  const account = useActiveAccount()
  const address = account?.address

  const [amount, setAmount] = useState<string>('')
  const [output, setOutput] = useState<string>('0')
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false)
  const [estimatedGasUsedUSD, setEstimatedGasUsedUSD] = useState<any>(0)
  const [priceImpact, setPriceImpact] = useState<number | null>(null)
  const [hasValidRoute, setHasValidRoute] = useState(false)

  const mooneyAddress = MOONEY_ADDRESSES[chainSlug]
  const { quote, swap, estimateGas } = useUniswapV4(
    mooneyAddress,
    18,
    TICK_SPACING,
    FEE_HOOK_ADDRESSES[chainSlug]
  )
  const { effectiveGasPrice } = useGasPrice(selectedChain)
  const { ethPrice } = useETHPrice(1, 'ETH_TO_USD')

  useEffect(() => {
    const numAmount = parseFloat(amount) || 0
    if (numAmount > 0 && mooneyAddress) {
      setIsGeneratingRoute(true)
      quote(amount)
        .then(async (quotedAmount) => {
          setOutput(quotedAmount)
          const validRoute = parseFloat(quotedAmount) > 0
          setHasValidRoute(validRoute)

          if (validRoute) {
            try {
              const spotQuoteAmount = await quote('0.0001')
              const spotOutput = parseFloat(spotQuoteAmount) || 0
              const actualOutput = parseFloat(quotedAmount) || 0
              const numAmount = parseFloat(amount) || 0
              if (spotOutput > 0 && numAmount > 0) {
                const spotPrice = spotOutput / 0.0001
                const expectedOutput = numAmount * spotPrice
                if (expectedOutput > 0) {
                  const impact = (1 - actualOutput / expectedOutput) * 100
                  setPriceImpact(Math.max(0, impact))
                } else {
                  setPriceImpact(null)
                }
              } else {
                setPriceImpact(null)
              }
            } catch {
              setPriceImpact(null)
            }
          } else {
            setPriceImpact(null)
          }

          if (validRoute && effectiveGasPrice && ethPrice) {
            setEstimatedGasUsedUSD('...')
            try {
              const minOut = (parseFloat(quotedAmount) * 0.95).toString()
              let gasEstimate: bigint
              try {
                gasEstimate = await estimateGas(amount, minOut)
              } catch (estErr) {
                console.warn('Gas API estimate failed, using fallback:', estErr)
                gasEstimate = BigInt(200000)
              }
              const gasWithBuffer = (gasEstimate * BigInt(120)) / BigInt(100)
              const gasCostWei = gasWithBuffer * effectiveGasPrice
              const gasCostEth = Number(gasCostWei) / 1e18
              const gasCostUsd = gasCostEth * ethPrice
              setEstimatedGasUsedUSD(gasCostUsd.toFixed(2))
            } catch (err) {
              console.error('Gas estimation error:', err)
              setEstimatedGasUsedUSD('—')
            }
          } else if (validRoute && (!effectiveGasPrice || !ethPrice)) {
            setEstimatedGasUsedUSD('...')
          } else {
            setEstimatedGasUsedUSD('0.00')
          }
          setIsGeneratingRoute(false)
        })
        .catch((error) => {
          console.error('Quote error:', error)
          setOutput('0')
          setHasValidRoute(false)
          setEstimatedGasUsedUSD('0.00')
          setPriceImpact(null)
          setIsGeneratingRoute(false)
        })
    } else {
      setOutput('0')
      setHasValidRoute(false)
      setEstimatedGasUsedUSD('0.00')
      setPriceImpact(null)
    }
  }, [amount, mooneyAddress, quote, estimateGas, effectiveGasPrice, ethPrice])

  return (
    <div className="w-full mt-3 sm:mt-4">
      <div className="text-sm font-RobotoMono rounded-xl sm:rounded-2xl animate-fadeIn p-3 sm:p-4 flex flex-col bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl text-white">
        {/* Main Swap Section - Compact */}
        <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
          <div className="grid grid-cols-1 gap-2 sm:gap-3">
            {/* You Pay */}
            <div className="bg-black/20 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200 min-h-[88px] sm:min-h-[96px] flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                    <Image
                      src={`/icons/networks/${getChainSlug(selectedChain)}.svg`}
                      width={20}
                      height={20}
                      alt=""
                      className="object-contain w-5 h-5 sm:w-5 sm:h-5"
                      onError={(e) => {
                        console.log(
                          `Failed to load icon for chain: ${selectedChain.name}, slug: ${getChainSlug(
                            selectedChain
                          )}`
                        )
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
                  <div className="min-w-0">
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                      You Pay
                    </p>
                    <p className="font-medium text-white text-base truncate">
                      {CHAIN_TOKEN_NAMES[chainSlug] ?? 'ETH'}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <NetworkSelector compact />
                </div>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:gap-x-4 mt-2 sm:mt-3 min-h-[32px]">
                <div className="min-w-0 flex items-center overflow-hidden">
                  <Input
                    type="text"
                    placeholder="0.0"
                    className="text-white bg-transparent text-xl sm:text-2xl font-RobotoMono placeholder-gray-500 focus:outline-none w-full min-w-0 border-0 !p-0 min-h-[28px] tabular-nums"
                    bare
                    value={amount}
                    max={nativeBalance ? parseFloat(nativeBalance) : undefined}
                    onChange={(e) => {
                      let value = e.target.value
                      value = value.replace(/[^0-9.]/g, '')
                      const parts = value.split('.')
                      if (parts.length > 2) {
                        value = parts[0] + '.' + parts.slice(1).join('')
                      }
                      if (parseFloat(value) < 0) value = '0'
                      if (nativeBalance && parseFloat(value) > parseFloat(nativeBalance)) {
                        value = nativeBalance
                      }
                      setAmount(value)
                    }}
                    formatNumbers={true}
                    maxWidth="max-w-none"
                  />
                </div>
                <div className="flex items-center gap-2 sm:gap-3 justify-end shrink-0 w-[160px] sm:w-[200px]">
                  {address && (
                    <>
                      <p className="text-gray-400 text-xs whitespace-nowrap">
                        Balance: {Number(nativeBalance).toFixed(4)} {CHAIN_TOKEN_NAMES[chainSlug] ?? 'ETH'}
                      </p>
                      <button
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors px-3 py-1.5 bg-blue-400/10 hover:bg-blue-400/20 rounded-lg border border-blue-400/20 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-400/10"
                        onClick={() => setAmount(nativeBalance ?? '0')}
                        disabled={!nativeBalance || parseFloat(nativeBalance) === 0}
                      >
                        MAX
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* You Receive */}
            <div className="bg-black/20 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200 min-h-[88px] sm:min-h-[96px] flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                    <Image
                      src={`/Original.png`}
                      width={20}
                      height={20}
                      alt=""
                      className="rounded-full object-cover w-5 h-5 sm:w-5 sm:h-5"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                      You Receive
                    </p>
                    <p className="font-medium text-white text-base truncate">
                      MOONEY
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 min-w-[80px] sm:min-w-[140px]" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:gap-x-4 mt-2 sm:mt-3 min-h-[32px]">
                <div className="min-w-0 flex items-center">
                  <p className="text-white text-xl sm:text-2xl font-RobotoMono tabular-nums">
                    {isGeneratingRoute ? (
                      <span className="text-gray-400 text-xl sm:text-2xl">Calculating...</span>
                    ) : (
                      (parseFloat(output) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 18 }) || '0.0'
                    )}
                  </p>
                </div>
                <div className="w-[160px] sm:w-[200px] shrink-0" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Details and Action Button */}
        <div className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
          {/* Transaction Details */}
          {(parseFloat(amount) > 0 || hasValidRoute) && (
            <div className="space-y-2">
              <h4 className="text-gray-300 font-medium text-xs uppercase tracking-wide">Details</h4>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-black/20 rounded-lg p-2.5 sm:p-3 border border-white/5 hover:bg-black/30 transition-colors duration-200 min-h-[44px] sm:min-h-[48px] flex items-center justify-between">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Gas</p>
                  <div className="flex gap-1.5 items-center">
                    <GasIcon />
                    <p className="text-white text-sm font-medium">{`$${estimatedGasUsedUSD}`}</p>
                  </div>
                </div>

                <div className="bg-black/20 rounded-lg p-2.5 sm:p-3 border border-white/5 hover:bg-black/30 transition-colors duration-200 min-h-[44px] sm:min-h-[48px] flex items-center justify-between">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Impact</p>
                  <p
                    className={`text-sm font-medium ${
                      priceImpact !== null && priceImpact > 5
                        ? 'text-orange-400'
                        : priceImpact !== null && priceImpact > 1
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    }`}
                  >
                    {priceImpact !== null
                      ? `${priceImpact < 0.01 ? '<0.01' : priceImpact.toFixed(2)}%`
                      : hasValidRoute
                      ? '...'
                      : '0%'}
                  </p>
                </div>
              </div>

              {(selectedChain.slug === 'arbitrum' || selectedChain.slug === 'base') && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2.5 sm:p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse flex-shrink-0" />
                    <p className="text-orange-400 font-medium text-xs">Low Liquidity</p>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed">
                    Limited liquidity may affect swap output on {selectedChain.name}.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Swap Button */}
          <div className="w-full">
            <PrivyWeb3Button
              v5
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 sm:py-4 px-4 rounded-xl text-base sm:text-lg font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:from-gray-500 disabled:to-gray-600"
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
                if (numAmount === 0) return toast.error('Please enter an amount greater than zero to swap.')
                if (!hasValidRoute) return toast.error('No swap route available for this pair. Try a different amount.')

                // check native balance
                if (numAmount > +nativeBalance) {
                  return toast.error('Insufficient balance — you don\'t have enough ETH to complete this swap.')
                }

                try {
                  const minOut = (parseFloat(output) * 0.95).toString() // 5% slippage
                  await swap(amount, minOut)
                  toast.success('Swap completed! MOONEY incoming.')
                } catch (error) {
                  console.error('Swap error:', error)
                  toast.error('Swap failed — transaction rejected or price slipped.')
                }
              }}
              isDisabled={
                isGeneratingRoute || !amount || parseFloat(amount) === 0 || !hasValidRoute
              }
            />
          </div>

          {/* Additional Info */}
          <div className="text-center mt-2">
            <p className="text-gray-400 text-xs">Powered by Uniswap v4</p>
          </div>
        </div>
      </div>
    </div>
  )
}
