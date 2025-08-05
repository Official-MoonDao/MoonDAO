import { ArrowDownIcon } from '@heroicons/react/20/solid'
import Image from 'next/image'
import { useEffect, useState, useCallback, useContext } from 'react'
import toast from 'react-hot-toast'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { useUniswapV4 } from '@/lib/uniswap/hooks/useUniswapV4'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import { FEE_HOOK_ADDRESSES, TICK_SPACING } from 'const/config'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'

export default function MissionTokenSwapV4({ token }: { token: any }) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const [usdInput, setUsdInput] = useState('')
  const [amountIn, setAmountIn] = useState('')
  const [amountOut, setAmountOut] = useState<string>()
  const { quote, swap } = useUniswapV4(
    token.tokenAddress,
    token.tokenDecimals,
    TICK_SPACING,
    FEE_HOOK_ADDRESSES[chainSlug]
  )
  const { data: ethUsdPrice } = useETHPrice(1, 'ETH_TO_USD')

  const formatWithCommas = useCallback((value: string) => {
    if (!value) return ''
    const num = parseFloat(value)
    if (isNaN(num)) return value
    return num.toLocaleString('en-US')
  }, [])

  const formattedUsdInput = formatWithCommas(usdInput)

  const calculateEthAmount = useCallback(() => {
    if (!usdInput || !ethUsdPrice || isNaN(Number(usdInput))) return '0.0000'
    const ethAmount = (Number(usdInput) / ethUsdPrice).toFixed(6)
    return parseFloat(ethAmount).toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })
  }, [usdInput, ethUsdPrice])

  const handleUsdInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value.replace(/[^0-9]/g, '')
      if (inputValue.length > 7) return
      setUsdInput(inputValue)
      if (inputValue === '' || !ethUsdPrice) {
        setAmountIn('')
        return
      }
      setAmountIn((Number(inputValue) / ethUsdPrice).toFixed(6))
    },
    [ethUsdPrice]
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
    <div className="flex flex-col gap-4">
      <div className="relative flex flex-col gap-4">
        <div className="p-4 pb-12 flex flex-col gap-3 bg-gradient-to-r from-[#121C42] to-[#090D21] rounded-t-2xl">
          <div className="flex justify-between items-start">
            <h3 className="text-sm opacity-60">You pay</h3>
          </div>
          <div className="flex justify-between sm:items-center flex-col sm:flex-row">
            <div className="flex items-center gap-1">
              <span className="text-xl font-bold">$</span>
              <input
                type="text"
                className="bg-transparent border-none outline-none text-xl font-bold min-w-[1ch] w-auto [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={formattedUsdInput}
                onChange={handleUsdInputChange}
                placeholder="0"
                maxLength={9}
                style={{
                  width: `${Math.max(formattedUsdInput.length || 1, 1)}ch`,
                }}
              />
              <span className="text-xl font-bold">USD</span>
            </div>
            <div className="flex mt-2 sm:mt-0 gap-2 items-center sm:bg-[#111C42] rounded-full sm:px-3 py-1">
              <Image
                src="/coins/ETH.svg"
                alt="ETH"
                width={16}
                height={16}
                className="w-5 h-5 bg-light-cool rounded-full"
              />
              <span className="text-base">{calculateEthAmount()} ETH</span>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center">
          <ArrowDownIcon
            className="p-2 w-12 h-12 bg-darkest-cool rounded-full"
            color="#121C42"
          />
        </div>
      </div>
      <div className="p-4 pb-12 flex flex-col gap-3 bg-gradient-to-r from-[#121C42] to-[#090D21] rounded-b-2xl">
        <div className="flex justify-between items-start">
          <h3 className="text-sm opacity-60">You receive</h3>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-xl font-bold">
            {amountOut && parseFloat(amountOut) && amountIn
              ? parseFloat(amountOut).toPrecision(3)
              : '0.0'}
          </p>
          <div className="flex gap-2 items-center bg-[#111C42] rounded-full p-1 px-2">
            <Image
              src="/assets/icon-star.svg"
              alt={token.tokenSymbol}
              width={20}
              height={20}
              className="bg-orange-500 rounded-full p-1 w-5 h-5"
            />
            {token.tokenSymbol}
          </div>
        </div>
      </div>
      <PrivyWeb3Button
        className="rounded-full gradient-2 rounded-full w-full py-1"
        label="Buy"
        action={async () => {
          if (!amountIn) return toast.error('Enter amount')
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
