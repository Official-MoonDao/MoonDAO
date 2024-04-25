import { useAddress } from '@thirdweb-dev/react'
import { TradeType } from '@uniswap/sdk-core'
import { Token } from '@uniswap/sdk-core'
import { SwapRoute, nativeOnChain } from '@uniswap/smart-order-router'
import { ethers } from 'ethers'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useUniswapTokens } from '../../lib/uniswap/UniswapTokens'
import { useUniversalRouter } from '../../lib/uniswap/hooks/useUniversalRouter'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import {
  MOONEY_ADDRESSES,
  UNIVERSAL_ROUTER_ADDRESSES,
} from '../../const/config'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

const swapMinimums = {
  MOONEY: '12,500',
  MATIC: '0.5',
  ETH: '0.0025',
}

const nativeSymbols = {
  ethereum: 'ETH',
  polygon: 'MATIC',
  arbitrum: 'ETH',
  sepolia: 'ETH',
  'arbtirum-sepolia': 'ETH',
}

export default function SwapTokens({ selectedChain, mooneyContract }: any) {
  const address = useAddress()

  const nativeBalance = useNativeBalance()
  const { data: mooneyBalance } = useHandleRead(mooneyContract, 'balanceOf', [
    address,
  ])

  const [amount, setAmount] = useState(0)
  const [inputToken, setInputToken] = useState<any>()
  const [outputToken, setOutputToken] = useState<any>()
  const [output, setOutput] = useState<number>()
  const [swapRoute, setSwapRoute] = useState<SwapRoute>()
  const [swapFrom, setSwapFrom] = useState<any>('native')

  useEffect(() => {
    setInputToken(nativeOnChain(selectedChain.chainId))
    setOutputToken(
      new Token(selectedChain.chainId, MOONEY_ADDRESSES[selectedChain.slug], 18)
    )
  }, [])

  useEffect(() => {
    const native = nativeOnChain(selectedChain.chainId)
    const mooney = new Token(
      selectedChain.chainId,
      MOONEY_ADDRESSES[selectedChain.slug],
      18,
      'MOONEY',
      'MOONEY'
    )

    if (swapFrom === 'native') {
      setInputToken(native)
      setOutputToken(mooney)
    } else {
      setInputToken(mooney)
      setOutputToken(native)
    }
  }, [swapFrom, selectedChain])

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
  }, [amount, inputToken, selectedChain])

  return (
    <div className="border-2 p-8">
      {/* input token*/}
      <select
        className="text-black"
        onChange={({ target }) => {
          setSwapFrom(target.value)
        }}
      >
        <option value="native">{nativeSymbols[selectedChain.slug]}</option>
        <option value="mooney">MOONEY</option>
      </select>
      <input
        className="px-2 text-black"
        placeholder="Amount"
        onChange={({ target }) => {
          setAmount(Number(target.value))
        }}
        min={swapFrom === 'native' ? 0.01 : 10000}
      />
      <p className="opacity-50">{`*Min : ${
        inputToken?.symbol ? swapMinimums[inputToken.symbol] : ''
      } ${inputToken?.symbol} *`}</p>
      {/* output token*/}
      <div className="flex gap-2">
        <div className="bg-white text-black">{outputToken?.symbol}</div>
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

          console.log(
            ethers.utils.parseEther(amount.toString()).gt(mooneyBalance)
          )

          if (inputToken.symbol === 'MOONEY') {
            if (ethers.utils.parseEther(amount.toString()).gt(mooneyBalance)) {
              return toast.error('Insufficient balance')
            }

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
          } else {
            // check native balance
            if (amount > nativeBalance) {
              return toast.error('Insufficient balance')
            }
          }

          executeRoute(swapRoute)
        }}
      />
    </div>
  )
}
