import { useAddress } from '@thirdweb-dev/react'
import { TradeType } from '@uniswap/sdk-core'
import { SwapRoute } from '@uniswap/smart-order-router'
import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useUniswapTokens } from '../../lib/uniswap/UniswapTokens'
import { useUniversalRouter } from '../../lib/uniswap/hooks/useUniversalRouter'
import {
  MOONEY_ADDRESSES,
  UNIVERSAL_ROUTER_ADDRESSES,
} from '../../const/config'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

const swapMinimums = {
  MOONEY: '12,500',
  MATIC: '10',
  ETH: '0.0025',
}

export default function SwapTokens({ selectedChain, mooneyContract }: any) {
  const address = useAddress()
  const { MOONEY, NATIVE_TOKEN } = useUniswapTokens()

  const [amount, setAmount] = useState(0)
  const [inputToken, setInputToken] = useState(NATIVE_TOKEN)
  const [outputToken, setOutputToken] = useState(MOONEY)
  const [output, setOutput] = useState<number>()
  const [swapRoute, setSwapRoute] = useState<SwapRoute>()

  useEffect(() => {
    if (inputToken === NATIVE_TOKEN) {
      setOutputToken(MOONEY)
    } else {
      setOutputToken(NATIVE_TOKEN)
    }
  }, [inputToken])

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
  }, [amount, inputToken])

  return (
    <div className="border-2 p-8">
      {/* input token*/}
      <select
        className="text-black"
        onChange={({ target }) => {
          if (target.value === 'native') {
            setInputToken(NATIVE_TOKEN)
          } else {
            setInputToken(MOONEY)
          }
        }}
      >
        <option value="native">{NATIVE_TOKEN.symbol}</option>
        <option value="mooney">MOONEY</option>
      </select>
      <input
        className="px-2 text-black"
        placeholder="Amount"
        onChange={({ target }) => {
          setAmount(Number(target.value))
        }}
        min={inputToken === NATIVE_TOKEN ? 0.01 : 10000}
      />
      <p className="opacity-50">{`*Min : ${
        inputToken.symbol ? swapMinimums[inputToken.symbol] : ''
      } ${inputToken.symbol} *`}</p>
      {/* output token*/}
      <div className="flex gap-2">
        <div className="bg-white text-black">{outputToken.symbol}</div>
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

          if (inputToken.symbol === 'MOONEY') {
            const allowance = await mooneyContract.call('allowance', [
              address,
              UNIVERSAL_ROUTER_ADDRESSES[selectedChain.slug],
            ])

            if (ethers.utils.parseEther(amount.toString()).gt(allowance)) {
              await mooneyContract.call('approve', [
                UNIVERSAL_ROUTER_ADDRESSES[selectedChain.slug],
                ethers.utils.parseEther(amount.toString()),
              ])
            }
          }

          executeRoute(swapRoute)
        }}
      />
    </div>
  )
}
