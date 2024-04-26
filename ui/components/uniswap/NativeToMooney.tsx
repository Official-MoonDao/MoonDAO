import { useAddress } from '@thirdweb-dev/react'
import { TradeType } from '@uniswap/sdk-core'
import { Token } from '@uniswap/sdk-core'
import { SwapRoute, nativeOnChain } from '@uniswap/smart-order-router'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useUniversalRouter } from '../../lib/uniswap/hooks/useUniversalRouter'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import { MOONEY_ADDRESSES } from '../../const/config'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

const swapMinimums: any = {
  MOONEY: '10,000',
  MATIC: '0.5',
  ETH: '0.001',
}

const nativeSymbols: any = {
  ethereum: 'ETH',
  polygon: 'MATIC',
  arbitrum: 'ETH',
  sepolia: 'ETH',
  'arbitrum-sepolia': 'ETH',
}

export default function NativeToMooney({ selectedChain }: any) {
  const nativeBalance = useNativeBalance()

  const [amount, setAmount] = useState(0)
  const [inputToken, setInputToken] = useState<any>()
  const [outputToken, setOutputToken] = useState<any>()
  const [output, setOutput] = useState<number>()
  const [swapRoute, setSwapRoute] = useState<SwapRoute>()

  useEffect(() => {
    const native = nativeOnChain(selectedChain.chainId)
    const mooney = new Token(
      selectedChain.chainId,
      MOONEY_ADDRESSES[selectedChain.slug],
      18,
      'MOONEY',
      'MOONEY'
    )

    setInputToken(native)
    setOutputToken(mooney)
  }, [selectedChain])

  const { generateRoute, executeRoute } = useUniversalRouter(
    amount,
    inputToken,
    outputToken
  )

  useEffect(() => {
    generateRoute(TradeType.EXACT_INPUT).then((route) => {
      setSwapRoute(route)
      setOutput(route?.route[0].rawQuote.toString() / 10 ** 18)
    })
  }, [amount, selectedChain, inputToken])

  return (
    <div className="border-2 p-8">
      {/* input token */}
      <div className="flex gap-2">
        <p className="bg-white text-black">
          {nativeSymbols[selectedChain.slug]}
        </p>
        <input
          className="px-2 text-black"
          placeholder="Amount"
          onChange={({ target }) => {
            setAmount(Number(target.value))
          }}
        />
      </div>
      <p className="opacity-50">{`*Min : ${
        inputToken?.symbol ? swapMinimums[inputToken.symbol] : ''
      } ${inputToken?.symbol} *`}</p>
      {/* output token*/}
      <div className="flex gap-2">
        <p className="bg-white text-black">{'MOONEY'}</p>
        <input
          className="px-2 text-black"
          placeholder="Output"
          readOnly
          value={output ? output : 0}
        />
      </div>
      <PrivyWeb3Button
        className="bg-white mt-4"
        label={'Swap'}
        action={async () => {
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
