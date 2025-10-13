import { ArrowDownIcon } from '@heroicons/react/20/solid'
import { FEE_HOOK_ADDRESSES } from 'const/config'
import Image from 'next/image'
import { useEffect, useState, useCallback, useContext } from 'react'
import toast from 'react-hot-toast'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useUniswapV4 } from '@/lib/uniswap/hooks/useUniswapV4'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export default function MissionTokenSwapV4({ token }: { token: any }) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const [usdInput, setUsdInput] = useState('')
  const [amountIn, setAmountIn] = useState('')
  const [amountOut, setAmountOut] = useState<string>()
  const tickSpacing = 100
  const { quote, swap } = useUniswapV4(
    token.tokenAddress,
    token.tokenDecimals,
    tickSpacing,
    FEE_HOOK_ADDRESSES[chainSlug]
  )
  const { data: ethUsdPrice } = useETHPrice(1, 'ETH_TO_USD')

  const formatWithCommas = useCallback((value: string) => {
    if (!value) return ''
    const numericValue = value.replace(/,/g, '')
    const num = parseFloat(numericValue)
    if (isNaN(num)) return value
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }, [])

  // Format input with commas in real-time
  const formatInputWithCommas = useCallback((value: string) => {
    if (!value) return ''
    const numericValue = value.replace(/,/g, '')
    
    // Handle case where user is typing a decimal point at the end
    if (numericValue.endsWith('.')) {
      const integerPart = numericValue.slice(0, -1)
      const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return `${formattedInteger}.`
    }
    
    // Split by decimal point
    const parts = numericValue.split('.')
    const integerPart = parts[0]
    const decimalPart = parts[1] || ''
    
    // Add commas to integer part
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    
    // Combine with decimal part
    return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger
  }, [])

  const formattedUsdInput = formatWithCommas(usdInput)

  const calculateEthAmount = useCallback(() => {
    const numericValue = usdInput.replace(/,/g, '')
    if (!numericValue || !ethUsdPrice || isNaN(Number(numericValue)))
      return '0.0000'
    const ethAmount = (Number(numericValue) / ethUsdPrice).toFixed(6)
    return parseFloat(ethAmount).toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })
  }, [usdInput, ethUsdPrice])

  const handleUsdInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value

      // Allow numbers, decimal point, and commas
      inputValue = inputValue.replace(/[^0-9.,]/g, '')

      // Replace commas with empty string for processing
      const numericValue = inputValue.replace(/,/g, '')

      // Check if it's a valid decimal number with max 2 decimal places
      const decimalParts = numericValue.split('.')
      if (decimalParts.length > 2) {
        // More than one decimal point, keep only the first part
        inputValue = decimalParts[0] + '.' + decimalParts.slice(1).join('')
      } else if (decimalParts.length === 2 && decimalParts[1].length > 2) {
        // More than 2 decimal places, truncate to 2
        inputValue = decimalParts[0] + '.' + decimalParts[1].substring(0, 2)
      }

      // Limit to max 7 digits before decimal
      const finalNumericValue = inputValue.replace(/,/g, '')
      const parts = finalNumericValue.split('.')
      if (parts[0].length > 7) return

      // Format with commas for display
      const formattedValue = formatInputWithCommas(inputValue)
      setUsdInput(formattedValue)

      if (finalNumericValue === '' || !ethUsdPrice) {
        setAmountIn('')
        return
      }
      setAmountIn((Number(finalNumericValue) / ethUsdPrice).toFixed(6))
    },
    [ethUsdPrice, formatInputWithCommas]
  )

  useEffect(() => {
    async function fetchQuote() {
      if (!amountIn) return
      try {
        const out = await quote(amountIn)
        setAmountOut(out)
      } catch (err) {
        console.error(err)
        setAmountOut(undefined)
      }
    }
    fetchQuote()
  }, [amountIn, quote])

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* You pay */}
      <div className="space-y-2">
        <label className="text-gray-300 font-medium text-sm uppercase tracking-wide">
          You pay
        </label>
        <div className="bg-gradient-to-r from-[#121C42] to-[#090D21] border border-white/10 rounded-xl p-4 shadow-lg">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-light-cool rounded-full flex items-center justify-center">
                <Image
                  src="/coins/ETH.svg"
                  alt="ETH"
                  width={16}
                  height={16}
                  className="w-4 h-4"
                />
              </div>
              <div>
                <p className="font-bold text-white text-lg flex items-center gap-1">
                  {calculateEthAmount()} ETH
                </p>
                <p className="text-gray-400 text-xs">Ethereum</p>
              </div>
            </div>
            <div className="bg-[#111C42] rounded-lg px-3 py-2 border border-white/10 w-full md:w-1/2">
              <div className="flex items-center space-x-2">
                <span className="text-white font-medium">$</span>
                <input
                  id="usd-swap-input"
                  type="text"
                  className="w-full bg-transparent border-none outline-none text-lg font-bold text-white text-right placeholder-gray-500 focus:placeholder-gray-400 transition-colors duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={usdInput}
                  onChange={handleUsdInputChange}
                  placeholder="0"
                  maxLength={15}
                />
                <span className="text-white font-medium">USD</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connecting element */}
      <div className="mt-4 flex justify-center">
        <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-darkest-cool/50 to-dark-cool/50 rounded-full border border-white/10 shadow-lg">
          <ArrowDownIcon className="w-4 h-4 text-gray-300" />
        </div>
      </div>

      {/* You receive */}
      {token?.tokenSymbol && (
        <div className="mt-[-16px] space-y-2">
          <label className="text-gray-300 font-medium text-sm uppercase tracking-wide">
            You receive
          </label>
          <div className="bg-gradient-to-r from-[#121C42] to-[#090D21] border border-white/10 rounded-xl p-4 shadow-lg">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                  <Image
                    src="/assets/icon-star.svg"
                    alt="Token"
                    width={16}
                    height={16}
                    className="w-4 h-4 text-white"
                  />
                </div>
                <div>
                  <p className="font-bold text-white text-lg">
                    {token?.tokenSymbol}
                  </p>
                  <p className="text-gray-400 text-xs">{token?.tokenName}</p>
                </div>
              </div>
              <div className="bg-[#111C42] rounded-lg px-3 py-2 border border-white/10 w-full md:w-1/2">
                <div className="flex items-center justify-end gap-2">
                  <p className="w-full bg-transparent border-none outline-none text-lg font-bold text-white text-right placeholder-gray-500 focus:placeholder-gray-400 transition-colors duration-200">
                    {amountOut && parseFloat(amountOut) && amountIn
                      ? parseFloat(amountOut).toPrecision(3)
                      : '0.0'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <PrivyWeb3Button
        className="mt-4 rounded-full gradient-2 rounded-full w-full py-1"
        label="Buy"
        action={async () => {
          const numericValue = usdInput.replace(/,/g, '')
          if (!amountIn || !numericValue || parseFloat(numericValue) <= 0)
            return toast.error('Enter amount')
          try {
            await swap(amountIn, '0')
            toast.success('Swap submitted')
          } catch (err) {
            console.error(err)
            toast.error('Swap failed')
          }
        }}
      />
    </div>
  )
}
