import { ArrowDownIcon } from '@heroicons/react/24/outline'
import { useAddress } from '@thirdweb-dev/react'
import { TradeType } from '@uniswap/sdk-core'
import { SwapRoute } from '@uniswap/smart-order-router'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useUniversalRouter } from '../../lib/uniswap/hooks/useUniversalRouter'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import { useUniswapTokens } from '@/lib/uniswap/hooks/useUniswapTokens'
import GasIcon from '../assets/GasIcon'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

const nativeSymbols: any = {
  ethereum: 'ETH',
  polygon: 'MATIC',
  arbitrum: 'ETH',
  sepolia: 'ETH',
  'arbitrum-sepolia': 'ETH',
}

export default function NativeToMooney({ selectedChain }: any) {
  const nativeBalance = useNativeBalance()

  const address = useAddress()

  const [amount, setAmount] = useState(0)
  const [inputToken, setInputToken] = useState<any>()
  const [outputToken, setOutputToken] = useState<any>()
  const [output, setOutput] = useState<number>()
  const [swapRoute, setSwapRoute] = useState<SwapRoute>()
  const [estimatedGasUsedUSD, setEstimatedGasUsedUSD] = useState<any>(0)

  const { NATIVE, MOONEY } = useUniswapTokens(selectedChain)

  const { generateRoute, executeRoute } = useUniversalRouter(
    amount,
    NATIVE,
    MOONEY
  )

  useEffect(() => {
    if (amount > 0) {
      generateRoute(TradeType.EXACT_INPUT).then((route) => {
        setSwapRoute(route)
        setOutput(route?.route[0].rawQuote.toString() / 10 ** 18 || 0)

        const estimatedGasUSD = route?.estimatedGasUsedUSD.toFixed(2)

        if (estimatedGasUSD < 0.01) {
          setEstimatedGasUsedUSD('<0.01')
        } else {
          setEstimatedGasUsedUSD(estimatedGasUSD || 0)
        }
      })
    }
  }, [amount, selectedChain, inputToken, outputToken, address])

  return (
    <div className="max-w-[500px] w-full flex flex-col gap-1">
      <div className="flex flex-col p-4 gap-2 bg-darkest-cool min-h-[150px] rounded-lg">
        <p className="opacity-50">You Pay</p>
        <div className="flex justify-between">
          <input
            className="text-white bg-transparent md:text-2xl"
            placeholder="Amount"
            pattern="[0-9]*[.,]?[0-9]*"
            onChange={({ target }) => {
              setAmount(Number(target.value))
            }}
          />

          <div className="p-2 flex items-center gap-2 bg-black rounded-full">
            <Image
              src={`/icons/networks/${selectedChain.slug}.svg`}
              width={15}
              height={15}
              alt=""
            />
            <p>{nativeSymbols[selectedChain?.slug]}</p>
          </div>
        </div>
        {address && <p className="opacity-50">{`Balance: ${nativeBalance}`}</p>}
      </div>
      <div className="h-0 w-full flex justify-center items-center z-[5]">
        <button
          className="p-4 bg-[#29253f] rounded-full"
          onClick={() => {
            if (swapRoute)
              setAmount(+swapRoute.route[0].rawQuote.toString() / 10 ** 18 || 0)
            setInputToken(outputToken)
            setOutputToken(inputToken)
          }}
        >
          <ArrowDownIcon width={25} height={25} />
        </button>
      </div>

      <div className="flex flex-col p-4 gap-2 bg-darkest-cool min-h-[150px] rounded-lg">
        <p className="opacity-50">You Receive</p>
        <div className="flex justify-between items-center">
          <p className="md:text-2xl">{output?.toLocaleString() || 0}</p>
          <div className="p-2 flex items-center gap-2 bg-black rounded-full">
            <Image src={`/original.png`} width={20} height={20} alt="" />
            <p>MOONEY</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col bg-darkest-cool p-4">
        <div className="mt-2 p-2 w-full flex justify-between border-[1px] rounded-lg">
          <p>Network Cost</p>
          <div className="flex gap-2 items-center">
            <GasIcon />
            <p>{`$ ${estimatedGasUsedUSD}`}</p>
          </div>
        </div>

        <div className="mt-2 p-2 w-full flex justify-between border-[1px] border-moon-orange rounded-lg text-moon-orange">
          <p>Price Impact</p>
          <p>{`~ ${
            swapRoute ? swapRoute.trade.priceImpact.toFixed(2) : 0
          }%`}</p>
        </div>

        {selectedChain.slug === 'arbitrum' && (
          <div className="mt-2 p-2 w-full flex justify-between border-[1px] border-moon-orange rounded-lg text-moon-orange text-[75%]">
            <div className="flex gap-2 items-center">
              <p>{`Please note that due to low liquidity in the Arbitrum L2 pool, swapping ETH for $MOONEY may result in receiving fewer $MOONEY than expected. We recommend reviewing current liquidity conditions and potential slippage before proceeding with your swap.
`}</p>
            </div>
          </div>
        )}
      </div>

      <PrivyWeb3Button
        className="mt-2 rounded-[5vmax] rounded-tl-[20px]"
        label={'Swap'}
        action={async () => {
          if (amount === 0) return toast.error('Enter an amount')
          if (!swapRoute) return toast.error('No route found')

          // check native balance
          if (amount > nativeBalance) {
            return toast.error('Insufficient balance')
          }

          await executeRoute(swapRoute)
        }}
      />
    </div>
  )
}
