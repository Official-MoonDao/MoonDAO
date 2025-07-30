import { ArrowDownIcon } from '@heroicons/react/20/solid'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useUniswapV4 } from '@/lib/uniswap/hooks/useUniswapV4'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export default function MissionTokenSwapV4({ token }: { token: any }) {
  const [amountIn, setAmountIn] = useState('')
  const [amountOut, setAmountOut] = useState<string>()
  const { quote, swap } = useUniswapV4(token.tokenAddress, token.tokenDecimals)

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image
                src="/icons/eth.svg"
                alt="ETH"
                width={24}
                height={24}
                className="w-5 h-5"
              />
              <span className="text-xl font-bold">ETH</span>
            </div>
            <input
              className="bg-transparent text-right flex-1 focus:outline-none text-xl font-bold"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
            />
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
            {parseFloat(amountOut).toPrecision(3) || '0.0'}
          </p>
          <div className="flex gap-2 items-center bg-[#111C42] rounded-full p-1 px-2">
            <Image
              src="/Original.png"
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
        className="w-full bg-moon-indigo rounded-xl py-2 text-white"
        label="Swap"
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
